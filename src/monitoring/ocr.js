const config = require("../utils/config");

async function runOcrIfEnabled(imageInput) {
  if (!config.enableOcr) {
    return "";
  }

  const { createWorker } = require("tesseract.js");
  const worker = await createWorker();
  try {
    await worker.loadLanguage(config.tesseractLang);
    await worker.initialize(config.tesseractLang);
    const {
      data: { text }
    } = await worker.recognize(imageInput);
    return text || "";
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  runOcrIfEnabled
};

