// "Visto por último": guarda o preço no momento da visualização (localStorage).
export type Recent = { id: string; then: number };
const KEY = "cp_central_recent";

export function readRecent(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function pickProduct(id: string, price: number) {
  try {
    const list = [{ id, then: price }, ...readRecent().filter((r) => r.id !== id)].slice(0, 4);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* modo privado */
  }
}
