// ---------------------------------------------------------------------------
// SoundManager.js
// ---------------------------------------------------------------------------
// All audio is SYNTHESISED with the Web Audio API rather than loaded from
// files. That keeps the deploy a single static bundle (no assets to fetch) and
// lets the engine/wind react continuously to the flight state.
//
//   - Engine : layered oscillators + filtered noise; pitch & volume track RPM.
//   - Wind   : filtered noise whose volume tracks airspeed.
//   - Gear / flaps : one-shot mechanical "whirr" bursts on actuation.
//   - Stall  : a pulsing warning horn near the critical angle of attack.
//
// Browsers block audio until a user gesture, so nothing is created until
// init() is called from the first keypress/click.
// ---------------------------------------------------------------------------

class SoundManager {
  constructor() {
    this.ctx = null
    this.ready = false
    this.stallTimer = null
  }

  /** Create the audio graph. Safe to call repeatedly; only builds once. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0.6
    this.master.connect(ctx.destination)

    // Shared looping noise buffer (a couple of seconds of white noise).
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = noiseBuffer

    // --- Engine: low rumble + higher whine + turbine hiss ---
    this.engineLow = ctx.createOscillator()
    this.engineLow.type = 'sawtooth'
    this.engineLowGain = ctx.createGain()
    this.engineLowGain.gain.value = 0
    this.engineLow.connect(this.engineLowGain).connect(this.master)

    this.engineHigh = ctx.createOscillator()
    this.engineHigh.type = 'triangle'
    this.engineHighGain = ctx.createGain()
    this.engineHighGain.gain.value = 0
    this.engineHigh.connect(this.engineHighGain).connect(this.master)

    this.engineNoise = ctx.createBufferSource()
    this.engineNoise.buffer = noiseBuffer
    this.engineNoise.loop = true
    this.engineNoiseFilter = ctx.createBiquadFilter()
    this.engineNoiseFilter.type = 'bandpass'
    this.engineNoiseFilter.frequency.value = 1400
    this.engineNoiseGain = ctx.createGain()
    this.engineNoiseGain.gain.value = 0
    this.engineNoise.connect(this.engineNoiseFilter).connect(this.engineNoiseGain).connect(this.master)

    // --- Wind: filtered noise scaled by airspeed ---
    this.wind = ctx.createBufferSource()
    this.wind.buffer = noiseBuffer
    this.wind.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.frequency.value = 500
    this.windFilter.Q.value = 0.6
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    this.wind.connect(this.windFilter).connect(this.windGain).connect(this.master)

    // --- Stall warning horn ---
    this.stall = ctx.createOscillator()
    this.stall.type = 'square'
    this.stall.frequency.value = 800
    this.stallGain = ctx.createGain()
    this.stallGain.gain.value = 0
    this.stall.connect(this.stallGain).connect(this.master)

    this.engineLow.start()
    this.engineHigh.start()
    this.engineNoise.start()
    this.wind.start()
    this.stall.start()
    this.ready = true
  }

  /**
   * Continuous engine sound. Pitch and volume rise with throttle/RPM.
   * @param {number} throttle 0..1 commanded thrust
   */
  setEngine(throttle) {
    if (!this.ready) return
    const t = this.ctx.currentTime
    // RPM never reaches zero — engines idle. Map throttle to a perceived RPM.
    const rpm = 0.25 + 0.75 * throttle
    this.engineLow.frequency.setTargetAtTime(55 + rpm * 70, t, 0.1)
    this.engineHigh.frequency.setTargetAtTime(180 + rpm * 520, t, 0.1)
    this.engineNoiseFilter.frequency.setTargetAtTime(900 + rpm * 1400, t, 0.1)
    this.engineLowGain.gain.setTargetAtTime(0.16 * rpm, t, 0.15)
    this.engineHighGain.gain.setTargetAtTime(0.05 * rpm, t, 0.15)
    this.engineNoiseGain.gain.setTargetAtTime(0.08 * rpm, t, 0.15)
  }

  /**
   * Wind/airflow noise. Gets louder and brighter with airspeed.
   * @param {number} airspeedMs true airspeed, m/s
   */
  setWind(airspeedMs) {
    if (!this.ready) return
    const t = this.ctx.currentTime
    const f = Math.min(1, airspeedMs / 130) // normalise around cruise speed
    this.windGain.gain.setTargetAtTime(0.35 * f * f, t, 0.2)
    this.windFilter.frequency.setTargetAtTime(350 + f * 900, t, 0.2)
  }

  /**
   * Stall warning horn: pulses on/off while active, silent otherwise.
   * @param {boolean} active
   */
  setStall(active) {
    if (!this.ready) return
    if (active && !this.stallTimer) {
      let on = false
      this.stallTimer = setInterval(() => {
        on = !on
        const t = this.ctx.currentTime
        this.stallGain.gain.setTargetAtTime(on ? 0.18 : 0, t, 0.01)
      }, 180)
    } else if (!active && this.stallTimer) {
      clearInterval(this.stallTimer)
      this.stallTimer = null
      this.stallGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02)
    }
  }

  /** One-shot mechanical whirr for moving the gear or flaps. */
  mechanical(duration = 1.0, baseFreq = 220) {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(baseFreq, t)
    filter.frequency.linearRampToValueAtTime(baseFreq * 2.2, t + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.12, t + 0.08)
    gain.gain.setValueAtTime(0.12, t + duration - 0.1)
    gain.gain.linearRampToValueAtTime(0, t + duration)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(t)
    src.stop(t + duration + 0.05)
  }

  playGear() {
    this.mechanical(4.0, 160)
  }

  playFlaps() {
    this.mechanical(3.0, 260)
  }
}

// Single shared instance for the whole app.
export const soundManager = new SoundManager()
