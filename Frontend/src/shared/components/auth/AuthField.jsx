export default function AuthField({
  id,
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  required = false,
  autoFocus = false,
  icon: Icon,
  suffix,
  prefix,
  inputClassName = '',
  maxLength,
  inputMode,
  labelExtra,
}) {
  const inputPadding = [
    !Icon && !prefix ? 'auth-field__input--no-icon' : '',
    prefix ? 'auth-field__input--no-icon' : '',
    suffix ? 'auth-field__input--suffix' : '',
    inputClassName,
  ].filter(Boolean).join(' ');

  return (
    <div className="space-y-2">
      {label || labelExtra ? (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <label htmlFor={id} className="auth-label mb-0">
              {label}
            </label>
          ) : <span />}
          {labelExtra}
        </div>
      ) : null}
      <div className="auth-field">
        {prefix ? <div className="auth-field__prefix">{prefix}</div> : null}
        {Icon ? <Icon className="auth-field__icon" /> : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          maxLength={maxLength}
          inputMode={inputMode}
          className={`auth-field__input ${inputPadding}`}
        />
        {suffix}
      </div>
    </div>
  );
}
