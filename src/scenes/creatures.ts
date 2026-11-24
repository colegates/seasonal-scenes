import { C, TAU, fillCirc, fillEll, fillRR, line, poly, shade, type Ctx } from './draw'

// Animals shared between scenes. Same conventions as the person rig: authored
// facing right, feet at (0, 0), y negative up. Mirror and scale with `at()`.

export interface DogPose {
  /** Run cycle phase, radians. About 14 per second at a trot. */
  run?: number
  /** 0 standing, 1 full gallop. */
  stride?: number
  /** Tail wag phase. */
  wag?: number
  mouthOpen?: boolean
  sitting?: boolean
  /** Ears and head tilt, for listening. */
  tilt?: number
}

export interface DogLook {
  coat: string
  patch?: string
  collar?: string
}

export const DOG: DogLook = { coat: '#c98d4b', patch: '#f3dcb8', collar: C.red }

/**
 * A scruffy medium dog, about 30 units long and 24 tall. Returns the mouth
 * position so the caller can put a ball, a leaf or a stolen sausage in it.
 */
export function drawDog(ctx: Ctx, look: DogLook = DOG, pose: DogPose = {}): { mouth: { x: number; y: number }; back: { x: number; y: number } } {
  const run = pose.run ?? 0
  const stride = pose.stride ?? 0
  const sit = pose.sitting ? 1 : 0
  const bounce = Math.abs(Math.sin(run)) * 2.2 * stride
  const dark = shade(look.coat, -0.22)
  ctx.save()
  ctx.translate(0, -bounce)
  ctx.rotate(-sit * 0.38)
  const legLen = 9
  const leg = (x: number, phase: number, far: boolean) => {
    const a = Math.sin(run + phase) * 0.75 * stride
    const fx = x + Math.sin(a) * legLen
    const fy = -legLen + Math.cos(a) * legLen
    line(ctx, x, -legLen, fx, Math.min(bounce, fy + bounce * 0.4), 3.6, far ? dark : look.coat)
  }
  // Tail.
  const wag = Math.sin(pose.wag ?? run * 0.8) * 0.5
  poly(ctx, [-13, -15, -18 - wag * 3, -21, -19 - wag * 6, -27], 3, look.coat)
  // Far legs.
  leg(-9, Math.PI, true)
  leg(8, 0.4, true)
  // Body.
  fillEll(ctx, 0, -14, 15, 7.6, look.coat)
  if (look.patch) fillEll(ctx, 2, -10.5, 10, 3.6, look.patch)
  // Near legs.
  leg(-11, 0, false)
  leg(10, Math.PI + 0.4, false)
  ctx.restore()
  // Head: stays more level than the body when sitting.
  const hx = 15 - sit * 4
  const hy = -20 - bounce - sit * 8
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(pose.tilt ?? 0)
  fillEll(ctx, -3, 3.5, 5, 6, look.coat, 0.5)
  if (look.collar) fillRR(ctx, -7.5, 3.4, 8, 2.6, 1.3, look.collar)
  fillCirc(ctx, 0, 0, 7, look.coat)
  fillRR(ctx, 2, -1.5, 10.5, 6.6, 3.3, look.patch ?? shade(look.coat, 0.18))
  fillCirc(ctx, 12, 0.2, 1.9, C.ink)
  if (pose.mouthOpen) {
    fillRR(ctx, 4, 4.4, 7, 3.4, 1.6, '#7f1d1d')
    fillEll(ctx, 8, 7.2, 2.2, 2.8, C.rose)
  }
  fillCirc(ctx, 3.4, -2.6, 1.5, C.ink)
  fillCirc(ctx, 3.9, -3.1, 0.5, C.white)
  // Floppy ear, flapping at a run.
  const flap = Math.sin(run * 1.1) * 0.4 * stride
  ctx.save()
  ctx.translate(-3.5, -4.5)
  ctx.rotate(0.35 + flap)
  fillEll(ctx, 0, 4.5, 3.2, 6, dark)
  ctx.restore()
  ctx.restore()
  const m = { x: hx + 11, y: hy + 4.5 }
  return { mouth: m, back: { x: 0, y: -22 - bounce } }
}

/** A red squirrel, about 18 units tall. `hop` is 0..1 through one bound. */
export function drawSquirrel(ctx: Ctx, hop = 0, carrying = false, color = '#c2622d') {
  const lift = Math.sin(hop * Math.PI) * 7
  const stretch = Math.sin(hop * Math.PI) * 0.25
  ctx.save()
  ctx.translate(0, -lift)
  // Tail: a big S curl behind.
  ctx.beginPath()
  ctx.moveTo(-6, -4)
  ctx.bezierCurveTo(-20, -4, -19, -24 - stretch * 10, -8, -22)
  ctx.bezierCurveTo(-14, -18, -12, -10, -4, -9)
  ctx.closePath()
  ctx.fillStyle = shade(color, 0.12)
  ctx.fill()
  ctx.rotate(-stretch)
  fillEll(ctx, 0, -7, 7.5, 6, color, -0.3)
  fillEll(ctx, 1.5, -5, 4.5, 3.4, '#f6e2c4', -0.3)
  // Legs.
  fillEll(ctx, -3 - stretch * 8, -1.5, 4.2, 2, shade(color, -0.2))
  fillEll(ctx, 5 + stretch * 8, -2 + stretch * 3, 3, 1.6, shade(color, -0.2))
  // Head.
  fillCirc(ctx, 8, -13, 4.8, color)
  fillEll(ctx, 11.4, -11.6, 2.6, 2.2, '#f6e2c4')
  ctx.beginPath()
  ctx.moveTo(5, -16.5)
  ctx.lineTo(5.6, -21.5)
  ctx.lineTo(8.6, -17.2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  fillCirc(ctx, 9.4, -14, 1.1, C.ink)
  fillCirc(ctx, 13.4, -12, 0.8, C.ink)
  if (carrying) {
    fillEll(ctx, 14.5, -9, 2.6, 3, '#8b5a2b')
    fillEll(ctx, 14.5, -11.2, 2.9, 1.5, '#5a3a1a')
  }
  ctx.restore()
}

/** A small round bird, about 9 units tall. `flap` phase in radians; 0 = perched. */
export function drawBird(ctx: Ctx, flap = 0, flying = false, body = '#8b6b4a', breast = '#e2552d') {
  fillEll(ctx, 0, -5, 5.2, 4.4, body)
  fillEll(ctx, 2, -4, 3.2, 3, breast)
  fillCirc(ctx, 4, -8.2, 3, body)
  fillCirc(ctx, 5, -8.8, 0.8, C.ink)
  ctx.beginPath()
  ctx.moveTo(6.6, -8.4)
  ctx.lineTo(9.6, -7.6)
  ctx.lineTo(6.6, -6.8)
  ctx.closePath()
  ctx.fillStyle = C.amber
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-4.6, -5.5)
  ctx.lineTo(-9.6, -7)
  ctx.lineTo(-5, -3)
  ctx.closePath()
  ctx.fillStyle = shade(body, -0.2)
  ctx.fill()
  if (flying) {
    const w = Math.sin(flap) * 5
    fillEll(ctx, -1, -6 - w * 0.6, 4.6, Math.max(1.2, Math.abs(w)), shade(body, -0.18), 0.2)
  } else {
    fillEll(ctx, -1, -4.6, 3.6, 2.4, shade(body, -0.18), 0.5)
    line(ctx, 0, -1, 0, 0.6, 0.8, C.amber)
    line(ctx, 2, -1, 2, 0.6, 0.8, C.amber)
  }
  void TAU
}
