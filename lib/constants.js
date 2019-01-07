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

exports.FIELDS = [
  {
    name: 'reqType',
    type: 'UInt8',
    size: 1,
    desc: '请求类型：0 - 请求，1 - 响应',
  },

  {
    name: 'packetId',
    type: 'UInt32',
    size: 4,
    desc: '包id',
  },

  {
    name: 'packetType',
    type: 'UInt8',
    size: 1,
    desc: '包类型：0 - 普通请求 1 - 心跳请求',
  },
];

exports.DISCONNECT = 'disconnect';
exports.DISCONNECTING = 'disconnecting';
exports.CONNECT = 'connect';
exports.CONNECTING = 'connecting';

exports.PACKET_ID_LENGTH = 4;

exports.MAX_PACKET_ID = Math.pow(2, 32) - 1;

exports.IDLE_TIMEOUT = 30 * 1000;

exports.FINWAIT_TIMEOUT = 2 * 60 * 1000;

exports.HEARTBEAT_INTERVAL = 5 * 1000;

exports.HEARTBEAT_TIMEOUT = 3 * 1000;

exports.HEARTBEAT_TIMEOUT_LIMIT = 3;

exports.LENGTH_BASED_PACKET_LENGTH = 4;

exports.LINE_BASED_PACKET_DELIMITER = '\r\n';
