import dgram from "dgram";
import fs from "fs";
import { Buffer } from "node:buffer";
import "dotenv/config";
import "./server.js";

const client = dgram.createSocket("udp4");

const image = fs.readFileSync("src/download.png");

client.send("Hello world UDP", process.env.PORT);
client.send(image, process.env.PORT);
