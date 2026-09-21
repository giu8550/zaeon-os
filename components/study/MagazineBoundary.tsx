"use client";

/**
 * Cinto de segurança do Modo Revista.
 *
 * O renderer novo mede fonte, mexe em canvas e faz conta de geometria — tem mais
 * superfície pra quebrar do que o balão de sempre. A regra do plano é fail-safe:
 * QUALQUER falha aqui cai no renderer antigo, sem erro na cara do aluno. Uma resposta
 * feia é um problema; uma resposta que some é outro.
 */
import { Component, type ReactNode } from "react";

export default class MagazineBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { caiu: boolean }
> {
  state = { caiu: false };

  static getDerivedStateFromError() {
    return { caiu: true };
  }

  componentDidCatch(erro: unknown) {
    console.warn("[revista] caiu pro renderer padrão:", erro);
  }

  render() {
    return this.state.caiu ? this.props.fallback : this.props.children;
  }
}
