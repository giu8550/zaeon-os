# archify (vendorizado)

- Origem: https://github.com/tt-a1i/archify — pasta `archify/` do repositório, **commit `73aaa0696e8f72c232ea710e6fa94fd953f3e773` (v3.0.1)**.
- Licença: MIT (ver `LICENSE`; fontes de terceiros em `THIRD_PARTY_NOTICES.md`).
- **Sem modificações.** Copiado: `bin/ renderers/ schemas/ assets/ brand-marks/ migrations/ delta/ recipes/ scripts/ references/ examples/*.json SKILL.md package.json`. Fora: `test/`, exemplos `.html`, `package-lock.json`.
- Zero dependências em runtime (só Node ≥ 18). Rodamos como processo separado: `node vendor/archify/bin/archify.mjs validate|render <tipo> <ir.json> …` — ver `lib/studio/diagram.ts`.
- Atualizar: copiar a mesma lista de pastas de uma nova tag, rodar `npx vitest run lib/studio/diagram.test.ts` (renderiza os 5 exemplos didáticos de verdade) e atualizar o commit acima e o `NOTICE` da raiz.
