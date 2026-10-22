# Créditos — corpos de astronauta (traje das armas de fogo)

Convertidos por `scripts/avatar/astronauta-para-glb.mjs`: a malha e a skin intactas; sem as texturas (cada peça vira a
cor média da textura base dela), sem UVs e sem as animações embutidas.

- `astronauta-m.glb` — **"horror game Astronaut"**, de JCastillo (@jcastilloo), Sketchfab
  (https://sketchfab.com/3d-models/d6ac4001ad4f45aeab498bdde1b7ec5f). Licença: Sketchfab Free Standard.
- `astronauta-f.glb` — **"Astronaut character"** (a "Eve"), de Sergi Trojanski (@nathramn), Sketchfab
  (https://sketchfab.com/3d-models/279c978a892d4a46a45bb123d0a67bcd). Licença: **CC BY 4.0** (crédito obrigatório).
  O modelo original não tinha esqueleto: riggado por `scripts/avatar/rigar-eve.mjs` (esqueleto Mixamo nas medidas
  dela, pesos por proximidade; as cores em zonas tiradas da textura).
- `traje-m.glb` / `traje-f.glb` — o **traje único** (out/2026), gerados por `scripts/avatar/traje-unico.mjs` a partir do
  `astronauta-m.glb` (mesma licença dele): as ~500 peças juntadas em 3 malhas (corpo, capacete, viseira) com a cor por
  zona, a versão leve simplificada, e a feminina = o mesmo traje com o corpo ajeitado (o mesmo esqueleto). O
  `astronauta-f.glb` (a Eve) não é mais usado pelo jogo.
