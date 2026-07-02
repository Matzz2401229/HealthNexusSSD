export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-outline-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }[variant] || 'btn-primary';

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  return (
    <button className={`btn ${variantClass} ${sizeClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
