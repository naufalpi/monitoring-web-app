const { scoreContent, mergeDetections } = require("../src/monitoring/detector");

test("detects gambling content", () => {
  const result = scoreContent("Promo slot gacor deposit cepat link alternatif");
  expect(result.score).toBeGreaterThanOrEqual(60);
  expect(["MEDIUM", "HIGH"]).toContain(result.severity);
});

test("detects defacement phrases", () => {
  const result = scoreContent("Hacked by BlackHat. Website defaced.");
  expect(result.defaced).toBe(true);
  expect(result.score).toBeGreaterThanOrEqual(60);
});

test("detects pornography terms", () => {
  const result = scoreContent("Video xxx dewasa gratis");
  expect(result.score).toBeGreaterThan(0);
});

test("merges image detection score and reasons", () => {
  const textResult = scoreContent("Konten normal");
  const imageResult = {
    score: 40,
    reasons: ["NSFW: Porn (92.0%)"],
    skinPercent: 18,
    method: "nsfwjs"
  };
  const merged = mergeDetections(textResult, imageResult);
  expect(merged.score).toBeGreaterThanOrEqual(40);
  expect(merged.reasons.join(" ")).toContain("NSFW: Porn");
});
