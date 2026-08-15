import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import { useLang, useT } from '../i18n'
import { fetchStats } from '../lib/api'

const MAX = (arr) => Math.max(1, ...arr)

/** Vertical bar chart (pure SVG). */
function BarChart({ data, color = 'url(#barGrad)', height = 180 }) {
  if (!data || data.length === 0) return null
  const max = MAX(data.map((d) => d.value))
  const width = 640
  const pad = 8
  const slot = (width - pad * 2) / data.length
  const barWidth = Math.min(28, slot * 0.55)

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 34}`}
      className="w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={pad}
          x2={width - pad}
          y1={height - height * frac}
          y2={height - height * frac}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="1"
        />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * height
        const x = pad + i * slot + (slot - barWidth) / 2
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={barWidth} height={h} rx="4" fill={color} />
            <text
              x={x + barWidth / 2}
              y={height - h - 6}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="currentColor"
              opacity="0.75"
            >
              {d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={height + 20}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              opacity="0.55"
            >
              {d.label.length > 10 ? `${d.label.slice(0, 10)}…` : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Ranked horizontal bars (pure SVG). */
function HBarList({ items }) {
  if (!items || items.length === 0) return null
  const max = MAX(items.map((i) => i.value))
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={item.id ?? index}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate font-medium text-fg">{item.label}</span>
            <span className="shrink-0 font-semibold text-accent">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-border bg-input">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-500 to-electric-500"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, tint }) {
  const tints = {
    neon: 'border-neon-500/25 bg-neon-500/10 text-accent',
    electric: 'border-electric-500/25 bg-electric-500/10 text-electric-300',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    rose: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  }
  return (
    <div className="glass flex items-center gap-4 rounded-2xl px-5 py-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tints[tint]}`}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 18 10 12l4 4 6-8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-semibold tracking-tight text-fg">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass rounded-2xl p-5 sm:p-6"
    >
      <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-fg">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  )
}

export default function StatsPage() {
  const t = useT()
  const lang = useLang()

  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchStats(lang)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  const clinics = data?.clinics ?? []
  const doctors = data?.doctors ?? []
  const cityStats = data?.dashboard?.cityStats ?? { total: 0, servedToday: 0 }

  const clinicsByDistrict = []
  for (const clinic of clinics) {
    const existing = clinicsByDistrict.find((d) => d.label === clinic.district)
    if (existing) existing.value += 1
    else clinicsByDistrict.push({ id: clinic.id, label: clinic.district, value: 1 })
  }
  clinicsByDistrict.sort((a, b) => b.value - a.value)

  const clinicLoad = new Map()
  for (const doctor of doctors) {
    const key = doctor.clinic
    clinicLoad.set(key, (clinicLoad.get(key) ?? 0) + (doctor.queueAhead ?? 0))
  }
  const busyClinics = [...clinicLoad.entries()]
    .map(([label, value]) => ({ id: label, label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const shortestQueues = [...doctors]
    .map((d) => ({ id: d.id, label: `${d.name} — ${d.specialty}`, value: d.avgWaitMin ?? 0 }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 5)

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow={t('statsPage.eyebrow')}
            title={t('statsPage.title')}
            subtitle={t('statsPage.subtitle')}
          />
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t('statsPage.live')}
          </span>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
            {t('ai.errors.network')}
          </p>
        )}

        {!data && !error && (
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="glass h-32 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {data && (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label={t('stats.labels.clinics')} value={clinics.length} tint="neon" />
              <Kpi label={t('stats.labels.doctors')} value={doctors.length} tint="electric" />
              <Kpi label={t('stats.labels.queues')} value={cityStats.total} tint="emerald" />
              <Kpi label={t('stats.labels.servedToday')} value={cityStats.servedToday} tint="rose" />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <Section title={t('statsPage.busyClinics')}>
                <HBarList items={busyClinics} />
              </Section>
              <Section title={t('statsPage.doctorsShortest')}>
                <HBarList items={shortestQueues} />
              </Section>
            </div>

            <div className="mt-6">
              <Section title={t('statsPage.clinicsByDistrict')}>
                <BarChart data={clinicsByDistrict} />
                <p className="mt-3 text-[10px] text-faint">
                  {t('statsPage.title')} · {t('statsPage.live')}
                </p>
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
