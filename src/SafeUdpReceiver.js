import dgram from "dgram";
import logger from "./utils/logger.js";

const serverUrl = "127.0.0.1";

export class SafeUdpReceiver {
  constructor({ serverUrl, port }) {
    this.server = dgram.createSocket("udp4");
    this.serverUrl = serverUrl;

    this.initServer();
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(process.env.port);

    this.server.on("error", (err) => {});

    this.server.on("message", (msg, rinfo) => {
      this.send({ data: Buffer("ACK") });
    });

    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  makeHeader() {}

  send({ data, serverUrl }) {
    this.server.send(data, serverUrl);
  }
}
