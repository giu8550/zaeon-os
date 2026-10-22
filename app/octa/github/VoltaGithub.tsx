"use client";
/**
 * A janelinha do OAuth volta aqui (?gh=connected|state|auth|error|unconfigured): avisa a IDE que abriu
 * (postMessage só pra mesma origem, sem nenhum dado além do motivo) e se fecha. Sem janela-mãe (pop-up bloqueado,
 * foi na mesma aba), mostra o resultado e o caminho de volta pro laboratório.
 */
import { useEffect, useState } from "react";

const TEXTO: Record<string, string> = {
  connected: "GitHub conectado! Pode voltar pro Octa.",
  state: "A conexão expirou ou veio de outra aba. Tente conectar de novo.",
  auth: "Entre na sua conta da Zaeon e tente de novo.",
  unconfigured: "O login com GitHub não está configurado neste servidor.",
  error: "O GitHub não completou a conexão. Tente de novo.",
};

export default function VoltaGithub() {
  const [motivo, setMotivo] = useState<string | null>(null);
  useEffect(() => {
    const gh = new URLSearchParams(window.location.search).get("gh") ?? "error";
    const m = gh in TEXTO ? gh : "error";
    setMotivo(m);
    if (window.opener && !window.opener.closed) {
      try { window.opener.postMessage({ tipo: "octa-github", gh: m }, window.location.origin); } catch { /* */ }
      if (m === "connected") setTimeout(() => window.close(), 600);
    }
  }, []);
  if (!motivo) return null;
  return (
    <div className="max-w-sm text-center space-y-3">
      <p className="text-[15px]">{TEXTO[motivo]}</p>
      <a href="/research-lab" className="inline-block text-[13px] underline text-[#74ade8]">Voltar pro laboratório</a>
    </div>
  );
}
