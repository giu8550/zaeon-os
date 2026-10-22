import { notFound } from "next/navigation";
import { OCTA_CODE_LIGADO } from "@/lib/octa/flag";
import VoltaGithub from "./VoltaGithub";

export const dynamic = "force-dynamic";

/** Fim do "Conectar GitHub" aberto pela IDE do Octa (janelinha): avisa a IDE e se fecha. */
export default function Page() {
  if (!OCTA_CODE_LIGADO) notFound();
  return <main className="min-h-screen grid place-items-center bg-[#282c33] text-[#dce0e5] p-6"><VoltaGithub /></main>;
}
