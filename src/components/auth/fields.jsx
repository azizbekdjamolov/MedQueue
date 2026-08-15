import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Shared form primitives for the MedQueue auth/profile flows:
 * labeled inputs, password visibility toggle, loading button and alerts.
 */

export function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-faint">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
      {error && (
        <span className="mt-1.5 block text-[11px] font-medium text-rose-400">{error}</span>
      )}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-fg placeholder:text-faint ' +
  'transition-colors duration-200 focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40'

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  name,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
}) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={inputClass + ' pr-12'}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-faint transition-colors hover:bg-card-hover hover:text-fg"
        >
          {visible ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M7.4 7.5C5.4 8.6 3.9 10.2 3 12c1.7 3.2 5 5.5 9 5.5 1.3 0 2.5-.3 3.6-.8M9.9 5.6A9.6 9.6 0 0 1 12 5.5c4 0 7.3 2.3 9 5.5a14.6 14.6 0 0 1-2.4 3.1M14.5 9a2 2 0 0 1 2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 12c1.7-3.2 5-5.5 9-5.5s7.3 2.3 9 5.5c-1.7 3.2-5 5.5-9 5.5s-7.3-2.3-9-5.5Z" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          )}
        </button>
      </div>
    </Field>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={className + ' animate-spin'} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function LoadingButton({ loading, disabled, children, className = '', ...rest }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={
        'inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-600 via-neon-500 to-electric-500 ' +
        'px-6 py-3 text-sm font-semibold text-white shadow-[var(--glow-soft)] transition-all duration-300 ' +
        'hover:shadow-[var(--glow-strong)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-[var(--glow-soft)] ' +
        className
      }
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Alert({ tone, children }) {
  const tones = {
    error:
      'border-rose-500/25 bg-rose-500/10 text-rose-300',
    success:
      'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={'rounded-xl border px-4 py-3 text-[12px] font-medium ' + (tones[tone] ?? tones.error)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </motion.div>
  )
}

export function AlertStack({ error, success }) {
  return (
    <AnimatePresence mode="wait">
      {error && <Alert key="error" tone="error">{error}</Alert>}
      {success && !error && <Alert key="success" tone="success">{success}</Alert>}
    </AnimatePresence>
  )
}

export function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-muted">
      <span
        className={
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ' +
          (checked
            ? 'border-neon-500 bg-neon-500 text-white'
            : 'border-border-strong bg-input text-transparent')
        }
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2.5 6.5 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
      </span>
      {label}
    </label>
  )
}
