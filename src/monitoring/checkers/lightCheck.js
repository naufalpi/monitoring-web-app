const cheerio = require("cheerio");
const sanitizeHtml = require("sanitize-html");
const config = require("../../utils/config");
const { ensureSafeUrl } = require("../ssrf");
const { sha256 } = require("../hash");

const USER_AGENT = "BanjarnegaraMonitor/1.0";

async function lightCheck(targetUrl) {
  const startedAt = Date.now();
  const result = {
    ok: false,
    error: null,
    startedAt: new Date(startedAt),
    truncated: false
  };

  try {
    const response = await fetchWithRedirects(targetUrl);

    const html = response.body || "";
    const sanitizedHtml = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags,
      allowedAttributes: {
        a: ["href", "name", "target"],
        img: ["src", "alt"],
        p: ["class"],
        div: ["class"],
        span: ["class"]
      }
    });

    const $ = cheerio.load(html);
    const title = $("title").first().text().trim();
    const text = $("body").text().replace(/\s+/g, " ").trim();

    result.ok = true;
    result.httpStatus = response.status;
    result.finalUrl = response.finalUrl || null;
    result.truncated = response.truncated || false;
    result.responseTimeMs = Date.now() - startedAt;
    result.title = title;
    result.text = text.slice(0, 20000);
    result.html = html;
    result.sanitizedHtml = sanitizedHtml;
    result.htmlHash = sha256(sanitizedHtml);
    result.textHash = sha256(text);
  } catch (error) {
    result.error = error;
    result.errorMessage = error.message;
  }

  result.finishedAt = new Date();
  return result;
}

async function fetchWithRedirects(initialUrl) {
  let currentUrl = initialUrl;
  let response = null;

  for (let i = 0; i <= config.maxRedirects; i += 1) {
    await ensureSafeUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        headers: { "user-agent": USER_AGENT },
        redirect: "manual",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        break;
      }
      const nextUrl = new URL(location, currentUrl).toString();
      await ensureSafeUrl(nextUrl);
      currentUrl = nextUrl;
      if (i === config.maxRedirects) {
        throw new Error("Max redirects exceeded");
      }
      continue;
    }

    break;
  }

  if (!response) {
    throw new Error("No response");
  }

  const { text: body, truncated } = await readBodyWithLimit(response, config.maxBodyBytes);
  return {
    status: response.status,
    body,
    finalUrl: currentUrl,
    truncated
  };
}

async function readBodyWithLimit(response, maxBytes) {
  if (!response.body || !response.body.getReader) {
    const text = await response.text();
    if (maxBytes && text.length > maxBytes) {
      return { text: text.slice(0, maxBytes), truncated: true };
    }
    return { text, truncated: false };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    if (maxBytes && received + chunk.length > maxBytes) {
      const allowed = maxBytes - received;
      if (allowed > 0) {
        chunks.push(chunk.slice(0, allowed));
      }
      truncated = true;
      try {
        await reader.cancel();
      } catch (error) {
        // Ignore cancellation errors.
      }
      break;
    }
    chunks.push(chunk);
    received += chunk.length;
  }

  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}

module.exports = {
  lightCheck
};

