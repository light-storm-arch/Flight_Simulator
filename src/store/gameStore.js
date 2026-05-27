// ---------------------------------------------------------------------------
// gameStore.js
// ---------------------------------------------------------------------------
// Zustand store for UI / settings / display state — the things React needs to
// re-render on. The heavy 60 Hz rigid-body state deliberately lives OUTSIDE
// the store (in a ref inside the flight loop) so the physics never triggers
// React renders. The loop pushes a small, throttled snapshot of display values
// into `hud` here for the instruments to read.
// ---------------------------------------------------------------------------

import { create } from 'zustand'

const initialHud = {
  airspeedKnots: 0,
  altitudeFeet: 0,
  altitudeAglFeet: 0,
  verticalSpeedFpm: 0,
  headingDeg: 0,
  pitchDeg: 0,
  bankDeg: 0,
  aoaDeg: 0,
  throttlePct: 0,
  flapDeg: 5,
  flapTargetDeg: 5,
  gearDown: true,
  gearPosition: 1,
  brakes: false,
  onGround: true,
  stalled: false,
  stallWarning: false,
}

export const useGameStore = create((set) => ({
  // --- camera / view ---
  viewMode: 'chase', // 'chase' | 'cockpit'
  mouseLook: false, // cockpit free-look on/off

  // --- UI panels ---
  showControls: true, // on-screen control reference
  showSettings: false, // weather/settings panel

  // --- weather settings (all "off" / calm by default) ---
  settings: {
    turbulence: 0, // 0..1 (slider is 0..100%)
    crosswindKnots: 0, // 0..30
    crosswindDir: 270, // degrees the wind blows FROM (270 = from the west)
    visibility: 'clear', // 'clear' | 'hazy' | 'low'
  },

  // --- reset signal: bump to ask the flight loop to respawn ---
  resetNonce: 0,

  // --- throttled snapshot of cockpit instruments ---
  hud: initialHud,

  // --- actions ---
  toggleView: () => set((s) => ({ viewMode: s.viewMode === 'chase' ? 'cockpit' : 'chase' })),
  toggleMouseLook: () => set((s) => ({ mouseLook: !s.mouseLook })),
  toggleControls: () => set((s) => ({ showControls: !s.showControls })),
  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  requestReset: () => set((s) => ({ resetNonce: s.resetNonce + 1 })),
  updateHud: (hud) => set({ hud }),
}))
