import { C, TAU, alpha, at, clamp, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, type Ctx } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { CAST, drawPerson, personAnchors, type Look, type Pose } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, AmbientDef, Stage } from '../types'

export const SUMMER_AMBIENT: AmbientDef = {
  kind: 'seed',
  colors: ['#f8fafc', '#fef9e7', '#fde9c9', '#e2e8f0'],
  rate: 0.7,
  flurry: [18, 30],
  settle: false,
  size: [4, 6],
}

/** Has something travelling in `dir` got as far as `target`? */
const passed = (dir: 1 | -1, x: number, target: number) => (dir === 1 ? x >= target : x <= target)
/** True on the frame that `t` crosses `mark`. */
const hit = (t: number, dt: number, mark: number) => t >= mark && t - dt < mark
/** True `rate` times a second. */
const tick = (t: number, dt: number, rate: number) => Math.floor(t * rate) !== Math.floor((t - dt) * rate)

const KID_LOOKS: Look[] = [
  { ...CAST.kid, shorts: true },
  { ...CAST.girl, shorts: true, top: '#fb7185' },
  { ...CAST.kid, shorts: true, top: C.mint, hat: 'cap', hatColor: C.red },
  { ...CAST.girl, shorts: true, hat: 'sunhat', hatColor: '#fde9c9', hatTrim: C.purple },
]

// ─── Props ───────────────────────────────────────────────────────────────────

const SCOOPS = ['#f9a8d4', '#fde9c9', '#a7f3d0', '#c4b5fd']

/** A wafer cone held at its point (the origin), with or without its scoop. */
function drawCone(ctx: Ctx, scoop: string | null) {
  fillPoly(ctx, [-3.4, -8, 3.4, -8, 0, 1], '#d9a35a')
  line(ctx, -2.2, -6.4, 1, -2, 0.5, '#a16207')
  line(ctx, 2.2, -6.4, -1, -2, 0.5, '#a16207')
  line(ctx, -0.4, -7.6, 2, -4.6, 0.5, '#a16207')
  fillRR(ctx, -3.8, -9, 7.6, 1.8, 0.9, '#e8b872')
  if (scoop) drawScoop(ctx, 0, -12, scoop)
}

function drawScoop(ctx: Ctx, x: number, y: number, color: string) {
  fillCirc(ctx, x, y, 4.3, color)
  fillEll(ctx, x - 2.6, y + 2.8, 1.8, 1.5, color)
  fillEll(ctx, x + 2.4, y + 3, 2, 1.4, color)
  fillEll(ctx, x - 1.4, y - 1.6, 1.6, 1.1, alpha('#ffffff', 0.5), -0.5)
}

/**
 * The ice-cream cart, centred on `cx`: an insulated box on one big spoked
 * wheel, a striped awning, a painted cone on the side and a brass bell that
 * swings with `ring`. The handle runs back to (hx, hy).
 */
function drawCart(ctx: Ctx, cx: number, spin: number, ring: number, hx: number, hy: number) {
  groundShadow(ctx, cx, 19)
  line(ctx, cx - 14, -24, hx, hy, 1.8, '#94a3b8')
  // Prop leg at the front, wheel under the middle.
  line(ctx, cx + 13, -11, cx + 14, -1, 1.8, '#64748b')
  fillRR(ctx, cx + 12, -1.6, 4.5, 1.6, 0.8, '#475569')
  // Awning poles go behind the box.
  line(ctx, cx - 12, -27, cx - 12, -47, 1.3, '#cbd5e1')
  line(ctx, cx + 14, -27, cx + 14, -47, 1.3, '#cbd5e1')
  fillRR(ctx, cx - 16, -28, 33, 18, 3, '#f8fafc')
  fillRR(ctx, cx - 16, -15, 33, 5, 2, '#fda4af')
  fillRR(ctx, cx - 16, -29.5, 33, 3, 1.5, '#e2e8f0')
  // Two lids with knobs.
  fillRR(ctx, cx - 12, -31, 10, 2.2, 1, '#94a3b8')
  fillRR(ctx, cx + 2, -31, 10, 2.2, 1, '#94a3b8')
  fillCirc(ctx, cx - 7, -32, 1.1, '#64748b')
  fillCirc(ctx, cx + 7, -32, 1.1, '#64748b')
  // The painted cone.
  ctx.save()
  ctx.translate(cx + 1, -17.5)
  ctx.scale(0.62, 0.62)
  drawCone(ctx, '#f9a8d4')
  ctx.restore()
  fillRR(ctx, cx - 14.5, -26, 1.6, 9, 0.8, alpha('#ffffff', 0.6))
  // Awning: pink and white stripes with a scalloped edge.
  for (let i = 0; i < 6; i++) {
    const sx = cx - 17 + i * 6
    const col = i % 2 ? '#f8fafc' : '#fb7185'
    fillRR(ctx, sx, -53, 6.2, 6, 0.6, col)
    fillCirc(ctx, sx + 3.1, -47, 3.1, col)
  }
  fillRR(ctx, cx - 17, -54, 36.2, 1.8, 0.9, '#e2e8f0')
  // Wheel.
  const wx = cx - 3
  fillCirc(ctx, wx, -8, 8, '#334155')
  fillCirc(ctx, wx, -8, 6.3, '#0f1c2e')
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * TAU) / 6
    line(ctx, wx, -8, wx + Math.cos(a) * 6.4, -8 + Math.sin(a) * 6.4, 0.8, '#cbd5e1')
  }
  fillCirc(ctx, wx, -8, 1.8, '#fda4af')
  // Bell on a bracket at the front of the awning.
  line(ctx, cx + 19, -52, cx + 22, -52, 1.2, '#cbd5e1')
  ctx.save()
  ctx.translate(cx + 22, -51.5)
  ctx.rotate(ring)
  line(ctx, 0, 0, 0, 2, 0.8, '#a16207')
  ctx.beginPath()
  ctx.moveTo(-3.6, 8)
  ctx.quadraticCurveTo(-3.2, 2, 0, 2)
  ctx.quadraticCurveTo(3.2, 2, 3.6, 8)
  ctx.closePath()
  ctx.fillStyle = C.brass
  ctx.fill()
  fillRR(ctx, -4.2, 7.4, 8.4, 1.4, 0.7, shade(C.brass, -0.18))
  fillCirc(ctx, -ring * 3, 9.4, 1.1, '#a16207')
  fillEll(ctx, -1.4, 4.6, 0.8, 1.8, alpha('#ffffff', 0.5), 0.2)
  ctx.restore()
}

/** A herring gull about 26 units across, centred on its body. `flap` radians. */
function drawGull(ctx: Ctx, flap: number, carrying: string | null) {
  const w = Math.sin(flap)
  // Far wing, tail, body, head, near wing.
  fillPoly(ctx, [-2, -2, -5, -3 - w * 9, -11, -4 - w * 13, -4, 0], '#cbd5e1')
  fillPoly(ctx, [-7, -1, -13.5, -2.5, -13, 1.5, -7, 2], '#f8fafc')
  fillPoly(ctx, [-13.5, -2.5, -15.5, -2, -13, 1.5], '#475569')
  fillEll(ctx, 0, 0, 8.5, 4.2, '#f8fafc', -0.08)
  fillEll(ctx, 0, 1.6, 6.5, 2.2, '#e2e8f0')
  fillCirc(ctx, 7.6, -2.4, 3.5, '#f8fafc')
  fillPoly(ctx, [10.4, -3.2, 15.4, -1.6, 10.4, -0.6], C.gold)
  fillCirc(ctx, 14, -1.3, 0.7, C.red)
  fillCirc(ctx, 8.6, -3.2, 0.85, C.ink)
  line(ctx, 7.6, -4.4, 9.8, -4.2, 0.6, '#64748b')
  // Near wing: two joints, grey with black tips.
  const ex = -3
  const ey = -3 - w * 10
  const tx = -10
  const ty = -4 - w * 15 + Math.cos(flap) * 2
  fillPoly(ctx, [3, -1.5, ex, ey, tx, ty, -2, 1.5], '#94a3b8')
  fillPoly(ctx, [ex, ey, tx, ty, lerp(ex, tx, 0.5), lerp(ey, ty, 0.5) + 2.5], '#b6c2d2')
  fillPoly(ctx, [tx, ty, lerp(ex, tx, 0.72), lerp(ey, ty, 0.72), lerp(ex, tx, 0.7) + 0.6, lerp(ey, ty, 0.7) + 2.6], '#334155')
  // Feet tucked up behind.
  line(ctx, -3, 3.4, -6.5, 4.6, 0.9, C.orange)
  line(ctx, -1.5, 3.6, -5, 5, 0.9, C.orange)
  if (carrying) drawScoop(ctx, 15.5, 1.2, carrying)
}

/** A diamond kite centred on the origin, nose up, with a bow tail. */
function drawKite(ctx: Ctx, a: string, b: string, time: number, limp: boolean) {
  // Tail first: a wavy ribbon with three bows.
  const pts: number[] = [0, 15]
  for (let i = 1; i <= 6; i++) {
    const wav = limp ? 0 : Math.sin(time * 7 - i * 0.9) * (1.5 + i * 0.5)
    pts.push(-i * 1.5 + wav, 15 + i * 5)
  }
  poly(ctx, pts, 0.9, '#e2e8f0')
  for (let i = 0; i < 3; i++) {
    const bx = pts[4 + i * 4]
    const by = pts[5 + i * 4]
    const col = i % 2 ? a : b
    fillPoly(ctx, [bx, by, bx - 3.4, by - 2, bx - 3.4, by + 2], col)
    fillPoly(ctx, [bx, by, bx + 3.4, by - 2, bx + 3.4, by + 2], col)
  }
  fillPoly(ctx, [0, -14, 9, -2, 0, -2], a)
  fillPoly(ctx, [0, -14, -9, -2, 0, -2], shade(a, -0.16))
  fillPoly(ctx, [0, 15, 9, -2, 0, -2], shade(b, -0.14))
  fillPoly(ctx, [0, 15, -9, -2, 0, -2], b)
  line(ctx, 0, -14, 0, 15, 0.8, '#7c5a2e')
  line(ctx, -9, -2, 9, -2, 0.8, '#7c5a2e')
  // A cheerful face, since it is going to misbehave.
  fillCirc(ctx, -3, -6, 0.9, C.ink)
  fillCirc(ctx, 3, -6, 0.9, C.ink)
  ctx.beginPath()
  ctx.arc(0, -4.6, 2.4, 0.3, Math.PI - 0.3)
  ctx.lineWidth = 0.8
  ctx.strokeStyle = C.ink
  ctx.stroke()
}

type BeachItem = 'cool' | 'chair' | 'ring' | 'brolly' | 'ball'
const ITEM_H: Record<BeachItem, number> = { cool: 15.5, chair: 6, ring: 8, brolly: 6, ball: 11 }

/** One piece of beach luggage, origin at the middle of its base. */
function drawItem(ctx: Ctx, kind: BeachItem, spin = 0) {
  if (kind === 'cool') {
    fillRR(ctx, -11, -13, 22, 13, 2, '#38bdf8')
    fillRR(ctx, -11, -6, 22, 2, 0, shade('#38bdf8', -0.18))
    fillRR(ctx, -12, -15.5, 24, 4, 1.6, '#f8fafc')
    fillRR(ctx, -2, -12.4, 4, 3, 1, '#e2e8f0')
    ctx.beginPath()
    ctx.arc(0, -15, 6, Math.PI * 1.1, Math.PI * 1.9)
    ctx.lineWidth = 1.2
    ctx.strokeStyle = '#94a3b8'
    ctx.stroke()
    fillRR(ctx, -9.4, -11.4, 1.6, 7, 0.8, alpha('#ffffff', 0.35))
  } else if (kind === 'chair') {
    // A folded deckchair: two wooden rails with the striped sling between.
    fillRR(ctx, -16, -6, 32, 1.8, 0.9, '#c8a06a')
    fillRR(ctx, -16, -1.8, 32, 1.8, 0.9, '#a97f4a')
    for (let i = 0; i < 6; i++) fillRR(ctx, -12 + i * 4, -4.4, 4, 2.8, 0, i % 2 ? '#f8fafc' : '#ef4444')
    fillCirc(ctx, -14, -3, 1, '#7c5a2e')
    fillCirc(ctx, 14, -3, 1, '#7c5a2e')
  } else if (kind === 'ring') {
    fillEll(ctx, 0, -4, 13, 4, '#fb7185')
    fillEll(ctx, -8.4, -4, 2.6, 3.4, '#f8fafc', 0.3)
    fillEll(ctx, 8.4, -4, 2.6, 3.4, '#f8fafc', -0.3)
    fillEll(ctx, 0, -4, 2.8, 3.9, '#f8fafc')
    fillEll(ctx, -3, -6, 6, 1, alpha('#ffffff', 0.45))
    fillRR(ctx, 11.6, -3.2, 2.6, 1.6, 0.8, '#f8fafc')
  } else if (kind === 'brolly') {
    // A furled parasol on its pole.
    line(ctx, -21, -3, 21, -3, 1.5, '#c8a06a')
    fillPoly(ctx, [-13, -5.8, 14, -4.4, 14, -1.6, -13, -0.2], '#fde047')
    fillPoly(ctx, [-13, -5.8, -4, -5.3, -4, -0.7, -13, -0.2], '#fb923c')
    fillPoly(ctx, [5, -4.9, 14, -4.4, 14, -1.6, 5, -1.1], '#fb923c')
    line(ctx, 15, -3, 15.2, -3, 3.4, '#e2e8f0')
    fillCirc(ctx, -21, -3, 1.3, '#7c5a2e')
  } else {
    const r = 5.5
    fillCirc(ctx, 0, -r, r, '#f8fafc')
    const cols = ['#ef4444', '#fde047', '#3b82f6']
    for (let i = 0; i < 3; i++) {
      const a0 = spin + (i * TAU) / 3
      ctx.beginPath()
      ctx.moveTo(0, -r)
      ctx.arc(0, -r, r, a0, a0 + TAU / 6)
      ctx.closePath()
      ctx.fillStyle = cols[i]
      ctx.fill()
    }
    fillCirc(ctx, 0, -r, 1.3, '#f8fafc')
    fillEll(ctx, -2, -r - 2.4, 1.6, 1, alpha('#ffffff', 0.6), -0.5)
  }
}

/** A pop-up lawn sprinkler. `rise` 0..1 out of the ground, `aim` radians from the +x axis, up. */
function drawSprinkler(ctx: Ctx, rise: number, aim: number, droop = 0) {
  if (rise <= 0.02) return
  const h = 9 * rise
  fillEll(ctx, 0, 0, 5.5 * clamp(rise * 2), 1.6, '#334155')
  fillRR(ctx, -1.6, -h, 3.2, h, 1, '#64748b')
  fillRR(ctx, -1.6, -h, 1.1, h, 0.5, alpha('#ffffff', 0.25))
  ctx.save()
  ctx.translate(0, -h - 1)
  ctx.rotate(-aim + droop)
  fillRR(ctx, -2.6, -2.2, 5.2, 4.4, 2, '#22c55e')
  fillRR(ctx, 1.6, -1.2, 5, 2.4, 0.8, '#16a34a')
  fillRR(ctx, 6, -1.6, 1.6, 3.2, 0.6, '#facc15')
  ctx.restore()
  fillCirc(ctx, 0, -h - 1, 1, '#bbf7d0')
}

/** A broadsheet held open at the origin. `soggy` 0..1 lets it collapse. */
function drawPaper(ctx: Ctx, soggy: number) {
  const s = soggy
  const col = shade('#f1f5f9', -0.3 * s)
  // Two pages, hinged in the middle; wet, they fold and hang.
  fillPoly(ctx, [0, -9 + s * 8, 7 + s * 0.5, -10 + s * 12, 7.5 - s * 3, 6 + s * 9, 0, 7 + s * 6], col)
  fillPoly(ctx, [0, -9 + s * 8, -6 + s * 2, -10 + s * 13, -6.5 + s * 4, 6 + s * 8, 0, 7 + s * 6], shade(col, -0.12))
  if (s < 0.5) {
    fillRR(ctx, 1.2, -7.6, 5, 1.6, 0.4, '#475569')
    for (let i = 0; i < 4; i++) line(ctx, 1.4, -4 + i * 2.4, 6, -4.1 + i * 2.4, 0.5, '#94a3b8')
    fillRR(ctx, -5, -7, 3.4, 4, 0.4, '#94a3b8')
    for (let i = 0; i < 2; i++) line(ctx, -5, -0.6 + i * 2.4, -1.2, -0.5 + i * 2.4, 0.5, '#94a3b8')
  }
}

/** An umbrella held at the origin, pointing up the -y axis. `open` 0..1. */
function drawUmbrella(ctx: Ctx, open: number, color: string) {
  line(ctx, 0, 3, 0, -17, 1.2, '#cbd5e1')
  ctx.beginPath()
  ctx.arc(1.6, 3, 1.6, 0, Math.PI)
  ctx.lineWidth = 1.2
  ctx.strokeStyle = '#7c5a2e'
  ctx.stroke()
  const w = lerp(2.2, 15, open)
  const d = lerp(13, 7, open)
  ctx.beginPath()
  ctx.moveTo(-w, -17 + d)
  ctx.quadraticCurveTo(-w * 0.9, -19, 0, -19.5)
  ctx.quadraticCurveTo(w * 0.9, -19, w, -17 + d)
  // Scalloped hem.
  for (let i = 0; i < 3; i++) {
    const x1 = w - ((i + 1) * 2 * w) / 3
    ctx.quadraticCurveTo(x1 + w / 3, -17 + d - 3 * open, x1, -17 + d)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  if (open > 0.5) {
    line(ctx, -w / 3, -17 + d - 1, -w * 0.22, -19, 0.6, shade(color, -0.22))
    line(ctx, w / 3, -17 + d - 1, w * 0.22, -19, 0.6, shade(color, -0.22))
  }
  fillCirc(ctx, 0, -20.2, 0.9, '#cbd5e1')
}

/** A butterfly about 11 units across. `flap` radians; wings close as it lands. */
function drawButterfly(ctx: Ctx, flap: number, color: string, spot: string) {
  const w = 0.2 + Math.abs(Math.sin(flap)) * 0.8
  for (const sd of [-1, 1]) {
    fillEll(ctx, sd * 3.2 * w, -1.8, 3.6 * w, 4.2, color, sd * 0.35)
    fillEll(ctx, sd * 2.5 * w, 2.4, 2.5 * w, 2.8, shade(color, -0.18), -sd * 0.35)
    fillCirc(ctx, sd * 3.6 * w, -2.2, 1.2 * w, spot)
    fillCirc(ctx, sd * 2.6 * w, 2.6, 0.7 * w, spot)
  }
  line(ctx, 0, -3, 0, 3.4, 1.2, '#3b2a1a')
  line(ctx, 0, -3, -1.6, -5.6, 0.5, '#3b2a1a')
  line(ctx, 0, -3, 1.6, -5.6, 0.5, '#3b2a1a')
}

/** A butterfly net held at the origin, pole along `ang` (0 down, PI/2 forward, PI up). */
function drawNet(ctx: Ctx, ang: number, swish: number) {
  const dx = Math.sin(ang)
  const dy = Math.cos(ang)
  const L = 19
  const hx = dx * L
  const hy = dy * L
  line(ctx, -dx * 4, -dy * 4, hx, hy, 1.4, '#c8a06a')
  // Hoop beyond the end of the pole, with the bag trailing behind the swing.
  const cx = hx + dx * 6.5
  const cy = hy + dy * 6.5
  const bx = cx - dy * (9 + swish * 3) - dx * 2
  const by = cy + dx * (9 + swish * 3) - dy * 2 + 3
  ctx.beginPath()
  ctx.moveTo(hx, hy)
  ctx.quadraticCurveTo(bx - dx * 4, by - dy * 4, bx, by)
  ctx.quadraticCurveTo(bx + dx * 8, by + dy * 8, cx + dx * 6.5, cy + dy * 6.5)
  ctx.closePath()
  ctx.fillStyle = alpha('#e2e8f0', 0.3)
  ctx.fill()
  for (let i = 1; i <= 3; i++) {
    const k = i / 4
    line(ctx, hx + dx * 13 * k, hy + dy * 13 * k, lerp(cx, bx, 0.85), lerp(cy, by, 0.85), 0.4, alpha('#ffffff', 0.45))
  }
  ctx.beginPath()
  ctx.ellipse(cx, cy, 6.5, 2.4, Math.atan2(dy, dx), 0, TAU)
  ctx.lineWidth = 1.1
  ctx.strokeStyle = '#94a3b8'
  ctx.stroke()
}

// ─── The ice-cream cart ──────────────────────────────────────────────────────
// A seller wheels the cart on and rings the bell. A child comes running from
// the other side, gets a cone, and has had it for about a second when either
// the scoop slides off onto the floor or a gull takes it on the wing.

const iceCream: ActDef = {
  id: 'summer.ice-cream',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 85)
    const gag = chance(rng, 0.5) ? 'gull' : 'splat'
    const seller: Look = { skin: C.skinB, top: '#f8fafc', bottom: '#33507a', shoe: '#22344f', hair: '#3b2a1a', moustache: '#3b2a1a', hat: 'cap', hatColor: '#fda4af', apron: '#fda4af' }
    const kidLook = pick(rng, KID_LOOKS)
    const flavour = pick(rng, SCOOPS)
    const K = 0.82
    const CX = 36 // cart centre, units ahead of the seller
    const stopX = stage.w * 0.5 - dir * 44 * stage.u
    const cartX = stopX + dir * CX * stage.u
    const kidStop = cartX + dir * 33 * stage.u
    // Where the cone sits in the child's frame when it is held up to lick.
    const HOLD: Pose = { armF: 1.2, elbowF: 1.0, armB: 0.1 }
    const hold = personAnchors(HOLD)
    let x = from
    let walk = 0
    let spin = 0
    let sp: 'in' | 'wait' | 'out' = 'in'
    let st = 0
    let kx = to
    let kwalk = 0
    let kp: 'hidden' | 'run' | 'ask' | 'away' | 'gag' | 'react' | 'off' = 'hidden'
    let kt = 0
    let hasCone = false
    let hasScoop = false
    let eaten = false
    // The scoop once it has left the cone: falling, then a puddle.
    const blob = { x: 0, y: 0, vy: 0, state: 'none' as 'none' | 'fall' | 'puddle', age: 0 }
    const gull = { x: 0, y: 0, on: false, got: false, t: 0, t0: 0 }
    const coneX = (s: Stage, face: number) => kx + face * (hold.handF.x + 1) * K * s.u
    const coneY = (s: Stage) => s.ground + (hold.handF.y - 12) * K * s.u
    return makeAct({
      update(s, dt, t) {
        st += dt
        kt += dt
        if (sp === 'in') {
          x += dir * 50 * s.u * dt
          walk += dt * 8
          spin += dt * 50 / 8
          if (passed(dir, x, stopX)) {
            x = stopX
            sp = 'wait'
            st = 0
            kp = 'run'
            kt = 0
          }
        } else if (sp === 'wait') {
          if (kp === 'run' && tick(t, dt, 2.5)) {
            s.particles.emit({ kind: 'note', x: cartX + dir * 24 * s.u, y: s.ground - 50 * s.u, vx: dir * range(rng, 4, 16) * s.u, size: range(rng, 5, 7) * s.u, color: pick(rng, [C.yellow, C.pink, C.sky]) })
          }
          if (kp === 'off' && kt > 0.6) {
            sp = 'out'
            st = 0
          }
        } else {
          x += dir * 50 * s.u * dt
          walk += dt * 8
          spin += dt * 50 / 8
        }
        if (kp === 'run') {
          kx -= dir * 165 * s.u * dt
          kwalk += dt * 26
          if (passed(-dir as 1 | -1, kx, kidStop)) {
            kx = kidStop
            kp = 'ask'
            kt = 0
          }
        } else if (kp === 'ask') {
          if (hit(kt, dt, 1.25)) {
            hasCone = true
            hasScoop = true
          }
          if (kt > 1.9) {
            kp = 'away'
            kt = 0
          }
        } else if (kp === 'away') {
          kx += dir * 46 * s.u * dt
          kwalk += dt * 7.5
          if (kt > 1.3) {
            kp = 'gag'
            kt = 0
            if (gag === 'gull') {
              // Comes in from behind the cart, high, and stoops at the last moment.
              gull.on = true
              gull.x = dir === 1 ? -30 * s.u : s.w + 30 * s.u
              gull.t0 = Math.abs(coneX(s, dir) - gull.x) / (215 * s.u)
              gull.t = 0
            }
          }
        } else if (kp === 'gag') {
          if (gag === 'splat') {
            if (hit(kt, dt, 0.5)) {
              hasScoop = false
              blob.state = 'fall'
              blob.x = coneX(s, dir)
              blob.y = coneY(s)
              blob.vy = 0
            }
            if (blob.state === 'puddle') {
              kp = 'react'
              kt = 0
            }
          } else if (gull.got) {
            kp = 'react'
            kt = 0
          }
        } else if (kp === 'react') {
          if (hit(kt, dt, 1.9)) {
            // Well, the cone is still good.
            eaten = true
            hasCone = false
            burst(s, 'spark', coneX(s, dir), coneY(s) + 6 * s.u, 5, ['#d9a35a', '#e8b872'], 40, [1, 2])
          }
          if (kt > 2.7) {
            kp = 'off'
            kt = 0
          }
        } else if (kp === 'off') {
          kx += dir * 70 * s.u * dt
          kwalk += dt * 11
        }
        if (blob.state === 'fall') {
          blob.vy += 520 * s.u * dt
          blob.y += blob.vy * dt
          if (blob.y >= s.ground - 2 * s.u) {
            blob.state = 'puddle'
            blob.age = 0
            burst(s, 'drop', blob.x, s.ground - 3 * s.u, 8, [flavour], 70, [1.5, 2.6])
          }
        } else if (blob.state === 'puddle') blob.age += dt
        if (gull.on) {
          gull.t += dt
          gull.x += dir * 215 * s.u * dt
          const k = (gull.t - gull.t0) / 0.75
          const high = 96 * s.u
          gull.y = lerp(coneY(s), s.ground - high, clamp(k * k))
          if (!gull.got && gull.t >= gull.t0) {
            gull.got = true
            hasScoop = false
            burst(s, 'dust', gull.x, gull.y, 3, ['#f8fafc'], 40, [2, 3])
          }
          if (gull.x < -40 * s.u || gull.x > s.w + 40 * s.u) gull.on = false
        }
        const kidGone = kp === 'off' && passed(dir, kx, to)
        return !(kidGone && sp === 'out' && passed(dir, x, to) && !gull.on)
      },
      draw(s, t) {
        const { ctx } = s
        // The puddle, fading as the cart rolls through it.
        if (blob.state === 'puddle') {
          const fade = 1 - seg(blob.age, 4, 6)
          if (fade > 0) {
            ctx.globalAlpha = fade
            at(ctx, blob.x, s.ground, s.u, 1, () => {
              const sp2 = easeOut(seg(blob.age, 0, 0.25))
              fillEll(ctx, 0, -0.8, 3 + sp2 * 5, 1 + sp2 * 1.2, flavour)
              fillCirc(ctx, -6 * sp2, -0.6, 1.2, flavour)
              fillCirc(ctx, 7 * sp2, -0.9, 1, flavour)
              fillEll(ctx, -1, -1.4, 2.4, 0.6, alpha('#ffffff', 0.5))
            })
            ctx.globalAlpha = 1
          }
        } else if (blob.state === 'fall') at(ctx, blob.x, blob.y, s.u, 1, () => drawScoop(ctx, 0, 0, flavour))
        // Seller and cart.
        const serving = kp === 'ask'
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const moving = sp !== 'wait'
          const give = serving ? easeInOut(seg(kt, 0.5, 1.2)) * (1 - seg(kt, 1.4, 1.8)) : 0
          const ringing = sp === 'wait' && kp === 'run'
          const pose: Pose = moving
            ? { walk, stride: 0.7, armF: 1.0, elbowF: 0.4, armB: 0.8, elbowB: 0.5, lean: 0.12, mouth: 'smile', blink: blinking(s.time, 3) }
            : ringing
              ? { armF: 2.5 + Math.sin(t * 14) * 0.12, elbowF: -0.3, armB: 0.8, elbowB: 0.5, mouth: 'grin', blink: blinking(s.time, 3) }
              : { armF: 1.0 + give * 0.75, elbowF: 0.4 - give * 0.3, armB: 0.8, elbowB: 0.5, lean: give * 0.2, mouth: 'smile', blink: blinking(s.time, 3) }
          const a = personAnchors(pose)
          const gripX = moving ? a.handF.x : 13
          const gripY = moving ? a.handF.y : -26
          drawCart(ctx, CX, spin, ringing ? Math.sin(t * 16) * 0.5 : Math.sin(walk) * 0.08 * (moving ? 1 : 0), gripX, gripY)
          drawPerson(ctx, seller, pose)
          if (serving && kt > 0.5 && kt < 1.25) {
            // The cone, handed over the top of the cart.
            const p = easeInOut(seg(kt, 0.7, 1.25))
            ctx.save()
            ctx.translate(lerp(a.handF.x + 2, CX + 26, p), lerp(a.handF.y - 2, -34, p))
            drawCone(ctx, flavour)
            ctx.restore()
          }
        })
        // The child.
        if (kp !== 'hidden') {
          const face: 1 | -1 = kp === 'run' || kp === 'ask' ? ((-dir) as 1 | -1) : dir
          at(ctx, kx, s.ground, s.u * K, face, () => {
            groundShadow(ctx, 0, 10)
            let pose: Pose = { ...HOLD, mouth: 'smile', blink: blinking(s.time, 5) }
            if (kp === 'run') pose = { walk: kwalk, stride: 1, lean: 0.24, armF: 2.6, elbowF: -0.2, mouth: 'grin' }
            else if (kp === 'ask') pose = kt < 1.25 ? { armF: 1.5, elbowF: 0.3, armB: 0.1, mouth: 'grin', lift: Math.abs(Math.sin(kt * 9)) * 3 } : { ...HOLD, mouth: 'grin', eyes: 'closed' }
            else if (kp === 'away') pose = { ...HOLD, walk: kwalk, stride: 0.6, mouth: 'grin', eyes: 'closed' }
            else if (kp === 'gag') pose = { ...HOLD, mouth: hasScoop ? 'grin' : 'o', eyes: hasScoop ? 'closed' : 'wide' }
            else if (kp === 'react') {
              if (kt < 1.2 && gag === 'gull') pose = { ...HOLD, armB: -2.6 + Math.sin(t * 20) * 0.25, elbowB: -0.4, headTilt: -0.3, mouth: 'frown', eyes: 'wide' }
              else if (kt < 1.2) pose = { ...HOLD, headTilt: 0.3, lean: 0.12, mouth: 'frown', eyes: 'wide' }
              else if (!eaten) pose = { ...HOLD, armF: 1.5, elbowF: 1.5, mouth: 'o' }
              else pose = { armF: 0.2, armB: 0.2, mouth: 'grin', eyes: 'closed', headTilt: Math.sin(t * 16) * 0.05 }
            } else if (kp === 'off') pose = { walk: kwalk, stride: 0.8, mouth: 'smile' }
            const a = drawPerson(ctx, kidLook, pose)
            if (hasCone) {
              ctx.save()
              ctx.translate(a.handF.x + 1, a.handF.y)
              drawCone(ctx, hasScoop ? flavour : null)
              ctx.restore()
              fillCirc(ctx, a.handF.x, a.handF.y, 2.4, kidLook.skin)
            }
            if (kp === 'gag' && !hasScoop) bubble(ctx, a.head.x, a.head.y - 18, '!', { color: C.crimson })
          })
        }
        if (gull.on) at(ctx, gull.x, gull.y, s.u, dir, () => drawGull(ctx, t * 13, gull.got ? flavour : null), dir * (gull.got ? -0.25 : 0.2))
      },
    })
  },
}

// ─── The kite ────────────────────────────────────────────────────────────────
// A child tears across with a kite bobbing along behind and above. Either a
// gust catches it and lifts them clean off their feet for a moment, or it
// nosedives ahead of them and they leave wrapped in string, towing it.

const kite: ActDef = {
  id: 'summer.kite',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 100)
    const gag = chance(rng, 0.5) ? 'tangle' : 'gust'
    const look = pick(rng, KID_LOOKS)
    const [ka, kb] = pick(rng, [
      ['#fb7185', '#fde047'],
      ['#22d3ee', '#f8fafc'],
      ['#a78bfa', '#5eead4'],
      ['#fb923c', '#7dd3fc'],
    ] as const)
    const K = 0.85
    const gagAt = stage.w * range(rng, 0.38, 0.5)
    let x = from
    let walk = 0
    let phase: 'run' | 'gust' | 'dive' | 'tangled' | 'hop' = 'run'
    let pt = 0
    let done = false
    // Kite position relative to the child, in units: behind and above.
    let ox = -52
    let oy = -84
    let crashX = 0 // px, where it came down
    let lift = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const travelled = dir === 1 ? x : s.w - x
        if (!done && phase === 'run' && travelled > gagAt) {
          done = true
          phase = gag === 'gust' ? 'gust' : 'dive'
          pt = 0
        }
        let v = 104
        lift = 0
        if (phase === 'run') {
          // Bobbing on the end of the string, always a beat behind.
          ox += (-52 + Math.sin(t * 1.7) * 7 - ox) * Math.min(1, dt * 4)
          oy += (-84 + Math.sin(t * 2.6) * 9 - oy) * Math.min(1, dt * 4)
        } else if (phase === 'gust') {
          const p = seg(pt, 0, 1.5)
          const up = Math.sin(p * Math.PI)
          ox += (-34 - ox) * Math.min(1, dt * 5)
          oy += (-88 - up * 34 - oy) * Math.min(1, dt * 6)
          lift = Math.pow(up, 1.5) * 15
          if (tick(t, dt, 10)) s.particles.emit({ kind: 'dust', x: x - dir * range(rng, 20, 70) * s.u, y: s.ground - range(rng, 20, 100) * s.u, vx: dir * 190 * s.u, vy: -30 * s.u, size: 3 * s.u, color: '#e2e8f0', life: 0.5 })
          if (p >= 1) {
            phase = 'run'
            burst(s, 'dust', x, s.ground - 2, 5, ['#cbd5e1'], 45, [3, 5])
          }
        } else if (phase === 'dive') {
          // Over the top and into the ground in front.
          const p = seg(pt, 0, 1.0)
          const e = easeIn(p)
          ox = lerp(-52, 40, easeInOut(p))
          oy = -(84 + Math.sin(p * Math.PI) * 22) * (1 - e) - 7 * e
          v = 104 * (1 - p * 0.7)
          if (p >= 1) {
            phase = 'tangled'
            pt = 0
            crashX = x + dir * ox * s.u
            burst(s, 'dust', crashX, s.ground - 4 * s.u, 7, ['#cbd5e1'], 60, [3, 6])
          }
        } else if (phase === 'tangled') {
          v = 0
          if (pt > 2.2) {
            phase = 'hop'
            pt = 0
          }
        } else {
          v = 50
          // The kite stays where it fell until the string goes tight, then drags.
          const slack = 34 * s.u
          if (passed(dir, x - dir * slack, crashX)) {
            crashX = x - dir * slack
            if (tick(t, dt, 6)) burst(s, 'dust', crashX, s.ground - 2, 1, ['#cbd5e1'], 25, [2, 4])
          }
        }
        x += dir * v * s.u * dt
        walk += dt * (v / 5.4)
        return !passed(dir, x - dir * 48 * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        const wrapped = phase === 'tangled' || phase === 'hop'
        const hopLift = phase === 'hop' ? Math.abs(Math.sin(pt * 7)) * 5 : 0
        let hand = { x: 0, y: 0 }
        at(ctx, x, s.ground, s.u * K, dir, () => {
          if (lift < 4) groundShadow(ctx, 0, 10)
          let pose: Pose = { walk, stride: 1, lean: 0.2, armB: -2.5, elbowB: -0.25, mouth: 'grin', blink: blinking(s.time, 2) }
          if (phase === 'gust') pose = { walk: t * 16, stride: 0.45, lean: -0.1, armB: -2.9, elbowB: -0.1, armF: -0.6, lift, mouth: 'o', eyes: 'wide' }
          else if (phase === 'dive') pose = { ...pose, lean: 0.05, headTilt: -0.35, mouth: 'o', eyes: 'wide', armB: lerp(-2.5, 2.2, seg(pt, 0.2, 0.9)) }
          else if (phase === 'tangled') pose = { armF: 0.15, armB: 0.1, elbowF: 0.1, elbowB: 0.1, lean: Math.sin(pt * 12) * 0.08 * (1 - seg(pt, 0, 1.4)), mouth: pt < 1.2 ? 'o' : 'flat', eyes: pt < 1.2 ? 'wide' : 'normal', blink: blinking(s.time, 2) }
          else if (phase === 'hop') pose = { armF: 0.15, armB: 0.1, elbowF: 0.1, elbowB: 0.1, crouch: 0.15, lift: hopLift, mouth: 'puff' }
          const a = drawPerson(ctx, look, pose)
          hand = wrapped ? { x: a.hip.x - 4, y: a.hip.y - 6 } : a.handB
          if (wrapped) {
            // Four turns of string round the middle, arms and all.
            ctx.lineWidth = 0.8
            ctx.strokeStyle = '#f1f5f9'
            for (let i = 0; i < 4; i++) {
              ctx.beginPath()
              ctx.ellipse(a.hip.x, a.hip.y - 3 - i * 3.6, 7.6, 1.5, i % 2 ? 0.14 : -0.14, 0, TAU)
              ctx.stroke()
            }
            if (phase === 'tangled' && pt > 1.2) bubble(ctx, a.head.x, a.head.y - 18, '...', { size: 9 })
          }
          if (phase === 'gust') speedLines(ctx, -16, -40, 18, t)
        })
        // String and kite live in screen space so the line can sag.
        const hx = x + dir * hand.x * K * s.u
        const hy = s.ground + hand.y * K * s.u
        const kxp = wrapped ? crashX : x + dir * ox * s.u
        const kyp = wrapped ? s.ground - 7 * s.u : s.ground + oy * s.u
        ctx.beginPath()
        ctx.moveTo(hx, hy)
        ctx.quadraticCurveTo((hx + kxp) / 2, Math.min(s.ground - 1, (hy + kyp) / 2 + (wrapped ? 20 : 16) * s.u), kxp, kyp)
        ctx.lineWidth = Math.max(0.8, 0.8 * s.u)
        ctx.strokeStyle = alpha('#f1f5f9', 0.85)
        ctx.stroke()
        const tilt = wrapped ? 1.75 : phase === 'dive' ? lerp(0.5, 2.6, easeIn(seg(pt, 0, 1))) : 0.5 + Math.sin(t * 3.1) * 0.12
        at(ctx, kxp, kyp, s.u, dir, () => drawKite(ctx, ka, kb, t, wrapped), dir * tilt)
      },
    })
  },
}

// ─── Dad goes to the beach ───────────────────────────────────────────────────
// Dad, carrying everything: cool box, deckchair, rubber ring, parasol and a
// beach ball on the top, none of which he can see over. Things slide off the
// stack one at a time and the small child behind collects each of them, ending
// up under a taller pile than his. Sometimes the ring lands round their middle.

const beachDad: ActDef = {
  id: 'summer.beach-dad',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const hoop = chance(rng, 0.5)
    const dad: Look = { ...CAST.dad, shorts: true, hat: 'sunhat', hatColor: '#fde9c9', hatTrim: C.red, top: pick(rng, ['#fb923c', '#2f80c2', '#5eead4']) }
    const kidLook = pick(rng, KID_LOOKS)
    const K = 0.78
    const GAP = 72
    const order: BeachItem[] = ['cool', 'chair', 'ring', 'brolly', 'ball']
    const dropAt = [0.24, 0.43, 0.62].map((f) => stage.w * f)
    interface Loose {
      kind: BeachItem
      on: 'dad' | 'fall' | 'floor' | 'fly' | 'kid' | 'worn'
      x: number
      y: number
      vx: number
      vy: number
      rot: number
      t: number
      sx: number
      sy: number
    }
    const items: Loose[] = order.map((kind) => ({ kind, on: 'dad', x: 0, y: 0, vx: 0, vy: 0, rot: 0, t: 0, sx: 0, sy: 0 }))
    const carried: BeachItem[] = []
    const CARRY: Pose = { armF: 0.75, elbowF: 0.85, armB: 0.6, elbowB: 0.9, lean: -0.1 }
    const base = personAnchors(CARRY)
    let x = from
    let walk = 0
    let kx = from - dir * GAP * stage.u
    let kwalk = 0
    let kmove = false
    let stoop = 0 // seconds left bending to pick something up
    let grab: Loose | null = null
    let drops = 0
    let wobble = 0
    /** Offset of dad's item `i` from his feet, in units. */
    const stackPos = (i: number, time: number) => {
      let y = base.handF.y + 1
      let n = 0
      for (let j = 0; j < i; j++) {
        if (items[j].on === 'dad') {
          y -= ITEM_H[items[j].kind]
          n++
        }
      }
      const sway = Math.sin(time * 2.7 + n * 0.5) * n * (1.1 + wobble * 1.6)
      return { x: base.handF.x + 4 + sway, y, rot: Math.sin(time * 2.7 + n * 0.5) * 0.03 * n * (1 + wobble) }
    }
    return makeAct({
      update(s, dt, t) {
        wobble = Math.max(0, wobble - dt * 0.8)
        x += dir * 46 * s.u * dt
        walk += dt * 7.4
        const travelled = dir === 1 ? x : s.w - x
        if (drops < 3 && travelled > dropAt[drops]) {
          // The top of the stack goes: ball, then parasol, then ring.
          const it = items[4 - drops]
          const p = stackPos(4 - drops, t)
          it.x = x + dir * p.x * s.u
          it.y = s.ground + (p.y - ITEM_H[it.kind] / 2) * s.u
          it.t = 0
          if (it.kind === 'ring' && hoop) {
            it.on = 'fly'
            it.sx = it.x
            it.sy = it.y
          } else {
            it.on = 'fall'
            it.vx = -dir * range(rng, 25, 50) * s.u
            it.vy = -range(rng, 60, 100) * s.u
          }
          drops++
          wobble = 1
        }
        for (const it of items) {
          it.t += dt
          const rest = s.ground - (ITEM_H[it.kind] / 2) * s.u
          if (it.on === 'fall') {
            it.vy += 520 * s.u * dt
            it.x += it.vx * dt
            it.y += it.vy * dt
            it.rot += dt * (it.kind === 'ball' ? 5 : 2.4) * -dir
            if (it.y >= rest) {
              it.y = rest
              if (it.kind === 'ball' && it.vy > 90 * s.u) {
                it.vy *= -0.55
              } else {
                it.on = 'floor'
                it.rot = it.kind === 'ball' ? it.rot : 0
                burst(s, 'dust', it.x, s.ground - 2, 3, ['#cbd5e1'], 35, [2, 4])
              }
            }
          } else if (it.on === 'fly') {
            // Sails back in an arc and drops neatly over the child.
            const p = seg(it.t, 0, 0.85)
            it.x = lerp(it.sx, kx, p)
            it.y = lerp(it.sy, s.ground - 26 * K * s.u, p * p) - Math.sin(p * Math.PI) * 26 * s.u
            it.rot = 0
            if (p >= 1) it.on = 'worn'
          }
        }
        // The child: fetch whatever is lying about, otherwise keep up.
        kmove = false
        if (stoop > 0) {
          stoop -= dt
          if (stoop <= 0.2 && grab) {
            grab.on = 'kid'
            carried.push(grab.kind)
            grab = null
          }
        } else {
          const target = items.find((it) => it.on === 'floor')
          if (target) {
            const d = (target.x - kx) * dir
            if (Math.abs(d) < 5 * s.u) {
              stoop = 0.55
              grab = target
            } else {
              kx += Math.sign(d) * dir * 82 * s.u * dt
              kmove = true
            }
          } else {
            const gap = (x - kx) * dir
            if (gap > (GAP - 6) * s.u) {
              kx += dir * (gap > (GAP + 6) * s.u ? 86 : 46) * s.u * dt
              kmove = true
            }
          }
        }
        if (kmove) kwalk += dt * 11
        return !passed(dir, kx, to)
      },
      draw(s, t) {
        const { ctx } = s
        // Things on the floor or in the air.
        for (const it of items) {
          if (it.on !== 'fall' && it.on !== 'floor' && it.on !== 'fly') continue
          at(
            ctx,
            it.x,
            it.y,
            s.u,
            dir,
            () => {
              ctx.translate(0, ITEM_H[it.kind] / 2)
              drawItem(ctx, it.kind, it.kind === 'ball' ? it.rot : 0)
            },
            it.kind === 'ball' ? 0 : it.rot,
          )
        }
        // The child and their growing pile.
        const worn = items.some((it) => it.on === 'worn')
        at(ctx, kx, s.ground, s.u * K, dir, () => {
          groundShadow(ctx, 0, 10)
          const bend = stoop > 0 ? Math.sin(clamp(stoop / 0.55) * Math.PI) : 0
          const loaded = carried.length > 0
          const pose: Pose = {
            walk: kwalk,
            stride: kmove ? 0.85 : 0,
            crouch: bend * 0.6,
            lean: bend * 0.45,
            armF: bend > 0.3 ? 1.1 : loaded ? 2.75 : undefined,
            armB: bend > 0.3 ? 0.9 : loaded ? -2.75 : undefined,
            elbowF: loaded && bend <= 0.3 ? -0.25 : undefined,
            elbowB: loaded && bend <= 0.3 ? 0.25 : undefined,
            mouth: loaded && carried.length > 2 ? 'puff' : 'smile',
            blink: blinking(s.time, 4),
          }
          const ringAt = (front: boolean) => {
            if (!worn) return
            // Half the ring goes behind the body and half in front.
            ctx.save()
            ctx.beginPath()
            if (front) ctx.rect(-20, -25, 40, 12)
            else ctx.rect(-20, -34, 40, 9)
            ctx.clip()
            ctx.translate(0, -21)
            drawItem(ctx, 'ring')
            ctx.restore()
          }
          const a = drawPerson(ctx, kidLook, pose, () => ringAt(false))
          ringAt(true)
          let y = a.crown.y - 1
          carried.forEach((kind, i) => {
            ctx.save()
            ctx.translate(a.crown.x + Math.sin(t * 3.1 + i) * (i + 1) * 0.9, y)
            ctx.rotate(Math.sin(t * 3.1 + i) * 0.05 * (i + 1))
            drawItem(ctx, kind)
            ctx.restore()
            y -= ITEM_H[kind]
          })
          if (worn && items[2].t < 1.6) bubble(ctx, a.head.x, a.head.y - 20, '!', { color: C.crimson })
        })
        // Dad, peering round the side of it all.
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 12)
          const a = drawPerson(ctx, dad, { ...CARRY, walk, stride: 0.6, lean: -0.1 + Math.sin(t * 2.7) * 0.04 * (1 + wobble), mouth: wobble > 0.4 ? 'o' : 'puff', eyes: wobble > 0.4 ? 'wide' : 'normal', blink: blinking(s.time, 6) })
          items.forEach((it, i) => {
            if (it.on !== 'dad') return
            const p = stackPos(i, t)
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rot)
            drawItem(ctx, it.kind, t)
            ctx.restore()
          })
          fillCirc(ctx, a.handF.x + 1, a.handF.y, 2.8, dad.skin)
          if (drops < 3) sweat(ctx, a.head.x - 4, a.head.y - 8, t)
        })
      },
    })
  },
}

// ─── The sprinkler ───────────────────────────────────────────────────────────
// A sprinkler pops out of the lawn and sweeps its arc. Somebody strolls into
// it with their nose in the paper. It stops sweeping and gives them its full
// attention. Either they get drenched, or without looking up they produce an
// umbrella and keep it between them and the nozzle the whole way past.

const sprinkler: ActDef = {
  id: 'summer.sprinkler',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 45)
    const brolly = chance(rng, 0.45)
    const look: Look = chance(rng, 0.5) ? { ...CAST.grandad } : { ...CAST.dad, glasses: true, shorts: true }
    const brollyColor = pick(rng, ['#fb7185', '#fde047', '#a78bfa'])
    const sx = stage.w * range(rng, 0.44, 0.56)
    const V = 185
    const G = 420
    const NOZ = 10 // nozzle height, units
    const READ: Pose = { armF: 1.25, elbowF: 1.15, armB: 0.2, elbowB: 0.2 }
    let x = from
    let walk = 0
    let phase: 'stroll' | 'soak' | 'drip' = 'stroll'
    let pt = 0
    let wet = 0 // 0..1, how sodden the paper is
    let aim = Math.PI / 2
    let open = 0
    let tracking = false
    let down = 0 // 0..1, retracting at the end
    let shieldAng = 0 // which way the umbrella points, arm convention
    /** Aim at a point (px) with a little lead for gravity; returns flight time. */
    const aimAt = (s: Stage, tx: number, ty: number) => {
      const dx = tx - sx
      const dy = s.ground - NOZ * s.u - ty
      const tau = Math.max(0.06, Math.hypot(dx, dy) / (V * s.u))
      const want = Math.atan2(dy + 0.5 * G * s.u * tau * tau, dx)
      aim += (want - aim) * 0.3
      return tau
    }
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const rise = seg(t, 0.1, 0.7)
        const ahead = (sx - x) * dir // + while the sprinkler is still in front
        let v = 46
        let life = 0
        tracking = false
        if (brolly) {
          // Up it goes a few paces out, and down again once safely past.
          const near = Math.abs(ahead) < 62 * s.u
          open = clamp(open + (near ? dt * 4 : -dt * 4))
          if (near && open > 0.2) {
            tracking = true
            const a = personAnchors({ ...READ, walk, stride: 0.6 })
            // Shield points from the shoulder straight at the nozzle.
            const nx = ahead / s.u
            const ny = -NOZ
            shieldAng = Math.atan2(nx - a.shoulder.x, ny - a.shoulder.y)
            const hxU = a.shoulder.x + Math.sin(shieldAng) * 14.5
            const hyU = a.shoulder.y + Math.cos(shieldAng) * 14.5
            const cxU = hxU + Math.sin(shieldAng) * 17
            const cyU = hyU + Math.cos(shieldAng) * 17
            life = aimAt(s, x + dir * cxU * s.u, s.ground + cyU * s.u)
            if (tick(t, dt, 14)) {
              // Spray coming off the canopy.
              s.particles.emit({ kind: 'drop', x: x + dir * cxU * s.u, y: s.ground + cyU * s.u, vx: range(rng, -70, 70) * s.u, vy: -range(rng, 10, 70) * s.u, g: G * s.u, size: 1.6 * s.u, color: C.sky, life: 0.6 })
            }
          }
        } else if (phase === 'stroll' && ahead < 36 * s.u && ahead > 0) {
          phase = 'soak'
          pt = 0
        }
        if (phase === 'soak') {
          v = 0
          tracking = true
          // Works its way up from the knees to the hat.
          life = aimAt(s, x, s.ground - lerp(18, 50, seg(pt, 0, 1.6)) * s.u)
          wet = seg(pt, 0.3, 1.8)
          if (tick(t, dt, 12)) s.particles.emit({ kind: 'drop', x: x + range(rng, -6, 6) * s.u, y: s.ground - range(rng, 20, 55) * s.u, vx: range(rng, -60, 60) * s.u, vy: -range(rng, 10, 60) * s.u, g: G * s.u, size: 1.6 * s.u, color: C.sky, life: 0.6 })
          if (pt > 2.6) {
            phase = 'drip'
            pt = 0
          }
        } else if (phase === 'drip') {
          v = pt < 1.1 ? 0 : 34
          if (tick(t, dt, 5)) s.particles.emit({ kind: 'drop', x: x + range(rng, -6, 8) * s.u, y: s.ground - range(rng, 14, 40) * s.u, vy: 20 * s.u, g: G * s.u, size: 1.5 * s.u, color: C.sky, life: 0.7 })
        }
        x += dir * v * s.u * dt
        walk += dt * (v / 6.2)
        // Left alone, it goes back to its sweep, then tucks itself away.
        const leaving = ahead < -95 * s.u || passed(dir, x, to)
        if (leaving) down = clamp(down + dt * 1.6)
        if (!tracking) {
          const want = Math.PI / 2 + Math.sin(t * 1.7) * 0.85
          aim += (want - aim) * Math.min(1, dt * 6)
        }
        if (rise >= 1 && down === 0 && tick(t, dt, 28)) {
          const sp = V * s.u * range(rng, 0.93, 1.05)
          const a = aim + range(rng, -0.04, 0.04)
          s.particles.emit({
            kind: 'drop',
            x: sx + Math.cos(a) * 7 * s.u,
            y: s.ground - (NOZ + Math.sin(a) * 7) * s.u,
            vx: Math.cos(a) * sp,
            vy: -Math.sin(a) * sp,
            g: G * s.u,
            size: range(rng, 1.6, 2.4) * s.u,
            color: pick(rng, [C.sky, '#bae6fd', C.cyan]),
            life: tracking ? life : 3,
          })
        }
        return !(passed(dir, x, to) && down >= 1)
      },
      draw(s, t) {
        const { ctx } = s
        const rise = seg(t, 0.1, 0.7) * (1 - down)
        at(ctx, sx, s.ground, s.u, 1, () => drawSprinkler(ctx, rise, aim))
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          let pose: Pose = { ...READ, walk, stride: 0.6, mouth: 'flat', blink: blinking(s.time, 5) }
          if (brolly && open > 0.05) pose = { ...pose, armB: lerp(0.2, shieldAng, open), elbowB: 0, mouth: 'smile' }
          if (phase === 'soak') {
            const jolt = pt < 0.4
            pose = { armF: lerp(1.25, 0.7, wet), elbowF: lerp(1.15, 0.5, wet), armB: jolt ? -0.9 : 0.25, elbowB: 0.2, lean: jolt ? -0.18 : 0, lift: jolt ? Math.sin(seg(pt, 0, 0.4) * Math.PI) * 5 : 0, mouth: jolt ? 'o' : 'frown', eyes: jolt ? 'wide' : pt > 1 ? 'closed' : 'normal' }
          } else if (phase === 'drip') {
            pose = { walk, stride: pt < 1.1 ? 0 : 0.45, armF: 0.7, elbowF: 0.5, armB: 0.25, elbowB: 0.2, lean: 0.06, mouth: pt < 1.1 ? 'puff' : 'frown', eyes: pt < 0.9 ? 'closed' : 'normal', blink: blinking(s.time, 5) }
          }
          const a = drawPerson(ctx, look, pose, (b) => {
            if (!brolly || open <= 0.05) return
            ctx.save()
            ctx.translate(b.handB.x, b.handB.y)
            ctx.rotate(Math.atan2(Math.sin(shieldAng), -Math.cos(shieldAng)))
            drawUmbrella(ctx, easeOut(open), brollyColor)
            ctx.restore()
          })
          ctx.save()
          ctx.translate(a.handF.x + 1, a.handF.y - 2)
          drawPaper(ctx, wet)
          ctx.restore()
          fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
          if (phase === 'drip' && pt > 0.2 && pt < 1.1) bubble(ctx, a.head.x, a.head.y - 18, '...', { size: 9 })
          if (wet > 0.6) {
            // Hair plastered down: a couple of drips off the nose and chin.
            const p = (t * 1.4) % 1
            ctx.globalAlpha = 1 - p
            fillEll(ctx, a.head.x + 9, a.head.y + 4 + p * 9, 0.9, 1.5, C.sky)
            fillEll(ctx, a.head.x - 6, a.head.y + 8 + ((p + 0.5) % 1) * 9, 0.9, 1.5, C.sky)
            ctx.globalAlpha = 1
          }
        })
      },
    })
  },
}

// ─── The butterfly net ───────────────────────────────────────────────────────
// A child with a net and a butterfly that is always exactly one swish ahead.
// Three swings, three misses, and when they finally stop to get their breath
// back it comes and sits on their head. Sometimes they try for it there.

const butterflies: ActDef = {
  id: 'summer.butterfly-net',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const self = chance(rng, 0.45)
    const look = pick(rng, KID_LOOKS)
    const wing = pick(rng, ['#fb923c', '#7dd3fc', '#fde047', '#f9a8d4'])
    const spot = wing === '#fde047' ? '#fb923c' : '#f8fafc'
    const K = 0.85
    const LEAD = 36
    const stopAt = stage.w * range(rng, 0.52, 0.62)
    // Two more go past higher up, minding their own business.
    const extras = [
      { x: from - dir * 50 * stage.u, h: range(rng, 78, 96), c: '#c4b5fd', ph: rng() * 6 },
      { x: from - dir * 120 * stage.u, h: range(rng, 64, 84), c: '#a7f3d0', ph: rng() * 6 },
    ]
    let x = from
    let walk = 0
    let phase: 'chase' | 'pant' | 'notice' | 'bonk' | 'leave' = 'chase'
    let pt = 0
    let swing = 9 // seconds since the last swing began
    let nextSwing = 1.1
    let dodge = 0
    // Butterfly offset from the child, units (x ahead, y up).
    let bx = LEAD
    let by = 44
    let netted = false
    return makeAct({
      update(s, dt, t) {
        pt += dt
        swing += dt
        dodge = Math.max(0, dodge - dt * 1.3)
        for (const e of extras) e.x += dir * 105 * s.u * dt
        let v = 0
        if (phase === 'chase') {
          v = 84
          nextSwing -= dt
          const travelled = dir === 1 ? x : s.w - x
          if (nextSwing <= 0 && travelled > 20 * s.u) {
            nextSwing = range(rng, 1.3, 1.8)
            swing = 0
          }
          // It hops out of the way at the top of every swing.
          if (hit(swing, dt, 0.16)) dodge = 1
          const tx = LEAD + dodge * 14 + Math.sin(t * 3.3) * 5
          const ty = 44 + dodge * 20 + Math.sin(t * 5.1) * 6
          bx += (tx - bx) * Math.min(1, dt * 9)
          by += (ty - by) * Math.min(1, dt * 9)
          if (travelled > stopAt && swing > 0.7) {
            phase = 'pant'
            pt = 0
          }
        } else if (phase === 'pant') {
          // A lazy loop back, and down onto the top of the head.
          const p = easeInOut(seg(pt, 0.5, 2.2))
          bx = lerp(LEAD, 1, p) + Math.sin(p * Math.PI) * 10 * Math.sin(pt * 4)
          by = lerp(44, 56, p) + Math.sin(p * Math.PI) * 22
          if (pt > 2.5) {
            phase = 'notice'
            pt = 0
          }
        } else if (phase === 'notice') {
          bx = 1
          by = 56
          if (pt > 1.3) {
            phase = self ? 'bonk' : 'leave'
            pt = 0
          }
        } else if (phase === 'bonk') {
          // Up it goes as the net comes down, then settles on the hoop.
          const p = seg(pt, 0.25, 1.1)
          by = 56 + Math.sin(p * Math.PI) * 16 + easeOut(p) * 6
          bx = 1 + Math.sin(p * Math.PI) * 6
          if (hit(pt, dt, 0.4)) {
            netted = true
            burst(s, 'dust', x, s.ground - 58 * K * s.u, 4, ['#e2e8f0'], 40, [2, 4])
          }
          if (pt > 1.9) {
            phase = 'leave'
            pt = 0
          }
        } else v = netted ? 42 : 36
        x += dir * v * s.u * dt
        walk += dt * (v / 5.6)
        return !passed(dir, x, to)
      },
      draw(s, t) {
        const { ctx } = s
        for (const e of extras) {
          at(ctx, e.x + Math.sin(t * 2.9 + e.ph) * 8 * s.u, s.ground - (e.h + Math.sin(t * 4.7 + e.ph) * 7) * s.u, s.u * 0.7, dir, () => drawButterfly(ctx, t * 15 + e.ph, e.c, '#f8fafc'), Math.sin(t * 2.9 + e.ph) * 0.3)
        }
        const landed = phase === 'notice' || phase === 'leave' || (phase === 'bonk' && pt > 1.1) || (phase === 'pant' && pt > 2.2)
        at(ctx, x, s.ground, s.u * K, dir, () => {
          groundShadow(ctx, 0, 10)
          // The swing: wound up behind the head, then whipped over and down.
          const sw = clamp(swing / 0.42)
          const arc = swing < 0.42 ? lerp(3.3, 1.15, easeIn(sw)) : lerp(1.15, 2.5, seg(swing, 0.5, 0.9))
          let pose: Pose = { walk, stride: 1, lean: 0.2, armF: arc, elbowF: 0.1, mouth: swing < 0.6 ? 'o' : 'grin', eyes: swing < 0.6 ? 'wide' : 'normal', blink: blinking(s.time, 3) }
          let netAng = arc + 0.1
          let onHead = false
          if (phase === 'pant') pose = { crouch: 0.3, lean: 0.34 + Math.sin(t * 7) * 0.03, armF: 0.75, elbowF: -0.3, armB: 0.6, elbowB: -0.2, mouth: 'puff', eyes: pt > 0.4 ? 'closed' : 'normal' }
          else if (phase === 'notice') pose = { armF: 0.5, elbowF: 0.2, headTilt: -0.12, mouth: 'o', eyes: 'wide' }
          else if (phase === 'bonk') {
            const up = easeIn(seg(pt, 0.1, 0.4))
            pose = { armF: lerp(0.5, 2.7, up), elbowF: lerp(0.2, 1.5, up), mouth: pt < 0.4 ? 'flat' : 'o', eyes: pt < 0.4 ? 'normal' : 'wide', crouch: pt > 0.4 ? 0.15 : 0 }
          } else if (phase === 'leave') pose = netted ? { walk, stride: 0.45, armF: 0.3, armB: 0.2, mouth: 'flat' } : { walk, stride: 0.35, armF: 0.5, elbowF: 0.2, armB: -0.9, elbowB: -0.2, mouth: 'grin', eyes: 'wide' }
          if (phase === 'pant' || phase === 'notice' || (phase === 'leave' && !netted)) netAng = 0.5
          if (phase === 'bonk' && !netted) netAng = lerp(0.5, 2.9, easeIn(seg(pt, 0.1, 0.4)))
          if (netted) onHead = true
          const a = drawPerson(ctx, look, pose)
          if (onHead) {
            // Net over the head like a hat, pole sticking out the back.
            line(ctx, a.crown.x - 4, a.crown.y + 3, a.crown.x - 20, a.crown.y + 13, 1.4, '#c8a06a')
            ctx.beginPath()
            ctx.moveTo(a.crown.x - 9, a.crown.y + 9)
            ctx.quadraticCurveTo(a.crown.x - 8, a.crown.y - 6, a.crown.x, a.crown.y - 4)
            ctx.quadraticCurveTo(a.crown.x + 9, a.crown.y - 5, a.crown.x + 10, a.crown.y + 9)
            ctx.closePath()
            ctx.fillStyle = alpha('#e2e8f0', 0.35)
            ctx.fill()
            for (let i = -1; i <= 1; i++) line(ctx, a.crown.x + i * 4, a.crown.y - 3, a.crown.x + i * 6, a.crown.y + 9, 0.4, alpha('#ffffff', 0.5))
            ctx.beginPath()
            ctx.ellipse(a.crown.x + 0.5, a.crown.y + 9, 9.6, 2.2, 0, 0, TAU)
            ctx.lineWidth = 1.1
            ctx.strokeStyle = '#94a3b8'
            ctx.stroke()
          } else {
            ctx.save()
            ctx.translate(a.handF.x, a.handF.y)
            drawNet(ctx, netAng, swing < 0.5 ? 1 : 0)
            ctx.restore()
            fillCirc(ctx, a.handF.x, a.handF.y, 2.5, look.skin)
          }
          if (phase === 'pant' && pt > 0.3) sweat(ctx, a.head.x, a.head.y - 8, t)
          if (phase === 'notice' && pt > 0.2) bubble(ctx, a.head.x + 12, a.head.y - 16, '!', { size: 9, color: C.crimson })
          if (phase === 'chase' && swing > 0.42 && swing < 0.7) {
            // Swish.
            ctx.globalAlpha = 1 - seg(swing, 0.42, 0.7)
            ctx.beginPath()
            ctx.arc(a.shoulder.x, a.shoulder.y, 30, -1.2, 0.2)
            ctx.lineWidth = 1.2
            ctx.strokeStyle = C.white
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        })
        // The butterfly, in the child's frame so it keeps station on them.
        const perch = landed ? (netted ? -6 : -1) : 0
        at(
          ctx,
          x + dir * bx * K * s.u,
          s.ground - (by + (landed ? 4 : 0) - perch) * K * s.u,
          s.u * 0.8,
          dir,
          () => drawButterfly(ctx, landed ? t * 2.2 : t * 17, wing, spot),
          landed ? 0 : Math.sin(t * 3.3) * 0.3,
        )
      },
    })
  },
}

export const SUMMER_ACTS: ActDef[] = [iceCream, kite, beachDad, sprinkler, butterflies]
