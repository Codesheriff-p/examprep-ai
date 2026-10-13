/** Circular score gauge; the number inside is the label, so colour is never the only cue. */
export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const stroke = size / 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "var(--good)" : score >= 0.5 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${pct}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score)}
        />
      </svg>
      <span className="absolute inset-0 tabular-nums flex items-center justify-center font-semibold" style={{ fontSize: size / 4.2 }}>
        {pct}%
      </span>
    </div>
  );
}
