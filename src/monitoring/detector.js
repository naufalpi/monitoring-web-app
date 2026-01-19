const GAMBLING_KEYWORDS = [
  "judi",
  "judi online",
  "judol",
  "slot",
  "slot gacor",
  "slot online",
  "gacor",
  "togel",
  "toto",
  "casino",
  "casino online",
  "bet",
  "betting",
  "sportsbook",
  "parlay",
  "jackpot",
  "rtp",
  "rtp live",
  "maxwin",
  "max win",
  "deposit",
  "withdraw",
  "wd",
  "bandar",
  "agen",
  "spin",
  "bonus",
  "new member",
  "member baru",
  "link alternatif",
  "slot88",
  "slot thailand",
  "poker",
  "roulette"
];

const PORN_KEYWORDS = [
  "porn",
  "porno",
  "pornhub",
  "onlyfans",
  "xxx",
  "sex",
  "sex live",
  "jav",
  "nude",
  "naked",
  "adult",
  "bokep",
  "dewasa",
  "18+",
  "hot girl",
  "live cam",
  "gadis"
];

const DEFACE_PHRASES = [
  "hacked by",
  "defaced by",
  "owned by",
  "pwned",
  "hacked",
  "defaced",
  "pwn3d",
  "h4cked",
  "h4ck3d",
  "we are anonymous",
  "site hacked",
  "web hacked"
];

const SUSPICIOUS_TERMS = [
  "free credit",
  "login bonus",
  "daftar sekarang",
  "join now",
  "promosi",
  "bocoran",
  "link terbaru",
  "bonus member",
  "daftar",
  "slot online",
  "rtp live",
  "maxwin"
];

function normalizeText(text) {
  if (!text) return "";
  const leetMap = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "8": "b"
  };
  return text
    .toLowerCase()
    .replace(/[0134578]/g, (char) => leetMap[char] || char)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text) {
  return text.replace(/[^a-z0-9]+/g, "");
}

function scoreContent(text) {
  const normalized = normalizeText(text);
  const compacted = compactText(normalized);
  const reasons = new Set();
  let score = 0;
  let defaced = false;

  for (const phrase of DEFACE_PHRASES) {
    if (normalized.includes(phrase)) {
      reasons.add(`Defacement phrase: ${phrase}`);
      score += 60;
      defaced = true;
    }
  }

  score += addMatches(normalized, compacted, GAMBLING_KEYWORDS, 20, "Gambling keyword", reasons);
  score += addMatches(normalized, compacted, PORN_KEYWORDS, 25, "Porn keyword", reasons);
  score += addMatches(normalized, compacted, SUSPICIOUS_TERMS, 10, "Suspicious term", reasons);

  if (score > 100) score = 100;

  const severity = score >= 80 || defaced ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW";

  return {
    score,
    severity,
    reasons: Array.from(reasons).slice(0, 12),
    defaced
  };
}

function mergeDetections(textResult, imageResult) {
  if (!imageResult || !imageResult.score) {
    return textResult;
  }
  const reasons = new Set([...(textResult.reasons || []), ...(imageResult.reasons || [])]);
  const score = Math.min(100, (textResult.score || 0) + imageResult.score);
  const defaced = Boolean(textResult.defaced);
  const severity = score >= 80 || defaced ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW";

  return {
    ...textResult,
    score,
    severity,
    reasons: Array.from(reasons).slice(0, 12),
    image: {
      score: imageResult.score,
      reasons: imageResult.reasons,
      skinPercent: imageResult.skinPercent,
      method: imageResult.method,
      classifier: imageResult.classifier || null
    }
  };
}

function addMatches(normalized, compacted, keywords, weight, label, reasons) {
  let score = 0;
  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      reasons.add(`${label}: ${keyword}`);
      score += weight;
      continue;
    }

    const compactKeyword = compactText(keyword);
    if (compactKeyword.length >= 4 && compacted.includes(compactKeyword)) {
      reasons.add(`${label} (obfuscated): ${keyword}`);
      score += Math.round(weight * 0.6);
    }
  }
  return score;
}

module.exports = {
  scoreContent,
  normalizeText,
  mergeDetections
};

