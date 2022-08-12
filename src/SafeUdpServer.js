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
    this.server.bind(process.env.port);

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
      const numberOfSequence = parseInt(msg);

      logger.info(`Package ${numberOfSequence} received`);
      this.confirmedPackages[numberOfSequence] = true;
      clearTimeout(this.timeouts[numberOfSequence]);

      if (numberOfSequence === this.baseSeqNum) {
        this.baseSeqNum++;
        logger.info(`Base ${this.baseSeqNum}`);

        if (this.baseSeqNum === this.fileChunks.length)
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
      }
    });
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

    buffer.writeUint32BE(numberOfSequence);
    buffer[8] = isLastPackage;
  }

  sendPackage(packageData, clientUrl) {
    const numberOfSequence = packageData.readUInt32BE();

    this.server.send(packageData, clientUrl);
    this.sentPackages[numberOfSequence] = true;

    logger.info(`${numberOfSequence} enviado`);

    const timeout = setTimeout(() => {
      if (!this.confirmedPackages[numberOfSequence]) {
        logger.warn(`Package ${numberOfSequence} got timeout`);

        this.server.send(packageData, clientUrl);
      }
    }, 1000);

    this.timeouts[numberOfSequence] = timeout;
  }
}
