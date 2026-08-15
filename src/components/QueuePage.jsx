import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import { useLang, useT } from '../i18n'
import { API_BASE, cancelQueue, fetchDashboard } from '../lib/api'

const MIN_PER_PERSON = 5

function StatBox({ label, value, highlight = false }) {
  return (
    <div className="rounded-xl border border-border bg-input p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">{label}</p>
      <p
        className={
          'mt-1 font-display text-2xl font-semibold sm:text-3xl ' +
          (highlight ? 'text-accent' : 'text-fg')
        }
      >
        {value}
      </p>
    </div>
  )
}

export default function QueuePage({ navigate }) {
  const t = useT()
  const lang = useLang()

  const [queues, setQueues] = useState([])
  const [live, setLive] = useState(false)
  const [error, setError] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [cancelled, setCancelled] = useState(false)
  const queueStateRef = useRef(null)

  const applyLiveState = useCallback((state) => {
    queueStateRef.current = state
    setQueues((prev) =>
      prev.map((q) => {
        const raw = state[q.doctorId]
        if (!raw) return q
        const number = parseInt(String(q.yourNumber).split('-')[1], 10)
        if (Number.isNaN(number)) return q
        const ahead = Math.max(0, number - raw.current - 1)
        return {
          ...q,
          current: raw.current,
          peopleAhead: ahead,
          waitMin: ahead * MIN_PER_PERSON,
          updatedAt: raw.updatedAt,
        }
      })
    )
  }, [])

  const load = useCallback(async () => {
    setError(false)
    try {
      const data = await fetchDashboard(lang)
      setQueues(data.activeQueue ?? [])
      setCancelled(false)
    } catch {
      setError(true)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let es
    try {
      es = new EventSource(`${API_BASE}/api/queue/stream`, { withCredentials: true })
    } catch {
      return
    }
    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'init' || data.type === 'queue_update') {
          const state = data.queues ?? queueStateRef.current
          setLive(true)
          if (state) applyLiveState(state)
        }
      } catch {
        // Ignore malformed keep-alive frames.
      }
    })
    return () => es.close()
  }, [applyLiveState])

  async function handleCancel(queue) {
    if (cancellingId) return
    setCancellingId(queue.doctorId)
    try {
      await cancelQueue(queue.doctorId, lang)
      setCancelled(true)
      setQueues((prev) => prev.filter((q) => q.doctorId !== queue.doctorId))
    } catch {
      setError(true)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow={t('queuePage.eyebrow')}
          title={t('queuePage.title')}
          subtitle={t('queuePage.subtitle')}
        />

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
            {t('ai.errors.network')}
          </p>
        )}

        <div className="mt-10 grid gap-5">
          {queues.length === 0 && !error && (
            <>
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <p className="text-[13px] text-muted">{t('queuePage.noQueue')}</p>
                <p className="mt-1 text-[11px] text-faint">{t('queuePage.noQueueHint')}</p>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/doctors')}
                  className="rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.55)]"
                >
                  {t('queuePage.backToDoctors')}
                </button>
              </div>
            </>
          )}

          {queues.map((queue) => (
            <div
              key={queue.doctorId}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neon-600 via-neon-500 to-electric-500 p-[1px] shadow-[0_10px_40px_rgba(139,92,246,0.25)]"
            >
              <div className="rounded-[calc(1rem-1px)] bg-bg-soft p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-fg">
                    {queue.doctor} — {queue.specialty}
                  </h2>
                  {live && (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      {t('dashboard.queue.live')}
                    </span>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBox
                    label={t('dashboard.queue.yourNumber')}
                    value={queue.yourNumber}
                    highlight
                  />
                  <StatBox
                    label={t('dashboard.queue.serving')}
                    value={`${queue.letter}-${queue.current}`}
                  />
                  <StatBox
                    label={t('dashboard.queue.ahead')}
                    value={queue.peopleAhead ?? '—'}
                  />
                  <StatBox
                    label={t('dashboard.queue.wait')}
                    value={
                      <>
                        {queue.waitMin ?? '—'}
                        <span className="text-sm text-faint"> min</span>
                      </>
                    }
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="text-[12px] text-muted">
                    <span>
                      {t('dashboard.queue.clinic')}:{' '}
                      <span className="text-fg">{queue.clinic}</span>
                    </span>
                    <span className="ml-3">
                      {t('dashboard.queue.doctor')}:{' '}
                      <span className="text-fg">{queue.doctor}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancel(queue)}
                    disabled={cancellingId === queue.doctorId}
                    className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-[12px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {cancellingId === queue.doctorId ? t('queuePage.cancelling') : t('queuePage.cancel')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {cancelled && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25 }}
              className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
            >
              <p className="text-[12px] font-medium text-emerald-300">
                {t('queuePage.cancelled')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/doctors')}
                className="shrink-0 text-[12px] font-semibold text-emerald-200 underline-offset-2 hover:underline"
              >
                {t('queuePage.backToDoctors')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
