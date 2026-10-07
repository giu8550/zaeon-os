"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
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

export default function MentoresCarrossel({ className = "", semRotulo = false }: { className?: string; /** sem a linha "13 mentores · ao vivo…" */ semRotulo?: boolean }) {
    const [mentores, setMentores] = useState<Mentor[]>(ELENCO);
    const [aoVivo, setAoVivo] = useState(false);
    const trilhoRef = useRef<HTMLDivElement>(null);
    const [podeVoltar, setPodeVoltar] = useState(false);
    const [podeAvancar, setPodeAvancar] = useState(true);
    const [semMovimento, setSemMovimento] = useState(false);
    /** Arrasto em curso ou foco dentro do trilho (hover NAO entra aqui, de proposito). */
    const pausadoRef = useRef(false);
    /** Marca a rolagem causada pelo proprio passo automatico. */
    const programaticoRef = useRef(false);
    /** Ate quando o passo automatico deve ficar quieto depois de um toque. */
    const esperaAteRef = useRef(0);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setSemMovimento(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        let vivo = true;
        // Avatares editáveis (AgentProfile) — só com NEXT_PUBLIC_AGENT_AVATARS=1; falha = sem foto.
        type Foto = { avatarUrl: string | null; nome: string };
        const avatares: Promise<Map<string, Foto>> = agentAvatars()
            ? fetch("/api/agents/public")
                .then((r) => (r.ok ? r.json() : null))
                .then((j) => new Map<string, Foto>((j?.agentes ?? []).map((a: any): [string, Foto] => [String(a.agentKey), { avatarUrl: a.avatarUrl ?? null, nome: String(a.nome ?? "") }])))
                .catch(() => new Map<string, Foto>())
            : Promise.resolve(new Map<string, Foto>());
        Promise.all([fetch("/api/mentors").then((r) => (r.ok ? r.json() : null)).catch(() => null), avatares])
            .then(([j, av]) => {
                if (!vivo) return;
                const base: Mentor[] = Array.isArray(j) && j.length > 0 ? j : ELENCO;
                const comFoto = base.map((m) => { const p = av.get(m.slug); return p ? { ...m, avatarUrl: p.avatarUrl, name: p.nome || m.name } : m; });
                setMentores(comFoto);
                if (Array.isArray(j) && j.length > 0) setAoVivo(true);
            })
            .catch(() => {
                /* banco frio ou rota fora: o ELENCO ja esta na tela */
            });
        return () => {
            vivo = false;
        };
    }, []);

    const sincronizarSetas = useCallback(() => {
        const el = trilhoRef.current;
        if (!el) return;
        setPodeVoltar(el.scrollLeft > 8);
        setPodeAvancar(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    }, []);

    /** Handler do evento `scroll`: mantém as setas em dia. */
    const aoRolar = useCallback(() => {
        sincronizarSetas();
    }, [sincronizarSetas]);

    useEffect(() => {
        sincronizarSetas();
        const el = trilhoRef.current;
        if (!el) return;
        el.addEventListener("scroll", aoRolar, { passive: true });
        window.addEventListener("resize", sincronizarSetas);
        return () => {
            el.removeEventListener("scroll", aoRolar);
            window.removeEventListener("resize", sincronizarSetas);
        };
    }, [sincronizarSetas, aoRolar, mentores.length]);

    /** Largura de um passo = um cartao real medido agora, nunca um numero chutado. */
    const passoAtual = (el: HTMLElement) => {
        const cartao = el.firstElementChild as HTMLElement | null;
        return cartao ? cartao.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    };

    const andar = (direcao: 1 | -1) => {
        const el = trilhoRef.current;
        if (!el) return;
        esperaAteRef.current = Date.now() + 5000; // seta clicada → deixa a pessoa olhar
        el.scrollBy({ left: passoAtual(el) * direcao, behavior: "smooth" });
    };

    /**
     * O trilho anda sozinho: um passo a cada 3.2s, voltando ao inicio na ponta.
     *
     * O QUE O SEGURA -- e o que DELIBERADAMENTE nao segura:
     *
     * - ARRASTO / FOCO: enquanto a pessoa esta com o dedo no trilho ou navegando
     *   por teclado dentro dele, o passo fica quieto.
     * - ROLAGEM MANUAL: depois que ela mesma empurra, o passo espera 8s antes de
     *   voltar a mandar. Sem isso um toque no celular brigaria com o timer meio
     *   segundo depois. `programaticoRef` separa a rolagem que este efeito
     *   causou da que veio do dedo -- as duas disparam o mesmo evento `scroll`,
     *   entao sem essa marca nao da pra distinguir uma da outra.
     * - FORA DA TELA: senao o trilho corre ate o fim enquanto ninguem olha e
     *   quem rola ate aqui encontra a prateleira parada no ultimo cartao.
     *
     * NAO pausa no hover, e essa e a correcao desta versao. A primeira tentativa
     * pausava, e na pratica o carrossel ficava PARADO: o trilho ocupa quase toda
     * a largura util da secao, entao o ponteiro esta em cima dele praticamente
     * o tempo todo em que a pessoa esta olhando para essa parte da pagina. Pausar
     * no hover faz sentido num menu que revela conteudo; aqui os cartoes nao tem
     * nada escondido atras do ponteiro, e o efeito colateral era o recurso
     * inteiro parecer que nao existe.
     *
     * A checagem de visibilidade e um `getBoundingClientRect` no proprio tick, e
     * nao um IntersectionObserver, por dois motivos: e uma leitura a cada 3.2s
     * (nao por quadro), e nao depende de callback -- um observer criado enquanto
     * a aba esta em segundo plano pode receber um unico callback "fora da tela" e
     * nunca mais ser chamado, deixando o trilho travado para sempre.
     *
     * `prefers-reduced-motion` desliga o passo; as setas continuam.
     */
    // Rede de seguranca: se o dedo/mouse solta FORA do trilho, o `pointerup` do
    // elemento nunca chega e o passo ficaria pausado para sempre. O do documento
    // sempre chega.
    useEffect(() => {
        const soltou = () => {
            // So conta se o arrasto tinha COMECADO no trilho; senao um clique
            // qualquer na pagina silenciaria o carrossel por 8s.
            if (!pausadoRef.current) return;
            pausadoRef.current = false;
            esperaAteRef.current = Date.now() + 8000;
        };
        document.addEventListener("pointerup", soltou);
        document.addEventListener("pointercancel", soltou);
        return () => {
            document.removeEventListener("pointerup", soltou);
            document.removeEventListener("pointercancel", soltou);
        };
    }, []);

    useEffect(() => {
        if (semMovimento) return;
        const el = trilhoRef.current;
        if (!el) return;

        // Glide CONTÍNUO e suave. Antes pulava 1 cartão a cada 3,2s com snap-mandatory
        // — daí a sensação abrupta/estalada. Agora avança poucos px por frame; a lista
        // é DUPLICADA no render, então ao cruzar a 1ª metade voltamos o equivalente e o
        // loop fica sem costura (invisível, pois a 2ª cópia está idêntica naquele ponto).
        const VEL = 0.5; // px por frame (~30px/s a 60fps): presente, sem distrair
        let raf = 0;
        const passo = () => {
            raf = requestAnimationFrame(passo);
            if (pausadoRef.current || document.hidden) return;
            if (Date.now() < esperaAteRef.current) return;
            const r = el.getBoundingClientRect();
            if (!(r.bottom > 0 && r.top < window.innerHeight)) return;
            el.scrollLeft += VEL;
            const meia = el.scrollWidth / 2;
            if (meia > 0 && el.scrollLeft >= meia) el.scrollLeft -= meia;
        };
        raf = requestAnimationFrame(passo);
        return () => cancelAnimationFrame(raf);
    }, [semMovimento, mentores.length]);

    return (
        <div className={className}>
            <div className="mb-6 flex items-end justify-between gap-6">
                {semRotulo ? <span /> : (
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-500">
                    {mentores.length} mentores
                    {aoVivo ? " · ao vivo da sala de plugins" : ""}
                </p>
                )}

                {/* As setas sao conveniencia de desktop. No celular o dedo ja faz isso,
                    e um par de botoes so rouba largura de tela. */}
                <div className="hidden md:flex gap-2">
                    <Seta direcao="anterior" ativa={podeVoltar} onClick={() => andar(-1)} />
                    <Seta direcao="proximo" ativa={podeAvancar} onClick={() => andar(1)} />
                </div>
            </div>

            {/* O trilho fica DENTRO da calha da pagina, entao o primeiro cartao nasce
                na mesma margem do titulo e o ultimo visivel e cortado na borda do
                container -- e o corte que diz "tem mais", sem precisar de texto.
                Nao sangra ate a borda da tela de proposito: fazer isso exige 100vw,
                que inclui a barra de rolagem e devolve a pagina a rolagem horizontal
                que acabou de ser consertada. */}
            <div
                ref={trilhoRef}
                onPointerDown={() => {
                    pausadoRef.current = true;
                }}
                onPointerUp={() => {
                    pausadoRef.current = false;
                    esperaAteRef.current = Date.now() + 8000;
                }}
                onWheel={() => {
                    esperaAteRef.current = Date.now() + 5000;
                }}
                onFocusCapture={() => {
                    pausadoRef.current = true;
                }}
                onBlurCapture={() => {
                    pausadoRef.current = false;
                }}
                className="flex gap-4 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {/* Lista DUPLICADA: alimenta o loop sem costura do glide contínuo. */}
                {/* `dark`: os cards dos agentes são VIDRO PRETO nos dois temas (contraste melhor no claro) */}
                {[...mentores, ...mentores].map((m, i) => (
                    <div key={`${m.slug}-${i}`} className="dark shrink-0"><Cartao m={m} indice={i % mentores.length} /></div>
                ))}
            </div>
        </div>
    );
}

/**
 * CRACHÁ do mentor (landing = só vitrine, nada de contratar aqui): pendurado por uma fita com
 * presilha, foto grande (o avatar vivo — pisca e sorri no hover do crachá inteiro), nome, curso, o
 * que entrega e um rodapé de identificação. Sem avatar aprovado → a foto vira a inicial no degradê.
 */
function Cartao({ m, indice }: { m: Mentor; indice: number }) {
    const artefatos = (m.signatureArtifacts ?? []).slice(0, 3);
    const [hover, setHover] = useState(false);
    const id = `ZA-${String((m as { order?: number }).order ?? indice + 1).padStart(3, "0")}`;
    return (
        <div className="shrink-0 w-[250px] sm:w-[262px] pt-7" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
            {/* balanço de crachá pendurado: gira em torno da fita */}
            <div className="relative origin-top transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: hover ? "rotate(-1.6deg) translateY(2px)" : undefined }}>
                {/* fita + presilha */}
                <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -top-7 h-8 w-5 rounded-t-sm bg-gradient-to-b from-cyan-400/0 via-cyan-500/70 to-cyan-500" />
                <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -top-1.5 h-4 w-9 rounded-md bg-gradient-to-b from-slate-200 to-slate-400 shadow-[0_2px_6px_rgba(0,0,0,0.5)] border border-white/60" />
                <article className="relative rounded-[22px] border border-white/10 bg-black/80 backdrop-blur-xl px-5 pt-6 pb-4 flex flex-col items-center text-center shadow-[0_16px_44px_-20px_rgba(0,0,0,0.75)] transition-[border-color,box-shadow] duration-300 hover:border-cyan-500/50 hover:shadow-[0_18px_50px_-20px_rgba(34,211,238,0.45)]">
                    {/* furo do crachá */}
                    <span aria-hidden className="absolute top-2.5 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]" />
                    <div className="w-full flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em]">
                        <span className="text-white/70">Zaeon</span>
                        <span className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">mentor</span>
                    </div>

                    {/* FOTO */}
                    <div className="mt-4 rounded-[18px] p-[3px] bg-gradient-to-b from-cyan-400/50 to-cyan-500/10">
                        <AgentAvatar
                            src={m.avatarUrl}
                            nome={m.name}
                            size={140}
                            agentId={m.slug}
                            hover={hover}
                            className="!rounded-[15px] !border-0"
                            fallback={
                                <span aria-hidden className="grid h-[140px] w-[140px] place-items-center rounded-[15px] bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-5xl font-semibold text-cyan-200">
                                    {m.emoji && m.emoji !== "⟁" ? m.emoji : m.name.slice(0, 1)}
                                </span>
                            }
                        />
                    </div>

                    <h3 className="mt-4 text-[22px] font-semibold tracking-tight leading-none text-white">{m.name}</h3>
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90">{m.course}</p>
                    {m.tagline ? <p className="mt-3 text-[12.5px] leading-snug text-white/80 line-clamp-2 min-h-[2.5em]">{m.tagline}</p> : null}

                    {artefatos.length > 0 ? (
                        <div className="mt-3 flex flex-wrap justify-center gap-1">
                            {artefatos.map((a) => (
                                <span key={a} className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] text-white/85">{a}</span>
                            ))}
                        </div>
                    ) : null}

                    {/* rodapé de identificação */}
                    <div className="mt-4 pt-3 w-full border-t border-dashed border-white/15 flex items-end justify-between gap-3">
                        <span className="flex flex-col items-start">
                            <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-white/45">id</span>
                            <span className="font-mono text-[11px] text-white/85">{id}</span>
                        </span>
                        <span aria-hidden className="h-6 flex-1 max-w-[96px] opacity-70" style={{ background: "repeating-linear-gradient(90deg,rgba(255,255,255,.85) 0 2px,transparent 2px 4px,rgba(255,255,255,.85) 4px 5px,transparent 5px 8px,rgba(255,255,255,.85) 8px 11px,transparent 11px 12px)" }} />
                        {m.guardrail ? (
                            <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/60 border border-white/15 rounded px-1 py-0.5" title={m.guardrail}>edu</span>
                        ) : null}
                    </div>
                </article>
            </div>
        </div>
    );
}

function Seta({
    direcao,
    ativa,
    onClick,
}: {
    direcao: "anterior" | "proximo";
    ativa: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!ativa}
            aria-label={direcao === "anterior" ? "Mentores anteriores" : "Próximos mentores"}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 dark:border-white/12 bg-white/70 dark:bg-white/[0.05] text-slate-700 dark:text-white/80 transition-opacity disabled:opacity-25 hover:bg-white dark:hover:bg-white/[0.10]"
        >
            <span aria-hidden="true" className="text-sm leading-none">
                {direcao === "anterior" ? "←" : "→"}
            </span>
        </button>
    );
}
