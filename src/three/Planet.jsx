import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import ParticleField from './ParticleField'
import { getScenePalette } from './scenePalette'

const RINGS = [
  {
    radius: 1.45,
    tube: 0.014,
    rotation: [1.35, 0.2, 0.1],
    color: '#a78bfa',
    opacity: 0.32,
    spin: 0.05,
  },
  {
    radius: 1.62,
    tube: 0.012,
    rotation: [1.15, -0.25, 0.42],
    color: '#38bdf8',
    opacity: 0.25,
    spin: -0.035,
  },
  {
    radius: 1.8,
    tube: 0.01,
    rotation: [1.42, 0.3, -0.18],
    color: '#818cf8',
    opacity: 0.2,
    spin: 0.025,
  },
]

const SATELLITES = [
  { radius: 1.36, speed: 0.1, offset: 0, y: 0.12, size: 0.07 },
  { radius: 1.54, speed: -0.07, offset: 2.2, y: -0.18, size: 0.055 },
  { radius: 1.72, speed: 0.05, offset: 4.4, y: 0.2, size: 0.045 },
]

/**
 * The hero planet: dark purple/blue sphere with a soft emissive glow, a
 * subtle low-poly wireframe shell with a few glowing nodes, a small bright
 * core, three thin full orbit rings and three tiny satellites. Everything
 * animates in useFrame on refs — no React state, no per-frame allocations,
 * one draw call per element. Theme switches are applied imperatively inside
 * useFrame (colors/opacities smoothly lerp toward the active palette, and
 * additive blending is swapped to normal blending in light mode), so the
 * scene never re-renders. `dim` lowers opacity for small screens so the
 * object stays decorative, never dominant.
 */
export default function Planet({
  particles = 220,
  scale = 1,
  position = [2.9, 0.35, 0],
  pointerTarget = null,
  parallax = true,
  reduced = false,
  dim = false,
}) {
  const outer = useRef(null)
  const spin = useRef(null)
  const shell = useRef(null)
  const ringRefs = useRef([])
  const satRefs = useRef([])
  const surfaceMat = useRef(null)
  const coreMat = useRef(null)
  const hotMat = useRef(null)
  const shellMat = useRef(null)
  const nodesMat = useRef(null)
  const haloMat = useRef(null)
  const ringMats = useRef([])
  const satMats = useRef([])

  const surfaceGeometry = useMemo(() => new THREE.SphereGeometry(1.1, 32, 24), [])
  const coreGeometry = useMemo(() => new THREE.SphereGeometry(0.4, 16, 12), [])
  const hotGeometry = useMemo(() => new THREE.SphereGeometry(0.16, 12, 8), [])
  const shellGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.22, 1), [])
  const haloGeometry = useMemo(() => new THREE.SphereGeometry(1.55, 24, 16), [])
  const satelliteGeometry = useMemo(() => new THREE.OctahedronGeometry(0.09, 0), [])
  const ringGeometries = useMemo(
    () => RINGS.map((ring) => new THREE.TorusGeometry(ring.radius, ring.tube, 8, 96)),
    []
  )

  const nodes = useMemo(() => {
    const count = Math.min(28, Math.max(14, Math.round(particles * 0.12)))
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = [new THREE.Color('#8b5cf6'), new THREE.Color('#38bdf8')]
    const temp = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.18 + Math.random() * 0.08

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      temp.copy(palette[i % palette.length])
      temp.multiplyScalar(0.5 + Math.random() * 0.35)
      colors[i * 3] = temp.r
      colors[i * 3 + 1] = temp.g
      colors[i * 3 + 2] = temp.b
    }
    return { positions, colors }
  }, [particles])

  useFrame((state, delta) => {
    const o = outer.current
    const s = spin.current
    if (!o || !s) return

    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const target = pointerTarget?.current ?? { x: 0, y: 0 }
    const damp = Math.min(dt * 2.5, 1)

    const px = reduced || !parallax ? 0 : target.x * 0.16
    o.position.x += (position[0] + px - o.position.x) * damp
    o.position.y =
      position[1] + (reduced ? 0 : Math.sin(t * 0.45) * 0.08)

    s.rotation.y += dt * 0.09
    if (shell.current) {
      shell.current.rotation.y -= dt * 0.045
      shell.current.rotation.x += dt * 0.02
    }

    ringRefs.current.forEach((ring, i) => {
      if (ring) ring.rotation.z += dt * RINGS[i].spin
    })

    SATELLITES.forEach((sat, i) => {
      const mesh = satRefs.current[i]
      if (!mesh) return
      const a = t * sat.speed + sat.offset
      mesh.position.set(
        Math.cos(a) * sat.radius,
        sat.y + Math.sin(t * 0.6 + i * 1.4) * 0.05,
        Math.sin(a) * sat.radius
      )
      mesh.rotation.y = t * sat.speed * 2
    })

    const p = getScenePalette()
    const k = Math.min(dt * 2.2, 1)
    const blendTarget = p.additive ? THREE.AdditiveBlending : THREE.NormalBlending

    const surface = surfaceMat.current
    if (surface) {
      surface.color.lerp(p.surface, k)
      surface.emissive.lerp(p.emissive, k)
      surface.emissiveIntensity += (p.emissiveIntensity - surface.emissiveIntensity) * k
    }

    const core = coreMat.current
    if (core) {
      core.color.lerp(p.core, k)
      core.opacity += (p.coreOpacity - core.opacity) * k
      swapBlend(core, blendTarget)
    }

    const hot = hotMat.current
    if (hot) {
      hot.color.lerp(p.hot, k)
      hot.opacity += (p.hotOpacity - hot.opacity) * k
      swapBlend(hot, blendTarget)
    }

    const shellMat_ = shellMat.current
    if (shellMat_) {
      shellMat_.color.lerp(p.shell, k)
      shellMat_.opacity += (p.shellOpacity - shellMat_.opacity) * k
    }

    const nodesMat_ = nodesMat.current
    if (nodesMat_) {
      nodesMat_.opacity += (p.nodeOpacity - nodesMat_.opacity) * k
      swapBlend(nodesMat_, blendTarget)
    }

    const halo = haloMat.current
    if (halo) {
      halo.color.lerp(p.halo, k)
      halo.opacity += (p.haloOpacity - halo.opacity) * k
      swapBlend(halo, blendTarget)
    }

    ringMats.current.forEach((ring, i) => {
      if (!ring || !p.ringColors[i]) return
      ring.color.lerp(p.ringColors[i], k)
      ring.opacity += (p.ringOpacities[i] - ring.opacity) * k
    })

    satMats.current.forEach((sat) => {
      if (!sat) return
      sat.color.lerp(p.satBody, k)
      sat.emissive.lerp(p.satEmissive, k)
    })
  })

  const dimFactor = dim ? 0.75 : 1

  return (
    <group ref={outer} position={position} scale={scale}>
      <group ref={spin}>
        <mesh geometry={surfaceGeometry}>
          <meshStandardMaterial
            ref={surfaceMat}
            color="#161b42"
            metalness={0.55}
            roughness={0.4}
            emissive="#4338ca"
            emissiveIntensity={0.22}
          />
        </mesh>

        <mesh geometry={coreGeometry}>
          <meshBasicMaterial
            ref={coreMat}
            color="#a78bfa"
            transparent
            opacity={0.45 * dimFactor}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <mesh geometry={hotGeometry}>
          <meshBasicMaterial
            ref={hotMat}
            color="#e0e7ff"
            transparent
            opacity={0.85 * dimFactor}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <mesh ref={shell} geometry={shellGeometry}>
          <meshBasicMaterial
            ref={shellMat}
            color="#7dd3fc"
            wireframe
            transparent
            opacity={0.12 * dimFactor}
            depthWrite={false}
          />
        </mesh>

        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[nodes.positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[nodes.colors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={nodesMat}
            size={0.04}
            vertexColors
            transparent
            opacity={0.7 * dimFactor}
            depthWrite={false}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
          />
        </points>

        <mesh geometry={haloGeometry}>
          <meshBasicMaterial
            ref={haloMat}
            color="#6d28d9"
            transparent
            opacity={0.05 * dimFactor}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {RINGS.map((ring, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el
          }}
          geometry={ringGeometries[i]}
          rotation={ring.rotation}
        >
          <meshBasicMaterial
            ref={(el) => {
              ringMats.current[i] = el
            }}
            color={ring.color}
            transparent
            opacity={ring.opacity * dimFactor}
            depthWrite={false}
          />
        </mesh>
      ))}

      {SATELLITES.map((sat, i) => (
        <mesh
          key={i}
          ref={(el) => {
            satRefs.current[i] = el
          }}
          geometry={satelliteGeometry}
          scale={sat.size / 0.09}
        >
          <meshStandardMaterial
            ref={(el) => {
              satMats.current[i] = el
            }}
            color="#2e2a6e"
            emissive="#a78bfa"
            emissiveIntensity={1.2}
            roughness={0.3}
            metalness={0.5}
          />
        </mesh>
      ))}

      <pointLight color="#8b5cf6" intensity={1.3} distance={8} decay={2} />
      <pointLight
        color="#38bdf8"
        intensity={0.5}
        distance={6}
        decay={2}
        position={[1.6, 1.2, 0.6]}
      />

      <ParticleField count={particles} />
    </group>
  )
}

function swapBlend(mat, target) {
  if (mat.blending !== target) {
    mat.blending = target
    mat.needsUpdate = true
  }
}