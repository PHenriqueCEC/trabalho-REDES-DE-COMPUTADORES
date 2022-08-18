import "dotenv/config";
import fs from "fs";
import { SafeUdpServer } from "./SafeUdpServer.js";
import { SafeUdpReceiver } from "./SafeUdpReceiver.js";
import inquirer from "inquirer";
//import readline from "readline";

const { SIZE_OF_BUFFER = 1024, PORT = 2500, CLIENT_PORT = 2500 } = process.env;

const server = new SafeUdpServer({ bufferSize: SIZE_OF_BUFFER, port: PORT });

new SafeUdpReceiver({
  port: CLIENT_PORT,
  serverPort: PORT,
});


 const readImage = [
  {
    type: 'input',
    name: 'name',
    message: "Digite o caminho da imagem",
  },
]; 

await inquirer.prompt(readImage).then(answers => {
  console.log(`caminho digitado ${answers.name}!`);
  process.argv[2] = answers.name
}); 


const image = process.argv[2]

console.log("Valor de image" + image)


try {
  fs.unlinkSync("combined.log");
  fs.unlinkSync("error.log");
} catch(error) {
  console.log("Erro")
}

server.sendFile(image, CLIENT_PORT);
