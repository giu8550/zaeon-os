# Créditos — áudio do ciberespaço (`public/assets/sounds/cyber/`)

Dois grupos: **(1) editados de fontes externas** e **(2) sintetizados no projeto (originais, CC0)**.
Antes de publicar, confirmar os termos de cada fonte externa e preencher autor/URL/licença abaixo.

## 1) Editados de fontes externas (conferir licença)
| arquivo final | fonte (em `public/assets/sounds/`) | origem | autor / licença | notas de edição |
|---|---|---|---|---|
| `space-bed.ogg` | `danamusic-calm-meditation-357940.mp3` | Freesound (usuário "danamusic", id 357940) | **preencher** (verificar licença no Freesound) | recorte do início 2–44s + lowpass 2600 + crossfade 4s (loop), nível baixo — 432 Hz leve |
| `crystals.ogg` | `freesound_community-crystal-bowl-ab4-1-106673.mp3` | Freesound (id 106673) | **preencher** | recorte 3.0–6.5s + crossfade 1s (loop), mono |
| `step-1/2/3.ogg` | `freesound_community-foot-steps-14426.mp3` | Freesound (id 14426) | **preencher** | 3 pisadas fatiadas, 24k→44.1k, mono, volume baixo |
| `ship-takeoff.ogg` | `spaceship-whooshing-past-epic-stock-media-4-4-00-06.mp3` | Epic Stock Media | **preencher (licença comercial/stock)** | recorte + reforço grave, mono |
| `ship-landing.ogg` | `spaceship-engine-landing-epic-stock-media-3-3-00-05.mp3` | Epic Stock Media | **preencher (licença comercial/stock)** | só a descida (0.3–2.3s), fade suave, sem impacto, mono |
| `ship-touchdown.ogg` | `spaceship-engine-landing-epic-stock-media-3-3-00-05.mp3` | Epic Stock Media (+ reforço grave synth) | **preencher** | toque real (2.0–3.3s) + thud 58/85Hz + ar hidráulico, mono |
| `ship-flight.ogg` | idem landing (Epic Stock Media) | Epic Stock Media | **preencher** | trecho de motor, lowpass, loop, mono |
| `ship-idle.ogg` | idem landing (Epic Stock Media) | Epic Stock Media | **preencher** | trecho de motor, lowpass forte, baixo, loop, mono |

> ⚠️ Epic Stock Media e Freesound têm termos distintos (alguns pedem atribuição, outros proíbem redistribuição do arquivo-fonte avulso). Verificar antes do deploy público.

## 2) Sintetizados no projeto — originais, CC0
Gerados proceduralmente (numpy), sem fonte externa — uso livre:
`blackhole-hum.ogg` · `neuron-chime.ogg` · `jump.ogg` · `land.ogg` · `cyber-enter.ogg` (startup sofisticado da entrada) · `rise.ogg` · `chat-pop.ogg` · `join.ogg` · `leave.ogg` · `study-confirm.ogg` · `near-ping.ogg`

_Removidos: `fire.ogg`, `computer-hum.ogg`, `computer-typing.ogg` (base fica só com `crystals`), `sit.ogg` (disparava indevidamente na entrada) e `whoosh-hyperspace.ogg` (som estranho na entrada, substituído por `cyber-enter.ogg`)._

## Arquivos-fonte
Os `.mp3` originais em `public/assets/sounds/` (leberch/freesound/spaceship) são **fontes de edição** — podem ser movidos pra fora do deploy (ex.: `/_sources/`) pra não irem ao bundle público.

## Mochila a jato (jetpack)

| arquivo | fonte | autor | licença | edição |
|---|---|---|---|---|
| `jetpack.wav` | "Rocket Engine" — https://opengameart.org/content/rocket-engine | theMinesAreShakin | **CC0 1.0** (domínio público) | estéreo 48 kHz → mono 22,05 kHz WAV (loop sem emenda, 6,1 s) |
| `asa-bater.wav` | "Large Wings Flap" — https://opengameart.org/content/large-wings-flap (de "fast simple chop 5", https://freesound.org/s/127197/) | AntumDeluge / dave.des | **CC0 1.0** (domínio público) | 1 batida recortada (0,58 s), fade-out, mono 22,05 kHz WAV — as asas negras do founder |

**Sintetizados no navegador (sem arquivo, CC0 — código próprio):** `jato-sopro` (o sopro/chiado do jato, por cima do ronco gravado) e `baque` (o corpo batendo no chão ao pousar) — `lib/cyber/audio.ts` (`sintetizarJetpack`, `sintetizarBaque`).

## Animações (poses capturadas)

`lib/cyber/poses-ual.json` — Jump_Start / Jump_Loop / Jump_Land da **Quaternius Universal Animation Library** (https://quaternius.itch.io/universal-animation-library), **CC0 1.0**. Convertidas offline em direções de membros por quadro (o GLB original não vai pro bundle).
