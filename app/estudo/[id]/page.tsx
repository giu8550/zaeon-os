"use client";
/**
 * /estudo/:id?convite=<token> — a porta de entrada de uma cartolina compartilhada.
 *
 * 1. Sem sessão → /login com callbackUrl de volta pra cá (o /login aceita só e-mail, sem
 *    senha, então o convidado não precisa de Google).
 * 2. Com convite → POST /join (entra como editor/leitor) e TIRA o token da URL (não fica no
 *    histórico nem vaza se a pessoa copiar o endereço da barra).
 * 3. Abre o board por id. Sem acesso / convite inválido → mensagem, nunca tela quebrada.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const LoungeCartolina = dynamic(() => import("@/components/lounge/LoungeCartolina"), { ssr: false });
const ON = process.env.NEXT_PUBLIC_CARTOLINA_MEMORIA === "1" && process.env.NEXT_PUBLIC_CARTOLINA_COWORK === "1";

type Estado = "carregando" | "pronto" | "convite_invalido" | "sem_acesso";

export default function EstudoCompartilhado() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const [estado, setEstado] = useState<Estado>("carregando");
  const convite = sp.get("convite");

  useEffect(() => {
    if (!ON || status === "loading") return;
    if (status === "unauthenticated") {
      const volta = `/estudo/${id}${convite ? `?convite=${encodeURIComponent(convite)}` : ""}`;
      router.replace(`/login?callbackUrl=${encodeURIComponent(volta)}`);
      return;
    }
    let vivo = true;
    (async () => {
      if (convite) {
        const r = await fetch(`/api/cartolina/${id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: convite }) }).catch(() => null);
        if (!vivo) return;
        router.replace(`/estudo/${id}`); // token sai da barra de endereço
        if (!r?.ok) { setEstado(r?.status === 400 ? "convite_invalido" : "sem_acesso"); return; }
      } else {
        const r = await fetch(`/api/cartolina/${id}`).catch(() => null);
        if (!vivo) return;
        if (!r?.ok) { setEstado("sem_acesso"); return; }
      }
      setEstado("pronto");
    })();
    return () => { vivo = false; };
  }, [status, id, convite, router]);

  if (!ON) return <Aviso titulo="Indisponível" texto="O coworking da cartolina ainda não está ligado." />;
  if (estado === "convite_invalido") return <Aviso titulo="Convite inválido" texto="Este link venceu ou foi revogado. Peça um novo a quem compartilhou." />;
  if (estado === "sem_acesso") return <Aviso titulo="Sem acesso" texto="Esta cartolina não existe ou não foi compartilhada com você." />;
  if (estado === "carregando") return <Aviso titulo="Abrindo a cartolina…" texto="" />;
  return <LoungeCartolina boardId={id} abrirDeInicio surface="estudos" onFechar={() => router.push("/research-lab")} />;
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="zaeon-borda flex min-h-[100dvh] flex-col justify-center gap-3 py-24" style={{ background: "#efe7d3", color: "#3a2f1e" }}>
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      {texto && <p className="max-w-[520px] text-base" style={{ color: "#6b5a3e" }}>{texto}</p>}
    </main>
  );
}
