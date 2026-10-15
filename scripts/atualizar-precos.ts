/** Atualiza o preço de todas as ofertas automáticas e fecha o histórico do dia.  npm run atualizar */
import { ingestPrices } from "../src/lib/ingest";

ingestPrices().then((r) => { console.log(r); process.exit(r.errors.length ? 1 : 0); }, (e) => { console.error(e); process.exit(1); });
