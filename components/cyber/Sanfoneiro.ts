/**
 * Sanfoneiro — o NPC que toca SANFONA no templo do lounge (referência do dono: a figura de manto creme comprido, o
 * CHAPÉU largo DOURADO e ornamentado com franjas de contas penduradas, a barba, a sanfona vermelha com teclado).
 * Feito em código (estilizado, no traço do mapa): o manto em sino com as barras ornamentadas (rosa/verde/dourado), a
 * túnica marrom por baixo, as mangas largas, as mãos na sanfona; o chapéu em aba larga com a peça central e as franjas.
 * Vivo: o FOLE abre e fecha no compasso, as mãos vão junto, o corpo balança, a cabeça acompanha, as franjas sacodem.
 * Referencial: no chão (y = 0), virado pra +z.
 */
import * as THREE from "three";

export type SanfoneiroHandle = { group: THREE.Group; atualizar(t: number, ritmo?: number): void; dispose(): void };

/** a barra ornamentada do manto (canvas): faixas rosa e verde com arabescos dourados */
function texturaBarra(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!;
  g.fillStyle = "#c98a3c"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#d36f86"; g.fillRect(0, 4, 256, 8); g.fillStyle = "#7aa86a"; g.fillRect(0, 52, 256, 8);
  g.strokeStyle = "#f3d27a"; g.lineWidth = 3;
  for (let x = 0; x < 256; x += 32) { g.beginPath(); g.arc(x + 16, 32, 10, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x, 32); g.quadraticCurveTo(x + 8, 18, x + 16, 22); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** o teclado da sanfona (canvas): teclas brancas e pretas */
function texturaTeclado(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#e9dcc0"; g.fillRect(0, 0, 64, 256);
  g.strokeStyle = "#5a4630"; for (let y = 0; y < 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  g.fillStyle = "#1c1410"; for (let y = 8; y < 256; y += 16) if (Math.floor(y / 16) % 7 !== 2 && Math.floor(y / 16) % 7 !== 6) g.fillRect(0, y - 4, 38, 9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function criarSanfoneiro(o: { low: boolean }): SanfoneiroHandle {
  const g = new THREE.Group(); g.name = "sanfoneiro";
  const corpo = new THREE.Group(); g.add(corpo);
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [];
  const mat = <M extends THREE.Material>(m: M) => { mats.push(m); return m; };
  const add = <T extends THREE.Mesh>(m: T, pai: THREE.Object3D = corpo) => { geos.push(m.geometry); pai.add(m); return m; };
  const seg = o.low ? 12 : 24;
  const creme = mat(new THREE.MeshStandardMaterial({ color: 0xe9d9a8, roughness: 0.85 })), marrom = mat(new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.9 }));
  const pele = mat(new THREE.MeshStandardMaterial({ color: 0xc89068, roughness: 0.7, emissive: 0x3a2010, emissiveIntensity: 0.35 })), dourado = mat(new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.35, metalness: 0.75, emissive: 0x3a2a08, emissiveIntensity: 0.4 }));
  const barba = mat(new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 1 }));
  const texBarra = texturaBarra(); texs.push(texBarra); texBarra.repeat.set(6, 1);
  const barraMat = mat(new THREE.MeshStandardMaterial({ map: texBarra, roughness: 0.7, side: THREE.DoubleSide }));

  // ── o MANTO em sino (perfil girado, aberto na frente) + a túnica marrom aparecendo + a barra ornamentada ──
  const perfil = [[0.05, 0], [0.6, 0.02], [0.56, 0.35], [0.46, 0.85], [0.36, 1.2], [0.3, 1.36], [0.16, 1.44]].map(([r, y]) => new THREE.Vector2(r, y));
  const manto = add(new THREE.Mesh(new THREE.LatheGeometry(perfil, seg, Math.PI * 0.16, Math.PI * 1.68), creme)); manto.rotation.y = Math.PI;   // aberto na frente
  const tunica = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1.38, seg), marrom)); tunica.position.set(0, 0.69, 0.05);
  const barra = add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.61, 0.16, seg, 1, true), barraMat)); barra.position.y = 0.1;
  for (const s of [-1, 1]) { const faixa = add(new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1.3), barraMat)); faixa.position.set(s * 0.19, 0.74, 0.35); faixa.rotation.set(-0.2, s * 0.32, 0); }
  // OMBROS largos (a capa caindo), o pescoço e a CABEÇA: rosto, olhos, sobrancelhas, o bigode e a BARBA cheia
  const ombros = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2), creme)); ombros.position.y = 1.36; ombros.scale.set(1.45, 0.55, 0.85);
  const golaB = add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 20), barraMat)); golaB.rotation.x = Math.PI / 2; golaB.position.y = 1.5;
  const pescoco = add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.16, 10), pele)); pescoco.position.y = 1.55;
  const cabeca = new THREE.Group(); cabeca.position.y = 1.72; corpo.add(cabeca);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.14, seg, 14), pele), cabeca).scale.set(0.92, 1.12, 1);
  const nariz = add(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 6), pele), cabeca); nariz.rotation.x = Math.PI / 2; nariz.position.set(0, 0.0, 0.148);
  const bb = add(new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), barba), cabeca); bb.scale.set(0.95, 1.3, 0.72); bb.position.set(0, -0.13, 0.085);
  for (const s of [-1, 1]) {
    const olho = add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), mat(new THREE.MeshBasicMaterial({ color: 0x1a120c }))), cabeca); olho.position.set(s * 0.048, 0.035, 0.128);
    const sob = add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.012), barba), cabeca); sob.position.set(s * 0.048, 0.066, 0.128); sob.rotation.z = -s * 0.15;
    const big = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 4, 6), barba), cabeca); big.rotation.z = Math.PI / 2 + s * 0.35; big.position.set(s * 0.034, -0.04, 0.14);
  }
  // ── o CHAPÉU: aba larga dourada, a copa, a peça central redonda e as FRANJAS de contas (curtas na frente: o rosto aparece) ──
  const chapeu = new THREE.Group(); chapeu.position.y = 0.15; chapeu.rotation.x = -0.08; cabeca.add(chapeu);
  const aba = add(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.05, seg * 2), dourado), chapeu); aba.scale.set(1.35, 1, 0.8);
  const copa = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.2, seg), dourado), chapeu); copa.position.y = 0.11;
  const frente = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, seg), dourado), chapeu); frente.rotation.x = Math.PI / 2; frente.position.set(0, 0.12, 0.17);
  for (const s of [-1, 1]) { const roda = add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 16), dourado), chapeu); roda.position.set(s * 0.34, 0.03, 0.2); }
  const franjas: THREE.Group[] = [], NF = o.low ? 18 : 30;
  const geoFio = new THREE.CylinderGeometry(0.004, 0.004, 1, 4); geoFio.translate(0, -0.5, 0); geos.push(geoFio);
  const geoConta = new THREE.SphereGeometry(0.016, 6, 6); geos.push(geoConta);
  for (let k = 0; k < NF; k++) {
    const a = (k / NF) * Math.PI * 2, x = Math.cos(a) * 0.7, z = Math.sin(a) * 0.43, f = new THREE.Group(); f.position.set(x, -0.02, z); chapeu.add(f);
    if (Math.sin(a) > 0.55) { chapeu.remove(f); continue; }   // na frente, sem franja: o rosto aparece
    const L = 0.32 + (k % 4) * 0.07;
    const fio = new THREE.Mesh(geoFio, dourado); fio.scale.y = L; f.add(fio);
    for (let j = 1; j <= 3; j++) { const c = new THREE.Mesh(geoConta, dourado); c.position.y = -L * (j / 3); f.add(c); }
    franjas.push(f);
  }
  // ── as MANGAS largas (do ombro até a mão — esticam com o fole) e as MÃOS ──
  const geoManga = new THREE.CylinderGeometry(0.15, 0.09, 1, 12, 1, false); geoManga.translate(0, 0.5, 0); geos.push(geoManga);
  const maos: THREE.Mesh[] = [], mangas: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(geoManga, creme); corpo.add(m); mangas.push(m); maos.push(add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), pele))); }
  // ── a SANFONA: as duas caixas (o lado do TECLADO e o dos baixos) e o FOLE vermelho em pregas ──
  const sanfona = new THREE.Group(); sanfona.position.set(0, 1.08, 0.36); corpo.add(sanfona);
  const vermelho = mat(new THREE.MeshStandardMaterial({ color: 0xd2321e, roughness: 0.4, metalness: 0.2, emissive: 0x3a0804, emissiveIntensity: 0.6 })), escuroS = mat(new THREE.MeshStandardMaterial({ color: 0x2a0a06, roughness: 0.6 }));
  const texTec = texturaTeclado(); texs.push(texTec);
  const teclaMat = mat(new THREE.MeshStandardMaterial({ map: texTec, roughness: 0.6, emissive: 0xffffff, emissiveMap: texTec, emissiveIntensity: 0.25 }));
  const teclado = add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.26), [vermelho, vermelho, vermelho, vermelho, teclaMat, vermelho] as unknown as THREE.Material), sanfona);
  const baixos = add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.26), vermelho), sanfona);
  for (const b of [teclado, baixos]) { const friso = add(new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.51, 0.02), dourado), b); friso.position.z = 0.13; }
  for (let k = 0; k < 8; k++) { const bt = add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), dourado), baixos); bt.position.set(0.068, 0.18 - (k % 4) * 0.08, -0.06 + Math.floor(k / 4) * 0.1); }   // os botões dos baixos
  const NP = 9, pregas: THREE.Mesh[] = [];
  const geoPrega = new THREE.BoxGeometry(0.03, 0.48, 0.25); geos.push(geoPrega);
  for (let k = 0; k < NP; k++) { const p = new THREE.Mesh(geoPrega, k % 2 ? vermelho : escuroS); sanfona.add(p); pregas.push(p); }
  const ombroP = [new THREE.Vector3(0.36, 1.36, 0.02), new THREE.Vector3(-0.36, 1.36, 0.02)], up = new THREE.Vector3(0, 1, 0), dv = new THREE.Vector3(), pc = new THREE.Vector3();

  const fase = Math.random() * 6;
  return {
    group: g,
    atualizar(t, ritmo = 1) {
      // o compasso do BAIÃO (~1,7 s por puxada), o fole abrindo e fechando
      const tt = t * ritmo + fase, puxa = 0.5 + 0.5 * Math.sin(tt * 3.7), abre = 0.22 + 0.3 * puxa;
      teclado.position.x = -0.05 - abre / 2; baixos.position.x = 0.05 + abre / 2;
      pregas.forEach((p, k) => { p.position.x = -abre / 2 + ((k + 0.5) / NP) * abre; p.scale.x = 0.5 + 0.9 * abre; p.rotation.y = (k % 2 ? 1 : -1) * 0.25; });
      sanfona.rotation.z = 0.08 * Math.sin(tt * 3.7);
      // as mãos nas caixas (a direita no teclado, a esquerda nos baixos) e as mangas do ombro até elas
      [teclado, baixos].forEach((caixa, i) => {
        sanfona.updateMatrix(); caixa.updateMatrix();
        pc.copy(caixa.position).add(new THREE.Vector3(i ? 0.08 : -0.08, 0, 0.02)).applyMatrix4(sanfona.matrix);
        maos[i]!.position.copy(pc);
        const om = ombroP[i === 0 ? 1 : 0]!; dv.copy(pc).sub(om); const L = dv.length();
        mangas[i]!.position.copy(om); mangas[i]!.scale.set(1, L, 1); mangas[i]!.quaternion.setFromUnitVectors(up, dv.normalize());
      });
      // o corpo balança no compasso e a cabeça acompanha; as franjas sacodem atrasadas
      corpo.rotation.z = 0.045 * Math.sin(tt * 1.85); corpo.position.y = 0.015 * Math.abs(Math.sin(tt * 3.7));
      cabeca.rotation.set(0.12 + 0.06 * Math.sin(tt * 3.7 + 0.6), 0.1 * Math.sin(tt * 0.9), 0.05 * Math.sin(tt * 1.85));
      franjas.forEach((f, k) => { f.rotation.x = 0.12 * Math.sin(tt * 3.7 - 0.8 + k * 0.4); f.rotation.z = 0.1 * Math.sin(tt * 1.85 - 0.5 + k); });
    },
    dispose() { for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); g.removeFromParent(); },
  };
}
