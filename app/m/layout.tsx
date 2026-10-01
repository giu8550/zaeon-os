/**
 * /m — o app mobile (coluna única). Atrás de NEXT_PUBLIC_MOBILE_UI: desligado, a rota não
 * existe (404), então o merge não muda nada até ligar. Navbar e widget de chat do site se
 * escondem sozinhos em /m (checam o pathname); aqui não entra StarBackground/ParticleSystem.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Zaeon", robots: { index: false } };

export default function LayoutMobile({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_MOBILE_UI !== "1") notFound();
  return <div className="min-h-[100dvh]">{children}</div>;
}
