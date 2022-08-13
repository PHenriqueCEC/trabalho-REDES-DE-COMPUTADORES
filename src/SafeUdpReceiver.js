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
    return true;
    return parseInt(Math.random() * 10) > 2;
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(this.port);

    this.server.on("error", (err) => {
      console.log(err);
    });

    this.server.on("message", (msg, rinfo) => {
      this.receivedSeqNum = msg.readUInt32BE(0);
      const isLastPackage = msg[8];

      const data = msg.subarray(100);

      //Usa uma função randomica para simular perda de pacotes
      if (this.acceptPackage()) {
        const packageToSend = Buffer.alloc(1024);

        packageToSend.fill(String(this.receivedSeqNum));

        this.send({
          data: packageToSend,
          serverPort: this.serverPort,
        });
      }

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
