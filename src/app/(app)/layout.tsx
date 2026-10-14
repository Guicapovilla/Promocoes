import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { Locked } from "@/components/locked";
import { UiProvider } from "@/components/ui-provider";
import { getCatalog, getNotifications, getProfile, getPurchases, getRadar } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  // Não apoiadores não recebem dados: o RLS devolve vazio e o conteúdo é substituído pelo gate.
  const supporter = profile.is_supporter;
  const [radar, purchases, notifications, { products }] = supporter
    ? await Promise.all([getRadar(), getPurchases(), getNotifications(), getCatalog()])
    : [[], [], [], { products: [] }];

  return (
    <UiProvider
      profile={profile}
      radar={radar}
      purchases={purchases}
      initialNotifications={notifications}
      productSlugs={Object.fromEntries(products.map((p) => [p.id, p.slug]))}
    >
      <Nav profile={profile} />
      <main className="main">{supporter ? children : <Locked />}</main>
    </UiProvider>
  );
}
