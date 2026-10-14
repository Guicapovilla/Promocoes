import { createHash } from "node:crypto";

/** Um anúncio encontrado numa loja, já com o link de afiliado. */
export type Hit = {
  store: string;
  source: string; // shopee | amazon | feed
  externalId: string;
  title: string;
  price: number;
  imageUrl: string | null;
  url: string; // link de afiliado (pode ter {subid})
  ean?: string | null;
};

export type WatchRule = { term: string; aliases: string[]; category: string; min_price: number | null; max_price: number | null; exclude: string[] };

export const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** minúsculas, sem acento, só letras/números separados por espaço */
export const normalize = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** palavras de marketing que não identificam o produto */
const NOISE = new Set([
  "novo", "nova", "lacrado", "lacrada", "original", "garantia", "frete", "gratis", "oferta", "promocao", "pronta", "entrega",
  "envio", "imediato", "nacional", "importado", "oficial", "brasil", "br", "com", "sem", "para", "de", "da", "do", "e", "a", "o", "em",
  "12x", "10x", "full", "lancamento", "top", "barato", "melhor", "preco", "nf", "nfe", "bivolt", "anos", "ano", "meses", "mes",
]);

export const tokens = (s: string) => normalize(s).split(" ").filter(Boolean);

/** Chave para juntar o mesmo produto em lojas diferentes: palavras relevantes únicas, ordenadas. */
export function matchKey(title: string): string {
  return [...new Set(tokens(title).filter((t) => !NOISE.has(t)))].sort().join(" ");
}

export const slugify = (title: string) =>
  normalize(title).split(" ").slice(0, 8).join("-") + "-" + createHash("sha1").update(matchKey(title)).digest("hex").slice(0, 6);

/** Nome limpo para exibição (corta títulos enormes de marketplace). */
export function displayName(title: string): string {
  const t = title.replace(/\s+/g, " ").replace(/[|••]+/g, "-").trim();
  return t.length > 90 ? t.slice(0, 87).trimEnd() + "…" : t;
}

const hasAll = (titleTokens: Set<string>, words: string[]) => words.length > 0 && words.every((w) => titleTokens.has(w));

/** O anúncio é mesmo o produto da regra? Confere nome (ou apelido), faixa de preço e palavras excluídas. */
export function passesRule(hit: Pick<Hit, "title" | "price">, rule: WatchRule): boolean {
  const t = new Set(tokens(hit.title));
  const nameOk = hasAll(t, tokens(rule.term)) || rule.aliases.some((a) => hasAll(t, tokens(a)));
  if (!nameOk) return false;
  if (rule.min_price != null && hit.price < Number(rule.min_price)) return false;
  if (rule.max_price != null && hit.price > Number(rule.max_price)) return false;
  return !rule.exclude.some((w) => tokens(w).every((x) => t.has(x)) && tokens(w).length > 0);
}

/** Filtro da busca livre do usuário: todas as palavras da busca no título. */
export function matchesQuery(title: string, query: string): boolean {
  return hasAll(new Set(tokens(title)), tokens(query));
}

export function toNumber(v: unknown): number | null {
  const n = Number(String(v).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
