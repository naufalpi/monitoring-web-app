<template>
  <section class="summary-grid">
    <div class="card">
      <div class="card-label">{{ t("dashboard.totalUrls") }}</div>
      <div class="card-value">{{ summary.total }}</div>
    </div>
    <div class="card">
      <div class="card-label">{{ t("dashboard.healthy") }}</div>
      <div class="card-value">{{ summary.healthy }}</div>
    </div>
    <div class="card">
      <div class="card-label">{{ t("dashboard.down") }}</div>
      <div class="card-value">{{ summary.down }}</div>
    </div>
    <div class="card">
      <div class="card-label">{{ t("dashboard.redirect") }}</div>
      <div class="card-value">{{ summary.redirect }}</div>
    </div>
    <div class="card">
      <div class="card-label">{{ t("dashboard.suspected") }}</div>
      <div class="card-value">{{ summary.suspected }}</div>
    </div>
    <div class="card">
      <div class="card-label">{{ t("dashboard.openIncidents") }}</div>
      <div class="card-value">{{ summary.openIncidents }}</div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>{{ t("dashboard.monitoredTargets") }}</h2>
        <span class="panel-sub">{{ t("dashboard.liveStatus") }}</span>
      </div>
      <div class="panel-sub">{{ filteredTargets.length }} / {{ targets.length }}</div>
    </div>
    <div class="filter-row dashboard-filters">
      <div class="filter-field filter-field--search">
        <label>{{ t("filters.search") }}</label>
        <input v-model="searchQuery" type="search" :placeholder="t('filters.search')" />
      </div>
      <div class="filter-field">
        <label>{{ t("filters.group") }}</label>
        <select v-model="groupFilter">
          <option value="">{{ t("filters.all") }}</option>
          <option v-for="group in groups" :key="group" :value="group">{{ group }}</option>
        </select>
      </div>
      <div class="filter-field">
        <label>{{ t("filters.status") }}</label>
        <select v-model="statusFilter">
          <option value="">{{ t("filters.all") }}</option>
          <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
        </select>
      </div>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t("table.name") }}</th>
            <th>{{ t("table.status") }}</th>
            <th>{{ t("table.lastCheck") }}</th>
            <th>{{ t("table.response") }}</th>
            <th>{{ t("table.incident") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredTargets.length === 0">
            <td colspan="5">{{ targets.length === 0 ? t("empty.targets") : t("empty.filtered") }}</td>
          </tr>
          <tr v-for="target in filteredTargets" :key="target.id">
            <td>
              <div class="cell-title">{{ target.name }}</div>
              <div class="cell-sub">
                <a class="link link-sub" :href="target.url" target="_blank" rel="noreferrer">{{ target.url }}</a>
              </div>
            </td>
            <td>
              <span :class="badgeClass(target.status)">{{
                target.status || "UNKNOWN"
              }}</span>
            </td>
            <td>{{ formatDate(target.lastCheck) }}</td>
            <td>
              {{
                target.responseTimeMs ? `${target.responseTimeMs} ms` : "-"
              }}
            </td>
            <td>
              <RouterLink
                v-if="target.lastIncidentId"
                class="link"
                :to="`/incidents/${target.lastIncidentId}`"
                >{{ t("actions.view") }}</RouterLink
              >
              <span v-else class="muted">{{ t("misc.none") }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { apiRequest } from "../services/api.js";
import { onSse } from "../services/sse.js";
import { t } from "../services/i18n.js";
import { badgeClass, formatDate, statusKey } from "../services/ui.js";

const summary = reactive({
  total: 0,
  healthy: 0,
  down: 0,
  redirect: 0,
  suspected: 0,
  changed: 0,
  unknown: 0,
  openIncidents: 0,
});
const targets = ref([]);
const groups = ref([]);
const searchQuery = ref("");
const groupFilter = ref("");
const statusFilter = ref("");
const statusOptions = ["HEALTHY", "DOWN", "REDIRECT", "CHANGED", "SUSPECTED_DEFACEMENT", "UNKNOWN"];

const filteredTargets = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return targets.value.filter((target) => {
    if (groupFilter.value && target.group !== groupFilter.value) return false;
    if (statusFilter.value && (target.status || "UNKNOWN") !== statusFilter.value) return false;
    if (query) {
      const name = (target.name || "").toLowerCase();
      const url = (target.url || "").toLowerCase();
      const group = (target.group || "").toLowerCase();
      if (!name.includes(query) && !url.includes(query) && !group.includes(query)) return false;
    }
    return true;
  });
});

const statusByTarget = new Map();
const incidentByTarget = new Map();
let refreshTimer = null;
let refreshInFlight = false;
let refreshQueued = false;

const updateSummaryCount = (key, value) => {
  summary[key] = Math.max(0, value);
};

const updateStatusSummary = (oldStatus, newStatus) => {
  const oldKey = statusKey(oldStatus);
  const newKey = statusKey(newStatus);
  if (oldKey === newKey) return;
  if (summary[oldKey] !== undefined)
    updateSummaryCount(oldKey, summary[oldKey] - 1);
  if (summary[newKey] !== undefined)
    updateSummaryCount(newKey, summary[newKey] + 1);
};

const updateIncidentSummary = (oldIncidentId, newIncidentId) => {
  const hadOpen = Boolean(oldIncidentId);
  const hasOpen = Boolean(newIncidentId);
  if (hadOpen === hasOpen) return;
  updateSummaryCount(
    "openIncidents",
    summary.openIncidents + (hasOpen ? 1 : -1),
  );
};

const renderSummary = (data) => {
  Object.keys(summary).forEach((key) => {
    if (data[key] !== undefined) {
      summary[key] = data[key];
    }
  });
};

const renderTargets = (data) => {
  statusByTarget.clear();
  incidentByTarget.clear();
  targets.value = data;
  data.forEach((target) => {
    statusByTarget.set(target.id, target.status || "UNKNOWN");
    incidentByTarget.set(target.id, target.lastIncidentId || null);
  });
};

const loadGroups = async () => {
  try {
    const data = await apiRequest("/api/targets/groups");
    groups.value = data.groups || [];
  } catch (error) {
    groups.value = [];
  }
};

const refreshDashboard = async () => {
  if (refreshInFlight) {
    refreshQueued = true;
    return;
  }
  refreshInFlight = true;
  try {
    const [summaryRes, targetsRes] = await Promise.all([
      apiRequest("/api/summary"),
      apiRequest("/api/targets"),
    ]);
    renderSummary(summaryRes);
    renderTargets(targetsRes.targets || []);
  } catch (error) {
    // Ignore.
  } finally {
    refreshInFlight = false;
    if (refreshQueued) {
      refreshQueued = false;
      scheduleRefresh();
    }
  }
};

const scheduleRefresh = () => {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshDashboard();
  }, 1000);
};

const applyCheckEvent = (event) => {
  const index = targets.value.findIndex(
    (target) => target.id === event.targetId,
  );
  if (index === -1) {
    scheduleRefresh();
    return;
  }

  const target = targets.value[index];
  const newStatus = event.status || "UNKNOWN";
  const oldStatus =
    statusByTarget.get(event.targetId) || target.status || "UNKNOWN";
  if (newStatus !== oldStatus) {
    updateStatusSummary(oldStatus, newStatus);
  }
  statusByTarget.set(event.targetId, newStatus);

  const newIncidentId = event.lastIncidentId || null;
  const oldIncidentId =
    incidentByTarget.get(event.targetId) || target.lastIncidentId || null;
  if (newIncidentId !== oldIncidentId) {
    updateIncidentSummary(oldIncidentId, newIncidentId);
  }
  incidentByTarget.set(event.targetId, newIncidentId);

  targets.value[index] = {
    ...target,
    status: newStatus,
    lastCheck: event.lastCheck,
    responseTimeMs: event.responseTimeMs,
    lastIncidentId: newIncidentId,
  };
};

const applyIncidentEvent = (event) => {
  const index = targets.value.findIndex(
    (target) => target.id === event.targetId,
  );
  if (index === -1) {
    scheduleRefresh();
    return;
  }
  const target = targets.value[index];
  const isClosed =
    event.type === "incident.closed" || event.status === "CLOSED";
  const newIncidentId = isClosed ? null : event.incidentId || null;
  const oldIncidentId =
    incidentByTarget.get(event.targetId) || target.lastIncidentId || null;

  if (newIncidentId !== oldIncidentId) {
    updateIncidentSummary(oldIncidentId, newIncidentId);
    incidentByTarget.set(event.targetId, newIncidentId);
    targets.value[index] = { ...target, lastIncidentId: newIncidentId };
  }
};

const handleEvent = (event) => {
  if (event.type === "check.completed") {
    applyCheckEvent(event);
    return;
  }
  if (event.type.startsWith("incident.")) {
    applyIncidentEvent(event);
  }
};

let unsubscribe = null;
onMounted(async () => {
  await refreshDashboard();
  await loadGroups();
  unsubscribe = onSse(handleEvent);
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
  if (refreshTimer) clearTimeout(refreshTimer);
});
</script>
