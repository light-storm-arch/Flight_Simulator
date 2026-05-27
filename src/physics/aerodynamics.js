// ---------------------------------------------------------------------------
// aerodynamics.js
// ---------------------------------------------------------------------------
// Pure functions that turn the aircraft's motion through the air into forces
// and moments. Everything here is written out by hand from first principles
// so you can read it and understand WHY each term exists.
//
// BODY FRAME (matches the Three.js local axes of the aircraft model):
//     +X = right wing
//     +Y = up (toward the cockpit roof)
//     +Z = aft (toward the tail)   ->   the nose points along -Z
//
// The "relative wind" is the velocity of the aircraft through the air mass
// (its ground velocity minus the wind velocity), expressed in this body frame.
// ---------------------------------------------------------------------------

import * as THREE from 'three'
import {
  WING_AREA,
  WING_SPAN,
  MEAN_CHORD,
  ASPECT_RATIO,
  OSWALD_EFFICIENCY,
  CL0,
  CL_ALPHA,
  STALL_AOA,
  POST_STALL_SLOPE,
  CL_POST_STALL_FLOOR,
  CD0,
  CD_GEAR,
  CY_BETA,
  CN_BETA,
  CL_BETA,
  CM_ALPHA,
  CM_TRIM,
  ELEVATOR_AUTHORITY,
  AILERON_AUTHORITY,
  RUDDER_AUTHORITY,
  PITCH_DAMPING,
  ROLL_DAMPING,
  YAW_DAMPING,
} from './constants.js'

/**
 * Lift coefficient as a function of angle of attack.
 *
 * Below the critical angle the airflow stays attached and lift rises almost
 * linearly with AoA (this is the heart of "lift depends on angle of attack").
 * Past the critical angle the flow separates from the upper wing surface and
 * lift collapses — that's a stall. We model the collapse with a steep linear
 * drop down to a low floor so the nose drops but the wing doesn't behave like
 * it has literally zero lift.
 *
 * @param {number} alpha angle of attack, radians
 * @param {object} flap active flap detent ({ deltaCl, stallAoaDelta })
 * @returns {number} lift coefficient Cl (dimensionless)
 */
export function liftCoefficient(alpha, flap) {
  // Flaps add camber: more lift at a given AoA, but they also make the wing
  // stall at a LOWER angle of attack.
  const stallAoa = STALL_AOA + flap.stallAoaDelta
  const clLinear = CL0 + flap.deltaCl + CL_ALPHA * alpha

  if (alpha <= stallAoa && alpha >= -stallAoa) {
    // Attached flow: linear region (works for small negative AoA too).
    return clLinear
  }

  // Stalled. Take the lift we HAD at the critical angle and bleed it off as
  // AoA pushes further past the stall, never falling below a small floor.
  const over = Math.abs(alpha) - stallAoa
  const clAtStall = CL0 + flap.deltaCl + CL_ALPHA * stallAoa
  const collapsed = Math.max(CL_POST_STALL_FLOOR, clAtStall - POST_STALL_SLOPE * over)
  return alpha < 0 ? -collapsed : collapsed
}

/**
 * Drag coefficient = parasitic drag + induced drag.
 *
 *   - Parasitic drag (CD0) is the cost of pushing the aircraft's shape and
 *     skin through the air. Gear and flaps add to it.
 *   - Induced drag is the price you pay for making lift: Cd_i = Cl^2 / (pi*e*AR).
 *     It grows with the square of the lift coefficient, which is why dragging
 *     the nose up at low speed (high Cl) bleeds energy fast.
 *
 * @param {number} cl current lift coefficient
 * @param {object} flap active flap detent ({ deltaCd })
 * @param {boolean} gearDown landing gear extended?
 * @returns {number} drag coefficient Cd
 */
export function dragCoefficient(cl, flap, gearDown) {
  const parasitic = CD0 + flap.deltaCd + (gearDown ? CD_GEAR : 0)
  const induced = (cl * cl) / (Math.PI * OSWALD_EFFICIENCY * ASPECT_RATIO)
  return parasitic + induced
}

/**
 * Is the wing stalled at this angle of attack and flap setting?
 * @param {number} alpha angle of attack, radians
 * @param {object} flap active flap detent
 * @returns {boolean}
 */
export function isStalled(alpha, flap) {
  const stallAoa = STALL_AOA + flap.stallAoaDelta
  return Math.abs(alpha) > stallAoa
}

// Scratch vectors reused every step so the physics loop doesn't churn the GC.
const _dHat = new THREE.Vector3()
const _lift = new THREE.Vector3()
const _drag = new THREE.Vector3()
const _side = new THREE.Vector3()
const RIGHT_AXIS = new THREE.Vector3(1, 0, 0)

/**
 * Compute the aerodynamic force and moment in the BODY frame.
 *
 * Thrust and gravity are NOT included here — they are added in aircraft.js —
 * so this function is purely "what the air does to the wings and tail".
 *
 * @param {THREE.Vector3} relVelBody relative wind in body frame (m/s)
 * @param {THREE.Vector3} angVelBody angular velocity in body frame (rad/s),
 *        components are rotation rates about the local +X, +Y, +Z axes.
 * @param {number} rho air density (kg/m^3)
 * @param {object} controls { elevator, aileron, rudder, flap, gearDown }
 *        elevator/aileron/rudder are in [-1, 1].
 *        elevator +1 = nose up, aileron +1 = roll right, rudder +1 = yaw right.
 * @returns {{ force: THREE.Vector3, moment: THREE.Vector3, aoa: number,
 *             sideslip: number, airspeed: number, cl: number, stalled: boolean }}
 *        force and moment are expressed in the body frame.
 */
export function computeAero(relVelBody, angVelBody, rho, controls) {
  const { elevator, aileron, rudder, flap, gearDown } = controls

  const v = relVelBody.length() // true airspeed magnitude, m/s
  const forwardSpeed = -relVelBody.z // speed along the nose (+ when moving forward)

  // If we're barely moving through the air, there are no meaningful aero
  // forces. Returning zeros also avoids dividing by ~0 below.
  if (v < 1e-3) {
    return {
      force: _lift.set(0, 0, 0).clone(),
      moment: _drag.set(0, 0, 0).clone(),
      aoa: 0,
      sideslip: 0,
      airspeed: 0,
      cl: 0,
      stalled: false,
    }
  }

  // Angle of attack: angle between the relative wind and the nose, measured in
  // the aircraft's plane of symmetry. Positive when the air meets the wing
  // from below (the usual lift-producing case).
  const aoa = Math.atan2(-relVelBody.y, forwardSpeed)
  // Sideslip: angle between the relative wind and the nose in the horizontal
  // plane. Positive when the aircraft is drifting to its right.
  const sideslip = Math.atan2(relVelBody.x, forwardSpeed)

  // Dynamic pressure q = 1/2 * rho * V^2. This is the term that makes EVERY
  // aerodynamic force and control moment grow with the square of airspeed —
  // and vanish as the aircraft slows down, which is why controls go sluggish.
  const qbar = 0.5 * rho * v * v
  // A linear-in-V factor used for rotational damping. Damping must fade out at
  // low speed (and never blow up), so it scales with V, not V^2.
  const halfRhoV = 0.5 * rho * v

  const flapObj = flap
  const cl = liftCoefficient(aoa, flapObj)
  const cd = dragCoefficient(cl, flapObj, gearDown)
  const cy = -CY_BETA * sideslip // side force opposes the drift

  // --- Forces -------------------------------------------------------------
  // Direction the aircraft is travelling through the air.
  _dHat.copy(relVelBody).normalize()

  // Drag points directly opposite the relative wind.
  _drag.copy(_dHat).multiplyScalar(-qbar * WING_AREA * cd)

  // Lift is perpendicular to the relative wind, in the plane of symmetry, and
  // points "up" relative to the airframe. cross(rightAxis, windDir) gives
  // exactly that: for level flight it resolves to straight up (+Y).
  _lift.copy(RIGHT_AXIS).cross(_dHat).normalize().multiplyScalar(qbar * WING_AREA * cl)

  // Side force acts along the body's right axis (drives crosswind weathervaning
  // together with the yaw moment below).
  _side.copy(RIGHT_AXIS).multiplyScalar(qbar * WING_AREA * cy)

  const force = new THREE.Vector3().add(_lift).add(_drag).add(_side)

  // --- Moments ------------------------------------------------------------
  // We first compute the three intuitive "physical" moments, then map them
  // onto torques about the local axes for integration.
  //
  // Pitch (nose-up positive):
  //   CM_TRIM      - small constant that trims slightly nose-up
  //   CM_ALPHA*aoa - static stability (CM_ALPHA<0 => restoring, nose-down as
  //                  AoA grows, pulling the aircraft back toward trim)
  //   elevator     - pilot pitch command
  const pitchUp = qbar * WING_AREA * MEAN_CHORD * (CM_TRIM + CM_ALPHA * aoa + ELEVATOR_AUTHORITY * elevator)

  // Roll (right-wing-down positive):
  //   aileron      - pilot roll command
  //   -CL_BETA*beta- dihedral effect: a right sideslip rolls the aircraft left
  const rollRight = qbar * WING_AREA * WING_SPAN * (AILERON_AUTHORITY * aileron - CL_BETA * sideslip)

  // Yaw (nose-right positive):
  //   rudder       - pilot yaw command
  //   CN_BETA*beta - weathervane/directional stability: the tail swings the
  //                  nose into the relative wind, reducing sideslip
  const yawRight = qbar * WING_AREA * WING_SPAN * (RUDDER_AUTHORITY * rudder + CN_BETA * sideslip)

  // Aerodynamic rotational damping. Each term opposes the corresponding body
  // rotation rate and scales with airspeed (via halfRhoV), so a fast aircraft
  // is well damped and a slow one wallows. Coefficients are negative.
  const pitchDamp = PITCH_DAMPING * halfRhoV * WING_AREA * MEAN_CHORD * MEAN_CHORD * angVelBody.x
  const yawDamp = YAW_DAMPING * halfRhoV * WING_AREA * WING_SPAN * WING_SPAN * angVelBody.y
  const rollDamp = ROLL_DAMPING * halfRhoV * WING_AREA * WING_SPAN * WING_SPAN * angVelBody.z

  // Map physical moments to torques about the local axes. Recall:
  //   +X rotation = nose up      -> Tx gets +pitchUp
  //   +Y rotation = nose left    -> Ty gets -yawRight
  //   +Z rotation = roll left    -> Tz gets -rollRight
  const moment = new THREE.Vector3(
    pitchUp + pitchDamp,
    -yawRight + yawDamp,
    -rollRight + rollDamp,
  )

  return {
    force,
    moment,
    aoa,
    sideslip,
    airspeed: v,
    cl,
    stalled: isStalled(aoa, flapObj),
  }
}
