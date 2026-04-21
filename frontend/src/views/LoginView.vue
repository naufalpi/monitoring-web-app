<template>
  <div class="auth-shell">
    <section class="auth-card">
      <div class="auth-language">
        <select v-model="currentLocale" class="select" :aria-label="t('nav.language')">
          <option value="id">ID</option>
          <option value="en">EN</option>
        </select>
      </div>
      <div class="auth-grid">
        <div class="auth-brand">
          <img class="auth-logo" src="/images/logo.png" alt="Kominfo" />
          <div class="auth-brand-text">
            <div class="auth-brand-title">Banjarnegara Watch</div>
            <div class="auth-brand-sub">{{ t("brand.subtitle") }}</div>
          </div>
        </div>
        <div class="auth-panel">
          <div>
            <h2>{{ t("login.title") }}</h2>
            <div class="panel-sub">{{ t("login.subtitle") }}</div>
          </div>
          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <form class="form auth-form" @submit.prevent="submit">
            <label>{{ t("login.email") }}</label>
            <input v-model="email" type="email" autocomplete="username" required />
            <label>{{ t("login.password") }}</label>
            <input v-model="password" type="password" autocomplete="current-password" required />
            <button class="btn btn-primary" type="submit" :disabled="loading">{{ t("login.submit") }}</button>
          </form>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiRequest } from "../services/api.js";
import { locale, setLocale, t } from "../services/i18n.js";
import { loadSessionSafe, session } from "../stores/session.js";
import { startSse } from "../services/sse.js";

const router = useRouter();
const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");
const currentLocale = computed({
  get: () => locale.value,
  set: (value) => setLocale(value)
});

onMounted(async () => {
  if (!session.csrfToken) {
    await loadSessionSafe();
  }
});

const submit = async () => {
  error.value = "";
  loading.value = true;
  try {
    await apiRequest("/api/login", {
      method: "POST",
      body: { email: email.value.trim(), password: password.value },
      skipAuthRedirect: true
    });
    await loadSessionSafe();
    startSse();
    router.push({ name: "dashboard" });
  } catch (err) {
    error.value = err.message || t("login.error");
  } finally {
    loading.value = false;
  }
};
</script>
