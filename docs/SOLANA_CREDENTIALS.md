# Credenciais soulbound na Solana — onboarding web3 invisível

Toda conquista na Zaeon (nó de habilidade dominado, trabalho/aula concluída, certificação de
mentor) vira uma credencial **soulbound** na Solana, verificável e do aluno. O aluno **nunca**
lida com seed phrase/gas: é identificado pelo e-mail da conta e a Crossmint cria a wallet
custodial no 1º mint (gasless).

## Stack
| Peça | Papel |
|---|---|
| Crossmint (Minting API) | `recipient: "email:<aluno>:solana"` → wallet custodial + mint gasless. cNFT por padrão. |
| Metaplex Bubblegum V2 (cNFT) | primitivo barato (~0.00001 SOL/mint), soulbound nativo. Padrão `cnft`. |
| token-2022 non-transferable | certificação de mentor (alto valor). Padrão `token2022-nt`, coleção `CROSSMINT_COLLECTION_ID_NT`. |
| Helius DAS API | leitura/prova de posse pro Mural de Conquistas (`getAssetBatch`). |

## Código
- `prisma/schema.prisma` → `Credential` (+ `User.solanaWallet`). `@@unique([userId,type,refId])` = idempotência.
- `lib/solana/config.ts` env/rede · `crossmint.ts` cliente · `helius.ts` DAS · `credentials.ts`
  `issueCredential` / `refreshCredential` / `listCredentials` · `achievements.ts` prova da conquista
  antes de emitir por rota · `hooks.ts` ganchos fire-and-forget.
- Rotas: `POST /api/credentials/issue {type,refId}` · `GET /api/credentials` (mural) ·
  `POST /api/credentials/refresh` (polling) · `GET /api/credentials/badge` (SVG do certificado).
- Ganchos plugados: Aulas (`submit`/`progress` → `course`), Research Lab (`abnt-export` com
  `researchWorkId` → `work`). `onSkillMastered` fica pronto pro PR da skill-tree; `onMentorCertified`
  pro TutorEval (camada mestra §3.7).
- UI: `components/research/AchievementsMural.tsx` (liquid glass, selo Solana, "reivindicar minha carteira").

## Env (🔒 Martinez)
`SOLANA_NETWORK=devnet` · `CROSSMINT_SERVER_KEY` · `CROSSMINT_COLLECTION_ID` ·
`CROSSMINT_COLLECTION_ID_NT` (opcional) · `HELIUS_API_KEY`. Ver `.env.example`.
Setup Crossmint (staging = devnet): console → criar coleção Solana (cNFT/compressed) → API key
server com scopes `nfts.create`, `nfts.read`. Pra mentor-cert: coleção token-2022 non-transferable.

## Degradação (regra dura)
`issueCredential` **nunca lança**. Sem chaves, sem e-mail, erro de rede → `Credential{status:"error"}`
e a conquista do aluno segue intacta. Os ganchos são fire-and-forget e não atrasam a resposta.

## Caveats honestos
- **Custódia**: wallets Crossmint são custodiais até o aluno "reivindicar" (portal Crossmint).
  Self-custody real = Privy/Web3Auth (MPC) depois, com mint próprio.
- **Custo em escala**: on-chain ~0.00001 SOL, mas a taxa Crossmint (~US$0,01/mint) domina em
  milhões → migrar pra Bubblegum direto (Helius Mint API + fee-payer próprio) quando o volume vier.
- **Verificação depende de indexer**: cNFT vive em Merkle tree → provar posse exige DAS (Helius).
- **Soulbound do token-2022**: a intransferibilidade é propriedade da COLEÇÃO configurada na
  Crossmint (extension non-transferable), não de um parâmetro por mint.
- **Rede**: devnet no hackathon; mainnet = trocar env + keys (Crossmint prod + Helius mainnet).
