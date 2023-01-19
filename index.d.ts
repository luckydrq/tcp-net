/// <reference types="node" />

declare module '@luckydrq/tcp-net' {
  import { Socket } from 'net';
  import SdkBase from 'sdk-base';

  interface ITransCoder {
    encode: (data: Buffer | Record<string, any> | string | number | boolean | null) => Buffer;
    decode: (data: Buffer) => string;
  }

  interface IProtocolOptions {
    encoding?: string;
    transCoder?: ITransCoder;
  }

  interface ILengthBasedProtocolOptions extends IProtocolOptions {
    packetSize?: number;
  }

  interface ILineBasedProtocolOptions extends IProtocolOptions {
    packetDelimiter: string;
  }

  interface IPacket {
    reqType: number;
    packetId?: number;
    packetType: number;
    body?: string;
  }

  abstract class Protocol extends SdkBase {
    constructor(options: IProtocolOptions);
    pack: (data: Buffer, pkt: IPacket) => { id: number; packet: Buffer };
    parse: (data: Buffer) => Buffer | null;
    encode: (data: Buffer | Record<string, any> | string | number | boolean | null) => Buffer;
    decode: (data: Buffer) => string;
  }

  class LengthBasedProtocol extends Protocol {
    constructor(options?: ILengthBasedProtocolOptions);
    read: (data: Buffer) => void;
    write: (data: Buffer, pkt?: IPacket) => void;
  }

  class LineBasedProtocol extends Protocol {
    constructor(options: ILineBasedProtocolOptions);
    read: (data: Buffer) => void;
    write: (data: Buffer, pkt?: IPacket, encoded?: boolean) => void;
  }

  interface IConnectionOptions {
    socket: Socket;
    protocol?: Protocol;
    idleTimeout?: number;
    finWaitTimeout?: number;
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    heartbeatTimeoutLimit?: number;
  }

  class Connection extends SdkBase {
    constructor(options: IConnectionOptions);
    get connected(): boolean;
    get localAddress(): string | undefined;
    get remoteAddress(): string | undefined;
    get remotePort(): number | undefined;
    read: (data: Buffer) => void;
    write: (
      data: Buffer | Record<string, any> | string | number | boolean | null,
      pkt?: IPacket
    ) => void;
    end: () => void;
  }

  export { Connection, LengthBasedProtocol, LineBasedProtocol, IPacket };
}
