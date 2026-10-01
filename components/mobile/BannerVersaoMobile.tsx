"use client";
/**
 * Nas salas completas, no celular: OFERECE a versão mobile (nunca força). "Continuar aqui"
 * grava a preferência `full` e o banner não volta. Atrás de NEXT_PUBLIC_MOBILE_UI.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/lib/ui/useIsMobile";
import { cookiePref, deveOferecerMobile, destinoMobile, lerPref, mobileUiOn } from "@/lib/ui/mobilePref";

export function BannerVersaoMobile() {
  const path = usePathname();
  const ehMobile = useIsMobile();
  const [mostrar, setMostrar] = useState(false);
  const [destino, setDestino] = useState("/m");
  useEffect(() => {
    const pref = lerPref(document.cookie);
    setMostrar(deveOferecerMobile({ flag: mobileUiOn(), path, ehMobile, pref }));
    setDestino(destinoMobile(path, window.location.search));
  }, [path, ehMobile]);
  if (!mostrar) return null;
  return (
    <div role="region" aria-label="Versão para celular"
      className="fixed inset-x-3 z-[60] flex items-center gap-2 rounded-2xl border border-white/60 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 dark:text-white"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <span className="flex-1">Tem uma versão feita pro celular.</span>
      <a href={destino} onClick={() => { document.cookie = cookiePref("mobile"); }}
        className="min-h-[44px] flex items-center rounded-full bg-cyan-700 px-3 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 dark:bg-cyan-500 dark:text-slate-950">
        Abrir versão mobile
      </a>
      <button type="button" onClick={() => { document.cookie = cookiePref("full"); setMostrar(false); }}
        className="min-h-[44px] rounded-full px-2 text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 dark:text-white/70">
        Continuar aqui
      </button>
    </div>
  );
}
