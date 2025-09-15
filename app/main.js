const dgram = require("dgram");

console.log("Logs from your program will appear here!");

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    const id = buf.slice(0, 2);
    console.log("Packet ID:", id);
    // Flags: QR=1, OPCODE=0, AA=0, TC=0, RD=0, RA=0, Z=0, RCODE=0
    // In binary: 1000 0000 0000 0000 => 0x8000
    const flags = Buffer.from([0x80, 0x00]);

    // QDCOUNT, ANCOUNT, NSCOUNT, ARCOUNT: all 0
    const zero = Buffer.from([0x00, 0x00]);

    // Build header
    const header = Buffer.concat([
      id, // 2 bytes
      flags, // 2 bytes
      zero, // QDCOUNT
      zero, // ANCOUNT
      zero, // NSCOUNT
      zero, // ARCOUNT
    ]);

    udpSocket.send(header, rinfo.port, rinfo.address);
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
