"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions";
import { fmt } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { useUi } from "./ui-provider";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "?";

export function Nav({ profile }: { profile: Profile }) {
  const path = usePathname();
  const router = useRouter();
  const { radar, economyTotal, openEconomy, openSettings } = useUi();
  const [open, setOpen] = useState(false);
  const name = profile.name ?? profile.email ?? "Conta";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabs = [
    ["/", "Promoções"],
    ["/radar", "Meu radar" + (radar.length ? ` · ${radar.length}` : "")],
    ["/jogos", "Jogos em desconto"],
    ["/servicos", "Serviços"],
  ] as const;

  return (
    <nav className="nav">
      <div className="nav-in">
        <button
          className="wordmark"
          aria-label="Ir para o início"
          onClick={() => {
            router.push("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          CAPOVILLA <span>CENTRAL</span>
        </button>
        <div className="tabs">
          {tabs.map(([href, label]) => (
            <Link key={href} href={href} className="tab" aria-current={path === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          {profile.is_supporter && <span className="badge-supporter">Apoiador</span>}
          <div style={{ position: "relative" }}>
            <button className="acct-btn" aria-label="Abrir menu da conta" aria-expanded={open} onClick={() => setOpen(!open)}>
              <span className="avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(name)}</span>
              <span>{name.split(" ")[0]}</span>
            </button>
            {open && (
              <>
                <div className="scrim" onClick={() => setOpen(false)} />
                <div className="dropdown menu">
                  <div style={{ padding: "10px 12px 12px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ font: "600 14px/1.3 var(--font-body)" }}>{name}</span>
                    <span className="muted" style={{ font: "12px/1.3 var(--font-body)" }}>
                      {profile.email}
                      {profile.supporter_since && ` · apoiador desde ${profile.supporter_since.slice(5, 7)}/${profile.supporter_since.slice(0, 4)}`}
                    </span>
                  </div>
                  <button className="menu-item" onClick={() => { setOpen(false); openEconomy(); }}>
                    <span>Minha economia</span>
                    <span style={{ fontWeight: 600, color: "var(--green-ink)" }}>{fmt(economyTotal)}</span>
                  </button>
                  <button className="menu-item" onClick={() => { setOpen(false); router.push("/radar"); }}>Meu radar</button>
                  <button className="menu-item" onClick={() => { setOpen(false); openSettings(); }}>Configurações</button>
                  <a className="menu-item" style={{ color: "var(--text-primary)" }} href={process.env.NEXT_PUBLIC_MANAGE_SUPPORT_URL || "#"} target="_blank" rel="noreferrer">Gerenciar apoio</a>
                  {profile.is_admin && (
                    <button className="menu-item" onClick={() => { setOpen(false); router.push("/admin/servicos"); }}>Admin · serviços</button>
                  )}
                  <form action={signOut}>
                    <button className="menu-item" style={{ width: "100%", borderTop: "1px solid var(--border-subtle)", borderRadius: 0, marginTop: 4, padding: 12, color: "var(--text-muted)" }}>Sair</button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
