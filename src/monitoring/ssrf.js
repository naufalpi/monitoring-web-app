const dns = require("dns").promises;
const net = require("net");
const ipaddr = require("ipaddr.js");

const BLOCKED_HOSTS = new Set(["localhost"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".lan"];
const CACHE_TTL_MS = 5 * 60 * 1000;
const hostCache = new Map();

function isPrivateIp(address) {
  if (!ipaddr.isValid(address)) return true;
  const parsed = ipaddr.parse(address);
  const range = parsed.range();
  return [
    "private",
    "loopback",
    "linkLocal",
    "uniqueLocal",
    "carrierGradeNat",
    "reserved",
    "multicast",
    "unspecified",
    "broadcast"
  ].includes(range);
}

function isBlockedHost(hostname) {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
  if (net.isIP(lower)) {
    return isPrivateIp(lower);
  }
  return false;
}

async function resolveAndValidateHost(hostname) {
  const cached = hostCache.get(hostname);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    if (!cached.ok) {
      throw new Error("Blocked host by cache");
    }
    return true;
  }

  if (isBlockedHost(hostname)) {
    hostCache.set(hostname, { ok: false, expiresAt: now + CACHE_TTL_MS });
    throw new Error("Blocked host");
  }

  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses || addresses.length === 0) {
    hostCache.set(hostname, { ok: false, expiresAt: now + CACHE_TTL_MS });
    throw new Error("Host did not resolve");
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      hostCache.set(hostname, { ok: false, expiresAt: now + CACHE_TTL_MS });
      throw new Error("Private IP blocked");
    }
  }

  hostCache.set(hostname, { ok: true, expiresAt: now + CACHE_TTL_MS });
  return true;
}

async function ensureSafeUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new Error("Invalid URL");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Unsupported URL scheme");
  }

  await resolveAndValidateHost(url.hostname);
  return url;
}

module.exports = {
  ensureSafeUrl,
  resolveAndValidateHost,
  isBlockedHost,
  isPrivateIp
};

