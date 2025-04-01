import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ListingComponent from "../ListingComponent.vue";
import SpinnerComponent from "../../SpinnerComponent.vue";
import { useUser } from "@/composables/useUser";
import { MockValidDeposits } from "@/model/mock/ValidDepositMock";
import { MockWalletTransactions } from "@/model/mock/WalletTransactionMock";

describe("ListingComponent.vue", () => {
  beforeEach(() => {
    useUser().setLoadingWalletTransactions(false);
  });

  test("Test Message when an empty array is received", () => {
    const wrapper = mount(ListingComponent, {
      props: {
        validDeposits: [],
        walletTransactions: [],
        activeLockAmount: 0,
      },
    });

    expect(wrapper.html()).toContain("Não há nenhuma transação anterior");
  });

  test("Test number of elements in the list first render", () => {
    const wrapper = mount(ListingComponent, {
      props: {
        validDeposits: [],
        walletTransactions: MockWalletTransactions,
        activeLockAmount: 0,
      },
    });

    const elements = wrapper.findAll(".item-container");

    expect(elements).toHaveLength(3);
  });

  test("Test load more button behavior", async () => {
    const wrapper = mount(ListingComponent, {
      props: {
        validDeposits: MockValidDeposits,
        walletTransactions: MockWalletTransactions,
        activeLockAmount: 0,
      },
    });
    const btn = wrapper.find("button");

    let elements = wrapper.findAll(".item-container");
    expect(elements).toHaveLength(3);

    await btn.trigger("click");

    elements = wrapper.findAll(".item-container");

    expect(elements).toHaveLength(5);
  });

  test("Test withdraw offer button emit", async () => {
    const wrapper = mount(ListingComponent, {
      props: {
        validDeposits: MockValidDeposits,
        walletTransactions: MockWalletTransactions,
        activeLockAmount: 0,
      },
    });
    wrapper.vm.$emit("depositWithdrawn");

    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("depositWithdrawn")).toBeTruthy();
  });

  test("Test should render lock info when active lock amount is greater than 0", () => {
    const wrapper = mount(ListingComponent, {
      props: {
        validDeposits: MockValidDeposits,
        walletTransactions: [],
        activeLockAmount: 50,
      },
    });

    expect(wrapper.html()).toContain("com 50.00 BRZ em lock");
  });
});
