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
const mm = require('mm');
const {
  Connection,
  LengthBasedProtocol,
} = require('..');
const Protocol = require('../lib/protocol');

describe('test/protocol.test.js', () => {
  beforeEach(mm.restore);

  it('should implement #write method', done => {
    const server = net.createServer().listen(0, '127.0.0.1', () => {
      const host = server.address().address;
      const port = server.address().port;
      const client = new Connection({
        host,
        port,
        protocol: new Protocol(),
      }).on('connect', () => {
        client.on('error', e => {
          assert.equal(e.message, 'should be implemented!');
          done();
        });
        client.write('data');
      });
    });
  });

  it('should implement #read method', done => {
    const protocol = new Protocol();
    const server = net.createServer(socket => {
      new Connection({
        socket,
        protocol,
      }).on('error', e => {
        assert.equal(e.name, 'ConnectionReadError');
        assert.equal(e.message, 'should be implemented!');
        done();
      });
    }).listen(0, '127.0.0.1', () => {
      const host = server.address().address;
      const port = server.address().port;
      const client = new Connection({
        host,
        port,
        protocol: new LengthBasedProtocol(),
      }).on('connect', () => {
        client.write('data');
      });
    });
  });
});
