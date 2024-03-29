import dgram from "node:dgram";
import { Buffer } from "node:buffer";
import logger from "./utils/logger.js";
import { PACKAGE_TYPE, PACKAGE_TYPE_DICTIONARY } from "./constants/index.js";
import { breakFileIntoChunks } from "./utils/files.js";

const MIN_WINDOW_SIZE = 5;
const MAX_WINDOW_SIZE = 800;

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
    this.receivedPackages = 0;
    this.ackedPackagesCount = 0;

    this.doubledACKS = 0;
    this.sentDataPackagesCounter = 0;
    this.startTransmissionTime = 0;

    //Janela deslizante
    this.confirmedPackages = [];
    this.sentPackages = [];

    this.windowSize = 10;
    this.baseSeqNum = 0;

    this.sampleRTT = 200;
    this.estimatedRTT = 0;
    this.devRTT = 0;
    this.totalRTT = 0;

    this.startRTT = [];

    this.initServer();

    this.printInfoInterval = setInterval(() => {
      this.generateTransmissioninfo();
    }, 500);
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

    return 3 * (this.estimatedRTT + 4 * this.devRTT);
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
      this.receivedPackages++;

      if (packageType === "connection") this.handleConnectionPackage(msg);
      else this.handleDataPackage(msg);
    });
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

  disconnect() {
    const data = Buffer.alloc(1);
    data.writeInt8(PACKAGE_TYPE.disconnection);

    this.server.send(data, this.clientUrl);

    this.generateTransmissioninfo();
    clearInterval(this.printInfoInterval);
  }

  generateTransmissioninfo() {
    const elapsedTime = new Date().getTime() - this.startTransmissionTime;

    console.log("---------------------------------------------");
    console.log(`Transmition Info`);
    console.log("---------------------------------------------");
    console.log(`Lost packages ${this.lostPackages}`);
    console.log(`Doubled ACKS`, this.doubledACKS);
    console.log(`Received packages : ${this.receivedPackages}`);
    console.log(`Sent Packages: ${this.sentDataPackagesCounter}`);
    console.log(`Elapsed time: ${elapsedTime} ms`);
    console.log(`Window size: ${this.windowSize}`);
    console.log(`Acked packages: ${this.ackedPackagesCount}`);

    console.log("---------------------------------------------");
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

    this.confirmPackage(numberOfSequence);

    if (this.ackedPackagesCount === this.fileChunks.length) this.disconnect();

    this.increaseWindow(numberOfSequence);

    this.runWindow();
  }

  confirmPackage(numberOfSequence) {
    if (this.confirmPackage[numberOfSequence]) this.doubledACKS++;
    else this.ackedPackagesCount++;

    this.confirmedPackages[numberOfSequence] = true;

    clearTimeout(this.timeouts[numberOfSequence]);
  }

  increaseWindow(numberOfSequence) {
    this.windowSize++;

    if (numberOfSequence === this.baseSeqNum) this.baseSeqNum++;
    else if (this.currentWindowIsConfirmed())
      this.baseSeqNum += this.windowSize;
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

  updateSampleRTT(numberOfSequence) {
    if (this.startRTT[numberOfSequence]) {
      const packageTimeout =
        new Date().getTime() - this.startRTT[numberOfSequence];

      this.totalRTT += packageTimeout;

      this.sampleRTT = this.totalRTT / this.receivedPackages;
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

  sendFile({ file, filename, clientUrl }) {
    this.clientUrl = clientUrl;
    this.fileChunks = breakFileIntoChunks(
      file,
      this.bufferSize - this.headerSize
    );
    this.baseSeqNum = 0;

    this.handshake(this.fileChunks.length, filename);
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

        this.reduceWindowSize();
        this.sendDataPackage(packageData, clientUrl);
      }
    }, time);

    this.timeouts[numberOfSequence] = timeout;
  }

  reduceWindowSize() {
    const newWindowSize = this.windowSize--;

    if (newWindowSize >= MIN_WINDOW_SIZE) this.windowSize = newWindowSize;
  }

  handshake(numberOfPackages, filename) {
    const data = Buffer.alloc(9 + Buffer.byteLength(filename, "utf-8"));
    const initialPackageSeqNum = 0;

    data.writeInt8(PACKAGE_TYPE.connection);
    data.writeInt32BE(numberOfPackages, 1);
    data.writeUint32BE(initialPackageSeqNum, 5);
    data.write(filename, 9);

    this.startTransmissionTime = new Date().getTime();
    this.server.send(data, this.clientUrl);
  }

  closeConnection() {}

  sendDataPackage(packageData, clientUrl) {
    const numberOfSequence = packageData.readUInt32BE(1);

    this.startRTT[numberOfSequence] = new Date().getTime();

    this.server.send(packageData, clientUrl);
    this.generatePackageTimeout(packageData, clientUrl, numberOfSequence);

    this.sentPackages[numberOfSequence] = true;

    this.sentDataPackagesCounter++;
  }
}
