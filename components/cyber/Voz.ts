/**
 * Voz — VOZ AO VIVO no cyberespaço: malha WebRTC (cada um conecta com os outros da sala, ≤ 4 conexões) com
 * PUSH-TO-TALK (segurar G / o botão do celular). O áudio vai direto entre navegadores; o Colyseus só leva o
 * SIGNALING (offer/answer/ICE) — canal "rtc" da room — e o indicador "falando".
 *  - "perfect negotiation" (padrão do W3C): os dois lados podem negociar quando quiserem; na colisão, o lado
 *    "educado" (polite, decidido pelo userId) cede — nada de travar com duas ofertas ao mesmo tempo;
 *  - o microfone só é pedido no 1º G (permissão 1×); depois, segurar/soltar só liga/desliga a trilha (sem
 *    renegociar → instantâneo);
 *  - o áudio de quem fala sai pelo avatar dele (AudioCyber.voz: posicional, perto = mais alto).
 */
import type { CanalVoz } from "@/components/lounge/salaColyseus";
import { educado } from "@/lib/cyber/voz";

type Par = { pc: RTCPeerConnection; fazendoOferta: boolean; ignorandoOferta: boolean; educado: boolean; remotoStream: MediaStream | null };

export type VozHandle = {
  /** segurar (true) / soltar (false) o push-to-talk */
  segurar(on: boolean): Promise<void>;
  /** quem está na sala agora (userIds, sem eu) — abre/fecha as conexões */
  pares(ids: string[]): void;
  dispose(): void;
};

export function criarVoz(o: {
  euId: string;
  canal: CanalVoz;
  /** o áudio de alguém chegou (ou acabou: null) → o engine prende no avatar */
  aoAudio: (userId: string, stream: MediaStream | null) => void;
  /** erro amigável (sem microfone, permissão negada…) */
  aoErro?: (msg: string) => void;
}): VozHandle {
  const pares = new Map<string, Par>();
  let local: MediaStream | null = null, pedindo: Promise<MediaStream | null> | null = null, vivo = true, falando = false;

  const criarPar = (id: string): Par => {
    const pc = new RTCPeerConnection({ iceServers: o.canal.ice.length ? o.canal.ice : [{ urls: "stun:stun.l.google.com:19302" }] });
    const p: Par = { pc, fazendoOferta: false, ignorandoOferta: false, educado: educado(o.euId, id), remotoStream: null };
    pc.onnegotiationneeded = async () => {
      try { p.fazendoOferta = true; await pc.setLocalDescription(); o.canal.enviar(id, { d: pc.localDescription }); }
      catch (e) { console.warn("[voz] negociação falhou", e); }
      finally { p.fazendoOferta = false; }
    };
    pc.onicecandidate = ({ candidate }) => { if (candidate) o.canal.enviar(id, { c: candidate }); };
    pc.ontrack = ({ track, streams }) => {
      const s = streams[0] ?? new MediaStream([track]);
      if (p.remotoStream !== s) { p.remotoStream = s; o.aoAudio(id, s); }
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") pc.restartIce?.(); };
    // eu já tenho microfone? a conexão nova já leva a trilha (desligada até eu segurar G)
    if (local) for (const t of local.getAudioTracks()) pc.addTrack(t, local);
    pares.set(id, p);
    return p;
  };
  const fecharPar = (id: string) => {
    const p = pares.get(id); if (!p) return;
    try { p.pc.close(); } catch { /* já */ }
    pares.delete(id); o.aoAudio(id, null);
  };

  // signaling que chega pelo Colyseus (o remetente vem da SESSÃO no servidor)
  const desassinar = o.canal.assinar(async (from, raw) => {
    if (!vivo) return;
    const p = pares.get(from) ?? criarPar(from), pc = p.pc;
    const m = raw as { d?: RTCSessionDescriptionInit; c?: RTCIceCandidateInit };
    try {
      if (m?.d) {
        const colisao = m.d.type === "offer" && (p.fazendoOferta || pc.signalingState !== "stable");
        p.ignorandoOferta = !p.educado && colisao;
        if (p.ignorandoOferta) return;
        await pc.setRemoteDescription(m.d);
        if (m.d.type === "offer") { await pc.setLocalDescription(); o.canal.enviar(from, { d: pc.localDescription }); }
      } else if (m?.c) {
        try { await pc.addIceCandidate(m.c); } catch (e) { if (!p.ignorandoOferta) throw e; }
      }
    } catch (e) { console.warn("[voz] signaling", e); }
  });

  const microfone = async (): Promise<MediaStream | null> => {
    if (local) return local;
    if (!pedindo) pedindo = (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        for (const t of s.getAudioTracks()) t.enabled = false;
        local = s;
        for (const p of pares.values()) for (const t of s.getAudioTracks()) p.pc.addTrack(t, s);   // → renegocia (1×)
        return s;
      } catch (e) {
        const nome = (e as { name?: string })?.name;
        o.aoErro?.(nome === "NotAllowedError" ? "Microfone bloqueado — libere nas permissões do navegador." : "Não deu pra usar o microfone.");
        return null;
      } finally { pedindo = null; }
    })();
    return pedindo;
  };

  return {
    async segurar(on) {
      if (!vivo || on === falando) return;
      falando = on;
      if (on) {
        const s = await microfone();
        if (!s || !falando) return;   // soltou antes da permissão
        for (const t of s.getAudioTracks()) t.enabled = true;
        o.canal.fala(true);
      } else {
        for (const t of local?.getAudioTracks() ?? []) t.enabled = false;
        o.canal.fala(false);
      }
    },
    pares(ids) {
      const quero = new Set(ids.filter((i) => i !== o.euId));
      for (const id of [...pares.keys()]) if (!quero.has(id)) fecharPar(id);
      // quem tem microfone já abre a conexão; sem microfone, a do outro (que tem) chega pelo signaling
      for (const id of quero) if (!pares.has(id) && local) criarPar(id);
    },
    dispose() {
      vivo = false; desassinar();
      for (const id of [...pares.keys()]) fecharPar(id);
      for (const t of local?.getTracks() ?? []) t.stop();
      local = null;
      if (falando) o.canal.fala(false);
    },
  };
}
