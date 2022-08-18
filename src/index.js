import "dotenv/config";
import fs from "fs";
import { SafeUdpServer } from "./SafeUdpServer.js";
import { SafeUdpReceiver } from "./SafeUdpReceiver.js";

const { SIZE_OF_BUFFER = 1024, PORT = 2500, CLIENT_PORT = 2500 } = process.env;

const server = new SafeUdpServer({ bufferSize: SIZE_OF_BUFFER, port: PORT });

new SafeUdpReceiver({
  port: CLIENT_PORT,
  serverPort: PORT,
});

const image = fs.readFileSync("src/images/10MBImage.jpg");

// fs.unlinkSync("combined.log");
// fs.unlinkSync("error.log");

server.sendFile({
  file: image,
  filename: "10MBImage.jpg",
  clientUrl: CLIENT_PORT,
});
