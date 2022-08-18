import "dotenv/config";
import fs from "fs";
import path from "path";
import { SafeUdpServer } from "./SafeUdpServer.js";
import { SafeUdpReceiver } from "./SafeUdpReceiver.js";
import readFilename from "./utils/readFilename.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

let filename = await readFilename();
const filePath = path.join(__dirname, "testFiles", filename);

const { SIZE_OF_BUFFER = 1024, PORT = 2500, CLIENT_PORT = 2500 } = process.env;

const server = new SafeUdpServer({ bufferSize: SIZE_OF_BUFFER, port: PORT });

new SafeUdpReceiver({
  port: CLIENT_PORT,
  serverPort: PORT,
});

const image = fs.readFileSync(filePath);

server.sendFile({
  file: image,
  filename: "10MBImage.jpg",
  clientUrl: CLIENT_PORT,
});
