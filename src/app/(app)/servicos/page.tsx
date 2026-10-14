import { ServicesView } from "@/components/services-view";
import { getServices } from "@/lib/data";

export const metadata = { title: "Serviços · Central Capovilla" };

export default async function ServicesPage() {
  return <ServicesView services={await getServices()} />;
}
