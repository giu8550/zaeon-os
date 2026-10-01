# PR — Camada Solana: TODO certificado vira credencial verificável (onboarding web3 invisível)

> Objetivo: **toda conquista** na Zaeon — nó de habilidade dominado, trabalho/curso concluído, e
> **certificação de mentor (professor)** — vira uma **credencial soulbound na Solana**, verificável e do
> aluno. Requisito duro: **o usuário NUNCA lida com seed phrase/gas** — onboarding por email, gasless.
> Branch: **`aura/solana-credenciais`** (a partir de `main`). Pesquisa de mercado: Sept 2026. Escrito (Fable).

## 0. Stack escolhida (pesquisada)
- **Crossmint** — a superfície única: `recipient: "email:<aluno>:solana"` cria wallet **custodial** automático (sem seed phrase), mint **gasless**, **cNFT** (barato em escala) e produto de **Verifiable Credential (W3C)**. É o que torna o web3 invisível pro aluno.
- **Metaplex Bubblegum V2 (cNFT soulbound)** — primitivo on-chain barato (~0.00001 SOL/mint) e **soulbound nativo** (V2) → milhões de micro-credenciais.
- **token-2022 non-transferable** — pros certificados de **alto valor** (certificação de mentor/doutorado) onde vale o rent por token e a garantia soulbound mais forte.
- **Helius (DAS API)** — leitura/prova pra montar o "mural de credenciais" e verificar posse.
- (Opcional/futuro: **Solana Attestation Service** pra atestações reusáveis tipo "aluno verificado".)

## 1. Schema (Prisma/Mongo, `prisma db push`)
```prisma
model Credential {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  userId String @db.ObjectId
  type String                 // "skill" | "work" | "mentor-cert" | "course"
  refId String                // nodeId/studyId/mentorCertId de origem
  title String
  chain String @default("solana")
  standard String             // "cnft" | "token2022-nt"
  network String @default("devnet")   // devnet no hackathon; mainnet depois
  assetId String?             // id on-chain (cNFT assetId / mint)
  mintTx String?
  crossmintActionId String?   // p/ polling do status
  walletAddress String?       // wallet custodial do aluno (Crossmint)
  status String @default("pending")   // pending|minting|issued|error
  metadata Json?              // trilha de evidência (provenance do harness)
  issuedAt DateTime?
  createdAt DateTime @default(now())
  @@unique([userId, type, refId])     // idempotente: não cunha 2× a mesma conquista
  @@index([userId])
  @@map("credentials")
}
// User: + solanaWallet String?  (cache do endereço custodial, quando existir)
```

## 2. Serviço — `lib/solana/credentials.ts`
```ts
export async function issueCredential(userId, { type, refId, title, metadata, standard = "cnft" }) {
  // idempotência: se já existe (userId,type,refId) issued/minting → retorna
  // resolve email do usuário (resolveUserId/prisma) → recipient "email:<email>:solana"
  // Crossmint: POST /collections/{COLLECTION_ID}/nfts  { recipient, metadata, compressed: standard==="cnft", sendNotification:true }
  //   → grava Credential {status:"minting", crossmintActionId}
  // (mentor-cert de alto valor → standard "token2022-nt": mint não-comprimido, non-transferable)
  // NUNCA lança: erro → Credential{status:"error"}; a conquista do aluno NÃO depende do mint (degrada)
}
export async function refreshCredential(id) { /* poll do actionId → assetId/mintTx → status:"issued" */ }
```
- Env: `CROSSMINT_SERVER_KEY`, `CROSSMINT_COLLECTION_ID`, `HELIUS_API_KEY`, `SOLANA_NETWORK=devnet`.
- **provenance:** `metadata` carrega a trilha de evidência do harness (como a conquista foi obtida) → credencial auditável (casa com open-science).

## 3. Rotas — `app/api/credentials/*`
- `POST /api/credentials/issue { type, refId }` (server-side, guard userId) → `issueCredential`.
- `GET /api/credentials` → mural do aluno: junta `Credential` do Mongo + leitura on-chain via **Helius DAS** (assetIds) pra confirmar posse.
- `POST /api/credentials/refresh` → poll dos `minting`.

## 4. Onde disparar (TODA conquista → Solana)
- **Nó de habilidade dominado** (PR skill-tree): no `mastered` → `issueCredential(userId,{type:"skill",refId:nodeId,title,metadata})`.
- **Trabalho/estudo concluído** (Sala de Estudos/Pesquisa): ao finalizar → `type:"work"`.
- **Certificação de mentor** (camada mestra §3.7, quando existir): ao passar no TutorEval → `type:"mentor-cert", standard:"token2022-nt"` (alto valor, soulbound forte).
- Cada gancho é **fire-and-forget** — nunca bloqueia a conquista; o mint acontece atrás.

## 5. Onboarding web3 INVISÍVEL (o ponto)
- O aluno é identificado pelo **email da conta Zaeon** → Crossmint cria a wallet custodial na hora do 1º mint. **Zero seed phrase, zero gas, zero clique de wallet.**
- UI: um **"Mural de Conquistas"** (liquid glass) mostra as credenciais com selo Solana; um botão discreto **"reivindicar minha carteira"** (opcional) pra quem quiser exportar/auto-custódia depois.
- Nada de linguagem cripto na cara do aluno: "conquista", "certificado", "prova" — a Solana está por baixo.

## 6. Gate / DoD
- [ ] `prisma db push` (credentials + User.solanaWallet).
- [ ] `issueCredential` cunha um **cNFT soulbound na devnet** via Crossmint pra `email:<aluno>` (sem wallet do aluno); idempotente por (userId,type,refId).
- [ ] Dominar um nó da skill-tree → credencial aparece no **Mural de Conquistas** (via Helius DAS) com selo Solana.
- [ ] Certificação de mentor usa `token2022-nt`.
- [ ] Falha de mint → conquista do aluno intacta (degrada; `status:"error"`, sem quebrar). Transpila; `build web` ok.

## 7. Caveats honestos (pro pitch e pra prod)
- **Custódia:** wallets Crossmint são **custodiais** (invisível, mas a plataforma detém a chave até o aluno "reivindicar"). Self-custody = layer Privy/Web3Auth depois (MPC), ao custo de construir o mint próprio.
- **Custo em escala:** cNFT on-chain é ~0.00001 SOL, mas a **taxa da Crossmint (~US$0,01/mint)** domina em milhões → pro volume real, migrar pra Bubblegum direto (Helius Mint API + fee-payer próprio). Pro hackathon/início, Crossmint = velocidade.
- **Verificação depende de indexer:** cNFT vive em Merkle tree → verificar exige Helius DAS. Não prometer "verificável pra sempre sozinho" sem esse infra.
- **Rede:** **devnet** no hackathon; mainnet quando for pra valer (troca de env + key).

## 8. Ordem / fronteira
Depende: PR skill-tree (dá o gancho `type:"skill"`) + as chaves de API (🔒 Martinez: `CROSSMINT_SERVER_KEY`/`COLLECTION_ID`/`HELIUS_API_KEY`, criar conta Crossmint devnet + coleção). Fable escreveu o spec; o executor implementa; Martinez provê as chaves. Demo do pitch: **domino um nó → credencial soulbound cunhada na Solana, na frente dos jurados, sem o aluno ver uma wallet.**
