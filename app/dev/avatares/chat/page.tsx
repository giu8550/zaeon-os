/**
 * /dev/avatares/chat — PROVA do "o avatar É o chat", sem login e sem banco (só fora de produção).
 * Mesmos componentes da sala de verdade (bolinha da aba, boas-vindas, pílula, composer), com a
 * resposta da Aura simulada. Em produção: 404.
 */
import { notFound } from "next/navigation";
import ChatPresencaDev from "./ChatPresencaDev";

export const dynamic = "force-dynamic";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ChatPresencaDev />;
}
