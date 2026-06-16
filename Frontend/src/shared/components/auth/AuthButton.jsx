import { Loader2 } from 'lucide-react';

export default function AuthButton({
  type = 'button',
  children,
  loading = false,
  disabled = false,
  icon: Icon,
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="auth-btn"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <span>{children}</span>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </>
      )}
    </button>
  );
}
