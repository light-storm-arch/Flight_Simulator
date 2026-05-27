// ---------------------------------------------------------------------------
// App.jsx
// ---------------------------------------------------------------------------
// Top-level composition: the 3D <Canvas> (sky, terrain, runway, aircraft and
// the flight-loop runner) plus the 2D overlays (HUD, controls help, settings,
// and a small toolbar). Keyboard input is set up here and the shared controls
// ref is handed to the flight loop inside the canvas.
// ---------------------------------------------------------------------------

import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import Sky from './world/Sky.jsx'
import Terrain from './world/Terrain.jsx'
import Runway from './world/Runway.jsx'
import Aircraft from './aircraft/Aircraft.jsx'
import Cockpit from './aircraft/Cockpit.jsx'
import HUD from './ui/HUD.jsx'
import ControlsHelp from './ui/ControlsHelp.jsx'
import SettingsPanel from './ui/SettingsPanel.jsx'
import { useKeyboard } from './hooks/useKeyboard.js'
import { useFlightLoop } from './hooks/useFlightLoop.js'
import { useGameStore } from './store/gameStore.js'
import { soundManager } from './audio/SoundManager.js'

// Everything that lives INSIDE the R3F canvas. Created here so the flight loop
// (which needs useThree/useFrame) can share the aircraft ref with the model.
function Scene({ controls }) {
  const aircraftRef = useRef()
  const viewMode = useGameStore((s) => s.viewMode)
  useFlightLoop(aircraftRef, controls)

  return (
    <>
      <Sky />
      <Terrain />
      <Runway />
      <Aircraft ref={aircraftRef}>{viewMode === 'cockpit' && <Cockpit />}</Aircraft>
    </>
  )
}

// Small clickable toolbar so the sim is fully usable without memorising keys.
function Toolbar() {
  const toggleView = useGameStore((s) => s.toggleView)
  const toggleMouseLook = useGameStore((s) => s.toggleMouseLook)
  const toggleControls = useGameStore((s) => s.toggleControls)
  const toggleSettings = useGameStore((s) => s.toggleSettings)
  const requestReset = useGameStore((s) => s.requestReset)
  const viewMode = useGameStore((s) => s.viewMode)
  const mouseLook = useGameStore((s) => s.mouseLook)

  const buttons = [
    [viewMode === 'cockpit' ? 'Cockpit (V)' : 'Chase (V)', toggleView],
    [mouseLook ? 'Look: on (M)' : 'Look: off (M)', toggleMouseLook],
    ['Help (H)', toggleControls],
    ['Weather (O)', toggleSettings],
    ['Reset (R)', requestReset],
  ]

  return (
    <div style={toolbarStyles.bar}>
      {buttons.map(([label, fn]) => (
        <button key={label} style={toolbarStyles.btn} onClick={fn}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const controls = useKeyboard()

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} onPointerDown={() => soundManager.init()}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 65, near: 0.5, far: 40000, position: [0, 60, 220] }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#aacbe6'))
        }}
      >
        <Scene controls={controls} />
      </Canvas>

      <HUD />
      <ControlsHelp />
      <SettingsPanel />
      <Toolbar />
    </div>
  )
}

const toolbarStyles = {
  bar: {
    position: 'absolute',
    top: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 8,
    pointerEvents: 'auto',
  },
  btn: {
    background: 'rgba(8, 13, 22, 0.6)',
    border: '1px solid rgba(120, 160, 200, 0.3)',
    color: '#dff1ff',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    cursor: 'pointer',
  },
}
