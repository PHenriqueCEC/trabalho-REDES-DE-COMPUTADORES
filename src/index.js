import "dotenv/config";
import fs from "fs";
import { SafeUdpServer } from "./SafeUdpServer.js";
import { SafeUdpReceiver } from "./SafeUdpReceiver.js";
import path from "path";
import { stringify } from "csv-stringify";

const { SIZE_OF_BUFFER = 1024, PORT = 2030, CLIENT_PORT = 30 } = process.env;

const server = new SafeUdpServer({ bufferSize: SIZE_OF_BUFFER, port: PORT });
const client = new SafeUdpReceiver({
  port: CLIENT_PORT,
  serverPort: PORT,
});

// client.send({ data: buff, serverUrl: PORT });

const image = fs.readFileSync("src/images/image2.jpg");

// Testando a saída em arquivo

/* fs.writeFile('saida.csv', "pedro", {encoding: 'utf-8', flag: 'w+'}, function(err) {
  if(err)  
    console.log("Arquivo n pode ser gravado")
})  */

server.sendFile(image, CLIENT_PORT);
