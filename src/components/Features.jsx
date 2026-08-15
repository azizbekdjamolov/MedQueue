import { motion } from 'framer-motion'
import SectionHeading from './ui/SectionHeading'
import GlassCard from './ui/GlassCard'
import { useT } from '../i18n'

function FeatureIcon({ index }) {
  const common = {
    width: '24',
    height: '24',
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true',
  }

  switch (index) {
    case 0:
      return (
        <svg {...common}>
          <path
            d="M4 20V10m6 10V4m6 16v-7m4 7H2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 1:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M3 12h18M12 3c2.8 2.6 4.2 5.7 4.2 9S14.8 18.4 12 21c-2.8-2.6-4.2-5.7-4.2-9S9.2 5.6 12 3Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      )
    case 2:
      return (
        <svg {...common}>
          <path
            d="M12 3 5 6v5c0 4.6 3 8.7 7 10 4-1.3 7-5.4 7-10V6l-7-3Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="m9 12 2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 3:
      return (
        <svg {...common}>
          <path
            d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 4:
      return (
        <svg {...common}>
          <path
            d="M12 3v18M3 12h18M5 5l14 14M19 5 5 19"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 9v4l2.5 2.5M9 2h6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

export default function Features() {
  const t = useT()
  const itemCount = 6

  return (
    <section id="features" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t('features.eyebrow')}
          title={
            <>
              {t('features.titleStart')} <span className="text-gradient">{t('features.titleEnd')}</span>
            </>
          }
          subtitle={t('features.subtitle')}
        />

        <motion.div
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={{ show: { transition: { staggerChildren: 0.09 } } }}
        >
          {Array.from({ length: itemCount }, (_, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
              }}
            >
              <GlassCard className="p-6 sm:p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neon-500/30 bg-neon-500/10 text-accent transition-colors duration-300 group-hover:text-fg">
                  <FeatureIcon index={i} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-fg">
                  {t(`features.items.${i}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {t(`features.items.${i}.description`)}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}