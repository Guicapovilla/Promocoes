export const fmt = (v: number) =>
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtK = (v: number) => Math.round(v).toLocaleString("pt-BR");

export const numBR = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Aceita "3500", "3.500", "3500,00", "R$ 3.500". */
export function parseBR(input: string): number | null {
  let t = String(input).replace(/[^\d.,]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(t) || (t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

const TZ = "America/Sao_Paulo";

export const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

/** "08:42 · 08/10/2026" */
export function fmtUpdated(d: Date) {
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const date = d.toLocaleDateString("pt-BR", { timeZone: TZ });
  return `${time} · ${date}`;
}

/** "dd/mm" a partir de "yyyy-mm-dd". */
export const ddmm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export function daysBetween(fromISO: string, toISO: string) {
  return Math.round((Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z")) / 86_400_000);
}

export function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 2) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}
