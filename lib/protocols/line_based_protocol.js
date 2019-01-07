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
const debug = require('debug')('net:line_based');
const Protocol = require('../protocol');
const { LINE_BASED_PACKET_DELIMITER } = require('../constants');

/**
 * line-based protocol
 *
 * |------------------|-----------|
 * |      N bytes     | delimiter |
 * |------------------|-----------|
 * |       body       |    \r\n   |
 * |------------------|-----------|
 *
 */

class LineBasedProtocol extends Protocol {
  constructor(options = {}) {
    super(options);

    if (options.packetDelimiter) {
      assert(is.string(options.packetDelimiter, 'options.packetDelimiter should be string!'));
    }

    this._packetDelimiter = Buffer.from(options.packetDelimiter || LINE_BASED_PACKET_DELIMITER);
    this._buf = new ByteBuffer(0);
    this._writeBuf = new ByteBuffer(0);
  }

  _parsePacketBody(index) {
    const buf = this._buf.copy(0, index);
    return this.decode(buf);
  }

  _reset(index) {
    this.parsed = false;

    const start = index + this._packetDelimiter.length;
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
    debug('receive chunk: %j', chunk);

    chunk = this.parse(chunk);
    if (!chunk) {
      return;
    }

    this._buf.put(chunk);

    const delimiter = this._packetDelimiter;
    // 转成Buffer
    const buf = this._buf.copy();
    const index = buf.indexOf(delimiter);

    if (index > -1) {
      // 已得到完整的包
      const body = this._parsePacketBody(index);
      this.packet.body = body;
      this.emit('packet', this.packet);

      // 丢弃已经parse过的部分
      this._reset(index);
    }
  }

  write(data, info = {}, encoded = false) {
    debug('write packet: %j, %j', data, info);

    const delimiter = this._packetDelimiter;
    const { packetType } = info;
    if (packetType === 1) {
      // 心跳包直接封包
      const { id, packet } = this.pack(Buffer.concat([ delimiter ]), info);
      this.emit('data', packet);
      return id;
    }

    const buf = this._writeBuf;
    let chunk;
    if (data != null) {
      if (!encoded) {
        chunk = this.encode(data);
      } else {
        chunk = data;
      }
    } else {
      chunk = Buffer.alloc(0);
    }

    // 判断用户输入是否带有delimiter
    const index = chunk.indexOf(delimiter);
    if (index > -1) {
      // 含有分隔符，则对当前数据块进行切割
      const start = 0;
      const end = index + delimiter.length;
      buf.put(chunk.slice(start, end));

      // 已经有完整的包，进行封包
      const { packet } = this.pack(buf.copy(), info);
      this.emit('data', packet);

      // 清理内部缓冲区，把多余的chunk存入
      buf.clear();

      // chunk已经encode过了，不需要再encode
      return this.write(chunk.slice(end), info, true);
    }
    buf.put(chunk);


    return null;
  }
}

module.exports = LineBasedProtocol;
