import { DOG, drawDog } from '../creatures'
import { C, alpha, at, clamp, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, type Ctx } from '../draw'
import { blinking, bubble, burst, makeAct, sweat, zzz } from '../kit'
import { CAST, drawPerson, type Look, type Pose } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Rng, Stage } from '../types'

// The pottery studio, on wheels. Everything a potter needs is too heavy to
// carry, so it all arrives on castors: the wheel, the kiln, the glazing bench.
// Things go wrong at about the rate they do in real life.

const CLAY = '#c08a66'
const CLAY_D = shade(CLAY, -0.25)
const BISQUE = '#ecd2bb'
const GLAZES = [C.cyan, C.green, C.yellow, C.rose, C.purple, C.orange, C.mint]
const RAINBOW = [C.red, C.orange, C.yellow, C.green, C.sky, C.purple]
const HOT = ['#fb923c', '#f59e0b', '#fde047']

const APRON = '#d8b890'
const POTTERS: Look[] = [
  { ...CAST.mum, apron: APRON },
  { ...CAST.dad, apron: '#9db8a0' },
  { ...CAST.grandad, apron: APRON, hat: 'none' },
  { ...CAST.girl, apron: '#e9c46a' },
]

// ─── Timing helpers ──────────────────────────────────────────────────────────
// Each act is a fixed script. The walking times are known once the stage width
// is, so the whole performance is a function of the clock.

function timeline<K extends string>(steps: readonly (readonly [K, number])[]) {
  const start = {} as Record<K, number>
  const dur = {} as Record<K, number>
  let total = 0
  for (const [k, d] of steps) {
    start[k] = total
    dur[k] = d
    total += d
  }
  return {
    total,
    start,
    /** 0..1 through the step: 0 before it, 1 after. */
    p: (k: K, t: number) => clamp((t - start[k]) / Math.max(0.001, dur[k])),
    on: (k: K, t: number) => t >= start[k] && t < start[k] + dur[k],
    since: (k: K, t: number) => t - start[k],
  }
}

/** True on the one frame the clock passes `when`. */
const hit = (t: number, dt: number, when: number) => t >= when && t - dt < when
/** True `hz` times a second. */
const every = (t: number, dt: number, hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
/** Rises to 1, holds, and falls back to 0 across a 0..1 progress. */
const plateau = (p: number, a = 0.25, b = 0.75) => easeInOut(seg(p, 0, a)) * (1 - easeInOut(seg(p, b, 1)))

function entry(stage: Stage, rng: Rng, speed: number, margin = 60) {
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1
  const m = margin * stage.u
  const from = dir === 1 ? -m : stage.w + m
  const to = dir === 1 ? stage.w + m : -m
  const spot = stage.w * range(rng, 0.38, 0.62)
  const secs = (a: number, b: number) => Math.abs(b - a) / (speed * stage.u)
  return { dir, from, to, spot, secs }
}

/** A speech bubble that is never mirrored, whichever way the speaker faces. */
function say(s: Stage, x: number, uy: number, text: string, opts?: Parameters<typeof bubble>[4]) {
  at(s.ctx, x, s.ground, s.u, 1, () => bubble(s.ctx, 0, uy, text, opts))
}

// ─── Pots ────────────────────────────────────────────────────────────────────

interface PotOpts {
  /** Width of the mouth as a fraction of the belly. */
  neck?: number
  /** Sideways lean of the top, for wobble. */
  lean?: number
  belly?: number
  pattern?: 'spots' | 'stripes'
  /** 0..1 fresh-from-the-kiln glow. */
  glow?: number
}

function potPath(ctx: Ctx, x: number, y: number, w: number, h: number, neck: number, lean: number, belly: number) {
  const tw = w * neck
  ctx.beginPath()
  ctx.moveTo(x - w * 0.6, y)
  ctx.bezierCurveTo(x - w * belly, y - h * 0.25, x - w * belly + lean * 0.5, y - h * 0.7, x - tw + lean, y - h)
  ctx.lineTo(x + tw + lean, y - h)
  ctx.bezierCurveTo(x + w * belly + lean * 0.5, y - h * 0.7, x + w * belly, y - h * 0.25, x + w * 0.6, y)
  ctx.closePath()
}

/** A thrown pot standing on (x, y). `w` is the half-width of the belly. */
function drawPot(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, o: PotOpts = {}) {
  const neck = o.neck ?? 0.6
  const lean = o.lean ?? 0
  const belly = o.belly ?? 1.25
  const glow = o.glow ?? 0
  if (glow > 0.02) {
    ctx.globalAlpha = glow * 0.3
    fillEll(ctx, x, y - h * 0.5, w * 2.2, h * 0.95, C.orange)
    ctx.globalAlpha = 1
  }
  potPath(ctx, x, y, w, h, neck, lean, belly)
  ctx.fillStyle = color
  ctx.fill()
  ctx.save()
  potPath(ctx, x, y, w, h, neck, lean, belly)
  ctx.clip()
  if (o.pattern === 'stripes') {
    for (let i = 0; i < 6; i++) fillRR(ctx, x - w * 2, y - h + (i * h) / 6, w * 4, h / 6 + 0.3, 0, RAINBOW[i])
  } else if (o.pattern === 'spots') {
    for (let i = 0; i < 8; i++) fillCirc(ctx, x + (((i * 37) % 11) - 5) * w * 0.2, y - h * (0.1 + i * 0.115), w * 0.22, C.white)
  }
  // Shade the far side, catch the light on the near one.
  fillRR(ctx, x + w * 0.35 + lean * 0.5, y - h, w * 1.4, h, 0, 'rgba(10,20,40,0.2)')
  fillRR(ctx, x - w * 0.78 + lean * 0.4, y - h * 0.82, w * 0.24, h * 0.55, w * 0.12, 'rgba(255,255,255,0.3)')
  if (glow > 0.02) {
    ctx.globalAlpha = glow * 0.75
    fillRR(ctx, x - w * 2, y - h - 1, w * 4, h + 2, 0, '#ffb347')
    ctx.globalAlpha = 1
  }
  ctx.restore()
  fillEll(ctx, x + lean, y - h, w * neck, Math.max(0.6, w * neck * 0.22), glow > 0.5 ? '#ffe2a8' : shade(color, -0.32))
}

function drawBowl(ctx: Ctx, x: number, y: number, w: number, color: string) {
  ctx.beginPath()
  ctx.moveTo(x - w, y - 4.2)
  ctx.quadraticCurveTo(x - w * 0.9, y, x - w * 0.35, y)
  ctx.lineTo(x + w * 0.35, y)
  ctx.quadraticCurveTo(x + w * 0.9, y, x + w, y - 4.2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  fillRR(ctx, x - w, y - 5.1, w * 2, 1.4, 0.7, shade(color, 0.32))
  fillRR(ctx, x - w * 0.3, y - 0.3, w * 0.6, 1.1, 0.4, shade(color, -0.25))
}

function castor(ctx: Ctx, x: number, roll: number, r = 2.6) {
  fillCirc(ctx, x, -r, r, '#334155')
  line(ctx, x - Math.cos(roll) * r * 0.7, -r - Math.sin(roll) * r * 0.7, x + Math.cos(roll) * r * 0.7, -r + Math.sin(roll) * r * 0.7, 0.8, '#94a3b8')
}

// ─── The wheel ───────────────────────────────────────────────────────────────
// Potter, stool and wheel glide on together aboard a small trolley. A pot rises
// between the hands, taller and taller, and then one of three things happens.
// One of them is a vase.

function drawWheelRig(ctx: Ctx, roll: number, spin: number) {
  fillRR(ctx, -18, -8, 54, 3, 1.4, '#a47148')
  fillRR(ctx, -18, -8, 54, 1, 0.5, '#c48a52')
  castor(ctx, -11, roll)
  castor(ctx, 29, roll)
  // Stool.
  line(ctx, -7, -20, -8.5, -8, 1.7, '#8b5a2b')
  line(ctx, 3, -20, 4.5, -8, 1.7, '#8b5a2b')
  fillRR(ctx, -9.5, -23, 15, 3, 1.4, '#c48a52')
  // The wheel: cabinet, pedal, splash pan, wheelhead.
  fillRR(ctx, 13, -23, 18, 15, 2, '#5b6f8f')
  fillRR(ctx, 13, -23, 4.5, 15, 2, '#6f84a6')
  fillPoly(ctx, [8, -8, 13, -12, 13, -8], '#94a3b8')
  fillCirc(ctx, 26.5, -15, 1.3, C.green)
  fillRR(ctx, 10, -28, 24, 6, 3, '#9fb4cf')
  fillRR(ctx, 10, -28, 24, 2, 1, '#c5d3e4')
  fillEll(ctx, 22, -28.6, 9, 1.7, '#e2e8f0')
  fillEll(ctx, 22 + Math.cos(spin) * 6.5, -28.6 + Math.sin(spin) * 1.1, 1.3, 0.5, '#94a3b8')
}

const wheel: ActDef = {
  id: 'pottery.the-wheel',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng, 52)
    const look = pick(rng, POTTERS)
    const gag = pick(rng, ['collapse', 'collapse', 'perfect', 'fly'] as const)
    const glaze = pick(rng, GLAZES)
    const tl = timeline([
      ['in', secs(from, spot)],
      ['slap', 0.9],
      ['throw', 4.6],
      ['g1', gag === 'collapse' ? 0.7 : gag === 'perfect' ? 0.9 : 1.6],
      ['g2', gag === 'collapse' ? 2.0 : gag === 'perfect' ? 2.3 : 1.7],
      ['out', secs(spot, to)],
    ])
    const WX = 22 // the middle of the wheelhead, from the potter's seat
    const WY = -30
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    return makeAct({
      update(s, dt, t) {
        const px = spot + dir * WX * s.u
        const py = s.ground + WY * s.u
        if (tl.on('throw', t) && every(t, dt, 5)) {
          // Slip flicking off the spinning clay.
          s.particles.emit({ kind: 'drop', x: px + range(rng, -6, 6) * s.u, y: py - range(rng, 2, 10) * s.u, vx: range(rng, -70, 70) * s.u, vy: -range(rng, 20, 70) * s.u, size: range(rng, 1.6, 2.6) * s.u, color: pick(rng, [CLAY, CLAY_D, '#d9a987']), life: 1 })
        }
        if (gag === 'collapse' && hit(t, dt, tl.start.g1 + 0.25)) {
          burst(s, 'drop', px, py - 6 * s.u, 14, [CLAY, CLAY_D, '#d9a987'], 130, [2, 4])
          burst(s, 'dust', px, py - 4 * s.u, 5, [CLAY], 60, [4, 7])
        }
        if (gag === 'perfect' && hit(t, dt, tl.start.g2 + 0.7)) burst(s, 'star', spot + dir * 12 * s.u, s.ground - 74 * s.u, 8, [C.yellow, C.white, glaze], 70, [3, 5])
        if (gag === 'fly' && hit(t, dt, tl.start.g1 + 0.3)) burst(s, 'drop', px, py - 8 * s.u, 8, [CLAY, CLAY_D], 110, [2, 3.5])
        if (gag === 'fly' && hit(t, dt, tl.start.g2)) burst(s, 'dust', spot, s.ground - 60 * s.u, 5, [CLAY], 50, [4, 7])
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const rolling = tl.on('in', t) || tl.on('out', t)
        const roll = Math.abs(x - from) / s.u / 2.6
        const spinning = t >= tl.start.slap && t < tl.start.g2
        const tp = tl.p('throw', t)
        // The pot on the wheel: [height, half-width, neck, lean].
        let h = 0
        let w = 7.5
        let neck = 0.9
        let lean = 0
        let onWheel = t >= tl.start.slap + 0.45
        if (onWheel) {
          const rise = easeInOut(tp)
          h = lerp(4.5, 23, rise)
          w = lerp(7.5, 5.2, rise)
          neck = lerp(0.9, 0.55, rise)
          const amp = gag === 'perfect' ? Math.sin(seg(tp, 0.5, 0.9) * Math.PI) * 1.3 : seg(tp, 0.5, 1) * 3.6
          lean = Math.sin(t * 9) * amp
        }
        let pose: Pose = { crouch: 1, lift: 8, lean: 0.34, armF: 1.24, elbowF: 0.05, armB: 1.1, elbowB: 0.15, blink: blinking(s.time, 2), mouth: 'smile' }
        let flying: [number, number, number] | null = null // [x, y, rotation]
        let hat = false
        let held = false
        let blob = false
        if (rolling) pose = { ...pose, armF: 0.9, elbowF: 0.8, armB: 0.7, elbowB: 0.8, lean: 0.1 }
        else if (tl.on('slap', t)) {
          const p = tl.p('slap', t)
          pose = { ...pose, armF: 1.24 + Math.sin(p * Math.PI) * 0.9, elbowF: 0.3 }
        } else if (tl.on('throw', t)) {
          const worried = gag !== 'perfect' && tp > 0.6
          pose = { ...pose, armF: 1.24 + easeInOut(tp) * 0.34, armB: 1.1 + easeInOut(tp) * 0.34, mouth: worried ? 'o' : 'flat', eyes: worried ? 'wide' : 'normal', headTilt: 0.1 }
        } else if (tl.on('g1', t) || tl.on('g2', t)) {
          const p1 = tl.p('g1', t)
          const p2 = tl.p('g2', t)
          if (gag === 'collapse') {
            const f = easeIn(clamp(p1 * 1.6))
            h = lerp(23, 3.6, f)
            w = lerp(5.2, 11, f)
            neck = lerp(0.55, 1.05, f)
            lean = Math.sin(t * 9) * 3.6 * (1 - f) + f * 3
            blob = p1 > 0.4
            pose = { ...pose, armF: 1.0, elbowF: 0.6, armB: 0.9, elbowB: 0.6, lean: 0.34 + p2 * 0.14, mouth: p2 > 0.3 ? 'frown' : 'o', eyes: p2 > 0.3 ? 'normal' : 'wide', headTilt: p2 * 0.2 }
          } else if (gag === 'perfect') {
            lean = 0
            h = 23
            w = 5.2
            neck = 0.55
            if (t >= tl.start.g2) {
              held = true
              onWheel = false
              const up = easeInOut(seg(p2, 0, 0.3))
              pose = { ...pose, lean: lerp(0.34, 0, up), armF: lerp(1.5, 2.5, up), elbowF: 0.1, armB: lerp(1.4, 2.3, up), elbowB: 0.1, mouth: 'grin', eyes: up > 0.8 ? 'closed' : 'normal' }
            } else pose = { ...pose, armF: 1.58, armB: 1.44, mouth: 'smile' }
          } else {
            const pt = tl.since('g1', t)
            if (pt < 0.3) {
              h = 23
              w = 5.2
              neck = 0.55
              lean = Math.sin(t * 14) * 5
              pose = { ...pose, mouth: 'o', eyes: 'wide', lean: 0.2 }
            } else {
              onWheel = false
              const f = seg(pt, 0.3, 1.6)
              if (f < 1) flying = [lerp(WX, 1, f), lerp(WY, -62, f) - Math.sin(f * Math.PI) * 72, f * Math.PI * 5]
              else hat = true
              pose = f < 1 ? { ...pose, lean: 0.05, armF: 2.2, elbowF: 0.3, armB: 0.6, mouth: 'o', eyes: 'wide', headTilt: -0.35 } : { ...pose, lean: 0.1, armF: 1.5 + Math.sin(t * 6) * 0.3, elbowF: 0.2, armB: 1.3 - Math.sin(t * 6) * 0.3, elbowB: 0.2, mouth: 'o' }
            }
          }
        }
        if (tl.on('out', t)) {
          if (gag === 'collapse') {
            h = 3.6
            w = 11
            neck = 1.05
            lean = 3
            blob = true
            pose = { ...pose, mouth: 'frown' }
          } else if (gag === 'perfect') {
            onWheel = false
            held = true
            pose = { ...pose, armF: 1.3, elbowF: 0.9, armB: 1.1, elbowB: 0.9, mouth: 'grin' }
          } else {
            onWheel = false
            hat = true
            pose = { ...pose, armF: 1.5, elbowF: 0.2, armB: 1.3, elbowB: 0.2, mouth: 'o' }
          }
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 9, 30)
          drawWheelRig(ctx, roll, spinning ? t * 14 : 0)
          const a = drawPerson(ctx, look, pose)
          if (onWheel) {
            drawPot(ctx, WX, WY, w, h, CLAY, { neck, lean })
            if (spinning && h > 8) {
              // Throwing rings, climbing as the wheel turns.
              for (let i = 0; i < 2; i++) {
                const r = ((t * 0.9 + i * 0.5) % 1) * (h - 3)
                line(ctx, WX - w * 0.7 + (lean * r) / h, WY - 1.5 - r, WX + w * 0.5 + (lean * r) / h, WY - 1.5 - r, 0.6, alpha('#ffffff', 0.25))
              }
            }
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, CLAY)
          }
          if (held) {
            const hx = (a.handF.x + a.handB.x) / 2
            const hy = Math.min(a.handF.y, a.handB.y) + 3
            drawPot(ctx, hx, hy, 5.2, 23, gag === 'perfect' && tl.on('out', t) ? CLAY : CLAY, { neck: 0.55 })
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, CLAY)
          }
          if (flying) {
            ctx.save()
            ctx.translate(flying[0], flying[1])
            ctx.rotate(flying[2])
            drawPot(ctx, 0, 11, 5.2, 23, CLAY, { neck: 0.55 })
            ctx.restore()
          }
          if (hat) {
            // Mouth down over the eyes, a perfect fit.
            ctx.save()
            ctx.translate(a.crown.x + 1, a.crown.y + 13)
            ctx.rotate(Math.PI + Math.sin(t * 6) * 0.04)
            drawPot(ctx, 0, 0, 6.4, 20, CLAY, { neck: 0.9, belly: 1.1 })
            ctx.restore()
          }
          if (blob) fillEll(ctx, a.head.x + 6, a.head.y + 3, 2.6, 2, CLAY, 0.4)
        })
      },
    })
  },
}

// ─── The kiln ────────────────────────────────────────────────────────────────
// A squat top-loader on a wheeled stand: banded steel, a lid with a handle, a
// controller box on the side and one glowing peephole. Origin at the middle of
// its base. `heat` 0..1, `lid` 0..1 open.

function drawKiln(ctx: Ctx, heat: number, lid: number, t: number) {
  const pulse = 0.5 + Math.sin(t * 3.1) * 0.5
  const firing = heat > 0.6
  for (const wx of [-12, 12]) {
    line(ctx, wx, -8, wx, -4, 1.7, '#64748b')
    fillCirc(ctx, wx, -2.5, 2.5, '#334155')
    fillCirc(ctx, wx, -2.5, 0.9, '#94a3b8')
  }
  fillRR(ctx, -16.5, -10, 33, 2.8, 1, '#64748b')
  // Controller on the far side, with its cable.
  poly(ctx, [15, -15, 20, -12, 21, -17], 1, '#334155')
  fillRR(ctx, 16.5, -32, 9, 15.5, 1.6, '#3f5170')
  fillRR(ctx, 17.8, -30.5, 6.4, 4.4, 0.8, '#0b1220')
  fillRR(ctx, 18.5, -29.6, 5, 2.6, 0.4, firing ? '#ff6a3d' : C.mint)
  for (let i = 0; i < 3; i++) fillCirc(ctx, 19.2 + i * 1.9, -23.2, 0.75, i === 0 && firing ? (pulse > 0.5 ? C.red : '#7f1d1d') : '#94a3b8')
  fillRR(ctx, 18.2, -20.6, 5.6, 1.2, 0.5, '#64748b')
  if (lid > 0.02) {
    // Light spilling out of the open chamber.
    ctx.globalAlpha = (0.14 + 0.08 * pulse) * (0.5 + heat) * clamp(lid * 2)
    fillPoly(ctx, [-13, -37, 13, -37, 24, -37 - 40 * lid, -20, -37 - 44 * lid], C.amber)
    ctx.globalAlpha = 1
  }
  // Body: bright steel, three bands, a row of buckles.
  fillRR(ctx, -15, -37, 30, 27.5, 3, '#c3ccd8')
  fillRR(ctx, 8, -37, 7, 27.5, 3, '#9aa6b6')
  fillRR(ctx, -15, -37, 4, 27.5, 2, '#dfe5ec')
  for (const by of [-31, -23.5, -16]) {
    fillRR(ctx, -15, by, 30, 1.3, 0.4, '#7b8798')
    fillRR(ctx, 0, by - 1, 3.4, 3.2, 0.6, '#5f6b7c')
  }
  if (firing) {
    ctx.globalAlpha = (heat - 0.6) * (0.4 + 0.25 * pulse)
    fillRR(ctx, -15, -37, 30, 27.5, 3, C.orange)
    ctx.globalAlpha = 1
  }
  if (lid > 0.02) fillRR(ctx, -13.5, -38, 27, 2.2, 1, firing ? '#ffd28a' : '#fbbf6b')
  // The peephole, and the glow around it.
  ctx.globalAlpha = heat * (0.22 + 0.2 * pulse)
  fillCirc(ctx, -7, -26.5, 3.4 + heat * 4.5, C.orange)
  ctx.globalAlpha = 1
  fillCirc(ctx, -7, -26.5, 2.8, '#566273')
  fillCirc(ctx, -7, -26.5, 1.9, firing ? '#ffd28a' : '#fb923c')
  fillCirc(ctx, -7.5, -27, 0.65, '#fff7d6')
  // Lid, hinged on the far side.
  ctx.save()
  ctx.translate(16, -37)
  ctx.rotate(lid * 1.15)
  fillRR(ctx, -32.5, -4.8, 33, 4.8, 2, '#8794a6')
  fillRR(ctx, -32.5, -4.8, 33, 1.6, 0.8, '#aab5c4')
  poly(ctx, [-31, -4.8, -31, -8, -26, -8, -26, -4.8], 1.3, '#475569')
  ctx.restore()
  fillCirc(ctx, 16, -37, 1.5, '#475569')
  if (lid < 0.2) {
    // Heat shimmer off the lid.
    ctx.lineCap = 'round'
    ctx.lineWidth = 1
    ctx.strokeStyle = '#ffd9a8'
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.45 + i / 3) % 1
      const x0 = -8 + i * 8
      const y0 = -44 - p * 18
      const wob = Math.sin(t * 4 + i * 2) * 1.6
      ctx.globalAlpha = (1 - p) * clamp(p * 4) * 0.45 * heat
      ctx.beginPath()
      ctx.moveTo(x0 + wob, y0)
      ctx.quadraticCurveTo(x0 - wob * 1.5, y0 - 3, x0 + wob, y0 - 6)
      ctx.quadraticCurveTo(x0 + wob * 2.5, y0 - 9, x0, y0 - 11)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

function drawStool(ctx: Ctx, x: number, y: number) {
  line(ctx, x - 5, y - 13, x + 4.5, y, 1.5, '#8b5a2b')
  line(ctx, x + 5, y - 13, x - 4.5, y, 1.5, '#8b5a2b')
  fillRR(ctx, x - 6.5, y - 14.6, 13, 2.8, 1.3, '#c48a52')
}

/** How far ahead of the potter the kiln stands, in units. */
const KILN_X = 31
const GLOVES = '#e2553d'

function ember(s: Stage, rng: Rng, x: number, y: number, spread: number, power = 1) {
  s.particles.emit({
    kind: 'ember',
    x: x + range(rng, -spread, spread) * s.u,
    y,
    vx: range(rng, -14, 14) * s.u,
    vy: -range(rng, 22, 52) * power * s.u,
    size: range(rng, 1.6, 3) * s.u,
    color: pick(rng, HOT),
    life: range(rng, 0.9, 1.7),
  })
}

// Opening the kiln. The potter wheels it on, has a look through the peephole,
// pulls on the gauntlets and lifts the lid. What comes out is either the best
// pot anyone has ever made, or two halves of it.

const kilnOpening: ActDef = {
  id: 'pottery.kiln-opening',
  weight: 3,
  when: () => true,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng, 46, 80)
    const base = pick(rng, POTTERS)
    const cracked = chance(rng, 0.42)
    const glaze = pick(rng, GLAZES)
    const tl = timeline([
      ['in', secs(from, spot)],
      ['rest', 0.9],
      ['peek', 1.8],
      ['gloves', 1.0],
      ['open', 1.0],
      ['lift', 1.5],
      ['show', 2.4],
      ['close', 1.1],
      ['out', secs(spot, to)],
    ])
    const HEAT = 0.42
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    const lidAt = (t: number) => (t < tl.start.close ? easeOut(tl.p('open', t)) : 1 - easeInOut(seg(tl.p('close', t), 0.35, 0.8)))
    return makeAct({
      update(s, dt, t) {
        const kx = xAt(t) + dir * KILN_X * s.u
        const top = s.ground - 42 * s.u
        const lid = lidAt(t)
        if (lid > 0.4) {
          if (every(t, dt, 9)) ember(s, rng, kx, top, 10)
        } else if (every(t, dt, 1.5)) ember(s, rng, kx, top - 4 * s.u, 12, 0.7)
        if (hit(t, dt, tl.start.open + 0.2)) burst(s, 'dust', kx, top, 6, ['#fde7c2'], 50, [4, 8])
        if (!cracked && hit(t, dt, tl.start.show + 0.8)) burst(s, 'star', kx - dir * 12 * s.u, s.ground - 66 * s.u, 8, [C.yellow, C.white, glaze], 70, [3, 5])
        if (cracked && hit(t, dt, tl.start.show + 0.75)) burst(s, 'spark', kx, top, 8, HOT, 80, [2, 3])
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        const lid = lidAt(t)
        const gloved = t >= tl.start.gloves + 0.3
        const look: Look = gloved ? { ...base, gloves: GLOVES } : base
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.7 : 0, blink: blinking(s.time, 3) }
        let faceGlow = 0
        let tongs = false
        // Where the tongs hold the pot (its base), in the potter's frame.
        let potAt: [number, number] | null = null
        let potGlow = 0
        let split = 0 // 0 whole, 0..1 the far half falling away
        let onLid = false
        if (moving) pose = { ...pose, armF: 1.15, elbowF: 0.3, armB: 1.0, elbowB: 0.35, lean: 0.14 }
        else if (tl.on('rest', t)) {
          const mop = plateau(tl.p('rest', t), 0.3, 0.7)
          pose = { ...pose, armF: 0.9 + mop * 1.7, elbowF: 0.4 + mop * 1.4, mouth: 'puff', eyes: mop > 0.5 ? 'closed' : 'normal' }
        } else if (tl.on('peek', t)) {
          const e = plateau(tl.p('peek', t), 0.25, 0.82)
          faceGlow = e * 0.5
          pose = { ...pose, crouch: e * 0.75, lean: e * 0.55, armF: 0.8, elbowF: 0.9 * e, armB: 0.4, mouth: e > 0.6 ? 'o' : 'smile', eyes: e > 0.6 ? 'wide' : 'normal' }
        } else if (tl.on('gloves', t)) {
          const p = tl.p('gloves', t)
          pose = { ...pose, armF: 1.9 + Math.sin(p * 18) * 0.12, elbowF: 0.9, armB: 1.6 - Math.sin(p * 18) * 0.12, elbowB: 0.9, mouth: 'grin' }
        } else if (tl.on('open', t)) {
          const p = tl.p('open', t)
          faceGlow = p * 0.6
          pose = { ...pose, lean: 0.3 - p * 0.2, armF: lerp(2.15, 2.75, p), elbowF: 0, armB: 0.6, mouth: 'o', eyes: 'wide' }
        } else if (tl.on('lift', t)) {
          const e = easeInOut(tl.p('lift', t))
          faceGlow = 0.6
          tongs = true
          potAt = [lerp(KILN_X, 19, e), lerp(-29, -50, e)]
          potGlow = 1
          pose = { ...pose, lean: 0.25 - e * 0.25, armF: lerp(1.75, 2.0, e), elbowF: 0.25, armB: 0.7, elbowB: 0.5, mouth: 'o', eyes: 'wide' }
        } else if (tl.on('show', t)) {
          const p = tl.p('show', t)
          faceGlow = 0.45
          tongs = true
          potAt = [19, -50]
          potGlow = 1 - easeOut(seg(p, 0, 0.6))
          if (cracked) {
            split = seg(p, 0.2, 0.45)
            pose = { ...pose, armF: 2.0, elbowF: 0.25, armB: 0.4, mouth: p < 0.2 ? 'smile' : p < 0.5 ? 'o' : 'frown', eyes: p > 0.2 && p < 0.5 ? 'wide' : 'normal', headTilt: p > 0.5 ? 0.16 : 0, lean: p > 0.5 ? 0.08 : 0 }
          } else pose = { ...pose, armF: 2.0 + easeOut(seg(p, 0.2, 0.5)) * 0.5, elbowF: 0.25, armB: 2.1 * easeOut(seg(p, 0.2, 0.5)), elbowB: 0.2, mouth: 'grin', eyes: p > 0.35 ? 'closed' : 'normal', lift: Math.abs(Math.sin(seg(p, 0.3, 0.9) * Math.PI * 2)) * 4 }
        } else if (tl.on('close', t)) {
          const p = tl.p('close', t)
          faceGlow = 0.45 * (1 - p)
          if (cracked) {
            // The other half goes back where it came from.
            const drop = easeIn(seg(p, 0, 0.35))
            if (drop < 1) {
              tongs = true
              potAt = [lerp(19, KILN_X, drop), lerp(-50, -30, drop)]
              split = 1
            }
            pose = { ...pose, armF: lerp(2.0, 1.2, p), elbowF: 0.3, mouth: 'frown' }
          } else {
            const put = easeInOut(seg(p, 0.6, 1))
            tongs = put < 1
            potAt = [lerp(19, KILN_X + 4, put), lerp(-50, -42, put)]
            onLid = put >= 1
            pose = { ...pose, armF: lerp(2.5, 1.9, put), elbowF: 0.25, mouth: 'smile' }
          }
        }
        if (tl.on('out', t) && !cracked) onLid = true
        const pot = (px: number, py: number, glow: number) => drawPot(ctx, px, py, 5, 11, glaze, { neck: 0.55, glow })
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          groundShadow(ctx, KILN_X, 20)
          ctx.save()
          ctx.translate(KILN_X, 0)
          drawKiln(ctx, HEAT, lid, t)
          ctx.restore()
          if (onLid) pot(KILN_X + 4, -42, 0)
          const a = drawPerson(ctx, look, pose)
          if (faceGlow > 0) {
            ctx.globalAlpha = faceGlow * 0.5
            fillCirc(ctx, a.head.x + 2, a.head.y + 1, 10, C.orange)
            ctx.globalAlpha = 1
          }
          if (potAt && !onLid) {
            const [px, py] = potAt
            ctx.save()
            // Nothing shows until it clears the rim.
            ctx.beginPath()
            ctx.rect(-60, -200, 200, 200 - 38.5)
            ctx.clip()
            if (cracked && split > 0) {
              // Near half stays in the tongs; the far half peels off and drops back in.
              ctx.save()
              ctx.beginPath()
              ctx.rect(px - 12, py - 16, 12.4, 18)
              ctx.clip()
              pot(px, py, potGlow)
              ctx.restore()
              if (split < 1) {
                const fall = split * split
                ctx.save()
                ctx.translate(lerp(px, KILN_X, split), lerp(py, -34, fall))
                ctx.rotate(split * 1.6)
                ctx.beginPath()
                ctx.rect(0.4, -16, 12, 18)
                ctx.clip()
                pot(0, 0, potGlow)
                ctx.restore()
              }
              poly(ctx, [px + 0.4, py - 11, px - 0.8, py - 8, px + 0.6, py - 5.5, px - 0.6, py - 2.5, px + 0.4, py], 0.7, shade(glaze, -0.5))
            } else pot(px, py, potGlow)
            ctx.restore()
            if (tongs) {
              line(ctx, a.handF.x, a.handF.y, px - 3.4, py - 9, 1, '#94a3b8')
              line(ctx, a.handF.x, a.handF.y, px + (cracked && split > 0 ? 0 : 3.4), py - 9, 1, '#cbd5e1')
              fillCirc(ctx, a.handF.x, a.handF.y, 2.8, gloved ? GLOVES : look.skin)
            }
          }
        })
      },
    })
  },
}

// Mid-firing. The kiln is at full heat and absolutely must not be opened, so
// there is nothing to do but sit beside it on a folding stool and look at a
// watch. This is the hardest part of pottery.

const kilnFiring: ActDef = {
  id: 'pottery.kiln-firing',
  weight: 6,
  when: (c) => c.house.kilnFiring === true,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng, 46, 80)
    const look = pick(rng, POTTERS)
    const mid = pick(rng, ['nap', 'tempted'] as const)
    const tl = timeline([
      ['in', secs(from, spot)],
      ['park', 0.9],
      ['sit', 0.8],
      ['watch1', 2.2],
      ['mid', 3.2],
      ['watch2', 1.9],
      ['up', 0.7],
      ['out', secs(spot, to)],
    ])
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    return makeAct({
      update(s, dt, t) {
        const kx = xAt(t) + dir * KILN_X * s.u
        if (every(t, dt, 7)) ember(s, rng, kx, s.ground - 44 * s.u, 13, 1.2)
        if (every(t, dt, 1.6)) ember(s, rng, kx - dir * 9 * s.u, s.ground - 27 * s.u, 1, 0.6)
        if (tl.on('mid', t)) {
          const pt = tl.since('mid', t)
          if (mid === 'nap' && hit(pt, dt, 2.4)) burst(s, 'spark', kx - dir * 8 * s.u, s.ground - 27 * s.u, 9, HOT, 90, [2, 3.5])
          if (mid === 'tempted' && hit(pt, dt, 1.1)) burst(s, 'spark', kx - dir * 13 * s.u, s.ground - 45 * s.u, 9, HOT, 90, [2, 3.5])
        }
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        // 0 standing, 1 on the stool.
        const seated = t < tl.start.up ? easeInOut(seg(tl.p('sit', t), 0.3, 1)) : 1 - easeInOut(tl.p('up', t))
        const stoolOut = t >= tl.start.sit + 0.2 && t < tl.start.up + 0.55
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.7 : 0, blink: blinking(s.time, 4), crouch: seated, lift: seated * 1.2 }
        let checking = false
        let says = ''
        let sleeping = false
        let hot = false
        if (moving) pose = { ...pose, armF: 1.15, elbowF: 0.3, armB: 1.0, elbowB: 0.35, lean: 0.14 }
        else if (tl.on('park', t)) {
          // Fanning a hot face.
          pose = { ...pose, armF: 2.2 + Math.sin(t * 16) * 0.25, elbowF: 1.3, mouth: 'puff' }
          hot = true
        } else if (tl.on('watch1', t) || tl.on('watch2', t)) {
          const p = tl.on('watch1', t) ? tl.p('watch1', t) : tl.p('watch2', t)
          const e = plateau(p, 0.2, 0.8)
          checking = e > 0.5
          pose = { ...pose, armF: lerp(0.6, 1.45, e), elbowF: lerp(1.3, 1.75, e), armB: 0.5, elbowB: 1.3, headTilt: e * 0.22, mouth: tl.on('watch2', t) ? 'frown' : 'flat' }
          if (tl.on('watch2', t) && checking) says = '...'
        } else if (tl.on('mid', t)) {
          const pt = tl.since('mid', t)
          if (mid === 'nap') {
            if (pt < 2.4) {
              sleeping = pt > 0.5
              pose = { ...pose, armF: 0.6, elbowF: 1.4, armB: 0.5, elbowB: 1.3, eyes: 'closed', headTilt: 0.25 + Math.sin(t * 1.8) * 0.08, mouth: 'flat', lean: 0.08 }
            } else {
              pose = { ...pose, armF: 2.2, elbowF: 0.4, armB: -1.2, elbowB: -0.4, eyes: 'wide', mouth: 'o', lift: 1.2 + Math.sin(seg(pt, 2.4, 2.8) * Math.PI) * 5, lean: -0.12 }
              if (pt < 3.0) says = '!'
            }
          } else if (pt < 1.1) {
            // Just a little look. What harm could it do.
            const r = easeInOut(seg(pt, 0.1, 1.0))
            pose = { ...pose, lean: r * 0.4, armF: lerp(0.8, 2.0, r), elbowF: 0.1, armB: 0.5, elbowB: 1.0, eyes: 'wide', mouth: 'grin' }
          } else if (pt < 2.3) {
            pose = { ...pose, lean: -0.1, armF: 1.7 + Math.sin(t * 26) * 0.3, elbowF: 0.9, armB: 0.5, elbowB: 1.0, eyes: pt < 1.5 ? 'wide' : 'closed', mouth: 'o' }
            says = 'hot!'
          } else pose = { ...pose, armF: 0.6, elbowF: 1.4, armB: 0.5, elbowB: 1.3, mouth: 'frown', headTilt: 0.12 }
        } else pose = { ...pose, armF: 0.6, elbowF: 1.3 * seated, armB: 0.5, elbowB: 1.3 * seated }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, KILN_X, 20)
          // Everything near a firing kiln is a little orange.
          // A soft radial falloff with no hard edge, in a warm amber bright
          // enough to stay orange over the navy rather than turning grey.
          const glow = ctx.createRadialGradient(KILN_X, -26, 4, KILN_X, -26, 42)
          const g = 0.3 + Math.sin(t * 3.1) * 0.08
          glow.addColorStop(0, `rgba(255,170,80,${g})`)
          glow.addColorStop(0.5, `rgba(255,140,60,${g * 0.45})`)
          glow.addColorStop(1, 'rgba(255,120,40,0)')
          ctx.fillStyle = glow
          ctx.fillRect(KILN_X - 44, -70, 88, 70)
          ctx.save()
          ctx.translate(KILN_X, 0)
          drawKiln(ctx, 1, 0, t)
          ctx.restore()
          groundShadow(ctx, 0, 11)
          if (stoolOut) drawStool(ctx, -2, 0)
          const a = drawPerson(ctx, look, pose, (an) => {
            // Folded flat and slung on the back when not in use.
            if (!stoolOut) {
              line(ctx, an.back.x - 3, an.back.y - 6, an.back.x - 4.5, an.back.y + 9, 1.5, '#8b5a2b')
              fillRR(ctx, an.back.x - 4.6, an.back.y - 7.5, 2.8, 12, 1.3, '#c48a52')
            }
          })
          if (checking) {
            // The watch.
            const wx = lerp(a.elbowF.x, a.handF.x, 0.72)
            const wy = lerp(a.elbowF.y, a.handF.y, 0.72)
            fillCirc(ctx, wx, wy, 2.3, '#334155')
            fillCirc(ctx, wx, wy, 1.6, C.mint)
            line(ctx, wx, wy, wx + 0.9, wy - 0.7, 0.5, C.ink)
          }
          if (hot) sweat(ctx, a.head.x, a.head.y - 8, t)
        })
        if (sleeping) at(ctx, x, s.ground, s.u, 1, () => zzz(ctx, dir * 8, -56, t))
        if (says) say(s, x, -64, says, says === 'hot!' ? { color: C.crimson, size: 9 } : { size: 9 })
      },
    })
  },
}

// ─── Glazing ─────────────────────────────────────────────────────────────────
// Three bisque pots on a plank and one bucket. Each pot goes in pale and comes
// out a different colour, which is not how one bucket of glaze works, but the
// first two are lovely. The third is something else.

function drawTrestle(ctx: Ctx, roll: number) {
  fillRR(ctx, -20, -6, 58, 2, 1, '#8b6a45')
  for (const lx of [-16, 16]) {
    line(ctx, lx, -15.5, lx - 3, -4.5, 1.7, '#8b5a2b')
    line(ctx, lx, -15.5, lx + 3, -4.5, 1.7, '#8b5a2b')
  }
  castor(ctx, -17, roll, 2)
  castor(ctx, 15, roll, 2)
  castor(ctx, 36, roll, 2)
  fillRR(ctx, -22, -17.5, 44, 2.7, 1.2, '#b98552')
  fillRR(ctx, -22, -17.5, 44, 0.9, 0.4, '#d3a06c')
}

function drawBucket(ctx: Ctx, x: number, y: number, glaze: string) {
  ctx.beginPath()
  ctx.arc(x, y - 11, 6, Math.PI, 0)
  ctx.lineWidth = 0.9
  ctx.strokeStyle = '#94a3b8'
  ctx.stroke()
  fillPoly(ctx, [x - 5, y - 11, x + 5, y - 11, x + 3.8, y, x - 3.8, y], '#dfe6ee')
  fillPoly(ctx, [x + 2, y - 11, x + 5, y - 11, x + 3.8, y, x + 1.4, y], '#b9c4d2')
  fillEll(ctx, x, y - 11, 5, 1.4, glaze)
  // A dribble down the outside.
  line(ctx, x - 2.4, y - 10.4, x - 2.6, y - 6.5, 1.3, glaze)
}

const glazing: ActDef = {
  id: 'pottery.glazing',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng, 46, 80)
    const look = pick(rng, POTTERS)
    const c1 = pick(rng, GLAZES)
    const c2 = pick(rng, GLAZES.filter((g) => g !== c1))
    const wrong = pick(rng, ['spots', 'stripes'] as const)
    const colors = [c1, c2, wrong === 'spots' ? C.pink : C.red]
    const POT = 3.6
    const tl = timeline([
      ['in', secs(from, spot)],
      ['pot0', POT],
      ['pot1', POT],
      ['pot2', POT],
      ['shrug', 2.0],
      ['back', 0.9],
      ['out', secs(spot, to)],
    ])
    const steps = ['pot0', 'pot1', 'pot2'] as const
    const PX = [-14, 0, 14] // where each pot stands on the plank
    const SHAPE: [number, number, number][] = [
      [5, 9, 0.7],
      [4.4, 11, 0.5],
      [5.6, 8, 0.9],
    ]
    const PUSH = -34
    const BKT = 15.3 // where to stand to reach the bucket
    const BX = 31
    const pickAt = (i: number) => PX[i] - 13
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    /** The potter's position along the bench, and how far into the bucket the arm is. */
    const relAt = (t: number): [number, number] => {
      for (let i = 0; i < 3; i++) {
        if (!tl.on(steps[i], t)) continue
        const pt = tl.since(steps[i], t)
        const prev = i === 0 ? PUSH : pickAt(i - 1)
        const here = pickAt(i)
        if (pt < 0.7) return [lerp(prev, here, easeInOut(pt / 0.7)), 0]
        if (pt < 1.0) return [here, 0]
        if (pt < 1.6) return [lerp(here, BKT, easeInOut(seg(pt, 1.0, 1.6))), 0]
        if (pt < 2.8) return [BKT, easeInOut(seg(pt, 1.6, 2.0)) * (1 - easeInOut(seg(pt, 2.3, 2.7)))]
        if (pt < 3.4) return [lerp(BKT, here, easeInOut(seg(pt, 2.8, 3.4))), 0]
        return [here, 0]
      }
      if (tl.on('shrug', t)) return [pickAt(2), 0]
      if (tl.on('back', t)) return [lerp(pickAt(2), PUSH, easeInOut(tl.p('back', t))), 0]
      return [PUSH, 0]
    }
    return makeAct({
      update(s, dt, t) {
        const bx = spot + dir * BX * s.u
        for (let i = 0; i < 3; i++) {
          if (!tl.on(steps[i], t)) continue
          const pt = tl.since(steps[i], t)
          const col = i === 2 && wrong === 'stripes' ? RAINBOW : [colors[i], shade(colors[i], 0.3)]
          if (hit(pt, dt, 1.95)) burst(s, 'drop', bx, s.ground - 16 * s.u, 7, col, 80, [2, 3.5])
          if (pt > 2.6 && pt < 3.4 && every(t, dt, 9)) {
            const rel = relAt(t)[0]
            s.particles.emit({ kind: 'drop', x: spot + dir * (rel + 13 + range(rng, -3, 3)) * s.u, y: s.ground - 20 * s.u, vy: 20 * s.u, size: range(rng, 1.8, 2.8) * s.u, color: pick(rng, col) })
          }
        }
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const tx = xAt(t)
        const [rel, dip] = relAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        const stepping = moving || Math.abs(relAt(t + 0.03)[0] - rel) > 0.01
        // Which pot is in the hand, and which have been through the bucket.
        let held = -1
        const done = [false, false, false]
        for (let i = 0; i < 3; i++) {
          const pt = tl.since(steps[i], t)
          if (pt >= 0.85 && pt < 3.5) held = i
          done[i] = pt >= 2.2
        }
        const bucketCol = done[2] ? (wrong === 'spots' ? C.pink : C.purple) : done[1] ? c2 : done[0] ? c1 : '#cfd8e3'
        let pose: Pose = {
          walk: (Math.abs(tx - from) / s.u + rel) / 6.2,
          stride: moving ? 0.7 : stepping ? 0.45 : 0,
          blink: blinking(s.time, 6),
          armF: lerp(0.8, 0.5, dip),
          elbowF: lerp(0.5, 0, dip),
          lean: 0.6 * dip,
          crouch: 0.5 * dip,
          mouth: held === 2 && done[2] ? 'o' : 'smile',
          eyes: held === 2 && done[2] ? 'wide' : 'normal',
        }
        if (moving || tl.on('back', t)) pose = { ...pose, armF: 0.5, elbowF: 0.5, armB: 0.4, elbowB: 0.5, lean: moving ? 0.1 : 0 }
        let says = ''
        if (tl.on('shrug', t)) {
          const p = tl.p('shrug', t)
          const up = plateau(seg(p, 0.35, 1), 0.3, 0.75)
          pose = { ...pose, armF: 0.8 + up * 0.9, elbowF: 0.5 + up * 0.6, armB: 0.3 + up * 1.1, elbowB: 0.3 + up * 0.8, headTilt: p < 0.35 ? 0.2 : -0.1 * up, mouth: 'flat', lift: up * 1.5 }
          if (p < 0.4) says = '?'
        }
        const potOpts = (i: number) => ({ neck: SHAPE[i][2], pattern: i === 2 && done[2] ? wrong : undefined })
        const potCol = (i: number) => (done[i] ? colors[i] : BISQUE)
        at(ctx, tx + dir * rel * s.u, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, look, pose)
          if (held >= 0) drawPot(ctx, a.handF.x, a.handF.y + 1 + SHAPE[held][1], SHAPE[held][0], SHAPE[held][1], potCol(held), potOpts(held))
        })
        at(ctx, tx, s.ground, s.u, dir, () => {
          groundShadow(ctx, 8, 32)
          drawTrestle(ctx, Math.abs(tx - from) / s.u / 2)
          for (let i = 0; i < 3; i++) if (i !== held) drawPot(ctx, PX[i], -17.5, SHAPE[i][0], SHAPE[i][1], potCol(i), potOpts(i))
          drawBucket(ctx, BX, -6, bucketCol)
        })
        if (held >= 0) {
          // The gripping hand goes over the rim of the pot.
          at(ctx, tx + dir * rel * s.u, s.ground, s.u, dir, () => {
            const reach = lerp(0.8, 0.5, dip)
            void reach
          })
        }
        if (says) say(s, tx + dir * rel * s.u, -64, says)
      },
    })
  },
}

// ─── The stack of bowls ──────────────────────────────────────────────────────
// Nine bowls, one pair of hands, and a dog who has chosen this exact moment to
// weave in and out of the legs carrying them.

const bowlStack: ActDef = {
  id: 'pottery.bowl-stack',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng, 36, 85)
    const look = pick(rng, POTTERS)
    const gag = pick(rng, ['made-it', 'hat'] as const)
    const N = 9
    const colors: string[] = []
    for (let i = 0; i < N; i++) colors.push(pick(rng, [...GLAZES, BISQUE, '#f1f5f9']))
    const tl = timeline([
      ['in', secs(from, spot)],
      ['wobble', 2.6],
      ['out', secs(spot, to)],
    ])
    const FALL = 1.1
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    /** How far ahead of the potter the dog is, in units. */
    const dogOff = (t: number) => {
      const weave = Math.sin(t * 1.3) * 26
      if (gag === 'made-it') return weave
      if (t < tl.start.wobble) return weave
      const sitAt = lerp(Math.sin(tl.start.wobble * 1.3) * 26, 30, easeInOut(seg(tl.since('wobble', t), 0, 0.6)))
      return t < tl.start.out ? sitAt : lerp(30, 48, easeInOut(seg(tl.since('out', t), 0, 1.2)))
    }
    const dogX = (t: number) => xAt(t) + dir * dogOff(t) * stage.u
    return makeAct({
      update(s, dt, t) {
        if (gag === 'hat' && hit(t, dt, tl.start.wobble + FALL + 0.5)) burst(s, 'star', dogX(t) + dir * 15 * s.u, s.ground - 34 * s.u, 5, [C.yellow, C.white], 50, [2.5, 4])
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        const wp = tl.p('wobble', t)
        const bump = tl.on('wobble', t) ? Math.sin(wp * Math.PI) : 0
        const amp = 1.5 + Math.pow(Math.sin(t * 0.9), 2) * 1.2 + bump * 5.5
        const fallen = gag === 'hat' && t >= tl.start.wobble + FALL
        const fallP = seg(tl.since('wobble', t), FALL, FALL + 0.5)
        const count = fallen ? N - 1 : N
        const alarm = bump > 0.3
        const pose: Pose = {
          walk: Math.abs(x - from) / s.u / 6.2,
          stride: moving ? 0.55 : 0,
          armF: 0.7,
          elbowF: 0.9,
          armB: 0.55,
          elbowB: 1.0,
          lean: -0.12 + Math.sin(t * 3.2) * 0.1 * bump,
          crouch: bump * 0.2,
          mouth: alarm ? 'o' : gag === 'hat' && tl.on('out', t) ? 'smile' : 'flat',
          eyes: alarm ? 'wide' : 'normal',
          blink: blinking(s.time, 5),
        }
        const sway = (i: number) => Math.sin(t * 3.2 + i * 0.45) * amp * Math.pow(i / (N - 1), 1.4)
        // The dog. It faces whichever way it is actually going.
        const dx = dogX(t)
        const dv = (dogX(t + 0.03) - dx) * dir
        const sitting = gag === 'hat' && tl.on('wobble', t) && tl.since('wobble', t) > 0.6
        const dogMoving = !sitting && Math.abs(dv) > 0.05
        const dogFace = (dv < -0.05 ? -dir : dir) as 1 | -1
        const run = t * 11
        const stride = dogMoving ? 0.6 : 0
        const behind = Math.cos(t * 1.3) < 0 && !fallen
        const drawTheDog = () => {
          at(ctx, dx, s.ground, s.u, dogFace, () => {
            groundShadow(ctx, 0, 14)
            drawDog(ctx, DOG, { run, stride, wag: t * (fallen ? 20 : 12), sitting, tilt: sitting ? -0.35 : 0, mouthOpen: fallen })
            if (fallen && fallP >= 1) {
              // A bowl, worn as a hat, with some pride.
              const bob = Math.abs(Math.sin(run)) * 2.2 * stride
              ctx.save()
              ctx.translate(15 - (sitting ? 4 : 0), -25.5 - bob - (sitting ? 8 : 0))
              ctx.scale(1, -1)
              drawBowl(ctx, 0, 0, 6.5, colors[N - 1])
              ctx.restore()
            }
          })
        }
        if (behind) drawTheDog()
        let top = { x: 0, y: 0 }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, look, pose)
          const bx = a.handF.x + 1.5
          const by = a.handF.y - 0.5
          for (let i = 0; i < count; i++) drawBowl(ctx, bx + sway(i), by - i * 3.1, 6.8 - (i % 2) * 0.7, colors[i])
          top = { x: bx + sway(N - 1), y: by - (N - 1) * 3.1 }
          fillCirc(ctx, a.handF.x + 1, a.handF.y + 1, 2.7, look.skin)
          if (alarm) sweat(ctx, a.head.x, a.head.y - 8, t)
        })
        if (!behind) drawTheDog()
        if (fallen && fallP < 1) {
          // The top bowl, on its way down to the dog.
          const sx = x + dir * top.x * s.u
          const ex = dx + dogFace * 11 * s.u
          const bxp = lerp(sx, ex, fallP)
          const byp = lerp(s.ground + top.y * s.u, s.ground - 33.5 * s.u, fallP * fallP) - Math.sin(fallP * Math.PI) * 10 * s.u
          at(ctx, bxp, byp, s.u, dir, () => drawBowl(ctx, 0, 0, 6.5, colors[N - 1]), dir * fallP * Math.PI)
        }
      },
    })
  },
}

// ─── The handle ──────────────────────────────────────────────────────────────
// A mug wants a handle. The handle has other plans. Three attempts, each one
// quicker and crosser than the last, and then a solution.

function drawMug(ctx: Ctx, x: number, y: number, color: string) {
  // (x, y) is the middle of the mug.
  fillRR(ctx, x - 5, y - 6, 10, 12, 2, color)
  fillRR(ctx, x + 1.8, y - 6, 3.2, 12, 1.6, shade(color, -0.2))
  fillRR(ctx, x - 4, y - 4.6, 1.4, 8, 0.7, alpha('#ffffff', 0.35))
  fillEll(ctx, x, y - 6, 5, 1.2, shade(color, -0.4))
  fillRR(ctx, x - 5, y - 1, 10, 1.4, 0.4, shade(color, 0.3))
}

/** A handle hanging from its top joint at (x, y); `rot` swings it down. */
function drawHandle(ctx: Ctx, x: number, y: number, rot: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.beginPath()
  ctx.arc(0.6, 3.6, 3.6, -Math.PI / 2, Math.PI / 2)
  ctx.lineWidth = 2.1
  ctx.lineCap = 'round'
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.restore()
}

const mugHandle: ActDef = {
  id: 'pottery.mug-handle',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng, 56, 45)
    const look = pick(rng, POTTERS)
    const fix = pick(rng, ['bottom', 'tape'] as const)
    const color = pick(rng, [C.sky, C.mint, C.rose, C.yellow, C.purple])
    const hcol = shade(color, 0.18)
    const D = [2.6, 2.3, 2.0]
    const tl = timeline([
      ['in', secs(from, spot)],
      ['a0', D[0]],
      ['a1', D[1]],
      ['a2', D[2]],
      ['think', 1.1],
      ['fix', 1.0],
      ['present', 2.4],
      ['out', secs(spot, to)],
    ])
    const tries = ['a0', 'a1', 'a2'] as const
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    return makeAct({
      update(s, dt, t) {
        for (let i = 0; i < 3; i++) {
          // The handle hits the floor.
          if (hit(t, dt, tl.start[tries[i]] + (1.9 / 2.6) * D[i])) burst(s, 'dust', spot + dir * 24 * s.u, s.ground - 2, 2, ['#cbd5e1'], 35, [3, 5])
        }
        if (hit(t, dt, tl.start.present + 0.6)) burst(s, 'star', spot + dir * 14 * s.u, s.ground - 70 * s.u, 8, [C.yellow, C.white, color], 70, [3, 5])
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.8 : 0, blink: blinking(s.time, 7), armF: 0.9, elbowF: 1.1 }
        // Where the handle is: in the back hand, on the mug, or loose.
        let where: 'hand' | 'mug' | 'loose' | 'under' = t >= tl.start.present ? (fix === 'bottom' ? 'under' : 'mug') : 'hand'
        let rot = 0
        let loose: [number, number, number] = [0, 0, 0]
        let says = ''
        let taped = fix === 'tape' && t >= tl.start.fix + 0.6
        for (let i = 0; i < 3; i++) {
          if (!tl.on(tries[i], t)) continue
          const u = (tl.since(tries[i], t) / D[i]) * 2.6
          const cross = i * 0.5
          if (u < 0.5) {
            pose = { ...pose, armB: 1.35, elbowB: 0.9, mouth: i === 0 ? 'smile' : 'flat', headTilt: 0.1 }
            where = u > 0.35 ? 'mug' : 'hand'
          } else if (u < 1.0) {
            where = 'mug'
            pose = { ...pose, mouth: i === 0 ? 'grin' : 'flat', eyes: i === 2 ? 'wide' : 'normal' }
          } else if (u < 1.5) {
            where = 'mug'
            rot = easeIn(seg(u, 1.0, 1.5)) * 1.5
            pose = { ...pose, mouth: 'flat', eyes: 'wide', headTilt: 0.12 }
          } else if (u < 1.9) {
            const f = seg(u, 1.5, 1.9)
            where = 'loose'
            loose = [22 + f * 2, lerp(-36, -2.5, f * f), 1.5 + f * 4]
            pose = { ...pose, mouth: 'o', eyes: 'wide', headTilt: 0.2 }
          } else {
            const dip = Math.sin(seg(u, 1.9, 2.6) * Math.PI)
            where = u < 2.25 ? 'loose' : 'hand'
            loose = [24, -2.5, 5.5]
            pose = { ...pose, crouch: dip * 0.95, lean: dip * 0.6, armB: 1.0 + dip * 0.3, elbowB: 0.1, mouth: 'frown', headTilt: 0.1 + cross * 0.05 }
          }
        }
        if (tl.on('think', t)) {
          const p = tl.p('think', t)
          pose = { ...pose, armB: 2.0, elbowB: 1.6, headTilt: -0.15, mouth: 'flat', eyes: p > 0.6 ? 'wide' : 'normal' }
          if (p > 0.6) says = '!'
        } else if (tl.on('fix', t)) {
          const p = tl.p('fix', t)
          pose = { ...pose, armB: fix === 'bottom' ? 1.0 : 1.35, elbowB: fix === 'bottom' ? 0.9 : 0.9 + Math.sin(p * 20) * 0.15, mouth: 'grin', headTilt: 0.1 }
          where = p > 0.4 ? (fix === 'bottom' ? 'under' : 'mug') : 'hand'
        } else if (tl.on('present', t)) {
          const up = easeOut(seg(tl.p('present', t), 0, 0.25))
          pose = { ...pose, armF: lerp(0.9, 2.5, up), elbowF: lerp(1.1, 0.2, up), armB: 0.5 + up * 0.4, elbowB: 1.4 * up, mouth: 'grin', eyes: up > 0.9 ? 'closed' : 'normal', lean: -0.06 * up }
        } else if (tl.on('out', t)) pose = { ...pose, mouth: 'grin' }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, look, pose, (an) => {
            if (where === 'hand') drawHandle(ctx, an.handB.x + 1, an.handB.y - 3.6, 0, hcol)
          })
          const mx = a.handF.x + 5
          const my = a.handF.y - 3
          if (where === 'under') drawHandle(ctx, mx + 3.6, my + 5.6, Math.PI / 2, hcol)
          if (where === 'mug') drawHandle(ctx, mx + 4.6, my - 3.6, rot, hcol)
          drawMug(ctx, mx, my, color)
          if (taped && where === 'mug') {
            // Sticking plaster. Structural.
            line(ctx, mx + 1.5, my - 5, mx + 9.5, my + 4, 2.2, C.white)
            line(ctx, mx + 1.5, my + 4, mx + 9.5, my - 5, 2.2, C.white)
            fillCirc(ctx, mx + 5.5, my - 0.5, 1.2, '#fecdd3')
          }
          fillCirc(ctx, a.handF.x + 1, a.handF.y, 2.7, look.skin)
          if (where === 'loose') drawHandle(ctx, loose[0], loose[1] - 3.6, loose[2], hcol)
        })
        if (says) say(s, x, -66, says, { color: C.amber })
      },
    })
  },
}

void CLAY_D
export const POTTERY_ACTS: ActDef[] = [wheel, kilnOpening, kilnFiring, glazing, bowlStack, mugHandle]
