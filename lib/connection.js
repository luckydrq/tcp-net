/**!
 * tcp-net
 *
 * Authors:
 *   luckydrq <drqzju@gmail.com> (http://github.com/luckydrq)
 */

'use strict';

/**
 * Module dependencies.
 */

const assert = require('assert');
const net = require('net');
const Base = require('sdk-base');
// const is = require('is-type-of');
const awaitEvent = require('await-event');
const debug = require('debug')('net:connection');
const LengthBasedProtocol = require('./protocols/length_based_protocol');
const {
  DISCONNECT,
  DISCONNECTING,
  CONNECT,
  CONNECTING,
  IDLE_TIMEOUT,
  FINWAIT_TIMEOUT,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT,
  HEARTBEAT_TIMEOUT_LIMIT,
} = require('./constants');
const DEFAULT_OPTIONS = {
  idleTimeout: 30 * 1000,
  finWaitTimeout: 2 * 60 * 1000,
};

class Connection extends Base {
  constructor(options = {}) {
    options.initMethod = '_connect';
    super(options);

    options = Object.assign({}, DEFAULT_OPTIONS, options);
    this._options = options;
    this._isServer = false;
    this._state = DISCONNECT;
    this._socket = options.socket;
    this._protocol = options.protocol || new LengthBasedProtocol();
    this._idleTimeout = options.idleTimeout || IDLE_TIMEOUT;
    this._finWaitTimeout = options.finWaitTimeout || FINWAIT_TIMEOUT;
    this._heartbeatTimer = null;
    this._heartbeatInterval = options.heartbeatInterval || HEARTBEAT_INTERVAL;
    this._heartbeatTimeout = options.heartbeatTimeout || HEARTBEAT_TIMEOUT;
    this._heartbeatTimeoutLimit = options.heartbeatTimeoutLimit || HEARTBEAT_TIMEOUT_LIMIT;
    this._heartbeatTimeoutCount = 0;
    this._pendingTimers = [];
    this.await = awaitEvent;

    this.ready(() => {
      // 服务端启动心跳检测
      if (this._isServer) {
        this._setupHeartbeatTimer();
      }
    });
  }

  async _connect() {
    if (this._socket) {
      // server
      this._isServer = true;
      process.nextTick(() => this._socket.emit('connect'));
    } else {
      // client
      assert(this._options.host, '[Connection]: options.host required!');
      assert(this._options.port, '[Connection]: options.port required!');
    }

    const { host, port } = this._options;
    this._state = CONNECTING;
    this._socket = this._socket || net.createConnection({ host, port });
    this._socket.on('connect', this._onConnect.bind(this));
    this._socket.on('data', data => this.read(data));
    this._protocol.on('data', data => this._socket.writable && this._socket.write(data));
    this._protocol.on('packet', this._onPacket.bind(this));
    this._protocol.on('error', this._onError.bind(this));
    this._socket.on('error', this._onError.bind(this));
    this._socket.on('close', this._onClose.bind(this));
    this._socket.on('timeout', this._onTimeout.bind(this));

    // 如果有传入连接超时，则先把timeout置为connectTimeout
    if (this._options.connectTimeout) {
      this._socket.setTimeout(this._options.connectTimeout);
    } else {
      this._socket.setTimeout(this._idleTimeout);
    }

    return this.await('connect');
  }

  _setupHeartbeatTimer() {
    const interval = this._heartbeatInterval;
    const timeout = this._heartbeatTimeout;
    const limit = this._heartbeatTimeoutLimit;

    // 心跳超时，关闭连接
    this.on('heartbeatTimeout', () => this.end());

    // 启动心跳定时器
    this._heartbeatTimer = setInterval(() => {
      let ack = false;

      // 发送心跳请求
      const packetId = this.write(null, { reqType: 0, packetType: 1 });
      const onAck = createOnAck(this, packetId);
      this.on('heartbeatPacket', onAck);
      const timer = setTimeout(() => {
        this.removeListener('heartbeatPacket', onAck);
        clearTimeout(timer);

        if (!ack) {
          // 心跳超时次数超过上限，触发heartbeatTimeout事件
          if (++this._heartbeatTimeoutCount >= limit) {
            this.emit('heartbeatTimeout');
          }
        }
      }, timeout);

      function createOnAck(conn, id) {
        return function onAck({ reqType, packetId, packetType }) {
          if (reqType === 1 && packetType === 1 && packetId === id) {
            ack = true;
            conn.removeListener('heartbeatPacket', onAck);
          }
        };
      }
    }, interval);
  }

  get connected() {
    return this._state === CONNECT;
  }

  get localAddress() {
    return this._socket && this._socket.localAddress;
  }

  get localPort() {
    return this._socket && this._socket.localPort;
  }

  get remoteAddress() {
    if (this._socket) {
      const remoteAddress = this._socket.remoteAddress;
      if (remoteAddress) {
        return remoteAddress;
      }
    }
    return this._options.host;
  }

  get remotePort() {
    if (this._socket) {
      const remotePort = this._socket.remotePort;
      if (remotePort) {
        return remotePort;
      }
    }
    return this._options.port;
  }

  read(data) {
    try {
      this._protocol.read(data);
    } catch (e) {
      e.name = 'ConnectionReadError';
      this.emit('error', e);
    }
  }

  write(data, info) {
    try {
      return this._protocol.write(data, info);
    } catch (e) {
      e.name = 'ConnectionWriteError';
      this.emit('error', e);
    }
  }

  end() {
    if (this._socket && this._socket.writable) {
      this._state = DISCONNECTING;
      this._socket.end();

      // ensure socket close after shutdown
      // https://github.com/nodejs/node/issues/11572
      const socket = this._socket;
      const timer = setTimeout(() => {
        if (socket && !socket.destroyed) {
          this.emit('finWaitTimeout');
          socket.destroy();
          this._onClose();
        }
      }, this._finWaitTimeout);
      this._pendingTimers.push(timer);
    }
    return this;
  }

  async _onConnect() {
    debug('connected: %j', this._options);

    // for test：为了模拟connect timeout超时的情况
    if (this._options.connectCallback) {
      await this._options.connectCallback();
    }

    // 重置一下，如果之前传入connectTimeout，则重置掉。
    // 重复调用socket.setTimeout没有问题，node内部会移除先前的listener: https://github.com/nodejs/node/blob/master/lib/net.js#L411-L413
    this._socket.setTimeout(this._idleTimeout);
    this._state = CONNECT;
    this.emit('connect');
  }

  _onPacket(packet) {
    debug('receive packet: %j', packet);

    const { reqType, packetId, packetType } = packet;
    if (packetType === 1) {
      if (reqType === 0) {
        // 心跳请求，一般是服务端发起
        this.write(null, { reqType: 1, packetId, packetType });
      } else if (reqType === 1) {
        // 心跳响应，把timeout次数减1，一般是客户端发起
        if (this._heartbeatTimeoutCount > 0) {
          --this._heartbeatTimeoutCount;
        }
      }
      this.emit('heartbeatPacket', packet);
      return;
    }

    this.emit('packet', packet);
  }

  _onTimeout() {
    debug('connection timeout!');

    const err = new Error(`timeout when connecting ${this.remoteAddress}`);
    err.name = 'ConnectionTimeOut';

    // 如果超时了，关闭连接
    this._onError(err);
  }

  _onError(e) {
    this.emit('error', e);
    this.end();
  }

  _onClose() {
    debug('closed: %j', this._options);

    // 连接已经关闭
    this._state = DISCONNECT;
    this.emit('close');
    this.removeAllListeners();

    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
    }

    // remove pending timers
    for (const timer of this._pendingTimers) {
      clearTimeout(timer);
    }
  }
}

module.exports = Connection;
