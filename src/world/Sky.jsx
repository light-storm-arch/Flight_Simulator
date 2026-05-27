// ---------------------------------------------------------------------------
// Sky.jsx
// ---------------------------------------------------------------------------
// Sky dome with a sun (drei's atmospheric Sky shader), the matching sunlight,
// and distance haze. Fog density is driven by the visibility setting, which is
// how the weather panel makes the world clear, hazy, or socked-in.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { Sky as DreiSky } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore.js'

// Sun direction (also used to aim the directional light so shading agrees with
// where the sun visibly sits in the sky).
const SUN = new THREE.Vector3(80, 60, 30)

// Exponential fog tuned per visibility setting. Higher density = thicker haze.
const FOG = {
  clear: { color: '#aacbe6', density: 0.00006 },
  hazy: { color: '#c2cdd6', density: 0.00028 },
  low: { color: '#b8bcc0', density: 0.0011 },
}

export default function Sky() {
  const scene = useThree((s) => s.scene)
  const visibility = useGameStore((s) => s.settings.visibility)

  useEffect(() => {
    const cfg = FOG[visibility] || FOG.clear
    scene.fog = new THREE.FogExp2(new THREE.Color(cfg.color), cfg.density)
    return () => {
      scene.fog = null
    }
  }, [scene, visibility])

  return (
    <>
      <DreiSky sunPosition={SUN} turbidity={6} rayleigh={2} mieCoefficient={0.005} mieDirectionalG={0.8} />
      <hemisphereLight args={['#bcd4ec', '#4a5a3a', 0.5]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={SUN} intensity={1.4} color="#fff6e6" />
    </>
  )
}
