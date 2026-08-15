import { motion } from 'framer-motion'

/**
 * Glassmorphism card with hover glow. Reused across Features and AI sections.
 */
export default function GlassCard({ className = '', children, ...rest }) {
  return (
    <motion.div
      className={
        'glass group relative overflow-hidden rounded-2xl transition-colors duration-300 ' +
        'hover:border-border-strong hover:bg-card-hover ' +
        className
      }
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      {...rest}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-3/4 -translate-x-1/2 rounded-full bg-neon-500/25 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  )
}