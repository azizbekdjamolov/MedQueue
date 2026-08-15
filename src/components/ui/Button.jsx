import { motion } from 'framer-motion'

const variants = {
  primary:
    'relative text-white bg-gradient-to-r from-neon-600 via-neon-500 to-electric-500 ' +
    'shadow-[var(--glow-soft)] hover:shadow-[var(--glow-strong)]',
  ghost:
    'text-ghost-text bg-ghost border border-border hover:bg-ghost-hover hover:border-border-strong',
  disabled: 'text-faint bg-ghost border border-border cursor-not-allowed',
}

const sizes = {
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

/**
 * Reusable neon-styled button. Renders an anchor when `href` is given,
 * otherwise a button. Pass `disabled` for features that are not implemented
 * yet — the visual state communicates it without fake behaviour.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide',
    'transition-all duration-300 select-none',
    variants[disabled ? 'disabled' : variant],
    sizes[size],
    disabled ? 'pointer-events-none opacity-50' : '',
    className,
  ].join(' ')

  const motionProps = {
    whileHover: disabled ? undefined : { scale: 1.03 },
    whileTap: disabled ? undefined : { scale: 0.97 },
    transition: { type: 'spring', stiffness: 400, damping: 22 },
  }

  if (href) {
    return (
      <motion.a href={href} className={classes} {...motionProps} {...rest}>
        {children}
      </motion.a>
    )
  }

  return (
    <motion.button type="button" className={classes} disabled={disabled} {...motionProps} {...rest}>
      {children}
    </motion.button>
  )
}