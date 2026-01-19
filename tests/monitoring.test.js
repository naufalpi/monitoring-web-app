const {
  isSuspiciousRedirect,
  shouldDeepCheck,
  evaluateStatus
} = require("../src/monitoring/status");

test("flags suspicious redirect when host changes", () => {
  const result = isSuspiciousRedirect("https://example.go.id", "https://evil.com/phishing");
  expect(result).toBe(true);
});

test("decides deep check on content change", () => {
  const light = { ok: true, httpStatus: 200, htmlHash: "a", textHash: "b" };
  const previous = { htmlHash: "x", textHash: "y" };
  const detector = { score: 0 };
  const result = shouldDeepCheck({
    light,
    previous,
    detector,
    redirectSuspicious: false
  });
  expect(result).toBe(true);
});

test("marks down on HTTP 500", () => {
  const light = { ok: true, httpStatus: 500 };
  const detector = { score: 0, defaced: false };
  const status = evaluateStatus({
    light,
    deep: null,
    previous: null,
    detector,
    redirectSuspicious: false,
    phashDelta: null
  });
  expect(status).toBe("DOWN");
});

