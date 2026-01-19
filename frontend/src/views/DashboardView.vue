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

  <section class="grid-two grid-2-3">
    <div class="panel">
      <div class="panel-header">
        <h2>{{ t("dashboard.monitoredTargets") }}</h2>
        <span class="panel-sub">{{ t("dashboard.liveStatus") }}</span>
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
            <tr v-if="targets.length === 0">
              <td colspan="5">{{ t("empty.targets") }}</td>
            </tr>
            <tr v-for="target in targets" :key="target.id">
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
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>{{ t("dashboard.incidentFeed") }}</h2>
        <span class="panel-sub">{{ t("dashboard.latestActivity") }}</span>
      </div>
      <div class="timeline">
        <div v-if="incidents.length === 0" class="timeline-item">
          {{ t("empty.incidents") }}
        </div>
        <div
          v-for="incident in incidents"
          :key="incident.id"
          class="timeline-item"
        >
          <div
            class="timeline-dot"
            :class="`severity-${incident.severity.toLowerCase()}`"
          ></div>
          <div class="timeline-content">
            <div class="timeline-title">
              <RouterLink :to="`/incidents/${incident.id}`">{{
                incident.target.name
              }}</RouterLink>
            </div>
            <div class="timeline-meta">
              <div class="timeline-badges">
                <span :class="badgeClass(incident.status)">{{
                  incident.status
                }}</span>
                <span :class="badgeClass(incident.severity)">{{
                  incident.severity
                }}</span>
              </div>
              <span class="timeline-time">{{ formatDate(incident.openedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
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
const incidents = ref([]);

const statusByTarget = new Map();
const incidentByTarget = new Map();
let refreshTimer = null;
let incidentRefreshTimer = null;
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

const renderIncidents = (data) => {
  incidents.value = data;
};

const refreshDashboard = async () => {
  if (refreshInFlight) {
    refreshQueued = true;
    return;
  }
  refreshInFlight = true;
  try {
    const [summaryRes, targetsRes, incidentsRes] = await Promise.all([
      apiRequest("/api/summary"),
      apiRequest("/api/targets"),
      apiRequest("/api/incidents?limit=8"),
    ]);
    renderSummary(summaryRes);
    renderTargets(targetsRes.targets || []);
    renderIncidents(incidentsRes.incidents || []);
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

const scheduleIncidentRefresh = () => {
  if (incidentRefreshTimer) return;
  incidentRefreshTimer = setTimeout(async () => {
    incidentRefreshTimer = null;
    try {
      const data = await apiRequest("/api/incidents?limit=8");
      renderIncidents(data.incidents || []);
    } catch (error) {
      // Ignore.
    }
  }, 1500);
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
    scheduleIncidentRefresh();
  }
};

let unsubscribe = null;
onMounted(async () => {
  await refreshDashboard();
  unsubscribe = onSse(handleEvent);
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
  if (refreshTimer) clearTimeout(refreshTimer);
  if (incidentRefreshTimer) clearTimeout(incidentRefreshTimer);
});
</script>
