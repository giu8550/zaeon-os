"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StarIcon } from '@heroicons/react/24/solid';

const TESTIMONIALS = [
  { name: 'Ana Beatriz', university: 'UFC', course: 'Ciência da Computação', text: 'A Zaeon transformou como eu faço pesquisa. Terminei meu TCC em metade do tempo.' },
  { name: 'Carlos Eduardo', university: 'UFMG', course: 'Engenharia de Software', text: 'O modo foco é incrível. Consigo estudar por horas sem me distrair.' },
  { name: 'Larissa Mendes', university: 'UFRJ', course: 'Medicina', text: 'A organização de artigos científicos ficou muito mais simples. Recomendo demais!' },
  { name: 'Pedro Alves', university: 'UnB', course: 'Direito', text: 'As normas ABNT integradas salvaram minha vida. Não erro mais formatação.' },
  { name: 'Marina Costa', university: 'UFPE', course: 'Psicologia', text: 'O agente de pesquisa encontra fontes que eu nunca acharia sozinha. Fantástico.' },
  { name: 'Thiago Santos', university: 'UFRGS', course: 'Física', text: 'A sala colaborativa com meu orientador ficou fácil demais. Aprovado com louvor!' },
  { name: 'Juliana Ferreira', university: 'UFBA', course: 'Biologia', text: 'O layout personalizável é demais. Cada um usa do seu jeito e funciona!' },
  { name: 'Rafael Oliveira', university: 'UFSC', course: 'Arquitetura', text: 'Nunca imaginei uma plataforma de estudos tão elegante e funcional ao mesmo tempo.' },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(id);
  }, []);

  const t = TESTIMONIALS[current];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Histórias reais de +10.000 estudantes 🚀
      </p>
      <div className="relative h-40 overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=0ea5e9&color=fff&size=48`}
                alt={t.name}
                className="w-10 h-10 rounded-full border-2 border-cyan-400/30 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-black text-sm text-black dark:text-white truncate">{t.name}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{t.university} · {t.course}</p>
              </div>
              <div className="ml-auto flex gap-0.5 shrink-0">
                {[...Array(5)].map((_, i) => <StarIcon key={i} className="w-3 h-3 text-yellow-400" />)}
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
              &ldquo;{t.text}&rdquo;
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all ${
              i === current
                ? 'w-4 h-1.5 bg-cyan-400'
                : 'w-1.5 h-1.5 bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/30'
            }`}
            aria-label={`Depoimento ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
