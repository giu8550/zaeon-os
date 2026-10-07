"use client";

/**
 * SpriteAvatar — o motor de SPRITES do avatar vivo (MIT puro, só <img> + timers + CSS).
 *
 * Todos os quadros ficam empilhados e pré-carregados; trocar de expressão = trocar a opacidade
 * (instantâneo, sem piscar branco). Os quadros vêm do pipeline já alinhados à base (só a região
 * mudada difere), então a troca não treme.
 *   vivo     → respira (escala sutil) + pisca em ritmo humano + boca anima ao falar
 *   pensando → quadro "think" + balanço leve · feliz → "happy" · erro → "confused" + tremidinha
 *   ouvindo  → o usuário está digitando: inclina pro composer e acena de leve com a cabeça
 *   hover    → "smile" + olha um pouco pro cursor (paralaxe)
 *   boca     → modo voz: o nível do áudio escolhe o quadro da boca (no lugar das sílabas)
 *   reduzido → só o quadro do estado, sem nenhum movimento
 */
import { useEffect, useMemo, useState } from "react";
import {
  ESTADOS_SPRITE, duracaoSilaba, proximaPiscada, quadroDaBoca, quadroDoSinal, quadrosDeFala,
  type AvatarManifest, type EstadoSprite, type SinalAvatar,
} from "@/lib/avatars/estados";

const PISCADA_MS = 110;

export default function SpriteAvatar({
  manifest, sinal, hover, vivo, reduzido, pequeno, olhar, boca = null,
}: {
  manifest: AvatarManifest;
  sinal: SinalAvatar;
  hover: boolean;
  /** tem vaga no orçamento de vida (respira/pisca/anima a boca) */
  vivo: boolean;
  reduzido: boolean;
  /** usar as miniaturas (avatar ≤ 96px) */
  pequeno: boolean;
  /** deslocamento do olhar (-1..1) — paralaxe do hover */
  olhar?: { x: number; y: number } | null;
  /** modo voz: nível do áudio 0..1 (null = boca por sílabas) */
  boca?: number | null;
}) {
  const urls = pequeno ? manifest.pequeno : manifest.estados;
  const tem = useMemo(() => (e: EstadoSprite) => !!urls[e], [urls]);
  const repouso = quadroDoSinal(sinal, hover, tem);

  const [piscando, setPiscando] = useState(false);
  const [quadroBoca, setBoca] = useState<EstadoSprite | null>(null);
  const animar = vivo && !reduzido;

  // PISCAR — só sobre o quadro neutro (piscar por cima de "think"/"happy" trocaria a expressão)
  useEffect(() => {
    if (!animar || repouso !== "idle" || !tem("blink")) { setPiscando(false); return; }
    let t: ReturnType<typeof setTimeout>;
    let vivoEf = true;
    const ciclo = () => {
      const { esperaMs, dupla } = proximaPiscada();
      t = setTimeout(() => {
        if (!vivoEf) return;
        setPiscando(true);
        t = setTimeout(() => {
          setPiscando(false);
          if (dupla) t = setTimeout(() => { setPiscando(true); t = setTimeout(() => { setPiscando(false); ciclo(); }, PISCADA_MS); }, 140);
          else ciclo();
        }, PISCADA_MS);
      }, esperaMs);
    };
    ciclo();
    return () => { vivoEf = false; clearTimeout(t); };
  }, [animar, repouso, tem]);

  // FALAR — boca irregular (sílabas de 90–170ms, pausas de vez em quando)
  useEffect(() => {
    if (sinal !== "falando" || !animar || boca !== null) { setBoca(null); return; }
    const ciclo = quadrosDeFala(tem);
    if (ciclo.length < 2) { setBoca(null); return; }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const passo = () => {
      i = (i + 1) % ciclo.length;
      const pausa = ciclo[i] === "idle" && Math.random() < 0.18;
      setBoca(ciclo[i]);
      t = setTimeout(passo, pausa ? 260 + Math.random() * 220 : duracaoSilaba());
    };
    t = setTimeout(passo, duracaoSilaba());
    return () => clearTimeout(t);
  }, [sinal, animar, tem, boca]);

  const bocaVoz = boca !== null && !reduzido ? quadroDaBoca(boca, tem) : null;
  const atual: EstadoSprite = bocaVoz ?? quadroBoca ?? (piscando ? "blink" : repouso);

  // Classes de movimento do conjunto (keyframes abaixo, desligados em reduced-motion)
  const mov = reduzido ? "" : sinal === "pensando" ? "zav-pensa" : sinal === "erro" ? "zav-treme" : sinal === "ouvindo" ? "zav-ouve" : animar ? "zav-respira" : "";
  const desloc = !reduzido && olhar ? `translate(${(olhar.x * 3).toFixed(2)}%, ${(olhar.y * 2).toFixed(2)}%)` : undefined;
  return (
    <span aria-hidden className={`zav-quadros absolute inset-0 ${mov}`}>
      <style>{ESTILO}</style>
      <span className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: desloc }}>
        {ESTADOS_SPRITE.filter(tem).map((e) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={e}
            src={urls[e]}
            alt=""
            draggable={false}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover select-none"
            style={{ opacity: e === atual ? 1 : 0 }}
          />
        ))}
      </span>
    </span>
  );
}

const ESTILO = `
@keyframes zavRespira { 0%,100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.018) translateY(-0.8%); } }
@keyframes zavPensa { 0%,100% { transform: rotate(-2deg) translateY(0); } 50% { transform: rotate(2deg) translateY(-1%); } }
@keyframes zavOuve { 0%,30%,100% { transform: scale(1.035) translateY(1.5%) rotate(0); } 10% { transform: scale(1.035) translateY(3%) rotate(1deg); } 20% { transform: scale(1.035) translateY(1.5%) rotate(0); } }
@keyframes zavTreme { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-3%); } 40% { transform: translateX(3%); } 60% { transform: translateX(-2%); } 80% { transform: translateX(1%); } }
.zav-respira { animation: zavRespira 4.2s ease-in-out infinite; transform-origin: 50% 85%; }
.zav-pensa { animation: zavPensa 2.6s ease-in-out infinite; transform-origin: 50% 90%; }
.zav-treme { animation: zavTreme .5s ease-in-out 1; }
.zav-ouve { animation: zavOuve 3.2s ease-in-out infinite; transform-origin: 50% 90%; }
@media (prefers-reduced-motion: reduce) { .zav-respira, .zav-pensa, .zav-treme, .zav-ouve { animation: none; } }
`;
