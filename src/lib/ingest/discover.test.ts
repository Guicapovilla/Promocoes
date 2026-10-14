import { describe, expect, it } from "vitest";
import { displayName, matchKey, matchesQuery, passesRule, slugify, type WatchRule } from "./normalize";
import { parseCsv } from "./providers/feed";

const oled: WatchRule = {
  term: "Nintendo Switch OLED", aliases: [], category: "Videogame", min_price: 1500, max_price: 5000,
  exclude: ["capa", "case", "película", "jogo"],
};
const ps5: WatchRule = { term: "PlayStation 5 Slim", aliases: ["ps5 slim"], category: "Videogame", min_price: 2500, max_price: 9000, exclude: ["controle"] };

describe("passesRule", () => {
  it("aceita o console na faixa de preço", () => {
    expect(passesRule({ title: "Console Nintendo Switch OLED 64GB Branco - Novo Lacrado", price: 2299 }, oled)).toBe(true);
  });
  it("rejeita acessório por preço e por palavra excluída", () => {
    expect(passesRule({ title: "Capa protetora para Nintendo Switch OLED", price: 39.9 }, oled)).toBe(false);
    expect(passesRule({ title: "Case Nintendo Switch OLED", price: 2000 }, oled)).toBe(false);
    expect(passesRule({ title: "Jogo Zelda Nintendo Switch OLED edition", price: 300 }, oled)).toBe(false);
  });
  it("rejeita outro produto parecido", () => {
    expect(passesRule({ title: "Nintendo Switch Lite Azul", price: 1800 }, oled)).toBe(false);
  });
  it("aceita pelo apelido e é insensível a acento/caixa", () => {
    expect(passesRule({ title: "Console PS5 Slim 1TB", price: 3699 }, ps5)).toBe(true);
    expect(passesRule({ title: "PLAYSTATION 5 SLIM digital", price: 3200 }, ps5)).toBe(true);
    expect(passesRule({ title: "Capa PELÍCULA Nintendo Switch OLED", price: 2000 }, oled)).toBe(false);
  });
});

describe("matchKey / slug", () => {
  it("junta o mesmo produto de lojas diferentes, ignorando ruído de marketing", () => {
    const a = matchKey("Console Nintendo Switch OLED 64GB - Novo Lacrado Original");
    const b = matchKey("Nintendo Switch OLED Console 64GB (frete grátis)");
    expect(a).toBe(b);
  });
  it("slug é determinístico", () => {
    expect(slugify("Console Nintendo Switch OLED 64GB")).toBe(slugify("Console Nintendo Switch OLED 64GB"));
  });
  it("displayName corta títulos longos", () => {
    expect(displayName("x".repeat(200)).length).toBeLessThanOrEqual(90);
  });
});

describe("matchesQuery", () => {
  it("exige todas as palavras da busca no título", () => {
    expect(matchesQuery("Console PlayStation 5 Slim 1TB", "playstation 5")).toBe(true);
    expect(matchesQuery("Console PlayStation 4", "playstation 5")).toBe(false);
  });
});

describe("parseCsv", () => {
  it("respeita aspas, vírgula no título e ponto e vírgula", () => {
    const csv = 'id,title,price\n1,"Console, novo ""lacrado""",2.299\n2,Outro,100\n';
    expect(parseCsv(csv)).toEqual([
      { id: "1", title: 'Console, novo "lacrado"', price: "2.299" },
      { id: "2", title: "Outro", price: "100" },
    ]);
    expect(parseCsv("id;nome;preco\n7;Teste;1.234,56\n")[0]).toEqual({ id: "7", nome: "Teste", preco: "1.234,56" });
  });
});
