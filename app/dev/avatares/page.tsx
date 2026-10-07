/**
 * /dev/avatares — ESTÚDIO DE AVATAR da Etapa A (só fora de produção).
 * O Claude Code abre esta página no painel ao lado da conversa e cria os avatares das personas
 * da casa com o dono vendo cada estado aparecer e aprovando um a um; salvar grava em
 * public/avatars/<id>/ (vai pro git). Em produção: 404 — lá a criação é a tool do admin.
 */
import { notFound } from "next/navigation";
import EstudioDev from "./EstudioDev";

export const dynamic = "force-dynamic";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <EstudioDev />;
}
