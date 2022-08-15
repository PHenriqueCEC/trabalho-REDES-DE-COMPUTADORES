import dgram from "dgram";
import fs from "fs";
import logger from "./utils/logger.js";
import { PACKAGE_TYPE, PACKAGE_TYPE_DICTIONARY } from "./constants/index.js";

export class SafeUdpReceiver {
  constructor({ serverUrl, port, serverPort }) {
    this.server = null;

    this.serverUrl = serverUrl;
    this.lastNumberOfSequence = 0;
    this.port = port;
    this.serverPort = serverPort;
    this.file = null;
    this.receivedPackages = [];

    this.initServer();
  }

  acceptPackage() {
    return parseInt(Math.random() * 10) > 2;
  }

  /*@todo: controle de fluxo*/

  getPackageType(data) {
    const packageType = data.readInt8();

    return PACKAGE_TYPE_DICTIONARY[packageType];
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(this.port);

    this.initOnListening();
    this.initOnMessage();

    this.server.on("error", (err) => {
      logger.error(`Error in receiver ${err}`);
    });
  }

  initOnMessage() {
    this.server.on("message", (msg) => {
      logger.info(`Server got a message with legnth of: ${msg.length}`);

      const packageType = this.getPackageType(msg);

      console.log("Package type", packageType);

      if (packageType === "connection") this.handleConnectionPackage(msg);
      else if (packageType === "data") this.handleDataPackage(msg);
      else if (packageType === "disconnection")
        this.handleDisconectionPackage();
    });
  }

  initOnListening() {
    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  handleConnectionPackage(msg) {
    this.numberOfPackages = msg.readUInt32BE(1);
    this.receivedPackages = new Array(this.numberOfPackages);

    const initialPackageSeqNum = msg.readInt32BE(5);

    const initialWindowSize = 10;

    const data = Buffer.alloc(9);
    //Escreve tipo de pacote
    data.writeInt8(PACKAGE_TYPE.connection);
    data.writeInt32BE(initialPackageSeqNum, 1);
    data.writeUInt32BE(initialWindowSize, 5);

    this.server.send(data, this.serverPort);
  }

  handleDisconectionPackage() {
    this.remountFile();
  }

  handleDataPackage(msg) {
    const receivedSeqNum = msg.readUInt32BE(1);

    const data = msg.subarray(100);
    this.receivedPackages[receivedSeqNum] = data;

    const packageToSend = this.makePackage(receivedSeqNum);

    if (this.acceptPackage()) this.server.send(packageToSend, this.serverPort);
  }

  makePackage(receivedSeqNum) {
    const packageToSend = Buffer.alloc(5);

    packageToSend.writeUInt8(2);
    packageToSend.writeUint32BE(receivedSeqNum, 1);

    return packageToSend;
  }

  remountFile() {
    const file = Buffer.concat(this.receivedPackages);

    fs.writeFileSync("generated.png", file);
  }
}
