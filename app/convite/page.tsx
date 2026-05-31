import dynamic from "next/dynamic";

const ConviteFlow = dynamic(
  () => import("@/components/convite/ConviteFlow"),
  { ssr: false }
);

interface Props {
  searchParams: { code?: string; erro?: string };
}

export default function ConvitePage({ searchParams }: Props) {
  return <ConviteFlow initialCode={searchParams.code} />;
}

export const metadata = {
  title: "Convite — Zaeon",
  description: "Entre com seu código de convite para acessar o Zaeon.",
};
