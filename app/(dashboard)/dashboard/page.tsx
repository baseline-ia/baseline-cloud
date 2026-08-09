export default function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <p className="subtitle">Time and projects across the team</p>
      </div>
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--cl-radius)',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Overview — coming soon
        </p>
        <p style={{ fontSize: '0.9375rem' }}>
          Dashboard charts and metrics will be built in Phase 2.
        </p>
      </div>
    </div>
  );
}
