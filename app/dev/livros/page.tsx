/**
 * /dev/livros — vitrine do cartão de livros do buscar_livro (só fora de produção). O "Abrir no leitor"
 * dispara o mesmo evento das salas; aqui ele aparece listado embaixo (o leitor de verdade mora nas salas
 * e precisa de sessão, porque o PDF passa pelo proxy autenticado). Em produção: 404.
 */
import { notFound } from "next/navigation";
import VitrineLivros from "./VitrineLivros";

export const dynamic = "force-dynamic";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VitrineLivros />;
}
