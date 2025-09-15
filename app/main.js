const dgram = require("dgram");

console.log("Logs from your program will appear here!");

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    let responseHeader = Buffer.from(buf.slice(0, 12));
    console.log("header:", responseHeader);
    responseHeader[2] = responseHeader[2] | 0x80;
    responseHeader[2] = responseHeader[2] & 0xfe;
    responseHeader[4] = responseHeader[4] & 0x00;
    responseHeader[5] = responseHeader[5] | 0x01;
    const questionBuffer = Buffer.from([]);
    console.log("header:", responseHeader);
    let curr = 12;
    let labelLength = buf[12];
    while (labelLength !== 0) {
      console.log("labelLength:", labelLength);
      questionBuffer = Buffer.concat([
        questionBuffer,
        buf.slice(curr, curr + labelLength + 1),
      ]);
      curr += labelLength + 1;
      labelLength = buf[curr];
    }
    questionBuffer = Buffer.concat([questionBuffer, buf.slice(curr, curr + 5)]);
    console.log(
      "responseBuffer",
      Buffer.concat([responseHeader, questionBuffer])
    );
    udpSocket.send(
      Buffer.concat([responseHeader, questionBuffer]),
      rinfo.port,
      rinfo.address
    );
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
