import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/data";
import { fmt, numBR } from "@/lib/format";
import { STORES } from "@/lib/stores";
import { addOffer, deleteOffer, saveProgram, updateOfferPrice } from "../actions";

export const metadata = { title: "Admin · Produtos e links" };

const ERROS: Record<string, string> = {
  url: "Não reconheci esse endereço. Cole o link do produto de Amazon, Mercado Livre, Shopee, Casas Bahia ou Eneba.",
  preco: "Preço inválido. Exemplo: 3799,90",
  produto: "Escolha um produto da lista ou digite o nome de um novo.",
};

export default async function AdminOffers({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const profile = await getProfile();
  if (!profile?.is_admin) notFound();
  const { erro, ok } = await searchParams;
  const db = createAdminClient();
  const [programs, products, offers] = await Promise.all([
    db.from("affiliate_programs").select("*"),
    db.from("products").select("id, name").order("name"),
    db.from("offers").select("id, store, price, product_url, products(name)").order("store"),
  ]);
  const prog = new Map((programs.data ?? []).map((p) => [p.store, p]));
  const lbl = { display: "flex", flexDirection: "column", gap: 4, font: "600 12px/1 var(--font-body)" } as const;

  return (
    <div className="page">
      <div>
        <h1 className="h1">Produtos e links de afiliado</h1>
        <p className="sub">Siga o <b>GUIA-PASSO-A-PASSO.md</b> do projeto. Aqui você cadastra produtos colando o endereço da loja e define o seu código de afiliado de cada loja.</p>
      </div>
      {erro && <p role="alert" style={{ color: "#b01d31" }}>{ERROS[erro] ?? "Algo deu errado."}</p>}
      {ok && <p role="status" style={{ color: "var(--green-ink)" }}>Salvo.</p>}

      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="h2" style={{ fontSize: 18 }}>1. Seu código de afiliado, por loja</h2>
        <p className="sub-sm">Preencha só o campo que a sua rede indicar. Ex.: Amazon → <code>tag=seucodigo-20</code>. Redes com link próprio (Awin, Shopee, ML) → use o modelo, com <code>{"{url_encoded}"}</code> onde vai o endereço do produto.</p>
        {STORES.map((s) => (
          <form key={s} action={saveProgram} style={{ display: "grid", gap: 8, gridTemplateColumns: "110px 1fr 1.6fr auto", alignItems: "end" }}>
            <input type="hidden" name="store" value={s} />
            <b>{s}</b>
            <label style={lbl}>Parâmetros<input className="field" name="append_params" defaultValue={prog.get(s)?.append_params ?? ""} placeholder="tag=seucodigo-20" /></label>
            <label style={lbl}>Modelo de link (opcional)<input className="field" name="link_template" defaultValue={prog.get(s)?.link_template ?? ""} placeholder="https://…{url_encoded}…" /></label>
            <button className="btn btn-md btn-outline">Salvar</button>
          </form>
        ))}
      </div>

      <form action={addOffer} className="card" style={{ padding: 20, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <h2 className="h2" style={{ fontSize: 18, gridColumn: "1 / -1" }}>2. Adicionar um produto numa loja</h2>
        <label style={lbl}>Endereço do produto na loja<input className="field" name="url" type="url" required placeholder="https://www.amazon.com.br/…/dp/…" /></label>
        <label style={lbl}>Preço de hoje (R$)<input className="field" name="price" required inputMode="decimal" placeholder="3799,90" /></label>
        <label style={lbl}>Produto já cadastrado
          <select className="field" name="product_id" defaultValue="">
            <option value="">— novo produto —</option>
            {(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label style={lbl}>Se for novo: nome<input className="field" name="new_name" placeholder="Nintendo Switch OLED" /></label>
        <label style={lbl}>Se for novo: categoria<input className="field" name="new_category" placeholder="Console · Nintendo" /></label>
        <button className="btn btn-md btn-primary" style={{ alignSelf: "end" }}>Adicionar</button>
      </form>

      <div className="card">
        <div className="card-head">3. Ofertas cadastradas (atualize o preço quando mudar)</div>
        {(offers.data ?? []).map((o) => {
          const name = (o.products as unknown as { name: string } | null)?.name ?? "";
          return (
            <div key={o.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ flex: 1, minWidth: 220 }}><b>{name}</b> <span className="muted">· {o.store} · {fmt(Number(o.price))}</span></span>
              <form action={updateOfferPrice} style={{ display: "flex", gap: 6 }}>
                <input type="hidden" name="id" value={o.id} />
                <input className="field" name="price" defaultValue={numBR(Number(o.price))} style={{ width: 120 }} aria-label="Novo preço" />
                <button className="small-btn">Atualizar</button>
              </form>
              <form action={deleteOffer}><input type="hidden" name="id" value={o.id} /><button className="small-btn danger">Remover</button></form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
