# Créditos — áudio do ciberespaço (`public/assets/sounds/cyber/`)

Dois grupos: **(1) editados de fontes externas** e **(2) sintetizados no projeto (originais, CC0)**.
Antes de publicar, confirmar os termos de cada fonte externa e preencher autor/URL/licença abaixo.

## 1) Editados de fontes externas (conferir licença)
| arquivo final | fonte (em `public/assets/sounds/`) | origem | autor / licença | notas de edição |
|---|---|---|---|---|
| `space-bed.ogg` | `leberch-432hz-583080.mp3` | Freesound (usuário "leberch", id 583080) | **preencher** (verificar licença no Freesound) | recorte 60–96s + crossfade 3s (loop) |
| `crystals.ogg` | `freesound_community-crystal-bowl-ab4-1-106673.mp3` | Freesound (id 106673) | **preencher** | recorte 3.0–6.5s + crossfade 1s (loop), mono |
| `step-1/2/3.ogg` | `freesound_community-foot-steps-14426.mp3` | Freesound (id 14426) | **preencher** | 3 pisadas fatiadas, 24k→44.1k, mono, volume baixo |
| `ship-takeoff.ogg` | `spaceship-whooshing-past-epic-stock-media-4-4-00-06.mp3` | Epic Stock Media | **preencher (licença comercial/stock)** | recorte + reforço grave, mono |
| `ship-landing.ogg` | `spaceship-engine-landing-epic-stock-media-3-3-00-05.mp3` | Epic Stock Media | **preencher (licença comercial/stock)** | recorte + limpeza, mono |
| `ship-flight.ogg` | idem landing (Epic Stock Media) | Epic Stock Media | **preencher** | trecho de motor, lowpass, loop, mono |
| `ship-idle.ogg` | idem landing (Epic Stock Media) | Epic Stock Media | **preencher** | trecho de motor, lowpass forte, baixo, loop, mono |

> ⚠️ Epic Stock Media e Freesound têm termos distintos (alguns pedem atribuição, outros proíbem redistribuição do arquivo-fonte avulso). Verificar antes do deploy público.

## 2) Sintetizados no projeto — originais, CC0
Gerados proceduralmente (numpy), sem fonte externa — uso livre:
`blackhole-hum.ogg` · `fire.ogg` · `neuron-chime.ogg` · `jump.ogg` · `land.ogg` · `sit.ogg` · `whoosh-hyperspace.ogg` · `rise.ogg` · `chat-pop.ogg` · `join.ogg` · `leave.ogg` · `study-confirm.ogg` · `near-ping.ogg`

## Arquivos-fonte
Os `.mp3` originais em `public/assets/sounds/` (leberch/freesound/spaceship) são **fontes de edição** — podem ser movidos pra fora do deploy (ex.: `/_sources/`) pra não irem ao bundle público.
