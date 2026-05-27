// ---------------------------------------------------------------------------
// HUD.jsx
// ---------------------------------------------------------------------------
// The instrument overlay, drawn as HTML on top of the 3D canvas. It reads the
// throttled instrument snapshot from the store (updated ~20 Hz by the flight
// loop) and shows airspeed, altitude, vertical speed, heading, an artificial
// horizon, plus throttle / flaps / gear and a stall warning. Used in both the
// cockpit and chase views so the numbers are always available.
//
// The container is click-through (pointerEvents: none) so mouse-look still
// works through it.
// ---------------------------------------------------------------------------

import { useGameStore } from '../store/gameStore.js'

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
function cardinal(deg) {
  return CARDINALS[Math.round(deg / 45) % 8]
}

function Readout({ label, value, unit, warn }) {
  return (
    <div style={styles.readout}>
      <div style={styles.readoutLabel}>{label}</div>
      <div style={{ ...styles.readoutValue, color: warn ? '#ff6b6b' : '#dff1ff' }}>
        {value}
        {unit ? <span style={styles.readoutUnit}> {unit}</span> : null}
      </div>
    </div>
  )
}

// Artificial horizon (attitude indicator): a clipped disc whose horizon line
// pitches and rolls with the aircraft, behind a fixed wing symbol.
function AttitudeIndicator({ pitchDeg, bankDeg }) {
  const ppd = 2.2 // screen pixels per degree of pitch
  const pitchOffset = pitchDeg * ppd
  return (
    <svg width="150" height="150" viewBox="-75 -75 150 150" style={styles.attitude}>
      <defs>
        <clipPath id="ahClip">
          <circle cx="0" cy="0" r="70" />
        </clipPath>
      </defs>
      {/* Moving horizon card: roll rotates it, pitch slides it vertically */}
      <g clipPath="url(#ahClip)">
        <g transform={`rotate(${-bankDeg}) translate(0 ${pitchOffset})`}>
          <rect x="-300" y="-400" width="600" height="400" fill="#3da9e0" />
          <rect x="-300" y="0" width="600" height="400" fill="#8a5a32" />
          <line x1="-300" y1="0" x2="300" y2="0" stroke="#fff" strokeWidth="2" />
          {[-20, -10, 10, 20].map((p) => (
            <g key={p}>
              <line
                x1={-18}
                y1={-p * ppd}
                x2={18}
                y2={-p * ppd}
                stroke="#fff"
                strokeWidth="1"
                opacity="0.85"
              />
              <text x={24} y={-p * ppd + 3} fill="#fff" fontSize="8" opacity="0.85">
                {Math.abs(p)}
              </text>
            </g>
          ))}
        </g>
      </g>
      {/* Fixed bezel + roll pointer + wing symbol */}
      <circle cx="0" cy="0" r="70" fill="none" stroke="#0a0e16" strokeWidth="4" />
      <g transform={`rotate(${-bankDeg})`}>
        <polygon points="0,-70 -5,-60 5,-60" fill="#ffd24a" />
      </g>
      <polygon points="0,-70 -5,-60 5,-60" fill="none" stroke="#fff" strokeWidth="1" />
      <g stroke="#ffd24a" strokeWidth="3" fill="none">
        <line x1="-34" y1="0" x2="-12" y2="0" />
        <line x1="12" y1="0" x2="34" y2="0" />
        <circle cx="0" cy="0" r="2.5" fill="#ffd24a" />
      </g>
    </svg>
  )
}

export default function HUD() {
  const hud = useGameStore((s) => s.hud)

  const heading = Math.round(hud.headingDeg) % 360
  const headingStr = String(heading).padStart(3, '0')
  const vs = Math.round(hud.verticalSpeedFpm / 10) * 10
  const flapStr =
    hud.flapDeg === hud.flapTargetDeg ? `${hud.flapDeg}` : `${hud.flapDeg} -> ${hud.flapTargetDeg}`
  const gearStr =
    hud.gearPosition > 0.99 ? 'DOWN' : hud.gearPosition < 0.01 ? 'UP' : `${Math.round(hud.gearPosition * 100)}%`

  return (
    <div style={styles.container}>
      {/* Stall warning banner */}
      {hud.stallWarning && (
        <div style={{ ...styles.stall, opacity: hud.stalled ? 1 : 0.85 }}>
          {hud.stalled ? 'STALL' : 'STALL WARNING'}
        </div>
      )}

      <div style={styles.bottomBar}>
        <div style={styles.cluster}>
          <Readout label="AIRSPEED" value={Math.round(hud.airspeedKnots)} unit="kt" warn={hud.stallWarning} />
          <Readout label="ALTITUDE" value={Math.round(hud.altitudeFeet).toLocaleString()} unit="ft" />
          <Readout
            label="V/S"
            value={`${vs > 0 ? '+' : ''}${vs.toLocaleString()}`}
            unit="fpm"
            warn={vs < -2500}
          />
        </div>

        <AttitudeIndicator pitchDeg={hud.pitchDeg} bankDeg={hud.bankDeg} />

        <div style={styles.cluster}>
          <Readout label="HEADING" value={`${headingStr} ${cardinal(heading)}`} />
          <Readout label="THROTTLE" value={Math.round(hud.throttlePct)} unit="%" />
          <div style={styles.configRow}>
            <Readout label="FLAPS" value={flapStr} unit="deg" />
            <Readout label="GEAR" value={gearStr} warn={!hud.gearDown && !hud.onGround} />
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    userSelect: 'none',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    padding: '12px 22px',
    background: 'rgba(8, 13, 22, 0.55)',
    border: '1px solid rgba(120, 160, 200, 0.25)',
    borderRadius: 14,
    backdropFilter: 'blur(4px)',
  },
  cluster: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 },
  configRow: { display: 'flex', gap: 16 },
  readout: { lineHeight: 1.1 },
  readoutLabel: { fontSize: 10, letterSpacing: 1.5, color: '#7fa6c9' },
  readoutValue: { fontSize: 22, fontWeight: 700 },
  readoutUnit: { fontSize: 12, fontWeight: 400, color: '#9fb6cc' },
  attitude: { display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' },
  stall: {
    position: 'absolute',
    top: 70,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    background: 'rgba(200, 30, 30, 0.85)',
    padding: '8px 26px',
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: 3,
    fontFamily: 'ui-monospace, monospace',
    animation: 'none',
  },
}
