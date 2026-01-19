<template>
  <section class="panel">
    <div class="panel-header">
      <h2>{{ t("targets.title") }}</h2>
      <span class="panel-sub">{{ t("targets.subtitle") }}</span>
    </div>
    <div v-if="!canManage" class="muted">{{ t("targets.permission") }}</div>
    <form v-else class="form form-grid" @submit.prevent="saveTarget">
      <input type="hidden" />
      <div>
        <label>{{ t("fields.name") }}</label>
        <input v-model="form.name" required />
      </div>
      <div>
        <label>{{ t("fields.url") }}</label>
        <input v-model="form.url" type="url" required />
      </div>
      <div>
        <label>{{ t("fields.group") }}</label>
        <input v-model="form.group" />
      </div>
      <div>
        <label>{{ t("fields.interval") }}</label>
        <input v-model.number="form.intervalSec" type="number" min="30" />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">{{ t("actions.save") }}</button>
        <button v-if="editingId" class="btn btn-ghost" type="button" @click="resetForm">
          {{ t("actions.cancel") }}
        </button>
      </div>
    </form>
  </section>

  <section class="panel">
    <div class="filter-row filter-row--compact">
      <div>
        <label>{{ t("filters.group") }}</label>
        <select v-model="groupFilter" @change="applyGroupFilter">
          <option value="">{{ t("filters.all") }}</option>
          <option v-for="group in groups" :key="group" :value="group">{{ group }}</option>
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
            <th>{{ t("table.interval") }}</th>
            <th>{{ t("table.enabled") }}</th>
            <th>{{ t("table.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="targets.length === 0">
            <td colspan="6">{{ t("empty.targets") }}</td>
          </tr>
          <tr v-for="target in targets" :key="target.id">
            <td>
              <div class="cell-title">{{ target.name }}</div>
              <div class="cell-sub">
                <a class="link link-sub" :href="target.url" target="_blank" rel="noreferrer">{{ target.url }}</a>
              </div>
              <div v-if="target.group" class="cell-sub-meta">{{ target.group }}</div>
            </td>
            <td><span :class="badgeClass(target.status)">{{ target.status || "UNKNOWN" }}</span></td>
            <td>{{ formatDate(target.lastCheck) }}</td>
            <td>{{ target.intervalSec || 60 }}s</td>
            <td>{{ target.isEnabled ? t("misc.yes") : t("misc.no") }}</td>
            <td>
              <template v-if="canManage">
                <button class="btn btn-ghost" type="button" @click="editTarget(target)">
                  {{ t("actions.edit") }}
                </button>
                <button class="btn btn-ghost" type="button" @click="toggleTarget(target)">
                  {{ target.isEnabled ? t("actions.disable") : t("actions.enable") }}
                </button>
              </template>
              <span v-else class="muted">{{ t("targets.readOnly") }}</span>
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
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiRequest } from "../services/api.js";
import PaginationBar from "../components/PaginationBar.vue";
import { t } from "../services/i18n.js";
import { badgeClass, formatDate } from "../services/ui.js";
import { session } from "../stores/session.js";

const form = reactive({
  name: "",
  url: "",
  group: "",
  intervalSec: 60
});
const targets = ref([]);
const groups = ref([]);
const groupFilter = ref("");
const editingId = ref(null);
const canManage = computed(() => Boolean(session.capabilities?.canManageTargets));
const page = ref(1);
const pageSize = ref("all");
const pageSizeOptions = [20, 50, 100, "all"];
const total = ref(0);

const resetForm = () => {
  editingId.value = null;
  form.name = "";
  form.url = "";
  form.group = "";
  form.intervalSec = 60;
};

const loadTargets = async () => {
  const params = new URLSearchParams({
    page: String(page.value),
    limit: String(pageSize.value)
  });
  if (groupFilter.value) {
    params.set("group", groupFilter.value);
  }
  const data = await apiRequest(`/api/targets?${params.toString()}`);
  targets.value = data.targets || [];
  total.value = data.total || 0;
  if (!isAllPageSize(pageSize.value)) {
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (total.value > 0 && page.value > maxPage) {
      page.value = maxPage;
      await loadTargets();
    }
  }
};

const loadGroups = async () => {
  try {
    const data = await apiRequest("/api/targets/groups");
    groups.value = data.groups || [];
  } catch (error) {
    groups.value = [];
  }
};

const applyGroupFilter = () => {
  page.value = 1;
  loadTargets();
};

const saveTarget = async () => {
  const payload = {
    name: form.name.trim(),
    url: form.url.trim(),
    group: form.group.trim(),
    intervalSec: form.intervalSec || 60,
    isEnabled: true
  };
  const existing = targets.value.find((target) => target.id === editingId.value);
  if (existing) {
    payload.isEnabled = existing.isEnabled;
  }

  try {
    const isEditing = Boolean(editingId.value);
    if (isEditing) {
      await apiRequest(`/api/targets/${editingId.value}`, {
        method: "PATCH",
        body: payload
      });
    } else {
      await apiRequest("/api/targets", { method: "POST", body: payload });
    }
    resetForm();
    if (!isEditing) {
      page.value = 1;
    }
    await loadTargets();
    await loadGroups();
  } catch (error) {
    alert(error.message);
  }
};

const editTarget = (target) => {
  editingId.value = target.id;
  form.name = target.name;
  form.url = target.url;
  form.group = target.group || "";
  form.intervalSec = target.intervalSec || 60;
};

const toggleTarget = async (target) => {
  try {
    await apiRequest(`/api/targets/${target.id}`, {
      method: "PATCH",
      body: {
        name: target.name,
        url: target.url,
        group: target.group || "",
        intervalSec: target.intervalSec || 60,
        isEnabled: !target.isEnabled
      }
    });
    await loadTargets();
    await loadGroups();
  } catch (error) {
    alert(error.message);
  }
};

const changePage = (nextPage) => {
  page.value = nextPage;
  loadTargets();
};

const changePageSize = (nextPageSize) => {
  pageSize.value = normalizePageSize(nextPageSize);
  page.value = 1;
  loadTargets();
};

function normalizePageSize(value) {
  if (value === "all") return "all";
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "all";
}

function isAllPageSize(value) {
  return String(value).toLowerCase() === "all";
}

onMounted(() => {
  loadGroups();
  loadTargets();
});
</script>
