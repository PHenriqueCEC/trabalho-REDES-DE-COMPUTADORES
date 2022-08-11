import { Console } from "console";
import dgram from "dgram";
import logger from "./utils/logger.js";

const serverUrl = "127.0.0.1";

export class SafeUdpReceiver {
  constructor({ serverUrl, port, serverPort }) {
    this.server = dgram.createSocket("udp4");
    this.serverUrl = serverUrl;
    this.lastNumberOfSequence = 0;
    this.port = port;
    this.serverPort = serverPort;
    this.file = null;

    this.initServer();
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(this.port);

    this.server.on("error", (err) => {});

    this.server.on("message", (msg, rinfo) => {
      this.lastNumberOfSequence++;

      this.send({
        data: Buffer(String(this.lastNumberOfSequence)),
        serverPort: this.serverPort,
      });

      console.log(`Server got a message with legnth of: ${msg.length}`);
    });

    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  makeHeader() {}

  send({ data, serverPort }) {
    this.server.send(data, serverPort);
  }
}
