interface AuthGateProps {
  allowDemo: boolean;
  onDemo(): void;
  onGoogle(): void;
  error: string;
  authenticating: boolean;
}

export function AuthGate({
  allowDemo,
  onDemo,
  onGoogle,
  error,
  authenticating
}: AuthGateProps) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">LB</div>
        <p className="eyebrow">Osobný tréningový dashboard</p>
        <h1>Lean Bulk Tracker</h1>
        <p>Zapisuj dáta, sleduj výkon a kalórie meň až po bezpečnom 14-dňovom vyhodnotení.</p>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={authenticating} onClick={onGoogle}>
          {authenticating ? "Prihlasujem…" : "Pokračovať cez Google"}
        </button>
        {allowDemo && <button className="secondary" onClick={onDemo}>Lokálny demo režim</button>}
      </section>
    </main>
  );
}

