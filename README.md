# tcp-net

编写稳定可靠的TCP长连接应用。

封装TCP连接的拆解包逻辑，支持`Length-Based`和`Line-Based`两种协议格式。

**注意，本模块只支持node 8.x以上。**

[![NPM version][npm-image]][npm-url]
[![NPM quality][quality-image]][quality-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![NPM download][download-image]][download-url]
[![Gitter][gitter-image]][gitter-url]

[npm-image]: https://img.shields.io/npm/v/tcp-net.svg?style=flat-square
[npm-url]: https://npmjs.org/package/tcp-net
[quality-image]: http://npm.packagequality.com/shield/tcp-net.svg?style=flat-square
[quality-url]: http://packagequality.com/#?package=tcp-net
[travis-image]: https://img.shields.io/travis/luckydrq/tcp-net.svg?style=flat-square
[travis-url]: https://travis-ci.org/luckydrq/tcp-net
[codecov-image]: https://img.shields.io/codecov/c/github/luckydrq/tcp-net.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/luckydrq/tcp-net
[david-image]: https://img.shields.io/david/luckydrq/tcp-net.svg?style=flat-square
[david-url]: https://david-dm.org/luckydrq/tcp-net
[snyk-image]: https://snyk.io/test/npm/tcp-net/badge.svg?style=flat-square
[snyk-url]: https://snyk.io/test/npm/tcp-net
[download-image]: https://img.shields.io/npm/dm/tcp-net.svg?style=flat-square
[download-url]: https://npmjs.org/package/tcp-net
[gitter-image]: https://img.shields.io/gitter/room/luckydrq/tcp-net.svg?style=flat-square
[gitter-url]: https://gitter.im/luckydrq/tcp-net

## Feature

- [x] 长连接
- [x] 连接保持（心跳检测）
- [x] 支持多请求多响应
- [x] 可扩展协议
- [x] 可扩展编解码器

## Protocol

我们对一个tcp包协议格式进行了如下约定：

```
|-----------------------------------------------|
| 1 byte  | 4 bytes  | 1 byte     | N bytes     |
|-----------------------------------------------|
| reqType | packetId | packetType | custom body |
|-----------------------------------------------|
```

- reqType: Number, 请求类型。0 - 请求 1 - 响应
- packetId: Number, 包id。
- packetType: Number, 包类型。0 - 普通包 1 - 心跳包
- custom body: 自定义包体。

其中，自定义包体就是用户发送的数据，它可以支持`Length-Based`和`Line-Based`两种子协议。

### Length-Based Protocol

默认内置。适用于用户定义的包长度是确定的场景。原理很简单，先用一个field标识包体的长度，紧接着就是相应长度的包体。field本身长度支持自定义设置，默认是4字节。

```
|------------------|---------------|
|      4 bytes     |    N bytes    |
|------------------|---------------|
| PACKET LENGTH(N) | HEADER | BODY |
|------------------|---------------|
```

### Line-Based Protocol

适用于用户定义的包长度不确定的场景。它用一种边界符来表示包的结束。最典型的例子，`http`协议格式就是`Line-Based`的协议，它的边界符（或者说分隔符）是`CRLF(\r\n)`。边界符支持自定义设置，默认是`CRLF`。

```
|------------------|-----------|
|      N bytes     | delimiter |
|------------------|-----------|
|    PACKET BODY   |    \r\n   |
|------------------|-----------|
```

## Install
```
$ npm i tcp-net -S
```

## Examples

### Basic

client和server应该使用相同的协议，保持拆解包逻辑一致。

#### server
```js
const net = require('net');
const { Connection } = require('tcp-net');

net.createServer(socket => {
  const conn = new Connection({
    socket,
    // protocol: new LengthBasedProtocol(),  default
  });

  // 发送一个packet
  conn.write('hello world');

  // 收到packet
  conn.on('packet', ({ packetId, body }) => {
    console.log(packetId); // 1
    console.log(JSON.parse(body)); // { name: 'xuezu' }
  });
}).listen();

```

#### client

```js
const { Connection } = require('tcp-net');
const conn = new Connection({ host, port });

// 发送一个packet
conn.write({ name: 'xuezu' });

// 收到一个packet
conn.on('packet', ({ packetId, body }) => {
  console.log(packetId); // 1
  console.log(body); // hello world
});
```

### Heartbeat

内置了心跳检测，默认每隔5秒发起一次心跳检测，响应超时时间为3秒，超时3次则关闭连接。支持配置，在构造函数中传入：

```js
const conn = new Connection({
  heartbeatInterval: 5 * 1000, // 心跳间隔
  heartbeatTimeout: 3 * 1000, // 超时时间
  heartbeatLimit: 3, // 允许超时次数
});

conn.on('heartbeatTimeout', () => {
  console.log('连接已经关闭');
});
```

### Transcoder

通常需要对数据做编解码，本例子展示如何接入一个自定义编解码器。如果不提供，默认[只做基本的序列化](https://github.com/luckydrq/tcp-net/blob/master/lib/protocol.js)。

自定义实现一个transCoder，只需要实现`.encode`和`.decode`方法即可，也可以只实现其中之一，不过通常编解码逻辑都是对应的。

#### server

```js
const transCoder = {
  encode(buf) {
    // 调用hessian编码
    // 注意，需要返回Buffer对象
    return hessian.encode(buf);
  },

  decode(data) {
    // 可以返回任意类型的数据
    return hessian.decode(buf);
  },
};

net.createServer(socket => {
  const conn = new Connection({
    socket,
    protocol: new LengthBasedProtocol({ transCoder }), // 在协议中传入transCoder
  });

  // 收到packet
  conn.on('packet', ({ body }) => console.log(body));
}).listen();
```

#### client

```js
const conn = new Connection({
  host,
  port,
  protocol: new LengthBasedProtocol({ transCoder }),
});
// 发一个packet
conn.write({ name: 'xuezu' });
```

### [更多例子](https://github.com/luckydrq/tcp-net/blob/master/test/index.test.js)

