import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import { useLang, useT } from '../i18n'
import { fetchLaboratoryResults } from '../lib/api'

export default function LaboratoryPage({ navigate }) {
  const t = useT()
  const lang = useLang()

  const [results, setResults] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setResults(null)
    fetchLaboratoryResults(lang)
      .then((data) => {
        if (!cancelled) setResults(data.results ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  const readyCount = results?.filter((r) => r.status === 'ready').length ?? 0

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow={t('labPage.eyebrow')}
          title={t('labPage.title')}
          subtitle={t('labPage.subtitle')}
        />

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
            {t('ai.errors.network')}
          </p>
        )}

        <div className="mt-10 grid gap-5">
          {results === null && !error && (
            <div className="grid gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
              ))}
            </div>
          )}

          {results !== null && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-[13px] text-muted">{t('labPage.empty')}</p>
              <p className="mt-1 text-[11px] text-faint">{t('labPage.emptyHint')}</p>
            </div>
          )}

          {results !== null && results.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                  {t('labPage.ready')}: {readyCount}
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
                  {t('labPage.pending')}: {results.length - readyCount}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {results.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
                    className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={
                          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ' +
                          (result.status === 'ready'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300')
                        }
                      >
                        {result.status === 'ready' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-fg">{result.title}</p>
                        {result.summary && (
                          <p className="mt-1 text-[12px] leading-relaxed text-muted">
                            {result.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                      <span
                        className={
                          'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ' +
                          (result.status === 'ready'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300')
                        }
                      >
                        {result.status === 'ready' ? t('labPage.ready') : t('labPage.pending')}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/ai')}
                        className="text-[11px] font-semibold text-accent underline-offset-2 hover:underline"
                      >
                        {t('labPage.askAi')}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <p className="text-[11px] text-faint">{t('labPage.aiHint')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
