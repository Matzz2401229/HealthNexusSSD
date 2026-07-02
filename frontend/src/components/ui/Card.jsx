export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card shadow-sm border-0 ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <div className="card-header bg-white border-0 d-flex justify-content-between align-items-start">
          <div>
            {title ? <h5 className="mb-1">{title}</h5> : null}
            {subtitle ? <p className="text-muted mb-0">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
