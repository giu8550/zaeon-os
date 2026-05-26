"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import UniversityModal from './UniversityModal';
import WelcomeScreen from './WelcomeScreen';
import type { BrazilianUniversity } from '@/constants/universities';

interface Message { role: 'agent' | 'user'; text: string; }

type Phase = 'name' | 'age' | 'gender' | 'city' | 'university';

export interface CollectedData {
  name: string;
  age: string;
  gender: 'male' | 'female' | 'other';
  city: string;
  university: BrazilianUniversity | null;
}

const GENDER_OPTIONS = [
  { label: 'Masculino', value: 'male' as const },
  { label: 'Feminino', value: 'female' as const },
  { label: 'Outro', value: 'other' as const },
];

export default function OnboardAgent({ token, inviteData }: { token: string; inviteData: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>('name');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showUniversity, setShowUniversity] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [data, setData] = useState<CollectedData>({
    name: '', age: '', gender: 'other', city: '', university: null,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const addAgentMessages = (lines: string[], onDone?: () => void) => {
    setIsTyping(true);
    lines.forEach((line, i) => {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'agent', text: line }]);
        if (i === lines.length - 1) {
          setIsTyping(false);
          onDone?.();
        }
      }, i * 700);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      addAgentMessages([
        'Olá! Fico feliz que você chegou até aqui 😊',
        'Antes de liberar seu acesso, quero conhecer você um pouco. Pode ser rápido, prometo!',
        'Qual é o seu nome?',
      ]);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    const val = input.trim();
    if (!val || isTyping) return;
    setMessages(prev => [...prev, { role: 'user', text: val }]);
    setInput('');

    if (phase === 'name') {
      const newData = { ...data, name: val };
      setData(newData);
      setPhase('age');
      setTimeout(() => addAgentMessages([`Que nome bonito, ${val}! 😄`, 'Quantos anos você tem?']), 300);
    } else if (phase === 'age') {
      const newData = { ...data, age: val };
      setData(newData);
      setPhase('gender');
      setTimeout(() => addAgentMessages(['Legal! Como prefere ser chamado(a)?']), 300);
    } else if (phase === 'gender') {
      const g = val.toLowerCase();
      const gender: 'male' | 'female' | 'other' =
        g.includes('masc') || g === 'm' ? 'male' :
        g.includes('fem') || g === 'f' ? 'female' : 'other';
      const newData = { ...data, gender };
      setData(newData);
      setPhase('city');
      setTimeout(() => addAgentMessages(['Onde você mora? Cidade e estado são suficientes.']), 300);
    } else if (phase === 'city') {
      const newData = { ...data, city: val };
      setData(newData);
      setPhase('university');
      setTimeout(() => {
        addAgentMessages(
          ['Perfeito! Última coisa antes de entrar...', 'Em qual universidade você estuda? Clique na sua abaixo 👇'],
          () => setTimeout(() => setShowUniversity(true), 400),
        );
      }, 300);
    }
  };

  const handleUniversitySelect = (university: BrazilianUniversity) => {
    setData(prev => ({ ...prev, university }));
    setShowUniversity(false);
    setTimeout(() => setShowWelcome(true), 1600);
  };

  if (showWelcome && data.university) {
    return (
      <WelcomeScreen
        token={token}
        collectedData={{ ...data, university: data.university }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-4">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-lg flex flex-col gap-4 relative z-10">
        {/* Agent header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <span className="text-white font-black text-xs">Z</span>
          </div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Zaeon</p>
            <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest">Agente de Acesso</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-3 min-h-[300px]">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                  msg.role === 'agent'
                    ? 'bg-white/8 border border-white/10 text-white rounded-tl-sm'
                    : 'bg-cyan-600 text-white rounded-tr-sm'
                }`}>
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-cyan-400 rounded-full"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Gender quick-select */}
        {phase === 'gender' && !isTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setInput(opt.label)}
                className={`px-4 py-2 rounded-xl border text-sm transition-all ${
                  input === opt.label
                    ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                    : 'border-white/10 text-white/70 hover:border-white/20 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Input */}
        {phase !== 'university' && (
          <div className="flex gap-2 mt-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={
                phase === 'age' ? 'Ex: 22' :
                phase === 'city' ? 'Ex: Fortaleza, CE' :
                phase === 'gender' ? 'Masculino / Feminino / Outro' :
                'Digite aqui...'
              }
              disabled={isTyping}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="p-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 rounded-2xl transition-all"
            >
              <PaperAirplaneIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* University modal */}
      <AnimatePresence>
        {showUniversity && (
          <UniversityModal
            onSelect={handleUniversitySelect}
            onClose={() => setShowUniversity(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
