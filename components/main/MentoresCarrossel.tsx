"use client";

import React, { useEffect, useRef, useState } from "react";
import TrilhoCarrossel from "@/components/ui/TrilhoCarrossel";
import Cracha, { useHolofote, type DadosCracha } from "@/components/agents/Cracha";
import { intercalar, montarVitrine, nativosVitrine, type AgenteVitrine, type PerfilPublico } from "@/lib/agents/nativos";
import { agentAvatars } from "@/lib/canal/flags";

/**
 * Carrossel dos MENTORES reais — os mesmos 13 que vivem na sala de Plugins.
 *
 * Fonte: `GET /api/mentors`, que e publico e ja devolve a forma certa para uma
 * vitrine: slug, curso, codinome, emoji, tagline, artefatos assinatura, fontes,
 * nivel academico, guardrail e `degradedSkills`. O `personaText` NAO vem nessa
 * rota -- e isso e proposital e importante: as personas sao o produto, e um
 * import direto de `lib/agent/mentors` colocaria os 13 prompts inteiros dentro
 * do bundle publico da landing, legiveis por qualquer um com o DevTools aberto.
 *
 * O ELENCO abaixo nao e invencao nem placeholder: sao os mesmos nomes, cursos e
 * taglines que a rota devolve, mantidos aqui so para dois casos reais -- o banco
 * frio (o seed roda no primeiro GET; antes dele a colecao esta vazia) e a rota
 * indisponivel. A landing e a primeira coisa que alguem ve; ela nao pode
 * aparecer com uma prateleira vazia porque o Mongo demorou a acordar. Quando a
 * rota responde, o que ela diz vale.
 */

type Mentor = {
    slug: string;
    course: string;
    name: string;
    emoji?: string;
    tagline?: string | null;
    signatureArtifacts?: string[];
    academicLevel?: string;
    guardrail?: string | null;
    /** foto editável (AgentProfile) — vem de /api/agents/public; sem foto → emoji/inicial. */
    avatarUrl?: string | null;
};

/** Os 13, na ordem do seed. So campos que a rota publica ja expoe. */
const ELENCO: Mentor[] = [
    { slug: "medicina", course: "Medicina", name: "Osler", tagline: "Pensa como um clínico e professor de medicina sênior.", signatureArtifacts: ["fluxograma clínico", "caso clínico"], guardrail: "Educacional" },
    { slug: "enfermagem", course: "Enfermagem", name: "Nightingale", tagline: "Pensa como enfermeira(o) docente sênior.", signatureArtifacts: ["checklist de cuidado", "cálculo de dosagem"], guardrail: "Educacional" },
    { slug: "biologia", course: "Biologia", name: "Darwin", tagline: "Pensa como biólogo(a) sênior — da célula ao ecossistema.", signatureArtifacts: ["timeline evolutiva", "molécula 3D"] },
    { slug: "eng-computacao", course: "Engenharia da Computação", name: "Turing", tagline: "Debuga junto e ensina o padrão, não só o conserto.", signatureArtifacts: ["código", "diagrama", "curva de complexidade"] },
    { slug: "eng-energias", course: "Engenharia de Energias", name: "Tesla", tagline: "Sempre mostra as contas.", signatureArtifacts: ["diagrama de sistema", "gráfico", "derivação"] },
    { slug: "matematica", course: "Matemática", name: "Noether", tagline: "Valoriza a demonstração e a intuição por trás dela.", signatureArtifacts: ["prova passo a passo", "gráfico de função"] },
    { slug: "fisica", course: "Física", name: "Feynman", tagline: "Parte do fenômeno e da intuição antes da matemática.", signatureArtifacts: ["diagrama", "plot", "derivação"] },
    { slug: "agronomia", course: "Agronomia", name: "Borlaug", tagline: "Solo, clima e manejo com número em cima.", signatureArtifacts: ["curva de produtividade", "plano de manejo"] },
    { slug: "quimica", course: "Química", name: "Mendeleev", tagline: "Mostra a estrutura antes de falar da reação.", signatureArtifacts: ["molécula 3D", "mecanismo de reação"] },
    { slug: "eng-civil", course: "Engenharia Civil", name: "Eiffel", tagline: "Estrutura primeiro, estética depois.", signatureArtifacts: ["diagrama de esforços", "memorial de cálculo"] },
    { slug: "veterinaria", course: "Medicina Veterinária", name: "Pasteur", tagline: "Clínica animal com raciocínio por mecanismo.", signatureArtifacts: ["caso clínico", "fluxo de procedimento"], guardrail: "Educacional" },
    { slug: "psicologia", course: "Psicologia", name: "James", tagline: "Teoria com evidência, nunca aconselhamento clínico.", signatureArtifacts: ["mapa conceitual", "leitura crítica"], guardrail: "Educacional" },
    { slug: "farmacia", course: "Farmácia", name: "Kekulé", tagline: "Da molécula ao efeito, passo a passo.", signatureArtifacts: ["molécula 3D", "via metabólica"], guardrail: "Educacional" },
];

export default function MentoresCarrossel({ className = "", semRotulo = false, leve = false }: { className?: string; /** sem a linha "13 mentores · ao vivo…" */ semRotulo?: boolean; /** crachás só com foto, nome e função + destaque de quem passa pelo meio */ leve?: boolean }) {
    const [mentores, setMentores] = useState<Mentor[]>(ELENCO);
    /** Perfis públicos (Modo CEO): crachá editado, quem está ativo, ordem. */
    const [perfis, setPerfis] = useState<PerfilPublico[]>([]);
    // Os NATIVOS da casa (Aura, Nina, Caio…) misturados aos mentores plugáveis na vitrine.
    const grupos = montarVitrine(nativosVitrine(), mentores.map((m) => ({ ...m, tipo: "mentor" as const })), perfis);
    const nativos = grupos.nativos;
    const vitrine: AgenteVitrine[] = intercalar<AgenteVitrine>(grupos.nativos, grupos.mentores);
    const [aoVivo, setAoVivo] = useState(false);
    const trilhoRef = useRef<HTMLDivElement>(null);
    // HOLOFOTE: um crachá visível por vez fica "em cena" (pula, dá um oi, sorri, faz caras)
    const cena = useHolofote(trilhoRef, vitrine.length * 2);
    useEffect(() => {
        let vivo = true;
        // Perfis (AgentProfile: crachá, ativo, ordem, foto) — só com NEXT_PUBLIC_AGENT_AVATARS=1; falha = padrão.
        const perfisP: Promise<PerfilPublico[]> = agentAvatars()
            ? fetch("/api/agents/public").then((r) => (r.ok ? r.json() : null)).then((j) => (Array.isArray(j?.agentes) ? j.agentes : [])).catch(() => [])
            : Promise.resolve([]);
        Promise.all([fetch("/api/mentors").then((r) => (r.ok ? r.json() : null)).catch(() => null), perfisP])
            .then(([j, ps]) => {
                if (!vivo) return;
                setMentores(Array.isArray(j) && j.length > 0 ? j : ELENCO);
                setPerfis(ps);
                if (Array.isArray(j) && j.length > 0) setAoVivo(true);
            })
            .catch(() => {
                /* banco frio ou rota fora: o ELENCO ja esta na tela */
            });
        return () => {
            vivo = false;
        };
    }, []);

    return (
        // a mecânica (glide contínuo, destaque no meio, setas) mora no TrilhoCarrossel — a dos blueprints anda igual
        <TrilhoCarrossel
            className={className}
            n={vitrine.length}
            chave={mentores.length}
            trilhoRef={trilhoRef}
            rotuloSetas={{ anterior: "Mentores anteriores", proximo: "Próximos mentores" }}
            rotulo={semRotulo ? undefined : (
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-500">
                    {nativos.length} nativos · {mentores.length} mentores
                    {aoVivo ? " · ao vivo da sala de plugins" : ""}
                </p>
            )}
            // `dark`: os cards dos agentes são VIDRO PRETO nos dois temas (contraste melhor no claro)
            render={(i, { indice, noCentro }) => (
                <div key={`${vitrine[i]!.slug}-${indice}`} className="dark shrink-0"><Cracha d={dadosCracha(vitrine[i]!, i)} emCena={indice === cena} noCentro={leve && noCentro} leve={leve} estavel /></div>
            )}
        />
    );
}

/** Agente da vitrine → dados do crachá. ID: nativos ZA-N01…, mentores ZA-001… */
function dadosCracha(m: AgenteVitrine, indice: number): DadosCracha {
    const n = m.order ?? indice + 1;
    return {
        agentId: m.slug,
        nome: m.name,
        curso: m.course,
        tagline: m.tagline,
        artefatos: m.signatureArtifacts,
        emoji: m.emoji,
        foto: m.avatarUrl,
        id: m.tipo === "nativo" ? `ZA-N${String(n).padStart(2, "0")}` : `ZA-${String(n).padStart(3, "0")}`,
        rotulo: m.tipo,
        educacional: !!m.guardrail,
        redes: m.redes,
    };
}
