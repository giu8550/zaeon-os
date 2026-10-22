/**
 * lib/octa/permissao.ts — o nível de permissão do PROJETO decide quais tools param o laço pedindo o aluno.
 * Fica POR CIMA do guard (modo review/change + file-lock): aprovar aqui não libera o que o guard nega.
 *
 *   auto               só apagar pede (apagar SEMPRE pede, em qualquer nível)
 *   antes_de_publicar  + publicar
 *   antes_de_escrever  + escrever, montar página, escolher design
 */
import type { PermissaoOcta } from "@/lib/octa/projetos";

const ESCRITA = new Set(["octa_escrever", "octa_pagina_montar", "octa_design_escolher"]);

export function precisaAprovacao(permissao: PermissaoOcta, tool: string): boolean {
  if (tool === "octa_apagar") return true;
  if (tool === "octa_publicar") return permissao !== "auto";
  if (ESCRITA.has(tool)) return permissao === "antes_de_escrever";
  return false;
}
