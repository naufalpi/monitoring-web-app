const crypto = require("crypto");
const Jimp = require("jimp");

function sha256(value) {
  if (value === undefined || value === null) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB) return null;
  const a = Buffer.from(hashA, "hex");
  const b = Buffer.from(hashB, "hex");
  if (a.length !== b.length) {
    return null;
  }

  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const xor = a[i] ^ b[i];
    distance += bitCount(xor);
  }
  return distance;
}

function bitCount(value) {
  let count = 0;
  let v = value;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

async function computeDHash(imagePath) {
  const image = await Jimp.read(imagePath);
  image.resize(9, 8).grayscale();

  const bits = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = Jimp.intToRGBA(image.getPixelColor(x, y)).r;
      const right = Jimp.intToRGBA(image.getPixelColor(x + 1, y)).r;
      bits.push(left > right ? 1 : 0);
    }
  }

  return bitsToHex(bits);
}

function bitsToHex(bits) {
  const hex = [];
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex.push(nibble.toString(16));
  }
  return hex.join("");
}

module.exports = {
  sha256,
  hammingDistance,
  computeDHash
};

