"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Atom, Dna, Leaf, Microscope, FlaskConical, Brain,
  Loader2, Sparkles, RotateCw, Grid3x3,
  Info, Send, X, ZoomIn, CheckCircle2, CloudOff, ImagePlus
} from 'lucide-react';

import type { SceneDescriptor, VoxelBlock } from './types';
import { ROOM_PRESETS, DEFAULT_ROOM } from './presets';
import { ROOM_POLICY } from './accessPolicy';
import { buildVoxels } from './voxelGenerators';
import type { SavedSession } from './SessionManager';
import type { Annotation } from './PDAOverlay';
import AnatomyCanvas, { type AnatomyAsset } from './AnatomyCanvas';

// ─── Anel de geração com estágios ────────────────────────────────────────────
// Monta só enquanto isLoading (o ciclo de vida do componente controla o timer).
// Dá sensação de progresso e reduz a ansiedade da espera de rede do PubChem/AI.
const GEN_STAGES = [
  'Interpretando o pedido…',
  'Consultando o PubChem…',
  'Baixando a estrutura 3D…',
  'Montando os átomos…',
  'Renderizando em voxels…',
];
function GeneratingRing({ colorClass }: { colorClass: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, GEN_STAGES.length - 1)),
      900,
    );
    return () => clearInterval(id);
  }, []);
  const pct = ((step + 1) / GEN_STAGES.length) * 100;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
          <motion.circle
            cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
            className={colorClass}
            strokeDasharray={264}
            animate={{ strokeDashoffset: 264 - (264 * pct) / 100 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </svg>
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        >
          <Dna size={24} className={colorClass} />
        </motion.div>
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-[10px] uppercase tracking-widest text-slate-300 font-bold mt-4"
        >
          {GEN_STAGES[step]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ─── Dynamic imports (Three.js + complex components can't SSR) ───────────────
const VoxelCanvas = dynamic(() => import('./VoxelCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
          Booting 3D Engine…
        </span>
      </div>
    </div>
  ),
});

const PDAOverlay = dynamic(() => import('./PDAOverlay'), { ssr: false });
const SessionManager = dynamic(() => import('./SessionManager'), { ssr: false });

// ─── Room meta ────────────────────────────────────────────────────────────────
const ROOM_ICONS: Record<string, React.ElementType> = {
  bio: Leaf, med: Microscope, quantic: Atom, cyber: Brain, humanities: FlaskConical,
};
const ROOM_COLORS: Record<string, { accent: string; text: string; border: string; pill: string }> = {
  bio:        { accent: '#22c55e', text: 'text-emerald-400', border: 'border-emerald-500/30', pill: 'bg-emerald-500/20 text-emerald-300' },
  med:        { accent: '#f87171', text: 'text-rose-400',    border: 'border-rose-500/30',    pill: 'bg-rose-500/20 text-rose-300' },
  quantic:    { accent: '#818cf8', text: 'text-indigo-400',  border: 'border-indigo-500/30',  pill: 'bg-indigo-500/20 text-indigo-300' },
  cyber:      { accent: '#22d3ee', text: 'text-cyan-400',    border: 'border-cyan-500/30',    pill: 'bg-cyan-500/20 text-cyan-300' },
  humanities: { accent: '#f59e0b', text: 'text-amber-400',   border: 'border-amber-500/30',   pill: 'bg-amber-500/20 text-amber-300' },
};

// ─── Save status indicator ────────────────────────────────────────────────────
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  return (
    <AnimatePresence>
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex items-center gap-1.5"
      >
        {status === 'saving' && (
          <>
            <Loader2 size={10} className="animate-spin text-slate-400" />
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Saving…</span>
          </>
        )}
        {status === 'saved' && (
          <>
            <CheckCircle2 size={10} className="text-emerald-400" />
            <span className="text-[9px] text-emerald-500 uppercase tracking-widest font-bold">Saved</span>
          </>
        )}
        {status === 'error' && (
          <>
            <CloudOff size={10} className="text-red-400" />
            <span className="text-[9px] text-red-400 uppercase tracking-widest font-bold">Offline</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface BioSim3DModuleProps {
  courseRoom?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BioSim3DModule({ courseRoom = DEFAULT_ROOM }: BioSim3DModuleProps) {
  const [activeRoom, setActiveRoom] = useState(courseRoom);
  const policy = ROOM_POLICY[activeRoom];
  const [activeScene, setActiveScene] = useState<SceneDescriptor | null>(null);
  const [voxels, setVoxels] = useState<VoxelBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [outOfScope, setOutOfScope] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'generator' | 'generator-ai' | 'pubchem' | 'rcsb_pdb' | 'anatomy_glb' | null>(null);
  const [realMetadata, setRealMetadata] = useState<Record<string,any> | null>(null);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [renderHistory, setRenderHistory] = useState<SceneDescriptor[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isSaving, setIsSaving] = useState(false);

  type RoomState = {
    scene: SceneDescriptor | null;
    voxels: VoxelBlock[];
    dataSource: 'generator' | 'generator-ai' | 'pubchem' | 'rcsb_pdb' | 'anatomy_glb' | null;
    metadata: Record<string,any> | null;
    prompt: string;
    sessionId: string | null;
    anatomyAssets: AnatomyAsset[];
  };
  const [roomStates, setRoomStates] = useState<Record<string, RoomState>>({});
  const [anatomyAssets, setAnatomyAssets] = useState<AnatomyAsset[]>([]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presets = ROOM_PRESETS[activeRoom] ?? ROOM_PRESETS.bio;
  const roomColor = ROOM_COLORS[activeRoom] ?? ROOM_COLORS.bio;
  const voxelCount = voxels.length;

  useEffect(() => {
    if (presets.length > 0 && !activeScene) {
      applyScene(presets[0].descriptor, undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, presets, activeScene]);

  const handleRoomChange = useCallback((newRoom: string) => {
    if (newRoom === activeRoom) return;
    
    setRoomStates(prev => ({
      ...prev,
      [activeRoom]: {
        scene: activeScene,
        voxels,
        dataSource,
        metadata: realMetadata,
        prompt,
        sessionId: currentSessionId,
        anatomyAssets,
      }
    }));

    setRoomStates(prev => {
      const saved = prev[newRoom];
      if (saved) {
        setActiveScene(saved.scene);
        setVoxels(saved.voxels);
        setDataSource(saved.dataSource);
        setRealMetadata(saved.metadata);
        setPrompt(saved.prompt);
        setCurrentSessionId(saved.sessionId);
        setAnatomyAssets(saved.anatomyAssets || []);
      } else {
        setActiveScene(null);
        setVoxels([]);
        setDataSource(null);
        setRealMetadata(null);
        setPrompt('');
        setCurrentSessionId(null);
        setAnatomyAssets([]);
      }
      return prev;
    });
    
    setActiveRoom(newRoom);
    setAiError(null);
    setOutOfScope(null);
  }, [activeRoom, activeScene, voxels, dataSource, realMetadata, prompt, currentSessionId, anatomyAssets]);

  // Rebuild voxels when scene changes (only if it wasn't pre-populated by AI/APIs)
  useEffect(() => {
    if (!activeScene) return;
    
    // Skip if voxels were already set directly from AI image parsing or PubChem
    if (dataSource && dataSource !== 'generator') return;

    setIsLoading(true);
    setError(null);
    const t = setTimeout(() => {
      try {
        const blocks = buildVoxels(activeScene.renderMode, activeScene.parameters ?? {});
        setVoxels(blocks);
      } catch (e: any) {
        setError(e.message ?? 'Generation failed');
      } finally {
        setIsLoading(false);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [activeScene, dataSource]);

  const applyScene = useCallback((descriptor: SceneDescriptor, fromPrompt?: string) => {
    setActiveScene(descriptor);
    setAiError(null);
    setShowInfo(false);

    setRenderHistory(prev => {
      const next = [...prev, descriptor].slice(-20);
      return next;
    });

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSave(descriptor, fromPrompt);
    }, 1200);
  }, []); // eslint-disable-line

  const autoSave = useCallback(async (
    descriptor: SceneDescriptor,
    prompt?: string
  ) => {
    setSaveStatus('saving');
    try {
      const sessionId = currentSessionId ?? crypto.randomUUID();
      const res = await fetch('/api/agentic/biosim/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:              sessionId,
          title:           descriptor.title,
          prompt,
          courseRoom:      activeRoom,
          sceneDescriptor: descriptor,
          renderHistory:   [...renderHistory, descriptor].slice(-20),
          voxelCount,
          annotations,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!currentSessionId) setCurrentSessionId(data.session?.id ?? sessionId);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [currentSessionId, activeRoom, renderHistory, voxelCount, annotations]);

  const handleManualSave = useCallback(async () => {
    if (!activeScene || isSaving) return;
    setIsSaving(true);
    await autoSave(activeScene, prompt || undefined);
    setIsSaving(false);
  }, [activeScene, isSaving, autoSave, prompt]);

  const handleLoadSession = useCallback((session: SavedSession) => {
    setCurrentSessionId(session.id);
    setActiveScene(session.sceneDescriptor as SceneDescriptor);
    setRenderHistory((session.renderHistory ?? []) as SceneDescriptor[]);
    setAnnotations(session.annotations ?? []);
    setAiError(null);
    setOutOfScope(null);
    setShowInfo(false);
  }, []);

  const loadPreset = useCallback((preset: (typeof presets)[0]) => {
    applyScene(preset.descriptor, undefined);
    setPrompt('');
    setDataSource('generator');
  }, [applyScene]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setAiError("Image must be under 4MB.");
      return;
    }

    setSelectedImage(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
    setAiError(null);
  };

  const removeImage = useCallback(() => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imagePreview]);

  // ─── AI prompt updated to use FormData ───────────────────────────────────────
  const handlePromptSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed && !selectedImage) return;
    if (isLoading) return;

    setIsLoading(true);
    setAiError(null);
    setOutOfScope(null);
    setDataSource(null);
    setRealMetadata(null);

    try {
      // Must use FormData to upload file binary
      const formData = new FormData();
      formData.append('prompt', trimmed);
      formData.append('courseRoom', activeRoom);
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const res = await fetch('/api/agentic/biosim', {
        method: 'POST',
        // Fetch auto-sets correct Content-Type with boundary for FormData
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403 && errData.error === 'out_of_scope') {
          setOutOfScope(errData.message ?? 'Fora do escopo desta sala.');
          return;
        }
        throw new Error(`API ${res.status}`);
      }
      const data = await res.json();

      // ── Real coordinates from PubChem, PDB, Anatomy GLB or AI generative vision ────────
      if ((data.voxels && data.voxels.length > 0) || data.type === 'anatomy_glb') {
        if (data.type === 'anatomy_glb') {
           setAnatomyAssets(data.assets || []);
           setVoxels([]);
        } else {
           setVoxels(data.voxels);
           setAnatomyAssets([]);
        }

        setDataSource(data.source || data.type);
        setRealMetadata(data.metadata ?? null);
        
        if (data.descriptor) {
          setActiveScene(data.descriptor);
          setRenderHistory(prev => [...prev, data.descriptor].slice(-20));
          if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
          autoSaveTimer.current = setTimeout(() => autoSave(data.descriptor, trimmed), 1200);
        }
        
        setPrompt('');
        removeImage();
        setIsLoading(false);
        return;
      }

      // ── Descriptor → local generator ───────────────────────────────────────
      if (data.descriptor) {
        setDataSource('generator');
        applyScene(data.descriptor, trimmed);
        setPrompt('');
        removeImage();
      } else {
        setAiError('AI could not interpret that. Try rephrasing or use a preset.');
      }
    } catch (e: any) {
      setAiError(e.message ?? 'Connection error');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedImage, activeRoom, isLoading, applyScene, autoSave, removeImage]);

  const handleAddAnnotation = useCallback(async (text: string, color: string) => {
    const res = await fetch('/api/agentic/biosim/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId:  currentSessionId,
        text,
        color,
        sceneTitle: activeScene?.title ?? 'Unknown',
      }),
    });
    if (!res.ok) throw new Error('Save failed');
    const data = await res.json();
    if (data.annotation) {
      setAnnotations(prev => [...prev, data.annotation]);
    }
  }, [currentSessionId, activeScene]);

  const handleDeleteAnnotation = useCallback(async (annotationId: string) => {
    await fetch(
      `/api/agentic/biosim/annotations?sessionId=${currentSessionId}&annotationId=${annotationId}`,
      { method: 'DELETE' }
    );
    setAnnotations(prev => prev.filter(a => a.id !== annotationId));
  }, [currentSessionId]);

  const legend = useMemo(() => {
    if (!voxels || voxels.length === 0) return [];
    const map = new Map<string, string>();
    voxels.forEach(v => {
      if (v.label && v.color) {
        let displayLabel = v.label;
        if (displayLabel.includes('(')) {
          displayLabel = displayLabel.split(' ')[0];
        }
        if (!map.has(displayLabel)) {
          map.set(displayLabel, v.color);
        }
      }
    });
    return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]));
  }, [voxels]);

  return (
    <div
      className={`w-full flex flex-col gap-0 rounded-[2rem] overflow-hidden border
        ${roomColor.border} bg-white/5 dark:bg-black/20 backdrop-blur-2xl shadow-2xl relative`}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-black/30 border ${roomColor.border}`}>
            <Dna size={16} className={roomColor.text} />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">
              BioSim <span className="font-mono text-xs text-slate-400">3D</span>
            </h3>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold hidden sm:block">
              3D Particle Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <SaveIndicator status={saveStatus} />
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${roomColor.pill}`}>
            {dataSource === 'anatomy_glb' ? `${anatomyAssets.length} obj` : `${voxelCount.toLocaleString()} pt`}
          </span>
          <SessionManager
            currentSessionId={currentSessionId}
            onLoadSession={handleLoadSession}
            onSaveRequest={handleManualSave}
            isSaving={isSaving}
            accentColor={roomColor.accent}
          />
          <button onClick={() => setAutoRotate(v => !v)} title="Toggle rotation"
            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${autoRotate ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-slate-500'}`}>
            <RotateCw size={13} />
          </button>
          <button onClick={() => setShowGrid(v => !v)} title="Toggle grid"
            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${showGrid ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-slate-500'}`}>
            <Grid3x3 size={13} />
          </button>
          {activeScene && (
            <button onClick={() => setShowInfo(v => !v)} title="Scene info"
              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${showInfo ? `${roomColor.pill} border-current` : 'border-white/10 text-slate-500'}`}>
              <Info size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 pt-3 pb-2 overflow-x-auto scrollbar-hidden">
        {Object.keys(ROOM_PRESETS).map(room => {
          const Icon = ROOM_ICONS[room] ?? Atom;
          const rc   = ROOM_COLORS[room] ?? ROOM_COLORS.bio;
          const isActive  = activeRoom === room;
          return (
            <button key={room}
              onClick={() => handleRoomChange(room)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest whitespace-nowrap border select-none transition-colors outline-none focus:ring-2 focus:ring-white/20 ${
                isActive
                  ? `${rc.pill} ${rc.border}`
                  : 'border-white/10 text-slate-500 hover:text-white hover:border-white/30 bg-white/5 hover:bg-white/10'
              }`}
            >
              <Icon size={11} />{room}
            </button>
          );
        })}
        {policy && (
          <span className="ml-auto text-[8px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">
            {policy.emoji} {policy.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hidden">
        {presets.map(preset => (
          <button key={preset.id} onClick={() => loadPreset(preset)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold whitespace-nowrap transition-all border ${
              activeScene?.title === preset.descriptor.title
                ? 'bg-white/15 border-white/30 text-white'
                : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/20'
            }`}
          >
            <span>{preset.emoji}</span>
            <span>{preset.label}</span>
          </button>
        ))}
      </div>

      <div className="relative w-full" style={{ height: isFullscreen ? '80vh' : '440px' }}>
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
            <GeneratingRing colorClass={roomColor.text} />
          </div>
        )}

        {dataSource && dataSource !== 'generator' && dataSource !== 'generator-ai' && !isLoading && (
          <div className="absolute top-3 right-10 z-30 flex items-center gap-1.5 px-2 py-1 rounded-lg
            bg-black/50 border border-white/15 backdrop-blur-sm">
            {dataSource === 'pubchem' && (
              <><span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">PubChem</span>
              {realMetadata?.formula && <span className="text-[8px] text-slate-400">{realMetadata.formula}</span>}
              {realMetadata?.pubchemUrl && (
                <a href={realMetadata.pubchemUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[8px] text-cyan-500 hover:text-cyan-300 underline pointer-events-auto">↗</a>
              )}</>
            )}
            {dataSource === 'rcsb_pdb' && (
              <><span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">RCSB PDB</span>
              {realMetadata?.pdbId && <span className="text-[8px] text-slate-400">{realMetadata.pdbId}</span>}
              {realMetadata?.resolution && <span className="text-[8px] text-slate-500">{realMetadata.resolution}Å</span>}
              {realMetadata?.pdbUrl && (
                <a href={realMetadata.pdbUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[8px] text-purple-400 hover:text-purple-300 underline pointer-events-auto">↗</a>
              )}</>
            )}
          </div>
        )}

        {/* Legend Overlay & 2D PubChem Preview */}
        {!isLoading && !error && activeScene && legend.length > 0 && (
          <div className="absolute top-3 left-3 z-30 flex flex-col gap-2 pointer-events-none">
            {/* 2D Molecule Reference */}
            {dataSource === 'pubchem' && realMetadata?.cid && (
              <div className="w-24 h-24 bg-white rounded-xl shadow-lg overflow-hidden border border-white/20 p-1 pointer-events-auto">
                <img 
                  src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${realMetadata.cid}/PNG`} 
                  alt="2D Structure" 
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>
            )}
            {/* Color Legend */}
            <div className="bg-black/60 rounded-xl border border-white/10 backdrop-blur-md p-2.5 pointer-events-auto">
              <h4 className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 border-b border-white/10 pb-1">
                Element Legend
              </h4>
              <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto scrollbar-hidden">
                {legend.map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-mono text-slate-300">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-6">
              <X size={28} className="text-red-400 mx-auto mb-2" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && dataSource === 'anatomy_glb' && anatomyAssets.length > 0 && (
          <div className="absolute inset-0 z-0">
            <AnatomyCanvas assets={anatomyAssets} autoRotate={autoRotate} />
          </div>
        )}

        {!isLoading && !error && dataSource !== 'anatomy_glb' && voxels.length > 0 && (
          <VoxelCanvas
            voxels={voxels}
            backgroundColor="#030014"
            autoRotate={autoRotate}
            showGrid={showGrid}
            accentColor={roomColor.accent}
          />
        )}

        {!isLoading && !error && activeScene && (
          <PDAOverlay
            sessionId={currentSessionId}
            sceneTitle={activeScene.title}
            annotations={annotations}
            onAddNote={handleAddAnnotation}
            onDeleteNote={handleDeleteAnnotation}
            accentColor={roomColor.accent}
          />
        )}

        <button onClick={() => setIsFullscreen(v => !v)}
          className="absolute bottom-3 right-3 z-30 w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors backdrop-blur-sm"
        >
          <ZoomIn size={13} />
        </button>

        {renderHistory.length > 1 && (
          <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10">
            {renderHistory.slice(-5).map((s, i, arr) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-[9px] text-slate-500 max-w-[50px] truncate">{s.title?.split(' ')[0]}</span>
                {i < arr.length - 1 && <span className="text-slate-700 text-[8px]">›</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showInfo && activeScene && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="px-6 py-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-black text-white">{activeScene.title}</p>
                  <span className={`text-[8px] font-bold uppercase tracking-widest ${roomColor.text}`}>{activeScene.renderMode}</span>
                </div>
                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${roomColor.pill}`}>
                  {dataSource === 'anatomy_glb' ? `${anatomyAssets.length} models` : `${voxelCount.toLocaleString()} pts`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-white/60 leading-relaxed">{activeScene.description}</p>
              {activeScene.hint && (
                <div className={`mt-1 px-3 py-2 rounded-xl border ${roomColor.border} bg-white/5`}>
                  <p className="text-[10px] text-slate-300">
                    <span className={`font-bold ${roomColor.text}`}>Hint: </span>{activeScene.hint}
                  </p>
                </div>
              )}
              {annotations.length > 0 && (
                <div className="mt-2">
                  <p className={`text-[8px] uppercase tracking-widest font-bold ${roomColor.text} mb-1`}>
                    PDA Notes ({annotations.length})
                  </p>
                  <div className="flex flex-col gap-1">
                    {annotations.slice(0, 3).map(a => (
                      <div key={a.id} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: a.color }} />
                        <p className="text-[10px] text-slate-400 line-clamp-1">{a.text}</p>
                      </div>
                    ))}
                    {annotations.length > 3 && (
                      <p className="text-[9px] text-slate-600">+{annotations.length - 3} more — open PDA to view all</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-4 border-t border-white/10">
        {outOfScope && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25"
          >
            <span className="text-amber-400 text-sm shrink-0">⚠️</span>
            <div>
              <p className="text-[10px] font-bold text-amber-400 mb-0.5">Fora do escopo — {policy?.label}</p>
              <p className="text-[10px] text-amber-300/80 leading-relaxed">{outOfScope}</p>
            </div>
            <button onClick={() => setOutOfScope(null)} className="ml-auto text-amber-600 hover:text-amber-400">
              <X size={12} />
            </button>
          </motion.div>
        )}

        {aiError && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <X size={12} className="text-red-400 shrink-0" />
            <p className="text-[10px] text-red-400">{aiError}</p>
          </div>
        )}

        {imagePreview && (
          <div className="mb-3 relative w-16 h-16 rounded-lg opacity-90 hover:opacity-100 transition-opacity border border-white/20 ml-2 group overflow-hidden">
            <img src={imagePreview} alt="Upload preview" className="w-full h-full object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black group-hover:block hidden"
            >
              <X size={10} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-2xl p-2 focus-within:border-white/20 transition-colors">
          <Sparkles size={14} className={`ml-1 shrink-0 ${roomColor.text}`} />
          
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors shrink-0"
            title="Upload image for 3D generation"
          >
            <ImagePlus size={14} />
          </button>

          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptSubmit(); } }}
            placeholder="Visualize anything… 'horse skeleton', 'ATP', or upload an image ->"
            className="flex-1 bg-transparent text-xs outline-none text-slate-300 placeholder:text-slate-600 font-mono"
          />
          <button
            onClick={handlePromptSubmit}
            disabled={isLoading || (!prompt.trim() && !selectedImage)}
            className="px-3 py-1.5 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 shadow-lg"
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {isLoading ? 'Building' : 'Generate'}
          </button>
        </div>
        <p className="text-[9px] text-slate-600 mt-2 text-center tracking-wide">
          Moléculas reais via PubChem · Proteínas via RCSB PDB · Auto-salva · PDA para anotações
        </p>
      </div>
    </div>
  );
}