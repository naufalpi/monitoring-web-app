const { chromium } = require("playwright");
const sanitizeHtml = require("sanitize-html");
const config = require("../../utils/config");
const { ensureSafeUrl, isBlockedHost, resolveAndValidateHost } = require("../ssrf");
const { prepareScreenshotPath } = require("../evidence");

const USER_AGENT = "BanjarnegaraMonitor/1.0";
let browserPromise;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  }
  return browserPromise;
}

async function deepCheck(targetUrl, targetId, startedAt) {
  await ensureSafeUrl(targetUrl);

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(config.playwrightTimeoutMs);

  await page.route("**/*", (route) => {
    const reqUrl = route.request().url();
    try {
      const parsed = new URL(reqUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return route.abort();
      }
      if (isBlockedHost(parsed.hostname)) {
        return route.abort();
      }
      return resolveAndValidateHost(parsed.hostname)
        .then(() => route.continue())
        .catch(() => route.abort());
    } catch (error) {
      return route.abort();
    }
  });

  let response = null;
  let result;
  try {
    response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.playwrightTimeoutMs
    });

    await page.waitForTimeout(1000);

    const title = await page.title();
    const rawHtml = await page.content();
    const html = rawHtml.slice(0, config.maxHtmlChars);
    const text = await page.evaluate(() => (document.body ? document.body.innerText : ""));

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

    const screenshot = await prepareScreenshotPath(targetId, startedAt);
    await page.screenshot({ path: screenshot.fullPath, fullPage: true });

    result = {
      ok: true,
      httpStatus: response ? response.status() : null,
      finalUrl: page.url(),
      title,
      text: text.slice(0, 20000),
      html,
      sanitizedHtml,
      screenshotPath: screenshot.relativePath
    };
  } catch (error) {
    result = {
      ok: false,
      error,
      errorMessage: error.message
    };
  } finally {
    await page.close();
    await context.close();
  }

  return result;
}

module.exports = {
  deepCheck
};

