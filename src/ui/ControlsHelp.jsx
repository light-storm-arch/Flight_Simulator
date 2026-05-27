// ---------------------------------------------------------------------------
// ControlsHelp.jsx
// ---------------------------------------------------------------------------
// The on-screen control reference. Toggled with H (or the toolbar button).
// Purely informational, so it's click-through.
// ---------------------------------------------------------------------------

import { useGameStore } from '../store/gameStore.js'

const ROWS = [
  ['W / S', 'Pitch (nose down / up)'],
  ['A / D', 'Roll (left / right)'],
  ['Q / E', 'Yaw (left / right)'],
  ['Shift / Ctrl', 'Throttle (up / down)'],
  ['F', 'Flaps  0 / 5 / 15 / 30'],
  ['G', 'Landing gear (up / down)'],
  ['B', 'Wheel brakes (hold)'],
  ['V', 'Switch view (cockpit / chase)'],
  ['M', 'Mouse-look (cockpit) — click to capture'],
  ['O', 'Weather & settings'],
  ['R', 'Reset to runway'],
  ['H', 'Hide / show this help'],
]

export default function ControlsHelp() {
  const show = useGameStore((s) => s.showControls)
  if (!show) return null
  return (
    <div style={styles.panel}>
      <div style={styles.title}>CONTROLS</div>
      <table style={styles.table}>
        <tbody>
          {ROWS.map(([key, desc]) => (
            <tr key={key}>
              <td style={styles.key}>{key}</td>
              <td style={styles.desc}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={styles.tip}>Spawned on runway 36 — flaps 5, gear down. Throttle up and rotate near 140 kt.</div>
    </div>
  )
}

const styles = {
  panel: {
    position: 'absolute',
    top: 14,
    left: 14,
    pointerEvents: 'none',
    background: 'rgba(8, 13, 22, 0.55)',
    border: '1px solid rgba(120, 160, 200, 0.25)',
    borderRadius: 12,
    padding: '12px 14px',
    color: '#dff1ff',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    backdropFilter: 'blur(4px)',
    maxWidth: 320,
  },
  title: { fontSize: 11, letterSpacing: 2, color: '#7fa6c9', marginBottom: 8 },
  table: { borderCollapse: 'collapse' },
  key: {
    color: '#ffd24a',
    fontWeight: 700,
    padding: '2px 10px 2px 0',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  desc: { color: '#cfe0f0', padding: '2px 0' },
  tip: { marginTop: 10, color: '#9fb6cc', fontSize: 11, lineHeight: 1.4 },
}
