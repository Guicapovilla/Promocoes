import { daysBetween } from "./format";

export type Tone = "success" | "warning" | "danger";
export type PricePoint = { date: string; price: number };

export const RANGES = [
  { key: "30d", label: "30 dias", days: 30 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "6m", label: "6 meses", days: 180 },
  { key: "12m", label: "1 ano", days: 365 },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];
export const DEFAULT_RANGE: RangeKey = "6m";

export const TONES: Record<Tone, { ink: string; tint: string; dot: string; bubble: string; verdict: string; text: string }> = {
  success: { ink: "#1a7a45", tint: "rgba(61,220,132,0.16)", dot: "#1f9b57", bubble: "#1f9b57", verdict: "Preço bom", text: "é um preço bom." },
  warning: { ink: "#7a5600", tint: "rgba(255,201,77,0.24)", dot: "#d99a00", bubble: "#b88300", verdict: "Na média", text: "está na média." },
  danger: { ink: "#b01d31", tint: "rgba(255,92,108,0.14)", dot: "#d1233a", bubble: "#d1233a", verdict: "Caro agora", text: "está caro." },
};

/** Abaixo disso a média ainda não diz nada (produto recém-descoberto tem 1 dia de histórico). */
export const MIN_HISTORY_DAYS = 7;
export const hasHistory = (series: PricePoint[]) => series.length >= MIN_HISTORY_DAYS;

/** pct ≤ −5 → verde; −5 < pct ≤ 3 → amarelo; pct > 3 → vermelho. */
export const classify = (pct: number): Tone => (pct <= -5 ? "success" : pct <= 3 ? "warning" : "danger");

export const pctVsAvg = (now: number, avg: number) => Math.round((now / avg - 1) * 100);

export const pctLabel = (pct: number) => (pct > 0 ? "+" : "") + pct + "%";

/**
 * Estatísticas do período. `series` é ordenada por data e termina no preço de hoje.
 * A média inclui o dia atual (como no protótipo).
 */
export function stats(series: PricePoint[], days: number) {
  const h = series.slice(-days);
  const prices = h.map((p) => p.price);
  const now = prices[prices.length - 1];
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pct = pctVsAvg(now, avg);
  return { h, now, avg, min, max, pct, tone: classify(pct) };
}

/** Preço atual ≤ mínimo dos dias anteriores (até 365). */
export function isYearLow(series: PricePoint[]) {
  if (series.length < 2) return false;
  const now = series[series.length - 1].price;
  return now <= Math.min(...series.slice(0, -1).map((p) => p.price));
}

/** "Menor desde": há quantos dias foi a última vez que o preço esteve ≤ ao de hoje. */
export function lowSince(series: PricePoint[]): string {
  const last = series[series.length - 1];
  let i = series.length - 2;
  while (i >= 0 && series[i].price > last.price) i--;
  if (i < 0) return "1 ano+";
  const d = daysBetween(series[i].date, last.date);
  return d <= 1 ? "ontem" : d + " dias";
}

/** Posição (0–100) do preço entre mínimo e máximo, limitada para o marcador não vazar da barra. */
export const markerPos = (now: number, min: number, max: number, lo = 3, hi = 97) =>
  Math.max(lo, Math.min(hi, ((now - min) / (max - min || 1)) * 100));

export const AUTO_TARGET_FACTOR = 0.95;
export const autoTarget = (avg6m: number) => avg6m * AUTO_TARGET_FACTOR;

export function radarStatus(now: number, target: number) {
  const hit = now <= target;
  return {
    hit,
    gap: Math.round((now / target - 1) * 100),
    progress: Math.round(Math.min(1, target / now) * 100),
  };
}

export function forecastText(opts: { tone: Tone; pct: number; bfDropPct: number; event?: { name: string; days: number } }) {
  const { tone, pct, bfDropPct, event } = opts;
  if (!event) return "Sem datas de promoção cadastradas por enquanto. Acompanhe pelo radar.";
  const base = `Na ${event.name} de ${new Date().getFullYear() - 1} caiu ${bfDropPct}% em relação à média.`;
  return tone === "success"
    ? `${base} Hoje já está ${Math.abs(pct)}% abaixo dela, então esperar ${event.days} dias rende pouco.`
    : `${base} Faltam ${event.days} dias: se não tiver pressa, vale colocar no radar e esperar.`;
}

export type SortKey = "popular" | "menor" | "maior" | "curtidos" | "avaliacao";
export const SORTS: [SortKey, string, string][] = [
  ["popular", "Mais popular", "↗"],
  ["menor", "Menor preço", "↑"],
  ["maior", "Maior preço", "↓"],
  ["curtidos", "Mais curtidos", "♡"],
  ["avaliacao", "Méd. avaliações", "☆"],
];

export function sortBy<T extends { price: number; likes: number; rating: number; popularity: number }>(arr: T[], k: SortKey) {
  return [...arr].sort((a, b) =>
    k === "menor" ? a.price - b.price
    : k === "maior" ? b.price - a.price
    : k === "curtidos" ? b.likes - a.likes
    : k === "avaliacao" ? b.rating - a.rating
    : b.popularity - a.popularity,
  );
}
