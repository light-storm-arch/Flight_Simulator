// ---------------------------------------------------------------------------
// aircraft.js
// ---------------------------------------------------------------------------
// The 6-degree-of-freedom rigid body: three for position (where it is) and
// three for orientation (which way it points). This file owns the aircraft
// STATE and the fixed-timestep INTEGRATOR that advances it. The actual
// air-force maths lives in aerodynamics.js; here we add thrust, gravity and
// the ground, then step everything forward with semi-implicit Euler.
//
// Frames:
//   World frame  - Three.js: +X east, +Y up, -Z north. Gravity is along -Y.
//   Body frame   - the aircraft's local axes (+X right, +Y up, +Z aft).
// Orientation is a quaternion mapping body -> world. Angular velocity is kept
// in the BODY frame, which makes integrating the quaternion a clean local
// multiply.
// ---------------------------------------------------------------------------

import * as THREE from 'three'
import { computeAero } from './aerodynamics.js'
import {
  MASS,
  GRAVITY,
  MAX_THRUST,
  IDLE_THRUST_FRACTION,
  INERTIA_ROLL,
  INERTIA_PITCH,
  INERTIA_YAW,
  FLAP_SETTINGS,
  CONTROL_SLEW_RATE,
  CONTROL_CENTER_RATE,
  FLAP_ACTUATION_TIME,
  GEAR_ACTUATION_TIME,
  GROUND_HEIGHT_OFFSET,
  GROUND_SPRING,
  GROUND_DAMPING,
  ROLLING_FRICTION,
  BRAKING_FRICTION,
  RUNWAY_LENGTH,
  AIRPORT_ELEVATION,
  airDensity,
} from './constants.js'

const MAX_FLAP_DEG = FLAP_SETTINGS[FLAP_SETTINGS.length - 1].deg

/** Move `current` toward `target` by at most `maxStep`. */
function moveToward(current, target, maxStep) {
  const delta = target - current
  if (Math.abs(delta) <= maxStep) return target
  return current + Math.sign(delta) * maxStep
}

/**
 * Interpolate the flap aerodynamic effect for an arbitrary deflection (so that
 * flaps mid-travel produce in-between lift/drag, not a sudden jump at detents).
 * @param {number} deg current flap deflection in degrees
 * @returns {{deg:number, deltaCl:number, deltaCd:number, stallAoaDelta:number}}
 */
export function flapForDeg(deg) {
  const settings = FLAP_SETTINGS
  if (deg <= settings[0].deg) return settings[0]
  if (deg >= settings[settings.length - 1].deg) return settings[settings.length - 1]
  for (let i = 0; i < settings.length - 1; i++) {
    const a = settings[i]
    const b = settings[i + 1]
    if (deg >= a.deg && deg <= b.deg) {
      const t = (deg - a.deg) / (b.deg - a.deg)
      return {
        deg,
        deltaCl: THREE.MathUtils.lerp(a.deltaCl, b.deltaCl, t),
        deltaCd: THREE.MathUtils.lerp(a.deltaCd, b.deltaCd, t),
        stallAoaDelta: THREE.MathUtils.lerp(a.stallAoaDelta, b.stallAoaDelta, t),
      }
    }
  }
  return settings[settings.length - 1]
}

/**
 * Build a fresh aircraft state sitting on the runway, ready for takeoff:
 * gear down, flaps 5, engines at idle, pointing north down the runway.
 * @param {(x:number,z:number)=>number} groundHeightAt terrain sampler
 */
export function createAircraftState(groundHeightAt) {
  // Spawn near the south threshold so the full runway stretches out ahead.
  const spawnX = 0
  const spawnZ = RUNWAY_LENGTH / 2 - 150
  const groundY = groundHeightAt ? groundHeightAt(spawnX, spawnZ) : AIRPORT_ELEVATION

  return {
    // --- rigid-body state ---
    position: new THREE.Vector3(spawnX, groundY + GROUND_HEIGHT_OFFSET, spawnZ),
    velocity: new THREE.Vector3(0, 0, 0),
    orientation: new THREE.Quaternion(), // identity: nose points north (-Z), wings level
    angularVelocity: new THREE.Vector3(0, 0, 0), // body frame (about local X,Y,Z)

    // --- control surfaces (smoothed actual deflection, -1..1) ---
    elevator: 0,
    aileron: 0,
    rudder: 0,

    // --- engines / config ---
    throttle: 0, // commanded 0..1 (idle thrust still applies at 0)
    flapDeg: 5, // current flap deflection, degrees (animated)
    flapTargetDeg: 5, // commanded detent
    gearPosition: 1, // 0 = up, 1 = down (animated)
    gearDown: true, // commanded
    brakes: false,

    // --- diagnostics, refreshed every step for HUD / audio / narrator ---
    airspeed: 0, // true airspeed, m/s
    aoa: 0, // angle of attack, radians
    sideslip: 0, // radians
    stalled: false,
    onGround: true,
    thrustN: 0,
    verticalSpeed: 0, // m/s (world +Y)
  }
}

// Scratch objects reused each step to avoid per-frame allocations.
const _invOrient = new THREE.Quaternion()
const _relVelWorld = new THREE.Vector3()
const _relVelBody = new THREE.Vector3()
const _forceBody = new THREE.Vector3()
const _forceWorld = new THREE.Vector3()
const _deltaQuat = new THREE.Quaternion()
const _axis = new THREE.Vector3()
const THRUST_DIR = new THREE.Vector3(0, 0, -1) // engines push along the nose (-Z)

/**
 * Advance the aircraft by one FIXED timestep `dt`.
 *
 * @param {object} s aircraft state (mutated in place)
 * @param {number} dt timestep, seconds (constant, e.g. 1/60)
 * @param {object} cmd pilot commands this step:
 *        { pitch, roll, yaw, throttle, flapTargetDeg, gearDown, brakes }
 *        pitch/roll/yaw are target deflections in [-1,1]
 *        (pitch +1 = nose up, roll +1 = right, yaw +1 = right).
 * @param {object} env { wind: THREE.Vector3, groundHeightAt: fn }
 */
export function stepAircraft(s, dt, cmd, env) {
  // --- 1. Smooth control surfaces toward the commanded positions ----------
  // Holding a key drives the surface out at CONTROL_SLEW_RATE; releasing lets
  // it spring back to centre at CONTROL_CENTER_RATE.
  s.elevator = moveToward(s.elevator, cmd.pitch, (cmd.pitch === 0 ? CONTROL_CENTER_RATE : CONTROL_SLEW_RATE) * dt)
  s.aileron = moveToward(s.aileron, cmd.roll, (cmd.roll === 0 ? CONTROL_CENTER_RATE : CONTROL_SLEW_RATE) * dt)
  s.rudder = moveToward(s.rudder, cmd.yaw, (cmd.yaw === 0 ? CONTROL_CENTER_RATE : CONTROL_SLEW_RATE) * dt)
  s.throttle = THREE.MathUtils.clamp(cmd.throttle, 0, 1)
  s.brakes = cmd.brakes

  // --- 2. Animate slow-moving mechanisms (flaps, gear) --------------------
  s.flapTargetDeg = cmd.flapTargetDeg
  s.flapDeg = moveToward(s.flapDeg, s.flapTargetDeg, (MAX_FLAP_DEG / FLAP_ACTUATION_TIME) * dt)
  s.gearDown = cmd.gearDown
  s.gearPosition = moveToward(s.gearPosition, s.gearDown ? 1 : 0, (1 / GEAR_ACTUATION_TIME) * dt)

  // --- 3. Air density at the current altitude -----------------------------
  const rho = airDensity(s.position.y)

  // --- 4. Relative wind in the body frame ---------------------------------
  // Relative wind = how the aircraft moves through the AIR (ground velocity
  // minus the moving air mass), rotated into body axes.
  _relVelWorld.copy(s.velocity).sub(env.wind)
  _invOrient.copy(s.orientation).invert()
  _relVelBody.copy(_relVelWorld).applyQuaternion(_invOrient)

  // --- 5. Aerodynamic force & moment (body frame) -------------------------
  const flap = flapForDeg(s.flapDeg)
  const aero = computeAero(_relVelBody, s.angularVelocity, rho, {
    elevator: s.elevator,
    aileron: s.aileron,
    rudder: s.rudder,
    flap,
    gearDown: s.gearPosition > 0.5,
  })

  // --- 6. Thrust (body frame, along the nose) -----------------------------
  // Engines always make at least idle thrust; full throttle reaches MAX_THRUST.
  s.thrustN = MAX_THRUST * (IDLE_THRUST_FRACTION + (1 - IDLE_THRUST_FRACTION) * s.throttle)
  _forceBody.copy(aero.force).addScaledVector(THRUST_DIR, s.thrustN)

  // --- 7. Rotate body force into the world, then add gravity --------------
  _forceWorld.copy(_forceBody).applyQuaternion(s.orientation)
  _forceWorld.y -= MASS * GRAVITY // weight always pulls straight down in world space

  // --- 8. Ground contact (world frame) ------------------------------------
  // The wheels (or belly) can't pass through the terrain. We model the gear as
  // a stiff spring-damper that pushes up when the aircraft penetrates the
  // ground, plus friction that opposes horizontal motion (more with brakes).
  const groundY = env.groundHeightAt(s.position.x, s.position.z)
  const contactHeight = groundY + GROUND_HEIGHT_OFFSET
  const penetration = contactHeight - s.position.y
  s.onGround = penetration > -0.05

  if (penetration > 0) {
    // Normal force (per-kg coefficients * mass) resisting penetration and
    // damping vertical motion so the aircraft settles instead of bouncing.
    let normal = (GROUND_SPRING * penetration - GROUND_DAMPING * s.velocity.y) * MASS
    if (normal < 0) normal = 0
    _forceWorld.y += normal

    // Friction opposes the horizontal velocity. Capped so it can decelerate
    // the aircraft but never yank it backwards within a single step.
    const horizSpeed = Math.hypot(s.velocity.x, s.velocity.z)
    if (horizSpeed > 1e-3) {
      const mu = ROLLING_FRICTION + (s.brakes ? BRAKING_FRICTION : 0)
      const maxFriction = mu * normal
      // Friction force that would exactly stop horizontal motion this step.
      const stoppingForce = (horizSpeed / dt) * MASS
      const frictionMag = Math.min(maxFriction, stoppingForce)
      _forceWorld.x -= (s.velocity.x / horizSpeed) * frictionMag
      _forceWorld.z -= (s.velocity.z / horizSpeed) * frictionMag
    }
  }

  // --- 9. Integrate linear motion (semi-implicit Euler) -------------------
  // Update velocity first, then position with the NEW velocity: this is more
  // stable than plain Euler for oscillatory systems like a spring-damped gear.
  const ax = _forceWorld.x / MASS
  const ay = _forceWorld.y / MASS
  const az = _forceWorld.z / MASS
  s.velocity.x += ax * dt
  s.velocity.y += ay * dt
  s.velocity.z += az * dt
  s.position.addScaledVector(s.velocity, dt)

  // Emergency floor: the spring-damper carries the aircraft in normal contact
  // (compressing ~0.12 m at rest), but on a catastrophic impact we still never
  // let the CG punch down to within half a metre of the actual terrain. This
  // is only a backstop — it deliberately sits BELOW the resting contact height
  // so the gear spring is free to compress and generate friction.
  const groundYAfter = env.groundHeightAt(s.position.x, s.position.z)
  const hardFloor = groundYAfter + 0.5
  if (s.position.y < hardFloor) {
    s.position.y = hardFloor
    if (s.velocity.y < 0) s.velocity.y = 0
  }

  // --- 10. Integrate angular motion ---------------------------------------
  // Angular acceleration = torque / inertia, per body axis. Recall the local
  // axis -> rotation mapping: local X is the pitch axis, Y the yaw axis,
  // Z the roll axis.
  s.angularVelocity.x += (aero.moment.x / INERTIA_PITCH) * dt
  s.angularVelocity.y += (aero.moment.y / INERTIA_YAW) * dt
  s.angularVelocity.z += (aero.moment.z / INERTIA_ROLL) * dt

  // On the ground the tyres resist rolling and slewing, so heavily damp the
  // roll and yaw rates (the aircraft tracks the runway instead of tipping).
  if (penetration > 0) {
    const groundDamp = Math.exp(-6 * dt)
    s.angularVelocity.z *= groundDamp // roll
    s.angularVelocity.y *= groundDamp // yaw
  }

  // Update orientation by the body-frame rotation over this step. Building the
  // delta quaternion from the angular-velocity axis/angle and right-multiplying
  // applies the rotation in the body frame.
  const angSpeed = s.angularVelocity.length()
  if (angSpeed > 1e-9) {
    _axis.copy(s.angularVelocity).multiplyScalar(1 / angSpeed)
    _deltaQuat.setFromAxisAngle(_axis, angSpeed * dt)
    s.orientation.multiply(_deltaQuat)
    s.orientation.normalize()
  }

  // --- 11. Refresh diagnostics for the HUD / audio / narrator -------------
  s.airspeed = aero.airspeed
  s.aoa = aero.aoa
  s.sideslip = aero.sideslip
  s.stalled = aero.stalled
  s.verticalSpeed = s.velocity.y
}
