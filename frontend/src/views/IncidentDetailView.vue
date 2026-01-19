<template>
  <section class="panel">
    <div v-if="loading">{{ t("incident.loading") }}</div>
    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
    <template v-else>
      <div class="panel-header">
        <div>
          <h2>{{ incident.target.name }}</h2>
          <div class="panel-sub">
            <a class="link link-sub" :href="incident.target.url" target="_blank" rel="noreferrer">{{ incident.target.url }}</a>
          </div>
        </div>
        <div class="badges">
          <span :class="badgeClass(incident.status)">{{ incident.status }}</span>
          <span :class="badgeClass(incident.severity)">{{ incident.severity }}</span>
        </div>
      </div>
      <div class="detail-grid">
        <div>
          <div class="detail-label">{{ t("incident.opened") }}</div>
          <div>{{ formatDate(incident.openedAt) }}</div>
        </div>
        <div>
          <div class="detail-label">{{ t("incident.lastSeen") }}</div>
          <div>{{ formatDate(incident.lastSeenAt) }}</div>
        </div>
        <div>
          <div class="detail-label">{{ t("incident.confidence") }}</div>
          <div>{{ incident.confidence || 0 }}%</div>
        </div>
        <div>
          <div class="detail-label">{{ t("incident.acknowledgedBy") }}</div>
          <div>{{ incident.acknowledgedBy ? incident.acknowledgedBy.name : "-" }}</div>
        </div>
      </div>
    </template>
  </section>

  <section v-if="incident" class="grid-two">
    <div class="panel">
      <div class="panel-header">
        <h3>{{ t("incident.evidenceBefore") }}</h3>
      </div>
      <img v-if="beforeCheck?.screenshotPath" class="evidence" :src="`/evidence/${beforeCheck.screenshotPath}`" />
      <div v-else class="muted">{{ t("incident.noPriorScreenshot") }}</div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h3>{{ t("incident.evidenceAfter") }}</h3>
      </div>
      <img
        v-if="incident?.latestCheckResult?.screenshotPath"
        class="evidence"
        :src="`/evidence/${incident.latestCheckResult.screenshotPath}`"
      />
      <div v-else class="muted">{{ t("incident.noScreenshot") }}</div>
    </div>
  </section>

  <section v-if="incident" class="panel">
    <div class="panel-header">
      <h3>{{ t("incident.reasons") }}</h3>
    </div>
    <ul class="reason-list">
      <li v-if="!incident.reasonsJson || incident.reasonsJson.length === 0" class="muted">
        {{ t("incident.noReasons") }}
      </li>
      <li v-for="reason in incident.reasonsJson" :key="reason">{{ reason }}</li>
    </ul>
    <div v-if="incident.latestCheckResult?.extractedText" class="text-snippet">
      <div class="detail-label">{{ t("incident.extractedText") }}</div>
      <pre>{{ incident.latestCheckResult.extractedText.slice(0, 800) }}</pre>
    </div>
    <div v-if="incident.latestCheckResult?.htmlSnapshotPath" class="text-snippet">
      <div class="detail-label">{{ t("incident.htmlSnapshot") }}</div>
      <a class="link" :href="`/evidence/${incident.latestCheckResult.htmlSnapshotPath}`" target="_blank" rel="noreferrer"
        >{{ t("incident.openSnapshot") }}</a
      >
    </div>
  </section>

  <section v-if="incident" class="panel">
    <div class="panel-header">
      <h3>{{ t("incident.actions") }}</h3>
    </div>
    <div v-if="canAct">
      <div class="action-row">
        <button v-if="incident.status !== 'ACK'" class="btn btn-primary" type="button" @click="ackIncident">
          {{ t("actions.acknowledge") }}
        </button>
        <button v-if="incident.status !== 'CLOSED'" class="btn btn-ghost" type="button" @click="closeIncident">
          {{ t("actions.closeIncident") }}
        </button>
        <button v-if="isAdmin" class="btn btn-danger" type="button" @click="deleteIncident">
          {{ t("actions.delete") }}
        </button>
      </div>
      <form class="form" @submit.prevent="saveComment">
        <label>{{ t("incident.commentLabel") }}</label>
        <textarea v-model="notes" rows="4"></textarea>
        <button class="btn btn-ghost" type="submit">{{ t("actions.saveComment") }}</button>
      </form>
    </div>
    <div v-else class="muted">{{ t("incident.noPermission") }}</div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiRequest } from "../services/api.js";
import { onSse } from "../services/sse.js";
import { t } from "../services/i18n.js";
import { badgeClass, formatDate } from "../services/ui.js";
import { session } from "../stores/session.js";

const route = useRoute();
const router = useRouter();
const id = computed(() => route.params.id);
const incident = ref(null);
const beforeCheck = ref(null);
const notes = ref("");
const loading = ref(true);
const error = ref("");
const canAct = computed(() => session.user && ["SUPER_ADMIN", "OPERATOR"].includes(session.user.role));
const isAdmin = computed(() => session.user && session.user.role === "SUPER_ADMIN");

const loadIncident = async () => {
  loading.value = true;
  error.value = "";
  try {
    const data = await apiRequest(`/api/incidents/${id.value}`);
    incident.value = data.incident;
    beforeCheck.value = data.beforeCheck;
    notes.value = data.incident.notes || "";
  } catch (err) {
    error.value = err.message || t("incident.error");
  } finally {
    loading.value = false;
  }
};

const ackIncident = async () => {
  await apiRequest(`/api/incidents/${id.value}/ack`, { method: "POST" });
  await loadIncident();
};

const closeIncident = async () => {
  await apiRequest(`/api/incidents/${id.value}/close`, { method: "POST" });
  await loadIncident();
};

const deleteIncident = async () => {
  if (!confirm(t("confirm.deleteIncident"))) return;
  await apiRequest(`/api/incidents/${id.value}`, { method: "DELETE" });
  router.push("/incidents");
};

const saveComment = async () => {
  await apiRequest(`/api/incidents/${id.value}/comment`, {
    method: "POST",
    body: { notes: notes.value }
  });
  await loadIncident();
};

const handleEvent = (event) => {
  if (event && event.type && event.type.startsWith("incident.") && event.incidentId === id.value) {
    loadIncident();
  }
};

let unsubscribe = null;
onMounted(() => {
  loadIncident();
  unsubscribe = onSse(handleEvent);
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
});
</script>
