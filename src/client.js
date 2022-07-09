import dgram from "dgram";

var client = dgram.createSocket("udp4");

const serverUrl = "127.0.0.1";

client.send("Hello World!", 0, 12, 12000, serverUrl);
client.send("Hello2World!", 0, 12, 12000, serverUrl);
client.send("Hello3World!", 0, 12, 12000, serverUrl, function (err, bytes) {
  client.close();
});
