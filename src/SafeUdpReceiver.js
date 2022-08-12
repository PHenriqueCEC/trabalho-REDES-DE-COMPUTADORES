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

  acceptPackage() {
    const generateNumber = parseInt(Math.random() * 1000);

    return generateNumber % 2 === 0;
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(this.port);

    this.server.on("error", (err) => {});

    this.server.on("message", (msg, rinfo) => {
      this.receivedSeqNum = msg.readUInt32BE(0);
      const isLastPackage = msg[8];

      //Usa uma função randomica para simular perda de pacotes
      if (this.acceptPackage())
        this.send({
          data: Buffer(String(this.receivedSeqNum)),
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
