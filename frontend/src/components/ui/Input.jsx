export function Input({ label, id, className = '', ...props }) {
  return (
    <div className={`form-group ${className}`.trim()}>
      {label ? (
        <label htmlFor={id} className="form-label text-muted">
          {label}
        </label>
      ) : null}
      <input id={id} className="form-control" {...props} />
    </div>
  );
}
