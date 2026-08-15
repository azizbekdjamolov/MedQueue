import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import { useLang, useT } from '../i18n'
import { fetchAppointments } from '../lib/api'

function ApptRow({ a, t }) {
  const isUpcoming = a.status === 'upcoming' || a.status === 'queue'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-fg">
          {a.doctor || '—'} {a.specialty ? `· ${a.specialty}` : ''}
        </p>
        <p className="truncate text-[11px] text-muted">
          {a.clinic || ''}
          {a.district ? ` · ${a.district}` : ''}
        </p>
      </div>
      <span
        className={
          'shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ' +
          (isUpcoming
            ? 'border-neon-500/30 bg-neon-500/10 text-accent'
            : 'border-border bg-input text-muted')
        }
      >
        {a.date === 'today' ? t('dashboard.appointments.today') : a.date === 'tomorrow' ? t('dashboard.appointments.tomorrow') : a.date || '—'}{' '}
        {a.time && a.time !== 'now' ? a.time : ''}
        {a.status === 'queue' ? ` · ${t('dashboard.appointments.queue')}` : ''}
      </span>
    </motion.div>
  )
}

export default function AppointmentsPage({ navigate }) {
  const t = useT()
  const lang = useLang()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    fetchAppointments(lang)
      .then((res) => {
        if (!cancelled) setData(res.appointments ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  const upcoming = (data ?? []).filter((a) => a.status === 'upcoming' || a.status === 'queue')
  const previous = (data ?? []).filter((a) => a.status !== 'upcoming' && a.status !== 'queue')

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow={t('auth.menu.myAppointments')}
          title={t('dashboard.appointments.title')}
          subtitle={t('dashboard.subtitle')}
        />

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
            {t('ai.errors.network')}
          </p>
        )}

        {!data && !error && (
          <div className="mt-10 grid gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="glass h-16 animate-pulse rounded-xl" />
            ))}
          </div>
        )}

        {data && (
          <div className="mt-10 flex flex-col gap-8">
            <section>
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-fg">
                {t('dashboard.appointments.title')}
              </h2>
              <div className="mt-3 flex flex-col gap-2.5">
                {upcoming.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-[13px] text-muted">{t('dashboard.appointments.empty')}</p>
                    <button
                      type="button"
                      onClick={() => navigate('/doctors')}
                      className="mt-3 rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-5 py-2 text-[12px] font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.55)]"
                    >
                      {t('dashboard.actions.findClinic')}
                    </button>
                  </div>
                ) : (
                  upcoming.map((a) => <ApptRow key={a.id} a={a} t={t} />)
                )}
              </div>
            </section>

            <section>
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-fg">
                {t('cabinet.previous')}
              </h2>
              <div className="mt-3 flex flex-col gap-2.5">
                {previous.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-[13px] text-muted">{t('cabinet.previous')}: —</p>
                  </div>
                ) : (
                  previous.map((a) => <ApptRow key={a.id} a={a} t={t} />)
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
