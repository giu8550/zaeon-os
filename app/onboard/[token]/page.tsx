"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldX, Loader2 } from 'lucide-react';
import OnboardAgent from '@/components/onboard/OnboardAgent';

interface InviteData {
  teacherName: string;
  subject: string;
  room: string;
}

export default function OnboardGatePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  useEffect(() => {
    fetch(`/api/student/join?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus('invalid'); return; }
        setInviteData(data);
        setStatus('valid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 className="w-10 h-10 text-cyan-400" />
        </motion.div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4 p-8">
        <ShieldX className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center">Link inválido</h1>
        <p className="text-slate-400 text-sm text-center max-w-sm">
          Este convite expirou ou não existe. Solicite um novo link ao seu professor.
        </p>
      </div>
    );
  }

  return <OnboardAgent token={token} inviteData={inviteData!} />;
}
