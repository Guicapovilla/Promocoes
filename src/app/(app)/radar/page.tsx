import { RadarTable, type RadarRow } from "@/components/radar-table";
import { getCatalog, getRadar } from "@/lib/data";
import { autoTarget, radarStatus, stats } from "@/lib/pricing";

export const metadata = { title: "Meu radar · Central Capovilla" };

export default async function RadarPage() {
  const [{ products }, radar] = await Promise.all([getCatalog(), getRadar()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows: RadarRow[] = radar.flatMap((r) => {
    const p = byId.get(r.product_id);
    if (!p) return [];
    const auto = autoTarget(stats(p.series, 180).avg);
    const target = r.target_price ?? auto;
    const st = radarStatus(p.price, target);
    return [{ id: p.id, slug: p.slug, name: p.name, store: p.store, price: p.price, autoTarget: auto, customTarget: r.target_price, notify: r.notify, hit: st.hit, gap: st.gap, progress: st.progress }];
  });
  const inRadar = new Set(radar.map((r) => r.product_id));
  return <RadarTable rows={rows} addable={products.filter((p) => !inRadar.has(p.id)).map((p) => ({ id: p.id, name: p.name }))} />;
}
