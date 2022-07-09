import "dotenv/config";
import "./server.js";

import dgram from "dgram";

var client = dgram.createSocket("udp4");

// const serverUrl = `localhost:${process.env.PORT}`;

client.send("Hello world UDP", process.env.PORT);
