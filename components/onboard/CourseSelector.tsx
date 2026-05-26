"use client";

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ALL_COURSES } from '@/constants/courses';

interface Props {
  onSelect: (course: string) => void;
  selected: string;
}

export default function CourseSelector({ onSelect, selected }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return ALL_COURSES;
    return ALL_COURSES.filter(c => c.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      <div className="relative shrink-0">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar seu curso..."
          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-black dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50 transition-all"
        />
      </div>
      <div
        className="flex-1 overflow-y-auto flex flex-wrap gap-2 content-start"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
      >
        {filtered.map(course => (
          <motion.button
            key={course}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(course)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selected === course
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-500/20'
                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-200 dark:hover:bg-white/8'
            }`}
          >
            {course}
          </motion.button>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-400 text-sm py-4 w-full text-center">Nenhum curso encontrado.</p>
        )}
      </div>
    </div>
  );
}
