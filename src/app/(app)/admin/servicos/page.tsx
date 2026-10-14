import { notFound } from "next/navigation";
import { getProfile, getServices } from "@/lib/data";
import { deleteService, saveService } from "../actions";

export const metadata = { title: "Admin · Serviços" };

export default async function AdminServices() {
  const profile = await getProfile();
  if (!profile?.is_admin) notFound();
  const services = await getServices();
  const input = (name: string, label: string, props: Record<string, unknown> = {}) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, font: "600 12px/1 var(--font-body)" }}>
      {label}
      <input className="field" name={name} {...props} />
    </label>
  );
  return (
    <div className="page">
      <div><h1 className="h1">Serviços parceiros · admin</h1><p className="sub">Cadastro manual. Produtos, ofertas, eventos e jogos são gerenciados no painel do Supabase (Table Editor).</p></div>
      <form action={saveService} className="card" style={{ padding: 20, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, font: "600 12px/1 var(--font-body)" }}>
          Categoria
          <select className="field" name="category" required>
            {["Desbloqueio", "Conserto", "Manutenção", "Upgrade"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {input("store", "Loja", { required: true })}
        {input("city", "Cidade / alcance", { required: true })}
        {input("title", "Título", { required: true })}
        {input("description", "Descrição", { required: true })}
        {input("price_from", "A partir de (R$)", { required: true, inputMode: "decimal" })}
        {input("perk", "Benefício do apoiador")}
        {input("contact_url", "Link de contato (WhatsApp)", { required: true, type: "url" })}
        {input("details_url", "Link de detalhes", { type: "url" })}
        {input("logo_url", "URL do logo", { type: "url" })}
        <button className="btn btn-md btn-primary" style={{ alignSelf: "end" }}>Adicionar serviço</button>
      </form>
      <div className="card">
        {services.map((s) => (
          <form key={s.id} action={deleteService} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
            <input type="hidden" name="id" value={s.id} />
            <span><b>{s.store}</b> · {s.title} <span className="muted">({s.category})</span></span>
            <button className="small-btn danger">Remover</button>
          </form>
        ))}
      </div>
    </div>
  );
}
