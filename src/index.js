import "dotenv/config";
import fs from "fs";
import { Buffer } from "node:buffer";
import { SafeUdpServer } from "./SafeUdpServer.js";
import { SafeUdpReceiver } from "./SafeUdpReceiver.js";
import path from "path";

const { SIZE_OF_BUFFER = 1024, PORT = 2030, CLIENT_PORT = 30 } = process.env;

const server = new SafeUdpServer({ bufferSize: SIZE_OF_BUFFER, port: PORT });
const client = new SafeUdpReceiver({
  port: CLIENT_PORT,
  serverPort: PORT,
});

// client.send({ data: buff, serverUrl: PORT });

const image = fs.readFileSync("src/images/download.png");

server.sendFile(image, CLIENT_PORT);
