/** Lista os campos reais do produto na API da Shopee (use se o importador acusar campo inexistente).  npm run shopee:schema */
import { shopeeGraphql } from "../src/lib/ingest/shopee";

type T = { __type: { name: string; fields: { name: string; type: { name: string | null; kind: string; ofType?: { name: string | null } | null } }[] } | null };
const tipo = async (nome: string) => shopeeGraphql<T>(`{ __type(name: "${nome}") { name fields { name type { name kind ofType { name } } } } }`);

(async () => {
  for (const nome of ["ProductOfferV2", "ProductOfferV2Connection", "Query"]) {
    try {
      const { __type: t } = await tipo(nome);
      if (!t) { console.log(`\n(tipo ${nome} não existe)`); continue; }
      console.log(`\n${t.name}:`);
      t.fields.forEach((f) => console.log(`  ${f.name}: ${f.type.name ?? f.type.ofType?.name ?? f.type.kind}`));
    } catch (e) { console.log(`\n${nome}: ${e instanceof Error ? e.message : e}`); }
  }
})();
