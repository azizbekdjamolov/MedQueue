import { useT } from '../i18n'

function FooterLinkGroups(t) {
  return [
    {
      heading: t('footer.product'),
      links: [
        { label: t('footer.search'), href: '/clinics' },
        { label: t('nav.doctors'), href: '/doctors' },
        { label: t('footer.dashboard'), href: '/cabinet' },
        { label: t('footer.ai'), href: '/ai' },
        { label: t('footer.statistics'), href: '/stats' },
      ],
    },
    {
      heading: t('footer.resources'),
      links: [
        { label: t('footer.telegram'), href: '#' },
        { label: t('nav.queue'), href: '/queue' },
        { label: t('nav.laboratory'), href: '/laboratory' },
        { label: t('footer.status'), href: '#' },
      ],
    },
    {
      heading: t('footer.company'),
      links: [
        { label: t('footer.about'), href: '/features' },
        { label: t('footer.careers'), href: '#' },
        { label: t('footer.press'), href: '#' },
        { label: t('footer.contact'), href: '#' },
      ],
    },
  ]
}

const SOCIALS = [
  {
    label: 'X',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2.5h3.2l-7 8 8.2 11h-6.4l-5-6.6-5.8 6.6H2.9l7.5-8.5L2.5 2.5h6.6l4.5 6 5.3-6Zm-1.1 17h1.8L7.9 4.3H6L17.8 19.5Z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2A10 10 0 0 0 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.7 9.7 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2Z" />
      </svg>
    ),
  },
  {
    label: 'Telegram',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21.9 4.3 18.8 19c-.2 1-.8 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.7L18.3 7c.4-.3-.1-.5-.6-.2L7.3 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5l18-7c.8-.3 1.5.2 1.3 1.4Z" />
      </svg>
    ),
  },
]

export default function Footer({ navigate }) {
  const t = useT()
  const LINK_GROUPS = FooterLinkGroups(t)

  return (
    <footer className="relative border-t border-border bg-bg-soft/60">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-500/60 to-transparent"
      />
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M16 2.5 27.5 9v14L16 29.5 4.5 23V9L16 2.5Z"
                  stroke="url(#footer-logo)"
                  strokeWidth="2"
                />
                <path
                  d="M16 9.5 21.5 13v6L16 22.5 10.5 19v-6L16 9.5Z"
                  fill="url(#footer-logo)"
                />
                <defs>
                  <linearGradient id="footer-logo" x1="4.5" y1="2.5" x2="27.5" y2="29.5">
                    <stop stopColor="#a78bfa" />
                    <stop offset="1" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-display text-lg font-semibold tracking-wide text-fg">
                MedQueue Tashkent
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              {t('footer.tagline')}
            </p>
            <div className="mt-6 flex gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted transition-all hover:border-neon-500/50 hover:text-fg"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-fg">
                {group.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(event) => {
                        if (link.href.startsWith('/')) {
                          event.preventDefault()
                          navigate(link.href)
                        }
                      }}
                      className="text-sm text-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-faint">
            © {new Date().getFullYear()} MedQueue Tashkent. {t('footer.rights')}
          </p>
          <p className="text-xs text-faint">{t('footer.crafted')}</p>
        </div>
      </div>
    </footer>
  )
}