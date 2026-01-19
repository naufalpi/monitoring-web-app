<template>
  <footer class="footer">
    <div class="footer-inner">
      <img class="footer-logo" src="/images/logo.png" alt="Kominfo" />
      <span>{{ t("footer.developedBy") }}</span>
    </div>
  </footer>
</template>

<script setup>
import { t } from "../services/i18n.js";
</script>
