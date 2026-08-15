import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import { useLang, useT } from '../i18n'
import { fetchMedicalHistory } from '../lib/api'

export default function MedicalHistoryPage({ navigate }) {
  const t = useT()
  const lang = useLang()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    fetchMedicalHistory(lang)
      .then((res) => {
        if (!cancelled) setData(res.history ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow={t('auth.menu.medicalHistory')}
          title={t('dashboard.history.title')}
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

        {data && data.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-[13px] text-muted">{t('dashboard.history.empty')}</p>
            <button
              type="button"
              onClick={() => navigate('/ai')}
              className="mt-3 rounded-full border border-border bg-card px-5 py-2 text-[12px] font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg"
            >
              {t('dashboard.actions.openAi')}
            </button>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="mt-10 flex flex-col gap-3">
            {data.map((h, index) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="glass rounded-2xl p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold text-fg">{h.title}</p>
                  {h.date && <span className="shrink-0 text-[11px] text-faint">{h.date}</span>}
                </div>
                {h.summary && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{h.summary}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
