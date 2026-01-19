<template>
  <div class="incidents-layout">
    <div class="incidents-main">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>{{ t("incidents.title") }}</h2>
            <span class="panel-sub">{{ t("incidents.subtitle") }}</span>
          </div>
          <div class="panel-actions">
            <button v-if="isAdmin" class="btn btn-danger" type="button" @click="resetIncidents">
              {{ t("actions.reset") }}
            </button>
          </div>
        </div>
        <form class="filter-row" @submit.prevent="applyFilters">
          <div>
            <label>{{ t("filters.status") }}</label>
            <select v-model="filters.status">
              <option value="">{{ t("filters.all") }}</option>
              <option value="OPEN">{{ t("status.open") }}</option>
              <option value="ACK">{{ t("status.ack") }}</option>
              <option value="CLOSED">{{ t("status.closed") }}</option>
            </select>
          </div>
          <div>
            <label>{{ t("filters.severity") }}</label>
            <select v-model="filters.severity">
              <option value="">{{ t("filters.all") }}</option>
              <option value="LOW">{{ t("severity.low") }}</option>
              <option value="MEDIUM">{{ t("severity.medium") }}</option>
              <option value="HIGH">{{ t("severity.high") }}</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="btn btn-ghost" type="submit">{{ t("actions.filter") }}</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ t("table.target") }}</th>
                <th>{{ t("table.status") }}</th>
                <th>{{ t("table.severity") }}</th>
                <th>{{ t("table.opened") }}</th>
                <th>{{ t("table.lastSeen") }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="incidents.length === 0">
                <td colspan="6">{{ t("empty.incidents") }}</td>
              </tr>
              <tr v-for="incident in incidents" :key="incident.id">
                <td>
                  <div class="cell-title">{{ incident.target.name }}</div>
                  <div class="cell-sub">
                    <a class="link link-sub" :href="incident.target.url" target="_blank" rel="noreferrer">{{ incident.target.url }}</a>
                  </div>
                </td>
                <td><span :class="badgeClass(incident.status)">{{ incident.status }}</span></td>
                <td><span :class="badgeClass(incident.severity)">{{ incident.severity }}</span></td>
                <td>{{ formatDate(incident.openedAt) }}</td>
                <td>{{ formatDate(incident.lastSeenAt) }}</td>
                <td>
                  <RouterLink class="link" :to="`/incidents/${incident.id}`">{{ t("actions.details") }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <PaginationBar
          :page="page"
          :page-size="pageSize"
          :page-size-options="pageSizeOptions"
          :total="total"
          @update:page="changePage"
          @update:pageSize="changePageSize"
        />
      </section>
    </div>

    <aside class="incidents-side">
      <section class="panel panel-compact">
        <div class="panel-header panel-header--stack">
          <div>
            <h3>{{ t("incidents.pageSummaryTitle") }}</h3>
            <span class="panel-sub">{{ t("incidents.pageSummarySubtitle") }}</span>
          </div>
          <span class="panel-sub">{{ t("misc.refresh") }}: {{ lastFetchedAt ? formatDate(lastFetchedAt) : "-" }}</span>
        </div>
        <div class="stat-grid stat-grid--compact">
          <div class="stat">
            <div class="stat-label">Total</div>
            <div class="stat-value">{{ totalCount }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ t("status.open") }}</div>
            <div class="stat-value">{{ statusCounts.OPEN }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ t("status.ack") }}</div>
            <div class="stat-value">{{ statusCounts.ACK }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ t("status.closed") }}</div>
            <div class="stat-value">{{ statusCounts.CLOSED }}</div>
          </div>
        </div>
        <div class="split-line"></div>
        <div class="meta-row">
          <span class="meta-label">{{ t("filters.severity") }}</span>
          <div class="meta-tags">
            <span :class="badgeClass('LOW')">{{ severityCounts.LOW }}</span>
            <span :class="badgeClass('MEDIUM')">{{ severityCounts.MEDIUM }}</span>
            <span :class="badgeClass('HIGH')">{{ severityCounts.HIGH }}</span>
          </div>
        </div>
        <div class="meta-row">
          <span class="meta-label">{{ t("filters.label") }}</span>
          <div class="meta-tags">
            <span v-if="filters.status" :class="badgeClass(filters.status)">{{ statusLabel(filters.status) }}</span>
            <span v-if="filters.severity" :class="badgeClass(filters.severity)">{{
              severityLabel(filters.severity)
            }}</span>
            <span v-if="!hasFilters" class="muted">{{ t("filters.none") }}</span>
          </div>
        </div>
      </section>

      <section class="panel panel-compact">
        <div class="panel-header">
          <div>
            <h3>{{ t("incidents.topTargets") }}</h3>
            <span class="panel-sub">{{ t("incidents.topTargetsSubtitle") }}</span>
          </div>
        </div>
        <ul v-if="topTargets.length" class="info-list">
          <li v-for="target in topTargets" :key="target.id" class="info-list-item">
            <div class="info-list-content">
              <div class="cell-title">{{ target.name }}</div>
              <div class="cell-sub">
                <a class="link link-sub" :href="target.url" target="_blank" rel="noreferrer">{{ target.url }}</a>
              </div>
            </div>
            <span class="pill">{{ target.count }}</span>
          </li>
        </ul>
        <div v-else class="muted">{{ t("empty.data") }}</div>
      </section>

      <section class="panel panel-compact">
        <div class="panel-header">
          <div>
            <h3>{{ t("incidents.recentActivity") }}</h3>
            <span class="panel-sub">{{ t("incidents.recentActivitySubtitle") }}</span>
          </div>
        </div>
        <ul v-if="recentIncidents.length" class="activity-list">
          <li v-for="incident in recentIncidents" :key="incident.id" class="activity-item">
            <div class="activity-main">
              <div class="activity-title">{{ incident.target.name }}</div>
            </div>
            <div class="activity-meta">
              <span class="activity-time">{{ formatDate(incident.openedAt) }}</span>
              <span :class="badgeClass(incident.status)">{{ incident.status }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="muted">{{ t("empty.data") }}</div>
      </section>
    </aside>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiRequest } from "../services/api.js";
import PaginationBar from "../components/PaginationBar.vue";
import { onSse } from "../services/sse.js";
import { t } from "../services/i18n.js";
import { badgeClass, formatDate } from "../services/ui.js";
import { session } from "../stores/session.js";

const route = useRoute();
const router = useRouter();
const incidents = ref([]);
const filters = reactive({
  status: route.query.status || "",
  severity: route.query.severity || ""
});
const page = ref(parsePage(route.query.page));
const pageSize = ref(parsePageSize(route.query.limit));
const pageSizeOptions = [20, 50, 100, "all"];
const total = ref(0);
const lastFetchedAt = ref(null);
const isAdmin = computed(() => session.user && session.user.role === "SUPER_ADMIN");

const totalCount = computed(() => incidents.value.length);
const hasFilters = computed(() => Boolean(filters.status || filters.severity));
const statusCounts = computed(() => {
  const counts = { OPEN: 0, ACK: 0, CLOSED: 0 };
  for (const incident of incidents.value) {
    if (counts[incident.status] !== undefined) {
      counts[incident.status] += 1;
    }
  }
  return counts;
});
const severityCounts = computed(() => {
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const incident of incidents.value) {
    if (counts[incident.severity] !== undefined) {
      counts[incident.severity] += 1;
    }
  }
  return counts;
});
const topTargets = computed(() => {
  const map = new Map();
  for (const incident of incidents.value) {
    const target = incident.target || {};
    const key = target.id || target.url;
    if (!key) continue;
    const existing = map.get(key) || { id: key, name: target.name || "-", url: target.url || "-", count: 0 };
    existing.count += 1;
    map.set(key, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
});
const recentIncidents = computed(() => incidents.value.slice(0, 5));

const statusLabel = (value) => {
  const key = `status.${String(value || "").toLowerCase()}`;
  const translated = t(key);
  return translated === key ? value : translated;
};

const severityLabel = (value) => {
  const key = `severity.${String(value || "").toLowerCase()}`;
  const translated = t(key);
  return translated === key ? value : translated;
};

let refreshTimer = null;
let refreshInFlight = false;
let refreshQueued = false;

const applyFilters = () => {
  page.value = 1;
  pushQuery();
};

const changePage = (nextPage) => {
  page.value = nextPage;
  pushQuery();
};

const changePageSize = (nextPageSize) => {
  pageSize.value = normalizePageSize(nextPageSize);
  page.value = 1;
  pushQuery();
};

const pushQuery = () => {
  if (isAllPageSize(pageSize.value)) {
    page.value = 1;
  }
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  params.set("page", String(page.value));
  params.set("limit", String(pageSize.value));
  router.push({ path: "/incidents", query: Object.fromEntries(params.entries()) });
};

const resetIncidents = async () => {
  if (!isAdmin.value) return;
  const hasFilter = Boolean(filters.status || filters.severity);
  const message = hasFilter ? t("confirm.resetFiltered") : t("confirm.resetAll");
  if (!confirm(message)) return;

  try {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    const url = params.toString() ? `/api/incidents?${params}` : "/api/incidents";
    await apiRequest(url, { method: "DELETE" });
    page.value = 1;
    fetchIncidents();
  } catch (error) {
    alert(error.message);
  }
};

const fetchIncidents = async () => {
  if (refreshInFlight) {
    refreshQueued = true;
    return;
  }
  refreshInFlight = true;
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    params.set("page", String(page.value));
    params.set("limit", String(pageSize.value));
    const data = await apiRequest(`/api/incidents?${params.toString()}`);
    incidents.value = data.incidents || [];
    total.value = data.total || 0;
    lastFetchedAt.value = new Date();
    if (!isAllPageSize(pageSize.value)) {
      const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value));
      if (total.value > 0 && page.value > maxPage) {
        page.value = maxPage;
        pushQuery();
        return;
      }
    }
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
    fetchIncidents();
  }, 1200);
};

const handleEvent = (event) => {
  if (event && event.type && event.type.startsWith("incident.")) {
    scheduleRefresh();
  }
};

let unsubscribe = null;
onMounted(() => {
  fetchIncidents();
  unsubscribe = onSse(handleEvent);
});

watch(
  () => route.query,
  (query) => {
    filters.status = query.status || "";
    filters.severity = query.severity || "";
    page.value = parsePage(query.page);
    pageSize.value = parsePageSize(query.limit);
    if (isAllPageSize(pageSize.value)) {
      page.value = 1;
    }
    fetchIncidents();
  }
);

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
  if (refreshTimer) clearTimeout(refreshTimer);
});

function parsePage(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "all";
  if (String(raw).toLowerCase() === "all") return "all";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "all";
}

function normalizePageSize(value) {
  if (value === "all") return "all";
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "all";
}

function isAllPageSize(value) {
  return String(value).toLowerCase() === "all";
}
</script>
