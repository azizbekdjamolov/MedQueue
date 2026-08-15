import { useState } from 'react'
import { motion } from 'framer-motion'
import { useT } from '../i18n'

export default function AiBar({ navigate }) {
  const [input, setInput] = useState('')
  const t = useT()

  const trimmed = input.trim()

  function handleSubmit() {
    if (!trimmed) return
    navigate('/ai', { initialMessage: trimmed })
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <section className="relative scroll-mt-24 px-4 py-10 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-[520px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--blob-c)] blur-[100px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative mx-auto flex w-full max-w-[560px] flex-col items-stretch"
      >
        <div className="group relative w-full rounded-2xl bg-gradient-to-r from-neon-500/40 via-electric-500/30 to-neon-500/40 p-px shadow-[0_10px_50px_rgba(139,92,246,0.15)] transition-shadow duration-500 hover:shadow-[0_10px_70px_rgba(139,92,246,0.28)]">
          <div className="glass-strong relative flex items-center gap-2.5 rounded-[calc(1rem-1px)] py-2.5 pl-4 pr-2.5 transition-colors duration-300 focus-within:bg-input-focus">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon-500 to-electric-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.45)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
                  fill="currentColor"
                />
                <path
                  d="M19 15.5l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7Z"
                  fill="currentColor"
                  opacity="0.75"
                />
              </svg>
            </div>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('aiBar.placeholder')}
              aria-label={t('aiBar.label')}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm text-fg outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!trimmed}
              aria-label={t('aiBar.open')}
              className={
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-all duration-300 ' +
                (trimmed
                  ? 'bg-gradient-to-br from-neon-600 to-electric-500 shadow-[0_0_14px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)]'
                  : 'bg-input text-faint')
              }
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2 8h11m0 0L9 4m4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  )
}