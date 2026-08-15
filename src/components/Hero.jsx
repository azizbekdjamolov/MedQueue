import { Suspense, lazy, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from './ui/Button'
import { useLang, useT } from '../i18n'
import { fetchStats } from '../lib/api'

const HeroScene = lazy(() => import('../three/HeroScene'))

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
}

const item = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
}

const FALLBACK_STATS = { clinics: 25, doctors: 120, servedToday: 240, appointments: 12 }

function QuickAction({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-4 py-2 text-[12px] font-semibold text-muted backdrop-blur-sm transition-colors hover:border-neon-500/40 hover:bg-card-hover hover:text-fg"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </button>
  )
}

export default function Hero({ navigate }) {
  const t = useT()
  const lang = useLang()
  const [live, setLive] = useState(FALLBACK_STATS)

  useEffect(() => {
    let cancelled = false
    fetchStats(lang)
      .then((data) => {
        if (cancelled) return
        const cityStats = data.dashboard?.cityStats ?? {}
        setLive({
          clinics: data.clinics.length || FALLBACK_STATS.clinics,
          doctors: data.doctors.length || FALLBACK_STATS.doctors,
          servedToday: cityStats.servedToday ?? FALLBACK_STATS.servedToday,
          appointments: (data.dashboard?.appointments ?? []).filter((a) => a.date === 'today')
            .length || FALLBACK_STATS.appointments,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [lang])

  const HERO_STATS = [
    { value: String(live.clinics), key: 'hero.stats.clinics', icon: 'grid', tint: 'neon' },
    { value: String(live.doctors), key: 'hero.stats.doctors', icon: 'users', tint: 'electric' },
    { value: String(live.servedToday), key: 'hero.stats.patients', icon: 'activity', tint: 'neon' },
    { value: String(live.appointments), key: 'hero.stats.appointments', icon: 'bolt', tint: 'electric' },
  ]

  const tints = {
  neon: {
    text: 'text-neon-400',
    border: 'border-neon-500/25',
    bg: 'bg-neon-500/10',
  },
  electric: {
    text: 'text-electric-400',
    border: 'border-electric-500/25',
    bg: 'bg-electric-500/10',
  },
}

function StatIcon({ name }) {
  const common = {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true',
  }

  switch (name) {
    case 'users':
      return (
        <svg {...common}>
          <path
            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'activity':
      return (
        <svg {...common}>
          <path
            d="M22 12h-4l-3 9L9 3l-3 9H2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path
            d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

  return (
    <section id="home" className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
        <div className="absolute right-[-8%] top-[10%] h-[520px] w-[520px] rounded-full bg-[var(--blob-c)] blur-[150px]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--bg)] to-transparent" />
      </div>

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-8 pt-[18vh] sm:px-8 lg:pt-32"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <motion.div variants={item}>
              <span className="inline-flex items-center gap-2 rounded-full border border-electric-400/30 bg-electric-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric-400 shadow-[0_0_8px_#38bdf8]" />
                {t('hero.badge')}
              </span>
            </motion.div>

            <motion.h1
              variants={item}
              className="mt-6 font-display text-4xl font-semibold leading-[1.08] text-fg sm:text-6xl lg:text-6xl xl:text-7xl"
            >
              {t('hero.titleStart')}
              <br />
              <span className="text-gradient">{t('hero.titleEnd')}</span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg"
            >
              {t('hero.description')}
            </motion.p>

            <motion.div variants={item} className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                href="/clinics"
                size="lg"
                onClick={(event) => {
                  event.preventDefault()
                  navigate('/clinics')
                }}
              >
                {t('hero.actions.clinics')}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3 8h10m0 0-4-4m4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
              <Button
                href="/doctors"
                variant="ghost"
                size="lg"
                onClick={(event) => {
                  event.preventDefault()
                  navigate('/doctors')
                }}
              >
                {t('hero.actions.doctors')}
              </Button>
            </motion.div>

            <motion.div variants={item} className="mt-4 flex flex-wrap gap-2.5">
              <QuickAction onClick={() => navigate('/queue')}>{t('hero.actions.queue')}</QuickAction>
              <QuickAction onClick={() => navigate('/laboratory')}>
                {t('hero.actions.laboratory')}
              </QuickAction>
              <QuickAction onClick={() => navigate('/ai')}>{t('hero.actions.ai')}</QuickAction>
            </motion.div>
          </div>

          <div className="hidden lg:block" aria-hidden="true" />
        </div>

        <motion.a
          href="#features"
          aria-label={t('hero.scrollAria')}
          variants={item}
          className="mx-auto mt-14 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.25em] text-faint transition-colors hover:text-muted"
        >
          {t('hero.scroll')}
          <motion.svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <path
              d="M12 4v16m0 0-6-6m6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </motion.a>

        <motion.div
          variants={item}
          className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {HERO_STATS.map((stat) => (
            <div
              key={stat.key}
              className="glass-solid flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-300 hover:border-border-strong hover:shadow-[var(--glow-soft)]"
            >
              <span
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ' +
                  tints[stat.tint].border +
                  ' ' +
                  tints[stat.tint].bg +
                  ' ' +
                  tints[stat.tint].text
                }
              >
                <StatIcon name={stat.icon} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-semibold tracking-tight text-fg">
                  {stat.value}
                </p>
                <p className="truncate text-xs text-muted sm:text-sm">{t(stat.key)}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}