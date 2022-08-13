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

    this.sampleRTT = 200;
    this.estimatedRTT = 0;
    this.devRTT = 0;

    this.startRTT;

    this.initServer();
  }

  initServer() {
    this.server = dgram.createSocket("udp4");
    this.server.bind(process.env.port);

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

    return this.estimatedRTT + 4 * this.devRTT;
  }

  onListening() {
    this.server.on("listening", () => {
      const address = this.server.address();
      logger.info(`server listening ${address.address}:${address.port}`);
    });
  }

  onMessage() {
    this.server.on("message", (msg, rinfo) => {
      const numberOfSequence = parseInt(msg);

      logger.info(`Package ${numberOfSequence} received`);

      if (this.startRTT) {
        this.sampleRTT = new Date().getTime() - this.startRTT;
      }
      console.log("RTT: ", this.sampleRTT, " ms ");

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
          const packageToSend = Buffer.alloc(1024);

          this.makeHeader(packageToSend, i);
          packageToSend.fill(this.fileChunks[i], this.headerSize);

          this.sendPackage(packageToSend, this.clientUrl, i);
        }
      }
    });
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

    for (let i = 0; i < this.windowSize && i < this.fileChunks.length; i++) {
      const packageToSend = Buffer.alloc(1024);

      const isLastPackage = this.fileChunks.length === i;

      this.makeHeader(packageToSend, i, isLastPackage);
      packageToSend.fill(this.fileChunks[i], this.headerSize);

      this.sendPackage(packageToSend, clientUrl);
    }
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
    // Byte 0 a 7 numero de sequencia
    // Byte 8 guarda se é ultimo pacote

    buffer.writeUInt32BE(numberOfSequence);
    buffer[8] = isLastPackage;
  }

  generatePackageTimeout(packageData, clientUrl, numberOfSequence) {
    const time = this.calcTimeout();
    const timeout = setTimeout(() => {
      if (!this.confirmedPackages[numberOfSequence]) {
        logger.warn(`Package ${numberOfSequence} got timeout`);

        this.lostPackages++;
        this.sendPackage(packageData, clientUrl);
      }
    }, time);

    this.timeouts[numberOfSequence] = timeout;
  }

  handshake(numberOfPackages) {
    const data = Buffer.alloc(100);

    //Tam da janela nos bytes 0 a 3
    //Numero de pacotes a ser enviado nos bytes 4 a 7

    data.writeInt32BE(numberOfPackages);
  }

  sendPackage(packageData, clientUrl) {
    const numberOfSequence = packageData.readUInt32BE();

    this.startRTT = new Date().getTime();
    this.server.send(packageData, clientUrl);
    this.generatePackageTimeout(packageData, clientUrl, numberOfSequence);

    this.sentPackages[numberOfSequence] = true;

    logger.info(`${numberOfSequence} enviado`);
  }
}
