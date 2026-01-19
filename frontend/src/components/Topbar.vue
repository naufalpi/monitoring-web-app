<template>
  <header class="topbar">
    <div class="brand">
      <img class="brand-logo" src="/images/logo.png" alt="Kominfo" />
      <div>
        <div class="brand-name">Banjarnegara Watch</div>
        <div class="brand-sub">{{ t("brand.subtitle") }}</div>
      </div>
    </div>
    <nav class="nav">
      <RouterLink class="nav-link" :class="{ 'is-active': isActive('/') }" to="/">{{
        t("nav.dashboard")
      }}</RouterLink>
      <RouterLink class="nav-link" :class="{ 'is-active': isActive('/targets') }" to="/targets"
        >{{ t("nav.targets") }}</RouterLink
      >
      <RouterLink class="nav-link" :class="{ 'is-active': isActive('/incidents') }" to="/incidents"
        >{{ t("nav.incidents") }}</RouterLink
      >
      <RouterLink
        v-if="user.role === 'SUPER_ADMIN'"
        class="nav-link"
        :class="{ 'is-active': isActive('/users') }"
        to="/users"
        >{{ t("nav.users") }}</RouterLink
      >
    </nav>
    <div class="nav-meta">
      <div class="nav-language">
        <select v-model="currentLocale" class="select" :aria-label="t('nav.language')">
          <option value="id">ID</option>
          <option value="en">EN</option>
        </select>
      </div>
      <div class="nav-user">
        <span>{{ user.name }}</span>
        {{ roleLabel(user.role) }}
      </div>
      <button class="btn btn-ghost" type="button" @click="logout">{{ t("nav.logout") }}</button>
    </div>
  </header>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiRequest } from "../services/api.js";
import { locale, setLocale, t } from "../services/i18n.js";
import { clearSession } from "../stores/session.js";
import { stopSse } from "../services/sse.js";

const props = defineProps({
  user: { type: Object, required: true }
});

const route = useRoute();
const router = useRouter();
const currentLocale = computed({
  get: () => locale.value,
  set: (value) => setLocale(value)
});

const isActive = (path) => {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
};

const roleLabel = (role) => {
  const key = `roles.${String(role || "").toLowerCase()}`;
  const translated = t(key);
  return translated === key ? role : translated;
};

const logout = async () => {
  await apiRequest("/api/logout", { method: "POST" }).catch(() => {});
  stopSse();
  clearSession();
  router.push({ name: "login" });
};
</script>
