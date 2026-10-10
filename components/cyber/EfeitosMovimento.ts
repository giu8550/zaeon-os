/**
 * EfeitosMovimento — o que se VÊ do movimento turbinado (lib/cyber/movimento): os RISCOS DE VENTO (varetas finas de
 * luz que saem do corpo e ficam pra trás — sprint e dash), o ECO leve da silhueta no dash e a ONDA DE CHOQUE do impacto (um anel de luz que se abre no chão
 * no pouso forte e no dash que bate). Pool fixo (16 ecos, 40 riscos, 4 ondas), aditivo, sem sombra — custo ~zero parado.
 */
import * as THREE from "three";

export type EfeitosMovimentoHandle = {
  /** um fantasma do corpo em `p` (os pés), virado pra `rumo`, na `cor` */
  fantasma(p: THREE.Vector3, rumo: number, cor: THREE.ColorRepresentation, forca?: number): void;
  /** RISCOS DE VENTO (estilo anime): `n` riscos finos saindo do corpo em `p` (os pés) e ficando pra trás na direção
   *  oposta a `dir` (unitária, no plano) — a velocidade sem esconder o corpo */
  vento(p: THREE.Vector3, dir: { x: number; z: number }, cor: THREE.ColorRepresentation, n: number, comp?: number): void;
  /** o RASTRO DA LÂMINA no golpe: a faixa de luz entre o cabo (`base`) e a ponta, nos últimos ~0,12 s — `ativo` = está
   *  cortando agora (chame todo quadro: parado, o rastro só envelhece e some) */
  rastroLamina(base: THREE.Vector3, ponta: THREE.Vector3, ativo: boolean, dt: number): void;
  /** uma onda de choque no chão em `p`, força 0..1 */
  onda(p: THREE.Vector3, forca: number): void;
  atualizar(dt: number): void;
  dispose(): void;
};

const VIDA_FANTASMA = 0.32, VIDA_ONDA = 0.55;

export function criarEfeitosMovimento(cena: THREE.Object3D): EfeitosMovimentoHandle {
  const g = new THREE.Group(); g.name = "efeitos-movimento"; cena.add(g);
  // o fantasma: um ECO leve da silhueta (cápsula estreita, bem transparente — o corpo continua aparecendo)
  const geoF = new THREE.CapsuleGeometry(0.22, 1.15, 4, 10); geoF.translate(0, 0.85, 0);
  // o RISCO de vento: uma vareta fina de luz (1 m no eixo z; a escala estica) — vista de qualquer ângulo
  const geoV = new THREE.BoxGeometry(0.022, 0.022, 1); geoV.translate(0, 0, -0.5);
  const riscos = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(geoV, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.frustumCulled = false; g.add(m); return { m, vida: 0, dur: 0.25, comp: 2 };
  });
  let iV = 0, semente = 1;
  const acaso = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  const fantasmas = Array.from({ length: 16 }, () => {
    const m = new THREE.Mesh(geoF, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.frustumCulled = false; g.add(m); return { m, vida: 0, forca: 1 };
  });
  const geoO = new THREE.RingGeometry(0.82, 1, 56); geoO.rotateX(-Math.PI / 2);
  const ondas = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(geoO, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; g.add(m); return { m, vida: 0, forca: 0 };
  });
  let iF = 0, iO = 0;
  // o RASTRO DA LÂMINA: uma fita (pares base/ponta) com o alfa caindo com a idade (aditiva: alfa = cor escurecida)
  const MAXR = 18, VIDA_RASTRO = 0.1, amostras: { b: THREE.Vector3; p: THREE.Vector3; idade: number }[] = [];
  const geoR = new THREE.BufferGeometry(), posR = new Float32Array(MAXR * 2 * 3), corR = new Float32Array(MAXR * 2 * 3), idxR: number[] = [];
  for (let i = 0; i < MAXR - 1; i++) { const a = i * 2; idxR.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geoR.setIndex(idxR); geoR.setAttribute("position", new THREE.BufferAttribute(posR, 3)); geoR.setAttribute("color", new THREE.BufferAttribute(corR, 3));
  const fita = new THREE.Mesh(geoR, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  fita.frustumCulled = false; fita.visible = false; g.add(fita);
  const corFita = new THREE.Color(0x35ffd0), branco = new THREE.Color(0xd8fff6);
  return {
    fantasma(p, rumo, cor, forca = 1) {
      const f = fantasmas[iF++ % fantasmas.length]!;
      f.m.position.copy(p); f.m.rotation.y = rumo; (f.m.material as THREE.MeshBasicMaterial).color.set(cor); f.vida = VIDA_FANTASMA; f.forca = forca; f.m.visible = true;
    },
    vento(p, dir, cor, n, comp = 2.2) {
      const lx = -dir.z, lz = dir.x;   // o lado
      for (let k = 0; k < n; k++) {
        const r = riscos[iV++ % riscos.length]!, h = 0.25 + acaso() * 1.55, lado = (acaso() - 0.5) * 1.1;
        r.m.position.set(p.x + lx * lado - dir.x * 0.2, p.y + h, p.z + lz * lado - dir.z * 0.2);
        r.m.rotation.set(0, Math.atan2(dir.x, dir.z), 0);   // o −z local (pra onde a vareta cresce) fica pra TRÁS
        (r.m.material as THREE.MeshBasicMaterial).color.set(cor).lerp(new THREE.Color(0xffffff), 0.55);
        r.dur = 0.18 + acaso() * 0.14; r.vida = r.dur; r.comp = comp * (0.6 + acaso() * 0.8); r.m.visible = true;
      }
    },
    rastroLamina(base, ponta, ativo, dt) {
      for (const a of amostras) a.idade += dt;
      while (amostras.length && amostras[0]!.idade > VIDA_RASTRO) amostras.shift();
      if (ativo) { amostras.push({ b: base.clone(), p: ponta.clone(), idade: 0 }); if (amostras.length > MAXR) amostras.shift(); }
      const n = amostras.length; fita.visible = n >= 2;
      if (n < 2) return;
      for (let i = 0; i < n; i++) {
        const a = amostras[i]!, k = 1 - a.idade / VIDA_RASTRO, j = i * 6;
        posR.set([a.b.x, a.b.y, a.b.z, a.p.x, a.p.y, a.p.z], j);
        const cb = corFita.clone().multiplyScalar(0), cp = corFita.clone().lerp(branco, 0.35 * k).multiplyScalar(0.55 * k * k);   // (some pra dentro; o fio da ponta mais aceso)
        corR.set([cb.r, cb.g, cb.b, cp.r, cp.g, cp.b], j);
      }
      geoR.setDrawRange(0, (n - 1) * 6); geoR.attributes.position!.needsUpdate = true; geoR.attributes.color!.needsUpdate = true;
    },
    onda(p, forca) {
      const o = ondas[iO++ % ondas.length]!;
      o.m.position.set(p.x, p.y + 0.06, p.z); o.vida = VIDA_ONDA; o.forca = Math.max(0.2, Math.min(1, forca)); o.m.visible = true;
    },
    atualizar(dt) {
      for (const f of fantasmas) {
        if (!f.m.visible) continue;
        f.vida -= dt; if (f.vida <= 0) { f.m.visible = false; continue; }
        const k = f.vida / VIDA_FANTASMA; (f.m.material as THREE.MeshBasicMaterial).opacity = 0.16 * f.forca * k * k; f.m.scale.set(1 + (1 - k) * 0.25, 1, 1 + (1 - k) * 0.25);
      }
      for (const r of riscos) {
        if (!r.m.visible) continue;
        r.vida -= dt; if (r.vida <= 0) { r.m.visible = false; continue; }
        const u = 1 - r.vida / r.dur;   // nasce curto, estica e some
        r.m.scale.set(1, 1, r.comp * (0.35 + 0.65 * Math.min(1, u * 2.5))); (r.m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - u) * Math.min(1, u * 6);
      }
      for (const o of ondas) {
        if (!o.m.visible) continue;
        o.vida -= dt; if (o.vida <= 0) { o.m.visible = false; continue; }
        const u = 1 - o.vida / VIDA_ONDA, r = 0.6 + u * (3 + 7 * o.forca);
        o.m.scale.setScalar(r); (o.m.material as THREE.MeshBasicMaterial).opacity = 0.85 * o.forca * (1 - u) * (1 - u);
      }
    },
    dispose() {
      for (const f of fantasmas) (f.m.material as THREE.Material).dispose();
      for (const r of riscos) (r.m.material as THREE.Material).dispose(); geoV.dispose();
      geoR.dispose(); (fita.material as THREE.Material).dispose();
      for (const o of ondas) (o.m.material as THREE.Material).dispose();
      geoF.dispose(); geoO.dispose(); g.removeFromParent();
    },
  };
}
