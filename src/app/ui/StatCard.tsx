interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  toneClassName?: string;
  badge?: string;
}

export function StatCard({ label, value, detail, toneClassName = "", badge }: StatCardProps) {
  return (
    <article className={`stat-card ${toneClassName}`.trim()}>
      <span className="metric-label">{label}</span>
      <div className="metric-row">
        <strong className="metric-value">{value}</strong>
        {badge && <span className={`status-pill ${toneClassName}`.trim()}>{badge}</span>}
      </div>
      <small className="metric-detail">{detail}</small>
    </article>
  );
}
