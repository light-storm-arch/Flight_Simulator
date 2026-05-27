# 737 Flight Simulator

A browser-based flight simulator built around a 737-style commercial airliner.
It runs entirely client-side (React + Three.js) and is meant to do two things:

1. **Teach the real physics and procedures of commercial flight** — lift that
   depends on airspeed and angle of attack, stalls, induced vs. parasitic drag,
   crosswinds, sluggish controls at low speed.
2. **Serve as graduated exposure for a mild fear of flying** — calm by default,
   with optional turbulence/crosswind/visibility you can dial up at your own
   pace, and (in later phases) a narrator that explains every sound and
   sensation.

This is **Phase 1: free-flight mode** — spawn on the runway, take off, fly
around procedurally generated terrain, and land.

---

## Quick start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`). Click the
window once so audio can start, then throttle up and fly.

To make a production build:

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

---

## Controls

| Key            | Action                                   |
| -------------- | ---------------------------------------- |
| `W` / `S`      | Pitch (nose down / nose up)              |
| `A` / `D`      | Roll (left / right)                      |
| `Q` / `E`      | Yaw (left / right)                       |
| `Shift` / `Ctrl` | Throttle (up / down)                   |
| `F`            | Flaps — cycle 0 → 5 → 15 → 30 → 0        |
| `G`            | Landing gear (up / down)                 |
| `B`            | Wheel brakes (hold)                      |
| `V`            | Switch view (cockpit / chase)            |
| `M`            | Toggle cockpit mouse-look (click to capture) |
| `O`            | Open the weather / settings panel        |
| `H`            | Hide / show the on-screen control help   |
| `R`            | Reset to the runway                      |

There is also a small on-screen toolbar (top centre) with the same toggles, so
you never need to memorise the keys.

**Taking off:** You spawn on runway 36 with flaps 5 and the gear down. Hold
`Shift` to spool the engines to full, let the speed build to roughly 140 kt,
then gently pull back (`S`) to rotate. Raise the gear (`G`) once you have a
positive climb, then milk the flaps up (`F`) as you accelerate.

---

## The physics model

The flight model is a hand-written 6-degree-of-freedom rigid body (no physics
library), integrated at a **fixed 60 Hz** so it stays stable regardless of your
frame rate. Everything is in SI units internally (metres, m/s, radians, kg,
newtons) and only converted to cockpit units (knots, feet, ft/min, degrees) at
the instruments. The interesting code lives in `src/physics/` and is heavily
commented.

**Lift** is `L = ½ · ρ · V² · S · Cl`. The lift coefficient `Cl` rises almost
linearly with angle of attack until a critical angle (~15°), after which the
airflow separates and lift **collapses** — that's the stall. Flaps add lift
(and drag), and lower the stalling angle. (`aerodynamics.js`)

**Drag** is the sum of *parasitic* drag (the cost of shoving the airframe
through the air, higher with gear/flaps out) and *induced* drag
(`Cl² / (π·e·AR)`, the price of making lift — it dominates when you're slow and
dragging the nose up).

**Forces & moments** all scale with dynamic pressure (`½·ρ·V²`), which is why
the controls go **sluggish at low speed** and why air thins (and performance
drops) as you climb — air density follows the standard atmosphere.

**Stability** is built in: the aircraft develops a nose-down moment as AoA
rises (so it tends back toward trim), weathervanes into the relative wind, and
has aerodynamic damping on all three axes. **Gravity** always pulls straight
down in world space.

**Ground contact** models the gear as a spring-damper that resists penetrating
the runway, plus rolling friction (more when you hold the brakes).

Representative numbers it produces: ~141 kt clean stall speed, lift-off around
150 kt at flaps 5, cruise around 250–280 kt — all in the right ballpark for a
737.

### Project structure

```
src/
├── physics/        # the sim core (no React, no Three scene-graph)
│   ├── constants.js     # every tunable 737-ish parameter + unit conversions
│   ├── aerodynamics.js  # lift / drag / moment maths (read this first)
│   ├── aircraft.js      # 6DOF state + fixed-step integrator + ground
│   └── instruments.js   # SI state -> cockpit display values
├── world/          # Terrain (+ shared heightfield), Runway, Sky/fog
├── aircraft/       # Aircraft.jsx (3D model) + Cockpit.jsx (interior)
├── ui/             # HUD (artificial horizon + readouts), help, settings
├── audio/          # SoundManager.js (synthesised engine/wind/warnings)
├── store/          # Zustand store (UI/settings/HUD snapshot only)
├── hooks/          # useKeyboard, useFlightLoop (the 60 Hz tick)
├── App.jsx
└── main.jsx
```

The 60 Hz rigid-body state deliberately lives in a ref inside the flight loop,
**outside** React/Zustand, so the simulation never triggers re-renders. The
loop pushes a small throttled snapshot of display values into the store for the
HUD.

---

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds the app and publishes it to GitHub Pages
on every push to `main`. To enable it:

1. In the repo, go to **Settings → Pages** and set **Source** to
   **GitHub Actions**.
2. Push to `main`. The site deploys to
   `https://<user>.github.io/flight_simulator/`.

The Vite `base` is set to `/flight_simulator/` in `vite.config.js` to match the
project-site subpath. If you fork under a different repo name, change it there.

---

## Next phases (planned)

Phase 1 was built to leave room for these without rework:

- **Phase 2 — Tutorial mode:** guided takeoff → climb → cruise → descent →
  landing missions with on-screen prompts.
- **Phase 3 — "What's happening" narrator:** a toggleable overlay that explains
  sounds and sensations in real time ("that's the gear retracting, normal",
  "wing flex is designed in"). The sim already surfaces the live state
  (airspeed, AoA, gear/flap motion, stall) the narrator will read from.
- **Phase 4 — Checklists:** before-takeoff / before-landing checklists with
  click-to-acknowledge items.
- **Phase 5 — Multiple airports:** several procedurally generated airports with
  navigation between them. The heightfield is already a deterministic,
  seedable function, ready to host more runways.
