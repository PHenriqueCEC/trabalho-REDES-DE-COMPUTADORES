import "dotenv/config";
import fs from "fs";
import { SafeUdpServer } from "./SafeUdpServer.js";
import { SafeUdpReceiver } from "./SafeUdpReceiver.js";
import path from "path";
import { stringify } from "csv-stringify";

const { SIZE_OF_BUFFER = 1024, PORT = 2500, CLIENT_PORT = 2500 } = process.env;

const server = new SafeUdpServer({ bufferSize: SIZE_OF_BUFFER, port: PORT });
const client = new SafeUdpReceiver({
  port: CLIENT_PORT,
  serverPort: PORT,
});

// client.send({ data: buff, serverUrl: PORT });

const image = fs.readFileSync("src/images/image2.jpg");

server.sendFile(image, CLIENT_PORT);
