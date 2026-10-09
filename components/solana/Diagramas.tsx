"use client";

/**
 * Diagramas da camada verificável (Sobre nós) — todos ancorados no código:
 *
 *  FluxoVerificacaoDiagrama  produzido (agentes) → revisor humano → credencial verificável (Solana)
 *                            app/api/academic/[id]/verificar + lib/aura/ledger + lib/solana/credentials
 *  PrivacidadeDiagrama       o que fica privado (documento, nome, e-mail) × o que vai pra cadeia (a prova)
 *                            lib/solana/credentials.buildNftMetadata · academic/[id]/doc (privado)
 *  PresencaDiagrama          o que os outros veem no ciberespaço (nome de exibição, cor, avatar)
 *                            app/api/lounge3d/[id]/rt-token · server/colyseus LoungeRoom.Jogador
 *  ChancelaDiagrama          o portão: papel ✓ vínculo ✓ não-é-você ✓ documento ✓ → senão 403
 *                            lib/aura/academico.elegibilidade / metodoPermitido
 *  LivroRazaoDiagrama        ledger append-only: 1× por (usuário, fonte, ref); reversão = evento negativo
 *                            lib/aura/ledger.grantAura / reverseAura
 *
 * Os fluxos principais são HTML (empilham no celular e são legíveis por leitor de tela); os
 * mini-diagramas são SVG com viewBox pequeno (texto grande o bastante no celular). Sem estrobo:
 * só fade/slide com framer-motion, uma vez.
 */
import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";
import SolanaMark from "./SolanaMark";
import IconeCredencial, { MedalhaoIcone, type NomeIcone } from "./IconesCredencial";

const aparecer = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay },
});

/* ───────────────────────── setas (HTML) ───────────────────────── */

function Seta({ rotulo, bloqueada = false, delay = 0 }: { rotulo?: string; bloqueada?: boolean; delay?: number }) {
  return (
    <motion.div {...aparecer(delay)} className="flex xl:flex-col items-center justify-center gap-2 self-center px-2 xl:px-0 xl:w-[120px] shrink-0" aria-hidden>
      <svg viewBox="0 0 120 40" className="h-10 w-[120px] rotate-90 xl:rotate-0 text-cyan-500 dark:text-cyan-300" focusable="false">
        <path d="M6 20 H98" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={bloqueada ? "5 5" : undefined} strokeOpacity={bloqueada ? 0.5 : 1} />
        {bloqueada ? (
          <g stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round">
            <path d="M52 12 L68 28 M68 12 L52 28" />
          </g>
        ) : (
          <path d="M96 12 L112 20 L96 28 Z" fill="currentColor" />
        )}
      </svg>
      {rotulo && (
        <span className={`text-[9px] font-black uppercase tracking-[0.2em] text-center leading-tight max-w-[120px] ${bloqueada ? "text-rose-500" : "text-cyan-600 dark:text-cyan-300"}`}>
          {rotulo}
        </span>
      )}
    </motion.div>
  );
}

/* ───────────────────────── nó do fluxo ───────────────────────── */

function NoFluxo({ icone, etapa, titulo, desc, ancora, tom, destaque, delay = 0, rodape }: {
  icone: NomeIcone; etapa: string; titulo: string; desc: string; ancora: string;
  tom: "cyan" | "amber" | "emerald"; destaque?: boolean; delay?: number; rodape?: ReactNode;
}) {
  return (
    <motion.div
      {...aparecer(delay)}
      className={`relative flex-1 min-w-0 rounded-[2rem] p-6 md:p-7 flex flex-col gap-4 backdrop-blur-xl transition-colors
        ${destaque
          ? "bg-cyan-50/80 dark:bg-cyan-900/10 border-2 border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
          : "bg-white/80 dark:bg-white/5 border border-blue-200/50 dark:border-white/10 shadow-lg dark:shadow-none"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <MedalhaoIcone name={icone} tom={tom} size={48} />
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-white/40">{etapa}</span>
      </div>
      <h4 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">{titulo}</h4>
      <p className="text-sm leading-relaxed font-light text-slate-600 dark:text-white/60">{desc}</p>
      {rodape}
      <p className="mt-auto pt-2 font-mono text-[9px] text-cyan-700/80 dark:text-cyan-300/70 break-all border-t border-slate-200/70 dark:border-white/10">{ancora}</p>
    </motion.div>
  );
}

/* ═══════════════════════ 1. FLUXO VERIFICAÇÃO & CREDENCIAIS ═══════════════════════ */

export function FluxoVerificacaoDiagrama() {
  return (
    <figure className="w-full" aria-label="Fluxo: produzido pelos agentes, revisado por um humano habilitado, credencial verificável emitida na Solana">
      <div className="flex flex-col xl:flex-row items-stretch gap-2 xl:gap-0">
        <NoFluxo
          icone="agentes" etapa="01 · produzido" tom="cyan"
          titulo="Produzido pelos agentes"
          desc="Agentes pesquisam, escrevem e ensinam. O que sai daqui é um resultado — não uma verdade. O aluno envia o título com o documento e ele entra como “pendente”."
          ancora="POST /api/credentials/academic → status: pendente · metodo: doc_review"
        />
        <Seta rotulo="só pela revisão humana" delay={0.1} />
        <NoFluxo
          icone="revisor" etapa="02 · revisado" tom="amber" destaque delay={0.15}
          titulo="Revisor humano habilitado"
          desc="Um professor vinculado ao aluno (e habilitado) ou a instituição emissora abre a fila, vê o documento e chancela. Ninguém verifica a própria credencial. Admin só modera."
          ancora="GET /api/academic/fila · POST /api/academic/[id]/verificar · elegibilidade() → 403"
        />
        <Seta rotulo="ao chancelar" delay={0.25} />
        <NoFluxo
          icone="credencial" etapa="03 · credencial" tom="emerald" delay={0.3}
          titulo="Credencial verificável"
          desc="No mesmo ato: AURA entra no livro-razão, o nível acadêmico do aluno sobe para o maior título verificado e a credencial é cunhada na carteira dele — soulbound, portável, à prova de adulteração."
          ancora="grantAura(credential_verified) · issueCredential({type:'academic'}) · User.academicLevel"
          rodape={
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white/80">
              <SolanaMark size={12} title="" /> emitida na Solana
            </div>
          }
        />
      </div>

      {/* passagem bloqueada: produzido → credencial sem revisão */}
      <motion.div {...aparecer(0.4)} className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-dashed border-rose-400/40 bg-rose-500/5 px-4 py-3 text-center">
        <Seta bloqueada />
        <p className="text-[11px] md:text-xs font-semibold text-rose-600 dark:text-rose-300">
          Não existe atalho de “produzido” para “credencial”. Sem documento, o título fica “declarado”: zero AURA e badge “não verificado”.
        </p>
      </motion.div>

      {/* o que a credencial carrega */}
      <motion.figcaption {...aparecer(0.5)} className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {([
          ["credencial", "o quê", "título + tipo da conquista"],
          ["revisor", "por quem", "verifiedById do revisor"],
          ["livro", "quando", "verifiedAt · emitida em"],
          ["portavel", "portável", "na carteira do aluno"],
          ["hash", "à prova de adulteração", "soulbound na Solana"],
        ] as [NomeIcone, string, string][]).map(([ic, t, d], i) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2.5">
            <MedalhaoIcone name={ic} size={34} tom={i === 4 ? "emerald" : i === 3 ? "violet" : "cyan"} />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">{t}</p>
              <p className="text-[10px] text-slate-500 dark:text-white/50 leading-tight">{d}</p>
            </div>
          </div>
        ))}
      </motion.figcaption>
    </figure>
  );
}

/* ═══════════════════════ 2. PRIVACIDADE POR PROVENIÊNCIA ═══════════════════════ */

export function PrivacidadeDiagrama() {
  const privado = [
    ["privacidade", "O documento do diploma", "só o dono e o revisor elegível abrem (rota guardada, no-store)"],
    ["identidade", "Nome e e-mail", "ficam na conta; não vão pra cadeia"],
    ["hash", "A impressão do documento (sha256)", "detecta o mesmo diploma reusado em outra conta — sem expor o arquivo"],
    ["revisor", "Quem revisou e como", "metadata da credencial no servidor"],
  ] as [NomeIcone, string, string][];
  const publico = [
    ["credencial", "O quê", "“Título acadêmico verificado: Mestrado em …”"],
    ["livro", "Quando", "data de emissão"],
    ["hash", "Ponteiro", "id de origem (referência, não conteúdo)"],
    ["portavel", "Dono", "a carteira do aluno · soulbound, intransferível"],
  ] as [NomeIcone, string, string][];

  const Lado = ({ titulo, sub, itens, tom, delay }: { titulo: string; sub: string; itens: [NomeIcone, string, string][]; tom: "privado" | "publico"; delay: number }) => (
    <motion.div
      {...aparecer(delay)}
      className={`flex-1 rounded-[2rem] p-6 md:p-7 backdrop-blur-xl border ${tom === "privado"
        ? "bg-white/80 dark:bg-white/5 border-slate-300/60 dark:border-white/10"
        : "bg-cyan-50/70 dark:bg-cyan-900/10 border-cyan-500/40 shadow-[0_0_40px_rgba(34,211,238,0.12)]"}`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${tom === "privado" ? "text-slate-500 dark:text-white/50" : "text-cyan-600 dark:text-cyan-300"}`}>{titulo}</p>
          <p className="text-xs text-slate-500 dark:text-white/50">{sub}</p>
        </div>
        {tom === "privado" ? <MedalhaoIcone name="privacidade" tom="amber" size={40} /> : <span className="inline-flex items-center rounded-full border border-white/15 bg-black/70 px-3 py-1.5"><SolanaMark size={14} wordmark title="Solana" /></span>}
      </div>
      <ul className="flex flex-col gap-2.5">
        {itens.map(([ic, t, d]) => (
          <li key={t} className="flex items-start gap-3">
            <span className={`mt-0.5 shrink-0 ${tom === "privado" ? "text-amber-600 dark:text-amber-300" : "text-cyan-600 dark:text-cyan-300"}`}><IconeCredencial name={ic} size={18} /></span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{t}</p>
              <p className="text-[11px] text-slate-500 dark:text-white/55 leading-snug">{d}</p>
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );

  return (
    <figure className="w-full" aria-label="Privacidade por proveniência: o documento e a identidade ficam privados; só a prova vai para a Solana">
      <div className="flex flex-col lg:flex-row items-stretch gap-3 lg:gap-0">
        <Lado titulo="Privado · fica com você" sub="no servidor, com acesso guardado" itens={privado} tom="privado" delay={0} />
        <motion.div {...aparecer(0.15)} className="flex lg:flex-col items-center justify-center gap-2 px-3 lg:w-[140px] shrink-0 self-center" aria-hidden>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.25)]">
            <IconeCredencial name="hash" size={22} />
          </span>
          <svg viewBox="0 0 120 40" className="h-8 w-[100px] rotate-90 lg:rotate-0 text-emerald-500 dark:text-emerald-300" focusable="false">
            <path d="M6 20 H98" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M96 12 L112 20 L96 28 Z" fill="currentColor" />
          </svg>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300 text-center leading-tight">só a prova atravessa</span>
        </motion.div>
        <Lado titulo="Público · a prova" sub="metadados da credencial na cadeia" itens={publico} tom="publico" delay={0.25} />
      </div>
      <figcaption className="mt-4 text-center text-[11px] text-slate-500 dark:text-white/50">
        Público é a <b className="text-slate-800 dark:text-white/80">prova</b>. Privado é o <b className="text-slate-800 dark:text-white/80">conteúdo</b> e a <b className="text-slate-800 dark:text-white/80">identidade</b>.
      </figcaption>
    </figure>
  );
}

/* ═══════════════════════ 3. PRESENÇA (ciberespaço) — mini SVG ═══════════════════════ */

export function PresencaDiagrama() {
  const id = useId().replace(/:/g, "");
  return (
    <figure className="w-full">
      <svg viewBox="0 0 440 250" className="w-full h-auto font-sans text-slate-900 dark:text-white" role="img" aria-labelledby={`presenca-t-${id}`} focusable="false">
        <title id={`presenca-t-${id}`}>No ciberespaço os outros veem seu avatar, sua cor e seu nome de exibição; e-mail, documentos, carteira e credenciais ficam com você.</title>
        <defs>
          <linearGradient id={`p-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#6366f1" /></linearGradient>
        </defs>
        {/* avatares */}
        {[{ x: 90, cor: "#22d3ee", nome: "Ana R." }, { x: 350, cor: "#a78bfa", nome: "Tiago" }].map((a) => (
          <g key={a.x}>
            <circle cx={a.x} cy={78} r={30} fill={a.cor} fillOpacity={0.18} stroke={a.cor} strokeWidth={2} />
            <circle cx={a.x} cy={68} r={10} fill={a.cor} />
            <path d={`M${a.x - 18} 100 c0 -12 8 -18 18 -18 s18 6 18 18`} fill={a.cor} />
            <text x={a.x} y={128} textAnchor="middle" fontSize="12" fontWeight={800} fill="currentColor">{a.nome}</text>
            <text x={a.x} y={144} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.55}>avatar · cor · nome de exibição</text>
          </g>
        ))}
        {/* balão entre os dois */}
        <path d="M150 70 h140 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-110 l-12 10 v-10 h-18 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10 z" fill={`url(#p-${id})`} fillOpacity={0.15} stroke="#22d3ee" strokeWidth={1.5} />
        <text x={220} y={94} textAnchor="middle" fontSize="11" fontWeight={700} fill="currentColor">conversa no lounge</text>
        {/* cofre */}
        <rect x={70} y={168} width={300} height={62} rx={14} fill="currentColor" fillOpacity={0.05} stroke="currentColor" strokeOpacity={0.2} />
        <g transform="translate(88 184)" stroke="#f59e0b" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x={2} y={12} width={22} height={16} rx={4} />
          <path d="M7 12 V8 a6 6 0 0 1 12 0 v4" />
          <circle cx={13} cy={20} r={2} />
        </g>
        <text x={126} y={192} fontSize="10" fontWeight={800} fill="#f59e0b">FICA COM VOCÊ</text>
        <text x={126} y={208} fontSize="10" fill="currentColor" fillOpacity={0.75}>e-mail · documento do diploma · carteira</text>
        <text x={126} y={222} fontSize="10" fill="currentColor" fillOpacity={0.75}>credenciais (só no seu perfil)</text>
      </svg>
      <figcaption className="mt-2 text-center text-[11px] text-slate-500 dark:text-white/50">
        A presença leva só avatar, cor e nome de exibição. E-mail, documentos e carteira nunca viajam com você.
      </figcaption>
    </figure>
  );
}

/* ═══════════════════════ 4. CHANCELA (portão) — mini SVG ═══════════════════════ */

export function ChancelaDiagrama() {
  const id = useId().replace(/:/g, "");
  const checks = ["papel: professor ou instituição", "vínculo com o aluno (ou emissora)", "não é a própria credencial", "há documento anexado"];
  return (
    <figure className="w-full">
      <svg viewBox="0 0 440 250" className="w-full h-auto font-sans text-slate-900 dark:text-white" role="img" aria-labelledby={`chancela-t-${id}`} focusable="false">
        <title id={`chancela-t-${id}`}>Portão da chancela: só passa quem tem papel, vínculo, não é o próprio aluno e tem documento; senão 403.</title>
        <defs><marker id={`m-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#22d3ee" /></marker></defs>
        {/* pedido */}
        <rect x={16} y={96} width={96} height={56} rx={14} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.25} />
        <text x={64} y={120} textAnchor="middle" fontSize="10" fontWeight={800} fill="currentColor">pedido</text>
        <text x={64} y={136} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.6}>POST …/verificar</text>
        <path d="M114 124 H150" stroke="#22d3ee" strokeWidth={2} markerEnd={`url(#m-${id})`} />
        {/* portão */}
        <rect x={152} y={30} width={180} height={190} rx={18} fill="#f59e0b" fillOpacity={0.08} stroke="#f59e0b" strokeWidth={1.5} />
        <text x={242} y={52} textAnchor="middle" fontSize="10" fontWeight={900} fill="#f59e0b" letterSpacing={2}>PORTÃO DA CHANCELA</text>
        {checks.map((c, i) => (
          <g key={c} transform={`translate(168 ${72 + i * 34})`}>
            <circle cx={9} cy={8} r={8} fill="#34d399" fillOpacity={0.18} stroke="#34d399" strokeWidth={1.5} />
            <path d="M5.5 8.2 l2.4 2.4 l4.4 -4.6" fill="none" stroke="#34d399" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <text x={24} y={12} fontSize="9.5" fill="currentColor" fillOpacity={0.9}>{c}</text>
          </g>
        ))}
        {/* saídas */}
        <path d="M334 96 H372" stroke="#22d3ee" strokeWidth={2} markerEnd={`url(#m-${id})`} />
        <rect x={374} y={74} width={56} height={44} rx={12} fill="#34d399" fillOpacity={0.12} stroke="#34d399" strokeWidth={1.5} />
        <text x={402} y={92} textAnchor="middle" fontSize="9" fontWeight={900} fill="#34d399">PASSA</text>
        <text x={402} y={106} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity={0.7}>chancela</text>
        <path d="M334 170 H372" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" />
        <rect x={374} y={148} width={56} height={44} rx={12} fill="#f43f5e" fillOpacity={0.1} stroke="#f43f5e" strokeWidth={1.5} />
        <text x={402} y={166} textAnchor="middle" fontSize="9" fontWeight={900} fill="#f43f5e">403</text>
        <text x={402} y={180} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity={0.7}>não chancela</text>
        <text x={220} y={240} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.55}>lib/aura/academico.ts · elegibilidade() · metodoPermitido()</text>
      </svg>
    </figure>
  );
}

/* ═══════════════════════ 5. LIVRO-RAZÃO — mini SVG ═══════════════════════ */

export function LivroRazaoDiagrama() {
  const id = useId().replace(/:/g, "");
  const linhas = [
    { s: "credential_verified", v: "+350", r: "Título verificado: Mestrado", cor: "#34d399" },
    { s: "node_validated", v: "+50", r: "Nó validado pelo professor", cor: "#34d399" },
    { s: "node_learned", v: "+5", r: "Nó aprendido (soft-cap diário)", cor: "#22d3ee" },
    { s: "reversal", v: "−350", r: "Verificação revertida", cor: "#f43f5e" },
  ];
  return (
    <figure className="w-full">
      <svg viewBox="0 0 440 250" className="w-full h-auto font-sans text-slate-900 dark:text-white" role="img" aria-labelledby={`ledger-t-${id}`} focusable="false">
        <title id={`ledger-t-${id}`}>Livro-razão AURA: eventos só se somam, um por conquista; reverter é um evento negativo, nunca apagar.</title>
        <rect x={16} y={18} width={408} height={196} rx={18} fill="currentColor" fillOpacity={0.04} stroke="currentColor" strokeOpacity={0.2} />
        <text x={32} y={42} fontSize="10" fontWeight={900} fill="currentColor" letterSpacing={2}>AURAEVENT · APPEND-ONLY</text>
        <text x={408} y={42} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity={0.55}>único (usuário, fonte, ref)</text>
        <line x1={32} y1={52} x2={408} y2={52} stroke="currentColor" strokeOpacity={0.2} />
        {linhas.map((l, i) => (
          <g key={l.s} transform={`translate(32 ${72 + i * 32})`}>
            <rect x={0} y={-12} width={376} height={26} rx={8} fill={l.cor} fillOpacity={0.07} />
            <circle cx={12} cy={1} r={4} fill={l.cor} />
            <text x={26} y={5} fontSize="9.5" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="currentColor" fillOpacity={0.9}>{l.s}</text>
            <text x={160} y={5} fontSize="9.5" fill="currentColor" fillOpacity={0.65}>{l.r}</text>
            <text x={368} y={5} textAnchor="end" fontSize="11" fontWeight={900} fill={l.cor}>{l.v}</text>
          </g>
        ))}
        <line x1={32} y1={196} x2={408} y2={196} stroke="currentColor" strokeOpacity={0.2} />
        <text x={32} y={208} fontSize="9" fill="currentColor" fillOpacity={0.7}>saldo = soma do ledger → nível derivado</text>
        <text x={408} y={208} textAnchor="end" fontSize="9" fill="#f43f5e" fillOpacity={0.9}>nunca apaga: reverter = evento negativo</text>
        <text x={220} y={238} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.55}>lib/aura/ledger.ts · grantAura() · reverseAura() · recomputeAura()</text>
      </svg>
    </figure>
  );
}
