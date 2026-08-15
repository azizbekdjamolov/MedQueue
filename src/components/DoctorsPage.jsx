import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import { useLang, useT } from '../i18n'
import { requireLogin } from '../lib/auth'
import { fetchDistricts, fetchDoctors, fetchSpecialties, takeQueue } from '../lib/api'

function fmt(t, key, vars) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '')
}

function Select({ value, onChange, label, options, allLabel }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[180px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-neon-500/40 focus:bg-input-focus"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function Badge({ tone = 'neon', children }) {
  const tones = {
    neon: 'border-neon-500/30 bg-neon-500/10 text-accent',
    electric: 'border-electric-500/30 bg-electric-500/10 text-electric-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export default function DoctorsPage({ navigate }) {
  const t = useT()
  const lang = useLang()

  const [q, setQ] = useState('')
  const [district, setDistrict] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [availableToday, setAvailableToday] = useState(false)
  const [availableTomorrow, setAvailableTomorrow] = useState(false)

  const [doctors, setDoctors] = useState(null)
  const [districts, setDistricts] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [error, setError] = useState(false)
  const [result, setResult] = useState(null)
  const [busyDoctorId, setBusyDoctorId] = useState(null)

  const loadRef = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++loadRef.current
    setDoctors(null)
    setError(false)
    try {
      const data = await fetchDoctors(
        {
          district,
          specialty,
          q: q.trim(),
          available_today: availableToday,
          available_tomorrow: availableTomorrow,
        },
        lang
      )
      if (ticket !== loadRef.current) return
      setDoctors(data.doctors ?? [])
    } catch {
      if (ticket === loadRef.current) setError(true)
    }
  }, [district, specialty, q, availableToday, availableTomorrow, lang])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDistricts(lang), fetchSpecialties(lang)])
      .then(([d, s]) => {
        if (cancelled) return
        setDistricts(d.districts ?? [])
        setSpecialties(s.specialties ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [lang])

  function handleTakeQueue(doctor) {
    if (!requireLogin(navigate)) return
    setBusyDoctorId(doctor.id)
    takeQueue(doctor.id, lang)
      .then((queue) => {
        setResult({ doctor, queue })
        load()
      })
      .catch(() => setError(true))
      .finally(() => setBusyDoctorId(null))
  }

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={t('search.eyebrow')}
          title={t('search.tabDoctors')}
          subtitle={t('search.subtitle')}
        />

        <div className="glass mt-10 rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-input px-3.5 py-2 transition-colors focus-within:border-neon-500/40 focus-within:bg-input-focus">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-faint">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t('search.placeholder')}
                aria-label={t('search.placeholder')}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm text-fg outline-none placeholder:text-faint"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Select
                value={district}
                onChange={setDistrict}
                label={t('search.filterDistrict')}
                options={districts}
                allLabel={t('search.filterAll')}
              />
              <Select
                value={specialty}
                onChange={setSpecialty}
                label={t('search.filterSpecialty')}
                options={specialties}
                allLabel={t('search.filterAll')}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted">
                <input
                  type="checkbox"
                  checked={availableToday}
                  onChange={(event) => setAvailableToday(event.target.checked)}
                  className="h-3.5 w-3.5 accent-neon-500"
                />
                {t('search.availableToday')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted">
                <input
                  type="checkbox"
                  checked={availableTomorrow}
                  onChange={(event) => setAvailableTomorrow(event.target.checked)}
                  className="h-3.5 w-3.5 accent-neon-500"
                />
                {t('search.availableTomorrow')}
              </label>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
            {t('ai.errors.network')}
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors === null &&
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="glass h-52 animate-pulse rounded-2xl" />
            ))}
          {doctors !== null && doctors.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-faint">
              {t('search.emptyDoctors')}
            </p>
          )}
          {doctors !== null &&
            doctors.map((doctor) => {
              const busy = busyDoctorId === doctor.id
              return (
                <div
                  key={doctor.id}
                  className="glass flex h-full flex-col gap-3 rounded-2xl p-5 transition-all duration-300 hover:border-border-strong hover:shadow-[var(--glow-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-base font-semibold leading-tight text-fg">
                      {doctor.name}
                    </h3>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone="electric">{doctor.specialty}</Badge>
                    </div>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted">
                    {fmt(t, 'search.doctorAt', { clinic: doctor.clinic, district: doctor.district })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="neon">{fmt(t, 'search.experience', { n: doctor.experience })}</Badge>
                    <Badge tone="neon">{fmt(t, 'search.rating', { r: doctor.rating.toFixed(1) })}</Badge>
                    <Badge tone="electric">{fmt(t, 'search.languages', { langs: doctor.languages.join(', ') })}</Badge>
                    <Badge tone={doctor.availableToday ? 'emerald' : 'rose'}>
                      {t('search.available')} {t('search.today')}
                    </Badge>
                    <Badge tone={doctor.availableTomorrow ? 'emerald' : 'rose'}>
                      {t('search.available')} {t('search.tomorrow')}
                    </Badge>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-faint">
                        {fmt(t, 'search.queueNow', { n: doctor.queueAhead })}
                      </span>
                      <span className="text-[11px] text-faint">
                        {fmt(t, 'search.avgWait', { n: doctor.avgWaitMin })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTakeQueue(doctor)}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_12px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_18px_rgba(139,92,246,0.55)] disabled:opacity-50"
                    >
                      {busy ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : null}
                      {busy ? t('search.joining') : t('search.takeQueue')}
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Queue-taken modal */}
      <AnimatePresence>
        {result && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResult(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-neon-500/30 bg-bg-soft p-6 text-center shadow-[0_20px_80px_rgba(139,92,246,0.35)]"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-neon-500 to-electric-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-fg">
                {t('search.taken')}
              </h3>
              <p className="mt-1 text-[12px] text-muted">
                {result.doctor.name} — {result.doctor.specialty}
              </p>
              <p className="mt-4 rounded-2xl border border-border bg-input px-4 py-3 font-display text-3xl font-semibold tracking-wide text-accent">
                {result.queue.yourNumber}
              </p>
              <p className="mt-2 text-[12px] text-faint">
                {fmt(t, 'search.queueNow', { n: result.queue.peopleAhead })} ·{' '}
                {fmt(t, 'search.avgWait', { n: result.queue.waitMin })}
              </p>
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  if (navigate) navigate('/queue')
                }}
                className="mt-5 w-full rounded-full bg-gradient-to-r from-neon-600 to-electric-600 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_2px_16px_rgba(139,92,246,0.5)]"
              >
                {t('queuePage.track')}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
