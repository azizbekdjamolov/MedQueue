import * as THREE from 'three'
import { scenePalette } from '../lib/theme'

/**
 * Converts the dependency-free theme palette (hex strings) into reusable
 * THREE.Color objects. Lives in the lazy 3D chunk so three.js never enters
 * the main bundle. `getScenePalette()` is called inside useFrame — the
 * version check is a cheap integer comparison, so per-frame cost is zero
 * unless the theme actually changed.
 */
const working = {}
let syncedVersion = -1

function sync() {
  if (syncedVersion === scenePalette.version) return
  syncedVersion = scenePalette.version
  const src = scenePalette.current
  for (const key of Object.keys(src)) {
    const value = src[key]
    if (typeof value === 'string') {
      if (!(key in working)) working[key] = new THREE.Color()
      working[key].set(value)
    } else if (Array.isArray(value)) {
      if (!(key in working) || working[key].length !== value.length) {
        working[key] = value.map(() => new THREE.Color())
      }
      value.forEach((hex, i) => working[key][i].set(hex))
    } else {
      working[key] = value
    }
  }
}

export function getScenePalette() {
  sync()
  return working
}