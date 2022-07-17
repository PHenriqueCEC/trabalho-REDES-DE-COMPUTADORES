import "dotenv/config";
import fs from "fs";
import { Buffer } from "node:buffer";
import { SafeUdpServer } from "./SafeUdpServer.js";
import { SafeUdpReceiver } from "./SafeUdpReceiver.js";

const { SIZE_OF_BUFFER, PORT } = process.env;

const server = new SafeUdpServer({ bufferSize: SIZE_OF_BUFFER, port: PORT });
const client = new SafeUdpReceiver({ serverUrl: "localhost" });

const buff = Buffer.alloc(1024, "banana");

client.send({ data: buff, serverUrl: PORT });
