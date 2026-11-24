import { C, TAU, alpha, at, clamp, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, star, type Ctx } from '../draw'
import { bubble, crossing, makeAct, zzz } from '../kit'
import { chance, pick, range } from '../rng'
import type { ActDef, AmbientDef, Stage } from '../types'

// The family dives, so in this theme the bottom of the dashboard is the sea
// bed. Everything here swims rather than walks: slower than the land scenes,
// a little bob on everything, and bubbles from anything that breathes.

export const SCUBA_AMBIENT: AmbientDef = {
  kind: 'bubble',
  colors: ['#bae6fd', '#7dd3fc', '#e0f2fe'],
  rate: 1.2,
  flurry: [16, 14],
  settle: false,
  rising: true,
  size: [2, 5],
}

type Dir = 1 | -1
const past = (dir: number, x: number, target: number) => (dir > 0 ? x >= target : x <= target)
/** True on the frames where a clock running at `hz` ticks over. */
const tick = (t: number, dt: number, hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)

/** A few breath bubbles from (x, y) px. They pop before they climb far. */
function bubbles(s: Stage, x: number, y: number, n: number, big = 1) {
  for (let i = 0; i < n; i++) {
    s.particles.emit({
      kind: 'bubble',
      x: x + (Math.random() - 0.5) * 5 * s.u,
      y: y + (Math.random() - 0.5) * 3 * s.u,
      vx: (Math.random() - 0.5) * 14 * s.u,
      vy: -(30 + Math.random() * 34) * s.u,
      size: (1.3 + Math.random() * 2.1) * big * s.u,
      color: C.sky,
      sway: 7,
      life: 1.4 + Math.random() * 0.9,
    })
  }
}

/** Speech bubbles are never mirrored, whichever way the speaker faces. */
function say(s: Stage, x: number, y: number, text: string, color: string = C.ink) {
  at(s.ctx, x, y, s.u, 1, () => bubble(s.ctx, 0, 0, text, { color, size: 10 }))
}

// ─── The diver ───────────────────────────────────────────────────────────────
// Drawn swimming flat, facing right, with the origin in the middle of the
// chest. About 75 units from mask to fin tip.

interface DiverLook {
  suit: string
  trim: string
  skin: string
  fin: string
  tank: string
}

const DIVERS: DiverLook[] = [
  { suit: '#2f7fb5', trim: C.yellow, skin: C.skinA, fin: C.yellow, tank: '#cbd5e1' },
  { suit: '#5b6b9a', trim: C.rose, skin: C.skinB, fin: C.rose, tank: C.gold },
  { suit: '#2f8f7a', trim: C.orange, skin: C.skinC, fin: C.orange, tank: '#cbd5e1' },
]

type ArmMode = 'trail' | 'ok' | 'point' | 'camera' | 'recoil'
// Shoulder angle then elbow bend. 0 points ahead, positive swings down.
const ARM: Record<ArmMode, [number, number]> = {
  trail: [2.75, 0.15],
  ok: [-0.85, -0.75],
  point: [0.45, 0.05],
  camera: [0.5, -0.45],
  recoil: [-2.0, -0.5],
}

interface DiverPose {
  /** Fin-kick phase, radians. About 5 per second at a cruise. */
  kick: number
  amp?: number
  arm?: ArmMode
  /** 0 arm trailing, 1 fully in the `arm` pose. */
  armT?: number
  lookBack?: boolean
  /** False when something has made off with it. */
  mask?: boolean
  eyes?: 'normal' | 'wide'
}

function drawDiver(ctx: Ctx, look: DiverLook, pose: DiverPose) {
  const amp = pose.amp ?? 0.32
  const f = pose.lookBack ? -1 : 1
  const leg = (phase: number, far: boolean) => {
    const a1 = Math.PI + Math.sin(phase) * amp
    const kx = -10 + Math.cos(a1) * 11
    const ky = 1.5 + Math.sin(a1) * 11
    const a2 = a1 - Math.max(0, Math.cos(phase)) * amp * 1.1
    const fx = kx + Math.cos(a2) * 11
    const fy = ky + Math.sin(a2) * 11
    poly(ctx, [-10, 1.5, kx, ky, fx, fy], 5, far ? shade(look.suit, -0.25) : look.suit)
    // The fin: a long blade that flexes a beat behind the leg.
    ctx.save()
    ctx.translate(fx, fy)
    ctx.rotate(a2 + Math.sin(phase - 1.1) * amp * 1.5)
    fillPoly(ctx, [0, -1.8, 6, -2.6, 19, -5, 20.5, 0, 19, 5, 6, 2.6, 0, 1.8], far ? shade(look.fin, -0.3) : look.fin)
    line(ctx, 7, -1.2, 18, -2.4, 0.7, shade(look.fin, -0.35))
    line(ctx, 7, 1.2, 18, 2.4, 0.7, shade(look.fin, -0.35))
    fillRR(ctx, -2.5, -2.7, 8, 5.4, 2.2, shade(look.suit, far ? -0.45 : -0.3))
    ctx.restore()
  }
  const arm = (mode: ArmMode, tt: number, far: boolean) => {
    const a = lerp(ARM.trail[0] + (far ? 0.14 : 0), ARM[mode][0], tt)
    const e = lerp(ARM.trail[1], ARM[mode][1], tt)
    const ex = 9 + Math.cos(a) * 8
    const ey = 1 + Math.sin(a) * 8
    const hx = ex + Math.cos(a + e) * 8
    const hy = ey + Math.sin(a + e) * 8
    poly(ctx, [9, 1, ex, ey, hx, hy], 4.2, far ? shade(look.suit, -0.25) : shade(look.suit, -0.08))
    fillCirc(ctx, hx, hy, 2.5, far ? shade(look.skin, -0.18) : look.skin)
    return { x: hx, y: hy, a: a + e }
  }
  const mode = pose.arm ?? 'trail'
  const tt = pose.armT ?? 0
  arm(mode === 'camera' ? 'camera' : 'trail', mode === 'camera' ? tt : 0, true)
  leg(pose.kick + Math.PI, true)
  // Tank on the back, with its valve and a glint down the side.
  fillRR(ctx, -13, -13.6, 24, 7.6, 3.8, look.tank)
  fillRR(ctx, -11, -12.6, 19, 1.6, 0.8, 'rgba(255,255,255,0.4)')
  fillRR(ctx, 10.5, -12.2, 4.5, 4, 1.2, C.steel)
  fillCirc(ctx, 15.2, -10.2, 1.5, C.grey)
  // Wetsuit.
  fillRR(ctx, -13, -6.5, 27, 13, 6.5, look.suit)
  fillRR(ctx, -11, 2.4, 22, 3.4, 1.7, shade(look.suit, -0.16))
  line(ctx, -9, -1, 9, -1, 1.6, look.trim)
  fillRR(ctx, -7, -7, 2.2, 13.6, 1, shade(look.suit, -0.38))
  fillRR(ctx, 3, -7, 2.2, 13.6, 1, shade(look.suit, -0.38))
  // Weight belt.
  fillRR(ctx, -12.5, -5.5, 3, 11, 1.2, C.slate)
  fillRR(ctx, -12.8, -1.6, 3.6, 3.4, 0.8, C.gold)
  leg(pose.kick, false)
  // Head: hood, face, mask, regulator. Mirrored to look over the shoulder.
  ctx.save()
  ctx.translate(20, -3)
  ctx.scale(f, 1)
  fillCirc(ctx, 0, 0, 8.6, shade(look.suit, -0.12))
  fillEll(ctx, 2.4, 0.8, 6, 6.5, look.skin)
  fillEll(ctx, 3.4, 3.2, 2.2, 1.5, 'rgba(244,114,128,0.3)')
  const wide = pose.eyes === 'wide'
  if (pose.mask !== false) {
    line(ctx, -7.8, -3.4, 2, -3.6, 1.7, shade(look.trim, -0.3))
    fillRR(ctx, 0.8, -7.4, 9, 7.8, 2.8, look.trim)
    fillRR(ctx, 2, -6.2, 6.6, 5.4, 1.9, '#d9f1fd')
    fillCirc(ctx, 5.6, -3.4, wide ? 1.9 : 1.3, C.ink)
    line(ctx, 3, -5.2, 4.6, -5.4, 0.9, 'rgba(255,255,255,0.9)')
    // Nose pocket.
    fillEll(ctx, 8.2, 0.4, 1.8, 1.5, shade(look.trim, -0.15))
  } else {
    fillCirc(ctx, 5.4, -3, 2.6, C.white)
    fillCirc(ctx, 5.9, -3, 1.3, C.ink)
    line(ctx, 2.6, -6.8, 7.8, -5.6, 1, shade(look.skin, -0.5))
  }
  fillCirc(ctx, 7.6, 4.6, 3, C.steel)
  fillCirc(ctx, 8.3, 4.6, 1.3, C.grey)
  ctx.restore()
  // Hose from the regulator back over the shoulder to the tank valve.
  ctx.beginPath()
  ctx.moveTo(20 + f * 7, 3.4)
  ctx.quadraticCurveTo(20 + f * 2, 11, 10, 5)
  ctx.quadraticCurveTo(4, -2, 12, -9.6)
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.strokeStyle = C.grey
  ctx.stroke()
  const h = arm(mode, tt, false)
  if (tt > 0.7 && mode === 'ok') {
    // Thumb and finger make the ring, three fingers fan out above it.
    ctx.beginPath()
    ctx.arc(h.x + 2.4, h.y - 1.4, 2.1, 0, TAU)
    ctx.lineWidth = 1.2
    ctx.strokeStyle = look.skin
    ctx.stroke()
    for (let i = 0; i < 3; i++) line(ctx, h.x, h.y - 1.5, h.x - 2.5 + i * 2.2, h.y - 6.4 + Math.abs(i - 1) * 0.8, 1.1, look.skin)
  }
  if (tt > 0.7 && mode === 'point') line(ctx, h.x, h.y, h.x + Math.cos(h.a) * 5, h.y + Math.sin(h.a) * 5, 1.3, look.skin)
  return { mouth: { x: 20 + f * 9.5, y: 2 }, hand: h }
}

// ─── Fish ────────────────────────────────────────────────────────────────────

interface FishLook {
  body: string
  belly?: string
  fin?: string
  stripes?: string
}

const FISH: FishLook[] = [
  { body: C.orange, belly: '#fde9c9', stripes: C.white },
  { body: C.yellow, fin: C.sky, belly: '#fef9c3' },
  { body: C.rose, belly: C.pink },
  { body: C.mint, fin: C.cyan, belly: '#ccfbf1' },
]
const GRUMP: FishLook = { body: '#7c8fb8', belly: '#b9c6e0', fin: '#5a6c96' }

/** A fish `len` units long, centred on the origin, nose to the right. */
function drawFish(ctx: Ctx, look: FishLook, len: number, wag: number, o: { grumpy?: boolean; eyes?: 'normal' | 'wide' | 'closed' | 'up'; wave?: number } = {}) {
  const L = len
  const fin = look.fin ?? shade(look.body, -0.22)
  const w = Math.sin(wag)
  fillPoly(ctx, [-L * 0.36, 0, -L * 0.72, -L * 0.26 + w * L * 0.1, -L * 0.6, w * L * 0.08, -L * 0.72, L * 0.26 + w * L * 0.1], fin)
  fillPoly(ctx, [-L * 0.16, -L * 0.22, L * 0.0, -L * 0.42, L * 0.2, -L * 0.2], fin)
  fillEll(ctx, 0, 0, L * 0.46, L * 0.27, look.body)
  if (look.belly) fillEll(ctx, L * 0.04, L * 0.1, L * 0.36, L * 0.14, look.belly)
  if (look.stripes) for (const i of [-0.16, 0.04]) line(ctx, L * i, -L * 0.19, L * i - L * 0.02, L * 0.19, L * 0.07, look.stripes)
  fillEll(ctx, L * 0.02, L * 0.1, L * 0.13, L * 0.06, fin, 0.5 + (o.wave ?? w * 0.3))
  const ex = L * 0.27
  const ey = -L * 0.06
  const er = Math.max(1.1, L * 0.085) * (o.eyes === 'wide' ? 1.35 : 1)
  const dark = shade(look.body, -0.55)
  if (o.eyes === 'closed') line(ctx, ex - er, ey, ex + er, ey + er * 0.3, Math.max(0.7, L * 0.03), dark)
  else {
    fillCirc(ctx, ex, ey, er, C.white)
    fillCirc(ctx, ex + er * 0.25, ey - (o.eyes === 'up' ? er * 0.45 : 0), er * 0.55, C.ink)
  }
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(0.7, L * 0.03)
  ctx.strokeStyle = dark
  if (o.grumpy) {
    // Heavy brow, jutting lower lip, mouth turned right down.
    line(ctx, ex - er * 1.7, ey - er * 2, ex + er * 1.5, ey - er * 0.6, L * 0.045, dark)
    fillEll(ctx, L * 0.4, L * 0.1, L * 0.07, L * 0.035, shade(look.body, -0.18))
    ctx.beginPath()
    ctx.arc(L * 0.37, L * 0.2, L * 0.11, Math.PI * 1.15, Math.PI * 1.8)
    ctx.stroke()
  } else if (L > 7) {
    ctx.beginPath()
    ctx.arc(L * 0.36, -L * 0.01, L * 0.07, Math.PI * 0.15, Math.PI * 0.75)
    ctx.stroke()
  }
}

// ─── Other residents ─────────────────────────────────────────────────────────

/** Creeping octopus, standing on the floor at the origin, eyes to the right. */
function drawOctopus(ctx: Ctx, color: string, crawl: number, o: { eyes?: 'normal' | 'wide' | 'back'; mask?: string } = {}) {
  const dark = shade(color, -0.25)
  const light = shade(color, 0.28)
  const arm = (root: number, side: number, i: number, far: boolean) => {
    let px = root
    let py = -7
    const reach = 1 + (i % 2) * 0.22
    for (let j = 1; j <= 6; j++) {
      const nx = root + side * j * 4.3 * reach + Math.sin(crawl + i * 1.7) * side * 3.2 * (j / 6)
      const curl = j > 4 ? (j - 4) * (2.3 + Math.sin(crawl + i * 2.1) * 1.9) : 0
      const ny = -7 + Math.min(6.2, j * 2.3) - curl + Math.sin(crawl + i + j * 0.9) * 0.7
      line(ctx, px, py, nx, ny, 4.8 - j * 0.52, far ? dark : color)
      if (!far && j > 1 && j < 5) fillCirc(ctx, (px + nx) / 2, (py + ny) / 2 + 1.2, 0.7, light)
      px = nx
      py = ny
    }
  }
  arm(-5, -1, 1, true)
  arm(2, 1, 3, true)
  arm(6, 1, 5, true)
  fillEll(ctx, -2, -19, 11, 12.5, color, -0.15)
  fillEll(ctx, -7, -18, 3.6, 8, dark, -0.15)
  fillEll(ctx, 0, -10, 11.5, 7.5, color)
  for (const [sx, sy, r] of [[-6, -25, 1.7], [-1, -27.5, 1.2], [2, -23, 1.4], [-8, -20, 1]] as const) fillCirc(ctx, sx, sy, r, light)
  fillEll(ctx, -10.5, -9, 2.6, 1.8, dark)
  if (o.mask) {
    line(ctx, -11, -14.5, 2, -13.6, 1.7, shade(o.mask, -0.3))
    fillRR(ctx, 0, -17.6, 13.4, 9, 3, o.mask)
    fillRR(ctx, 1.3, -16.3, 10.8, 6.4, 2.2, '#d9f1fd')
  }
  const wide = o.eyes === 'wide'
  const shift = o.eyes === 'back' ? -1.3 : 0
  for (const [ex, ey] of [[3.6, -12.8], [9, -12.2]] as const) {
    if (!o.mask) fillEll(ctx, ex, ey, wide ? 3.1 : 2.6, wide ? 3.6 : 3, C.white)
    if (wide) fillCirc(ctx, ex + 0.3, ey, 1.2, C.ink)
    else fillRR(ctx, ex - 1.5 + shift, ey - 0.7, 3, 1.5, 0.7, C.ink)
  }
  arm(-8, -1, 0, false)
  arm(-2, -1, 2, false)
  arm(4, 1, 4, false)
}

/** The same octopus jetting, mantle first, arms streaming. Origin at its middle. */
function drawOctopusJet(ctx: Ctx, color: string, t: number) {
  const dark = shade(color, -0.25)
  for (let i = 0; i < 6; i++) {
    const y0 = (i - 2.5) * 1.7
    const wv = (k: number) => Math.sin(t * 16 + i + k) * (0.8 + k)
    poly(ctx, [-6, y0, -18, y0 * 1.3 + wv(0), -30, y0 * 1.7 + wv(1), -41, y0 * 1.9 + wv(2)], 3.2 - (i % 2) * 0.6, i % 2 ? dark : color)
  }
  fillEll(ctx, -3, 0, 8, 7.4, color)
  fillEll(ctx, 9, 0, 14, 8.6, color)
  fillEll(ctx, 9, 3.5, 11, 3.6, dark)
  fillCirc(ctx, 14, -4, 1.5, shade(color, 0.28))
  fillCirc(ctx, 8, -5.5, 1.1, shade(color, 0.28))
  fillCirc(ctx, -2.5, -3.6, 3, C.white)
  fillCirc(ctx, -2.2, -3.6, 1.2, C.ink)
}

/** A crab seen from the front, standing on the floor. It walks sideways. */
function drawCrab(ctx: Ctx, color: string, t: number, o: { scuttle?: number; claws?: number; snap?: number; wide?: boolean } = {}) {
  const dark = shade(color, -0.28)
  const sc = o.scuttle ?? 0
  const up = o.claws ?? 0
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const step = Math.sin(t * 24 + i * 2.1 + side) * sc
      const kx = side * (12.5 + i * 2)
      const fx = side * (14 + i * 3.4) + step * 2.4
      poly(ctx, [side * 7, -6, kx, -9.5 - i * 0.6, fx, -Math.max(0, step) * 2], 1.8, dark)
    }
  }
  for (const side of [-1, 1]) {
    // Claw arm: shoulder, elbow, then the pincer itself.
    const ex = side * (15 + up * 1)
    const ey = -8.5 - up * 5
    const cx = side * (17 - up * 3)
    const cy = -9.5 - up * 14 + Math.sin(t * 18 + side) * up * 1.5
    poly(ctx, [side * 8.5, -8, ex, ey, cx, cy], 2.6, dark)
    const open = 0.25 + (o.snap !== undefined ? Math.abs(Math.sin(o.snap)) * 0.7 : 0.2)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(side, 1)
    ctx.rotate(-0.5 - up * 0.7)
    fillEll(ctx, 2.5, 0, 4.6, 3.3, color)
    fillEll(ctx, 6.6, 1, 3.2, 1.5, color, 0.15)
    ctx.rotate(-open)
    fillEll(ctx, 6, -2, 3.4, 1.4, shade(color, 0.15), -0.1)
    ctx.restore()
  }
  fillEll(ctx, 0, -7.6, 11, 6.4, color)
  fillEll(ctx, -2, -10, 6.5, 2.4, shade(color, 0.22))
  fillEll(ctx, 0, -4, 8, 2.2, dark)
  for (const side of [-1, 1]) {
    line(ctx, side * 3.4, -12.5, side * 4, -17, 1.4, color)
    fillCirc(ctx, side * 4, -17.6, o.wide ? 3 : 2.3, C.white)
    fillCirc(ctx, side * 4 + 0.3, -17.6, o.wide ? 1 : 1.1, C.ink)
  }
  if (o.wide) fillEll(ctx, 0, -6.4, 1.5, 1.8, shade(color, -0.6))
  else {
    ctx.beginPath()
    ctx.arc(0, -8, 2.6, Math.PI * 0.2, Math.PI * 0.8)
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.strokeStyle = shade(color, -0.6)
    ctx.stroke()
  }
}

const WOOD = '#9a6a3a'

/** The lid, hinged at the back corner. `open` 0 shut, 1 thrown back. */
function drawChestLid(ctx: Ctx, open: number) {
  ctx.save()
  ctx.translate(-16, -14)
  ctx.rotate(-open * 1.15)
  fillRR(ctx, -1, -9, 34, 9.5, 4.5, shade(WOOD, 0.12))
  fillRR(ctx, 0, -2.6, 32, 3, 1, shade(WOOD, -0.25))
  fillRR(ctx, 5, -9, 3, 9.5, 0.6, C.brass)
  fillRR(ctx, 24, -9, 3, 9.5, 0.6, C.brass)
  fillRR(ctx, 2, -7.8, 20, 1.3, 0.6, 'rgba(255,255,255,0.18)')
  ctx.restore()
}

function drawChestBase(ctx: Ctx, open: number) {
  if (open > 0.05) {
    // What is inside: shadow, and a glint of coins.
    fillEll(ctx, 0, -14, 15, 3.2, '#3b2412')
    fillEll(ctx, 1, -14.2, 11, 2, C.gold)
    fillCirc(ctx, -4, -15, 1.6, C.yellow)
    fillCirc(ctx, 6, -15.2, 1.3, C.yellow)
  }
  fillRR(ctx, -16, -14, 32, 14, 2, WOOD)
  line(ctx, -15, -9.4, 15, -9.4, 0.8, shade(WOOD, -0.3))
  line(ctx, -15, -4.6, 15, -4.6, 0.8, shade(WOOD, -0.3))
  fillRR(ctx, -11, -14, 3, 14, 0.6, C.brass)
  fillRR(ctx, 8, -14, 3, 14, 0.6, C.brass)
  fillRR(ctx, -2.8, -12.5, 5.6, 6.5, 1.2, C.gold)
  fillCirc(ctx, 0, -9.8, 1.1, C.ink)
  // A little weed and a barnacle, so it has clearly been here a while.
  poly(ctx, [-18, 0, -19.5, -5, -17.5, -9], 1.4, C.forest)
  poly(ctx, [-20.5, 0, -22, -4, -21, -6.5], 1.2, C.leaf)
  fillCirc(ctx, 12.5, -2.2, 1.4, '#cbd5e1')
}

const TURTLE_SHELL = '#5f9a57'
const TURTLE_SKIN = '#8fc27a'

/** A sea turtle, centred on the origin, about 60 units nose to tail. */
function drawTurtle(ctx: Ctx, flap: number, eyes: 'normal' | 'up' | 'closed' = 'normal') {
  const flipper = (x: number, y: number, len: number, phase: number, far: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(1.9 + Math.sin(flap + phase) * 0.62)
    fillEll(ctx, len * 0.85, 0, len, len * 0.3, far ? shade(TURTLE_SKIN, -0.28) : TURTLE_SKIN)
    if (!far) for (let i = 0; i < 3; i++) fillCirc(ctx, len * (0.5 + i * 0.4), 0, 0.9, shade(TURTLE_SKIN, -0.25))
    ctx.restore()
  }
  flipper(11, 1, 11, 0.5, true)
  fillPoly(ctx, [-20, 1, -27, 3.5, -20, 4.5], TURTLE_SKIN)
  ctx.save()
  ctx.translate(-15, 4)
  ctx.rotate(2.5 + Math.sin(flap + 1.5) * 0.25)
  fillEll(ctx, 5, 0, 6.5, 2.4, TURTLE_SKIN)
  ctx.restore()
  // Neck and head.
  fillEll(ctx, 23, 0, 8, 4, TURTLE_SKIN)
  fillEll(ctx, 30, -2.5, 6.4, 5.2, TURTLE_SKIN)
  fillCirc(ctx, 27.5, -5, 1.2, shade(TURTLE_SKIN, -0.25))
  if (eyes === 'closed') line(ctx, 30.5, -3.6, 33.5, -3.2, 1, C.ink)
  else {
    fillCirc(ctx, 32, -4, 2.1, C.white)
    fillCirc(ctx, 32.5, eyes === 'up' ? -4.9 : -4, 1.1, C.ink)
  }
  ctx.beginPath()
  ctx.arc(33, -1.6, 2.6, Math.PI * 0.2, Math.PI * 0.75)
  ctx.lineWidth = 0.9
  ctx.lineCap = 'round'
  ctx.strokeStyle = shade(TURTLE_SKIN, -0.55)
  ctx.stroke()
  // Shell: plastron, dome, rim, scutes.
  fillEll(ctx, 0, 4.2, 18, 3.8, '#e6d9a0')
  ctx.beginPath()
  ctx.ellipse(0, 3, 21, 17, 0, Math.PI, TAU)
  ctx.closePath()
  ctx.fillStyle = TURTLE_SHELL
  ctx.fill()
  fillRR(ctx, -21.5, 0.6, 43, 4, 2, shade(TURTLE_SHELL, -0.28))
  const scute = shade(TURTLE_SHELL, 0.2)
  for (const [sx, sy, rx, ry] of [[-11, -4.5, 4.6, 3.4], [0, -8.5, 5.4, 4], [11, -4.5, 4.6, 3.4], [-5.5, -1.5, 3, 1.8], [5.5, -1.5, 3, 1.8]] as const) fillEll(ctx, sx, sy, rx, ry, scute)
  flipper(12, 4, 13, 0, false)
}

/** A seahorse, upright, about 30 units tall, centred on the origin. */
function drawSeahorse(ctx: Ctx, color: string, t: number, wide = false) {
  const light = shade(color, 0.3)
  const tail = [0, 5, -1.2, 10, 0, 14.6, 3.6, 15.6, 4.8, 12.6, 2.6, 11.4]
  for (let i = 0; i < 5; i++) line(ctx, tail[i * 2], tail[i * 2 + 1], tail[i * 2 + 2], tail[i * 2 + 3], 4.2 - i * 0.6, color)
  fillEll(ctx, -5.4, 0, 2.6, 4.2, alpha(light, 0.85), Math.sin(t * 30) * 0.3)
  fillEll(ctx, 0, 0, 5.2, 8, color, 0.15)
  fillEll(ctx, 1.9, 0.6, 3, 6, light, 0.15)
  for (let i = 0; i < 4; i++) line(ctx, 0.2, -3.5 + i * 2.6, 3.8, -3 + i * 2.6, 0.6, shade(color, -0.1))
  fillEll(ctx, 1, -8.6, 4, 4.6, color)
  fillPoly(ctx, [0.5, -15.5, 1.4, -19, 2.8, -16.2, 4.4, -18.6, 5, -15], color)
  fillCirc(ctx, 3, -12.6, 4.3, color)
  line(ctx, 5.5, -11.8, 11, -10.4, 2.5, color)
  fillCirc(ctx, 11.4, -10.3, 1.6, shade(color, -0.18))
  fillCirc(ctx, 4.2, -13.6, wide ? 2.1 : 1.6, C.white)
  fillCirc(ctx, 4.6, -13.6, 0.85, C.ink)
}

const DEEP = '#7fb2e0'

/** The outline of a whale shark, about 215 units long. Draw it faint. */
function drawWhaleShark(ctx: Ctx, t: number) {
  const sw = Math.sin(t * 1.6) * 7
  ctx.beginPath()
  ctx.moveTo(104, 2)
  ctx.quadraticCurveTo(100, -14, 62, -19)
  ctx.lineTo(4, -22)
  ctx.lineTo(-16, -45)
  ctx.lineTo(-22, -20)
  ctx.quadraticCurveTo(-62, -12, -82, -3 + sw * 0.3)
  ctx.lineTo(-112, -32 + sw)
  ctx.lineTo(-96, 2 + sw * 0.6)
  ctx.lineTo(-106, 20 + sw)
  ctx.lineTo(-80, 6 + sw * 0.3)
  ctx.quadraticCurveTo(-30, 22, 40, 22)
  ctx.quadraticCurveTo(98, 20, 104, 2)
  ctx.closePath()
  ctx.fillStyle = DEEP
  ctx.fill()
  fillPoly(ctx, [44, 16, 16, 42 + Math.sin(t * 1.6 + 1) * 3, 62, 19], shade(DEEP, -0.2))
  // The spots it is famous for, a wide flat mouth, a very small eye.
  for (let r = 0; r < 3; r++) for (let i = 0; i < 11; i++) fillCirc(ctx, 78 - i * 14 - r * 5, -11 + r * 9 - Math.abs(i - 4) * 0.4, 1.7, '#e0f2fe')
  line(ctx, 86, 9, 103, 5, 1.4, shade(DEEP, -0.4))
  fillCirc(ctx, 88, -3, 1.8, C.ink)
  for (let i = 0; i < 4; i++) line(ctx, 66 - i * 5, -8, 65 - i * 5, 10, 0.9, shade(DEEP, -0.3))
}

/** A manta ray outline, about 110 units across the wings. Draw it faint. */
function drawManta(ctx: Ctx, t: number) {
  const fl = Math.sin(t * 2.2)
  line(ctx, -30, 2, -96, 8 + fl * 3, 1.6, DEEP)
  fillPoly(ctx, [30, -2, -4, -8, -34, -52 * (0.55 + fl * 0.45), -28, 0], shade(DEEP, -0.2))
  fillEll(ctx, 0, 0, 34, 11, DEEP)
  fillPoly(ctx, [34, 2, 0, 8, -26, 50 * (0.6 - fl * 0.4), -30, 2], DEEP)
  fillEll(ctx, 2, 5, 24, 4, '#e0f2fe')
  poly(ctx, [30, -5, 40, -9, 43, -4], 3, DEEP)
  poly(ctx, [30, 5, 41, 7, 43, 2], 3, DEEP)
  fillCirc(ctx, 27, -3, 1.6, C.ink)
}

/** A big camera in an underwater housing, with a strobe on an arm. */
function drawCamera(ctx: Ctx, flash: number) {
  poly(ctx, [-3, -5, -7, -12, 1, -15.5], 1.5, C.steel)
  fillRR(ctx, 0, -19, 7, 6, 1.8, C.grey)
  fillRR(ctx, 5.6, -18, 1.6, 4, 0.6, '#e2e8f0')
  fillRR(ctx, -7, -6, 13, 12, 2.8, '#b6c2d4')
  fillRR(ctx, -5.6, -4.6, 5, 3, 1, C.slate)
  fillRR(ctx, -9.5, -3, 3, 6, 1.2, C.steel)
  fillCirc(ctx, 7, 0.5, 5.2, C.steel)
  fillCirc(ctx, 7.6, 0.5, 3.6, C.navy)
  fillCirc(ctx, 8.6, -0.8, 1.2, C.sky)
  fillCirc(ctx, -2.4, -7, 1.3, C.red)
  if (flash > 0) {
    ctx.globalAlpha = flash
    fillCirc(ctx, 7.5, -16, 9, '#fffbea')
    ctx.globalAlpha = flash * 0.35
    fillCirc(ctx, 7.5, -16, 16, '#fffbea')
    ctx.globalAlpha = 1
  }
}

function drawStarfish(ctx: Ctx, t: number) {
  star(ctx, 0, -3.4, 6.4, C.orange, 0.2 + Math.sin(t * 1.5) * 0.06, 0.5)
  for (let i = 0; i < 5; i++) {
    const a = 0.2 - Math.PI / 2 + (i * TAU) / 5
    fillCirc(ctx, Math.cos(a) * 3.4, -3.4 + Math.sin(a) * 3.4, 0.6, '#fed7aa')
  }
  fillCirc(ctx, -1.1, -4, 0.6, C.ink)
  fillCirc(ctx, 1.1, -4, 0.6, C.ink)
}

function drawNudibranch(ctx: Ctx, t: number) {
  const body = '#c084fc'
  fillEll(ctx, 0, -2.4, 7.4, 2.5, body)
  fillEll(ctx, 0, -1.2, 7.8, 1.2, C.orange)
  for (let i = 0; i < 4; i++) fillCirc(ctx, -3.5 + i * 2.1, -3.4, 0.7, C.yellow)
  for (let i = -1; i <= 1; i++) line(ctx, -4.6, -4, -5.6 + i * 1.6, -7.4 + Math.sin(t * 3 + i) * 0.4, 0.9, C.orange)
  line(ctx, 5, -4, 5.4, -7.2, 0.9, C.orange)
  line(ctx, 6.4, -3.6, 7.6, -6.6, 0.9, C.orange)
  fillCirc(ctx, 5.6, -2.8, 0.5, C.ink)
}

// ─── The OK sign ─────────────────────────────────────────────────────────────
// A diver crosses, stops to tell you everything is fine, and carries on. Half
// the time a small fish is right behind doing an impression, and is suddenly
// very interested in the sea bed whenever the diver looks round.

const diverOk: ActDef = {
  id: 'scuba.diver-ok',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const look = pick(rng, DIVERS)
    const fish = pick(rng, FISH)
    const copycat = chance(rng, 0.55)
    const depth = range(rng, 56, 90)
    const stopX = stage.w * range(rng, 0.42, 0.58)
    const glanceX = from + (stopX - from) * 0.55
    const hover = copycat ? 4.3 : 2.9
    let x = from
    let kick = 0
    let pt = 0
    let glanced = false
    let hide = 0 // 0 fish tailing the diver, 1 down by the floor looking innocent
    let phase: 'in' | 'glance' | 'stop' | 'out' = 'in'
    const looking = () => copycat && ((phase === 'glance' && pt > 0.3 && pt < 1.5) || (phase === 'stop' && pt > 2.5 && pt < 3.7))
    return makeAct({
      update(s, dt, t) {
        pt += dt
        x += dir * (phase === 'stop' ? 0 : phase === 'glance' ? 18 : 48) * s.u * dt
        kick += dt * (phase === 'stop' ? 2.4 : 5.5)
        if (phase === 'in') {
          if (copycat && !glanced && past(dir, x, glanceX)) {
            phase = 'glance'
            glanced = true
            pt = 0
          } else if (past(dir, x, stopX)) {
            phase = 'stop'
            pt = 0
          }
        } else if (phase === 'glance' && pt > 1.8) phase = 'in'
        else if (phase === 'stop' && pt > hover) {
          phase = 'out'
          pt = 0
        }
        const lk = looking()
        hide += ((lk ? 1 : 0) - hide) * Math.min(1, dt * (lk ? 9 : 1.7))
        const y = s.ground - depth * s.u
        if (t % 3.4 < 0.7 && tick(t, dt, 8)) bubbles(s, x + dir * 28 * s.u, y + 2 * s.u, 1)
        if (copycat && hide > 0.8 && tick(t, dt, 2.5)) bubbles(s, x + dir * -58 * s.u, s.ground - 12 * s.u, 1, 0.7)
        return !past(dir, x - dir * (copycat ? 80 : 0) * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        const y = s.ground - depth * s.u + Math.sin(t * 1.7) * 2 * s.u
        const up = phase === 'stop' ? easeInOut(seg(pt, 0, 0.6)) * (1 - easeInOut(seg(pt, hover - 0.5, hover))) : 0
        const sign = phase === 'stop' ? easeOut(seg(pt, 0.5, 0.9)) * (1 - seg(pt, 2.2, 2.5)) : 0
        if (copycat) {
          const fx = x + dir * lerp(-44, -62, hide) * s.u
          const fy = y + lerp(5, depth - 10, hide) * s.u
          at(ctx, fx, fy, s.u, hide > 0.5 ? ((-dir) as Dir) : dir, () => {
            drawFish(ctx, fish, 13, t * (hide > 0.3 && hide < 0.9 ? 30 : 11), {
              eyes: hide > 0.5 ? 'up' : 'normal',
              wave: sign > 0.5 ? Math.sin(t * 12) * 0.9 - 0.6 : undefined,
            })
          })
        }
        at(ctx, x, y, s.u, dir, () => {
          drawDiver(ctx, look, { kick, amp: phase === 'stop' ? 0.14 : 0.32, arm: 'ok', armT: sign, lookBack: looking() })
        }, -dir * 0.4 * up)
        if (sign > 0.9) say(s, x + dir * 24 * s.u, y - 27 * s.u, 'OK')
      },
    })
  },
}

// ─── The shoal ───────────────────────────────────────────────────────────────
// A neat formation of small fish meets one large fish who is not moving for
// anybody. They part round him and close up again. He is not impressed.

const shoal: ActDef = {
  id: 'scuba.shoal',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const n = 8 + Math.floor(rng() * 5)
    const arrow = chance(rng, 0.5)
    const straggler = chance(rng, 0.5)
    const look = pick(rng, FISH)
    const depth = range(rng, 56, 80)
    const bigDepth = depth + range(rng, -4, 4)
    const off: { ox: number; oy: number; ph: number }[] = []
    let span = 0
    for (let i = 0; i < n; i++) {
      let ox: number
      let oy: number
      if (arrow) {
        const j = Math.ceil(i / 2)
        ox = -j * 10
        oy = (i % 2 ? 1 : -1) * j * 5.5
      } else {
        const row = (i % 3) - 1
        ox = -Math.floor(i / 3) * 12 - (row === 0 ? 0 : 6)
        oy = row * 10
      }
      span = Math.max(span, -ox)
      off.push({ ox: ox + range(rng, -1.5, 1.5), oy: oy + range(rng, -1.5, 1.5), ph: rng() * TAU })
    }
    let sx = from
    let bx = to + dir * 20 * stage.u
    let lag = 0
    let puffed = false
    /** Where fish i is, and how hard the big fish is shoving it aside (0..1). */
    const place = (s: Stage, i: number, t: number): [number, number, number] => {
      const o = off[i]
      const extra = straggler && i === n - 1 ? lag : 0
      let px = sx + dir * (o.ox - extra) * s.u
      let py = s.ground - depth * s.u + o.oy * s.u + Math.sin(t * 2.4 + o.ph) * 1.5 * s.u
      const d = px - bx
      const push = easeInOut(clamp(1 - Math.abs(d) / (68 * s.u)))
      const side = Math.abs(o.oy) < 2.5 ? (i % 2 ? 1 : -1) : Math.sign(o.oy)
      py += side * push * 22 * s.u
      px += Math.sign(d || 1) * push * 5 * s.u
      return [px, py, push]
    }
    return makeAct({
      update(s, dt, t) {
        sx += dir * 62 * s.u * dt
        bx -= dir * 40 * s.u * dt
        if (straggler) {
          // The last one stops to stare, then has to sprint to catch up.
          const [px] = place(s, n - 1, t)
          if (Math.abs(px - bx) < 60 * s.u) lag = Math.min(58, lag + 75 * dt)
          else lag = Math.max(0, lag - 20 * dt)
        }
        if (!puffed && dir * (sx - bx) > (span + 60) * s.u) {
          puffed = true
          bubbles(s, bx - dir * 22 * s.u, s.ground - bigDepth * s.u + 4 * s.u, 3, 1.5)
        }
        return !(past(dir, sx - dir * (span + 80) * s.u, to) && past(-dir, bx, from - dir * 10 * s.u))
      },
      draw(s, t) {
        const { ctx } = s
        let crowd = 0
        for (let i = 0; i < n; i++) crowd = Math.max(crowd, place(s, i, t)[2])
        at(ctx, bx, s.ground - bigDepth * s.u + Math.sin(t * 1.3) * 1.5 * s.u, s.u, (-dir) as Dir, () => {
          drawFish(ctx, GRUMP, 46, t * 4, { grumpy: true, eyes: crowd > 0.3 ? 'up' : 'normal' })
        })
        for (let i = 0; i < n; i++) {
          const [px, py, push] = place(s, i, t)
          const last = straggler && i === n - 1
          const staring = last && lag > 4 && Math.abs(px - bx) < 60 * s.u
          at(ctx, px, py, s.u, staring ? ((-dir) as Dir) : dir, () => {
            drawFish(ctx, look, 10, t * (last && lag > 2 && !staring ? 26 : 13) + off[i].ph, { eyes: push > 0.25 || staring ? 'wide' : 'normal' })
          })
        }
      },
    })
  },
}

// ─── The octopus ─────────────────────────────────────────────────────────────
// It creeps along the bottom on curling arms. Either it has helped itself to a
// diver's mask, and the owner is right behind pointing at it, or it notices
// you watching, leaves a cloud of ink, and is gone.

const INK = ['#7c3aed', '#6d28d9', '#8b5cf6']

const octopus: ActDef = {
  id: 'scuba.octopus',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 45)
    const color = pick(rng, ['#f0846c', '#e879a6', '#f2a65a'])
    const thief = chance(rng, 0.5)
    const victim = pick(rng, DIVERS)
    const spot = from + dir * (45 * stage.u + stage.w * range(rng, 0.4, 0.6))
    let x = from
    let y = 0 // height above the floor once it jets, units
    let crawl = 0
    let pt = 0
    let phase: 'creep' | 'startle' | 'jet' = 'creep'
    return makeAct({
      update(s, dt, t) {
        pt += dt
        if (phase === 'creep') {
          x += dir * (thief ? 44 : 38) * s.u * dt
          crawl += dt * 5.5
          if (!thief && past(dir, x, spot)) {
            phase = 'startle'
            pt = 0
          }
        } else if (phase === 'startle') {
          if (pt > 0.9) {
            phase = 'jet'
            pt = 0
            for (let i = 0; i < 16; i++) {
              s.particles.emit({
                kind: 'dust',
                x: x + range(rng, -10, 10) * s.u,
                y: s.ground - range(rng, 4, 24) * s.u,
                vx: -dir * range(rng, 0, 60) * s.u,
                vy: -range(rng, 0, 26) * s.u,
                drag: 0.3,
                g: -4,
                size: range(rng, 9, 17) * s.u,
                color: pick(rng, INK),
                life: range(rng, 1.8, 2.8),
              })
            }
          }
        } else {
          x += dir * 250 * easeOut(seg(pt, 0, 0.25)) * s.u * dt
          y = 16 + easeOut(seg(pt, 0, 0.7)) * 30
          if (tick(t, dt, 14) && pt < 1.2) {
            s.particles.emit({ kind: 'dust', x: x - dir * 30 * s.u, y: s.ground - y * s.u, vx: -dir * 30 * s.u, drag: 0.3, size: range(rng, 4, 8) * s.u, color: pick(rng, INK), life: 1.2 })
          }
        }
        if (thief) {
          const dx = x - dir * 102 * s.u
          if (t % 2.2 < 0.9 && tick(t, dt, 9)) bubbles(s, dx + dir * 28 * s.u, s.ground - 44 * s.u, 1)
          return !past(dir, dx - dir * 55 * s.u, to)
        }
        return !past(dir, x - dir * 45 * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        if (thief) {
          // The owner, maskless, squinting, and pointing with some feeling.
          at(ctx, x - dir * 102 * s.u, s.ground - (46 + Math.sin(t * 2) * 2) * s.u, s.u, dir, () => {
            drawDiver(ctx, victim, { kick: t * 8, amp: 0.4, arm: 'point', armT: 0.85 + Math.sin(t * 9) * 0.15, mask: false })
          }, dir * 0.12)
        }
        if (phase === 'jet') {
          at(ctx, x, s.ground - y * s.u, s.u, dir, () => drawOctopusJet(ctx, color, t), -dir * 0.22 * (1 - seg(pt, 0.4, 1)))
          return
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 20, 0.2)
          const glance = thief && t % 3.1 > 2.3
          drawOctopus(ctx, color, crawl, { eyes: phase === 'startle' ? 'wide' : glance ? 'back' : 'normal', mask: thief ? victim.trim : undefined })
        })
        if (phase === 'startle') say(s, x, s.ground - 38 * s.u, '!', C.crimson)
      },
    })
  },
}

// ─── The treasure chest ──────────────────────────────────────────────────────
// A chest on the bottom creaks open, lets out one enormous bubble and a crab
// who was not expecting company. A diver comes over for a look and the lid
// snaps shut an inch from the mask.

const chest: ActDef = {
  id: 'scuba.chest',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const look = pick(rng, DIVERS)
    const peek = chance(rng, 0.5) // the crab stays put and hides, rather than legging it
    const crabCol = pick(rng, [C.red, C.orange, '#f472b6'])
    const cx = stage.w * range(rng, 0.42, 0.58)
    const hoverX = cx - dir * 46 * stage.u
    let show = 0
    let open = 0
    let openTo = 0
    let crabX = cx
    let crabUp = 0
    let crabOut = false
    let x = from
    let kick = 0
    let pt = 0
    let phase: 'in' | 'hover' | 'recoil' | 'out' = 'in'
    let peekT = -1
    let fading = false
    return makeAct({
      update(s, dt, t) {
        pt += dt
        show = clamp(show + (fading ? -dt : dt * 1.3))
        open += (openTo - open) * Math.min(1, dt * (openTo > open ? 5 : 18))
        if (t >= 1.3 && t - dt < 1.3) {
          openTo = 1
          s.particles.emit({ kind: 'bubble', x: cx, y: s.ground - 16 * s.u, vy: -26 * s.u, size: 8 * s.u, sway: 5, life: 3.2, color: C.sky })
          bubbles(s, cx, s.ground - 15 * s.u, 5)
        }
        const near = Math.abs(x - cx) < 130 * s.u
        if (!crabOut) {
          const want = t > 2 && phase !== 'out' && !(peek && near) && openTo === 1 ? 1 : 0
          crabUp += (want - crabUp) * Math.min(1, dt * (want ? 6 : 12))
          if (!peek && t > 3.1 && crabUp > 0.9) {
            crabOut = true
          }
        } else crabX += dir * (t % 1.1 < 0.8 ? 78 : 0) * s.u * dt
        const y = s.ground - 46 * s.u
        if (phase === 'in') {
          x += dir * 60 * s.u * dt
          kick += dt * 6
          if (past(dir, x, hoverX)) {
            phase = 'hover'
            pt = 0
          }
        } else if (phase === 'hover') {
          kick += dt * 2
          if (pt > 1.4 && t > 4.4) {
            phase = 'recoil'
            pt = 0
            openTo = 0
            bubbles(s, cx, s.ground - 15 * s.u, 6)
            bubbles(s, x + dir * 26 * s.u, y + 8 * s.u, 7, 1.3)
          }
        } else if (phase === 'recoil') {
          x -= dir * 46 * (1 - seg(pt, 0, 0.5)) * s.u * dt
          kick += dt * 9
          if (pt > 1.5) {
            phase = 'out'
            pt = 0
          }
        } else {
          x += dir * 60 * s.u * dt
          kick += dt * 6
          const clear = dir * (x - cx) > 120 * s.u
          if (peek && clear && peekT < 0) peekT = 0
          if (peekT >= 0) {
            peekT += dt
            openTo = peekT < 1.7 ? 0.2 : 0
            if (peekT > 2.1) fading = true
          } else if (!peek && clear) fading = true
        }
        if (t % 3 < 0.6 && tick(t, dt, 8) && phase !== 'recoil') bubbles(s, x + dir * 28 * s.u, y + 3 * s.u, 1)
        const crabGone = !crabOut || past(dir, crabX, to)
        return !(fading && show <= 0 && past(dir, x, to) && crabGone)
      },
      draw(s, t) {
        const { ctx } = s
        ctx.globalAlpha = show
        // Mirrored so the hinge is on the far side and the diver looks straight in.
        at(ctx, cx, s.ground, s.u, (-dir) as Dir, () => {
          groundShadow(ctx, 0, 20, 0.22)
          drawChestLid(ctx, open)
          if (!crabOut && (crabUp > 0.02 || peekT >= 0) && open > 0.1) {
            // Inside the chest: only what clears the rim shows.
            const rise = peekT >= 0 ? 3.5 : crabUp * 13
            ctx.save()
            ctx.beginPath()
            ctx.rect(-30, -60, 60, 46)
            ctx.clip()
            ctx.translate(1, -4 - rise)
            drawCrab(ctx, crabCol, t, { claws: peekT >= 0 ? 0 : crabUp * (0.5 + Math.sin(t * 9) * 0.3), wide: peekT < 0 })
            ctx.restore()
          }
          drawChestBase(ctx, open)
        })
        ctx.globalAlpha = 1
        if (crabOut) {
          at(ctx, crabX, s.ground, s.u, 1, () => {
            groundShadow(ctx, 0, 13, 0.2)
            drawCrab(ctx, crabCol, t, { scuttle: 1, claws: 0.7, wide: true })
          })
        }
        const lean = phase === 'hover' ? easeInOut(seg(pt, 0, 0.7)) : phase === 'recoil' ? 1 - easeOut(seg(pt, 0, 0.3)) * 1.6 : 0
        const y = s.ground - (46 - (phase === 'hover' ? easeInOut(seg(pt, 0, 0.8)) * 8 : 0) + Math.sin(t * 1.8) * 1.5) * s.u
        at(ctx, x, y, s.u, dir, () => {
          drawDiver(ctx, look, {
            kick,
            amp: phase === 'hover' ? 0.14 : 0.32,
            arm: phase === 'recoil' ? 'recoil' : 'point',
            armT: phase === 'hover' ? easeOut(seg(pt, 0.5, 1)) : phase === 'recoil' ? 1 - seg(pt, 0.9, 1.4) : 0,
            eyes: phase === 'recoil' ? 'wide' : 'normal',
          })
        }, dir * 0.4 * lean)
        if (phase === 'recoil' && pt < 1) say(s, x + dir * 8 * s.u, y - 24 * s.u, '!', C.crimson)
      },
    })
  },
}

// ─── Turtle, or seahorse ─────────────────────────────────────────────────────
// A sea turtle glides through with a small fish riding on its shell, who
// either enjoys the view or nods off and slides off the back. Other days it is
// a seahorse instead, bobbing along upright, sometimes with a small one in tow.

const drifters: ActDef = {
  id: 'scuba.turtle',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const turtle = chance(rng, 0.6)
    const alt = chance(rng, 0.5)
    const fish = pick(rng, FISH)
    const horse = pick(rng, [C.gold, C.rose, C.mint, C.purple])
    const depth = range(rng, 52, 78)
    const mid = stage.w * range(rng, 0.4, 0.6)
    let x = from
    let pt = -1 // seconds since the gag began, or -1 before it
    let slip = 0 // how far the passenger, or the little one, has dropped behind
    let hop = 0
    return makeAct({
      update(s, dt) {
        const y = s.ground - depth * s.u
        if (pt < 0 && past(dir, x, mid)) pt = 0
        if (pt >= 0) pt += dt
        let speed = turtle ? 46 : 44
        if (turtle) {
          if (alt && pt >= 0) slip = pt < 1.2 ? easeInOut(seg(pt, 0, 1.2)) * 46 : Math.max(0, slip - 30 * dt)
          if (!alt && pt >= 0 && pt - dt < 0) bubbles(s, x + dir * 4 * s.u, y - 24 * s.u, 3)
        } else if (alt) {
          // The little one stops to look about; the big one waits.
          if (pt >= 0 && pt < 1.6) slip = Math.min(40, slip + 44 * dt)
          else slip = Math.max(0, slip - 26 * dt)
          if (pt >= 1.2 && slip > 1) speed = 0
        } else if (pt >= 0 && pt < 1.3) {
          speed = 0
          if (pt >= 0.4 && pt - dt < 0.4) bubbles(s, x + dir * 13 * s.u, y - 10 * s.u, 2, 1.2)
          hop = Math.sin(seg(pt, 0.4, 1.1) * Math.PI) * 9
        }
        x += dir * speed * s.u * dt
        return !past(dir, x - dir * 50 * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        if (turtle) {
          const y = s.ground - depth * s.u + Math.sin(t * 1.1) * 3 * s.u
          const asleep = alt && pt < 0
          const chasing = alt && pt > 1.2 && slip > 1
          at(ctx, x, y, s.u, dir, () => {
            drawTurtle(ctx, t * 2.2, !alt && pt >= 0 && pt < 1.5 ? 'up' : (t * 0.31) % 1 > 0.95 ? 'closed' : 'normal')
            ctx.translate(-3 - slip, -18.5 + Math.sin(seg(slip, 0, 46) * Math.PI) * -4 + seg(slip, 20, 46) * 14)
            ctx.rotate(alt && pt >= 0 && pt < 1.2 ? -seg(pt, 0, 1.2) * 0.5 : 0)
            drawFish(ctx, fish, 11, chasing ? t * 30 : t * 3, { eyes: asleep || (alt && pt >= 0 && pt < 1) ? 'closed' : chasing ? 'wide' : 'normal' })
          })
          if (asleep) at(ctx, x - dir * 2 * s.u, y - 28 * s.u, s.u, 1, () => zzz(ctx, 0, 0, t))
          if (alt && pt > 1.1 && pt < 1.8) say(s, x - dir * 48 * s.u, y - 14 * s.u, '!', C.crimson)
          return
        }
        const bob = (ph: number) => s.ground - (depth + Math.sin(t * 2.3 + ph) * 4 + hop) * s.u
        if (alt) {
          const looking = pt >= 0 && pt < 1.6
          at(ctx, x - dir * (24 + slip) * s.u, bob(1.2) + 6 * s.u, s.u * 0.58, dir, () => drawSeahorse(ctx, shade(horse, 0.2), t, looking))
        }
        const waiting = alt && pt >= 1.2 && slip > 1
        at(ctx, x, bob(0), s.u, waiting ? ((-dir) as Dir) : dir, () => drawSeahorse(ctx, horse, t, !alt && pt > 0.4 && pt < 1.3))
        if (!alt && pt > 0.4 && pt < 1.2) say(s, x, bob(0) - 24 * s.u, '!', C.crimson)
      },
    })
  },
}

// ─── The photographers ───────────────────────────────────────────────────────
// Two divers, one with a camera the size of a suitcase, absorbed in something
// an inch long on the sea bed. Something very much bigger goes past behind
// them the whole time.

const photo: ActDef = {
  id: 'scuba.photo',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const a = pick(rng, DIVERS)
    const b = pick(rng, DIVERS.filter((d) => d !== a))
    const slug = chance(rng, 0.5)
    const manta = chance(rng, 0.4)
    const late = chance(rng, 0.5) // the buddy turns round just as the tail disappears
    const sx = stage.w * range(rng, 0.46, 0.56)
    const stopX = sx - dir * 40 * stage.u
    const speed = 58
    // The giant sets off from the far side so that it is overhead mid-shoot.
    const gStart = to + dir * 90 * stage.u
    const gSpeed = Math.abs(gStart - sx) / (Math.abs(stopX - from) / (speed * stage.u) + 2.2)
    let x = from
    let gx = gStart
    let kick = 0
    let pt = 0
    let flash = 0
    let shots = 0
    let phase: 'in' | 'shoot' | 'after' | 'out' = 'in'
    return makeAct({
      update(s, dt, t) {
        pt += dt
        gx -= dir * gSpeed * dt
        flash = Math.max(0, flash - dt * 7)
        const passed = dir * (x - gx) > 150 * s.u
        if (phase === 'in') {
          x += dir * speed * s.u * dt
          kick += dt * 6
          if (past(dir, x, stopX)) {
            phase = 'shoot'
            pt = 0
          }
        } else if (phase === 'shoot') {
          kick += dt * 1.8
          if (shots < 5 && pt > 1 + shots * 0.95) {
            shots++
            flash = 1
          }
          if (pt > 3.6 && passed) {
            phase = 'after'
            pt = 0
          }
        } else if (phase === 'after') {
          kick += dt * 1.8
          if (pt > 2.2) {
            phase = 'out'
            pt = 0
          }
        } else {
          x += dir * speed * s.u * dt
          kick += dt * 6
        }
        if (t % 3.2 < 0.6 && tick(t, dt, 8)) bubbles(s, x + dir * 26 * s.u, s.ground - 30 * s.u, 1)
        if ((t + 1.4) % 3.6 < 0.6 && tick(t, dt, 8)) bubbles(s, x - dir * 50 * s.u, s.ground - 58 * s.u, 1)
        return !(past(dir, x - dir * 70 * s.u, to) && past(-dir, gx, from - dir * 80 * s.u))
      },
      draw(s, t) {
        const { ctx } = s
        const settled = phase === 'shoot' || phase === 'after'
        const down = phase === 'shoot' ? easeInOut(seg(pt, 0, 0.8)) : phase === 'after' ? 1 - easeInOut(seg(pt, 1.6, 2.2)) : 0
        // The big one, well back in the gloom.
        ctx.globalAlpha = 0.26
        at(ctx, gx, s.ground - (manta ? 84 : 88) * s.u + Math.sin(t * 0.8) * 3 * s.u, s.u, (-dir) as Dir, () => (manta ? drawManta(ctx, t) : drawWhaleShark(ctx, t)))
        ctx.globalAlpha = 1
        // The subject.
        const seen = phase === 'out' ? 1 - seg(pt, 0.4, 1.4) : clamp(t * 1.2)
        ctx.globalAlpha = seen
        at(ctx, sx, s.ground, s.u, (-dir) as Dir, () => (slug ? drawNudibranch(ctx, t) : drawStarfish(ctx, t)))
        ctx.globalAlpha = 1
        // The buddy, hanging back a little higher up.
        const turned = late && phase === 'after' && pt > 0.2 && pt < 1.6
        const bx = x - dir * 76 * s.u
        const by = s.ground - (64 - down * 10 + Math.sin(t * 1.6 + 1) * 2) * s.u
        at(ctx, bx, by, s.u, dir, () => {
          drawDiver(ctx, b, {
            kick: kick + 1.5,
            amp: settled ? 0.14 : 0.32,
            arm: turned ? 'point' : 'ok',
            armT: turned ? 0 : phase === 'after' ? easeOut(seg(pt, late ? 1.5 : 0.3, late ? 1.8 : 0.7)) : 0,
            lookBack: turned,
            eyes: turned ? 'wide' : 'normal',
          })
        }, dir * 0.3 * down)
        if (turned && pt > 0.4) say(s, bx - dir * 4 * s.u, by - 22 * s.u, '?')
        // The photographer, nose down over the subject.
        const py = s.ground - (52 - down * 22 + Math.sin(t * 1.6) * 1.5) * s.u
        at(ctx, x, py, s.u, dir, () => {
          const d = drawDiver(ctx, a, { kick, amp: settled ? 0.12 : 0.32, arm: 'camera', armT: 1 })
          ctx.translate(d.hand.x + 5, d.hand.y + 1)
          ctx.rotate(0.15)
          drawCamera(ctx, flash)
        }, dir * 0.55 * down)
      },
    })
  },
}

// ─── The crab ────────────────────────────────────────────────────────────────
// Sideways along the bottom in short rushes. Halfway across something needs
// seeing off: a fish with the cheek to swim overhead, or a bubble.

const crab: ActDef = {
  id: 'scuba.crab',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 30)
    const color = pick(rng, [C.red, C.orange, '#f472b6'])
    const fish = pick(rng, FISH)
    const popper = chance(rng, 0.5)
    const stopX = stage.w * range(rng, 0.38, 0.62)
    // Fish and crab are timed to meet at the crab's stopping place.
    const fStart = to + dir * 10 * stage.u
    const fSpeed = Math.abs(fStart - stopX) / (Math.abs(stopX - from) / (44.3 * stage.u) + 0.7)
    let x = from
    let fx = fStart
    let pt = 0
    let by = 0 // the bubble's height, units
    let popped = false
    let moving = false
    let phase: 'in' | 'gag' | 'out' = 'in'
    return makeAct({
      update(s, dt, t) {
        pt += dt
        moving = phase !== 'gag' && t % 1.3 < 0.92
        if (moving) x += dir * 62 * s.u * dt
        if (!popper) fx -= dir * fSpeed * (dir * (fx - x) < 20 * s.u ? 1.8 : 1) * dt
        if (phase === 'in' && past(dir, x, stopX)) {
          phase = 'gag'
          pt = 0
        } else if (phase === 'gag') {
          if (popper) {
            by = 5 + Math.max(0, pt - 0.3) * 13
            if (!popped && by >= 21) {
              popped = true
              pt = 10
              bubbles(s, x + dir * 15 * s.u, s.ground - 22 * s.u, 7, 0.6)
            }
            if (popped && pt > 11.4) phase = 'out'
          } else if (dir * (x - fx) > 70 * s.u) phase = 'out'
        }
        return !(past(dir, x, to) && (popper || past(-dir, fx, from)))
      },
      draw(s, t) {
        const { ctx } = s
        const gag = phase === 'gag'
        if (!popper) {
          const scared = Math.abs(fx - x) < 60 * s.u
          at(ctx, fx, s.ground - (36 + Math.sin(t * 2) * 2) * s.u, s.u, (-dir) as Dir, () => drawFish(ctx, fish, 14, t * (scared ? 24 : 10), { eyes: scared ? 'wide' : 'normal' }))
        }
        if (popper && gag && !popped) {
          // One fat bubble, wobbling up right under its nose.
          const r = 5.5
          at(ctx, x + dir * (15 + Math.sin(t * 5) * 1.2) * s.u, s.ground - by * s.u, s.u, 1, () => {
            fillCirc(ctx, 0, 0, r, alpha(C.sky, 0.14))
            ctx.beginPath()
            ctx.arc(0, 0, r, 0, TAU)
            ctx.lineWidth = 0.9
            ctx.strokeStyle = alpha(C.sky, 0.85)
            ctx.stroke()
            fillCirc(ctx, -r * 0.35, -r * 0.35, r * 0.2, 'rgba(255,255,255,0.8)')
          })
        }
        at(ctx, x, s.ground, s.u, 1, () => {
          groundShadow(ctx, 0, 14, 0.22)
          const cross = gag && !popper
          const aim = gag && popper && !popped
          drawCrab(ctx, color, t, {
            scuttle: moving ? 1 : 0,
            claws: cross ? 0.85 + Math.sin(t * 16) * 0.15 : aim ? seg(pt, 0.3, 1.4) : gag ? 0.8 : 0.12,
            snap: cross ? t * 14 : gag && popped ? t * 12 : aim && by > 16 ? t * 10 : undefined,
            wide: aim,
          })
        })
        if (gag && !popper) say(s, x, s.ground - 30 * s.u, '!', C.crimson)
      },
    })
  },
}

export const SCUBA_ACTS: ActDef[] = [diverOk, shoal, octopus, chest, drifters, photo, crab]
