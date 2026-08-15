import { getTheme } from './theme.js'

const TELEGRAM_SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js'

const THEME_COLORS = {
  dark: '#05060f',
  light: '#f3f5fc',
}

/**
 * Clean integration service for the Telegram WebApp SDK.
 *
 * The script is only loaded when the page runs inside Telegram. In a regular
 * browser this module is a safe no-op, so the website works everywhere.
 */
export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

/** True when the page is running inside the Telegram Mini App. */
export function isInsideTelegram() {
  return getTelegramWebApp() != null
}

/** Mirror the active theme into the Telegram WebApp header/background. */
export function applyTelegramThemeColors() {
  const webApp = getTelegramWebApp()
  if (!webApp) return
  const color = THEME_COLORS[getTheme()] ?? THEME_COLORS.dark
  if (typeof webApp.setHeaderColor === 'function') webApp.setHeaderColor(color)
  if (typeof webApp.setBackgroundColor === 'function') webApp.setBackgroundColor(color)
}

/**
 * Prepare the app for the Telegram WebApp environment.
 * Call once on startup — safe to call in a regular browser (no-op).
 */
export function initTelegramWebApp() {
  const webApp = getTelegramWebApp()
  if (!webApp) return null

  webApp.ready()
  if (typeof webApp.expand === 'function') webApp.expand()
  applyTelegramThemeColors()

  return webApp
}

/** Current Telegram user when the app runs inside Telegram, otherwise null. */
export function getTelegramUser() {
  const webApp = getTelegramWebApp()
  return webApp?.initDataUnsafe?.user ?? null
}

export { TELEGRAM_SCRIPT_URL }