/** O ícone do Octa Code: um octógono (octa = 8) com os colchetes de código dentro. Herda a cor (currentColor). */
export default function OctaIcon({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="octa-g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M8.1 2h7.8L22 8.1v7.8L15.9 22H8.1L2 15.9V8.1z" fill="url(#octa-g)" fillOpacity=".18" stroke="url(#octa-g)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 9 6.8 12l2.7 3M14.5 9l2.7 3-2.7 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
