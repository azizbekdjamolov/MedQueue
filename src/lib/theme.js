import { useSyncExternalStore } from 'react'

const THEME_KEY = 'theme'
export const DARK = 'dark'
export const LIGHT = 'light'

function loadTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) === LIGHT ? LIGHT : DARK
  } catch {
    return DARK
  }
}

/**
 * Colors for the 3D scene, per theme (hex strings + plain numbers — kept
 * dependency-free so this module never pulls three.js into the main bundle).
 * The 3D layers convert them to THREE.Color objects and smoothly lerp toward
 * the active palette every frame, so switching theme never re-renders or
 * remounts the WebGL scene. Additive blending is swapped to normal blending
 * in light mode so glows stay visible on a light background.
 */
export const SCENE_PALETTES = {
  [DARK]: {
    background: '#05060f',
    fog: '#05060f',
    surface: '#161b42',
    emissive: '#4338ca',
    emissiveIntensity: 0.22,
    core: '#a78bfa',
    coreOpacity: 0.45,
    hot: '#e0e7ff',
    hotOpacity: 0.85,
    shell: '#7dd3fc',
    shellOpacity: 0.12,
    halo: '#6d28d9',
    haloOpacity: 0.05,
    nodeOpacity: 0.7,
    ringColors: ['#a78bfa', '#38bdf8', '#818cf8'],
    ringOpacities: [0.32, 0.25, 0.2],
    satBody: '#2e2a6e',
    satEmissive: '#a78bfa',
    particleOpacity: 0.38,
    additive: true,
  },
  [LIGHT]: {
    background: '#eef1fb',
    fog: '#eef1fb',
    surface: '#6e76bd',
    emissive: '#4f46e5',
    emissiveIntensity: 0.42,
    core: '#6d28d9',
    coreOpacity: 0.8,
    hot: '#ffffff',
    hotOpacity: 1,
    shell: '#4338ca',
    shellOpacity: 0.38,
    halo: '#c7d2fe',
    haloOpacity: 0.55,
    nodeOpacity: 0.95,
    ringColors: ['#8b5cf6', '#0ea5e9', '#6366f1'],
    ringOpacities: [0.65, 0.55, 0.5],
    satBody: '#4338ca',
    satEmissive: '#7c3aed',
    particleOpacity: 0.85,
    additive: false,
  },
}

let theme = loadTheme()

/**
 * Mutable target palette consumed by the 3D layers. `version` bumps on every
 * theme change so the lazy 3D modules can cheaply detect and convert it.
 */
export const scenePalette = { current: SCENE_PALETTES[theme], version: 0 }

const THEME_COLORS = {
  [DARK]: '#05060f',
  [LIGHT]: '#f3f5fc',
}

function applyTheme(next) {
  document.documentElement.dataset.theme = next
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[next])
}

applyTheme(theme)

const listeners = new Set()

function emit() {
  listeners.forEach((fn) => fn())
}

export function getTheme() {
  return theme
}

export function subscribeTheme(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Change the theme without reloading the page. Persists to localStorage. */
export function setTheme(next) {
  if (next !== DARK && next !== LIGHT || next === theme) return
  theme = next
  scenePalette.current = SCENE_PALETTES[next]
  scenePalette.version += 1
  try {
    window.localStorage.setItem(THEME_KEY, next)
  } catch {
    // Storage unavailable — the theme still applies for this session.
  }
  applyTheme(next)
  emit()
}

/** Reactive current theme ('dark' | 'light'). */
export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme)
}