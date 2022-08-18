import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default async function readFilename() {
  return new Promise((resolve, reject) => {
    rl.question(
      "Digite o caminho do arquivo: (*O arquivo deve estar dentro da pasta testFiles*) \n",
      (name) => resolve(name)
    );
  });
}
