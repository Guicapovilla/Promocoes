import { createAdminClient } from "./supabase/admin";

type Row = Record<string, string>;

/** Parser CSV com suporte a aspas e separador `,` ou `;` / tab. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", quoted = false;
  const sep = text.slice(0, text.indexOf("\n")).includes("\t") ? "\t" : text.slice(0, text.indexOf("\n")).includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some(Boolean)) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const [head, ...body] = rows;
  const cols = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? "").trim()])));
}

const pick = (r: Row, ...keys: string[]) => keys.map((k) => r[k]).find(Boolean) ?? "";
const num = (s: string) => { const n = Number(s.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

function platformOf(s: string): "Steam" | "PSN" | "Xbox" | "Nintendo" | "Outros" {
  const t = s.toLowerCase();
  if (t.includes("steam")) return "Steam";
  if (t.includes("playstation") || t.includes("psn") || t.includes("ps5") || t.includes("ps4")) return "PSN";
  if (t.includes("xbox")) return "Xbox";
  if (t.includes("nintendo") || t.includes("switch") || t.includes("eshop")) return "Nintendo";
  return "Outros";
}

/**
 * Importa o feed de afiliado da Eneba (ENEBA_FEED_URL). O layout exato do feed depende do programa;
 * aceitamos nomes de coluna comuns (id, name/title, platform, price, original_price/old_price, url/link, image, region).
 * Ajuste o mapeamento abaixo se o seu feed usar outros nomes.
 */
export async function importEnebaFeed() {
  const url = process.env.ENEBA_FEED_URL;
  if (!url) throw new Error("ENEBA_FEED_URL não configurado");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`feed respondeu ${res.status}`);
  const rows = parseCsv(await res.text());

  const now = new Date().toISOString();
  const games = rows.flatMap((r, i) => {
    const price = num(pick(r, "price", "sale_price", "preco"));
    const original = num(pick(r, "original_price", "old_price", "regular_price", "list_price"));
    const name = pick(r, "name", "title");
    const link = pick(r, "url", "link", "affiliate_url", "deeplink");
    if (!name || !link || !price || original <= price) return [];
    return [{
      external_id: pick(r, "id", "sku", "product_id") || `row-${i}`,
      name,
      platform: platformOf(pick(r, "platform", "drm", "category") + " " + name),
      region: pick(r, "region") || "Brasil",
      cover_url: pick(r, "image", "image_url", "cover") || null,
      price, original_price: original, url_affiliate: link, updated_at: now,
    }];
  });

  const db = createAdminClient();
  for (let i = 0; i < games.length; i += 500) {
    const { error } = await db.from("games").upsert(games.slice(i, i + 500), { onConflict: "external_id" });
    if (error) throw error;
  }
  // remove jogos que saíram do feed (e os de demonstração `demo-*`)
  const { error: delErr } = await db.from("games").delete().lt("updated_at", now);
  if (delErr) throw delErr;
  return { read: rows.length, imported: games.length };
}
