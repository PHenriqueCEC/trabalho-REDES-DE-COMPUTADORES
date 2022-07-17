import dgram from "dgram";

const serverUrl = "127.0.0.1";

export class SafeUdpReceiver {
  constructor({ serverUrl }) {
    this.socket = dgram.createSocket("udp4");
    this.serverUrl = serverUrl;
  }

  send({ data, serverUrl }) {
    this.socket.send(data, serverUrl);
  }
}
