# Onboarding V2 — Invite Gate + AI Agent + University Modal + Research Tour

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-access onboarding with an invite-only flow: `/onboard/[token]` → conversational AI agent → university picker → course selector → auth → interactive research-lab tour.

**Architecture:** Three phases. (1) Gate: `/onboard/[token]` reuses `GET /api/student/join?token=` (ClassLink validation). (2) Onboard: chat agent collects name/age/gender/city, university modal with glow effects, split welcome screen with social proof + auth. (3) Tour: after OAuth, cookie-persisted data is saved via `POST /api/onboard/save`, then a 12-step `ResearchRoomTour` overlay guides the user, ending at the mural mini-tour.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, NextAuth v4, Prisma + MongoDB, `@heroicons/react/24/outline`, `next-auth/react`

**Branch:** `git checkout -b feat/onboarding-v2-invite-gate` before starting.

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Create | `constants/universities.ts` | Typed array of ~60 Brazilian federal universities |
| Create | `scripts/fetch_university_logos.py` | Python script: Wikipedia/Clearbit → `public/assets/universities/` |
| Create | `public/assets/universities/.gitkeep` | Ensures dir is tracked |
| Create | `app/onboard/[token]/page.tsx` | Gate: validate token, render OnboardAgent |
| Create | `components/onboard/OnboardAgent.tsx` | Scripted chat collecting name/age/gender/city |
| Create | `components/onboard/UniversityModal.tsx` | Searchable grid + glow + logo flash |
| Create | `components/onboard/WelcomeScreen.tsx` | Split layout: course (left) + proof/auth (right) |
| Create | `components/onboard/CourseSelector.tsx` | Searchable course pills, sourced from existing ALL_COURSES |
| Create | `components/onboard/Testimonials.tsx` | Auto-rotating carousel of 8 testimonials |
| Create | `components/onboard/ResearchRoomTour.tsx` | 12-step overlay tour with element highlighting |
| Create | `app/api/onboard/save/route.ts` | POST: session + cookie → Prisma upsert |
| Modify | `prisma/schema.prisma` | Add `city String?` to User model |
| Modify | `app/research-lab/page.tsx` | Focus mode cleanup fix + `data-tour` attrs + tour mount |
| Modify | `app/workstation/profiles/NetworkMural.tsx` | 4-step mini-tour on `?tour=true` |

---

## Task 1: Create the branch and scaffold directories

**Files:**
- New branch: `feat/onboarding-v2-invite-gate`
- Create: `components/onboard/` (directory)
- Create: `public/assets/universities/.gitkeep`

- [ ] **Step 1: Create branch**
```bash
git checkout -b feat/onboarding-v2-invite-gate
```

- [ ] **Step 2: Scaffold directories**
```bash
mkdir -p components/onboard
mkdir -p public/assets/universities
touch public/assets/universities/.gitkeep
```

- [ ] **Step 3: Commit scaffold**
```bash
git add public/assets/universities/.gitkeep
git commit -m "chore: scaffold onboarding v2 directories"
```

---

## Task 2: Fix focus mode cleanup bug

**Files:**
- Modify: `app/research-lab/page.tsx` — add cleanup useEffect after line 631, fix button class at line 1003

The bug: `toggleFocusMode` dispatches `zaeon-focus-mode` only when toggled, never on page unmount. The navbar's listener stays `true` after navigation.

- [ ] **Step 1: Locate the block of scroll useEffects (lines 629–631)**

Read lines 629–640 to confirm position before editing.

- [ ] **Step 2: Add cleanup useEffect after line 631**

After the three scroll useEffects, insert:
```typescript
// Dispatch focus-off on unmount so navbar listener resets
useEffect(() => {
    return () => {
        window.dispatchEvent(new CustomEvent('zaeon-focus-mode', { detail: false }));
    };
}, []);
```

- [ ] **Step 3: Fix focus mode button styling (line 1003)**

Replace:
```typescript
<button onClick={toggleFocusMode} className={`flex items-center gap-3 p-2 rounded-xl ${isFocusMode ? 'bg-cyan-50 text-white shadow-md' : 'text-black dark:text-white hover:bg-slate-100'}`}>
```
With:
```typescript
<button onClick={toggleFocusMode} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${isFocusMode ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}>
```

- [ ] **Step 4: Verify TypeScript compiles**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to research-lab/page.tsx.

- [ ] **Step 5: Commit**
```bash
git add app/research-lab/page.tsx
git commit -m "fix: dispatch focus-mode=false on page unmount to reset navbar state"
```

---

## Task 3: Add `city` field to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` — add `city String?` to User model

- [ ] **Step 1: Open schema and find User model**

Find the line with `countryCode   String?` in `prisma/schema.prisma`.

- [ ] **Step 2: Add city field below countryCode**
```prisma
  countryCode     String?
  city            String?
```

- [ ] **Step 3: Regenerate Prisma client**
```bash
npx prisma generate
```
Expected: "Generated Prisma Client".

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat: add city field to User model for onboarding v2"
```

---

## Task 4: Create university constants

**Files:**
- Create: `constants/universities.ts`

- [ ] **Step 1: Create the file with the full typed array**

```typescript
// constants/universities.ts
export interface BrazilianUniversity {
  id: string;
  name: string;
  acronym: string;
  state: string;
  city: string;
  website: string;
  logoPath: string;
  color: string;
  isPartner: boolean;
}

export const BRAZILIAN_FEDERAL_UNIVERSITIES: BrazilianUniversity[] = [
  // CEARÁ
  { id: 'ufc', name: 'Universidade Federal do Ceará', acronym: 'UFC', state: 'CE', city: 'Fortaleza', website: 'https://www.ufc.br', logoPath: '/assets/universities/ufc.png', color: '#003DA5', isPartner: true },
  { id: 'unilab', name: 'Universidade da Integração Internacional da Lusofonia Afro-Brasileira', acronym: 'UNILAB', state: 'CE', city: 'Redenção', website: 'https://www.unilab.edu.br', logoPath: '/assets/universities/unilab.png', color: '#006633', isPartner: true },
  { id: 'ifce', name: 'Instituto Federal de Educação, Ciência e Tecnologia do Ceará', acronym: 'IFCE', state: 'CE', city: 'Fortaleza', website: 'https://ifce.edu.br', logoPath: '/assets/universities/ifce.png', color: '#1B5E20', isPartner: true },
  { id: 'uva', name: 'Universidade Estadual Vale do Acaraú', acronym: 'UVA', state: 'CE', city: 'Sobral', website: 'https://www.uvanet.br', logoPath: '/assets/universities/uva.png', color: '#4A148C', isPartner: false },
  // NORDESTE
  { id: 'ufal', name: 'Universidade Federal de Alagoas', acronym: 'UFAL', state: 'AL', city: 'Maceió', website: 'https://ufal.edu.br', logoPath: '/assets/universities/ufal.png', color: '#B71C1C', isPartner: false },
  { id: 'ufba', name: 'Universidade Federal da Bahia', acronym: 'UFBA', state: 'BA', city: 'Salvador', website: 'https://www.ufba.br', logoPath: '/assets/universities/ufba.png', color: '#1A237E', isPartner: false },
  { id: 'ufrb', name: 'Universidade Federal do Recôncavo da Bahia', acronym: 'UFRB', state: 'BA', city: 'Cruz das Almas', website: 'https://www.ufrb.edu.br', logoPath: '/assets/universities/ufrb.png', color: '#004D40', isPartner: false },
  { id: 'ufsb', name: 'Universidade Federal do Sul da Bahia', acronym: 'UFSB', state: 'BA', city: 'Itabuna', website: 'https://ufsb.edu.br', logoPath: '/assets/universities/ufsb.png', color: '#006064', isPartner: false },
  { id: 'ufma', name: 'Universidade Federal do Maranhão', acronym: 'UFMA', state: 'MA', city: 'São Luís', website: 'https://portais.ufma.br', logoPath: '/assets/universities/ufma.png', color: '#1B5E20', isPartner: false },
  { id: 'ufpb', name: 'Universidade Federal da Paraíba', acronym: 'UFPB', state: 'PB', city: 'João Pessoa', website: 'https://www.ufpb.br', logoPath: '/assets/universities/ufpb.png', color: '#880E4F', isPartner: false },
  { id: 'ufcg', name: 'Universidade Federal de Campina Grande', acronym: 'UFCG', state: 'PB', city: 'Campina Grande', website: 'https://www.ufcg.edu.br', logoPath: '/assets/universities/ufcg.png', color: '#4A148C', isPartner: false },
  { id: 'ufpe', name: 'Universidade Federal de Pernambuco', acronym: 'UFPE', state: 'PE', city: 'Recife', website: 'https://www.ufpe.br', logoPath: '/assets/universities/ufpe.png', color: '#E65100', isPartner: false },
  { id: 'ufrpe', name: 'Universidade Federal Rural de Pernambuco', acronym: 'UFRPE', state: 'PE', city: 'Recife', website: 'https://www.ufrpe.br', logoPath: '/assets/universities/ufrpe.png', color: '#33691E', isPartner: false },
  { id: 'univasf', name: 'Universidade Federal do Vale do São Francisco', acronym: 'UNIVASF', state: 'PE', city: 'Petrolina', website: 'https://www.univasf.edu.br', logoPath: '/assets/universities/univasf.png', color: '#BF360C', isPartner: false },
  { id: 'ufersa', name: 'Universidade Federal Rural do Semi-Árido', acronym: 'UFERSA', state: 'RN', city: 'Mossoró', website: 'https://ufersa.edu.br', logoPath: '/assets/universities/ufersa.png', color: '#558B2F', isPartner: false },
  { id: 'ufrn', name: 'Universidade Federal do Rio Grande do Norte', acronym: 'UFRN', state: 'RN', city: 'Natal', website: 'https://www.ufrn.br', logoPath: '/assets/universities/ufrn.png', color: '#1A237E', isPartner: false },
  { id: 'ufpi', name: 'Universidade Federal do Piauí', acronym: 'UFPI', state: 'PI', city: 'Teresina', website: 'https://www.ufpi.br', logoPath: '/assets/universities/ufpi.png', color: '#4E342E', isPartner: false },
  { id: 'ufs', name: 'Universidade Federal de Sergipe', acronym: 'UFS', state: 'SE', city: 'São Cristóvão', website: 'https://www.ufs.br', logoPath: '/assets/universities/ufs.png', color: '#006064', isPartner: false },
  // NORTE
  { id: 'ufpa', name: 'Universidade Federal do Pará', acronym: 'UFPA', state: 'PA', city: 'Belém', website: 'https://www.ufpa.br', logoPath: '/assets/universities/ufpa.png', color: '#1B5E20', isPartner: false },
  { id: 'ufra', name: 'Universidade Federal Rural da Amazônia', acronym: 'UFRA', state: 'PA', city: 'Belém', website: 'https://www.ufra.edu.br', logoPath: '/assets/universities/ufra.png', color: '#1B5E20', isPartner: false },
  { id: 'unifap', name: 'Universidade Federal do Amapá', acronym: 'UNIFAP', state: 'AP', city: 'Macapá', website: 'https://www2.unifap.br', logoPath: '/assets/universities/unifap.png', color: '#006064', isPartner: false },
  { id: 'ufam', name: 'Universidade Federal do Amazonas', acronym: 'UFAM', state: 'AM', city: 'Manaus', website: 'https://www.ufam.edu.br', logoPath: '/assets/universities/ufam.png', color: '#1A237E', isPartner: false },
  { id: 'ufrr', name: 'Universidade Federal de Roraima', acronym: 'UFRR', state: 'RR', city: 'Boa Vista', website: 'https://ufrr.br', logoPath: '/assets/universities/ufrr.png', color: '#4A148C', isPartner: false },
  { id: 'unir', name: 'Fundação Universidade Federal de Rondônia', acronym: 'UNIR', state: 'RO', city: 'Porto Velho', website: 'https://www.unir.br', logoPath: '/assets/universities/unir.png', color: '#BF360C', isPartner: false },
  { id: 'ufac', name: 'Universidade Federal do Acre', acronym: 'UFAC', state: 'AC', city: 'Rio Branco', website: 'https://www.ufac.br', logoPath: '/assets/universities/ufac.png', color: '#B71C1C', isPartner: false },
  { id: 'ufopa', name: 'Universidade Federal do Oeste do Pará', acronym: 'UFOPA', state: 'PA', city: 'Santarém', website: 'https://www.ufopa.edu.br', logoPath: '/assets/universities/ufopa.png', color: '#004D40', isPartner: false },
  { id: 'unifesspa', name: 'Universidade Federal do Sul e Sudeste do Pará', acronym: 'UNIFESSPA', state: 'PA', city: 'Marabá', website: 'https://www.unifesspa.edu.br', logoPath: '/assets/universities/unifesspa.png', color: '#37474F', isPartner: false },
  // CENTRO-OESTE
  { id: 'unb', name: 'Universidade de Brasília', acronym: 'UnB', state: 'DF', city: 'Brasília', website: 'https://www.unb.br', logoPath: '/assets/universities/unb.png', color: '#1B5E20', isPartner: false },
  { id: 'ufg', name: 'Universidade Federal de Goiás', acronym: 'UFG', state: 'GO', city: 'Goiânia', website: 'https://www.ufg.br', logoPath: '/assets/universities/ufg.png', color: '#E65100', isPartner: false },
  { id: 'ufgd', name: 'Universidade Federal da Grande Dourados', acronym: 'UFGD', state: 'MS', city: 'Dourados', website: 'https://www.ufgd.edu.br', logoPath: '/assets/universities/ufgd.png', color: '#880E4F', isPartner: false },
  { id: 'ufms', name: 'Universidade Federal de Mato Grosso do Sul', acronym: 'UFMS', state: 'MS', city: 'Campo Grande', website: 'https://www.ufms.br', logoPath: '/assets/universities/ufms.png', color: '#4A148C', isPartner: false },
  { id: 'ufmt', name: 'Universidade Federal de Mato Grosso', acronym: 'UFMT', state: 'MT', city: 'Cuiabá', website: 'https://www.ufmt.br', logoPath: '/assets/universities/ufmt.png', color: '#B71C1C', isPartner: false },
  // SUDESTE
  { id: 'ufes', name: 'Universidade Federal do Espírito Santo', acronym: 'UFES', state: 'ES', city: 'Vitória', website: 'https://www.ufes.br', logoPath: '/assets/universities/ufes.png', color: '#004D40', isPartner: false },
  { id: 'ufjf', name: 'Universidade Federal de Juiz de Fora', acronym: 'UFJF', state: 'MG', city: 'Juiz de Fora', website: 'https://www.ufjf.br', logoPath: '/assets/universities/ufjf.png', color: '#1A237E', isPartner: false },
  { id: 'ufla', name: 'Universidade Federal de Lavras', acronym: 'UFLA', state: 'MG', city: 'Lavras', website: 'https://www.ufla.br', logoPath: '/assets/universities/ufla.png', color: '#1B5E20', isPartner: false },
  { id: 'ufmg', name: 'Universidade Federal de Minas Gerais', acronym: 'UFMG', state: 'MG', city: 'Belo Horizonte', website: 'https://www.ufmg.br', logoPath: '/assets/universities/ufmg.png', color: '#1A237E', isPartner: false },
  { id: 'ufop', name: 'Universidade Federal de Ouro Preto', acronym: 'UFOP', state: 'MG', city: 'Ouro Preto', website: 'https://www.ufop.br', logoPath: '/assets/universities/ufop.png', color: '#BF360C', isPartner: false },
  { id: 'uftm', name: 'Universidade Federal do Triângulo Mineiro', acronym: 'UFTM', state: 'MG', city: 'Uberaba', website: 'https://www.uftm.edu.br', logoPath: '/assets/universities/uftm.png', color: '#006064', isPartner: false },
  { id: 'ufv', name: 'Universidade Federal de Viçosa', acronym: 'UFV', state: 'MG', city: 'Viçosa', website: 'https://www.ufv.br', logoPath: '/assets/universities/ufv.png', color: '#558B2F', isPartner: false },
  { id: 'unifal', name: 'Universidade Federal de Alfenas', acronym: 'UNIFAL', state: 'MG', city: 'Alfenas', website: 'https://www.unifal-mg.edu.br', logoPath: '/assets/universities/unifal.png', color: '#4A148C', isPartner: false },
  { id: 'unifei', name: 'Universidade Federal de Itajubá', acronym: 'UNIFEI', state: 'MG', city: 'Itajubá', website: 'https://unifei.edu.br', logoPath: '/assets/universities/unifei.png', color: '#E65100', isPartner: false },
  { id: 'ufabc', name: 'Universidade Federal do ABC', acronym: 'UFABC', state: 'SP', city: 'Santo André', website: 'https://www.ufabc.edu.br', logoPath: '/assets/universities/ufabc.png', color: '#1A237E', isPartner: false },
  { id: 'ufscar', name: 'Universidade Federal de São Carlos', acronym: 'UFSCar', state: 'SP', city: 'São Carlos', website: 'https://www.ufscar.br', logoPath: '/assets/universities/ufscar.png', color: '#880E4F', isPartner: false },
  { id: 'unifesp', name: 'Universidade Federal de São Paulo', acronym: 'UNIFESP', state: 'SP', city: 'São Paulo', website: 'https://www.unifesp.br', logoPath: '/assets/universities/unifesp.png', color: '#1B5E20', isPartner: false },
  { id: 'uff', name: 'Universidade Federal Fluminense', acronym: 'UFF', state: 'RJ', city: 'Niterói', website: 'https://www.uff.br', logoPath: '/assets/universities/uff.png', color: '#006064', isPartner: false },
  { id: 'ufrj', name: 'Universidade Federal do Rio de Janeiro', acronym: 'UFRJ', state: 'RJ', city: 'Rio de Janeiro', website: 'https://ufrj.br', logoPath: '/assets/universities/ufrj.png', color: '#1A237E', isPartner: false },
  { id: 'ufrrj', name: 'Universidade Federal Rural do Rio de Janeiro', acronym: 'UFRRJ', state: 'RJ', city: 'Seropédica', website: 'https://portal.ufrrj.br', logoPath: '/assets/universities/ufrrj.png', color: '#1B5E20', isPartner: false },
  { id: 'unirio', name: 'Universidade Federal do Estado do Rio de Janeiro', acronym: 'UNIRIO', state: 'RJ', city: 'Rio de Janeiro', website: 'https://www.unirio.br', logoPath: '/assets/universities/unirio.png', color: '#880E4F', isPartner: false },
  // SUL
  { id: 'ufcspa', name: 'Universidade Federal de Ciências da Saúde de Porto Alegre', acronym: 'UFCSPA', state: 'RS', city: 'Porto Alegre', website: 'https://www.ufcspa.edu.br', logoPath: '/assets/universities/ufcspa.png', color: '#004D40', isPartner: false },
  { id: 'ufrgs', name: 'Universidade Federal do Rio Grande do Sul', acronym: 'UFRGS', state: 'RS', city: 'Porto Alegre', website: 'https://www.ufrgs.br', logoPath: '/assets/universities/ufrgs.png', color: '#1A237E', isPartner: false },
  { id: 'ufpel', name: 'Universidade Federal de Pelotas', acronym: 'UFPel', state: 'RS', city: 'Pelotas', website: 'https://portal.ufpel.edu.br', logoPath: '/assets/universities/ufpel.png', color: '#4E342E', isPartner: false },
  { id: 'ufsm', name: 'Universidade Federal de Santa Maria', acronym: 'UFSM', state: 'RS', city: 'Santa Maria', website: 'https://www.ufsm.br', logoPath: '/assets/universities/ufsm.png', color: '#B71C1C', isPartner: false },
  { id: 'furg', name: 'Universidade Federal do Rio Grande', acronym: 'FURG', state: 'RS', city: 'Rio Grande', website: 'https://www.furg.br', logoPath: '/assets/universities/furg.png', color: '#006064', isPartner: false },
  { id: 'unipampa', name: 'Universidade Federal do Pampa', acronym: 'UNIPAMPA', state: 'RS', city: 'Bagé', website: 'https://www.unipampa.edu.br', logoPath: '/assets/universities/unipampa.png', color: '#558B2F', isPartner: false },
  { id: 'uffs', name: 'Universidade Federal da Fronteira Sul', acronym: 'UFFS', state: 'SC', city: 'Chapecó', website: 'https://www.uffs.edu.br', logoPath: '/assets/universities/uffs.png', color: '#1B5E20', isPartner: false },
  { id: 'ufsc', name: 'Universidade Federal de Santa Catarina', acronym: 'UFSC', state: 'SC', city: 'Florianópolis', website: 'https://ufsc.br', logoPath: '/assets/universities/ufsc.png', color: '#1A237E', isPartner: false },
  { id: 'ufpr', name: 'Universidade Federal do Paraná', acronym: 'UFPR', state: 'PR', city: 'Curitiba', website: 'https://www.ufpr.br', logoPath: '/assets/universities/ufpr.png', color: '#B71C1C', isPartner: false },
  { id: 'utfpr', name: 'Universidade Tecnológica Federal do Paraná', acronym: 'UTFPR', state: 'PR', city: 'Curitiba', website: 'https://www.utfpr.edu.br', logoPath: '/assets/universities/utfpr.png', color: '#4A148C', isPartner: false },
  { id: 'unioeste', name: 'Universidade Estadual do Oeste do Paraná', acronym: 'UNIOESTE', state: 'PR', city: 'Cascavel', website: 'https://www.unioeste.br', logoPath: '/assets/universities/unioeste.png', color: '#006064', isPartner: false },
  // TOCANTINS
  { id: 'uft', name: 'Universidade Federal do Tocantins', acronym: 'UFT', state: 'TO', city: 'Palmas', website: 'https://www.uft.edu.br', logoPath: '/assets/universities/uft.png', color: '#E65100', isPartner: false },
  { id: 'ifto', name: 'Instituto Federal do Tocantins', acronym: 'IFTO', state: 'TO', city: 'Palmas', website: 'https://www.ifto.edu.br', logoPath: '/assets/universities/ifto.png', color: '#1B5E20', isPartner: false },
];
```

- [ ] **Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep universities
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add constants/universities.ts
git commit -m "feat: add Brazilian federal universities constants"
```

---

## Task 5: Create Python logo fetcher

**Files:**
- Create: `scripts/fetch_university_logos.py`

- [ ] **Step 1: Create the file**

```python
#!/usr/bin/env python3
"""Fetch logos for Brazilian universities → public/assets/universities/"""
import os, time, json, requests
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "assets" / "universities"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LOGO_URLS = {
    "ufc":    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Brasao_ufc.png/200px-Brasao_ufc.png",
    "unilab": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Logo_Unilab.png/200px-Logo_Unilab.png",
    "ifce":   "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Marca_IFCE_2021.png/200px-Marca_IFCE_2021.png",
    "ufmg":   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Bras%C3%A3o_UFMG.svg/200px-Bras%C3%A3o_UFMG.svg.png",
    "unb":    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Universidade_de_Bras%C3%ADlia_%28logo%29.svg/200px-Universidade_de_Bras%C3%ADlia_%28logo%29.svg.png",
    "ufrj":   "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/UFRJ_logo.svg/200px-UFRJ_logo.svg.png",
    "uff":    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/UFF_logo.svg/200px-UFF_logo.svg.png",
    "ufba":   "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/UFBA-logo.svg/200px-UFBA-logo.svg.png",
    "ufrgs":  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Bras%C3%A3o_UFRGS.svg/200px-Bras%C3%A3o_UFRGS.svg.png",
    "ufsc":   "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/UFSC_logo.svg/200px-UFSC_logo.svg.png",
    "ufpe":   "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/UFPE_logo.svg/200px-UFPE_logo.svg.png",
    "ufpr":   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Bras%C3%A3o_da_UFPR.svg/200px-Bras%C3%A3o_da_UFPR.svg.png",
    "ufscar": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/UFSCar_logo.svg/200px-UFSCar_logo.svg.png",
    "unifesp":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Unifesp_logo.svg/200px-Unifesp_logo.svg.png",
    "ufsm":   "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Bras%C3%A3o_UFSM.svg/200px-Bras%C3%A3o_UFSM.svg.png",
    "ufpa":   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Logo_UFPA.svg/200px-Logo_UFPA.svg.png",
    "ufam":   "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/UFAM_logo.svg/200px-UFAM_logo.svg.png",
}

UNIVERSITIES_JSON = Path(__file__).parent.parent / "constants" / "universities_data.json"

def fetch_wiki(uid: str) -> bool:
    if uid not in LOGO_URLS:
        return False
    try:
        r = requests.get(LOGO_URLS[uid], timeout=15, headers={"User-Agent": "Zaeon/1.0"})
        if r.status_code == 200 and len(r.content) > 500:
            (OUTPUT_DIR / f"{uid}.png").write_bytes(r.content)
            print(f"  ✓ wiki → {uid}.png")
            return True
    except Exception as e:
        print(f"  ✗ wiki {uid}: {e}")
    return False

def fetch_clearbit(website: str, uid: str) -> bool:
    domain = website.replace("https://","").replace("http://","").split("/")[0]
    try:
        r = requests.get(f"https://logo.clearbit.com/{domain}", timeout=10, headers={"User-Agent": "Zaeon/1.0"})
        if r.status_code == 200 and len(r.content) > 1000:
            (OUTPUT_DIR / f"{uid}.png").write_bytes(r.content)
            print(f"  ✓ clearbit → {uid}.png")
            return True
    except Exception as e:
        print(f"  ✗ clearbit {uid}: {e}")
    return False

def make_placeholder(uid: str, acronym: str, color: str):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="20" fill="{color}"/><text x="100" y="115" font-family="Arial" font-size="48" font-weight="bold" fill="white" text-anchor="middle">{acronym[:4]}</text></svg>'
    (OUTPUT_DIR / f"{uid}.svg").write_text(svg)
    print(f"  ~ placeholder → {uid}.svg")

def main():
    if not UNIVERSITIES_JSON.exists():
        print("Run: npx ts-node scripts/export_universities.ts first")
        return
    universities = json.loads(UNIVERSITIES_JSON.read_text())
    print(f"\nFetching logos for {len(universities)} universities...\n")
    ok = 0
    for u in universities:
        uid = u["id"]
        if (OUTPUT_DIR / f"{uid}.png").exists():
            ok += 1
            continue
        print(f"→ {u['acronym']}")
        if fetch_wiki(uid) or fetch_clearbit(u["website"], uid):
            ok += 1
        else:
            make_placeholder(uid, u["acronym"], u["color"])
        time.sleep(0.4)
    print(f"\nDone: {ok} logos, rest are SVG placeholders.")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**
```bash
git add scripts/fetch_university_logos.py
git commit -m "chore: add Python script to fetch university logos"
```

---

## Task 6: Create onboard gate page

**Files:**
- Create: `app/onboard/[token]/page.tsx`

The page validates the token via the existing `GET /api/student/join?token=` endpoint. On success, renders `OnboardAgent`. On failure, shows an error screen.

- [ ] **Step 1: Create directory and file**
```bash
mkdir -p app/onboard/\[token\]
```

- [ ] **Step 2: Write the page**

```typescript
// app/onboard/[token]/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldX, Loader2 } from 'lucide-react';
import OnboardAgent from '@/components/onboard/OnboardAgent';

interface InviteData {
  teacherName: string;
  subject: string;
  room: string;
}

export default function OnboardGatePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  useEffect(() => {
    fetch(`/api/student/join?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus('invalid'); return; }
        setInviteData(data);
        setStatus('valid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 className="w-10 h-10 text-cyan-400" />
        </motion.div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
        <ShieldX className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-black text-white uppercase tracking-widest">Link inválido</h1>
        <p className="text-slate-400 text-sm">Este convite expirou ou não existe. Solicite um novo link ao seu professor.</p>
      </div>
    );
  }

  return <OnboardAgent token={token} inviteData={inviteData!} />;
}
```

- [ ] **Step 3: Verify TypeScript compiles**
```bash
npx tsc --noEmit 2>&1 | grep onboard
```
Expected: no errors (OnboardAgent import will fail until Task 7 — that's fine, fix in sequence).

- [ ] **Step 4: Commit**
```bash
git add app/onboard/
git commit -m "feat: add onboard gate page with token validation"
```

---

## Task 7: Create OnboardAgent component

**Files:**
- Create: `components/onboard/OnboardAgent.tsx`

Scripted chat UI. Phases: greeting → name → age → gender → city → university modal. Each agent message animates in with a 600ms delay between lines.

- [ ] **Step 1: Write the component**

```typescript
// components/onboard/OnboardAgent.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import UniversityModal from './UniversityModal';
import WelcomeScreen from './WelcomeScreen';
import type { BrazilianUniversity } from '@/constants/universities';

interface Message { role: 'agent' | 'user'; text: string; }

type Phase = 'greeting' | 'name' | 'age' | 'gender' | 'city' | 'university' | 'welcome';

interface CollectedData {
  name: string;
  age: string;
  gender: 'male' | 'female' | 'other';
  city: string;
  university: BrazilianUniversity | null;
}

const AGENT_SCRIPT: Record<string, (data?: Partial<CollectedData>) => string[]> = {
  greeting: () => [
    'Olá! Fico feliz que você chegou até aqui 😊',
    'Antes de liberar seu acesso, quero conhecer você um pouco. Pode ser rápido, prometo!',
    'Qual é o seu nome?',
  ],
  afterName: (d) => [`Que nome bonito, ${d?.name}! 😄`, 'Quantos anos você tem?'],
  afterAge: (d) => [`Legal! Como prefere ser chamado(a)?`],
  afterGender: (d) => [`Onde você mora? Cidade e estado são suficientes.`],
  afterCity: () => [
    'Perfeito! Última coisa antes de entrar...',
    'Em qual universidade você estuda? Clique na sua abaixo 👇',
  ],
};

export default function OnboardAgent({ token, inviteData }: { token: string; inviteData: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>('greeting');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showUniversity, setShowUniversity] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [data, setData] = useState<CollectedData>({ name: '', age: '', gender: 'other', city: '', university: null });
  const bottomRef = useRef<HTMLDivElement>(null);

  const addAgentMessages = (lines: string[]) => {
    setIsTyping(true);
    lines.forEach((line, i) => {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'agent', text: line }]);
        if (i === lines.length - 1) setIsTyping(false);
      }, i * 700);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => addAgentMessages(AGENT_SCRIPT.greeting()), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    const val = input.trim();
    if (!val || isTyping) return;
    setMessages(prev => [...prev, { role: 'user', text: val }]);
    setInput('');

    if (phase === 'greeting' || phase === 'name') {
      const newData = { ...data, name: val };
      setData(newData);
      setPhase('age');
      setTimeout(() => addAgentMessages(AGENT_SCRIPT.afterName(newData)), 300);
    } else if (phase === 'age') {
      const newData = { ...data, age: val };
      setData(newData);
      setPhase('gender');
      setTimeout(() => addAgentMessages(AGENT_SCRIPT.afterAge(newData)), 300);
    } else if (phase === 'gender') {
      const g = val.toLowerCase();
      const gender: 'male' | 'female' | 'other' =
        g.includes('masc') || g === 'm' ? 'male' :
        g.includes('fem') || g === 'f' ? 'female' : 'other';
      const newData = { ...data, gender };
      setData(newData);
      setPhase('city');
      setTimeout(() => addAgentMessages(AGENT_SCRIPT.afterGender(newData)), 300);
    } else if (phase === 'city') {
      const newData = { ...data, city: val };
      setData(newData);
      setPhase('university');
      setTimeout(() => {
        addAgentMessages(AGENT_SCRIPT.afterCity());
        setTimeout(() => setShowUniversity(true), 1200);
      }, 300);
    }
  };

  const handleUniversitySelect = (university: BrazilianUniversity) => {
    setData(prev => ({ ...prev, university }));
    setShowUniversity(false);
    setTimeout(() => setShowWelcome(true), 1600);
  };

  if (showWelcome) {
    return <WelcomeScreen token={token} collectedData={{ ...data, university: data.university! }} />;
  }

  const genderOptions = [
    { label: 'Masculino', value: 'male' },
    { label: 'Feminino', value: 'female' },
    { label: 'Outro', value: 'other' },
  ];

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-lg flex flex-col gap-4 relative z-10">
        {/* Agent header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <span className="text-white font-black text-xs">Z</span>
          </div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Zaeon</p>
            <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest">Agente de Acesso</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-3 min-h-[300px]">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                  msg.role === 'agent'
                    ? 'bg-white/8 border border-white/10 text-white rounded-tl-sm'
                    : 'bg-cyan-600 text-white rounded-tr-sm'
                }`}>
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-1.5 h-1.5 bg-cyan-400 rounded-full"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }} />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Gender quick-select appears when phase is gender */}
        {phase === 'gender' && !isTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 flex-wrap">
            {genderOptions.map(opt => (
              <button key={opt.value}
                onClick={() => { setInput(opt.label); }}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/70 text-sm hover:border-cyan-500/50 hover:text-cyan-400 transition-all">
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Input */}
        {phase !== 'university' && (
          <div className="flex gap-2 mt-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={phase === 'age' ? 'Ex: 22' : phase === 'city' ? 'Ex: Fortaleza, CE' : 'Digite aqui...'}
              disabled={isTyping}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
            <button onClick={handleSend} disabled={isTyping || !input.trim()}
              className="p-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 rounded-2xl transition-all">
              <PaperAirplaneIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* University modal */}
      <AnimatePresence>
        {showUniversity && (
          <UniversityModal onSelect={handleUniversitySelect} onClose={() => setShowUniversity(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep OnboardAgent
```

- [ ] **Step 3: Commit**
```bash
git add components/onboard/OnboardAgent.tsx
git commit -m "feat: add OnboardAgent conversational UI component"
```

---

## Task 8: Create UniversityModal

**Files:**
- Create: `components/onboard/UniversityModal.tsx`

Searchable grid of university cards. Selected card gets cyan glow (matching `encryption.tsx` pattern). After selection: full-screen logo flash for 1.5s, then calls `onSelect`.

- [ ] **Step 1: Write the component**

```typescript
// components/onboard/UniversityModal.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BRAZILIAN_FEDERAL_UNIVERSITIES, type BrazilianUniversity } from '@/constants/universities';

interface Props {
  onSelect: (university: BrazilianUniversity) => void;
  onClose: () => void;
}

export default function UniversityModal({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BrazilianUniversity | null>(null);
  const [showLogoFlash, setShowLogoFlash] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return BRAZILIAN_FEDERAL_UNIVERSITIES;
    const q = query.toLowerCase();
    return BRAZILIAN_FEDERAL_UNIVERSITIES.filter(u =>
      u.acronym.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.state.toLowerCase().includes(q) ||
      u.city.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (university: BrazilianUniversity) => {
    setSelected(university);
    setShowLogoFlash(true);
    setTimeout(() => {
      setShowLogoFlash(false);
      onSelect(university);
    }, 1500);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Selecione sua universidade"
      >
        <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-6 gap-4">
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-white font-black text-xl uppercase tracking-widest">Sua universidade</h2>
              <p className="text-slate-400 text-xs mt-0.5">Selecione a instituição onde você estuda</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative shrink-0">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por sigla, nome ou estado..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40 transition-all"
            />
          </div>

          {/* Partners banner */}
          {!query && (
            <div className="shrink-0 flex gap-2 items-center">
              <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Parceiros Zaeon</span>
              <div className="flex gap-2">
                {BRAZILIAN_FEDERAL_UNIVERSITIES.filter(u => u.isPartner).map(u => (
                  <button key={u.id} onClick={() => handleSelect(u)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-all">
                    {u.acronym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
              {filtered.map(university => {
                const isSelected = selected?.id === university.id;
                return (
                  <button
                    key={university.id}
                    onClick={() => handleSelect(university)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 text-center group ${
                      isSelected
                        ? 'ring-2 ring-cyan-400 scale-105 border-cyan-400/60 bg-cyan-900/10 shadow-[0_0_20px_rgba(34,211,238,0.4),0_0_40px_rgba(34,211,238,0.2)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                    }`}
                  >
                    {university.isPartner && (
                      <span className="absolute top-2 right-2 text-[8px] font-black text-cyan-400 uppercase bg-cyan-500/10 px-1.5 py-0.5 rounded-full border border-cyan-500/20">
                        Parceiro
                      </span>
                    )}
                    {/* Logo with fallback */}
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl overflow-hidden bg-white/5">
                      <img
                        src={university.logoPath}
                        alt={university.acronym}
                        className="w-full h-full object-contain"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).src =
                            `https://ui-avatars.com/api/?name=${university.acronym}&background=${university.color.replace('#','')}&color=fff&size=80`;
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-white font-black text-xs uppercase tracking-wider">{university.acronym}</p>
                      <p className="text-slate-500 text-[9px] font-bold uppercase">{university.state}</p>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                  Nenhuma universidade encontrada para "{query}"
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Logo flash overlay */}
      <AnimatePresence>
        {showLogoFlash && selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.img
                src={selected.logoPath}
                alt={selected.name}
                className="w-40 h-40 object-contain"
                style={{ filter: `drop-shadow(0 0 40px ${selected.color}80)` }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src =
                    `https://ui-avatars.com/api/?name=${selected.acronym}&background=${selected.color.replace('#','')}&color=fff&size=160`;
                }}
                animate={{ filter: [
                  `drop-shadow(0 0 20px ${selected.color}40)`,
                  `drop-shadow(0 0 60px ${selected.color}90)`,
                  `drop-shadow(0 0 20px ${selected.color}40)`,
                ]}}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <div className="text-center">
                <p className="text-white font-black text-2xl uppercase tracking-widest">{selected.acronym}</p>
                <p className="text-slate-400 text-sm mt-1">{selected.city}, {selected.state}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep UniversityModal
```

- [ ] **Step 3: Commit**
```bash
git add components/onboard/UniversityModal.tsx
git commit -m "feat: add UniversityModal with searchable grid and logo flash animation"
```

---

## Task 9: Create CourseSelector and Testimonials

**Files:**
- Create: `components/onboard/CourseSelector.tsx`
- Create: `components/onboard/Testimonials.tsx`

`ALL_COURSES` already exists in `components/main/OnboardModal.tsx`. Extract it to a shared constant in `constants/courses.ts` to avoid duplication, then import from both places.

- [ ] **Step 1: Extract course list to shared constant**

Create `constants/courses.ts`:
```typescript
// constants/courses.ts
export const ALL_COURSES = [
  "Análise e Desenvolvimento de Sistemas", "Antropologia", "Arquitetura", "Arquivologia",
  "Astronomia", "Astrofísica", "Banco de Dados", "Biblioteconomia", "Bioinformática",
  "Biologia", "Biomedicina", "Biotecnologia", "Ciência da Computação", "Ciência de Dados",
  "Ciência Política", "Ciências Biológicas", "Cinema e Audiovisual", "Comunicação Social",
  "Computação em Nuvem", "Dança", "Design Digital / UX / UI", "Direito",
  "Ecologia", "Educação Física", "Enfermagem", "Engenharia da Computação",
  "Engenharia de Software", "Estatística", "Farmácia", "Filosofia", "Física",
  "Fisioterapia", "Fonoaudiologia", "Geofísica", "Geografia", "História",
  "Inteligência Artificial", "Internet das Coisas", "Jogos Digitais", "Jornalismo",
  "Letras", "Linguística", "Matemática", "Matemática Aplicada", "Medicina",
  "Meteorologia", "Museologia", "Música", "Nutrição", "Odontologia",
  "Pedagogia", "Produção Cultural", "Psicologia", "Publicidade e Propaganda",
  "Redes de Computadores", "Relações Internacionais", "Robótica",
  "Segurança da Informação / Cibersegurança", "Serviço Social", "Sistemas de Informação",
  "Sociologia", "Teatro", "Teologia", "Terapia Ocupacional",
  "Computer Science", "Software Engineering", "Information Systems",
].sort();
```

- [ ] **Step 2: Create CourseSelector**

```typescript
// components/onboard/CourseSelector.tsx
"use client";

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ALL_COURSES } from '@/constants/courses';

interface Props {
  onSelect: (course: string) => void;
  selected: string;
}

export default function CourseSelector({ onSelect, selected }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return ALL_COURSES;
    return ALL_COURSES.filter(c => c.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar seu curso..."
          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-black dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50 transition-all"
        />
      </div>
      <div className="flex-1 overflow-y-auto flex flex-wrap gap-2 content-start" style={{ scrollbarWidth: 'thin' }}>
        {filtered.map(course => (
          <motion.button
            key={course}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(course)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selected === course
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-500/20'
                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            {course}
          </motion.button>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-400 text-sm py-4">Nenhum curso encontrado.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Testimonials**

```typescript
// components/onboard/Testimonials.tsx
"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StarIcon } from '@heroicons/react/24/solid';

const TESTIMONIALS = [
  { name: 'Ana Beatriz', university: 'UFC', course: 'Ciência da Computação', text: 'A Zaeon transformou como eu faço pesquisa. Terminei meu TCC em metade do tempo.' },
  { name: 'Carlos Eduardo', university: 'UFMG', course: 'Engenharia de Software', text: 'O modo foco é incrível. Consigo estudar por horas sem me distrair.' },
  { name: 'Larissa Mendes', university: 'UFRJ', course: 'Medicina', text: 'A organização de artigos científicos ficou muito mais simples. Recomendo demais!' },
  { name: 'Pedro Alves', university: 'UnB', course: 'Direito', text: 'As normas ABNT integradas salvaram minha vida. Não erro mais formatação.' },
  { name: 'Marina Costa', university: 'UFPE', course: 'Psicologia', text: 'O agente de pesquisa encontra fontes que eu nunca acharia sozinha. Fantástico.' },
  { name: 'Thiago Santos', university: 'UFRGS', course: 'Física', text: 'A sala colaborativa com meu orientador ficou fácil demais. Aprovado com louvor!' },
  { name: 'Juliana Ferreira', university: 'UFBA', course: 'Biologia', text: 'O layout personalizável é demais. Cada um usa do seu jeito e funciona!' },
  { name: 'Rafael Oliveira', university: 'UFSC', course: 'Arquitetura', text: 'Nunca imaginei uma plataforma de estudos tão elegante e funcional ao mesmo tempo.' },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(id);
  }, []);

  const t = TESTIMONIALS[current];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Histórias reais de +10.000 estudantes 🚀
      </p>
      <div className="relative h-36 overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=0ea5e9&color=fff&size=48`}
                alt={t.name}
                className="w-10 h-10 rounded-full border-2 border-cyan-400/30"
              />
              <div>
                <p className="font-black text-sm text-black dark:text-white">{t.name}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">{t.university} · {t.course}</p>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[...Array(5)].map((_, i) => <StarIcon key={i} className="w-3 h-3 text-yellow-400" />)}
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">"{t.text}"</p>
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Dots */}
      <div className="flex gap-1.5 justify-center">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all ${i === current ? 'w-4 h-1.5 bg-cyan-400' : 'w-1.5 h-1.5 bg-slate-300 dark:bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep -E "CourseSelector|Testimonials|courses"
```

- [ ] **Step 5: Commit**
```bash
git add constants/courses.ts components/onboard/CourseSelector.tsx components/onboard/Testimonials.tsx
git commit -m "feat: add CourseSelector and Testimonials components, extract ALL_COURSES constant"
```

---

## Task 10: Create WelcomeScreen

**Files:**
- Create: `components/onboard/WelcomeScreen.tsx`

Split-panel layout. Left: university logo + `CourseSelector`. Right: `Testimonials` + auth buttons (visible after course selected). Before triggering `signIn`, stores data in a cookie to survive the OAuth redirect.

- [ ] **Step 1: Write the component**

```typescript
// components/onboard/WelcomeScreen.tsx
"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';
import CourseSelector from './CourseSelector';
import Testimonials from './Testimonials';
import type { BrazilianUniversity } from '@/constants/universities';

interface CollectedData {
  name: string;
  age: string;
  gender: 'male' | 'female' | 'other';
  city: string;
  university: BrazilianUniversity;
}

interface Props {
  token: string;
  collectedData: CollectedData;
}

export default function WelcomeScreen({ token, collectedData }: Props) {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const welcomeMsg = collectedData.gender === 'female'
    ? `Seja bem-vinda, ${collectedData.name}!`
    : collectedData.gender === 'male'
      ? `Seja bem-vindo, ${collectedData.name}!`
      : `Seja bem-vindo(a), ${collectedData.name}!`;

  const handleAuth = async (provider: 'google' | 'email') => {
    setIsSigningIn(true);
    const onboardPayload = JSON.stringify({
      ...collectedData,
      university: collectedData.university.id,
      universityName: collectedData.university.name,
      course: selectedCourse,
      inviteToken: token,
    });
    // Cookie survives OAuth redirect (not httpOnly — set from client)
    document.cookie = `zaeon_onboard=${encodeURIComponent(onboardPayload)}; path=/; max-age=600; SameSite=Lax`;
    await signIn(provider, { callbackUrl: '/research-lab?tour=true' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#080808] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[600px]">

        {/* LEFT PANEL — Course selection */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-6 p-8 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 rounded-3xl"
        >
          {/* University logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-md">
              <img
                src={collectedData.university.logoPath}
                alt={collectedData.university.acronym}
                className="w-12 h-12 object-contain"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src =
                    `https://ui-avatars.com/api/?name=${collectedData.university.acronym}&background=${collectedData.university.color.replace('#','')}&color=fff&size=64`;
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-black text-black dark:text-white leading-tight">{welcomeMsg}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">A Zaeon.</p>
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-white/10" />

          <div className="flex-1 flex flex-col gap-2 overflow-hidden">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Qual é o seu curso?
            </p>
            <div className="flex-1 overflow-hidden">
              <CourseSelector onSelect={setSelectedCourse} selected={selectedCourse} />
            </div>
          </div>

          {selectedCourse && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-2xl"
            >
              <span className="text-cyan-600 dark:text-cyan-400 text-xs font-black">✓</span>
              <span className="text-cyan-700 dark:text-cyan-300 text-xs font-bold">{selectedCourse}</span>
            </motion.div>
          )}
        </motion.div>

        {/* RIGHT PANEL — Social proof + auth */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-6 p-8 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 rounded-3xl"
        >
          <Testimonials />

          <div className="h-px bg-slate-200 dark:bg-white/10" />

          <AnimatePresence>
            {selectedCourse ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-center">
                  Após escolher o curso
                </p>
                <button
                  onClick={() => handleAuth('google')}
                  disabled={isSigningIn}
                  className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/20 text-black dark:text-white font-bold text-sm hover:border-slate-300 dark:hover:border-white/30 transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Entrar com Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                  <span className="text-slate-400 text-xs">ou</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                </div>

                <button
                  onClick={() => handleAuth('email')}
                  disabled={isSigningIn}
                  className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  ✉ Continuar com outro email
                </button>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-2xl">
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed text-center">
                    <strong>Entraremos em contato para verificar sua identidade em breve.</strong><br />
                    Email acadêmico (.edu.br) <strong>acelera a verificação</strong> e garante{' '}
                    <span className="font-black text-blue-600 dark:text-blue-400">benefícios Pro grátis por 30 dias</span>.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-slate-400 dark:text-slate-500 text-sm"
              >
                ← Selecione seu curso para continuar
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep WelcomeScreen
```

- [ ] **Step 3: Commit**
```bash
git add components/onboard/WelcomeScreen.tsx
git commit -m "feat: add WelcomeScreen split-panel with course selector, testimonials, and auth"
```

---

## Task 11: Create onboard save API route

**Files:**
- Create: `app/api/onboard/save/route.ts`

After OAuth, research-lab calls this endpoint with the cookie data. It reads the session (authenticated user), reads the `zaeon_onboard` cookie, and upserts the User record in Prisma.

- [ ] **Step 1: Write the route**

```typescript
// app/api/onboard/save/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { cookies } from 'next/headers';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = cookies();
  const raw = cookieStore.get('zaeon_onboard')?.value;
  if (!raw) {
    return NextResponse.json({ error: 'No onboard data' }, { status: 400 });
  }

  let data: {
    name: string;
    age: string;
    gender: string;
    city: string;
    university: string;
    universityName: string;
    course: string;
    inviteToken: string;
  };

  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return NextResponse.json({ error: 'Invalid onboard data' }, { status: 400 });
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      name: data.name,
      age: parseInt(data.age) || null,
      gender: data.gender,
      city: data.city,
      institution: data.university,
      course: data.course,
      onboardingComplete: true,
    },
  });

  // Clear cookie by setting max-age=0
  const response = NextResponse.json({ success: true });
  response.cookies.set('zaeon_onboard', '', { path: '/', maxAge: 0 });
  return response;
}
```

> **Note:** `onboardingComplete` may not exist on the Prisma schema yet. Check `prisma/schema.prisma` for this field. If missing, add `onboardingComplete Boolean @default(false)` to the User model and run `npx prisma generate` again.

- [ ] **Step 2: Check/add `onboardingComplete` field**

In `prisma/schema.prisma`, find the User model and verify `onboardingComplete` exists. If not, add:
```prisma
  onboardingComplete Boolean  @default(false)
```
Then:
```bash
npx prisma generate
```

- [ ] **Step 3: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep "onboard/save"
```

- [ ] **Step 4: Commit**
```bash
git add app/api/onboard/ prisma/schema.prisma
git commit -m "feat: add onboard save API to persist user data from cookie post-OAuth"
```

---

## Task 12: Add `data-tour` attributes and tour detection to research-lab

**Files:**
- Modify: `app/research-lab/page.tsx`

Two changes: (1) Add `data-tour` attributes to key interactive elements so `ResearchRoomTour` can spotlight them. (2) Detect `?tour=true` in URL and mount `<ResearchRoomTour />` + call the onboard save API.

- [ ] **Step 1: Add tour data attributes to the sidebar buttons**

In `app/research-lab/page.tsx`, locate the sidebar button for layout toggle (around line 999):

Add `data-tour="layout-toggle"` to the layout toggle button:
```typescript
<button data-tour="layout-toggle" onClick={() => setIsChatLeft(!isChatLeft)} className="flex items-center ...">
```

Add `data-tour="focus-mode"` to the focus mode button (around line 1003):
```typescript
<button data-tour="focus-mode" onClick={toggleFocusMode} className={`...`}>
```

- [ ] **Step 2: Find and tag editor/chat/save elements**

Search for the "new research" button, the save/export button, and the chat input area. Look for text like "Nova Pesquisa" and "Salvar" and the chat `PaperAirplaneIcon` send button in the file. Add these attributes:
- New research button: `data-tour="new-research"`
- Save/ABNT export button: `data-tour="save-research"`
- Chat input wrapper div: `data-tour="ai-chat"`
- PDF upload area: `data-tour="pdf-upload"`
- YouTube section: `data-tour="youtube"`
- Citations section: `data-tour="citations"`
- Specialist tabs: `data-tour="specialists"`

- [ ] **Step 3: Add tour and onboard save logic to the page**

At the top of the `ResearchLabPage` component (after existing state declarations), add:
```typescript
const searchParams = useSearchParams();
const [showTour, setShowTour] = useState(false);
const [onboardSaved, setOnboardSaved] = useState(false);
```

Add `useSearchParams` and `useSession` imports if not already present (they already are). Also import the tour component at the top of the file:
```typescript
import ResearchRoomTour from '@/components/onboard/ResearchRoomTour';
```

After the existing useEffects, add:
```typescript
useEffect(() => {
    if (status !== 'authenticated' || onboardSaved) return;
    const hasCookie = document.cookie.includes('zaeon_onboard=');
    if (!hasCookie) return;
    fetch('/api/onboard/save', { method: 'POST' })
      .then(r => r.json())
      .then(() => setOnboardSaved(true))
      .catch(console.error);
}, [status, onboardSaved]);

useEffect(() => {
    if (status === 'authenticated' && searchParams?.get('tour') === 'true') {
        const timer = setTimeout(() => setShowTour(true), 800);
        return () => clearTimeout(timer);
    }
}, [status, searchParams]);
```

- [ ] **Step 4: Mount `<ResearchRoomTour />` in the JSX**

Near the bottom of the component's return, before the closing `</div>`, add:
```typescript
{showTour && <ResearchRoomTour onComplete={() => setShowTour(false)} />}
```

- [ ] **Step 5: Add `useSearchParams` to imports**

At the top of the file, add to the `next/navigation` import:
```typescript
import { useSearchParams } from 'next/navigation';
```

- [ ] **Step 6: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep research-lab
```

- [ ] **Step 7: Commit**
```bash
git add app/research-lab/page.tsx
git commit -m "feat: add data-tour attributes and tour/onboard-save logic to research-lab"
```

---

## Task 13: Create ResearchRoomTour

**Files:**
- Create: `components/onboard/ResearchRoomTour.tsx`

12-step overlay tour. Each step spotlights a `data-tour` element by computing its `getBoundingClientRect()` and drawing a box-shadow cutout. Card tooltip animates in from the element's direction.

- [ ] **Step 1: Write the component**

```typescript
// components/onboard/ResearchRoomTour.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

interface TourStep {
  id: string;
  target: string | null;
  title: string;
  description: string;
  position: 'center' | 'right' | 'left' | 'top' | 'bottom';
  hasNavigation?: boolean;
  navigationTarget?: string;
  isLast?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  { id: 'welcome', target: null, title: '🎉 Bem-vindo(a) à sua Sala de Pesquisa!', description: 'Este é o coração do Zaeon. Aqui você organiza tudo para o seu TCC. Vamos te apresentar cada ferramenta — são simples, prometo!', position: 'center' },
  { id: 'focus-mode', target: '[data-tour="focus-mode"]', title: '🎯 Modo Foco', description: 'Ativa um ambiente limpo e sem distrações. A navbar some e o layout simplifica. Clique para ver! (Lembre-se: clique de novo para voltar ao normal.)', position: 'right' },
  { id: 'layout-toggle', target: '[data-tour="layout-toggle"]', title: '↔️ Escolha seu Layout', description: 'Prefere a barra de ferramentas à esquerda ou à direita? Clique para alternar. A Zaeon se adapta ao seu jeito de estudar.', position: 'right' },
  { id: 'new-research', target: '[data-tour="new-research"]', title: '📝 Nova Pesquisa', description: 'Clique aqui para começar uma nova pesquisa. Dê um título, e o agente começa a te ajudar a organizar tudo.', position: 'right' },
  { id: 'save-research', target: '[data-tour="save-research"]', title: '💾 Salvar Pesquisa — ABNT', description: 'Este é o botão mais importante! Ao salvar, sua pesquisa é formatada automaticamente nas normas ABNT. Título, referências, citações — tudo no padrão correto para TCC.', position: 'top' },
  { id: 'ai-chat', target: '[data-tour="ai-chat"]', title: '🤖 Agente de Pesquisa', description: 'Pergunte qualquer coisa ao seu agente. Ele busca artigos, resume documentos, sugere referências e até corrige seu texto.', position: 'left' },
  { id: 'pdf-upload', target: '[data-tour="pdf-upload"]', title: '📄 Upload de PDFs', description: 'Arraste qualquer PDF aqui — artigos, livros, apostilas. O agente lê e referencia automaticamente.', position: 'right' },
  { id: 'youtube', target: '[data-tour="youtube"]', title: '🎬 Vídeos de Apoio', description: 'Adicione links do YouTube. O agente transcreve e extrai os pontos principais para você.', position: 'right' },
  { id: 'citations', target: '[data-tour="citations"]', title: '📌 Notas e Citações', description: 'Salve trechos importantes com um clique. Tudo fica organizado com a fonte correta para suas referências ABNT.', position: 'left' },
  { id: 'specialists', target: '[data-tour="specialists"]', title: '👩‍🔬 Especialistas IA', description: 'Alterne entre diferentes agentes especializados: Scribe (redação), Examiner (avaliação crítica) e mais. Cada um tem um jeito único de te ajudar.', position: 'bottom' },
  { id: 'mural-teaser', target: null, title: '🌐 Próximo: O Mural da Comunidade', description: 'Quando terminar aqui, explore o Mural — onde você se conecta com outros estudantes, compartilha descobertas e colabora em tempo real.', position: 'center', hasNavigation: true, navigationTarget: '/workstation/profiles?tour=true' },
  { id: 'finish', target: null, title: '✅ Tudo certo!', description: 'Você está pronto para usar a Zaeon. Bons estudos! Qualquer dúvida, o agente está sempre aqui. 🚀', position: 'center', isLast: true },
];

interface SpotlightRect { top: number; left: number; width: number; height: number; }

interface Props { onComplete: () => void; }

export default function ResearchRoomTour({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const router = useRouter();
  const current = TOUR_STEPS[step];

  const updateSpotlight = useCallback(() => {
    if (!current.target) { setSpotlight(null); return; }
    const el = document.querySelector(current.target);
    if (!el) { setSpotlight(null); return; }
    const rect = el.getBoundingClientRect();
    setSpotlight({ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 });
  }, [current.target]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [updateSpotlight]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [step]);

  const handleNext = () => {
    if (current.isLast) { onComplete(); return; }
    if (current.hasNavigation && current.navigationTarget) {
      onComplete();
      router.push(current.navigationTarget);
      return;
    }
    setStep(s => s + 1);
  };

  const cardPositionClass = {
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    right: spotlight ? '' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    left: spotlight ? '' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    top: spotlight ? '' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    bottom: spotlight ? '' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  }[current.position];

  const getCardStyle = (): React.CSSProperties => {
    if (!spotlight || current.position === 'center') return {};
    const { top, left, width, height } = spotlight;
    const margin = 16;
    if (current.position === 'right') return { top: Math.max(top, 20), left: left + width + margin };
    if (current.position === 'left') return { top: Math.max(top, 20), right: window.innerWidth - left + margin };
    if (current.position === 'top') return { bottom: window.innerHeight - top + margin, left: Math.max(left, 20) };
    if (current.position === 'bottom') return { top: top + height + margin, left: Math.max(left, 20) };
    return {};
  };

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      {/* Dark overlay with spotlight cutout */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          background: spotlight
            ? `radial-gradient(ellipse at ${spotlight.left + spotlight.width / 2}px ${spotlight.top + spotlight.height / 2}px, transparent ${Math.max(spotlight.width, spotlight.height) * 0.4}px, rgba(0,0,0,0.75) ${Math.max(spotlight.width, spotlight.height) * 0.7}px)`
            : 'rgba(0,0,0,0.7)',
        }}
        onClick={handleNext}
      />

      {/* Spotlight border */}
      {spotlight && (
        <div
          className="absolute rounded-2xl border-2 border-cyan-400/60 pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          }}
        />
      )}

      {/* Tour card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className={`absolute w-80 pointer-events-auto ${current.position === 'center' ? cardPositionClass : ''}`}
          style={current.position !== 'center' ? getCardStyle() : undefined}
        >
          <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-black text-base text-black dark:text-white leading-snug">{current.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">{current.description}</p>
              </div>
              <button onClick={onComplete} className="shrink-0 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              {/* Progress dots */}
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <div key={i} className={`rounded-full transition-all ${i === step ? 'w-4 h-1.5 bg-cyan-400' : 'w-1.5 h-1.5 bg-slate-200 dark:bg-white/20'}`} />
                ))}
              </div>

              <div className="flex gap-2">
                {step > 0 && (
                  <button onClick={() => setStep(s => s - 1)}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all">
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                )}
                <button onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all">
                  {current.isLast ? 'Concluir' : current.hasNavigation ? 'Ver Mural' : 'Próximo'}
                  {!current.isLast && <ChevronRightIcon className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button onClick={onComplete}
              className="text-center text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all uppercase tracking-widest font-bold">
              Pular tour (ESC)
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep ResearchRoomTour
```

- [ ] **Step 3: Commit**
```bash
git add components/onboard/ResearchRoomTour.tsx
git commit -m "feat: add 12-step ResearchRoomTour overlay with element spotlight"
```

---

## Task 14: Add mural mini-tour

**Files:**
- Modify: `app/workstation/profiles/NetworkMural.tsx`

Add a 4-step mini-tour that fires when `?tour=true` is in the URL. Uses the same overlay pattern as `ResearchRoomTour` but inline (not a separate component, since it's only 4 steps).

- [ ] **Step 1: Read the top of NetworkMural.tsx**

Read the first 40 lines to identify existing imports and state declarations.

- [ ] **Step 2: Add `useSearchParams` import and tour state**

If `useSearchParams` is not already imported from `next/navigation`, add it. Add tour state near the top of the component function:
```typescript
const searchParams = useSearchParams();
const [muralTourStep, setMuralTourStep] = useState<number | null>(null);

useEffect(() => {
    if (searchParams?.get('tour') === 'true') {
        setTimeout(() => setMuralTourStep(0), 600);
    }
}, [searchParams]);
```

- [ ] **Step 3: Define mini-tour steps as a const inside the component**

```typescript
const MURAL_TOUR = [
    { title: '🌐 O Mural da Comunidade', description: 'Aqui vivem os estudantes Zaeon. Veja perfis, projetos em andamento e colaborações ativas.' },
    { title: '🪪 Seu Perfil', description: 'Clique no seu avatar para editar seu perfil. Adicione seus projetos, áreas de interesse e links.' },
    { title: '🤝 Conectar', description: 'Encontre colegas do mesmo curso ou universidade. Colaboração começa com uma conexão.' },
    { title: '🎓 Pronto para voar!', description: 'Sua conta está ativa. Agora é com você. Boa sorte no TCC!', isLast: true },
];
```

- [ ] **Step 4: Render mini-tour at the end of the JSX return**

Before the closing tag of the outermost wrapper div, add:
```typescript
{muralTourStep !== null && (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
        <motion.div
            key={muralTourStep}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-80 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl p-6 flex flex-col gap-4"
        >
            <div>
                <h3 className="font-black text-base text-black dark:text-white">{MURAL_TOUR[muralTourStep].title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed">{MURAL_TOUR[muralTourStep].description}</p>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex gap-1">
                    {MURAL_TOUR.map((_, i) => (
                        <div key={i} className={`rounded-full transition-all ${i === muralTourStep ? 'w-4 h-1.5 bg-cyan-400' : 'w-1.5 h-1.5 bg-slate-200 dark:bg-white/20'}`} />
                    ))}
                </div>
                <button
                    onClick={() => {
                        if (MURAL_TOUR[muralTourStep].isLast || muralTourStep >= MURAL_TOUR.length - 1) {
                            setMuralTourStep(null);
                        } else {
                            setMuralTourStep(s => (s ?? 0) + 1);
                        }
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                    {MURAL_TOUR[muralTourStep].isLast ? 'Concluir' : 'Próximo'}
                </button>
            </div>
            <button onClick={() => setMuralTourStep(null)}
                className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold hover:text-slate-600 transition-all">
                Pular
            </button>
        </motion.div>
    </div>
)}
```

- [ ] **Step 5: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep NetworkMural
```

- [ ] **Step 6: Commit**
```bash
git add app/workstation/profiles/NetworkMural.tsx
git commit -m "feat: add 4-step mural mini-tour triggered by ?tour=true"
```

---

## Task 15: Final integration check and PR

- [ ] **Step 1: Full TypeScript check**
```bash
npx tsc --noEmit 2>&1
```
Fix any remaining errors before proceeding.

- [ ] **Step 2: Verify OnboardModal still works (no regression)**

The `ALL_COURSES` constant was extracted to `constants/courses.ts` in Task 9. Update `components/main/OnboardModal.tsx` to import from the shared constant instead of defining it locally:

At the top of `OnboardModal.tsx`, replace:
```typescript
const ALL_COURSES = [
    "Ciência da Computação", ...
].sort();
```
With:
```typescript
import { ALL_COURSES } from '@/constants/courses';
```

- [ ] **Step 3: Verify build**
```bash
npx next build 2>&1 | tail -20
```
Expected: no build errors.

- [ ] **Step 4: Manual smoke test checklist**

Start dev server: `npm run dev`

- [ ] Visit `/onboard/INVALID_TOKEN` → should show the red "Link inválido" screen
- [ ] Visit `/onboard/<valid_ClassLink_token>` → should show `OnboardAgent` chat
- [ ] Type a name, age, select gender, type a city → `UniversityModal` should appear
- [ ] Click a university → logo flash → `WelcomeScreen` appears
- [ ] Select a course → auth buttons appear
- [ ] Check console: no TypeScript/React errors
- [ ] Navigate from `/research-lab` to another route → navbar focus mode resets (test bug fix from Task 2)
- [ ] Visit `/research-lab?tour=true` while authenticated → tour overlay appears after 800ms

- [ ] **Step 5: Create PR**
```bash
git push -u origin feat/onboarding-v2-invite-gate
gh pr create \
  --title "feat: invite-only onboarding with AI agent, university modal & research room tour" \
  --body "$(cat <<'EOF'
## Summary
- Adds `/onboard/[token]` gate that validates ClassLink invite tokens before showing the onboarding flow
- Conversational AI agent (OnboardAgent) collects name, age, gender, city — then triggers a searchable university picker modal with glow animations and logo flash
- Split WelcomeScreen: course selector (left) + testimonials carousel + Google/email auth (right)
- Onboard data persisted via cookie through OAuth, saved server-side by new `POST /api/onboard/save`
- 12-step interactive ResearchRoomTour overlay spotlights each lab feature on first login
- 4-step mural mini-tour on `/workstation/profiles?tour=true`
- Fixes focus mode cleanup bug: dispatches `zaeon-focus-mode=false` on page unmount
- Adds 60 Brazilian federal universities to `constants/universities.ts`
- Extracts `ALL_COURSES` to `constants/courses.ts` (shared with existing OnboardModal)

## Test plan
- [ ] Invalid token shows error screen, not a crash
- [ ] Full flow: token → agent → university → welcome → course select → auth buttons appear
- [ ] Focus mode bug: navigate away from research-lab, navbar returns to normal
- [ ] Tour: `/research-lab?tour=true` shows overlay; ESC skips; all 12 steps advance correctly
- [ ] Mural mini-tour: `/workstation/profiles?tour=true` shows 4-step overlay
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx next build` succeeds

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review: Spec Coverage

| Spec section | Task covering it |
|---|---|
| Bug: focus mode cleanup | Task 2 |
| Universidad constants (60 IFES) | Task 4 |
| Python logo fetcher | Task 5 |
| `/onboard/[token]` gate | Task 6 |
| OnboardAgent chat (name/age/gender/city) | Task 7 |
| UniversityModal glow + logo flash | Task 8 |
| WelcomeScreen split layout | Task 10 |
| CourseSelector | Task 9 |
| Testimonials (8 depoimentos) | Task 9 |
| Google + email auth with cookie | Task 10 |
| Verification message ("entraremos em contato") | Task 10 |
| Save onboard data to Prisma | Task 11 |
| data-tour attributes on research-lab | Task 12 |
| 12-step ResearchRoomTour | Task 13 |
| Mural mini-tour (4 steps) | Task 14 |
| Mobile responsive (CourseSelector, UniversityModal scroll) | Tasks 8, 9 — overflow-y-auto with scroll |
| Logo fallback (ui-avatars.com) | Tasks 8, 10 — onError handlers |
| Accessibility: role="dialog" aria-modal | Task 8 — UniversityModal |
| ESC closes modals | Tasks 8, 13 |
| gender-aware welcome message | Task 10 |
| `city` field in Prisma | Task 3 |
