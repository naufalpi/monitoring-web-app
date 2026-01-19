import { createRouter, createWebHistory } from "vue-router";
import { session } from "../stores/session.js";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import TargetsView from "../views/TargetsView.vue";
import IncidentsView from "../views/IncidentsView.vue";
import IncidentDetailView from "../views/IncidentDetailView.vue";
import UsersView from "../views/UsersView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView },
    { path: "/", name: "dashboard", component: DashboardView, meta: { requiresAuth: true } },
    { path: "/targets", name: "targets", component: TargetsView, meta: { requiresAuth: true } },
    { path: "/incidents", name: "incidents", component: IncidentsView, meta: { requiresAuth: true } },
    {
      path: "/incidents/:id",
      name: "incident-detail",
      component: IncidentDetailView,
      meta: { requiresAuth: true }
    },
    { path: "/users", name: "users", component: UsersView, meta: { requiresAuth: true } }
  ]
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !session.user) {
    return { name: "login" };
  }
  if (to.name === "login" && session.user) {
    return { name: "dashboard" };
  }
  return true;
});

export default router;
