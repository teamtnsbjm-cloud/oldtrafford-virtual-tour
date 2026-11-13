/**
 * Procedural sound — every sound is synthesised at runtime with WebAudio
 * (filtered noise + oscillators). No recordings, samples or music are used,
 * so there are no licensing concerns. If WebAudio is unavailable or blocked
 * the tour keeps working silently.
 */

export type Surface = 'grass' | 'concrete' | 'indoor' | 'stone'

class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private crowdGain!: GainNode
  private crowdFilter!: BiquadFilterNode
  private chantGain!: GainNode
  private rumbleGain!: GainNode
  private echo!: DelayNode
  private echoGain!: GainNode
  private noise!: AudioBuffer
  private stepNoise!: AudioBuffer
  private muted = false

  get started() {
    return !!this.ctx
  }

  /** Must be called from a user gesture (the "start tour" click). */
  start() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.9
      this.master.connect(ctx.destination)

      // 4 s of brown-ish noise, looped, for crowd beds
      const len = ctx.sampleRate * 4
      this.noise = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = this.noise.getChannelData(ch)
        let last = 0
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1
          last = (last + 0.035 * white) / 1.035
          d[i] = last * 3.2 + white * 0.08
        }
      }
      this.stepNoise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate)
      const sd = this.stepNoise.getChannelData(0)
      for (let i = 0; i < sd.length; i++) sd[i] = Math.random() * 2 - 1

      // crowd bed: band-passed noise
      const bed = ctx.createBufferSource()
      bed.buffer = this.noise
      bed.loop = true
      this.crowdFilter = ctx.createBiquadFilter()
      this.crowdFilter.type = 'bandpass'
      this.crowdFilter.frequency.value = 500
      this.crowdFilter.Q.value = 0.5
      this.crowdGain = ctx.createGain()
      this.crowdGain.gain.value = 0
      bed.connect(this.crowdFilter).connect(this.crowdGain).connect(this.master)
      bed.start()

      // "chant" layer: narrower band with a slow swelling LFO
      const chant = ctx.createBufferSource()
      chant.buffer = this.noise
      chant.loop = true
      chant.playbackRate.value = 1.13
      const cf = ctx.createBiquadFilter()
      cf.type = 'bandpass'
      cf.frequency.value = 820
      cf.Q.value = 2.2
      const swell = ctx.createGain()
      swell.gain.value = 0.55
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.42
      const lfoDepth = ctx.createGain()
      lfoDepth.gain.value = 0.45
      lfo.connect(lfoDepth).connect(swell.gain)
      lfo.start()
      this.chantGain = ctx.createGain()
      this.chantGain.gain.value = 0
      chant.connect(cf).connect(swell).connect(this.chantGain).connect(this.master)
      chant.start()

      // low stadium rumble
      const rum = ctx.createBufferSource()
      rum.buffer = this.noise
      rum.loop = true
      rum.playbackRate.value = 0.7
      const rf = ctx.createBiquadFilter()
      rf.type = 'lowpass'
      rf.frequency.value = 160
      this.rumbleGain = ctx.createGain()
      this.rumbleGain.gain.value = 0
      rum.connect(rf).connect(this.rumbleGain).connect(this.master)
      rum.start()

      // short slap-back echo used for footsteps in enclosed spaces
      this.echo = ctx.createDelay(0.5)
      this.echo.delayTime.value = 0.07
      this.echoGain = ctx.createGain()
      this.echoGain.gain.value = 0
      this.echo.connect(this.echoGain).connect(this.master)
    } catch {
      this.ctx = null
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05)
  }

  /**
   * level 0..1 = how loud the crowd is; openness 0..1 = muffled (inside) → bright (in the bowl).
   * echo 0..1 = how enclosed the space is.
   */
  setAmbience(level: number, openness: number, echo: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    this.crowdGain.gain.setTargetAtTime(level * 0.55, t, 0.6)
    this.chantGain.gain.setTargetAtTime(level * level * 0.5 * openness, t, 0.8)
    this.rumbleGain.gain.setTargetAtTime(level * 0.35, t, 0.6)
    this.crowdFilter.frequency.setTargetAtTime(260 + openness * 900, t, 0.5)
    this.echoGain.gain.setTargetAtTime(echo * 0.35, t, 0.2)
  }

  footstep(surface: Surface, strength = 1) {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.stepNoise
    src.playbackRate.value = 0.85 + Math.random() * 0.3
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = { grass: 650, concrete: 2300, indoor: 3200, stone: 1900 }[surface] * (0.9 + Math.random() * 0.2)
    const g = ctx.createGain()
    const peak = { grass: 0.16, concrete: 0.24, indoor: 0.28, stone: 0.22 }[surface] * strength
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0008, t + (surface === 'grass' ? 0.13 : 0.09))
    src.connect(f).connect(g)
    g.connect(this.master)
    g.connect(this.echo)
    src.start(t)
    src.stop(t + 0.16)
    // heel thump
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(surface === 'grass' ? 70 : 105, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.06)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t)
    og.gain.linearRampToValueAtTime(0.22 * strength, t + 0.005)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(og).connect(this.master)
    o.start(t)
    o.stop(t + 0.08)
  }

  /** A swelling roar when the visitor walks out onto the pitch. */
  cheer() {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(500, t)
    f.frequency.linearRampToValueAtTime(1300, t + 1.2)
    f.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.9)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
    src.connect(f).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 3.8)
  }
}

export const audio = new AudioEngine()
