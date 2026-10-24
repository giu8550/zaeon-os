"use client";
/** a persona do painel dos documentos = o agente escolhido no seletor da sidebar (null = sem avatar: o Octa Code) */
import { useEffect, useState } from "react";
import { EVT_PERSONA, personaDoAgente, personaSalva, type PersonaId } from "@/lib/research/zaeonEventos";

export function usePersona(): PersonaId | null {
  const [p, setP] = useState<PersonaId | null>("aura");
  useEffect(() => {
    setP(personaSalva());
    const on = (e: Event) => setP(personaDoAgente((e as CustomEvent).detail));
    window.addEventListener(EVT_PERSONA, on);
    return () => window.removeEventListener(EVT_PERSONA, on);
  }, []);
  return p;
}
