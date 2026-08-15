import { useEffect, useRef, useState } from 'react'
import { animate, useInView } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import { useT } from '../i18n'
import { API_BASE } from '../lib/api'

const FALLBACK = [
  { value: 25, decimals: 0, suffix: '+', labelKey: 'stats.labels.clinics' },
  { value: 120, decimals: 0, suffix: '+', labelKey: 'stats.labels.doctors' },
  { value: 32, decimals: 0, suffix: '', labelKey: 'stats.labels.queues' },
  { value: 96, decimals: 0, suffix: '', labelKey: 'stats.labels.servedToday' },
]

/**
 * Pull live MedQueue numbers from the backend (clinic count, doctor count,
 * current city-wide queue load). Falls back to static values offline.
 */
function useLiveStats() {
  const [stats, setStats] = useState(FALLBACK)

  useEffect(() => {
    let cancelled = false
    let timer
    const load = async () => {
      try {
        const controller = new AbortController()
        timer = setTimeout(() => controller.abort(), 6000)
        const [clinicsRes, doctorsRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/api/clinics`, { signal: controller.signal }),
          fetch(`${API_BASE}/api/doctors`, { signal: controller.signal }),
          fetch(`${API_BASE}/api/stats`, { signal: controller.signal }),
        ])
        clearTimeout(timer)
        const [clinics, doctors, stats] = await Promise.all([
          clinicsRes.json(),
          doctorsRes.json(),
          statsRes.json(),
        ])
        if (cancelled) return
        const city = stats.cityStats ?? { total: 0, servedToday: 0 }
        setStats([
          { value: clinics.clinics?.length ?? FALLBACK[0].value, decimals: 0, suffix: '+', labelKey: 'stats.labels.clinics' },
          { value: doctors.doctors?.length ?? FALLBACK[1].value, decimals: 0, suffix: '+', labelKey: 'stats.labels.doctors' },
          { value: city.total ?? FALLBACK[2].value, decimals: 0, suffix: '', labelKey: 'stats.labels.queues' },
          { value: city.servedToday ?? FALLBACK[3].value, decimals: 0, suffix: '', labelKey: 'stats.labels.servedToday' },
        ])
      } catch {
        if (timer) clearTimeout(timer)
        if (!cancelled) setStats(FALLBACK)
      }
    }
    load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return stats
}

function StatItem({ value, decimals, suffix, label }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, value, {
      duration: 2,
      ease: 'easeOut',
      onUpdate: (latest) =>
        setDisplay(
          Math.round(latest).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        ),
    })
    return () => controls.stop()
  }, [inView, value, decimals])

  return (
    <div ref={ref} className="flex flex-col items-center gap-2 py-6 text-center sm:py-0">
      <span className="font-display text-4xl font-semibold text-fg sm:text-5xl">
        {display}
        <span className="text-gradient">{suffix}</span>
      </span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  )
}

export default function Stats() {
  const t = useT()
  const stats = useLiveStats()

  return (
    <section id="stats" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t('stats.eyebrow')}
          title={
            <>
              {t('stats.titleStart')} <span className="text-gradient">{t('stats.titleEnd')}</span>
            </>
          }
          subtitle={t('stats.subtitle')}
        />

        <div className="glass mt-16 grid grid-cols-2 gap-8 rounded-3xl px-6 py-10 sm:px-12 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatItem
              key={stat.labelKey}
              value={stat.value}
              decimals={stat.decimals}
              suffix={stat.suffix}
              label={t(stat.labelKey)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}