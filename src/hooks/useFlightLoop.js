// ---------------------------------------------------------------------------
// useFlightLoop.js
// ---------------------------------------------------------------------------
// The beating heart of the simulator. Runs inside the R3F render loop and:
//   1. Steps the physics at a FIXED 60 Hz (decoupled from the render rate) so
//      the integration stays stable regardless of frame rate.
//   2. Builds the wind (steady crosswind + smoothed turbulence gusts).
//   3. Writes the aircraft transform onto the 3D model.
//   4. Drives the camera (smooth chase cam, or rigid cockpit with mouse-look).
//   5. Pushes a throttled instrument snapshot to the store and updates audio.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createAircraftState, stepAircraft } from '../physics/aircraft.js'
import { getInstruments } from '../physics/instruments.js'
import { heightAt } from '../world/terrain.js'
import { useGameStore } from '../store/gameStore.js'
import { soundManager } from '../audio/SoundManager.js'
import { PHYSICS_DT, MAX_FRAME_DT, THROTTLE_RATE, KNOTS_TO_MS } from '../physics/constants.js'

// Camera placement offsets, expressed in the aircraft's body frame.
const CHASE_OFFSET = new THREE.Vector3(0, 7, 32) // up and behind (+Z is aft)
const COCKPIT_OFFSET = new THREE.Vector3(0, 1.6, -9.5) // pilot's eye, near the nose

export function useFlightLoop(aircraftRef, controls) {
  const { camera } = useThree()

  const state = useRef(createAircraftState(heightAt))
  const accumulator = useRef(0)
  const lastReset = useRef(0)
  const hudTimer = useRef(0)
  const firstFrame = useRef(true)
  const gust = useRef(new THREE.Vector3())
  const look = useRef({ yaw: 0, pitch: 0 })

  // Scratch objects (avoid per-frame allocation).
  const wind = useRef(new THREE.Vector3())
  const tmpOffset = useRef(new THREE.Vector3())
  const tmpTarget = useRef(new THREE.Vector3())
  const tmpLookAt = useRef(new THREE.Vector3())
  const lookQuat = useRef(new THREE.Quaternion())
  const lookEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  // --- Mouse-look (cockpit free-look via pointer lock) --------------------
  useEffect(() => {
    const dom = camera ? document.querySelector('canvas') : null
    if (!dom) return
    const onClick = () => {
      if (useGameStore.getState().mouseLook && document.pointerLockElement !== dom) {
        dom.requestPointerLock?.()
      }
    }
    const onMove = (e) => {
      if (!useGameStore.getState().mouseLook) return
      if (document.pointerLockElement !== dom) return
      look.current.yaw -= e.movementX * 0.0025
      look.current.pitch -= e.movementY * 0.0025
      look.current.yaw = THREE.MathUtils.clamp(look.current.yaw, -Math.PI * 0.75, Math.PI * 0.75)
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch, -1.2, 1.2)
    }
    dom.addEventListener('click', onClick)
    document.addEventListener('mousemove', onMove)
    return () => {
      dom.removeEventListener('click', onClick)
      document.removeEventListener('mousemove', onMove)
    }
  }, [camera])

  useFrame((_, delta) => {
    const s = state.current
    const store = useGameStore.getState()

    // --- Respawn if a reset was requested -------------------------------
    if (store.resetNonce !== lastReset.current) {
      lastReset.current = store.resetNonce
      state.current = createAircraftState(heightAt)
      look.current.yaw = 0
      look.current.pitch = 0
      firstFrame.current = true
      return
    }

    // --- Build the wind for this frame ----------------------------------
    const settings = store.settings
    // Steady crosswind: convert "blows FROM direction D" into a world vector
    // pointing the way the air actually moves (toward D + 180 degrees).
    const windSpeed = settings.crosswindKnots * KNOTS_TO_MS
    const dirRad = ((settings.crosswindDir + 180) * Math.PI) / 180
    wind.current.set(Math.sin(dirRad) * windSpeed, 0, -Math.cos(dirRad) * windSpeed)
    // Turbulence: a smoothly wandering gust vector scaled by the slider.
    const turb = settings.turbulence
    if (turb > 0) {
      const maxGust = turb * 9 // m/s at full turbulence
      gust.current.x += ((Math.random() * 2 - 1) * maxGust - gust.current.x) * 0.04
      gust.current.y += ((Math.random() * 2 - 1) * maxGust * 0.6 - gust.current.y) * 0.04
      gust.current.z += ((Math.random() * 2 - 1) * maxGust - gust.current.z) * 0.04
      wind.current.add(gust.current)
    }
    const env = { wind: wind.current, groundHeightAt: heightAt }

    // --- Fixed-timestep physics -----------------------------------------
    // Accumulate real time and consume it in constant 1/60 s chunks. Clamp the
    // frame delta so a stutter (or a backgrounded tab) can't spiral the sim.
    accumulator.current += Math.min(delta, MAX_FRAME_DT)
    let steps = 0
    while (accumulator.current >= PHYSICS_DT && steps < 8) {
      const k = controls.current.keys
      // Continuous controls from currently-held keys.
      const pitch = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0) // S = nose up, W = nose down
      const roll = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) // D = roll right
      const yaw = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0) // E = yaw right
      const brakes = k.has('KeyB')
      let throttle = s.throttle
      if (k.has('ShiftLeft') || k.has('ShiftRight')) throttle += THROTTLE_RATE * PHYSICS_DT
      if (k.has('ControlLeft') || k.has('ControlRight')) throttle -= THROTTLE_RATE * PHYSICS_DT

      stepAircraft(s, PHYSICS_DT, {
        pitch,
        roll,
        yaw,
        throttle,
        flapTargetDeg: controls.current.flapTargetDeg,
        gearDown: controls.current.gearDown,
        brakes,
      }, env)

      accumulator.current -= PHYSICS_DT
      steps++
    }

    // --- Write the transform onto the 3D model --------------------------
    if (aircraftRef.current) {
      aircraftRef.current.position.copy(s.position)
      aircraftRef.current.quaternion.copy(s.orientation)
    }

    // --- Camera ---------------------------------------------------------
    const smoothing = 1 - Math.exp(-6 * Math.min(delta, MAX_FRAME_DT))
    if (store.viewMode === 'cockpit') {
      // Rigidly attached to the seat; the head can pan around with the mouse.
      tmpOffset.current.copy(COCKPIT_OFFSET).applyQuaternion(s.orientation)
      camera.position.copy(s.position).add(tmpOffset.current)
      lookEuler.current.set(look.current.pitch, look.current.yaw, 0)
      lookQuat.current.setFromEuler(lookEuler.current)
      camera.quaternion.copy(s.orientation).multiply(lookQuat.current)
    } else {
      // Chase cam: ease toward a point up and behind the aircraft.
      tmpOffset.current.copy(CHASE_OFFSET).applyQuaternion(s.orientation)
      tmpTarget.current.copy(s.position).add(tmpOffset.current)
      // Decay any mouse-look angle back to centre when not in the cockpit.
      look.current.yaw *= 0.9
      look.current.pitch *= 0.9
      if (firstFrame.current) {
        camera.position.copy(tmpTarget.current)
      } else {
        camera.position.lerp(tmpTarget.current, smoothing)
      }
      tmpLookAt.current.copy(s.position)
      tmpLookAt.current.y += 2
      camera.lookAt(tmpLookAt.current)
    }
    firstFrame.current = false

    // --- Audio (every frame) --------------------------------------------
    soundManager.setEngine(s.throttle)
    soundManager.setWind(s.airspeed)

    // --- Throttled instrument snapshot (~20 Hz) -------------------------
    hudTimer.current += delta
    const instruments = getInstruments(s, heightAt)
    soundManager.setStall(instruments.stallWarning)
    if (hudTimer.current >= 0.05) {
      hudTimer.current = 0
      store.updateHud(instruments)
    }
  })
}
