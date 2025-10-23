import { createRouter, createWebHistory, createWebHashHistory } from "vue-router";
import HomeView from "@/views/HomeView.vue";
import FaqView from "@/views/FaqView.vue";
import ManageBidsView from "@/views/ManageBidsView.vue";
import SellerView from "@/views/SellerView.vue";
import ExploreView from "@/views/ExploreView.vue";

const router = createRouter({
  history: import.meta.env.MODE === 'production' && import.meta.env.BASE_URL === './' 
    ? createWebHashHistory() 
    : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      props: true,
    },
    {
      path: "/:lockID",
      name: "redirect buy",
      component: HomeView,
    },
    {
      path: "/seller",
      name: "seller",
      component: SellerView,
    },
    {
      path: "/manage_bids",
      name: "manage bids",
      component: ManageBidsView,
    },
    {
      path: "/faq",
      name: "faq",
      component: FaqView,
    },
    {
      path: "/explore",
      name: "explore",
      component: ExploreView,
    },
  ],
});

export default router;
