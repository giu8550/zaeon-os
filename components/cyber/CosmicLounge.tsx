"use client";
/**
 * CosmicLounge — o cyberespaço (Lounge Cósmico) como COMPONENTE do app: substitui o iframe do protótipo.
 *  - modo "janela": prévia na landing do logado — começa no menu (opção do monitor ou ESPAÇO = play), sem rede;
 *  - modo "tela": /lounge-cosmico — a sala do CollabDoc (convite por token, presença ao vivo ≤5, chat), uma
 *    base privada por pessoa. Se a sala não abrir (cheia/erro), dá pra entrar sozinho.
 * three.js é client-only e pesado: este módulo é importado com next/dynamic (ssr:false) pelos chamadores.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { corDoUsuario } from "@/lib/lounge3d/tipos";
import { basesDosMembros, poseNoAssento } from "@/lib/cyber/bases";
import { temWebGL } from "@/lib/ui/globo";
import { LAB_ENTRADA } from "@/lib/ui/loungeHub";
import { avisoRealtime } from "@/lib/lounge3d/realtimeEstado";
import { useResolverSala } from "@/components/lounge/useResolverSala";
import { useSala3D } from "@/components/lounge/useSala3D";
import CenaCyber from "./CenaCyber";
import type { PessoaCyber } from "./engine";

export default function CosmicLounge({ modo, onSessaoIniciada }: { modo: "janela" | "tela"; onSessaoIniciada?: () => void }) {
  const webgl = useMemo(() => (typeof window === "undefined" ? true : temWebGL()), []);
  if (!webgl) return <SemWebGL />;
  return modo === "janela" ? <Janela onSessaoIniciada={onSessaoIniciada} /> : <Tela />;
}

function SemWebGL() {
  const router = useRouter();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#03030a] px-6 text-center text-sm text-white/70">
      Este aparelho não suporta o cyberespaço 3D.
      <button type="button" onClick={() => router.push(LAB_ENTRADA)} className="min-h-[44px] rounded-full bg-cyan-400 px-5 font-semibold text-slate-950">Ir para a Sala de Estudos</button>
    </div>
  );
}

const Carregando = ({ children }: { children?: React.ReactNode }) => <div className="flex h-full w-full items-center justify-center bg-[#03030a] px-6 text-center text-sm text-sky-100/80">{children ?? "conectando ao cyberespaço…"}</div>;

function Janela({ onSessaoIniciada }: { onSessaoIniciada?: () => void }) {
  const { data } = useSession();
  const eu = useMemo<PessoaCyber>(() => { const id = (data?.user as { id?: string } | undefined)?.id ?? "local"; return { id, name: data?.user?.name ?? "Visitante", color: "#45d6ff" }; }, [data]);
  const membros = useMemo(() => [eu], [eu]);
  return <CenaCyber modo="janela" eu={eu} membros={membros} onSessaoIniciada={onSessaoIniciada} />;
}

function Tela() {
  const { data } = useSession();
  const { salaId, erro, tentarDeNovo } = useResolverSala();
  const [solo, setSolo] = useState(false);
  // ordem canônica dos membros (define a base de cada um) — ref, pq o hook a consulta dentro dos eventos do Pusher
  const ordemRef = useRef<string[]>([]);
  const poseInicial = useCallback((id: string) => {
    const lay = basesDosMembros(ordemRef.current).get(id);
    return lay ? { ...poseNoAssento(lay), sit: true } : null;   // quem ainda não mandou posição aparece sentado na própria base
  }, []);
  const sala = useSala3D(salaId, { poseInicial });
  ordemRef.current = sala.sala?.members ?? [];

  const euSolo = useMemo<PessoaCyber>(() => { const id = (data?.user as { id?: string } | undefined)?.id ?? "local"; return { id, name: data?.user?.name ?? "Visitante", color: id === "local" ? "#45d6ff" : corDoUsuario(id) }; }, [data]);
  // a ORDEM de `sala.members[]` (só cresce) define a base de cada pessoa — igual pra todo mundo
  const membros = useMemo<PessoaCyber[]>(() => {
    const porId = new Map(sala.membros.map((m) => [m.id, m] as const));
    return (sala.sala?.members ?? []).flatMap((id) => { const m = porId.get(id); return m ? [{ id: m.id, name: m.name, color: m.color, fundador: m.fundador === true }] : []; });
  }, [sala.membros, sala.sala?.members]);
  // alguém que entrou depois de eu carregar: rebusca a sala (ordem canônica + nome)
  const { online, recarregar } = sala;
  const pedidos = useRef(new Set<string>());
  useEffect(() => {
    const faltam = online.filter((o) => !membros.some((m) => m.id === o.id) && !pedidos.current.has(o.id));
    if (!faltam.length) return;
    faltam.forEach((o) => pedidos.current.add(o.id));   // 1 refetch por pessoa nova (sem loop se o servidor não a listar)
    void recarregar();
  }, [online, membros, recarregar]);
  const euSala = useMemo<PessoaCyber | null>(() => (sala.eu ? { id: sala.eu.id, name: sala.eu.name, color: sala.eu.color, fundador: sala.eu.fundador === true } : null), [sala.eu]);
  // quem está online (pra voz abrir/fechar as conexões) — antes de qualquer return condicional (ordem dos hooks)
  const onlineIds = useMemo(() => sala.online.map((m) => m.id), [sala.online]);
  // ações privilegiadas do dono (topo, nave): quem decide é o servidor (sessão → fundador). A Zaeon é aberta a todos.
  const pedirAcesso = useCallback(async (alvo: "topo" | "ceu" | "nave" | "dj") => {
    if (!salaId) return { ok: false, erro: "Sem sala." };
    const r = await fetch(`/api/lounge3d/${salaId}/acesso`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alvo }) });
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, erro: (d as { error?: string })?.error ?? "Não autorizado." };
  }, [salaId]);

  // a 1ª entrada no cyberespaço (nasceu no tubo de ensaio): o servidor marca — da próxima vez nasce na base
  const marcarNascimento = useCallback(() => { if (salaId) void fetch(`/api/lounge3d/${salaId}/nasceu`, { method: "POST" }).catch(() => {}); }, [salaId]);
  // o que a pessoa contou pra Zaeon na capela: o servidor guarda (User.cyberPerfil)
  const salvarPerfil = useCallback((perfil: Record<string, string>) => { if (salaId) void fetch(`/api/lounge3d/${salaId}/perfil`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perfil }) }).catch(() => {}); }, [salaId]);

  if (solo) return <CenaCyber modo="tela" eu={euSolo} membros={[euSolo]} aviso="Modo solo — você não aparece para os outros." />;
  if (erro === "login") return <Carregando>Entre na sua conta para entrar no cyberespaço.</Carregando>;
  if (erro || sala.estado === "erro" || sala.estado === "off") {
    return <Carregando><span>Não deu para abrir a sala.{" "}<button type="button" onClick={tentarDeNovo} className="underline">Tentar de novo</button>{" · "}<button type="button" onClick={() => setSolo(true)} className="underline">Entrar sozinho</button></span></Carregando>;
  }
  if (sala.estado === "cheia") {
    return <Carregando><span>Cyberespaço cheio (máximo 5).{" "}<button type="button" onClick={() => setSolo(true)} className="underline">Entrar sozinho</button></span></Carregando>;
  }
  if (!salaId || !euSala || sala.estado === "carregando") return <Carregando />;
  const aviso = avisoRealtime(sala.realtime, sala.motivoRealtime);
  return (
    <CenaCyber
      modo="tela" eu={euSala} membros={membros.length ? membros : [euSala]}
      remotos={sala.remotos} enviarPos={sala.enviarPos} chat={sala.chat} enviarChat={sala.enviarChat}
      tokenConvite={sala.sala?.token ?? null} online={sala.online.length || 1} aviso={aviso}
      souFundador={euSala.fundador === true} pedirAcesso={pedirAcesso}
      novoNoCyber={sala.eu?.novo === true} marcarNascimento={marcarNascimento} salvarPerfil={salvarPerfil}
      recadoQG={sala.recadoQG} enviarRecado={sala.enviarRecado}
      somLounge={sala.somLounge} offsetMusica={sala.offsetMusica} musica={sala.musica}
      naveQG={sala.naveQG} salvarNave={sala.salvarNave}
      canalVoz={sala.canalVoz} onlineIds={onlineIds}
    />
  );
}
