import { signOut } from "@/app/actions";

/** Gate para quem não é apoiador: esqueleto desfocado + convite. Nenhum dado real é enviado. */
export function Locked() {
  return (
    <>
      <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card" style={{ height: 120 }} />
        <div className="daily">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card" style={{ height: 110 }} />)}
        </div>
        <div className="card" style={{ height: 220 }} />
        <div className="grid-2x2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card" style={{ height: 280 }} />)}
        </div>
      </div>
      <div className="lock">
        <div className="lock-card">
          <span className="badge-supporter">Exclusivo para apoiadores</span>
          <h3 style={{ font: "700 24px/1.25 var(--font-body)" }}>A central atualiza todo dia às 8h</h3>
          <p className="sub">Histórico de preços, radar de produtos e jogos em desconto ficam liberados para quem apoia o canal.</p>
          <a className="btn btn-lg btn-primary" style={{ color: "#fff" }} href={process.env.NEXT_PUBLIC_SUPPORT_URL || "#"} target="_blank" rel="noreferrer">
            Quero ser apoiador
          </a>
          <form action={signOut}>
            <button className="link-btn" style={{ fontWeight: 500, fontSize: 14 }}>Já apoio com outro e-mail · trocar de conta</button>
          </form>
        </div>
      </div>
    </>
  );
}
