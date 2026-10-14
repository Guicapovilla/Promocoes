import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pickAmazonPrice } from "./amazon";
import { shopeeAuthHeader, shopeeNodePrice } from "./shopee";

describe("shopee", () => {
  it("assina SHA256(appId + timestamp + payload + secret)", () => {
    const h = shopeeAuthHeader("123", "segredo", '{"query":"{x}"}', 1700000000);
    const sig = createHash("sha256").update('1231700000000{"query":"{x}"}segredo').digest("hex");
    expect(h).toBe(`SHA256 Credential=123, Timestamp=1700000000, Signature=${sig}`);
  });
  it("lê price (string) ou cai para priceMin", () => {
    expect(shopeeNodePrice({ price: "2499.90" })).toBe(2499.9);
    expect(shopeeNodePrice({ priceMin: "10.5" })).toBe(10.5);
    expect(shopeeNodePrice({ price: "0" })).toBeNull();
    expect(shopeeNodePrice(undefined)).toBeNull();
  });
});

describe("amazon", () => {
  const l = (amount: number, extra = {}) => ({ condition: { value: "New" }, availability: { type: "IN_STOCK" }, price: { money: { amount } }, ...extra });
  it("prefere a oferta da buybox", () => {
    expect(pickAmazonPrice([l(100), l(120, { isBuyBoxWinner: true })])).toBe(120);
  });
  it("ignora usados e sem estoque; devolve null sem oferta", () => {
    expect(pickAmazonPrice([l(50, { condition: { value: "Used" } }), l(60, { availability: { type: "OUT_OF_STOCK" } })])).toBeNull();
    expect(pickAmazonPrice(null)).toBeNull();
  });
});
