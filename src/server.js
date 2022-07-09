import dgram from "node:dgram";

const server = dgram.createSocket("udp4");

server.on("error", (err) => {});

server.on("message", (msg, rinfo) => {
  console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
});

server.on("listening", () => {
  const address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(process.env.PORT);

export default server;
