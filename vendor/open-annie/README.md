# open-annie (vendorizado)

O núcleo do personagem do [open-annie](https://github.com/rehan-remade/open-annie) (commit `1a3aebfe`), Apache-2.0
(`LICENSE`, `NOTICE`): a Zaeon do laboratório (components/research/ZaeonDocumentos) usa o `Character` — os clipes por
inércia, a camada de fala, os gestos de cabeça, as expressões com envelope, a piscada, o olhar, a boca e o cabelo.

- `core/` = `packages/core/src` sem os módulos de voz/decisão do open-annie (GPT-Live, Jev, broker).
- Modificações nossas (marcadas no topo de cada arquivo): `character.js` ganhou o gancho `overlay` em `update()`;
  `lipsync.js` marca os `import()` de URL com `webpackIgnore`.
- O pacote de movimento `annie-blender` (63 clipes, **CC0-1.0**) está em `public/zaeon/movimento/annie-blender/`.
- Os avatares do open-annie NÃO vieram (a Zaeon usa o VRM dela, `public/avatars/zaeon/zaeon.vrm`).
