// ---------------------------------------------------------------------------
// Cockpit.jsx
// ---------------------------------------------------------------------------
// A minimal first-person cockpit interior: glareshield, instrument panel,
// centre pedestal and window frame posts. It is rendered as a child of the
// aircraft group (so it tracks the airframe automatically) and is only
// mounted in cockpit view. The live instrument READOUTS are drawn by the HUD
// overlay; this geometry is here for the sense of sitting in the flight deck.
//
// Coordinates are in the aircraft body frame (nose toward -Z). The pilot's eye
// sits near (0, 1.6, -9.5); everything below is positioned just ahead of that.
// ---------------------------------------------------------------------------

const PANEL = '#1b1d22'
const FRAME = '#2c2f36'

export default function Cockpit() {
  return (
    <group>
      {/* Main instrument panel face */}
      <mesh position={[0, 0.55, -11.6]}>
        <boxGeometry args={[3.0, 1.1, 0.2]} />
        <meshStandardMaterial color={PANEL} roughness={0.9} />
      </mesh>
      {/* Glareshield hood above the panel */}
      <mesh position={[0, 1.15, -11.3]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[3.0, 0.18, 0.7]} />
        <meshStandardMaterial color={FRAME} roughness={0.9} />
      </mesh>
      {/* Centre pedestal (throttle quadrant area) */}
      <mesh position={[0, -0.15, -10.6]}>
        <boxGeometry args={[0.7, 0.5, 1.4]} />
        <meshStandardMaterial color={PANEL} roughness={0.9} />
      </mesh>
      {/* Window posts framing the forward view */}
      <mesh position={[1.55, 1.2, -10.8]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.18, 1.6, 0.18]} />
        <meshStandardMaterial color={FRAME} roughness={0.9} />
      </mesh>
      <mesh position={[-1.55, 1.2, -10.8]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.18, 1.6, 0.18]} />
        <meshStandardMaterial color={FRAME} roughness={0.9} />
      </mesh>
      {/* Centre window divider */}
      <mesh position={[0, 1.4, -11.0]}>
        <boxGeometry args={[0.12, 1.0, 0.12]} />
        <meshStandardMaterial color={FRAME} roughness={0.9} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 2.0, -10.0]}>
        <boxGeometry args={[3.2, 0.18, 3.0]} />
        <meshStandardMaterial color={FRAME} roughness={0.9} />
      </mesh>
      {/* Side walls */}
      <mesh position={[1.65, 1.0, -9.8]}>
        <boxGeometry args={[0.16, 2.0, 3.4]} />
        <meshStandardMaterial color={PANEL} roughness={0.9} />
      </mesh>
      <mesh position={[-1.65, 1.0, -9.8]}>
        <boxGeometry args={[0.16, 2.0, 3.4]} />
        <meshStandardMaterial color={PANEL} roughness={0.9} />
      </mesh>
    </group>
  )
}
