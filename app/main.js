const dgram = require("dgram");

console.log("Logs from your program will appear here!");

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

const createResponseHeader = (requestHeader) => {
  let responseHeader = Buffer.from(requestHeader);
  responseHeader[2] = responseHeader[2] | 0x80; // QR = 1
  responseHeader[2] = responseHeader[2] & 0xff;
  if (!(responseHeader[3] & 0x0f) !== 0)
    responseHeader[3] = responseHeader[3] | 0x04;
  responseHeader[7] = Buffer.from([responseHeader[5] | 0x01]); // ANCOUNT = 1
  return responseHeader;
};

// const createQuestionBuffer = (buf) => {
//   let questionBuffer = Buffer.from([]);
//   console.log("header:", responseHeader);
//   let curr = 12;
//   while (curr < buf.length) {
//     let labelLength = buf[curr];
//     if (labelLength === 0) break;
//     questionBuffer = Buffer.concat([
//       questionBuffer,
//       buf.slice(curr, curr + labelLength + 1),
//     ]);
//     curr += labelLength + 1;
//   }
//   questionBuffer = Buffer.concat([questionBuffer, buf.slice(curr, curr + 5)]);
//   return questionBuffer;
// };

const buildAnswer = (labels, ip) => {
  const name = Buffer.from([0xc0, 0x0c]); // pointer to offset 12
  const type = Buffer.alloc(2);
  type.writeUInt16BE(1); // A
  const cls = Buffer.alloc(2);
  cls.writeUInt16BE(1); // IN
  const ttl = Buffer.alloc(4);
  ttl.writeUInt32BE(60);
  const rdlen = Buffer.alloc(2);
  rdlen.writeUInt16BE(4);
  const rdata = Buffer.from(ip.split(".").map(Number));

  return Buffer.concat([name, type, cls, ttl, rdlen, rdata]);
};

function parseLabels(buffer, qdcount) {
  const names = [];
  let offset = 12;
  console.log("QDCOUNT:", qdcount);
  for (let i = 0; i < qdcount; i++) {
    const { name, newOffset } = parseName(buffer, offset);
    offset = newOffset;

    // Always read 4 bytes after name: QTYPE + QCLASS
    offset += 4;

    names.push(name);
  }

  return { names, questionsEndOffset: offset };
}

function parseName(buf, offset) {
  const labels = [];
  let jumped = false;
  let originalOffset = offset;

  while (true) {
    const len = buf[offset];
    if ((len & 0xc0) === 0xc0) {
      const pointer = ((len & 0x3f) << 8) | buf[offset + 1];
      if (!jumped) originalOffset = offset + 2;
      offset = pointer;
      jumped = true;
      continue;
    }
    if (len === 0) {
      offset += 1;
      break;
    }
    labels.push(buf.slice(offset + 1, offset + 1 + len).toString());
    offset += len + 1;
  }

  return {
    name: labels.join("."),
    newOffset: jumped ? originalOffset : offset,
  };
}

udpSocket.on("message", (buf, rinfo) => {
  try {
    let responseHeader = createResponseHeader(buf.slice(0, 12));
    let questionBuffer = Buffer.alloc(0);
    let answerBuffer = [];
    let qcount = buf[5];
    if (responseHeader[3] & (0x0f === 0) && qcount !== 0) {
      console.log("Received DNS query");
      const parsedLabels = parseLabels(buf, qcount);
      questionBuffer = buf.slice(12, parsedLabels.questionsEndOffset);
      answerBuffer = parsedLabels.names.map((domain, i) =>
        buildAnswer(domain, `192.0.2.${i + 1}`)
      );
    }
    udpSocket.send(
      Buffer.concat([responseHeader, questionBuffer, ...answerBuffer]),
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
