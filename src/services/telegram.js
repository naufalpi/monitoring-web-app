const config = require("../utils/config");

async function sendTelegramMessage(text) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    return { skipped: true };
  }

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error: ${body}`);
  }

  return response.json();
}

module.exports = {
  sendTelegramMessage
};

