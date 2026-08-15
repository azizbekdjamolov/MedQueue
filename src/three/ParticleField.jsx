import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getScenePalette } from './scenePalette'

/**
 * Sparse glow particles drifting around the planet. One draw call, additive
 * blend in dark mode (normal blending in light mode so they stay visible).
 * `spread` caps the maximum distance from the planet so the cloud stays
 * inside the right side of the hero. Counts are capped by HeroScene
 * (220 desktop / 60–90 mobile). Theme changes are applied imperatively
 * inside useFrame — the scene never re-renders.
 */
export default function ParticleField({ count = 220, spread = 3 }) {
  const ref = useRef(null)
  const matRef = useRef(null)

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = [
      new THREE.Color('#8b5cf6'),
      new THREE.Color('#38bdf8'),
      new THREE.Color('#a78bfa'),
    ]
    const temp = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const r = spread * (0.7 + Math.random() * 0.3)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.75 - 0.3

      temp.copy(palette[i % palette.length])
      temp.multiplyScalar(0.25 + Math.random() * 0.4)
      colors[i * 3] = temp.r
      colors[i * 3 + 1] = temp.g
      colors[i * 3 + 2] = temp.b
    }
    return { positions, colors }
  }, [count, spread])

  useFrame((_, delta) => {
    if (ref.current) {
      const dt = Math.min(delta, 0.05)
      ref.current.rotation.y += dt * 0.012
      ref.current.rotation.x += dt * 0.003
    }

    const mat = matRef.current
    if (!mat) return
    const palette = getScenePalette()
    const k = Math.min(delta * 2.2, 1)
    const additive = palette.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    if (mat.blending !== additive) {
      mat.blending = additive
      mat.needsUpdate = true
    }
    mat.opacity += (palette.particleOpacity - mat.opacity) * k
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.042}
        vertexColors
        transparent
        opacity={0.38}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}