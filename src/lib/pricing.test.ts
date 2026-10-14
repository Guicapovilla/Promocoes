import { describe, expect, it } from "vitest";
import { parseBR } from "./format";
import { autoTarget, classify, isYearLow, lowSince, pctVsAvg, radarStatus, stats } from "./pricing";

const series = (prices: number[]) =>
  prices.map((price, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), price }));

describe("classificação", () => {
  it("usa os limites -5 / 3", () => {
    expect(classify(-5)).toBe("success");
    expect(classify(-4)).toBe("warning");
    expect(classify(3)).toBe("warning");
    expect(classify(4)).toBe("danger");
  });
  it("pct = round((agora/média − 1) × 100)", () => {
    expect(pctVsAvg(95, 100)).toBe(-5);
    expect(pctVsAvg(103.4, 100)).toBe(3);
  });
});

describe("histórico", () => {
  it("menor preço do ano", () => {
    expect(isYearLow(series([10, 9, 8]))).toBe(true);
    expect(isYearLow(series([10, 7, 8]))).toBe(false);
    expect(isYearLow(series([8, 9, 8]))).toBe(true);
  });
  it("média, min e max do período", () => {
    const s = stats(series([10, 20, 30, 20]), 3);
    expect(s.avg).toBeCloseTo(23.33, 1);
    expect(s.min).toBe(20);
    expect(s.max).toBe(30);
  });
  it("menor desde", () => {
    expect(lowSince(series([5, 9, 9, 8]))).toBe("3 dias");
    expect(lowSince(series([9, 9, 8]))).toBe("1 ano+");
    expect(lowSince(series([5, 9, 8, 8]))).toBe("ontem");
  });
});

describe("radar", () => {
  it("alvo automático é 5% abaixo da média", () => {
    expect(autoTarget(1000)).toBe(950);
  });
  it("status e progresso", () => {
    expect(radarStatus(900, 950)).toMatchObject({ hit: true, progress: 100 });
    expect(radarStatus(1000, 950)).toMatchObject({ hit: false, gap: 5, progress: 95 });
  });
});

describe("parseBR", () => {
  it.each([["3500", 3500], ["3.500", 3500], ["3500,00", 3500], ["R$ 3.500", 3500], ["3.499,90", 3499.9], ["abc", null]])(
    "%s",
    (input, out) => expect(parseBR(input as string)).toBe(out),
  );
});
