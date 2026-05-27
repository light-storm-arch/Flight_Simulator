// ---------------------------------------------------------------------------
// constants.js
// ---------------------------------------------------------------------------
// All of the tunable parameters for the simulation live here so that the
// physics code reads like equations rather than a pile of magic numbers.
//
// INTERNAL UNITS ARE SI: metres, metres/second, radians, kilograms, newtons,
// seconds. Conversions to "cockpit" units (knots, feet, ft/min, degrees) are
// only applied at the very edge, in the HUD/instruments.
//
// The numbers below are deliberately "737-ish": close enough to a real
// Boeing 737-800 to feel right and to teach the correct relationships, but
// rounded and simplified so the model stays readable and tunable.
// ---------------------------------------------------------------------------

// --- Physical environment ---------------------------------------------------
export const GRAVITY = 9.80665 // m/s^2, standard gravity, pulls down in world -Y
export const SEA_LEVEL_DENSITY = 1.225 // kg/m^3, ISA air density at sea level

// --- Mass and geometry ------------------------------------------------------
export const MASS = 70000 // kg, typical 737-800 operating weight
export const WING_AREA = 125 // m^2, reference wing area S used in all aero forces
export const WING_SPAN = 34 // m, wingtip to wingtip
export const MEAN_CHORD = 4.0 // m, mean aerodynamic chord (lever arm for pitch)

// Aspect ratio AR = span^2 / area. Higher AR => less induced drag.
export const ASPECT_RATIO = (WING_SPAN * WING_SPAN) / WING_AREA // ~9.25
export const OSWALD_EFFICIENCY = 0.8 // e, wing efficiency factor for induced drag

// Moments of inertia about the three BODY axes (kg*m^2). These set how
// sluggish the aircraft is to rotate. A 737 is much harder to pitch/yaw than
// to roll, which is why the roll number is the smallest.
//   - roll  : about the longitudinal (nose-to-tail) axis  -> small, agile
//   - pitch : about the lateral (wingtip-to-wingtip) axis  -> large
//   - yaw   : about the vertical axis                      -> largest
export const INERTIA_ROLL = 1.4e6
export const INERTIA_PITCH = 3.5e6
export const INERTIA_YAW = 4.7e6

// --- Propulsion -------------------------------------------------------------
export const MAX_THRUST = 240000 // N, total from both engines at 100% throttle
export const IDLE_THRUST_FRACTION = 0.05 // engines never produce zero thrust at idle

// --- Lift model -------------------------------------------------------------
// Lift coefficient Cl as a function of angle of attack (AoA):
//   Cl = CL0 + CL_ALPHA * alpha     (linear, attached flow)
// until the critical AoA, after which the flow separates and lift collapses.
export const CL0 = 0.2 // lift at zero AoA thanks to wing camber
export const CL_ALPHA = 5.7 // lift-curve slope, per radian (~0.1 per degree)
export const STALL_AOA = (15 * Math.PI) / 180 // critical AoA, radians (~15 deg)
// How fast lift falls off once stalled. Higher = sharper, scarier stall.
export const POST_STALL_SLOPE = 4.0 // per radian, applied beyond STALL_AOA
export const CL_POST_STALL_FLOOR = 0.6 // lift never drops below this while flying

// --- Drag model -------------------------------------------------------------
// Drag = parasitic (shape/skin, roughly constant Cd) + induced (cost of lift).
export const CD0 = 0.022 // zero-lift parasitic drag coefficient (clean aircraft)
export const CD_GEAR = 0.020 // extra parasitic drag when landing gear is down

// --- Sideslip / lateral aerodynamics ---------------------------------------
export const CY_BETA = 1.0 // side-force coefficient per radian of sideslip
export const CN_BETA = 0.12 // weathervane (directional) stability, per radian
export const CL_BETA = 0.08 // dihedral effect: roll produced by sideslip

// --- Pitch stability and control -------------------------------------------
// Static pitch stability: a stable aircraft develops a nose-DOWN moment when
// AoA increases, pushing it back toward trim. Hence CM_ALPHA is negative.
export const CM_ALPHA = -1.2 // pitch moment per radian of AoA (restoring)
export const CM_TRIM = 0.04 // small nose-up moment so it trims slightly nose-up
// Elevator authority is sized against the stability term so that a steady
// deflection trims to a sensible AoA: with these numbers full back-elevator
// commands roughly 18 deg AoA (enough to rotate, and enough to stall if you
// over-pull), and half-elevator about 10 deg. trimAoA = (CM_TRIM + auth*e)/-CM_ALPHA.
export const ELEVATOR_AUTHORITY = 0.35 // pitch moment coefficient at full elevator
// Damping coefficients multiply (0.5*rho*V * S * ref^2 * rate). They are the
// aerodynamic resistance to rotation: large enough to damp oscillations, small
// enough that the controls still produce healthy rates. (Too large here was a
// bug that pinned the roll rate near zero.)
export const PITCH_DAMPING = -6.0 // opposes pitch rate (aerodynamic damping)

// --- Roll control -----------------------------------------------------------
export const AILERON_AUTHORITY = 0.12 // roll moment coefficient at full aileron
export const ROLL_DAMPING = -1.0 // opposes roll rate (sets steady roll rate ~25 deg/s)

// --- Yaw control ------------------------------------------------------------
export const RUDDER_AUTHORITY = 0.10 // yaw moment coefficient at full rudder
export const YAW_DAMPING = -2.0 // opposes yaw rate (damps dutch roll)

// --- Flap settings ----------------------------------------------------------
// Each detent adds lift (deltaCl) and drag (deltaCd), and lowers the stall AoA
// because the cambered wing separates earlier. Selectable with the F key.
export const FLAP_SETTINGS = [
  { deg: 0, deltaCl: 0.0, deltaCd: 0.0, stallAoaDelta: 0.0 },
  { deg: 5, deltaCl: 0.25, deltaCd: 0.006, stallAoaDelta: (-1 * Math.PI) / 180 },
  { deg: 15, deltaCl: 0.6, deltaCd: 0.025, stallAoaDelta: (-2 * Math.PI) / 180 },
  { deg: 30, deltaCl: 1.0, deltaCd: 0.06, stallAoaDelta: (-4 * Math.PI) / 180 },
]

// --- Control response rates -------------------------------------------------
// Control inputs are smoothed toward their target so a key tap doesn't snap a
// surface to full deflection instantly. Units: fraction of full travel /second.
export const CONTROL_SLEW_RATE = 3.0 // pitch/roll/yaw surfaces return/extend speed
export const CONTROL_CENTER_RATE = 4.0 // how fast surfaces recenter when key released
export const THROTTLE_RATE = 0.4 // throttle change per second while Shift/Ctrl held
export const FLAP_ACTUATION_TIME = 3.0 // seconds for flaps to travel between detents
export const GEAR_ACTUATION_TIME = 4.0 // seconds for gear to extend/retract

// --- Ground / landing gear --------------------------------------------------
export const GROUND_HEIGHT_OFFSET = 4.7 // m, CG height above ground with gear down
// Suspension as a spring-damper (coefficients are per-kg, multiplied by MASS).
// At rest the spring sags g/GROUND_SPRING ~= 0.12 m, and GROUND_DAMPING gives a
// near-critically-damped settle so the aircraft doesn't bounce on touchdown.
export const GROUND_SPRING = 80.0
export const GROUND_DAMPING = 12.0
export const ROLLING_FRICTION = 0.02 // tyre rolling resistance coefficient
export const BRAKING_FRICTION = 0.4 // additional friction coefficient with brakes on
export const STALL_WARNING_MARGIN = (2 * Math.PI) / 180 // warn 2 deg before stall

// --- Simulation loop --------------------------------------------------------
export const PHYSICS_HZ = 60 // fixed physics timestep frequency
export const PHYSICS_DT = 1 / PHYSICS_HZ // seconds per physics step
export const MAX_FRAME_DT = 0.1 // clamp huge frame gaps (tab switch) to stay stable

// --- World layout -----------------------------------------------------------
export const AIRPORT_ELEVATION = 0 // m MSL, height of the flat airport area
export const RUNWAY_LENGTH = 3000 // m
export const RUNWAY_WIDTH = 45 // m
export const RUNWAY_HEADING = 0 // radians, runway points toward world north (-Z)

// --- Unit conversions (SI -> cockpit display) -------------------------------
export const MS_TO_KNOTS = 1.94384
export const M_TO_FEET = 3.28084
export const MS_TO_FPM = 196.850394 // metres/second -> feet/minute
export const RAD_TO_DEG = 180 / Math.PI
export const KNOTS_TO_MS = 1 / MS_TO_KNOTS

/**
 * International Standard Atmosphere air density as a function of altitude.
 * Air thins with height, so lift and engine thrust fall off as you climb —
 * this is why airliners have a service ceiling. Valid through the troposphere.
 * @param {number} altitudeMeters height above sea level, metres
 * @returns {number} air density, kg/m^3
 */
export function airDensity(altitudeMeters) {
  const h = Math.max(0, altitudeMeters)
  // Standard troposphere model: density ratio = (1 - 2.25577e-5 * h)^4.2559
  return SEA_LEVEL_DENSITY * Math.pow(1 - 2.25577e-5 * h, 4.2559)
}
