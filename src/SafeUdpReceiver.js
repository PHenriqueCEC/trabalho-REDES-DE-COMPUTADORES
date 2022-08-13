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
    return parseInt(Math.random() * 10) > 2;
  }

  /*@todo: remontar o arquivo */
  /*@todo: controle de fluxo*/

  getPackageType(data = new Buffer()) {
    const packageType = data.readInt8();

    return packageType === 1 ? "connection" : "data";
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(this.port);

    this.initOnListening();
    this.initOnMessage();

    this.server.on("error", (err) => {});
  }

  initOnMessage() {
    this.server.on("message", (msg) => {
      const packageType = this.getPackageType(msg);

      if (packageType === "connection") this.handleConnectionPackage(msg);
      else {
        this.handleDataPackage(msg);
      }

      console.log(`Server got a message with legnth of: ${msg.length}`);
    });
  }

  initOnListening() {
    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  handleConnectionPackage(msg = new Buffer()) {
    this.numberOfPackages = msg.readUInt32BE(1);
    const initialPackageSeqNum = msg.readInt32BE(5);

    const initialWindowSize = 10;

    const data = Buffer.alloc(9);

    //Escreve tipo de pacote
    data.writeInt8(1);
    data.writeInt32BE(initialPackageSeqNum, 1);
    data.writeUInt32BE(initialWindowSize, 5);

    this.server.send(data, this.serverPort);
  }

  handleDataPackage(msg) {
    this.receivedSeqNum = msg.readUInt32BE(1);

    const data = msg.subarray(100);

    const packageToSend = Buffer.alloc(5);

    packageToSend.writeUInt8(2);
    packageToSend.writeUint32BE(this.receivedSeqNum, 1);

    //Usa uma função randomica para simular perda de pacotes
    if (this.acceptPackage()) this.server.send(packageToSend, this.serverPort);
  }

  makeHeader() {}
}
