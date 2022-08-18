import dgram from "node:dgram";
import { Buffer } from "node:buffer";
import logger from "./utils/logger.js";
import { PACKAGE_TYPE, PACKAGE_TYPE_DICTIONARY } from "./constants/index.js";
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
    this.receivedPackages = 0;
    this.windowSize = 10;
    this.baseSeqNum = 0;
    this.lastRecevSeqNum = 0;

    this.sampleRTT = 50;
    this.estimatedRTT = 0;
    this.devRTT = 0;
    this.totalRTT = 0;

    this.startRTT = [];

    this.sstresh = 0;
    this.cwnd = 0;

    this.initServer();
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(this.port);

    this.onError();
    this.onMessage();
    this.onListening();
  }

  calcTimeout() {
    const alfa = 0.125;
    const beta = 0.25;

    this.estimatedRTT = (1 - alfa) * this.estimatedRTT + alfa * this.sampleRTT;

    this.devRTT =
      (1 - beta) * this.devRTT +
      beta * Math.abs(this.sampleRTT - this.estimatedRTT);

    return 4 * (this.estimatedRTT + 4 * this.devRTT);
  }

  onListening() {
    this.server.on("listening", () => {
      const address = this.server.address();
      logger.debug(`server listening ${address.address}:${address.port}`);
    });
  }

  onMessage() {
    this.server.on("message", (msg, rinfo) => {
      this.receivedPackages++;

      const packageType = this.getPackageType(msg);

      if (packageType === "connection") this.handleConnectionPackage(msg);
      else this.handleDataPackage(msg);
    });
  }

  getPackageType(data) {
    const packageType = data.readInt8();

    return packageType === 1 ? "connection" : "data";
  }

  handleConnectionPackage(msg) {
    const initialPackageSeqNum = msg.readUInt32BE(1);
    this.windowSize = msg.readUint32BE(5);

    const data = this.makeDataPackage(initialPackageSeqNum);
    this.sendDataPackage(data, this.clientUrl);
  }

  discconect() {
    const data = Buffer.alloc(1);
    data.writeInt8(PACKAGE_TYPE.disconnection);

    this.server.send(data, this.clientUrl);
    this.server.close();
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

  getPackageType(data) {
    const packageType = data.readInt8();

    return PACKAGE_TYPE_DICTIONARY[packageType];
  }

  handleConnectionPackage(msg) {
    const initialPackageSeqNum = msg.readUInt32BE(1);
    this.windowSize = msg.readUint32BE(5);

    const data = this.makeDataPackage(initialPackageSeqNum);

    this.sendDataPackage(data, this.clientUrl);
  }

  //Refatorar

  handleDataPackage(msg) {
    const numberOfSequence = msg.readUint32BE(1);

    logger.debug(`Package ${numberOfSequence} received`);

    if (this.startRTT[numberOfSequence]) {
      const packageRTT = new Date().getTime() - this.startRTT[numberOfSequence];

      this.totalRTT += packageRTT;

      this.sampleRTT = this.totalRTT / this.receivedPackages;
    }

    this.confirmedPackages[numberOfSequence] = true;
    //this.windowSize++;
    clearTimeout(this.timeouts[numberOfSequence]);

    if (numberOfSequence === this.baseSeqNum) this.baseSeqNum++;

    if (this.currentWindowIsConfirmed()) {
      this.baseSeqNum += this.windowSize;

      if (this.baseSeqNum >= this.fileChunks.length) this.discconect();
    }

    this.runWindow();
  }

  runWindow() {
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
    const newPackagesRange = this.baseSeqNum + this.windowSize;

    const maxIterationSize =
      newPackagesRange > this.fileChunks.length
        ? this.fileChunks.length
        : newPackagesRange;

    for (let i = this.baseSeqNum; i < maxIterationSize; i++) {
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
    //Bytes de 0 a 100 vão ser destinado ao header
    // Byte 0 simboliza se é de conexão
    // Byte 0 a 3 numero de sequencia

    buffer.writeInt8(2);
    buffer.writeUInt32BE(numberOfSequence, 1);
  }

  generatePackageTimeout(packageData, clientUrl, numberOfSequence) {
    const time = this.calcTimeout();

    const timeout = setTimeout(() => {
      if (!this.confirmedPackages[numberOfSequence]) {
        logger.warn(`Package ${numberOfSequence} got timeout`);

        this.lostPackages++;
        //this.windowSize = Math.round(this.windowSize / 2);

        this.sendDataPackage(packageData, clientUrl);
      }
    }, time);

    this.timeouts[numberOfSequence] = timeout;
  }

  handshake(numberOfPackages) {
    const data = Buffer.alloc(9);
    const initialPackageSeqNum = 0;

    data.writeInt8(PACKAGE_TYPE.connection);
    data.writeInt32BE(numberOfPackages, 1);
    data.writeUint32BE(initialPackageSeqNum, 5);

    this.server.send(data, this.clientUrl);
  }

  closeConnection() {}

  sendDataPackage(packageData, clientUrl) {
    const numberOfSequence = packageData.readUInt32BE(1);

    this.startRTT[numberOfSequence] = new Date().getTime();

    this.server.send(packageData, clientUrl);
    this.generatePackageTimeout(packageData, clientUrl, numberOfSequence);

    this.sentPackages[numberOfSequence] = true;

    logger.debug(`${numberOfSequence} enviado`);
  }
}
