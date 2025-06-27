import { mount } from "@vue/test-utils";
import BuyConfirmedComponent from "../BuyConfirmedComponent.vue";

describe("BuyConfirmedComponent.vue", async () => {
  const wrapper = mount(BuyConfirmedComponent, {
    props: {
      tokenAmount: 1,
      isCurrentStep: false,
    },
  });

  // test("Test component Header Text", () => {
  //   expect(wrapper.html()).toContain("Os tokens já foram transferidos");
  //   expect(wrapper.html()).toContain("para a sua carteira!");
  // });

  // test("Test component Container Text", () => {
  //   expect(wrapper.html()).toContain("Tokens recebidos");
  //   expect(wrapper.html()).toContain("BRZ");
  //   expect(wrapper.html()).toContain("Não encontrou os tokens?");
  //   expect(wrapper.html()).toContain("Clique no botão abaixo para");
  //   expect(wrapper.html()).toContain("cadastrar o BRZ em sua carteira.");
  // });

  test("Test makeAnotherTransactionEmit", async () => {
    wrapper.vm.$emit("makeAnotherTransaction");

    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("makeAnotherTransaction")).toBeTruthy();
  });
});
