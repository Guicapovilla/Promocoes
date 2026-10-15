/** Importa os jogos em desconto do feed da Eneba (ENEBA_FEED_URL).  npm run importar:jogos */
import { importEnebaFeed } from "../src/lib/eneba";

importEnebaFeed().then((r) => { console.log(r); process.exit(0); }, (e) => { console.error("✘", e instanceof Error ? e.message : e); process.exit(1); });
