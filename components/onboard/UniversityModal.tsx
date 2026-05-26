"use client";

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BRAZILIAN_FEDERAL_UNIVERSITIES, type BrazilianUniversity } from '@/constants/universities';

interface Props {
  onSelect: (university: BrazilianUniversity) => void;
  onClose: () => void;
}

export default function UniversityModal({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BrazilianUniversity | null>(null);
  const [showLogoFlash, setShowLogoFlash] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return BRAZILIAN_FEDERAL_UNIVERSITIES;
    const q = query.toLowerCase();
    return BRAZILIAN_FEDERAL_UNIVERSITIES.filter(u =>
      u.acronym.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.state.toLowerCase().includes(q) ||
      u.city.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (university: BrazilianUniversity) => {
    setSelected(university);
    setShowLogoFlash(true);
    setTimeout(() => {
      setShowLogoFlash(false);
      onSelect(university);
    }, 1500);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Selecione sua universidade"
      >
        <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-6 gap-4">
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-white font-black text-xl uppercase tracking-widest">Sua universidade</h2>
              <p className="text-slate-400 text-xs mt-0.5">Selecione a instituição onde você estuda</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative shrink-0">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por sigla, nome, cidade ou estado..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40 transition-all"
            />
          </div>

          {/* Partner fast-track banner */}
          {!query && (
            <div className="shrink-0 flex gap-3 items-center">
              <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest whitespace-nowrap">
                Parceiros Zaeon
              </span>
              <div className="flex gap-2">
                {BRAZILIAN_FEDERAL_UNIVERSITIES.filter(u => u.isPartner).map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleSelect(u)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-all"
                  >
                    {u.acronym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* University grid */}
          <div
            className="flex-1 overflow-y-auto pr-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
              {filtered.map(university => {
                const isSelected = selected?.id === university.id;
                return (
                  <button
                    key={university.id}
                    onClick={() => handleSelect(university)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 text-center ${
                      isSelected
                        ? 'ring-2 ring-cyan-400 scale-105 border-cyan-400/60 bg-cyan-900/10 shadow-[0_0_20px_rgba(34,211,238,0.4),0_0_40px_rgba(34,211,238,0.2)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                    }`}
                  >
                    {university.isPartner && (
                      <span className="absolute top-2 right-2 text-[8px] font-black text-cyan-400 uppercase bg-cyan-500/10 px-1.5 py-0.5 rounded-full border border-cyan-500/20">
                        Parceiro
                      </span>
                    )}
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl overflow-hidden bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={university.logoPath}
                        alt={university.acronym}
                        className="w-full h-full object-contain"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).src =
                            `https://ui-avatars.com/api/?name=${university.acronym}&background=${university.color.replace('#', '')}&color=fff&size=80`;
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-white font-black text-xs uppercase tracking-wider">{university.acronym}</p>
                      <p className="text-slate-500 text-[9px] font-bold uppercase">{university.state}</p>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                  Nenhuma universidade encontrada para &ldquo;{query}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Logo flash overlay */}
      <AnimatePresence>
        {showLogoFlash && selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-6"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                src={selected.logoPath}
                alt={selected.name}
                className="w-40 h-40 object-contain"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src =
                    `https://ui-avatars.com/api/?name=${selected.acronym}&background=${selected.color.replace('#', '')}&color=fff&size=160`;
                }}
                animate={{
                  filter: [
                    `drop-shadow(0 0 20px ${selected.color}40)`,
                    `drop-shadow(0 0 60px ${selected.color}90)`,
                    `drop-shadow(0 0 20px ${selected.color}40)`,
                  ],
                }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <div className="text-center">
                <p className="text-white font-black text-2xl uppercase tracking-widest">{selected.acronym}</p>
                <p className="text-slate-400 text-sm mt-1">{selected.city}, {selected.state}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
