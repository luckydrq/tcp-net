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
const is = require('is-type-of');
const ByteBuffer = require('byte');
const debug = require('debug')('net:length_based');
const Protocol = require('../protocol');
const { LENGTH_BASED_PACKET_LENGTH } = require('../constants');

/**
 * length-based protocol
 *
 * |------------------|---------------|
 * |      4 bytes     |    N bytes    |
 * |------------------|---------------|
 * | packet length(N) |      body     |
 * |------------------|---------------|
 *
 */

class LengthBasedProtocol extends Protocol {
  constructor(options = {}) {
    super(options);

    if (options.packetLength) {
      assert(is.number(options.packetLength), 'options.packetLength should be number!');
      assert(options.packetLength >= 4, 'options.packetLength should be larger than 4');
    }

    this._packetLength = options.packetSize || LENGTH_BASED_PACKET_LENGTH;
    this._buf = new ByteBuffer();
  }

  _parsePacketBodyLength() {
    return this._buf.getUInt32(0);
  }

  _parsePacketBody(start, end) {
    const buf = this._buf.copy(start, end);
    return this.decode(buf);
  }

  _reset(length) {
    this.parsed = false;

    const start = length;
    const end = this._buf.position();
    const buf = this._buf.copy(start, end);

    // 清空内部buffer
    this._buf.clear();

    // 如果有剩余，继续解析
    if (buf.length > 0) {
      this.read(buf);
    }
  }

  read(chunk) {
    chunk = this.parse(chunk);
    if (!chunk) {
      return;
    }

    this._buf.put(chunk);

    const packetLength = this._packetLength;
    const offset = this._buf.position();
    if (offset < packetLength) {
      return;
    }

    const packetBodyLength = this._parsePacketBodyLength();
    if (offset - packetLength >= packetBodyLength) {
      // 已经收到完整的packet
      const body = this._parsePacketBody(packetLength, packetLength + packetBodyLength);
      this.packet.body = body;
      this.emit('packet', this.packet);

      // 丢弃已经parse过的部分
      this._reset(packetLength + packetBodyLength);
    }
  }

  write(data, info = {}) {
    debug('write packet: %j, %j', data, info);

    let bodyBuf = Buffer.alloc(0);
    const headerBuf = Buffer.alloc(this._packetLength);

    bodyBuf = data != null ? this.encode(data) : Buffer.alloc(0);
    headerBuf.writeUInt32BE(bodyBuf.length);
    const totalBuf = Buffer.concat([ headerBuf, bodyBuf ]);
    const { id, packet } = this.pack(totalBuf, info);
    this.emit('data', packet);
    return id;
  }
}

module.exports = LengthBasedProtocol;
