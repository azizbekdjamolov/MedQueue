import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import AiBar from './components/AiBar'
import AiChat from './components/AiChat'
import Stats from './components/Stats'
import Footer from './components/Footer'
import BackgroundFX from './components/BackgroundFX'
import SearchPage from './components/SearchPage'
import DashboardPage from './components/DashboardPage'
import ClinicsPage from './components/ClinicsPage'
import DoctorsPage from './components/DoctorsPage'
import QueuePage from './components/QueuePage'
import LaboratoryPage from './components/LaboratoryPage'
import CabinetPage from './components/CabinetPage'
import StatsPage from './components/StatsPage'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import ProfilePage from './components/ProfilePage'
import AppointmentsPage from './components/AppointmentsPage'
import MedicalHistoryPage from './components/MedicalHistoryPage'
import { applyTelegramThemeColors, initTelegramWebApp } from './lib/telegram'
import { subscribeTheme } from './lib/theme'
import { useRouter } from './lib/router'
import { bootstrapAuth, useAuth } from './lib/auth'

/**
 * Routes that require an authenticated session. Guests are redirected to
 * /login (the originally requested page is kept in the ?redirect= param).
 */
const PROTECTED_PATHS = new Set([
  '/profile',
  '/my-cabinet',
  '/cabinet',
  '/dashboard',
  '/queue',
  '/laboratory',
  '/lab',
  '/appointments',
  '/medical-history',
])

/** Public auth pages — authenticated users are sent straight to their cabinet. */
const AUTH_PATHS = new Set(['/login', '/register'])

function HomePage({ navigate }) {
  return (
    <>
      <Navbar navigate={navigate} />
      <main className="relative z-10">
        <Hero navigate={navigate} />
        <AiBar navigate={navigate} />
        <Features />
        <Stats />
      </main>
      <Footer navigate={navigate} />
    </>
  )
}

function SectionPage({ navigate, children }) {
  return (
    <>
      <Navbar navigate={navigate} />
      <main className="relative z-10">{children}</main>
      <Footer navigate={navigate} />
    </>
  )
}

function AiPage({ navigate, chatId }) {
  const [initialMessage] = useState(() => {
    const state = window.history.state
    return state && typeof state.initialMessage === 'string' && state.initialMessage.trim()
      ? state.initialMessage.trim()
      : null
  })

  return (
    <>
      <Navbar navigate={navigate} solid />
      <main className="relative z-10 mt-16 h-[calc(100dvh-4rem)] overflow-hidden">
        <AiChat
          key={chatId ?? 'start'}
          initialMessage={initialMessage}
          initialChatId={chatId}
          navigate={navigate}
        />
      </main>
    </>
  )
}

function FullScreenLoader() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center">
      <div className="glass flex flex-col items-center gap-4 rounded-3xl px-10 py-12">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-neon-500 border-t-transparent" />
        <p className="text-sm text-muted">MedQueue Tashkent</p>
      </div>
    </div>
  )
}

export default function App() {
  useEffect(() => {
    initTelegramWebApp()
    bootstrapAuth()
    return subscribeTheme(applyTelegramThemeColors)
  }, [])

  const { path, navigate } = useRouter()
  const { status, bootstrapped } = useAuth()

  const needsAuth = PROTECTED_PATHS.has(path) || path.startsWith('/my-cabinet')
  const isAuthPage = AUTH_PATHS.has(path)

  /* Guests hitting a protected route → redirect to /login with return path. */
  const redirectToLogin = bootstrapped && needsAuth && status !== 'authenticated'
  /* Authenticated users on /login or /register → straight to their cabinet. */
  const redirectToCabinet = bootstrapped && isAuthPage && status === 'authenticated'

  useEffect(() => {
    if (redirectToLogin) {
      navigate(`/login?redirect=${encodeURIComponent(path)}`)
    } else if (redirectToCabinet) {
      navigate('/cabinet')
    }
  }, [redirectToLogin, redirectToCabinet, path]) // eslint-disable-line react-hooks/exhaustive-deps

  /* While the session is being restored from the cookie, show a loader. */
  if (!bootstrapped) {
    return (
      <div className="relative min-h-screen overflow-x-clip bg-bg font-sans text-fg transition-colors duration-300">
        <BackgroundFX />
        <FullScreenLoader />
      </div>
    )
  }

  if (redirectToLogin || redirectToCabinet) {
    return (
      <div className="relative min-h-screen overflow-x-clip bg-bg font-sans text-fg transition-colors duration-300">
        <BackgroundFX />
        <FullScreenLoader />
      </div>
    )
  }

  let page
  if (path === '/ai' || path.startsWith('/ai/')) {
    page = (
      <AiPage
        navigate={navigate}
        chatId={path.startsWith('/ai/') ? path.slice(4) : null}
      />
    )
  } else if (path === '/search') {
    page = (
      <SectionPage navigate={navigate}>
        <SearchPage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/clinics') {
    page = (
      <SectionPage navigate={navigate}>
        <ClinicsPage />
      </SectionPage>
    )
  } else if (path === '/doctors') {
    page = (
      <SectionPage navigate={navigate}>
        <DoctorsPage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/queue') {
    page = (
      <SectionPage navigate={navigate}>
        <QueuePage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/laboratory' || path === '/lab') {
    page = (
      <SectionPage navigate={navigate}>
        <LaboratoryPage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/dashboard') {
    page = (
      <SectionPage navigate={navigate}>
        <DashboardPage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/cabinet' || path === '/my-cabinet') {
    page = (
      <SectionPage navigate={navigate}>
        <CabinetPage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/profile') {
    page = (
      <SectionPage navigate={navigate}>
        <ProfilePage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/appointments') {
    page = (
      <SectionPage navigate={navigate}>
        <AppointmentsPage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/medical-history') {
    page = (
      <SectionPage navigate={navigate}>
        <MedicalHistoryPage navigate={navigate} />
      </SectionPage>
    )
  } else if (path === '/features') {
    page = (
      <SectionPage navigate={navigate}>
        <Features />
      </SectionPage>
    )
  } else if (path === '/stats') {
    page = (
      <SectionPage navigate={navigate}>
        <StatsPage />
      </SectionPage>
    )
  } else if (path === '/login') {
    page = <LoginPage navigate={navigate} />
  } else if (path === '/register') {
    page = <RegisterPage navigate={navigate} />
  } else {
    page = <HomePage navigate={navigate} />
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg font-sans text-fg transition-colors duration-300">
      <BackgroundFX />
      {page}
    </div>
  )
}
