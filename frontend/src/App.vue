<template>
  <div>
    <Topbar v-if="session.user" :user="session.user" />
    <main class="container">
      <RouterView />
    </main>
    <FooterBar />
  </div>
</template>

<script setup>
import { session } from "./stores/session.js";
import Topbar from "./components/Topbar.vue";
import FooterBar from "./components/FooterBar.vue";
</script>
