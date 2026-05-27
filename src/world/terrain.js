// ---------------------------------------------------------------------------
// terrain.js
// ---------------------------------------------------------------------------
// The procedural heightfield, shared by BOTH the physics (ground collision)
// and the rendered terrain mesh so they can never disagree about where the
// ground is. It is a deterministic function height = f(x, z) built from
// layered simplex noise (fractal Brownian motion), with the airport area
// smoothly flattened so the runway sits on level ground.
// ---------------------------------------------------------------------------

import { createNoise2D } from 'simplex-noise'
import { AIRPORT_ELEVATION } from '../physics/constants.js'

// Overall terrain footprint and mesh resolution. Big enough to fly across for
// several minutes; chunking can come later (see "next phases").
export const TERRAIN_SIZE = 24000 // metres across (centred on the airport)
export const TERRAIN_SEGMENTS = 256 // grid resolution of the rendered mesh

// Flatten everything within FLAT_RADIUS of the airport, then blend back into
// natural terrain over the next FLAT_BLEND metres.
const FLAT_RADIUS = 1900
const FLAT_BLEND = 1400

// Seeded PRNG so the world is identical on every reload (handy for learning a
// specific approach and, later, for reproducible missions).
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const noise2D = createNoise2D(mulberry32(1337))

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Fractal Brownian motion: sum several octaves of noise, each higher in
 * frequency and lower in amplitude, to get natural-looking detail.
 * @returns {number} value in roughly [-1, 1]
 */
function fbm(x, z, octaves, baseFreq, lacunarity = 2.0, gain = 0.5) {
  let amplitude = 1
  let frequency = baseFreq
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise2D(x * frequency, z * frequency)
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }
  return sum / norm
}

/**
 * Terrain height (metres MSL) at a world position.
 * @param {number} x world east coordinate
 * @param {number} z world (south-positive) coordinate
 * @returns {number} ground height in metres
 */
export function heightAt(x, z) {
  // Gentle rolling hills everywhere.
  const hills = fbm(x, z, 4, 1 / 900) * 45

  // Mountains that only appear in the distance: a low-frequency ridge noise
  // masked so the terrain near the airport stays calm and the big peaks sit
  // out on the horizon.
  const dist = Math.hypot(x, z)
  const mountainMask = smoothstep(3500, 14000, dist)
  const ridge = Math.max(0, fbm(x + 1000, z - 500, 3, 1 / 2600))
  const mountains = ridge * 700 * mountainMask

  let h = AIRPORT_ELEVATION + hills + mountains

  // Flatten the airport: fully flat inside FLAT_RADIUS, blending to natural
  // terrain beyond it.
  const flat = smoothstep(FLAT_RADIUS, FLAT_RADIUS + FLAT_BLEND, dist)
  h = AIRPORT_ELEVATION + (h - AIRPORT_ELEVATION) * flat
  return h
}
