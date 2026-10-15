import { describe, expect, it } from "vitest";
import { detectStore } from "./stores";

describe("detectStore", () => {
  it("Amazon: extrai o ASIN e limpa o link", () => {
    expect(detectStore("https://www.amazon.com.br/Nintendo-Switch/dp/B0ABCDEFGH/ref=sr_1_1?tag=outro&keywords=x")).toEqual({
      store: "Amazon", externalId: "B0ABCDEFGH", canonicalUrl: "https://www.amazon.com.br/dp/B0ABCDEFGH",
    });
  });
  it("Mercado Livre: extrai o MLB", () => {
    expect(detectStore("https://produto.mercadolivre.com.br/MLB-1234567890-console-_JM?x=1")).toMatchObject({ store: "Mercado Livre", externalId: "MLB1234567890" });
  });
  it("Shopee: shop e item", () => {
    expect(detectStore("https://shopee.com.br/Nome-i.111.222?sp_atk=abc")).toMatchObject({ store: "Shopee", externalId: "111.222", canonicalUrl: "https://shopee.com.br/Nome-i.111.222" });
  });
  it("Casas Bahia e Eneba: sem código, link sem parâmetros", () => {
    expect(detectStore("https://www.casasbahia.com.br/console/p/123?utm=1")).toMatchObject({ store: "Casas Bahia", canonicalUrl: "https://www.casasbahia.com.br/console/p/123" });
    expect(detectStore("https://www.eneba.com/steam-elden-ring?af=1")).toMatchObject({ store: "Eneba" });
  });
  it("rejeita lojas desconhecidas e texto solto", () => {
    expect(detectStore("https://exemplo.com/x")).toBeNull();
    expect(detectStore("não é link")).toBeNull();
  });
});

import { resolveAffiliateUrl } from "./affiliate";
const U = "11111111-1111-1111-1111-111111111111", P = "22222222-2222-2222-2222-222222222222";
describe("resolveAffiliateUrl", () => {
  const offer = { url_affiliate: null, product_url: "https://www.amazon.com.br/dp/B0ABCDEFGH", external_id: "B0ABCDEFGH" };
  it("acrescenta os parâmetros do programa", () => {
    expect(resolveAffiliateUrl(offer, { append_params: "tag=meucodigo-20", link_template: null }, U, P)).toBe("https://www.amazon.com.br/dp/B0ABCDEFGH?tag=meucodigo-20");
  });
  it("usa o modelo completo", () => {
    const url = resolveAffiliateUrl(offer, { append_params: null, link_template: "https://rede.com/c?m=1&clickref={subid}&ued={url_encoded}" }, U, P)!;
    expect(url).toContain("ued=https%3A%2F%2Fwww.amazon.com.br%2Fdp%2FB0ABCDEFGH");
    expect(url).toContain(`clickref=${U}.${P}`);
  });
  it("link manual vence; sem nada, devolve o link do produto", () => {
    expect(resolveAffiliateUrl({ ...offer, url_affiliate: "https://x.com/?s={subid}" }, null, U, P)).toContain(U);
    expect(resolveAffiliateUrl(offer, null, U, P)).toBe(offer.product_url);
  });
});
