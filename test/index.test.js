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
const { Readable } = require('stream');
const is = require('is-type-of');
const mm = require('mm');
const pedding = require('pedding');
const {
  Connection,
  LengthBasedProtocol,
  LineBasedProtocol,
} = require('..');

describe('test/index.test.js', () => {
  beforeEach(mm.restore);

  it('should close when remote endpoint cannot be acessed', done => {
    const conn = new Connection({ host: '127.0.0.1', port: '19999' })
      .on('error', e => {
        assert(e.stack.indexOf('ECONNREFUSED') > -1);
        assert.equal(conn.remoteAddress, '127.0.0.1');
        assert.equal(conn.remotePort, '19999');
        assert.equal(conn._state, 'connecting');
        assert.equal(conn.connected, false);
        done();
      });
  });

  describe('length-based protocol', () => {
    it('should connect', done => {
      done = pedding(done, 2);

      const server = net.createServer(socket => {
        new Connection({
          socket,
        }).on('connect', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
        }).on('connect', () => {
          assert.equal(client.connected, true);
          assert([ '::1', '127.0.0.1' ].indexOf(client.localAddress) > -1);
          assert([ '::1', '127.0.0.1' ].indexOf(client.remoteAddress) > -1);
          assert(is.number(client.localPort));
          assert(is.number(client.remotePort));
          done();
        });
      });
    });

    it('should send and receive empty packet properly', done => {
      let count = 0;
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          assert.equal(body, '');
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write();
            }
          }, 200);
        });
      });
    });

    it('should send and receive a very long packet properly', done => {
      let count = 0;
      const message = 'abc这是一条非常非常非常非常非常非常非常非常456非常非常非常非常非常非常非常非常长的信息\r\n';
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          assert.equal(body, message);
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write(message);
            }
          }, 200);
        });
      });
    });

    it('should send and receive buffer packet properly', done => {
      let count = 0;
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ packetId, body }) => {
          assert.equal(body, `xuezu-${packetId}`);
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write(Buffer.from(`xuezu-${count}`));
            }
          }, 200);
        });
      });
    });

    it('should send and receive boolean packet properly', done => {
      let count = 0;
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          assert.equal(body, 'true');
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write(true);
            }
          }, 200);
        });
      });
    });

    it('should send and receive object packet properly', done => {
      let count = 0;
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ packetId, body }) => {
          body = JSON.parse(body);
          assert.equal(body.id, packetId);
          assert.equal(body.name, 'xuezu');
          assert.equal(body.alier, true);
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write({ id: count, name: 'xuezu', alier: true });
            }
          }, 200);
        });
      });
    });

    it('should server send to client properly', done => {
      const server = net.createServer(socket => {
        const conn = new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ packetId, body }) => {
          // 只对第2个包进行响应
          if (packetId === 2) {
            body = JSON.parse(body);
            conn.write(body.name);
          }
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol(),
        }).on('packet', ({ body }) => {
          assert.equal(body, 'xuezu2');
          done();
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          client.write({ name: 'xuezu' });
          client.write({ name: 'xuezu2' });
        });
      });
    });

    it('should support custom set packet length', done => {
      let count = 0;
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol({ packetLength: 6 }),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          body = JSON.parse(body);
          assert.equal(body.name, 'xuezu');
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol({ packetLength: 6 }),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write({ name: 'xuezu' });
            }
          }, 200);
        });
      });
    });

    it('should support custom transCoder', done => {
      const transCoder = {
        encode() {
          return Buffer.from('xuezu');
        },

        decode(data) {
          return 'hi, ' + data.toString();
        },
      };

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol({ transCoder }),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          assert.equal(body, 'hi, xuezu');
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol({ transCoder }),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          client.write({ name: 'xuezu' });
        });
      });
    });

    it('should end connection properly', done => {
      done = pedding(done, 2);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          body = JSON.parse(body);
          assert.equal(body.name, 'xuezu');
          done();
        })
          .on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          client.write({ name: 'xuezu' });
          client.end();
        });
      });
    });

    it('should close connection properly when timeout', done => {
      done = pedding(done, 3);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        new Connection({
          host,
          port,
          idleTimeout: 1000,
          protocol: new LengthBasedProtocol(),
        }).on('error', e => {
          assert.equal(e.name, 'ConnectionTimeOut');
          done();
        }).on('close', done);
      });
    });

    it('should close connection properly when error', done => {
      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LengthBasedProtocol(),
        }).on('error', e => {
          assert.equal(e.message, 'oops!');
        });
        server.on('server_connect', () => {
          client._onError(new Error('oops!'));
        });
      });
    });

    it('should close after finwait timer', done => {
      done = pedding(done, 2);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LengthBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          finWaitTimeout: 1000,
          protocol: new LengthBasedProtocol(),
        }).on('finWaitTimeout', done);

        server.on('server_connect', () => {
          mm(client._socket, 'end', () => {});
          client.end();
        });
      });
    });

    it('should send and receive heartbeat packet properly', done => {
      done = pedding(done, 2);
      let id;
      const server = net.createServer(socket => {
        new Connection({
          socket,
          heartbeatInterval: 200,
          protocol: new LengthBasedProtocol(),
        }).once('heartbeatPacket', ({ reqType, packetId, packetType }) => {
          assert.equal(reqType, 1);
          assert.equal(packetId, id);
          assert.equal(packetType, 1);
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        new Connection({
          host,
          port,
          finWaitTimeout: 1000,
          protocol: new LengthBasedProtocol(),
        }).once('heartbeatPacket', ({ reqType, packetId, packetType }) => {
          id = packetId;
          assert.equal(reqType, 0);
          assert.equal(packetType, 1);
          done();
        });
      });
    });

    it('should close connection when heartbeat timeout', done => {
      done = pedding(done, 2);
      const server = net.createServer(socket => {
        new Connection({
          socket,
          heartbeatTimeoutLimit: 1,
          heartbeatInterval: 200,
          heartbeatTimeout: 200,
          protocol: new LengthBasedProtocol(),
        })
          .once('heartbeatTimeout', done)
          .on('error', () => {})
          .on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          finWaitTimeout: 1000,
          protocol: new LengthBasedProtocol(),
        });
        mm(client, '_onPacket', () => {});
      });
    });
  });

  describe('line-based protocol', () => {
    it('should connect', done => {
      done = pedding(done, 2);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          assert.equal(client.connected, true);
          assert([ '::1', '127.0.0.1' ].indexOf(client.localAddress) > -1);
          assert([ '::1', '127.0.0.1' ].indexOf(client.remoteAddress) > -1);
          assert(is.number(client.localPort));
          assert(is.number(client.remotePort));
          done();
        });
      });
    });

    it('should send and receive empty packet properly', done => {
      let count = 0;
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          assert.equal(body, '');
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write('\r\n');
            }
          }, 200);
        });
      });
    });

    it('should send and receive a very long packet properly', done => {
      let count = 0;
      const message = 'abc这是一条非常非常非常非常非常非常非常非常456非常非常非常非常非常非常非常非常长的信息';
      done = pedding(done, 5);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          assert.equal(body, message);
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write(`${message}\r\n`);
            }
          }, 200);
        });
      });
    });

    it('should send and receive packet properly', done => {
      let count = 0;
      done = pedding(done, 5);

      const transCoder = {
        encode(data) {
          const s = JSON.stringify(data);
          return Buffer.from(`${s}\r\n`, 'utf8');
        },
      };

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ packetId, body }) => {
          body = JSON.parse(body);
          assert.equal(body.name, `xuezu-${packetId}`);
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol({ transCoder }),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write({ name: `xuezu-${count}` });
            }
          }, 200);
        });
      });
    });

    it('should recognize delimiter properly', done => {
      done = pedding(done, 3);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ packetId, body }) => {
          if (packetId === 1) {
            assert.equal(body, '雪卒');
            done();
          }
          if (packetId === 2) {
            assert.equal(body, 'xuezu');
            done();
          }
          if (packetId === 3) {
            assert.equal(body, '12345');
            done();
          }
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          client.write('雪卒\r\nxuezu\r\n123');
          client.write('45\r\n6');
        });
      });
    });

    it('should support readable stream', done => {
      done = pedding(done, 2);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          heartbeatInterval: 200,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ packetId, body }) => {
          if (packetId === 1) {
            assert.equal(body, '雪卒');
            done();
          }
          if (packetId === 2) {
            assert.equal(body, 'xuezu雪卒');
            done();
          }
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol(),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          const rs = new Readable();
          rs._read = () => {};
          rs.on('data', chunk => client.write(chunk));

          let count = 0;
          const timer = setInterval(() => {
            if (++count === 3) {
              rs.push(null);
              clearInterval(timer);
            } else {
              rs.push('雪卒\r\nxuezu');
            }
          }, 200);
        });
      });
    });

    it('should support custom set packet delimiter', done => {
      let count = 0;
      done = pedding(done, 5);

      const packetDelimiter = '$$$$';
      const transCoder = {
        encode(data) {
          return Buffer.from(`${JSON.stringify(data)}${packetDelimiter}`, 'utf8');
        },
      };

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol({ packetDelimiter }),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          body = JSON.parse(body);
          assert.equal(body.name, 'xuezu');
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol({
            packetDelimiter,
            transCoder,
          }),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          setInterval(() => {
            if (++count <= 5) {
              client.write({ name: 'xuezu' });
            }
          }, 200);
        });
      });
    });

    it('should support custom transCoder', done => {
      const transCoder = {
        encode() {
          return Buffer.from('xuezu\r\n');
        },

        decode(data) {
          return 'hi, ' + data.toString();
        },
      };

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol({ transCoder }),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          assert.equal(body, 'hi, xuezu');
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol({ transCoder }),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          client.write({ name: 'xuezu' });
        });
      });
    });

    it('should end connection properly', done => {
      done = pedding(done, 2);

      const transCoder = {
        encode(data) {
          const s = JSON.stringify(data);
          return Buffer.from(`${s}\r\n`, 'utf8');
        },
      };

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('packet', ({ body }) => {
          body = JSON.parse(body);
          assert.equal(body.name, 'xuezu');
          done();
        })
          .on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol({ transCoder }),
        });

        // 连接建立后发送数据包
        server.on('server_connect', () => {
          client.write({ name: 'xuezu' });
          client.end();
        });
      });
    });

    it('should close connection properly when timeout', done => {
      done = pedding(done, 3);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        new Connection({
          host,
          port,
          idleTimeout: 1000,
          protocol: new LineBasedProtocol(),
        }).on('error', e => {
          assert.equal(e.name, 'ConnectionTimeOut');
          done();
        }).on('close', done);
      });
    });

    it('should close connection properly when error', done => {
      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          protocol: new LineBasedProtocol(),
        }).on('error', e => {
          assert.equal(e.message, 'oops!');
        });
        server.on('server_connect', () => {
          client._onError(new Error('oops!'));
        });
      });
    });

    it('should close after finwait timer', done => {
      done = pedding(done, 2);

      const server = net.createServer(socket => {
        new Connection({
          socket,
          protocol: new LineBasedProtocol(),
        }).on('connect', () => {
          server.emit('server_connect');
        }).on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          finWaitTimeout: 1000,
          protocol: new LineBasedProtocol(),
        }).on('finWaitTimeout', done);

        server.on('server_connect', () => {
          mm(client._socket, 'end', () => {});
          client.end();
        });
      });
    });

    it('should send and receive heartbeat packet properly', done => {
      done = pedding(done, 2);
      let id;
      const server = net.createServer(socket => {
        new Connection({
          socket,
          heartbeatInterval: 200,
          protocol: new LineBasedProtocol(),
        }).once('heartbeatPacket', ({ reqType, packetId, packetType }) => {
          assert.equal(reqType, 1);
          assert.equal(packetId, id);
          assert.equal(packetType, 1);
          done();
        });
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        new Connection({
          host,
          port,
          finWaitTimeout: 1000,
          protocol: new LineBasedProtocol(),
        }).once('heartbeatPacket', ({ reqType, packetId, packetType }) => {
          id = packetId;
          assert.equal(reqType, 0);
          assert.equal(packetType, 1);
          done();
        });
      });
    });

    it('should close connection when heartbeat timeout', done => {
      done = pedding(done, 2);
      const server = net.createServer(socket => {
        new Connection({
          socket,
          heartbeatTimeoutLimit: 1,
          heartbeatInterval: 200,
          heartbeatTimeout: 200,
          protocol: new LineBasedProtocol(),
        })
          .once('heartbeatTimeout', done)
          .on('error', () => {})
          .on('close', done);
      }).listen(0, '127.0.0.1', () => {
        const host = server.address().address;
        const port = server.address().port;
        const client = new Connection({
          host,
          port,
          finWaitTimeout: 1000,
          protocol: new LineBasedProtocol(),
        });
        mm(client, '_onPacket', () => {});
      });
    });
  });
});
