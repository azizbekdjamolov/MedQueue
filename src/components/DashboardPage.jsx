import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLang, useT } from '../i18n'
import { fetchDashboard } from '../lib/api'
import { useAuth } from '../lib/auth'

const MIN_PER_PERSON = 5

function fmt(t, key, vars) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '')
}

function Section({ title, children, icon }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass rounded-2xl p-5 sm:p-6"
    >
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-fg">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-neon-500/20 to-electric-500/20 text-accent">
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  )
}

function QueueCard({ queue, live }) {
  const t = useT()
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neon-600 via-neon-500 to-electric-500 p-[1px] shadow-[0_10px_40px_rgba(139,92,246,0.25)]">
      <div className="rounded-[calc(1rem-1px)] bg-bg-soft p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-fg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('dashboard.queue.title')}
          </h2>
          {live && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {t('dashboard.queue.live')}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-input p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">
              {t('dashboard.queue.yourNumber')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-accent sm:text-3xl">
              {queue.yourNumber}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-input p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">
              {t('dashboard.queue.serving')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-fg sm:text-3xl">
              {queue.letter}-{queue.current}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-input p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">
              {t('dashboard.queue.ahead')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-fg sm:text-3xl">
              {queue.peopleAhead ?? '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-input p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-faint">
              {t('dashboard.queue.wait')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-fg sm:text-3xl">
              {queue.waitMin ?? '—'}
              <span className="text-sm text-faint"> min</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[12px] text-muted">
          <span>
            {t('dashboard.queue.doctor')}: <span className="text-fg">{queue.doctor}</span>
          </span>
          <span>
            {t('dashboard.queue.clinic')}: <span className="text-fg">{queue.clinic}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
      <p className="text-[13px] text-muted">{text}</p>
      {hint && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
    </div>
  )
}

export default function DashboardPage({ navigate }) {
  const t = useT()
  const lang = useLang()
  const { user } = useAuth()

  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState(false)
  const [live, setLive] = useState(false)
  const queueStateRef = useRef(null)

  const applyQueueState = useCallback(() => {
    const state = queueStateRef.current
    if (!state || !dashboard) return
    const next = {
      ...dashboard,
      activeQueue: dashboard.activeQueue.map((q) => {
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
      }),
    }
    setDashboard(next)
  }, [dashboard])

  useEffect(() => {
    let cancelled = false
    fetchDashboard(lang)
      .then((data) => {
        if (!cancelled) setDashboard(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  useEffect(() => {
    let es
    try {
      es = new EventSource('/api/queue/stream')
    } catch {
      return
    }
    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'init' || data.type === 'queue_update') {
          queueStateRef.current = data.queues ?? queueStateRef.current
          setLive(true)
          applyQueueState()
        }
      } catch {
        // Ignore malformed keep-alive frames.
      }
    })
    return () => es.close()
  }, [applyQueueState])

  const activeQueue = dashboard?.activeQueue ?? []
  const appointments = dashboard?.appointments ?? []
  const labs = dashboard?.labResults ?? []
  const history = dashboard?.history ?? []
  const notifications = dashboard?.notifications ?? []

  const greetingName =
    user?.full_name ?? dashboard?.patient?.name ?? ''

  return (
    <div className="relative px-4 pb-20 pt-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-neon-500/30 bg-neon-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {t('dashboard.eyebrow')}
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold text-fg sm:text-4xl">
              {fmt(t, 'dashboard.title', { name: greetingName })}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/clinics')}
              className="rounded-full bg-gradient-to-r from-neon-600 to-electric-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_14px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_2px_20px_rgba(139,92,246,0.55)]"
            >
              {t('dashboard.actions.findClinic')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/ai')}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-card-hover hover:text-fg"
            >
              {t('dashboard.actions.openAi')}
            </button>
          </div>
        </motion.header>

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">
            {t('ai.errors.network')}
          </p>
        )}

        {!dashboard && !error && (
          <div className="mt-10 grid gap-5">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="glass h-40 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {dashboard && (
          <div className="mt-10 grid gap-5">
            {activeQueue.length > 0 ? (
              <QueueCard queue={activeQueue[0]} live={live} />
            ) : (
              <EmptyState text={t('dashboard.queue.noQueue')} hint={t('dashboard.queue.noQueueHint')} />
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Section
                title={t('dashboard.appointments.title')}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 3v4m8-4v4M3 10h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                }
              >
                {appointments.length === 0 ? (
                  <EmptyState text={t('dashboard.appointments.empty')} />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {appointments.map((a) => (
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
                        <span className="shrink-0 rounded-lg border border-neon-500/30 bg-neon-500/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                          {a.date === 'today' ? t('dashboard.appointments.today') : t('dashboard.appointments.tomorrow')}{' '}
                          {a.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title={t('dashboard.notifications.title')}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm4 10h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                {notifications.length === 0 ? (
                  <EmptyState text={t('dashboard.notifications.empty')} />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {notifications.slice(0, 5).map((n) => (
                      <li
                        key={n.id}
                        className={
                          'rounded-xl border px-4 py-3 ' +
                          (n.read ? 'border-border bg-card' : 'border-neon-500/30 bg-neon-500/10')
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-fg">{n.title}</p>
                          {!n.read && (
                            <span className="rounded-full bg-neon-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent">
                              {t('dashboard.notifications.new')}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{n.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section
                title={t('dashboard.labs.title')}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 3h6m-5 0v5.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                {labs.length === 0 ? (
                  <EmptyState text={t('dashboard.labs.empty')} />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {labs.map((r) => (
                      <li key={r.id} className="rounded-xl border border-border bg-card px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-fg">{r.title}</p>
                          <span
                            className={
                              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ' +
                              (r.status === 'ready'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300')
                            }
                          >
                            {r.status === 'ready' ? t('dashboard.labs.ready') : t('dashboard.labs.pending')}
                          </span>
                        </div>
                        {r.summary && (
                          <p className="mt-1 text-[11px] leading-relaxed text-muted">{r.summary}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title={t('dashboard.history.title')}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                {history.length === 0 ? (
                  <EmptyState text={t('dashboard.history.empty')} />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-xl border border-border bg-card px-4 py-3">
                        <p className="text-[13px] font-medium text-fg">{h.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{h.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
