// ---------------------------------------------------------------------------
// SettingsPanel.jsx
// ---------------------------------------------------------------------------
// Weather controls, off/calm by default. Opened with O (or the toolbar
// button). Writes straight into the store; the flight loop reads these values
// every step to build the wind and the scene reads visibility for fog.
// This panel is interactive, so it opts back into pointer events.
// ---------------------------------------------------------------------------

import { useGameStore } from '../store/gameStore.js'

function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <label style={styles.field}>
      <div style={styles.fieldRow}>
        <span>{label}</span>
        <span style={styles.value}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={styles.range}
      />
    </label>
  )
}

export default function SettingsPanel() {
  const show = useGameStore((s) => s.showSettings)
  const settings = useGameStore((s) => s.settings)
  const setSetting = useGameStore((s) => s.setSetting)
  const toggleSettings = useGameStore((s) => s.toggleSettings)
  if (!show) return null

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>WEATHER</span>
        <button style={styles.close} onClick={toggleSettings} aria-label="Close settings">
          x
        </button>
      </div>

      <Slider
        label="Turbulence"
        value={settings.turbulence}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => setSetting('turbulence', v)}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      <Slider
        label="Crosswind"
        value={settings.crosswindKnots}
        min={0}
        max={30}
        step={1}
        onChange={(v) => setSetting('crosswindKnots', v)}
        format={(v) => `${v} kt`}
      />

      <Slider
        label="Wind direction (from)"
        value={settings.crosswindDir}
        min={0}
        max={350}
        step={10}
        onChange={(v) => setSetting('crosswindDir', v)}
        format={(v) => `${String(v).padStart(3, '0')}°`}
      />

      <label style={styles.field}>
        <div style={styles.fieldRow}>
          <span>Visibility</span>
        </div>
        <select
          value={settings.visibility}
          onChange={(e) => setSetting('visibility', e.target.value)}
          style={styles.select}
        >
          <option value="clear">Clear</option>
          <option value="hazy">Hazy</option>
          <option value="low">Low / fog</option>
        </select>
      </label>

      <div style={styles.note}>
        All weather is off by default. Wind direction is where the wind blows FROM. Try a crosswind on
        landing once you're comfortable.
      </div>
    </div>
  )
}

const styles = {
  panel: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 250,
    pointerEvents: 'auto',
    background: 'rgba(8, 13, 22, 0.82)',
    border: '1px solid rgba(120, 160, 200, 0.3)',
    borderRadius: 12,
    padding: 14,
    color: '#dff1ff',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    backdropFilter: 'blur(6px)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 11, letterSpacing: 2, color: '#7fa6c9' },
  close: {
    background: 'transparent',
    border: '1px solid rgba(120,160,200,0.4)',
    color: '#cfe0f0',
    borderRadius: 6,
    cursor: 'pointer',
    width: 22,
    height: 22,
    lineHeight: '18px',
  },
  field: { display: 'block', marginBottom: 14 },
  fieldRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
  value: { color: '#ffd24a' },
  range: { width: '100%' },
  select: {
    width: '100%',
    background: '#0c121d',
    color: '#dff1ff',
    border: '1px solid rgba(120,160,200,0.4)',
    borderRadius: 6,
    padding: '5px 6px',
  },
  note: { marginTop: 6, color: '#9fb6cc', fontSize: 11, lineHeight: 1.4 },
}
