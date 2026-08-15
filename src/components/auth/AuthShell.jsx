import { motion } from 'framer-motion'

/** MedQueue logo mark — same geometry as the navbar logo. */
export function LogoMark({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2.5 27.5 9v14L16 29.5 4.5 23V9L16 2.5Z"
        stroke="url(#auth-logo-gradient)"
        strokeWidth="2"
      />
      <path
        d="M16 9.5 21.5 13v6L16 22.5 10.5 19v-6L16 9.5Z"
        fill="url(#auth-logo-gradient)"
      />
      <defs>
        <linearGradient id="auth-logo-gradient" x1="4.5" y1="2.5" x2="27.5" y2="29.5">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/**
 * Full-height centered auth layout used by Login/Register/Profile flows.
 * Dark-futuristic MedQueue styling with glass card and ambient glow.
 */
export default function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-4 py-10 sm:px-8">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] max-w-full -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'var(--blob-a)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-48 right-0 h-96 w-[36rem] max-w-full rounded-full blur-3xl"
        style={{ background: 'var(--blob-b)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-0 top-1/3 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--blob-c)' }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6"
      >
        <div className="flex flex-col items-center text-center">
          <LogoMark />
          <span className="mt-3 font-display text-xl font-semibold tracking-wide text-fg">
            MedQueue Tashkent
          </span>
        </div>

        <div className="glass-strong mt-8 overflow-hidden rounded-3xl p-6 shadow-[var(--nav-shadow)] sm:p-8">
          {eyebrow && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              {eyebrow}
            </span>
          )}
          <h1 className="mt-2 font-display text-2xl font-semibold text-fg">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && (
          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        )}
      </motion.div>
    </div>
  )
}
