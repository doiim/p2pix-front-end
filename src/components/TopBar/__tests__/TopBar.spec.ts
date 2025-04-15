import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import TopBar from "../TopBar.vue";
import { useUser } from "@/composables/useUser";

import { createPinia, setActivePinia } from "pinia";

describe("TopBar.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should render connect wallet button", () => {
    const wrapper = mount(TopBar);
    expect(wrapper.html()).toContain("Conectar carteira");
  });

  it("should render button to change to seller view when in buyer screen", () => {
    const wrapper = mount(TopBar);
    expect(wrapper.html()).toContain("Quero vender");
  });

  it("should render button to change to seller view when in buyer screen", () => {
    const user = useUser();
    user.setSellerView(true);
    const wrapper = mount(TopBar);
    expect(wrapper.html()).toContain("Quero comprar");
  });

  it("should render the P2Pix logo correctly", () => {
    const wrapper = mount(TopBar);
    const img = wrapper.findAll(".logo");
    expect(img.length).toBe(2);
  });
});
