import { ambientOf, pickAct, pickTheme, SLOT_MINUTES } from './director'
import { ParticleField } from './particles'
import { hashString, mulberry32 } from './rng'
import type { Act, ActDef, AmbientDef, SceneContext, Stage, ThemeDef } from './types'

export interface EngineOptions {
  /** Height of whatever sits along the bottom edge (a ground strip, a nav bar), px. */
  groundInset: number
  /** Called about once a minute, and whenever the engine wakes. */
  getContext: () => SceneContext
  themes: ThemeDef[]
  /** Force one theme and run its acts back to back. For previews. */
  previewTheme?: string | null
  /** Fewer acts, lighter weather. */
  calm?: boolean
  /** Multiplies the size of every character and prop. Default 1. */
  scale?: number
  /** Told whenever a new theme takes the stage, e.g. to change a backdrop. */
  onTheme?: (themeId: string | null, context: SceneContext) => void
}

/** Frame budget while an act is on stage. */
const FRAME_MS = 1000 / 30
/** Frame budget when only the weather is moving: drifting leaves and snow
 *  look the same at 20fps and cost a third less. */
const AMBIENT_FRAME_MS = 1000 / 20
const CONTEXT_REFRESH_MS = 30_000

/**
 * Owns one canvas and its clock. Keep an instance alive across remounts
 * (re-`attach` it) and the pile on the floor and the act schedule survive.
 *
 * It only burns frames while something is moving. Between acts and flurries
 * it draws the resting pile once and sleeps on a timer, which matters on a
 * phone battery and on a wall panel's modest CPU. It also sleeps while the
 * page is hidden or the host says the canvas is scrolled out of view.
 */
export class SceneEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private opts: EngineOptions | null = null
  private field = new ParticleField()
  private w = 0
  private h = 0
  private dpr = 1
  private raf = 0
  private sleepTimer = 0
  private last = 0
  private time = 0
  private context: SceneContext | null = null
  private contextAt = 0
  private theme: ThemeDef | null = null
  private ambient: AmbientDef | undefined
  private slotKey = ''
  private act: Act | null = null
  private actId = ''
  private recent: string[] = []
  private nextActAt = 0
  private lastActEnd = 0
  private spawnCarry = 0
  private previewIndex = 0
  private visible = true
  private onResize = () => this.resize()
  private onVisibility = () => {
    if (document.hidden) this.stop()
    else this.wake()
  }

  attach(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.detach()
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.opts = opts
    this.resize()
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
    const now = Date.now()
    // Greet whoever just opened the app: a phone session is often 20 seconds
    // long and should still catch something. Not again within a minute.
    if (now - this.lastActEnd > 60_000 && !this.act) this.nextActAt = now + 2500
    this.contextAt = 0
    this.wake()
  }

  detach() {
    this.stop()
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.canvas = null
    this.ctx = null
  }

  setOptions(patch: Partial<EngineOptions>) {
    if (!this.opts) return
    const previewChanged = 'previewTheme' in patch && patch.previewTheme !== this.opts.previewTheme
    this.opts = { ...this.opts, ...patch }
    if (previewChanged) {
      this.act = null
      this.previewIndex = 0
      this.slotKey = ''
      this.nextActAt = Date.now() + 600
    }
    this.contextAt = 0
    this.resize()
    this.wake()
  }

  private resize() {
    const c = this.canvas
    if (!c || !this.opts) return
    // The canvas is laid out by CSS, so its own box is the stage and its
    // bottom edge (less the ground inset) is the floor.
    const w = c.clientWidth || window.innerWidth
    const h = c.clientHeight || window.innerHeight
    // Cap the backing store: a 3x phone would push nine times the pixels for
    // art that looks the same at 2x.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (w !== this.w || h !== this.h || dpr !== this.dpr) {
      this.w = w
      this.h = h
      this.dpr = dpr
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    this.field.resize(w, h - this.opts.groundInset, this.unit())
    this.drawFrame()
  }

  private unit() {
    return (this.w >= 1100 && this.h >= 700 ? 1.2 : 1) * (this.opts?.scale ?? 1)
  }

  /** The host's view of whether the canvas can be seen (IntersectionObserver). */
  setVisible(visible: boolean) {
    if (visible === this.visible) return
    this.visible = visible
    if (visible) this.wake()
    else this.stop()
  }

  /** Bring the next act on now, if the stage is free. A tap on the card. */
  poke() {
    if (this.act) return
    this.nextActAt = Date.now()
    this.wake()
  }

  /** Id of the act on stage, or '' between acts. */
  get currentAct(): string {
    return this.act ? this.actId : ''
  }

  /** Id of the theme that owns the current slot. */
  get currentTheme(): string {
    return this.theme?.id ?? ''
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.sleepTimer) window.clearTimeout(this.sleepTimer)
    this.raf = 0
    this.sleepTimer = 0
  }

  private wake() {
    if (!this.canvas || document.hidden || !this.visible) return
    if (this.sleepTimer) window.clearTimeout(this.sleepTimer)
    this.sleepTimer = 0
    if (this.raf) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private stage(): Stage | null {
    if (!this.ctx || !this.opts || !this.context) return null
    return {
      ctx: this.ctx,
      w: this.w,
      h: this.h,
      ground: this.h - this.opts.groundInset,
      u: this.unit(),
      time: this.time,
      particles: this.field,
      context: this.context,
    }
  }

  private refreshContext(now: number) {
    if (!this.opts) return
    if (this.context && now - this.contextAt < CONTEXT_REFRESH_MS) return
    this.contextAt = now
    const c = this.opts.getContext()
    this.context = c
    const forced = this.opts.previewTheme ? this.opts.themes.find((t) => t.id === this.opts!.previewTheme) : undefined
    const theme = forced ?? pickTheme(c, this.opts.themes) ?? null
    const slot = Math.floor(c.minutes / SLOT_MINUTES)
    const key = `${theme?.id}-${c.day}-${slot}`
    if (key === this.slotKey) return
    const first = this.slotKey === ''
    this.slotKey = key
    const prevKind = this.ambient?.kind
    this.theme = theme
    this.opts.onTheme?.(theme?.id ?? null, c)
    this.ambient = theme ? ambientOf(theme, c) : undefined
    this.field.configure(this.ambient)
    if (this.ambient?.settle && (first || prevKind !== this.ambient.kind)) {
      // Opening the app should not always find a bare floor. Seed the pile as
      // if the weather had been going for part of this slot.
      const rng = mulberry32(hashString(key))
      const into = (c.minutes % SLOT_MINUTES) / SLOT_MINUTES
      this.field.prefill(0.25 + into * 0.5, this.ambient, rng)
    }
  }

  private flurryOn(now: number): boolean {
    const a = this.ambient
    if (!a) return false
    const cycle = (a.flurry[0] + a.flurry[1]) * 1000
    return now % cycle < a.flurry[0] * 1000
  }

  private nextFlurryStart(now: number): number {
    const a = this.ambient
    if (!a) return Infinity
    const cycle = (a.flurry[0] + a.flurry[1]) * 1000
    return now - (now % cycle) + cycle
  }

  private spawnAmbient(dt: number, now: number) {
    const a = this.ambient
    if (!a || !this.flurryOn(now)) return
    // Ease the flurry in and out rather than switching it like a tap.
    const cycle = (a.flurry[0] + a.flurry[1]) * 1000
    const p = (now % cycle) / (a.flurry[0] * 1000)
    const envelope = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI)
    const rate = a.rate * (this.w / 1000) * (this.opts?.calm ? 0.5 : 1) * (0.35 + envelope * 0.65)
    this.spawnCarry += rate * dt
    const u = this.unit()
    const [s0, s1] = a.size ?? [4, 7]
    while (this.spawnCarry >= 1) {
      this.spawnCarry -= 1
      const ground = this.h - (this.opts?.groundInset ?? 0)
      this.field.emit({
        kind: a.kind,
        x: Math.random() * this.w,
        y: a.rising ? ground - 2 : -12,
        size: (s0 + Math.random() * (s1 - s0)) * u,
        color: a.colors[Math.floor(Math.random() * a.colors.length)],
        settle: a.settle,
        ...(a.rising ? { life: 5 + Math.random() * 6 } : { vy: (26 + Math.random() * 22) * u }),
      })
    }
  }

  private castNext(now: number) {
    const stage = this.stage()
    if (!stage || !this.theme || !this.context || !this.opts) return
    let def: ActDef | undefined
    if (this.opts.previewTheme) {
      // In preview, play every act in order, ignoring its usual conditions.
      const acts = this.theme.acts
      def = acts[this.previewIndex % Math.max(1, acts.length)]
      this.previewIndex++
    } else {
      def = pickAct(this.theme, this.context, this.recent, this.field.fullness())
    }
    if (!def) {
      this.nextActAt = now + 60_000
      return
    }
    this.act = def.create(stage, Math.random)
    this.actId = def.id
  }

  private scheduleNext(now: number) {
    this.lastActEnd = now
    this.recent = [this.actId, ...this.recent].slice(0, 2)
    if (this.opts?.previewTheme) {
      this.nextActAt = now + 1500
      return
    }
    const base = this.theme?.actEvery ?? 55
    const night = this.context?.dayPart === 'night' ? 2.2 : 1
    const calm = this.opts?.calm ? 2 : 1
    this.nextActAt = now + base * night * calm * (0.6 + Math.random() * 0.8) * 1000
  }

  private tick = (t: number) => {
    this.raf = 0
    const elapsed = t - this.last
    if (elapsed < (this.act ? FRAME_MS : AMBIENT_FRAME_MS) - 2) {
      this.raf = requestAnimationFrame(this.tick)
      return
    }
    this.last = t
    const dt = Math.min(0.05, elapsed / 1000)
    this.time += dt
    const now = Date.now()
    this.refreshContext(now)
    const stage = this.stage()
    if (!stage) return

    this.spawnAmbient(dt, now)
    if (!this.act && now >= this.nextActAt) this.castNext(now)
    if (this.act) {
      let alive = false
      try {
        alive = this.act.update(stage, dt)
      } catch {
        alive = false
      }
      if (!alive) {
        this.act = null
        this.scheduleNext(now)
      }
    }
    this.field.update(dt)
    this.drawFrame()

    if (this.act || this.field.moving || this.flurryOn(now)) {
      this.raf = requestAnimationFrame(this.tick)
      return
    }
    // Nothing is moving. Sleep until the next act or flurry is due.
    const wakeAt = Math.min(this.nextActAt, this.nextFlurryStart(now), now + CONTEXT_REFRESH_MS)
    this.sleepTimer = window.setTimeout(() => {
      this.sleepTimer = 0
      this.wake()
    }, Math.max(50, wakeAt - now))
  }

  /**
   * The resting pile can be hundreds of leaves. Draw it once into a bitmap
   * strip along the floor and reuse that until the pile actually changes,
   * rather than stroking every leaf on every frame.
   */
  private pileCanvas: HTMLCanvasElement | null | undefined
  private pileVersion = -1
  private pileKey = ''

  private drawPile(ctx: CanvasRenderingContext2D) {
    const f = this.field
    if (this.pileCanvas === undefined) {
      try {
        this.pileCanvas = document.createElement('canvas')
      } catch {
        this.pileCanvas = null
      }
    }
    const pc = this.pileCanvas
    const pctx = pc?.getContext('2d')
    if (!pc || !pctx) {
      f.drawPile(ctx)
      return
    }
    const ground = this.h - (this.opts?.groundInset ?? 0)
    const strip = Math.ceil(f.maxPile + 44 * this.unit())
    const top = Math.max(0, Math.floor((ground - strip) * this.dpr))
    const pw = Math.round(this.w * this.dpr)
    const ph = Math.round(this.h * this.dpr) - top
    const key = `${pw}x${ph}@${top}`
    if (key !== this.pileKey) {
      pc.width = pw
      pc.height = Math.max(1, ph)
      this.pileKey = key
      this.pileVersion = -1
    }
    if (f.version !== this.pileVersion) {
      pctx.setTransform(1, 0, 0, 1, 0, 0)
      pctx.clearRect(0, 0, pc.width, pc.height)
      pctx.setTransform(this.dpr, 0, 0, this.dpr, 0, -top)
      f.drawPile(pctx)
      this.pileVersion = f.version
    }
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(pc, 0, top)
    ctx.restore()
  }

  private drawFrame() {
    const ctx = this.ctx
    if (!ctx) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)
    this.drawPile(ctx)
    const stage = this.stage()
    if (stage && this.act) {
      ctx.save()
      try {
        this.act.draw(stage)
      } catch {
        this.act = null
      }
      ctx.restore()
      ctx.globalAlpha = 1
    }
    this.field.draw(ctx)
  }
}

