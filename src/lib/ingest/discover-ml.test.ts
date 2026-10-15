import { describe, expect, it } from "vitest";
import { pickCheapest, searchMercadoLivre } from "./discover-ml";

const item = (o: Record<string, unknown>) => ({ id: "MLB1", title: "T", price: 100, permalink: "https://produto.mercadolivre.com.br/MLB-1-x?a=b", condition: "new", ...o });

describe("pickCheapest", () => {
  it("agrupa por produto de catálogo e fica com o mais barato", () => {
    const out = pickCheapest([item({ id: "MLB1", price: 300, catalog_product_id: "C1" }), item({ id: "MLB2", price: 250, catalog_product_id: "C1" }), item({ id: "MLB3", price: 90 })], 10);
    expect(out.map((c) => [c.externalId, c.price])).toEqual([["MLB2", 250], ["MLB3", 90]]);
  });
  it("ignora usados, sem estoque e abaixo do preço mínimo; limpa o link", () => {
    const out = pickCheapest([item({ condition: "used" }), item({ id: "MLB9", available_quantity: 0 }), item({ id: "MLB5", price: 20 }), item({ id: "MLB6", price: 500 })], 10, 50);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ externalId: "MLB6", url: "https://produto.mercadolivre.com.br/MLB-1-x" });
  });
  it("respeita o limite e força https na imagem", () => {
    const out = pickCheapest([item({ id: "A", thumbnail: "http://x/y-I.jpg" }), item({ id: "B" }), item({ id: "C" })], 2);
    expect(out).toHaveLength(2);
    expect(out[0].imageUrl).toBe("https://x/y-O.jpg");
  });
});

describe("searchMercadoLivre", () => {
  it("falha com mensagem clara quando a API recusa", async () => {
    const f = (async () => new Response("{}", { status: 403 })) as typeof fetch;
    await expect(searchMercadoLivre("switch", "tok", {}, f)).rejects.toThrow("HTTP 403");
  });
});
