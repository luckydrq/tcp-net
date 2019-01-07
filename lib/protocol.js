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
const Base = require('sdk-base');
const is = require('is-type-of');
const ByteBuffer = require('byte');
const debug = require('debug')('net:protocol');
const Parser = require('./parser');

const {
  FIELDS,
  MAX_PACKET_ID,
} = require('./constants');

/**
 * base protocol
 *
 * |-----------------------------------------------|
 * | 1 byte  | 4 bytes  | 1 byte     | N bytes     |
 * |-----------------------------------------------|
 * | reqType | packetId | packetType | custom body |
 * |-----------------------------------------------|
 *
 */

class Protocol extends Base {
  constructor(options = {}) {
    super(options);

    this._opaque = 0;
    this._size = 0;
    this._packet = null;
    this._parsed = false;
    this._fields = FIELDS;
    this._encoding = options.encoding || 'utf8';
    this._transCoder = options.transCoder;
    this._parser = new Parser({ fields: this._fields });
    this._parser.on('packet', packet => {
      this.parsed = true;
      this.packet = packet;
    });
  }

  get size() {
    if (!this._size) {
      for (const field of this._fields) {
        this._size += field.size;
      }
    }
    return this._size;
  }

  get parsed() {
    return this._parsed;
  }

  set parsed(val) {
    this._parsed = val;
  }

  get packet() {
    return this._packet;
  }

  set packet(packet) {
    this._packet = packet;
  }

  _generatePacketId() {
    if (this._opaque === MAX_PACKET_ID) {
      this._opaque = 1;
    } else {
      ++this._opaque;
    }
    return this._opaque;
  }

  pack(buf, info = {}) {
    const { reqType = 0, packetType = 0 } = info;
    let { packetId } = info;

    if (reqType === 0) {
      // 如果是普通请求，则为他生成packetId
      packetId = this._generatePacketId();
    } else if (reqType === 1) {
      // 如果是响应请求，则packetId不能为空
      assert(is.number(packetId), 'packetId should be number when reqType = 1!');
    } else {
      throw new Error('invalid reqType, should be either 0 or 1!');
    }
    info.packetId = packetId;
    info.packetType = packetType;
    debug('send packet(#%s)', packetId);

    const headerBuf = new ByteBuffer({ size: this.size });
    for (const field of this._fields) {
      headerBuf[`put${field.type}`].apply(headerBuf, [ info[field.name] ]);
    }
    return {
      id: packetId,
      packet: Buffer.concat([ headerBuf.copy(), buf ]),
    };
  }

  parse(chunk) {
    // 已经解析过了
    if (this.parsed) {
      return chunk;
    }

    chunk = this._parser.parse(chunk);
    if (chunk) {
      const { packetId } = this.packet;
      debug('receive packet(#%s)', packetId);
      return chunk;
    }
    return null;
  }

  encode(data) {
    const transCoder = this._transCoder;
    if (transCoder && transCoder.encode) {
      data = transCoder.encode(data);
      assert(is.buffer(data), 'transCoder.encode() should return Buffer!');
      return data;
    }
    return this._encode(data);
  }

  decode(data) {
    const transCoder = this._transCoder;
    if (transCoder && transCoder.decode) {
      return transCoder.decode(data);
    }
    return this._decode(data);
  }

  read() {
    throw new Error('should be implemented!');
  }

  write() {
    throw new Error('should be implemented!');
  }

  _encode(data) {
    if (data == null) {
      return Buffer.alloc(0);
    }

    if (Buffer.isBuffer(data)) {
      return data;
    }

    const encoding = this._encoding;
    if (is.object(data)) {
      data = JSON.stringify(data);
    } else {
      data = String(data);
    }
    return Buffer.from(data, encoding);
  }

  _decode(data) {
    return data.toString(this._encoding);
  }
}

module.exports = Protocol;
