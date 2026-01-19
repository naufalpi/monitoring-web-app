import { locale } from "./i18n.js";

const LOCALE_MAP = {
  id: "id-ID",
  en: "en-US"
};

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const formatLocale = LOCALE_MAP[locale.value] || "id-ID";
  return date.toLocaleString(formatLocale);
}

export function badgeClass(value) {
  const normalized = String(value || "UNKNOWN").toLowerCase();
  return `badge badge-${normalized}`;
}

export function statusKey(status) {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  if (normalized === "HEALTHY") return "healthy";
  if (normalized === "DOWN") return "down";
  if (normalized === "REDIRECT") return "redirect";
  if (normalized === "SUSPECTED_DEFACEMENT") return "suspected";
  if (normalized === "CHANGED") return "changed";
  return "unknown";
}
