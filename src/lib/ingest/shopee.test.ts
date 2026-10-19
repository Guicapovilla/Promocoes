import { describe, expect, it } from "vitest";
import { parseShopeeNodes, searchShopee, signRequest } from "./shopee";

describe("signRequest", () => {
  it("SHA256(AppId + Timestamp + Payload + Secret) no formato do cabeçalho", () => {
    // sha256("123" + "1700000000" + '{"query":"x"}' + "segredo")
    const h = signRequest("123", "segredo", '{"query":"x"}', 1700000000);
    expect(h).toMatch(/^SHA256 Credential=123, Timestamp=1700000000, Signature=[0-9a-f]{64}$/);
    expect(h).toBe(signRequest("123", "segredo", '{"query":"x"}', 1700000000)); // determinístico
    expect(h).not.toBe(signRequest("123", "outro", '{"query":"x"}', 1700000000));
  });
});

describe("parseShopeeNodes", () => {
  const n = (o: Record<string, unknown>) => ({ itemId: 1, shopId: 9, productName: " Console ", price: "1999.90", productLink: "https://shopee.com.br/x-i.9.1?a=b", offerLink: "https://s.shopee.com.br/abc", imageUrl: "https://img/x.jpg", ...o });
  it("usa o offerLink como link de afiliado e monta o external_id", () => {
    expect(parseShopeeNodes([n({})], 5)[0]).toMatchObject({ name: "Console", price: 1999.9, externalId: "9.1", affiliateUrl: "https://s.shopee.com.br/abc", url: "https://shopee.com.br/x-i.9.1" });
  });
  it("cai para priceMin, filtra preço mínimo e itens sem offerLink, respeita o limite", () => {
    const out = parseShopeeNodes([n({ price: undefined, priceMin: 500 }), n({ itemId: 2, price: 10 }), n({ itemId: 3, offerLink: "" }), n({ itemId: 4 })], 1, 100);
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(500);
  });
});

describe("searchShopee", () => {
  it("mostra o erro do GraphQL quando um campo não existe", async () => {
    process.env.SHOPEE_APP_ID = "1"; process.env.SHOPEE_SECRET = "s";
    const f = (async () => new Response(JSON.stringify({ errors: [{ message: 'Cannot query field "price"' }] }), { status: 200 })) as typeof fetch;
    await expect(searchShopee("x", {}, f)).rejects.toThrow('Cannot query field "price"');
  });
});
