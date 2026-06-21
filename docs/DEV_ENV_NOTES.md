# Notas de Ambiente de Dev (macOS) — evitar travas de git

## Regra de ouro
**Não deixe um `.git` ativo dentro de pasta sincronizada na nuvem.**
No macOS isso inclui `~/Documents` e `~/Desktop` quando "Pastas Desktop e Documentos"
do iCloud está ligado. Vale também para Dropbox, Google Drive, OneDrive.

### Como manter os projetos em Documents (sem trocar o hábito)
O iCloud **ignora qualquer pasta cujo nome termina em `.nosync`**. Então dá pra manter
os projetos dentro de Documents, só renomeando a pasta-mãe:

```bash
# baixa tudo antes (evita perder placeholders), depois renomeia
find ~/Documents/Projects -type f -print0 | xargs -0 -n100 cat > /dev/null 2>&1
mv ~/Documents/Projects ~/Documents/Projects.nosync
cd ~/Documents/Projects.nosync/zaeon-os && git status
```

Resultado: a pasta continua em Documents, o iCloud para de mexer nela, o git volta a
funcionar, e seus documentos "de verdade" seguem sincronizados normalmente.

### Alternativas
- Mover pra fora do iCloud: `mv ~/Documents/Projects ~/Projects` (home não sincroniza).
- Desligar o sync: Ajustes → Apple ID → iCloud → iCloud Drive → "Pastas Desktop e
  Documentos" OFF (mantém os caminhos atuais, mas TODOS os documentos perdem o sync na nuvem).

## O bug
`fatal: .git/index: unable to map index file: Operation timed out`
(ou travas/lentidão aleatórias no git)

Causa: o iCloud transforma arquivos em placeholders e baixa sob demanda. O git usa
`mmap` no `.git/index`; quando o arquivo está "offloaded", o mmap espera o download e
estoura o timeout. Não é corrupção do repo — é o filesystem sincronizado.

## Conserto (uma vez)
```bash
# 1. Força o iCloud a baixar tudo antes de mover
find ~/Documents/Projects -type f -print0 | xargs -0 -n100 cat > /dev/null 2>&1
# 2. Move pra fora do iCloud (home é local)
mv ~/Documents/Projects ~/Projects
# 3. Testa
cd ~/Projects/zaeon-os && git status
```

## Se travar pontualmente (sem mover)
```bash
cd <repo>
rm -f .git/index.lock                 # remove lock travado (se existir)
find .git -type f -print0 | xargs -0 -n100 cat > /dev/null 2>&1   # materializa o .git
git status
# último recurso (não perde working tree): reconstruir o index a partir do HEAD
# rm -f .git/index && git reset
```

## Prevenção
- Clone novos projetos sempre em `~/Projects`.
- Se precisar manter algo em Documents, exclua a `.git` do sync ou desligue
  "Pastas Desktop e Documentos" no iCloud.
- Evite rodar `git`/build enquanto um cliente de sync está sincronizando ativamente.
