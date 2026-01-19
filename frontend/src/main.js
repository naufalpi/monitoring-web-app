import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import "./assets/app.css";
import { loadSessionSafe, session } from "./stores/session.js";
import { startSse, stopSse } from "./services/sse.js";

async function bootstrap() {
  await loadSessionSafe();

  const app = createApp(App);
  app.use(router);
  app.mount("#app");

  if (session.user) {
    startSse();
  }

  window.addEventListener("app:unauthorized", () => {
    stopSse();
    if (router.currentRoute.value.name !== "login") {
      router.push({ name: "login" });
    }
  });
}

bootstrap();
