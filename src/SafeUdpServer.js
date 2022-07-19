import dgram from "node:dgram";
import { Buffer } from "node:buffer";
import logger from "./utils/logger.js";

export class SafeUdpServer {
  constructor({ bufferSize, port }) {
    this.buffer = Buffer.alloc(parseInt(bufferSize));
    this.port = port;

    this.initServer();
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(process.env.port);

    this.server.on("error", (err) => {});

    this.server.on("message", (msg, rinfo) => {
      console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
    });

    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  sendFile(file, clientUrl) {}

  sendPackage() {}
}
