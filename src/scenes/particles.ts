import { C, TAU, alpha, clamp, heart, star, type Ctx } from './draw'
import type { AmbientDef, ParticleKind, Rng } from './types'

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  /** Gravity, px/s². Negative rises. */
  g: number
  /** Velocity kept per second, 0..1. 1 = no drag. */
  drag: number
  rot: number
  vr: number
  size: number
  color: string
  age: number
  /** Seconds before it is removed. Fades out over the last 30%. */
  life: number
  /** Comes to rest on the floor and joins the pile. */
  settle: boolean
  /** Side-to-side drift amplitude, px/s. */
  sway: number
  phase: number
  variant: number
}

interface RestItem {
  kind: ParticleKind
  x: number
  y: number
  rot: number
  size: number
  color: string
  variant: number
}

const BUCKET = 8
const REST_CAP = 420

const DEFAULTS: Record<ParticleKind, Partial<Particle>> = {
  leaf: { vy: 34, g: 0, drag: 1, sway: 26, vr: 1.4, life: 60 },
  snow: { vy: 30, g: 0, drag: 1, sway: 10, vr: 0, life: 60 },
  petal: { vy: 26, g: 0, drag: 1, sway: 20, vr: 1.8, life: 60 },
  confetti: { vy: 46, g: 0, drag: 1, sway: 18, vr: 5, life: 60 },
  bubble: { vy: -34, g: 0, drag: 1, sway: 9, vr: 0, life: 7 },
  note: { vy: -22, g: 0, drag: 0.9, sway: 8, vr: 0, life: 2.6 },
  spark: { g: 160, drag: 0.6, sway: 0, vr: 0, life: 0.9 },
  ember: { vy: -30, g: -10, drag: 0.8, sway: 10, vr: 0, life: 1.6 },
  seed: { vy: 8, g: 0, drag: 1, sway: 12, vr: 0.3, life: 40 },
  heart: { vy: -26, g: 0, drag: 0.9, sway: 10, vr: 0, life: 2.4 },
  star: { g: 60, drag: 0.7, sway: 0, vr: 3, life: 1.2 },
  dust: { g: -8, drag: 0.25, sway: 0, vr: 0, life: 0.8 },
  drop: { g: 420, drag: 1, sway: 0, vr: 0, life: 3 },
}

/**
 * Every loose thing on screen: falling leaves, snow, notes, sparks, and the
 * pile they build on the floor. Acts emit into it and can blast or sweep the
 * pile, which is how the leaf blower and the snow shovel earn their keep.
 */
export class ParticleField {
  list: Particle[] = []
  private rest: RestItem[] = []
  private heights = new Float32Array(0)
  private w = 0
  private ground = 0
  private u = 1
  pileMode: 'items' | 'drift' = 'items'
  /** Bumped whenever the resting pile changes, so the engine can cache its bitmap. */
  version = 0
  /** Tallest the pile may get, px. */
  maxPile = 12
  private pileColor: string = C.white

  resize(w: number, ground: number, u: number) {
    const n = Math.ceil(w / BUCKET) + 1
    if (n !== this.heights.length) {
      const next = new Float32Array(n)
      next.set(this.heights.subarray(0, Math.min(n, this.heights.length)))
      this.heights = next
    }
    // Resting pieces sit relative to the floor, so move them with it.
    const dy = ground - this.ground
    if (this.ground !== 0 && dy !== 0) for (const r of this.rest) r.y += dy
    this.version++
    this.w = w
    this.ground = ground
    this.u = u
  }

  /** Configure the pile for an ambient. Clears the old pile if the kind changes. */
  configure(ambient: AmbientDef | undefined) {
    const mode = ambient?.pile ?? 'items'
    const max = (ambient?.maxPile ?? 10) * this.u
    if (mode !== this.pileMode || !ambient?.settle) this.clearPile()
    this.pileMode = mode
    this.maxPile = max
    this.pileColor = ambient?.colors[0] ?? C.white
  }

  clearPile() {
    this.rest = []
    this.heights.fill(0)
    this.version++
  }

  clearAll() {
    this.list = []
    this.clearPile()
  }

  emit(p: Partial<Particle> & { kind: ParticleKind; x: number; y: number }): Particle {
    const d = DEFAULTS[p.kind]
    const full: Particle = {
      vx: 0,
      vy: 0,
      g: 0,
      drag: 1,
      rot: Math.random() * TAU,
      vr: 0,
      size: 4,
      color: C.white,
      age: 0,
      life: 4,
      settle: false,
      sway: 0,
      phase: Math.random() * TAU,
      variant: Math.floor(Math.random() * 3),
      ...d,
      ...p,
    }
    if (this.list.length < 700) this.list.push(full)
    return full
  }

  heightAt(x: number): number {
    const i = clamp(Math.round(x / BUCKET), 0, this.heights.length - 1)
    return this.heights[i] ?? 0
  }

  /** 0..1, how full the floor is. */
  fullness(): number {
    if (this.heights.length === 0 || this.maxPile <= 0) return 0
    let sum = 0
    for (let i = 0; i < this.heights.length; i++) sum += this.heights[i]
    return clamp(sum / this.heights.length / (this.maxPile * 0.62))
  }

  private settleAt(p: { kind: ParticleKind; x: number; size: number; color: string; rot: number; variant: number }) {
    const i = clamp(Math.round(p.x / BUCKET), 0, this.heights.length - 1)
    const h = this.heights[i]
    this.version++
    if (this.pileMode === 'items' && this.rest.length < REST_CAP && h < this.maxPile) {
      this.rest.push({
        kind: p.kind,
        x: p.x,
        y: this.ground - h - p.size * 0.25,
        rot: p.kind === 'leaf' || p.kind === 'petal' ? (Math.random() - 0.5) * 0.9 : p.rot,
        size: p.size,
        color: p.color,
        variant: p.variant,
      })
    }
    const add = p.size * (this.pileMode === 'drift' ? 0.34 : 0.2)
    for (let k = -2; k <= 2; k++) {
      const j = i + k
      if (j < 0 || j >= this.heights.length) continue
      const share = k === 0 ? 1 : Math.abs(k) === 1 ? 0.6 : 0.25
      this.heights[j] = Math.min(this.maxPile, this.heights[j] + add * share)
    }
  }

  /** Lay down part of a pile instantly, as if it had been falling for a while. */
  prefill(fraction: number, ambient: AmbientDef, rng: Rng) {
    if (!ambient.settle || this.w <= 0) return
    const [s0, s1] = ambient.size ?? [4, 7]
    const target = clamp(fraction) * 0.62 * this.maxPile
    let guard = 0
    const mean = () => {
      let sum = 0
      for (let i = 0; i < this.heights.length; i++) sum += this.heights[i]
      return sum / this.heights.length
    }
    while (mean() < target && guard++ < 4000) {
      this.settleAt({
        kind: ambient.kind,
        x: rng() * this.w,
        size: (s0 + rng() * (s1 - s0)) * this.u,
        color: ambient.colors[Math.floor(rng() * ambient.colors.length)],
        rot: rng() * TAU,
        variant: Math.floor(rng() * 3),
      })
    }
  }

  /**
   * Throw the pile near `x` into the air. `dir` is the way the wind blows
   * (1 right, -1 left) and `power` the launch speed in px/s.
   * Returns how many pieces it lifted.
   */
  blast(x: number, radius: number, dir: number, power: number): number {
    let lifted = 0
    if (this.pileMode === 'items') {
      const keep: RestItem[] = []
      for (const r of this.rest) {
        if (Math.abs(r.x - x) <= radius) {
          lifted++
          this.emit({
            kind: r.kind,
            x: r.x,
            y: r.y,
            vx: dir * power * (0.55 + Math.random() * 0.9),
            vy: -power * (0.25 + Math.random() * 0.75),
            g: 150,
            drag: 0.55,
            sway: 0,
            vr: (Math.random() - 0.5) * 14,
            size: r.size,
            color: r.color,
            variant: r.variant,
            rot: r.rot,
            life: 2.6,
            settle: false,
          })
        } else keep.push(r)
      }
      this.rest = keep
    }
    const i0 = clamp(Math.floor((x - radius) / BUCKET), 0, this.heights.length - 1)
    const i1 = clamp(Math.ceil((x + radius) / BUCKET), 0, this.heights.length - 1)
    let flattened = false
    for (let i = i0; i <= i1; i++) {
      const h = this.heights[i]
      if (h > 0) flattened = true
      if (this.pileMode === 'drift' && h > 1.5 && Math.random() < 0.5) {
        lifted++
        this.emit({
          kind: 'snow',
          x: i * BUCKET,
          y: this.ground - h * Math.random(),
          vx: dir * power * (0.4 + Math.random() * 0.8),
          vy: -power * (0.3 + Math.random() * 0.8),
          g: 220,
          drag: 0.5,
          sway: 0,
          size: (2 + Math.random() * 3) * this.u,
          color: this.pileColor,
          life: 1.8,
          settle: false,
        })
      }
      this.heights[i] = 0
    }
    if (lifted > 0 || flattened) this.version++
    return lifted
  }

  /** Remove the pile between two x positions without throwing it anywhere. */
  sweep(x0: number, x1: number): number {
    const lo = Math.min(x0, x1)
    const hi = Math.max(x0, x1)
    const before = this.rest.length
    this.rest = this.rest.filter((r) => r.x < lo || r.x > hi)
    let removed = before - this.rest.length
    const i0 = clamp(Math.floor(lo / BUCKET), 0, this.heights.length - 1)
    const i1 = clamp(Math.ceil(hi / BUCKET), 0, this.heights.length - 1)
    for (let i = i0; i <= i1; i++) {
      if (this.heights[i] > 0.5) removed++
      if (this.heights[i] > 0) this.version++
      this.heights[i] = 0
    }
    if (removed > 0) this.version++
    return removed
  }

  get moving(): boolean {
    return this.list.length > 0
  }

  update(dt: number) {
    const out: Particle[] = []
    for (const p of this.list) {
      p.age += dt
      if (p.age >= p.life) continue
      p.vy += p.g * dt
      if (p.drag !== 1) {
        const k = Math.pow(p.drag, dt)
        p.vx *= k
        p.vy *= k
      }
      p.phase += dt * 2.2
      p.x += (p.vx + Math.sin(p.phase) * p.sway) * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt * (p.sway ? Math.cos(p.phase * 0.7) : 1)
      if (p.x < -60 || p.x > this.w + 60 || p.y < -80) continue
      const floor = this.ground - this.heightAt(p.x)
      if (p.y >= floor - p.size * 0.2 && p.vy >= 0) {
        if (p.settle) {
          this.settleAt(p)
          continue
        }
        if (p.kind === 'drop' || p.kind === 'spark' || p.kind === 'ember') continue
        // Loose bits that are not part of the pile skid to a stop and fade.
        p.y = floor - p.size * 0.2
        p.vy = 0
        p.vx *= Math.pow(0.02, dt)
        p.vr *= Math.pow(0.02, dt)
        p.life = Math.min(p.life, p.age + 0.9)
      }
      out.push(p)
    }
    this.list = out
  }

  drawPile(ctx: Ctx) {
    if (this.pileMode === 'drift') this.drawDrift(ctx)
    else for (const r of this.rest) drawPiece(ctx, r.kind, r.x, r.y, r.size, r.rot, r.color, r.variant, 1, 0)
  }

  private drawDrift(ctx: Ctx) {
    const n = this.heights.length
    let any = false
    for (let i = 0; i < n; i++) if (this.heights[i] > 0.6) any = true
    if (!any) return
    const smooth = (i: number) => {
      let s = 0
      let c = 0
      for (let k = -2; k <= 2; k++) {
        const j = i + k
        if (j < 0 || j >= n) continue
        s += this.heights[j]
        c++
      }
      return s / c
    }
    ctx.beginPath()
    ctx.moveTo(0, this.ground + 1)
    for (let i = 0; i < n; i++) ctx.lineTo(i * BUCKET, this.ground - smooth(i))
    ctx.lineTo(this.w, this.ground + 1)
    ctx.closePath()
    ctx.fillStyle = alpha(this.pileColor, 0.92)
    ctx.fill()
    // A cool shadow line along the base gives the drift some weight.
    ctx.beginPath()
    ctx.moveTo(0, this.ground + 1)
    for (let i = 0; i < n; i++) ctx.lineTo(i * BUCKET, this.ground - smooth(i) * 0.35)
    ctx.lineTo(this.w, this.ground + 1)
    ctx.closePath()
    ctx.fillStyle = 'rgba(125,170,220,0.28)'
    ctx.fill()
  }

  draw(ctx: Ctx) {
    for (const p of this.list) {
      const left = p.life - p.age
      const fade = clamp(left / (p.life * 0.3))
      const a = Math.min(1, fade, p.age * 6)
      drawPiece(ctx, p.kind, p.x, p.y, p.size, p.rot, p.color, p.variant, a, p.phase)
    }
  }
}

function drawPiece(
  ctx: Ctx,
  kind: ParticleKind,
  x: number,
  y: number,
  s: number,
  rot: number,
  color: string,
  variant: number,
  a: number,
  phase: number,
) {
  if (a <= 0.01) return
  ctx.save()
  ctx.globalAlpha = a
  ctx.translate(x, y)
  switch (kind) {
    case 'leaf': {
      ctx.rotate(rot)
      ctx.beginPath()
      if (variant === 2) {
        // A lobed, maple-ish leaf.
        ctx.moveTo(-s, 0)
        ctx.lineTo(-s * 0.3, -s * 0.35)
        ctx.lineTo(-s * 0.45, -s * 0.85)
        ctx.lineTo(s * 0.1, -s * 0.5)
        ctx.lineTo(s * 0.95, -s * 0.35)
        ctx.lineTo(s * 0.55, 0)
        ctx.lineTo(s * 0.95, s * 0.35)
        ctx.lineTo(s * 0.1, s * 0.5)
        ctx.lineTo(-s * 0.45, s * 0.85)
        ctx.lineTo(-s * 0.3, s * 0.35)
      } else {
        const fat = variant === 1 ? 0.78 : 0.55
        ctx.moveTo(-s, 0)
        ctx.quadraticCurveTo(0, -s * fat * 1.6, s, 0)
        ctx.quadraticCurveTo(0, s * fat * 1.6, -s, 0)
      }
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-s * 1.35, 0)
      ctx.lineTo(s * 0.7, 0)
      ctx.lineWidth = Math.max(0.6, s * 0.12)
      ctx.strokeStyle = 'rgba(40,20,5,0.45)'
      ctx.stroke()
      break
    }
    case 'petal': {
      ctx.rotate(rot)
      ctx.beginPath()
      ctx.ellipse(0, 0, s, s * 0.55, 0, 0, TAU)
      ctx.fillStyle = color
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(s * 0.25, 0, s * 0.4, s * 0.2, 0, 0, TAU)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fill()
      break
    }
    case 'snow': {
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.5, 0, TAU)
      ctx.fillStyle = color
      ctx.fill()
      break
    }
    case 'confetti': {
      ctx.rotate(rot)
      ctx.scale(1, Math.cos(phase * 2.5) * 0.85 + 0.15)
      ctx.fillStyle = color
      if (variant === 0) {
        ctx.beginPath()
        ctx.arc(0, 0, s * 0.5, 0, TAU)
        ctx.fill()
      } else ctx.fillRect(-s * 0.6, -s * 0.3, s * 1.2, s * 0.6)
      break
    }
    case 'bubble': {
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, TAU)
      ctx.fillStyle = alpha(C.sky, 0.12)
      ctx.fill()
      ctx.lineWidth = Math.max(0.8, s * 0.16)
      ctx.strokeStyle = alpha(C.sky, 0.85)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(-s * 0.35, -s * 0.35, s * 0.22, 0, TAU)
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fill()
      break
    }
    case 'note': {
      ctx.rotate(Math.sin(phase) * 0.25)
      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, s * 0.22)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.ellipse(0, 0, s * 0.62, s * 0.46, -0.4, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(s * 0.52, -s * 0.1)
      ctx.lineTo(s * 0.52, -s * 2)
      ctx.stroke()
      if (variant === 0) {
        ctx.beginPath()
        ctx.moveTo(s * 0.52, -s * 2)
        ctx.quadraticCurveTo(s * 1.5, -s * 1.6, s * 1.2, -s * 0.8)
        ctx.stroke()
      } else if (variant === 1) {
        ctx.beginPath()
        ctx.ellipse(s * 1.8, -s * 0.4, s * 0.62, s * 0.46, -0.4, 0, TAU)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(s * 2.32, -s * 0.5)
        ctx.lineTo(s * 2.32, -s * 2.4)
        ctx.lineTo(s * 0.52, -s * 2)
        ctx.stroke()
      }
      break
    }
    case 'heart':
      heart(ctx, 0, 0, s, color)
      break
    case 'star':
      star(ctx, 0, 0, s, color, rot)
      break
    case 'spark':
    case 'ember': {
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.5, 0, TAU)
      ctx.fillStyle = color
      ctx.fill()
      break
    }
    case 'dust': {
      ctx.globalAlpha = a * 0.5
      ctx.beginPath()
      ctx.arc(0, 0, s * (0.6 + phase * 0.12), 0, TAU)
      ctx.fillStyle = color
      ctx.fill()
      break
    }
    case 'drop': {
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.quadraticCurveTo(s * 0.8, s * 0.3, 0, s * 0.6)
      ctx.quadraticCurveTo(-s * 0.8, s * 0.3, 0, -s)
      ctx.fillStyle = color
      ctx.fill()
      break
    }
    case 'seed': {
      ctx.rotate(Math.sin(phase) * 0.3)
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(0.6, s * 0.1)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, s)
      ctx.lineTo(0, -s * 0.2)
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(0, -s * 0.2)
        ctx.lineTo(i * s * 0.35, -s)
      }
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}
