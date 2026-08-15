import { memo, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import Planet from './Planet'
import { getScenePalette } from './scenePalette'

/**
 * Hero 3D scene. The planet sits on the right side of the section on
 * landscape screens and in the top-right corner above the content on
 * portrait screens, so it never covers the hero text. Rendering pauses when
 * the tab is hidden, the section is scrolled out of view, or the user
 * prefers reduced motion. DPR is adaptive (PerformanceMonitor + AdaptiveDpr)
 * and antialiasing is disabled on small screens.
 *
 * The scene background/fog follow the active theme. They are updated
 * imperatively inside useFrame (smooth lerp toward the palette), so theme
 * switches never re-render or remount the WebGL scene. The component is
 * memoized so language changes elsewhere in the app skip it entirely.
 */
const TIERS = {
  xl: { scale: 1, position: [2.9, 0.35, 0], particles: 220, spread: 3.0, dim: false },
  lg: { scale: 0.85, position: [2.6, 0.3, 0], particles: 180, spread: 2.6, dim: false },
  sm: { scale: 0.45, position: [2.3, 2.9, 0], particles: 120, spread: 2.0, dim: true },
  tablet: { scale: 0.28, position: [2.0, 3.05, 0], particles: 90, spread: 1.6, dim: true },
  phone: { scale: 0.28, position: [2.0, 3.05, 0], particles: 60, spread: 1.6, dim: true },
}

function getTier() {
  const w = window.innerWidth
  const h = window.innerHeight
  if (h > w) return w < 640 ? 'phone' : 'tablet'
  if (w >= 1440) return 'xl'
  if (w >= 1024) return 'lg'
  return 'sm'
}

/**
 * Keeps the WebGL scene background and fog in sync with the active theme.
 * No React state — mutates the scene graph directly in useFrame.
 */
function SceneThemeBridge() {
  const scene = useThree((s) => s.scene)
  const ready = useRef(false)

  useFrame(() => {
    const palette = getScenePalette()
    if (!ready.current) {
      ready.current = true
      scene.background = palette.background.clone()
      scene.fog = new THREE.Fog(palette.fog.clone(), 10, 20)
    }
    scene.background.lerp(palette.background, 0.06)
    if (scene.fog) scene.fog.color.lerp(palette.fog, 0.06)
  })

  return null
}

function HeroScene() {
  const containerRef = useRef(null)
  const pointerTarget = useRef({ x: 0, y: 0 })
  const [tier, setTier] = useState(() => getTier())
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [hidden, setHidden] = useState(false)
  const [inView, setInView] = useState(true)

  const isSmall = tier === 'phone' || tier === 'tablet' || tier === 'sm'
  const config = TIERS[tier]
  const active = !reduced && !hidden && inView

  useEffect(() => {
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onReduce = (e) => setReduced(e.matches)
    const onVisibility = () => setHidden(document.hidden)
    const onPointerMove = (e) => {
      pointerTarget.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointerTarget.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }

    let rafId = 0
    const onResize = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setTier(getTier()))
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 }
    )
    if (containerRef.current) observer.observe(containerRef.current)

    mqReduce.addEventListener('change', onReduce)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      mqReduce.removeEventListener('change', onReduce)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const parallax =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches && !isSmall && !reduced

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Canvas
        dpr={isSmall ? [1, 1.25] : [1, 1.5]}
        gl={{
          antialias: !isSmall,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0, 8.5], fov: 42 }}
        frameloop={active ? 'always' : 'demand'}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <SceneThemeBridge />
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 6, 3]} intensity={0.9} />
        <PerformanceMonitor>
          <AdaptiveDpr pixelated={isSmall} />
          <Planet
            particles={config.particles}
            scale={config.scale}
            position={config.position}
            pointerTarget={pointerTarget}
            parallax={parallax}
            reduced={reduced}
            dim={config.dim}
          />
        </PerformanceMonitor>
      </Canvas>
    </div>
  )
}

export default memo(HeroScene)