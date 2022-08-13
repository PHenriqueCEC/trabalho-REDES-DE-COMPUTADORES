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

    this.headerSize = 100;
    this.bufferSize = bufferSize;
    this.timeouts = [];
    this.lostPackages = 0;

    //Janela deslizante
    this.confirmedPackages = [];
    this.sentPackages = [];

    this.windowSize = 10;
    this.baseSeqNum = 0;
    this.lastRecevSeqNum = 0;

    this.initServer();
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(this.port);

    this.onError();
    this.onMessage();
  }

  onListening() {
    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  onMessage() {
    this.server.on("message", (msg, rinfo) => {
      const packageType = this.getPackageType(msg);

      if (packageType === "connection") this.handleConnectionPackage(msg);
      else this.handleDataPackage(msg);
    });
  }

  getPackageType(data = new Buffer()) {
    const packageType = data.readInt8();

    return packageType === 1 ? "connection" : "data";
  }

  handleConnectionPackage(msg = new Buffer()) {
    const initialPackageSeqNum = msg.readUInt32BE(1);
    this.windowSize = msg.readUint32BE(5);

    logger.info(
      `Initial seq num ${initialPackageSeqNum}, initial Window Size ${this.windowSize}`
    );

    const data = this.makeDataPackage(initialPackageSeqNum);

    this.sendDataPackage(data, this.clientUrl);
  }

  handleDataPackage(msg = new Buffer()) {
    const numberOfSequence = msg.readUint32BE(1);

    logger.info(`Package ${numberOfSequence} received`);

    this.confirmedPackages[numberOfSequence] = true;
    clearTimeout(this.timeouts[numberOfSequence]);

    if (numberOfSequence === this.baseSeqNum) this.baseSeqNum++;
    else if (this.currentWindowIsConfirmed())
      this.baseSeqNum += this.windowSize;

    logger.info(`Base ${this.baseSeqNum}`);

    for (
      let i = this.baseSeqNum;
      i < this.baseSeqNum + this.windowSize && i < this.fileChunks.length;
      i++
    ) {
      if (!this.sentPackages[i]) {
        const packageToSend = this.makeDataPackage(i);
        this.sendDataPackage(packageToSend, this.clientUrl, i);
      }
    }
  }

  makeDataPackage(numberOfSequence) {
    const data = Buffer.alloc(1024);

    this.makeHeader(data, numberOfSequence);
    data.fill(
      this.fileChunks[numberOfSequence],
      100,
      this.fileChunks[numberOfSequence].length + 100
    );

    return data;
  }

  currentWindowIsConfirmed() {
    for (let i = this.baseSeqNum; i < this.baseSeqNum + this.windowSize; i++) {
      if (!this.confirmedPackages[i]) return false;
    }

    return true;
  }

  onError() {
    this.server.on("error", (err) => {});
  }

  sendFile(file, clientUrl) {
    this.clientUrl = clientUrl;
    this.fileChunks = breakFileIntoChunks(
      file,
      this.bufferSize - this.headerSize
    );
    this.baseSeqNum = 0;

    this.handshake(this.fileChunks.length);
    this.initControlsArrays(this.fileChunks.length);
  }

  initControlsArrays(packagesToSendLenght) {
    for (let i = 0; i < packagesToSendLenght; i++) {
      this.sentPackages[i] = false;
      this.confirmedPackages[i] = false;
    }
  }

  makeHeader(buffer, numberOfSequence, isLastPackage = false) {
    // Números de sequência devem ser utilizados. Eles podem ser inteiros em um total de N*2, ou serem incrementados conforme o fluxo de bytes, como no TCP.
    //Bytes de 0 a 100 vão ser destinado ao header
    // Byte 0 a 3 numero de sequencia
    // Byte 8 guarda se é ultimo pacote

    buffer.writeInt8(2);
    buffer.writeUInt32BE(numberOfSequence, 1);
  }

  generatePackageTimeout(packageData, clientUrl, numberOfSequence) {
    const timeout = setTimeout(() => {
      if (!this.confirmedPackages[numberOfSequence]) {
        logger.warn(`Package ${numberOfSequence} got timeout`);

        this.lostPackages++;
        this.sendDataPackage(packageData, clientUrl);
      }
    }, 150);

    this.timeouts[numberOfSequence] = timeout;
  }

  handshake(numberOfPackages) {
    const data = Buffer.alloc(9);
    const initialPackageSeqNum = 0;

    //Tipo de pacote
    data.writeInt8(1);
    //Número de pacotes a serem enviados
    data.writeInt32BE(numberOfPackages, 1);
    //Número do pacote inicial
    data.writeUint32BE(initialPackageSeqNum, 5);

    this.server.send(data, this.clientUrl);
  }

  sendDataPackage(packageData, clientUrl) {
    const numberOfSequence = packageData.readUInt32BE(1);

    this.server.send(packageData, clientUrl);
    this.generatePackageTimeout(packageData, clientUrl, numberOfSequence);

    this.sentPackages[numberOfSequence] = true;

    logger.info(`${numberOfSequence} enviado`);
  }
}
