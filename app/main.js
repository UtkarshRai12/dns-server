const dgram = require("dgram");

console.log("Logs from your program will appear here!");

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    const responseHeader = Buffer.from(buf.slice(0, 12));
    console.log("header:", responseHeader);
    responseHeader[2] = responseHeader[2] | 0x81;
    console.log("header:", responseHeader);
    udpSocket.send(responseHeader, rinfo.port, rinfo.address);
  } catch (e) {
    console.log(`Error receiving data: ${e}`);
  }
});

udpSocket.on("error", (err) => {
  console.log(`Error: ${err}`);
});

udpSocket.on("listening", () => {
  const address = udpSocket.address();
  console.log(`Server listening ${address.address}:${address.port}`);
});
