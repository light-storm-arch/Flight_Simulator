// ---------------------------------------------------------------------------
// Aircraft.jsx
// ---------------------------------------------------------------------------
// A deliberately simple 737-ish airframe made of primitives: a cylinder
// fuselage, swept wings, tail surfaces, two underwing engines, and animated
// landing gear and flaps. The whole group's world position/orientation is
// written every frame by the flight loop (via the forwarded ref); only the
// gear and flap sub-parts animate locally here, reading their state from the
// throttled HUD snapshot so we don't trigger React re-renders.
//
// Body convention: the nose points along -Z, wings span X, up is +Y. A bare
// Three.js cylinder runs along Y, so the fuselage/engines are rotated 90deg
// about X to lie along Z.
// ---------------------------------------------------------------------------

import { forwardRef, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store/gameStore.js'

const SWEEP = 0.42 // wing sweep angle, radians

// One landing-gear leg (strut + wheel), built hanging downward from its group
// origin so it can be retracted by scaling the group's height toward zero.
function GearLeg({ position, refObj }) {
  return (
    <group position={position} ref={refObj}>
      <mesh position={[0, -1.4, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 2.8, 8]} />
        <meshStandardMaterial color="#23262b" />
      </mesh>
      <mesh position={[0, -2.8, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.45, 16]} />
        <meshStandardMaterial color="#111316" />
      </mesh>
    </group>
  )
}

const Aircraft = forwardRef(function Aircraft({ children, ...props }, ref) {
  const noseGear = useRef()
  const leftGear = useRef()
  const rightGear = useRef()
  const leftFlap = useRef()
  const rightFlap = useRef()

  // Animate gear extension and flap deflection from the latest HUD snapshot.
  useFrame(() => {
    const hud = useGameStore.getState().hud
    const g = Math.max(0.001, hud.gearPosition)
    for (const leg of [noseGear, leftGear, rightGear]) {
      if (leg.current) {
        leg.current.scale.y = g
        leg.current.visible = hud.gearPosition > 0.02
      }
    }
    const flapRad = (hud.flapDeg * Math.PI) / 180
    if (leftFlap.current) leftFlap.current.rotation.x = flapRad
    if (rightFlap.current) rightFlap.current.rotation.x = flapRad
  })

  return (
    <group ref={ref} {...props}>
      {/* Fuselage (cylinder rotated to lie along Z) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[1.9, 1.9, 34, 20]} />
        <meshStandardMaterial color="#eef1f5" metalness={0.1} roughness={0.6} />
      </mesh>
      {/* Nose cone (-Z) */}
      <mesh position={[0, 0, -18]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[1.9, 4, 20]} />
        <meshStandardMaterial color="#dfe4ea" metalness={0.1} roughness={0.6} />
      </mesh>
      {/* Tail cone (+Z) */}
      <mesh position={[0, 0.4, 18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[1.9, 5, 20]} />
        <meshStandardMaterial color="#dfe4ea" metalness={0.1} roughness={0.6} />
      </mesh>

      {/* Main wings: a swept box per side, pivoting at the centreline */}
      <group position={[0, -0.6, 1]}>
        <mesh position={[8.5, 0, 0]} rotation={[0, -SWEEP, 0.04]} castShadow>
          <boxGeometry args={[17, 0.5, 4.5]} />
          <meshStandardMaterial color="#c7ced6" metalness={0.1} roughness={0.7} />
        </mesh>
        <mesh position={[-8.5, 0, 0]} rotation={[0, SWEEP, -0.04]} castShadow>
          <boxGeometry args={[17, 0.5, 4.5]} />
          <meshStandardMaterial color="#c7ced6" metalness={0.1} roughness={0.7} />
        </mesh>
        {/* Trailing-edge flaps (rotate down with flap setting) */}
        <group position={[8.5, -0.1, 2.6]} ref={rightFlap}>
          <mesh position={[0, 0, 0.6]} castShadow>
            <boxGeometry args={[12, 0.25, 1.4]} />
            <meshStandardMaterial color="#aeb6bf" roughness={0.8} />
          </mesh>
        </group>
        <group position={[-8.5, -0.1, 2.6]} ref={leftFlap}>
          <mesh position={[0, 0, 0.6]} castShadow>
            <boxGeometry args={[12, 0.25, 1.4]} />
            <meshStandardMaterial color="#aeb6bf" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* Horizontal stabiliser */}
      <mesh position={[0, 0.8, 16]} rotation={[0, -SWEEP * 0.8, 0]} castShadow>
        <boxGeometry args={[13, 0.4, 3]} />
        <meshStandardMaterial color="#c7ced6" roughness={0.7} />
      </mesh>
      {/* Vertical stabiliser */}
      <mesh position={[0, 3.5, 16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 3.5, 5.5]} />
        <meshStandardMaterial color="#c7ced6" roughness={0.7} />
      </mesh>

      {/* Engines (nacelles) slung under and ahead of the wings */}
      <mesh position={[6.5, -2.4, -1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[1.25, 1.25, 4.5, 16]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[-6.5, -2.4, -1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[1.25, 1.25, 4.5, 16]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* Landing gear: nose leg + two main legs */}
      <GearLeg position={[0, -1.9, -11]} refObj={noseGear} />
      <GearLeg position={[3.4, -1.9, 2]} refObj={rightGear} />
      <GearLeg position={[-3.4, -1.9, 2]} refObj={leftGear} />

      {/* Optional interior (cockpit), rendered as a child so it inherits the
          airframe's world transform. */}
      {children}
    </group>
  )
})

export default Aircraft
