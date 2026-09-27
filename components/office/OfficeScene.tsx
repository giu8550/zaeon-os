"use client";

/**
 * OfficeScene — o escritório isométrico da Zaeon, em Three.js (R3F).
 *
 * Construído do zero. A ideia de "escritório isométrico de agentes" não é de ninguém,
 * mas o projeto que inspirou isto é PolyForm Noncommercial — código dele não entra num
 * produto pago. Aqui não há uma linha portada: câmera ortográfica, caixas e luz.
 *
 * A cena não decide nada. Ela recebe pods já posicionados por `lib/office/mapa.ts` e
 * um estado por slug, e desenha. Mesmo contrato do Modo Revista.
 */
import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrthographicCamera, RoundedBox } from "@react-three/drei";
import type * as THREE from "three";
import type { Pod, EstadoPod } from "@/lib/office/mapa";

const CELULA = 1.15;

function PodMesh({
  pod, estado, selecionado, aoClicar, semMovimento,
}: {
  pod: Pod;
  estado: EstadoPod;
  selecionado: boolean;
  aoClicar: (slug: string) => void;
  semMovimento: boolean;
}) {
  const grupo = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);

  useFrame(({ clock }) => {
    const g = grupo.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    // Trabalhando = o pod respira. Ocioso = parado. Nada de animação ambiente eterna:
    // movimento aqui SIGNIFICA alguma coisa.
    const alvo = semMovimento || estado === "ocioso" ? 0 : Math.sin(t * (estado === "falando" ? 4 : 2)) * 0.06 + 0.06;
    g.position.y += (alvo - g.position.y) * 0.12;
    const escala = hover || selecionado ? 1.08 : 1;
    g.scale.x += (escala - g.scale.x) * 0.15;
    g.scale.y = g.scale.x;
    g.scale.z = g.scale.x;
  });

  const cor = pod.departamento.cor;
  const clique = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); aoClicar(pod.slug); };

  return (
    <group position={[pod.x * CELULA, 0, pod.z * CELULA]}>
      {/* mesa */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.12, 1.1]} />
        <meshStandardMaterial color="#1b2a36" roughness={0.9} />
      </mesh>

      <group ref={grupo}>
        {/* o agente: um bloco com a cor do departamento */}
        <RoundedBox
          args={[0.62, 0.8, 0.62]}
          radius={0.14}
          smoothness={4}
          position={[0, 0.52, 0]}
          onClick={clique}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
          onPointerOut={() => setHover(false)}
        >
          <meshStandardMaterial
            color={cor}
            emissive={cor}
            emissiveIntensity={estado === "ocioso" ? 0.05 : 0.35}
            roughness={0.45}
            metalness={0.1}
          />
        </RoundedBox>

        {/* anel de seleção */}
        {selecionado && (
          <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.62, 0.72, 32]} />
            <meshBasicMaterial color={cor} transparent opacity={0.85} />
          </mesh>
        )}
      </group>

      <Html position={[0, 1.15, 0]} center distanceFactor={10} zIndexRange={[5, 0]}>
        <button
          onClick={() => aoClicar(pod.slug)}
          className="whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-bold text-white/90 bg-black/45 backdrop-blur-sm border border-white/10 hover:border-cyan-400/60 transition-colors"
        >
          {pod.nome}
        </button>
      </Html>
    </group>
  );
}

/** O ⟁ no centro: a Zaeon olhando o escritório dela. */
function Nucleo({ ativo, semMovimento }: { ativo: boolean; semMovimento: boolean }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!m.current || semMovimento) return;
    m.current.rotation.y = clock.getElapsedTime() * (ativo ? 0.9 : 0.25);
  });
  return (
    <mesh ref={m} position={[0, 0.9, 0]}>
      <coneGeometry args={[0.42, 0.7, 3]} />
      <meshStandardMaterial color="#3FD3E6" emissive="#3FD3E6" emissiveIntensity={ativo ? 0.7 : 0.25} roughness={0.3} />
    </mesh>
  );
}

export default function OfficeScene({
  pods, estados, selecionado, aoSelecionar, semMovimento = false,
}: {
  pods: readonly Pod[];
  estados: Record<string, EstadoPod>;
  selecionado: string | null;
  aoSelecionar: (slug: string) => void;
  semMovimento?: boolean;
}) {
  const algumTrabalhando = useMemo(
    () => Object.values(estados).some((e) => e !== "ocioso"),
    [estados],
  );
  const profundidade = useMemo(
    () => Math.max(...pods.map((p) => Math.abs(p.z)), 3) * CELULA + 4,
    [pods],
  );

  return (
    <Canvas dpr={[1, 2]} shadows={false} gl={{ antialias: true, alpha: true }}>
      {/* Ortográfica = isométrica de verdade: sem perspectiva, o fundo não encolhe. */}
      <OrthographicCamera makeDefault position={[9, 9, 9]} zoom={52} near={-50} far={100} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} />
      <directionalLight position={[-6, 4, -6]} intensity={0.35} color="#3FD3E6" />

      {/* chão */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[profundidade * 2.2, profundidade * 1.6]} />
        <meshStandardMaterial color="#0d1822" roughness={1} />
      </mesh>

      <Nucleo ativo={algumTrabalhando} semMovimento={semMovimento} />

      {pods.map((p) => (
        <PodMesh
          key={p.slug}
          pod={p}
          estado={estados[p.slug] ?? "ocioso"}
          selecionado={selecionado === p.slug}
          aoClicar={aoSelecionar}
          semMovimento={semMovimento}
        />
      ))}
    </Canvas>
  );
}
