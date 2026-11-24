import { C, TAU, alpha, clamp, fillCirc, fillRR, type Ctx } from './draw'
import type { Act, Rng, Stage } from './types'

// Small helpers every act uses. Keeping them here means an act file is mostly
// story: who walks on, what goes wrong, how they leave.

/**
 * Wrap a time-driven performance as an Act. `t` is seconds since the act
 * started. Return false from `update` (or pass `duration`) to end it.
 */
export function makeAct(spec: {
  duration?: number
  update?: (stage: Stage, dt: number, t: number) => boolean | void
  draw: (stage: Stage, t: number) => void
}): Act {
  let t = 0
  return {
    update(stage, dt) {
      t += dt
      if (spec.duration !== undefined && t >= spec.duration) return false
      return spec.update?.(stage, dt, t) !== false
    },
    draw(stage) {
      spec.draw(stage, t)
    },
  }
}

/** Which way an act travels, and where "just off screen" is on each side. */
export interface Crossing {
  dir: 1 | -1
  /** x just off the entry edge. */
  from: number
  /** x just off the exit edge. */
  to: number
}

/** Pick a side to enter from. `margin` is how far off screen to start, in units. */
export function crossing(stage: Stage, rng: Rng, margin = 40): Crossing {
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1
  const m = margin * stage.u
  return dir === 1 ? { dir, from: -m, to: stage.w + m } : { dir, from: stage.w + m, to: -m }
}

/** True for a few frames every few seconds. `seed` staggers different characters. */
export function blinking(time: number, seed = 0): boolean {
  return (time * 0.37 + seed * 0.61) % 1 > 0.955
}

/** A small rounded speech bubble with a symbol or short word in it. */
export function bubble(ctx: Ctx, x: number, y: number, text: string, opts: { color?: string; bg?: string; size?: number } = {}) {
  const size = opts.size ?? 11
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`
  const w = Math.max(size * 1.5, ctx.measureText(text).width + size * 0.9)
  const h = size * 1.55
  fillRR(ctx, x - w / 2, y - h, w, h, h / 2, opts.bg ?? alpha(C.white, 0.95))
  ctx.beginPath()
  ctx.moveTo(x - 3, y - 1)
  ctx.lineTo(x, y + 4)
  ctx.lineTo(x + 3, y - 1)
  ctx.closePath()
  ctx.fillStyle = opts.bg ?? alpha(C.white, 0.95)
  ctx.fill()
  ctx.fillStyle = opts.color ?? C.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y - h / 2 + 0.5)
}

/** Sleepy Zs drifting up from (x, y). */
export function zzz(ctx: Ctx, x: number, y: number, time: number, color: string = C.sky) {
  for (let i = 0; i < 3; i++) {
    const p = (time * 0.45 + i / 3) % 1
    ctx.globalAlpha = clamp(1 - p) * clamp(p * 5)
    ctx.font = `700 ${7 + p * 7}px Inter, system-ui, sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('z', x + p * 12 + Math.sin(p * 6 + i) * 2, y - p * 22)
  }
  ctx.globalAlpha = 1
}

/** Little motion lines behind something moving fast. Draw in unit space. */
export function speedLines(ctx: Ctx, x: number, y: number, len: number, time: number, color: string = C.white) {
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 3; i++) {
    const p = (time * 3 + i * 0.37) % 1
    ctx.globalAlpha = (1 - p) * 0.6
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(x - p * len, y + (i - 1) * 5)
    ctx.lineTo(x - p * len - len * 0.5, y + (i - 1) * 5)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** Beads of sweat flying off a head. Unit space. */
export function sweat(ctx: Ctx, x: number, y: number, time: number) {
  for (let i = 0; i < 2; i++) {
    const p = (time * 1.6 + i * 0.5) % 1
    ctx.globalAlpha = 1 - p
    fillCirc(ctx, x - 4 - p * 9 - i * 3, y - p * 7 + p * p * 10, 1.4, C.sky)
  }
  ctx.globalAlpha = 1
}

/** A bunting-style banner of text strung between two points. Unit space. */
export function banner(ctx: Ctx, x: number, y: number, text: string, opts: { bg?: string; color?: string; size?: number; wave?: number } = {}) {
  const size = opts.size ?? 10
  ctx.font = `800 ${size}px Inter, system-ui, sans-serif`
  const w = ctx.measureText(text).width + size * 1.6
  const h = size * 1.9
  const wave = opts.wave ?? 0
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(wave) * 0.03)
  ctx.beginPath()
  ctx.moveTo(-w / 2, -h / 2)
  ctx.quadraticCurveTo(0, -h / 2 + Math.sin(wave) * 2.5, w / 2, -h / 2)
  ctx.lineTo(w / 2 - 5, 0)
  ctx.lineTo(w / 2, h / 2)
  ctx.quadraticCurveTo(0, h / 2 + Math.sin(wave) * 2.5, -w / 2, h / 2)
  ctx.lineTo(-w / 2 + 5, 0)
  ctx.closePath()
  ctx.fillStyle = opts.bg ?? C.crimson
  ctx.fill()
  ctx.fillStyle = opts.color ?? C.white
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0.5)
  ctx.restore()
  return w
}

/** A burst of particles, for pops, puffs and landings. Positions in px. */
export function burst(
  stage: Stage,
  kind: Parameters<Stage['particles']['emit']>[0]['kind'],
  x: number,
  y: number,
  count: number,
  colors: readonly string[],
  speed = 90,
  size: [number, number] = [2, 4],
) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU
    const v = speed * (0.4 + Math.random() * 0.8) * stage.u
    stage.particles.emit({
      kind,
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - speed * 0.3,
      size: (size[0] + Math.random() * (size[1] - size[0])) * stage.u,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}
