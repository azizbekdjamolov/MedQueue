import { motion } from 'framer-motion'

/**
 * Consistent section heading: eyebrow badge + display title + optional subtitle.
 */
export default function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  const alignment =
    align === 'center'
      ? 'items-center text-center'
      : 'items-start text-left'

  return (
    <motion.div
      className={`flex flex-col gap-4 ${alignment}`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      {eyebrow && (
        <span className="inline-flex items-center gap-2 rounded-full border border-neon-500/30 bg-neon-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric-400 shadow-[0_0_8px_#38bdf8]" />
          {eyebrow}
        </span>
      )}
      <h2 className="max-w-2xl font-display text-3xl font-semibold leading-tight text-fg sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="max-w-xl text-base leading-relaxed text-muted">{subtitle}</p>
      )}
    </motion.div>
  )
}