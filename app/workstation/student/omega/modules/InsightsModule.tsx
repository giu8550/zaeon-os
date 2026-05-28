"use client";
export default function InsightsModule({ insights }: { insights: any }) {
  if (!insights) return null;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-700 dark:text-white/80">{insights.summary}</p>
      {!!insights.trends?.length && (
        <div><p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">Tendências</p>
          <ul className="list-disc pl-5 text-slate-600 dark:text-white/60 text-xs space-y-1">{insights.trends.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
      )}
      {!!insights.contradictions?.length && (
        <div><p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Contradições</p>
          <ul className="list-disc pl-5 text-slate-600 dark:text-white/60 text-xs space-y-1">{insights.contradictions.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
      )}
    </div>
  );
}
