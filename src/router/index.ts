import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import MockView from "../views/MockView.vue";
import ListView from "../components/ListComponent.vue";
import SellerView from "@/views/SellerView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/seller",
      name: "seller",
      component: SellerView,
    },
    {
      path: "/mock",
      name: "mock",
      component: MockView,
    },
    {
      path: "/list",
      name: "list",
      component: ListView,
    },
  ],
});

export default router;
