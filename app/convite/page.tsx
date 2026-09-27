import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { convitesAtivos } from "@/lib/convite/flag";

const ConviteFlow = dynamic(
  () => import("@/components/convite/ConviteFlow"),
  { ssr: false }
);

interface Props {
  searchParams: { code?: string; erro?: string };
}

export default function ConvitePage({ searchParams }: Props) {
  // Cadastro aberto: o convite deixou de ser porteiro. O fluxo continua aqui, inteiro,
  // esperando CONVITES_ATIVOS=1 — até lá quem cai nesse link vai direto pra entrada.
  if (!convitesAtivos()) redirect("/login");
  return <ConviteFlow initialCode={searchParams.code} />;
}
