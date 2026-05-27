// ---------------------------------------------------------------------------
// useKeyboard.js
// ---------------------------------------------------------------------------
// Owns keyboard input. Continuous controls (pitch/roll/yaw/throttle/brakes)
// are exposed as the live set of currently-pressed keys, which the flight loop
// samples every physics step. Discrete actions (cycle flaps, toggle gear,
// switch view, etc.) fire once on key-down and either mutate the shared
// controls ref or call a store action.
//
// Returns a ref whose `.current` is the controls object the flight loop reads.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { soundManager } from '../audio/SoundManager.js'
import { FLAP_SETTINGS } from '../physics/constants.js'

const FLAP_DETENTS = FLAP_SETTINGS.map((f) => f.deg) // [0, 5, 15, 30]

export function useKeyboard() {
  const controls = useRef({
    keys: new Set(),
    flapTargetDeg: 5, // spawn with flaps 5
    gearDown: true,
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      // The first keypress is our user gesture to unlock audio.
      soundManager.init()

      controls.current.keys.add(e.code)

      // Discrete, one-shot actions (ignore auto-repeat).
      if (e.repeat) return
      const store = useGameStore.getState()
      switch (e.code) {
        case 'KeyF': {
          // Cycle flaps up through the detents and wrap back to 0.
          const cur = controls.current.flapTargetDeg
          const idx = FLAP_DETENTS.indexOf(cur)
          const next = FLAP_DETENTS[(idx + 1) % FLAP_DETENTS.length]
          controls.current.flapTargetDeg = next
          soundManager.playFlaps()
          break
        }
        case 'KeyG':
          controls.current.gearDown = !controls.current.gearDown
          soundManager.playGear()
          break
        case 'KeyV':
          store.toggleView()
          break
        case 'KeyH':
          store.toggleControls()
          break
        case 'KeyM':
          store.toggleMouseLook()
          break
        case 'KeyO':
          store.toggleSettings()
          break
        case 'KeyR':
          store.requestReset()
          break
        default:
          break
      }
    }

    const onKeyUp = (e) => {
      controls.current.keys.delete(e.code)
    }

    // If the window loses focus, drop all held keys so nothing sticks "on".
    const onBlur = () => controls.current.keys.clear()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return controls
}
