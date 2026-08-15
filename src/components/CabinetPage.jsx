import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import DashboardPage from './DashboardPage'
import { useLang, useT } from '../i18n'
import { fetchAppointments, fetchPatient } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function CabinetPage({ navigate }) {
  const t = useT()
  const lang = useLang()
  const { user } = useAuth()

  const [patient, setPatient] = useState(null)
  const [error, setError] = useState(false)
  const [previous, setPrevious] = useState([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchPatient(lang)
      .then((data) => {
        if (!cancelled) setPatient(data.patient ?? null)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    fetchAppointments(lang)
      .then((data) => {
        if (!cancelled) {
          setPrevious((data.appointments ?? []).filter((a) => a.status !== 'upcoming' && a.status !== 'queue'))
        }
      })
      .catch(() => {
        // Non-critical — empty state covers it.
      })
    return () => {
      cancelled = true
    }
  }, [lang, user])

  /* Defensive gate — the router normally redirects guests to /login. */
  if (!user) {
    return (
      <div className="relative px-4 pb-20 pt-24 sm:px-8">
        <div className="mx-auto max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="glass rounded-3xl p-8 text-center"
          >
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-500 to-electric-500 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="mt-5 font-display text-xl font-semibold text-fg">
              {t('cabinet.signInTitle')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('cabinet.signInHint')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.55)]"
              >
                {t('cabinet.login')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg"
              >
                {t('cabinet.register')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  const firstName = user.full_name.split(' ')[0]
  const avatar = user.avatar

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="glass rounded-2xl p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-4">
            {avatar ? (
              <img
                src={avatar}
                alt={user.full_name}
                className="h-14 w-14 shrink-0 rounded-2xl border border-border object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-500 to-electric-500 font-display text-xl font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.45)]">
                {user.full_name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">
                {t('cabinetPage.profile')}
              </p>
              <h1 className="mt-0.5 truncate font-display text-2xl font-semibold text-fg">
                {firstName ? t('dashboard.title').replace(/\{name\}/, firstName) : user.full_name}
              </h1>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
              <ProfileStat label={t('cabinetPage.phone')} value={user.phone ?? '—'} />
              <ProfileStat label={t('profile.email')} value={user.email ?? '—'} />
              <ProfileStat
                label={t('profile.dateOfBirth')}
                value={user.date_of_birth ?? '—'}
              />
              <ProfileStat
                label={t('profile.gender')}
                value={
                  user.gender === 'male'
                    ? t('auth.male')
                    : user.gender === 'female'
                      ? t('auth.female')
                      : user.gender === 'other'
                        ? t('auth.other')
                        : '—'
                }
              />
            </div>
          </div>
          {patient?.primaryClinic && (
            <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted">
              {t('cabinetPage.clinic')}: <span className="text-fg">{patient.primaryClinic}</span>
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
              {t('ai.errors.network')}
            </p>
          )}
        </motion.section>

        <div className="mt-6">
          <DashboardPage navigate={navigate} />
        </div>

        {previous.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="glass mt-5 rounded-2xl p-5 sm:p-6"
          >
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-fg">
              {t('cabinet.previous')}
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {previous.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">
                      {a.doctor} — {a.specialty}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {a.clinic} · {a.district}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-border bg-input px-2.5 py-1 text-[11px] font-semibold text-muted">
                    {a.date}
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="glass mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 sm:p-6"
        >
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-fg">
              {t('cabinet.doctorsTitle')}
            </h2>
            <p className="mt-1 text-[12px] text-muted">{t('cabinet.doctorsHint')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/doctors')}
            className="rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.55)]"
          >
            {t('cabinet.findDoctors')}
          </button>
        </motion.section>
      </div>
    </div>
  )
}

function ProfileStat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-input px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-fg">{value}</p>
    </div>
  )
}
