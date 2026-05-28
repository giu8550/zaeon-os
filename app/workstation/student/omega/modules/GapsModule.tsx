"use client";
export default function GapsModule({ gaps }: { gaps: any }) {
  if (!gaps) return null;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-700 dark:text-white/80">{gaps.description}</p>
      {!!gaps.rqCards?.length && (
        <div className="space-y-2">
          {gaps.rqCards.map((c: string, i: number) => (
            <div key={i} className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 text-xs text-slate-700 dark:text-white/70">◎ {c}</div>
          ))}
        </div>
      )}
    </div>
  );
}
