const dgram = require("dgram");
const { off } = require("process");

console.log("Logs from your program will appear here!");

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

const createResponseHeader = (requestHeader) => {
  let responseHeader = Buffer.from(requestHeader);
  responseHeader[2] = responseHeader[2] | 0x80; // QR = 1
  responseHeader[2] = responseHeader[2] & 0xff;
  if (!(responseHeader[3] & 0x0f) !== 0)
    responseHeader[3] = responseHeader[3] | 0x04;
  responseHeader[7] = responseHeader[5]; // ANCOUNT = 1
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

// const buildAnswer = (labels, ip) => {
//   const name = Buffer.from([0xc0, 0x0c]); // pointer to offset 12
//   const type = Buffer.alloc(2);
//   type.writeUInt16BE(1); // A
//   const cls = Buffer.alloc(2);
//   cls.writeUInt16BE(1); // IN
//   const ttl = Buffer.alloc(4);
//   ttl.writeUInt32BE(60);
//   const rdlen = Buffer.alloc(2);
//   rdlen.writeUInt16BE(4);
//   const rdata = Buffer.from(ip.split(".").map(Number));

//   return Buffer.concat([name, type, cls, ttl, rdlen, rdata]);
// };

// function parseLabels(header, buffer, qdcount) {
//   const names = [];
//   let offset = 12;
//   console.log("QDCOUNT:", qdcount);
//   for (let i = 0; i < qdcount; i++) {
//     const { name, newOffset } = parseName(buffer, offset);
//     offset = newOffset;

//     // Always read 4 bytes after name: QTYPE + QCLASS
//     offset += 4;

//     names.push(name);
//   }

//   return { names, questionsEndOffset: offset };
// }

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

const getAnswerBuffer = async (header, buffer, qdcount) => {
  const names = [];
  let offset = 12;
  console.log("QDCOUNT:", qdcount);
  for (let i = 0; i < qdcount; i++) {
    const { name, newOffset } = parseName(buffer, offset);
    const oldoffset = offset;
    offset = newOffset;
    // Always read 4 bytes after name: QTYPE + QCLASS
    offset += 4;
    header[5] = 1; // QDCOUNT = 1
    Console.log("name:", name, oldoffset, offset, newOffset);
    const query = Buffer.concat([header, buffer.slice(oldoffset, offset + 1)]);
    let resolver;
    const udpSocket1 = dgram.createSocket("udp4");
    for (let i = 0; i < process.argv.length; i++) {
      if (process.argv[i] === "--resolver") {
        resolver = process.argv[i + 1];
        i++;
      }
    }
    console.log("Resolver:", resolver);
    const [resolverHost, resolverPort] = resolver.split(":");
    udpSocket1.bind();
    udpSocket1.on("error", (err) => {
      console.log(`Error: ${err}`);
    });
    console.log("binded to", resolverPort, resolverHost);
    const response = await new Promise((resolve, reject) => {
      udpSocket1.on(
        "listening",
        () => {
          console.log("UDP Socket 1 listening");
          resolve("RESOLVED LISTENING");
        },
        (err) => {
          console.log("error", err);
          reject(err);
        }
      );
    });
    const sendPromiseHandler = new Promise(async (resolve, reject) => {
      udpSocket1.on("message", (msg, rinfo) => {
        console.log(
          `Received response from resolver ${rinfo.address}:${rinfo.port}`
        );
        resolve(msg);
        udpSocket1.close();
      });
    });
    console.log("query", query);
    udpSocket1.send(query, parseInt(resolverPort), resolverHost);
    let answer = await sendPromiseHandler;
    console.log(
      "Raw answer from resolver:",
      12 + offset - oldoffset,
      answer.length
    );
    answer = answer.slice(12 + offset - oldoffset, answer.length);
    console.log("Answer from resolver:", answer);
    names.push(answer);
  }

  return { names, offset };
};

udpSocket.on("message", async (buf, rinfo) => {
  try {
    let responseHeader = createResponseHeader(buf.slice(0, 12));
    let questionBuffer = Buffer.alloc(0);
    let answerBuffer = [];
    let qcount = buf[5];
    const flagsIn = buf.readUInt16BE(2);
    const opcode = (flagsIn >> 11) & 0x0f;
    if (!opcode && qcount !== 0) {
      console.log("Received DNS query");
      //   const parsedLabels = parseLabels(buf, qcount);
      answerBuffer = await getAnswerBuffer(buf.slice(0, 12), buf, qcount);
      questionBuffer = buf.slice(12, answerBuffer.offset);
      //   answerBuffer = parsedLabels.names.map((domain, i) =>
      //     buildAnswer(domain, `192.0.2.${i + 1}`)
      //   );
    }
    console.log("Answer Buffer:", responseHeader, answerBuffer);
    udpSocket.send(
      Buffer.concat([responseHeader, questionBuffer, ...answerBuffer.names]),
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
