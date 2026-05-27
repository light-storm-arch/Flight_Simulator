// ---------------------------------------------------------------------------
// instruments.js
// ---------------------------------------------------------------------------
// Turn the raw SI rigid-body state into the numbers a pilot actually reads:
// knots, feet, ft/min, compass degrees, pitch and bank angles. This is the
// single place where we cross from "physics units" to "cockpit units", which
// keeps the conversion factors out of the rest of the code.
// ---------------------------------------------------------------------------

import * as THREE from 'three'
import {
  MS_TO_KNOTS,
  M_TO_FEET,
  MS_TO_FPM,
  RAD_TO_DEG,
  STALL_AOA,
  STALL_WARNING_MARGIN,
} from './constants.js'

const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const FORWARD = new THREE.Vector3(0, 0, -1)
const RIGHT = new THREE.Vector3(1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Derive display instruments from the aircraft state.
 * @param {object} s aircraft state
 * @param {(x:number,z:number)=>number} groundHeightAt terrain sampler for AGL
 * @returns {object} flat object of display-ready values
 */
export function getInstruments(s, groundHeightAt) {
  // Body axes expressed in world space, used for attitude.
  _fwd.copy(FORWARD).applyQuaternion(s.orientation)
  _right.copy(RIGHT).applyQuaternion(s.orientation)
  _up.copy(UP).applyQuaternion(s.orientation)

  // Heading: compass angle of the nose, 0 = north (-Z), increasing clockwise
  // toward east (+X). Normalised to [0, 360).
  let headingDeg = Math.atan2(_fwd.x, -_fwd.z) * RAD_TO_DEG
  if (headingDeg < 0) headingDeg += 360

  // Pitch: how far the nose is above the horizon.
  const pitchDeg = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1)) * RAD_TO_DEG
  // Bank: roll angle, positive to the right (right wing down).
  const bankDeg = Math.atan2(-_right.y, _up.y) * RAD_TO_DEG

  const groundY = groundHeightAt ? groundHeightAt(s.position.x, s.position.z) : 0

  return {
    airspeedKnots: s.airspeed * MS_TO_KNOTS,
    altitudeFeet: s.position.y * M_TO_FEET, // MSL
    altitudeAglFeet: (s.position.y - groundY) * M_TO_FEET,
    verticalSpeedFpm: s.verticalSpeed * MS_TO_FPM,
    headingDeg,
    pitchDeg,
    bankDeg,
    aoaDeg: s.aoa * RAD_TO_DEG,
    throttlePct: s.throttle * 100,
    flapDeg: Math.round(s.flapDeg),
    flapTargetDeg: Math.round(s.flapTargetDeg),
    gearDown: s.gearDown,
    gearPosition: s.gearPosition,
    brakes: s.brakes,
    onGround: s.onGround,
    stalled: s.stalled,
    // Stall warning trips a little before the actual stall, like a real
    // stick-shaker, so you get an audible/visual cue with time to react.
    stallWarning: s.aoa > STALL_AOA - STALL_WARNING_MARGIN,
  }
}
