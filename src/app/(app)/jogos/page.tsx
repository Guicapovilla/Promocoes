import { GamesView } from "@/components/games-view";
import { getGames } from "@/lib/data";

export const metadata = { title: "Jogos em desconto · Central Capovilla" };

export default async function GamesPage() {
  return <GamesView games={await getGames()} />;
}
