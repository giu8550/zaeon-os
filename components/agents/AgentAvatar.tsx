"use client";

/**
 * AgentAvatar — o rosto do agente, o MESMO componente na landing, no canal, no chat e no admin.
 *
 * Sem `agentId` (ou agente sem avatar vivo): a foto (AgentProfile.avatarUrl) com fallback GRACIOSO
 * — sem foto, a inicial num disco de vidro. Nunca quebra, nunca 404 na cara do usuário.
 *
 * Com `agentId` + manifesto de avatar vivo (public/avatars ou gerado no admin): o personagem
 * anime "com vida" — respira, pisca, sorri no hover, pensa, fala junto ao stream e sorri ao
 * concluir (`estado` = o sinal que o app já tem). Motor: Live2D quando o manifesto tem modelo
 * próprio, senão sprite; NEXT_PUBLIC_AVATAR_ENGINE=sprite força sprites; qualquer falha cai no sprite.
 * Performance: lazy (só monta os quadros quando entra na tela), no máx. 2 vivos por vez (1 no
 * celular), o resto fica no quadro estático; prefers-reduced-motion = sem movimento.
 */
import dynamic from "next/dynamic";
import { useRef, useState, type PointerEvent } from "react";
import { inicial } from "@/lib/agents/roster";
import { LIMIAR_PEQUENO_PX, type AvatarManifest, type SinalAvatar } from "@/lib/avatars/estados";
import { PRIORIDADE } from "@/lib/avatars/vida";
import SpriteAvatar from "./avatar/SpriteAvatar";
import { useAmbienteAvatar, useManifesto, useNaTela, usePresenca, useSinalComSorriso, useVaga } from "./avatar/hooks";
import { motorAvatar } from "./avatar/motor";

const Live2DAvatar = dynamic(() => import("./avatar/Live2DAvatar"), { ssr: false });

type Props = {
  src?: string | null;
  nome: string;
  size?: number;
  className?: string;
  emoji?: string | null;
  /** persona.id / mentor.slug — liga o avatar vivo se houver manifesto. */
  agentId?: string | null;
  /** O que o agente está fazendo agora (pensando → falando → idle = sorri ao concluir). */
  estado?: SinalAvatar;
  /** Hover controlado pelo card inteiro (senão, o hover do próprio avatar). */
  hover?: boolean;
  /** Selecionado/ativo na UI → prioridade de vida acima dos outros. */
  destaque?: boolean;
  /** false = sempre estático (ex.: listas longas). */
  vivo?: boolean;
  /** Prévia do estúdio: manifesto em mãos (data URLs), sem buscar. */
  manifest?: AvatarManifest | null;
  /**
   * Espelhar o CHAT (lib/avatars/presenca.ts): o estado vem do que a conversa publica — todos os
   * rostos do agente fazem a mesma coisa ao mesmo tempo. Sobrepõe `estado`/`boca`.
   */
  presenca?: boolean;
  /** Modo voz: nível do áudio 0..1 → boca segue a voz. */
  boca?: number | null;
};

export default function AgentAvatar(p: Props) {
  const doServidor = useManifesto(p.manifest ? null : p.agentId);
  const manifest = p.manifest ?? doServidor;
  if (!manifest) return <Foto {...p} />;
  return <AvatarVivo {...p} manifest={manifest} />;
}

function Foto({ src, nome, size = 32, className = "", emoji }: Props) {
  const [falhou, setFalhou] = useState(false);
  const ok = !!src && !falhou;
  return (
    <span className={`${MOLDURA} ${className}`} style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) }} title={nome} aria-label={nome}>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt="" aria-hidden className="h-full w-full object-cover" onError={() => setFalhou(true)} loading="lazy" />
      ) : (
        <span aria-hidden>{emoji && emoji !== "⟁" ? emoji : inicial(nome)}</span>
      )}
    </span>
  );
}

function AvatarVivo({ nome, size = 32, className = "", estado: estadoProp = "idle", hover: hoverExterno, destaque, vivo: podeViver = true, manifest, presenca: espelhar, boca: bocaProp = null }: Props & { manifest: AvatarManifest }) {
  const presenca = usePresenca(espelhar ? manifest.agentId : null);
  const estado = espelhar ? presenca.sinal : estadoProp;
  const boca = espelhar ? presenca.boca : bocaProp;
  const ref = useRef<HTMLSpanElement>(null);
  const naTela = useNaTela(ref);
  const { reduzido, lite } = useAmbienteAvatar();
  const [hoverProprio, setHoverProprio] = useState(false);
  const [olhar, setOlhar] = useState<{ x: number; y: number } | null>(null);
  const [live2dFalhou, setLive2dFalhou] = useState(false);
  const hover = hoverExterno ?? hoverProprio;
  const sinal = useSinalComSorriso(estado);

  // prioridade de vida: reagindo > hover/selecionado > parado na tela (no celular, parado não pede)
  const ativo = sinal !== "idle";
  const prioridade = !podeViver || !naTela || reduzido ? PRIORIDADE.nenhuma
    : ativo ? (destaque ? PRIORIDADE.protagonista : PRIORIDADE.ativo)
    : hover || destaque ? PRIORIDADE.interacao
    : lite ? PRIORIDADE.nenhuma : PRIORIDADE.ambiente;
  const vivo = useVaga(prioridade, lite);

  const pequeno = size <= LIMIAR_PEQUENO_PX;
  const usarLive2D = motorAvatar() === "live2d" && !!manifest.live2d && !lite && !live2dFalhou;
  // paralaxe "olha pro cursor" só em avatar grande o bastante pra se notar
  const onMove = size >= 48 && !reduzido ? (e: PointerEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOlhar({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 });
  } : undefined;

  return (
    <span
      ref={ref}
      className={`${MOLDURA} relative ${className}`}
      style={{ width: size, height: size, background: manifest.cor ? `linear-gradient(160deg, ${manifest.cor}55, ${manifest.cor})` : undefined }}
      title={nome}
      aria-label={nome}
      role="img"
      onPointerEnter={() => setHoverProprio(true)}
      onPointerLeave={() => { setHoverProprio(false); setOlhar(null); }}
      onPointerMove={onMove}
    >
      {!naTela ? (
        // fora da tela: só o idle (lazy) — nada de baixar os outros quadros
        // eslint-disable-next-line @next/next/no-img-element
        <img src={(pequeno ? manifest.pequeno : manifest.estados).idle} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : usarLive2D ? (
        <Live2DAvatar manifest={manifest} sinal={sinal} hover={hover} vivo={vivo} reduzido={reduzido} tamanho={size} onFalha={() => setLive2dFalhou(true)} />
      ) : (
        <SpriteAvatar manifest={manifest} sinal={sinal} hover={hover} vivo={vivo} reduzido={reduzido} pequeno={pequeno} olhar={hover ? olhar : null} boca={boca} />
      )}
    </span>
  );
}

const MOLDURA =
  "inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 dark:border-white/15 bg-gradient-to-br from-sky-200/80 to-blue-300/60 dark:from-cyan-500/25 dark:to-blue-500/20 text-blue-900 dark:text-cyan-100 font-bold select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]";
