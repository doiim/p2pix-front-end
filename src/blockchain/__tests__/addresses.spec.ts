import { expectTypeOf, it, expect } from "vitest";
import {
  getTokenAddress,
  getP2PixAddress,
  getProviderUrl,
  isPossibleNetwork,
} from "../addresses";

import { setActivePinia, createPinia } from "pinia";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";
import { useUser } from "@/composables/useUser";

describe("addresses.ts types", () => {
  it("My addresses.ts types work properly", () => {
    expectTypeOf(getTokenAddress).toBeFunction();
    expectTypeOf(getP2PixAddress).toBeFunction();
    expectTypeOf(getProviderUrl).toBeFunction();
    expectTypeOf(isPossibleNetwork).toBeFunction();
  });
});

describe("addresses.ts functions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("getTokenAddress Ethereum", () => {
    const user = useUser();
    user.setNetworkId(NetworkEnum.sepolia);
    expect(getTokenAddress(TokenEnum.BRZ)).toBe(
      "0x4A2886EAEc931e04297ed336Cc55c4eb7C75BA00"
    );
  });

  it("getTokenAddress Rootstock", () => {
    const user = useUser();
    user.setNetworkId(NetworkEnum.rootstock);
    expect(getTokenAddress(TokenEnum.BRZ)).toBe(
      "0xfE841c74250e57640390f46d914C88d22C51e82e"
    );
  });

  it("getTokenAddress Default", () => {
    expect(getTokenAddress(TokenEnum.BRZ)).toBe(
      "0x4A2886EAEc931e04297ed336Cc55c4eb7C75BA00"
    );
  });

  it("getP2PixAddress Ethereum", () => {
    const user = useUser();
    user.setNetworkId(NetworkEnum.sepolia);
    expect(getP2PixAddress()).toBe(
      "0x2414817FF64A114d91eCFA16a834d3fCf69103d4"
    );
  });

  it("getP2PixAddress Rootstock", () => {
    const user = useUser();
    user.setNetworkId(NetworkEnum.rootstock);
    expect(getP2PixAddress()).toBe(
      "0x98ba35eb14b38D6Aa709338283af3e922476dE34"
    );
  });

  it("getP2PixAddress Default", () => {
    expect(getP2PixAddress()).toBe(
      "0x2414817FF64A114d91eCFA16a834d3fCf69103d4"
    );
  });

  it("getProviderUrl Ethereum", () => {
    const user = useUser();
    user.setNetworkId(NetworkEnum.sepolia);
    expect(getProviderUrl()).toBe(import.meta.env.VITE_GOERLI_API_URL);
  });

  it("getProviderUrl Rootstock", () => {
    const user = useUser();
    user.setNetworkId(NetworkEnum.rootstock);
    expect(getProviderUrl()).toBe(import.meta.env.VITE_ROOTSTOCK_API_URL);
  });

  it("getProviderUrl Default", () => {
    expect(getProviderUrl()).toBe(import.meta.env.VITE_GOERLI_API_URL);
  });

  it("isPossibleNetwork Returns", () => {
    const user = useUser();
    user.setNetworkId(NetworkEnum.sepolia);
    expect(isPossibleNetwork(0x5 as NetworkEnum)).toBe(true);
    expect(isPossibleNetwork(5 as NetworkEnum)).toBe(true);
    expect(isPossibleNetwork(0x13881 as NetworkEnum)).toBe(true);
    expect(isPossibleNetwork(80001 as NetworkEnum)).toBe(true);

    expect(isPossibleNetwork(NaN as NetworkEnum)).toBe(false);
    expect(isPossibleNetwork(0x55 as NetworkEnum)).toBe(false);
  });
});
