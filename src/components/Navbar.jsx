import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Button from './ui/Button'
import UserMenu from './UserMenu'
import { LANGS, setLang, useLang, useT } from '../i18n'
import { setTheme, useTheme } from '../lib/theme'
import { useAuth } from '../lib/auth'

function Logo({ navigate, t }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        event.preventDefault()
        navigate('/')
      }}
      className="flex items-center gap-2.5"
      aria-label={t('nav.home')}
    >
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 2.5 27.5 9v14L16 29.5 4.5 23V9L16 2.5Z"
          stroke="url(#logo-gradient)"
          strokeWidth="2"
        />
        <path
          d="M16 9.5 21.5 13v6L16 22.5 10.5 19v-6L16 9.5Z"
          fill="url(#logo-gradient)"
        />
        <defs>
          <linearGradient id="logo-gradient" x1="4.5" y1="2.5" x2="27.5" y2="29.5">
            <stop stopColor="#a78bfa" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-display text-lg font-semibold tracking-wide text-fg">
        MedQueue Tashkent
      </span>
    </a>
  )
}

function ThemeToggle() {
  const theme = useTheme()
  const t = useT()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('nav.theme.light') : t('nav.theme.dark')}
      title={isDark ? t('nav.theme.light') : t('nav.theme.dark')}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-fg transition-colors duration-300 hover:bg-card-hover"
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2.2m0 14.6v2.2M2.5 12h2.2m14.6 0h2.2M5.3 5.3l1.6 1.6m10.2 10.2 1.6 1.6m0-13.4-1.6 1.6M6.9 17.1l-1.6 1.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20.4 14.5A8.2 8.2 0 0 1 9.5 3.6a8.2 8.2 0 1 0 10.9 10.9Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}

function LangSelector({ inline = false }) {
  const lang = useLang()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = LANGS.find((item) => item.code === lang) ?? LANGS[0]

  useEffect(() => {
    if (!open) return
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(code) {
    setLang(code)
    setOpen(false)
  }

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={t('nav.language')}
      aria-haspopup="listbox"
      aria-expanded={open}
      title={t('nav.language')}
      className={
        'flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-fg transition-colors duration-300 hover:bg-card-hover'
      }
    >
      <span aria-hidden="true">{current.flag}</span>
      <span className="uppercase tracking-wide">{current.code}</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        className={'transition-transform duration-200 ' + (open ? 'rotate-180' : '')}
      >
        <path
          d="M2.5 4.5 6 8l3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )

  if (inline) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {LANGS.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => choose(item.code)}
            aria-label={item.label}
            className={
              'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200 ' +
              (item.code === lang
                ? 'border border-neon-500/40 bg-neon-500/10 text-accent'
                : 'border border-border bg-card text-muted hover:bg-card-hover')
            }
          >
            <span aria-hidden="true">{item.flag}</span>
            {item.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={t('nav.language')}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="glass-strong absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl p-1.5 shadow-[var(--nav-shadow)]"
          >
            {LANGS.map((item) => (
              <li key={item.code} role="option" aria-selected={item.code === lang}>
                <button
                  type="button"
                  onClick={() => choose(item.code)}
                  className={
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ' +
                    (item.code === lang
                      ? 'bg-neon-500/15 text-accent'
                      : 'text-muted hover:bg-card-hover hover:text-fg')
                  }
                >
                  <span aria-hidden="true">{item.flag}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Navbar({ navigate, solid = false }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const t = useT()
  const { user } = useAuth()

  const NAV_LINKS = [
    { label: t('nav.search'), path: '/clinics' },
    { label: t('nav.doctors'), path: '/doctors' },
    { label: t('nav.dashboard'), path: '/cabinet' },
    { label: t('nav.ai'), path: '/ai' },
    { label: t('nav.stats'), path: '/stats' },
  ]

  function go(path) {
    navigate(path)
    setOpen(false)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = (className) =>
    NAV_LINKS.map((link) => (
      <li key={link.path}>
        <a
          href={link.path}
          onClick={(event) => {
            event.preventDefault()
            go(link.path)
          }}
          className={className}
        >
          {link.label}
        </a>
      </li>
    ))

  return (
    <header
      className={
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 ' +
        (scrolled || solid ? 'glass-strong shadow-[var(--nav-shadow)]' : '')
      }
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
        <Logo navigate={navigate} t={t} />

        <ul className="hidden items-center gap-7 lg:flex">
          {navLinks('text-sm font-medium text-muted transition-colors hover:text-fg')}
        </ul>

        <div className="hidden items-center gap-2.5 lg:flex">
          <ThemeToggle />
          <LangSelector />
          {user ? (
            <UserMenu navigate={navigate} />
          ) : (
            <Button
              href="/ai"
              size="md"
              onClick={(event) => {
                event.preventDefault()
                go('/ai')
              }}
            >
              {t('nav.getStarted')}
            </Button>
          )}
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-fg lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('nav.menu')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 6h14M3 10h14M3 14h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            className="glass-strong mx-4 mb-4 overflow-hidden rounded-2xl lg:hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex flex-col gap-1 p-4">
              <ul className="flex flex-col gap-1">
                {navLinks(
                  'block rounded-lg px-4 py-3 text-sm font-medium text-muted transition-colors hover:bg-card-hover hover:text-fg'
                )}
              </ul>

              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-1 pt-3">
                <ThemeToggle />
                <LangSelector inline />
              </div>

              <div className="px-1 pb-1">
                {user ? (
                  <div className="mt-3 w-full">
                    <UserMenu navigate={navigate} />
                  </div>
                ) : (
                  <Button
                    href="/ai"
                    className="mt-3 w-full"
                    onClick={(event) => {
                      event.preventDefault()
                      go('/ai')
                    }}
                  >
                    {t('nav.getStarted')}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}