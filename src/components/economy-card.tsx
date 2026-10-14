"use client";

import { fmt } from "@/lib/format";
import { useUi } from "./ui-provider";

export function EconomyCard() {
  const { economyTotal, openEconomy } = useUi();
  return (
    <button className="daily-card savings" onClick={openEconomy}>
      <span className="lbl">Você já economizou</span>
      <span className="num">{fmt(economyTotal)}</span>
      <span className="desc">Ver minhas compras →</span>
    </button>
  );
}
