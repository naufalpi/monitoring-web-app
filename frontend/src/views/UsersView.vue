<template>
  <section class="panel">
    <div v-if="!isAdmin" class="alert alert-error">{{ t("users.accessDenied") }}</div>
    <template v-else>
      <div class="panel-header">
        <h2>{{ t("users.title") }}</h2>
        <span class="panel-sub">{{ t("users.subtitle") }}</span>
      </div>
      <form class="form form-grid" @submit.prevent="createUser">
        <div>
          <label>{{ t("fields.name") }}</label>
          <input v-model="newUser.name" required />
        </div>
        <div>
          <label>{{ t("fields.email") }}</label>
          <input v-model="newUser.email" type="email" required />
        </div>
        <div>
          <label>{{ t("fields.role") }}</label>
          <select v-model="newUser.role">
            <option value="VIEWER">{{ t("roles.viewer") }}</option>
            <option value="OPERATOR">{{ t("roles.operator") }}</option>
            <option value="SUPER_ADMIN">{{ t("roles.super_admin") }}</option>
          </select>
        </div>
        <div>
          <label>{{ t("fields.password") }}</label>
          <input v-model="newUser.password" type="password" required />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{{ t("users.addUser") }}</button>
        </div>
      </form>
    </template>
  </section>

  <section v-if="isAdmin" class="panel">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>{{ t("table.user") }}</th>
            <th>{{ t("table.role") }}</th>
            <th>{{ t("table.active") }}</th>
            <th>{{ t("table.created") }}</th>
            <th>{{ t("table.update") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td colspan="5">{{ t("empty.users") }}</td>
          </tr>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="cell-title">{{ user.name }}</div>
              <div class="cell-sub">{{ user.email }}</div>
            </td>
            <td>
              <select v-model="user.role">
                <option value="VIEWER">{{ t("roles.viewer") }}</option>
                <option value="OPERATOR">{{ t("roles.operator") }}</option>
                <option value="SUPER_ADMIN">{{ t("roles.super_admin") }}</option>
              </select>
            </td>
            <td>
              <select v-model="user.isActive">
                <option :value="true">{{ t("table.active") }}</option>
                <option :value="false">{{ t("status.disabled") }}</option>
              </select>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <input
                v-model="passwordDrafts[user.id]"
                type="password"
                :placeholder="t('users.newPassword')"
              />
              <button class="btn btn-ghost" type="button" @click="updateUser(user)">
                {{ t("actions.save") }}
              </button>
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
import { formatDate } from "../services/ui.js";
import { session } from "../stores/session.js";

const users = ref([]);
const passwordDrafts = reactive({});
const isAdmin = computed(() => session.user && session.user.role === "SUPER_ADMIN");
const page = ref(1);
const pageSize = ref("all");
const pageSizeOptions = [20, 50, 100, "all"];
const total = ref(0);

const newUser = reactive({
  name: "",
  email: "",
  role: "VIEWER",
  password: ""
});

const loadUsers = async () => {
  const params = new URLSearchParams({
    page: String(page.value),
    limit: String(pageSize.value)
  });
  const data = await apiRequest(`/api/users?${params.toString()}`);
  users.value = data.users || [];
  total.value = data.total || 0;
  if (!isAllPageSize(pageSize.value)) {
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (total.value > 0 && page.value > maxPage) {
      page.value = maxPage;
      await loadUsers();
    }
  }
};

const createUser = async () => {
  try {
    await apiRequest("/api/users", { method: "POST", body: newUser });
    newUser.name = "";
    newUser.email = "";
    newUser.role = "VIEWER";
    newUser.password = "";
    page.value = 1;
    await loadUsers();
  } catch (error) {
    alert(error.message);
  }
};

const updateUser = async (user) => {
  try {
    await apiRequest(`/api/users/${user.id}`, {
      method: "PATCH",
      body: {
        role: user.role,
        isActive: user.isActive,
        password: passwordDrafts[user.id] || ""
      }
    });
    passwordDrafts[user.id] = "";
    await loadUsers();
  } catch (error) {
    alert(error.message);
  }
};

const changePage = (nextPage) => {
  page.value = nextPage;
  loadUsers();
};

const changePageSize = (nextPageSize) => {
  pageSize.value = normalizePageSize(nextPageSize);
  page.value = 1;
  loadUsers();
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
  if (isAdmin.value) {
    loadUsers();
  }
});
</script>
