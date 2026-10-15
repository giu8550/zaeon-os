import { notFound } from "next/navigation";
import { OCTA_CODE_LIGADO } from "@/lib/octa/flag";
import PainelSaude from "@/components/octa/PainelSaude";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!OCTA_CODE_LIGADO) notFound();
  return <main className="min-h-screen bg-zinc-950"><PainelSaude /></main>;
}
