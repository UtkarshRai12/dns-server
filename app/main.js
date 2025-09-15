const dgram = require("dgram");

console.log("Logs from your program will appear here!");

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    let responseHeader = Buffer.from(buf.slice(0, 12));
    console.log("header:", responseHeader);
    responseHeader[2] = responseHeader[2] | 0x80; // QR = 1
    responseHeader[2] = responseHeader[2] & 0xff;
    if ((responseHeader[2] | 0x00) !== 0)
      responseHeader[3] = responseHeader[3] | 0x04;
    responseHeader[5] = responseHeader[5] | 0x01;
    responseHeader[7] = responseHeader[7] | 0x01;
    let questionBuffer = Buffer.from([]);
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
    let answerBuffer = Buffer.concat([questionBuffer]);
    answerBuffer = Buffer.concat([
      answerBuffer,
      Buffer.from([0x80, 0x01, 0x00, 0x08, 0x00, 0x04, 0x08, 0x08, 0x08, 0x08]),
    ]); // Type A
    console.log(
      "responseBuffer",
      Buffer.concat([responseHeader, questionBuffer, answerBuffer])
    );
    udpSocket.send(Buffer.concat([responseHeader]), rinfo.port, rinfo.address);
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
