import dgram from "node:dgram";
import { Buffer } from "node:buffer";
import logger from "./utils/logger.js";
import { breakFileIntoChunks } from "./utils/files.js";

export class SafeUdpServer {
  constructor({ bufferSize, port }) {
    this.buffer = Buffer.alloc(parseInt(bufferSize));
    this.port = port;
    this.numberOfSequence = 0;
    this.fileChunks = [];
    this.bufferSize = bufferSize;

    this.initServer();
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(process.env.port);

    this.server.on("error", (err) => {});

    this.server.on("message", (msg, rinfo) => {
      console.log(
        `server got: ${msg.toString()} from ${rinfo.address}:${rinfo.port}`
      );

      const numberOfSequence = parseInt(msg);

      if (numberOfSequence < this.fileChunks.length)
        this.sendPackage(this.fileChunks[numberOfSequence], this.clientUrl);
    });

    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  sendFile(file, clientUrl) {
    this.clientUrl = clientUrl;
    this.fileChunks = breakFileIntoChunks(file, this.bufferSize);

    this.server.send(this.fileChunks[0], clientUrl);
  }

  sendPackage(packageData, clientUrl) {
    this.server.send(Buffer(packageData), clientUrl);
  }
}
