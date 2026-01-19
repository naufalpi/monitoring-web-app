import { ref } from "vue";

const STORAGE_KEY = "bw.locale";
const DEFAULT_LOCALE = "id";

const messages = {
  en: {
    brand: {
      subtitle: "Monitoring defacement and negative content"
    },
    nav: {
      dashboard: "Dashboard",
      targets: "Targets",
      incidents: "Incidents",
      users: "Users",
      logout: "Logout",
      language: "Language"
    },
    footer: {
      developedBy: "Developed by Dinkominfo Banjarnegara"
    },
    login: {
      title: "Sign in",
      subtitle: "Use your monitoring credentials",
      email: "Email",
      password: "Password",
      submit: "Login",
      error: "Login failed."
    },
    dashboard: {
      totalUrls: "Total URLs",
      healthy: "Healthy",
      down: "Down",
      redirect: "Redirect",
      suspected: "Suspected Defacement",
      openIncidents: "Open Incidents",
      monitoredTargets: "Monitored Targets",
      liveStatus: "Live status",
      incidentFeed: "Incident Feed",
      latestActivity: "Latest activity"
    },
    table: {
      name: "Name",
      target: "Target",
      status: "Status",
      severity: "Severity",
      opened: "Opened",
      lastSeen: "Last seen",
      lastCheck: "Last check",
      response: "Response",
      interval: "Interval",
      enabled: "Enabled",
      actions: "Actions",
      incident: "Incident",
      user: "User",
      role: "Role",
      active: "Active",
      created: "Created",
      update: "Update"
    },
    actions: {
      view: "View",
      details: "Details",
      edit: "Edit",
      disable: "Disable",
      enable: "Enable",
      save: "Save",
      filter: "Filter",
      reset: "Reset Incidents",
      cancel: "Cancel",
      acknowledge: "Acknowledge",
      closeIncident: "Close Incident",
      delete: "Delete",
      saveComment: "Save Comment"
    },
    filters: {
      status: "Status",
      severity: "Severity",
      group: "Group",
      none: "None",
      all: "All",
      label: "Filters"
    },
    targets: {
      title: "Targets",
      subtitle: "Manage monitored URLs",
      permission: "You do not have permission to manage targets.",
      readOnly: "Read only"
    },
    fields: {
      group: "Group / OPD",
      interval: "Interval (sec)",
      enabled: "Enabled",
      name: "Name",
      url: "URL",
      password: "Password",
      role: "Role",
      email: "Email",
      status: "Status",
      lastCheck: "Last check",
      intervalShort: "Interval",
      actions: "Actions"
    },
    misc: {
      none: "None",
      yes: "Yes",
      no: "No",
      refresh: "Refresh"
    },
    empty: {
      targets: "No targets yet.",
      incidents: "No incidents found.",
      users: "No users.",
      data: "No data yet."
    },
    incidents: {
      title: "Incidents",
      subtitle: "Track defacement and anomalies",
      pageSummaryTitle: "Page Summary",
      pageSummarySubtitle: "Based on this page",
      topTargets: "Top Targets",
      topTargetsSubtitle: "Top 5 on this page",
      recentActivity: "Recent Activity",
      recentActivitySubtitle: "5 latest incidents"
    },
    incident: {
      loading: "Loading incident...",
      error: "Failed to load incident.",
      evidenceBefore: "Evidence (Before)",
      evidenceAfter: "Evidence (After)",
      noPriorScreenshot: "No prior screenshot available.",
      noScreenshot: "No screenshot available.",
      reasons: "Reasons",
      noReasons: "No reasons recorded.",
      extractedText: "Extracted Text",
      htmlSnapshot: "HTML Snapshot (Sanitized)",
      openSnapshot: "Open snapshot",
      actions: "Actions",
      commentLabel: "Comment / Escalation Notes",
      noPermission: "You do not have permission to update incidents.",
      acknowledgedBy: "Acknowledged By",
      confidence: "Confidence",
      opened: "Opened",
      lastSeen: "Last seen"
    },
    status: {
      open: "Open",
      ack: "Ack",
      closed: "Closed",
      disabled: "Disabled"
    },
    severity: {
      low: "Low",
      medium: "Medium",
      high: "High"
    },
    users: {
      title: "Users",
      subtitle: "Manage access",
      addUser: "Add User",
      accessDenied: "Access denied.",
      newPassword: "New password"
    },
    roles: {
      super_admin: "Super Admin",
      operator: "Operator",
      viewer: "Viewer"
    },
    pagination: {
      info: "Showing {start}-{end} of {total}",
      perPage: "Per page",
      prev: "Prev",
      next: "Next",
      page: "Page {page} / {totalPages}",
      all: "All"
    },
    confirm: {
      resetAll: "Delete ALL incidents? This cannot be undone.",
      resetFiltered: "Delete incidents for the current filters? This cannot be undone.",
      deleteIncident: "Delete this incident? This cannot be undone."
    }
  },
  id: {
    brand: {
      subtitle: "Memantau defacement dan konten negatif"
    },
    nav: {
      dashboard: "Dasbor",
      targets: "Target",
      incidents: "Insiden",
      users: "Pengguna",
      logout: "Keluar",
      language: "Bahasa"
    },
    footer: {
      developedBy: "Dikembangkan oleh Dinkominfo Banjarnegara"
    },
    login: {
      title: "Masuk",
      subtitle: "Gunakan kredensial monitoring Anda",
      email: "Email",
      password: "Kata sandi",
      submit: "Masuk",
      error: "Login gagal."
    },
    dashboard: {
      totalUrls: "Total URL",
      healthy: "Sehat",
      down: "Down",
      redirect: "Redirect",
      suspected: "Dugaan Defacement",
      openIncidents: "Insiden Terbuka",
      monitoredTargets: "Target Terpantau",
      liveStatus: "Status langsung",
      incidentFeed: "Feed Insiden",
      latestActivity: "Aktivitas terbaru"
    },
    table: {
      name: "Nama",
      target: "Target",
      status: "Status",
      severity: "Keparahan",
      opened: "Dibuka",
      lastSeen: "Terakhir terlihat",
      lastCheck: "Pemeriksaan terakhir",
      response: "Respons",
      interval: "Interval",
      enabled: "Aktif",
      actions: "Aksi",
      incident: "Insiden",
      user: "Pengguna",
      role: "Peran",
      active: "Aktif",
      created: "Dibuat",
      update: "Update"
    },
    actions: {
      view: "Lihat",
      details: "Detail",
      edit: "Ubah",
      disable: "Nonaktifkan",
      enable: "Aktifkan",
      save: "Simpan",
      filter: "Filter",
      reset: "Reset Insiden",
      cancel: "Batal",
      acknowledge: "Konfirmasi",
      closeIncident: "Tutup Insiden",
      delete: "Hapus",
      saveComment: "Simpan Catatan"
    },
    filters: {
      status: "Status",
      severity: "Keparahan",
      group: "Grup",
      none: "Tidak ada",
      all: "Semua",
      label: "Filter"
    },
    targets: {
      title: "Target",
      subtitle: "Kelola URL yang dipantau",
      permission: "Anda tidak punya izin untuk mengelola target.",
      readOnly: "Hanya baca"
    },
    fields: {
      group: "Grup / OPD",
      interval: "Interval (detik)",
      enabled: "Aktif",
      name: "Nama",
      url: "URL",
      password: "Kata sandi",
      role: "Peran",
      email: "Email",
      status: "Status",
      lastCheck: "Pemeriksaan terakhir",
      intervalShort: "Interval",
      actions: "Aksi"
    },
    misc: {
      none: "Tidak ada",
      yes: "Ya",
      no: "Tidak",
      refresh: "Pembaruan"
    },
    empty: {
      targets: "Belum ada target.",
      incidents: "Tidak ada insiden.",
      users: "Belum ada pengguna.",
      data: "Belum ada data."
    },
    incidents: {
      title: "Insiden",
      subtitle: "Pantau defacement dan anomali",
      pageSummaryTitle: "Ringkasan Halaman",
      pageSummarySubtitle: "Berdasarkan data di halaman ini",
      topTargets: "Target Terbanyak",
      topTargetsSubtitle: "Top 5 di halaman ini",
      recentActivity: "Aktivitas Terbaru",
      recentActivitySubtitle: "5 insiden terbaru"
    },
    incident: {
      loading: "Memuat insiden...",
      error: "Gagal memuat insiden.",
      evidenceBefore: "Bukti (Sebelum)",
      evidenceAfter: "Bukti (Sesudah)",
      noPriorScreenshot: "Tidak ada tangkapan layar sebelumnya.",
      noScreenshot: "Tidak ada tangkapan layar.",
      reasons: "Alasan",
      noReasons: "Tidak ada alasan.",
      extractedText: "Teks Ekstrak",
      htmlSnapshot: "Snapshot HTML (Disanitasi)",
      openSnapshot: "Buka snapshot",
      actions: "Aksi",
      commentLabel: "Catatan / Eskalasi",
      noPermission: "Anda tidak punya izin untuk memperbarui insiden.",
      acknowledgedBy: "Dikonfirmasi oleh",
      confidence: "Kepercayaan",
      opened: "Dibuka",
      lastSeen: "Terakhir terlihat"
    },
    status: {
      open: "Terbuka",
      ack: "Ditangani",
      closed: "Ditutup",
      disabled: "Nonaktif"
    },
    severity: {
      low: "Rendah",
      medium: "Sedang",
      high: "Tinggi"
    },
    users: {
      title: "Pengguna",
      subtitle: "Kelola akses",
      addUser: "Tambah Pengguna",
      accessDenied: "Akses ditolak.",
      newPassword: "Kata sandi baru"
    },
    roles: {
      super_admin: "Super Admin",
      operator: "Operator",
      viewer: "Viewer"
    },
    pagination: {
      info: "Menampilkan {start}-{end} dari {total}",
      perPage: "Per halaman",
      prev: "Sebelumnya",
      next: "Berikutnya",
      page: "Halaman {page} / {totalPages}",
      all: "Semua"
    },
    confirm: {
      resetAll: "Hapus SEMUA insiden? Tindakan ini tidak bisa dibatalkan.",
      resetFiltered: "Hapus insiden sesuai filter saat ini? Tindakan ini tidak bisa dibatalkan.",
      deleteIncident: "Hapus insiden ini? Tindakan ini tidak bisa dibatalkan."
    }
  }
};

const locale = ref(resolveLocale());

function resolveLocale() {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && messages[stored]) {
      return stored;
    }
    const browser = navigator.language ? navigator.language.toLowerCase() : "";
    if (browser.startsWith("en")) return "en";
    if (browser.startsWith("id")) return "id";
  } catch (error) {
    // Ignore storage errors.
  }
  return DEFAULT_LOCALE;
}

function setLocale(next) {
  if (!messages[next]) return;
  locale.value = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch (error) {
    // Ignore storage errors.
  }
}

function t(key, params = {}) {
  const value = getValue(messages[locale.value], key) || getValue(messages[DEFAULT_LOCALE], key) || key;
  return String(value).replace(/\{(\w+)\}/g, (match, token) => {
    if (params[token] === undefined || params[token] === null) {
      return match;
    }
    return String(params[token]);
  });
}

function getValue(source, key) {
  if (!source) return null;
  const parts = key.split(".");
  let current = source;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return null;
    current = current[part];
  }
  return typeof current === "string" ? current : null;
}

export { locale, setLocale, t };
