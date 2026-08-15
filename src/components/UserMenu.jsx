import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { logout, useAuth } from '../lib/auth'
import { useT } from '../i18n'

/**
 * Authenticated user menu — replaces the "Get Started" button in the navbar.
 * Shows avatar + first name, with a dropdown for profile/queue/history/logout.
 */
export default function UserMenu({ navigate }) {
  const t = useT()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  const firstName = user.full_name.split(' ')[0]

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/')
  }

  const items = [
    { key: 'profile', label: t('auth.menu.profile'), path: '/profile', icon: 'profile' },
    { key: 'appointments', label: t('auth.menu.myAppointments'), path: '/appointments', icon: 'calendar' },
    { key: 'queue', label: t('auth.menu.queueStatus'), path: '/queue', icon: 'queue' },
    { key: 'history', label: t('auth.menu.medicalHistory'), path: '/medical-history', icon: 'history' },
    { key: 'settings', label: t('auth.menu.settings'), path: '/profile', icon: 'settings' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 transition-colors duration-300 hover:bg-card-hover"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.full_name}
            className="h-8 w-8 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-neon-500 to-electric-500 text-[13px] font-semibold text-white">
            {user.full_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-fg sm:block">
          {firstName}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={'text-faint transition-transform duration-200 ' + (open ? 'rotate-180' : '')}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="glass-strong absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl p-2 shadow-[var(--nav-shadow)]"
          >
            <div className="border-b border-border px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-fg">{user.full_name}</p>
              <p className="truncate text-[11px] text-faint">{user.email}</p>
            </div>

            <ul className="flex flex-col gap-0.5 py-1.5">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => go(item.path)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-muted transition-colors duration-200 hover:bg-card-hover hover:text-fg"
                  >
                    <MenuIcon name={item.icon} />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-rose-300 transition-colors duration-200 hover:bg-rose-500/10"
              >
                <MenuIcon name="logout" />
                {t('auth.logout')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuIcon({ name }) {
  const paths = {
    profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
    calendar:
      'M8 3v4m8-4v4M3 10h18M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    queue: 'M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13M10 11v5m4-5v5',
    history:
      'M12 8v4l3 2m6-2a9 9 0 1 1-2.6-6.3M3.4 2v4h4',
    settings:
      'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.2 3.5c0 .6-.05 1.15-.15 1.7l2 1.55-2 3.45-2.35-.95c-.65.5-1.4.9-2.2 1.15L14.3 21h-4l-.25-2.55c-.8-.25-1.55-.65-2.2-1.15l-2.35.95-2-3.45 2-1.55c-.1-.55-.15-1.1-.15-1.7s.05-1.15.15-1.7l-2-1.55 2-3.45 2.35.95c.65-.5 1.4-.9 2.2-1.15L10.3 3h4l.25 2.55c.8.25 1.55.65 2.2 1.15l2.35-.95 2 3.45-2 1.55c.1.55.15 1.1.15 1.7Z',
    logout:
      'M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M9 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H9',
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={paths[name] ?? paths.profile}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
