import { useCallback, useEffect, useRef, useState } from 'react'
import SectionHeading from './ui/SectionHeading'
import { useLang, useT } from '../i18n'
import { fetchClinicTypes, fetchClinics, fetchDistricts, fetchSpecialties } from '../lib/api'

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

export default function ClinicsPage() {
  const t = useT()
  const lang = useLang()

  const [q, setQ] = useState('')
  const [district, setDistrict] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState('')

  const [clinics, setClinics] = useState(null)
  const [districts, setDistricts] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [clinicTypes, setClinicTypes] = useState([])
  const [error, setError] = useState(false)

  const loadRef = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++loadRef.current
    setClinics(null)
    setError(false)
    try {
      const data = await fetchClinics(
        { district, specialty, type, q: q.trim(), sort },
        lang
      )
      if (ticket !== loadRef.current) return
      setClinics(data.clinics ?? [])
    } catch {
      if (ticket === loadRef.current) setError(true)
    }
  }, [district, specialty, type, q, sort, lang])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDistricts(lang), fetchSpecialties(lang), fetchClinicTypes(lang)])
      .then(([d, s, c]) => {
        if (cancelled) return
        setDistricts(d.districts ?? [])
        setSpecialties(s.specialties ?? [])
        setClinicTypes(c.clinicTypes ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [lang])

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={t('search.eyebrow')}
          title={t('search.title')}
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
              <Select
                value={type}
                onChange={setType}
                label={t('search.filterType')}
                options={clinicTypes}
                allLabel={t('search.filterAll')}
              />
              <Select
                value={sort}
                onChange={setSort}
                label={t('search.sort')}
                options={[
                  { id: 'queue', name: t('search.sortQueue') },
                  { id: 'name', name: t('search.sortName') },
                ]}
                allLabel={t('search.sortDefault')}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
            {t('ai.errors.network')}
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clinics === null &&
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="glass h-44 animate-pulse rounded-2xl" />
            ))}
          {clinics !== null && clinics.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-faint">
              {t('search.emptyClinics')}
            </p>
          )}
          {clinics !== null &&
            clinics.map((clinic) => (
              <div
                key={clinic.id}
                className="glass flex h-full flex-col gap-3 rounded-2xl p-5 transition-all duration-300 hover:border-border-strong hover:shadow-[var(--glow-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-base font-semibold leading-tight text-fg">
                    {clinic.name}
                  </h3>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-neon-500/30 bg-neon-500/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    {clinic.typeName}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-muted">
                  {clinic.district} · {clinic.address}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {clinic.specialties.slice(0, 6).map((s) => (
                    <span
                      key={s.id}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-faint">
                      {fmt(t, 'search.queueNow', { n: clinic.queueNow })}
                    </span>
                    <span className="text-[11px] text-faint">
                      {fmt(t, 'search.avgWait', { n: clinic.avgQueueMin })}
                    </span>
                    <span className="text-[10px] text-faint">
                      {fmt(t, 'search.workHours', { hours: clinic.workHours })} · {clinic.phone}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
