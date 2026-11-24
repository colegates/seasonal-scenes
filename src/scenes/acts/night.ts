import { DOG, drawDog } from '../creatures'
import { C, TAU, alpha, at, clamp, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, star, type Ctx } from '../draw'
import { blinking, bubble, crossing, makeAct, zzz } from '../kit'
import { CAST, drawPerson, type Anchors, type Look } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Stage } from '../types'

// The late shift. The house is asleep and the screen may be the only light in
// the room, so nothing here is loud: muted colours, slow feet, no bursts, and
// nothing bright bigger than a lantern flame.

type Dir = 1 | -1
const past = (dir: number, x: number, target: number) => (dir > 0 ? x >= target : x <= target)
const tick = (t: number, dt: number, hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)

/** Speech bubbles and Zs are never mirrored, whichever way the speaker faces. */
function say(s: Stage, x: number, y: number, text: string) {
  at(s.ctx, x, y, s.u, 1, () => bubble(s.ctx, 0, 0, text, { size: 9, bg: alpha('#cbd5e1', 0.85) }))
}
function snore(s: Stage, x: number, y: number, t: number) {
  at(s.ctx, x, y, s.u, 1, () => zzz(s.ctx, 0, 0, t, '#9fb4d6'))
}

/** A soft pool of light. The one place a gradient earns its keep. */
function glow(ctx: Ctx, x: number, y: number, r: number, rgb: string, strength: number) {
  if (strength <= 0.01) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${rgb},${strength})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

// ─── Sheep ───────────────────────────────────────────────────────────────────

const WOOL = '#c9cfdd'
const SHEEP_FACE = '#8a8097'
const TIMBER = '#8a7058'

/** A woolly sheep, about 34 units long, feet at the origin, facing right. */
function drawSheep(ctx: Ctx, o: { run: number; stride: number; tilt?: number; eyes?: 'normal' | 'closed'; flop?: boolean; out?: boolean }) {
  const legs: [number, number][] = [[-9, 0], [-5, Math.PI], [6, 1], [10, Math.PI + 1]]
  legs.forEach(([lx, ph], i) => {
    const a = o.flop ? (i < 2 ? -0.1 : 0.1) : Math.sin(o.run + ph) * 0.55 * o.stride
    line(ctx, lx, -10, lx + Math.sin(a) * 10, -10 + Math.cos(a) * 10, 2.6, i % 2 ? shade(SHEEP_FACE, -0.22) : SHEEP_FACE)
  })
  fillCirc(ctx, -15.5, -16, 3.2, shade(WOOL, -0.14))
  const lumps: [number, number, number][] = [[-9, -15, 7], [-2, -18, 8], [6, -16.5, 7.5], [-5, -11.5, 7], [4, -11.5, 7], [11, -13.5, 5.6]]
  for (const [lx, ly, r] of lumps) fillCirc(ctx, lx, ly + 2, r, shade(WOOL, -0.2))
  for (const [lx, ly, r] of lumps) fillCirc(ctx, lx, ly, r, WOOL)
  ctx.lineWidth = 0.9
  ctx.lineCap = 'round'
  ctx.strokeStyle = shade(WOOL, -0.2)
  for (const [cx, cy] of [[-7, -15], [1, -18], [5, -11], [-3, -10]] as const) {
    ctx.beginPath()
    ctx.arc(cx, cy, 2.4, Math.PI * 0.1, Math.PI * 0.9)
    ctx.stroke()
  }
  ctx.save()
  ctx.translate(13, -18)
  ctx.rotate(o.tilt ?? 0)
  if (o.out) {
    // Turned to look at you.
    fillEll(ctx, -3.6, -0.5, 3.2, 1.5, shade(SHEEP_FACE, -0.18), -0.4)
    fillEll(ctx, 9.6, -0.5, 3.2, 1.5, shade(SHEEP_FACE, -0.18), 0.4)
    fillEll(ctx, 3, 2, 5.2, 6.4, SHEEP_FACE)
    fillCirc(ctx, 3, -4.4, 4.6, WOOL)
    for (const ex of [1, 5]) {
      fillCirc(ctx, ex, 1, 1.5, '#dfe4ee')
      fillCirc(ctx, ex, 1.2, 0.8, C.ink)
    }
    fillEll(ctx, 3, 5.6, 1.6, 0.9, shade(SHEEP_FACE, -0.35))
  } else {
    fillEll(ctx, 4, 2.5, 5, 6.2, SHEEP_FACE, -0.5)
    fillEll(ctx, -0.6, -0.6, 3.4, 1.6, shade(SHEEP_FACE, -0.18), 0.5)
    fillCirc(ctx, 0.6, -3.4, 4.6, WOOL)
    if (o.eyes === 'closed') line(ctx, 3.4, 0.8, 5.6, 1.3, 0.9, C.ink)
    else {
      fillCirc(ctx, 4.6, 0.6, 1.5, '#dfe4ee')
      fillCirc(ctx, 5, 0.7, 0.8, C.ink)
    }
    fillCirc(ctx, 7.4, 6.4, 0.8, shade(SHEEP_FACE, -0.35))
  }
  ctx.restore()
}

function drawFence(ctx: Ctx) {
  for (const px of [-14, 14]) {
    fillRR(ctx, px - 1.6, -17, 3.2, 17, 1, TIMBER)
    fillRR(ctx, px - 1.6, -17, 3.2, 2, 1, shade(TIMBER, 0.2))
  }
  for (const ry of [-14, -8]) {
    fillRR(ctx, -19, ry, 38, 2.6, 1.2, shade(TIMBER, 0.08))
    line(ctx, -15, ry + 2, 15, ry + 2, 0.6, shade(TIMBER, -0.25))
  }
  // A tuft of grass at each post.
  for (const px of [-14, 14]) for (let i = -1; i <= 1; i++) line(ctx, px + i * 2, 0, px + i * 3.4, -4 - (i === 0 ? 1.5 : 0), 1, '#5c8a5a')
}

// ─── Counting sheep ──────────────────────────────────────────────────────────
// They trot on one at a time and hop the fence. The last one has thought about
// it and would rather not: it either walks round the back, or gets halfway
// over and decides that will do for tonight.

const sheep: ActDef = {
  id: 'night.counting-sheep',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const n = 3 + Math.floor(rng() * 3)
    const nap = chance(rng, 0.5)
    const fenceX = stage.w * range(rng, 0.44, 0.56)
    const gap = 2.3
    const speed = 78
    const stopX = fenceX - dir * 32 * stage.u
    let show = 0
    let fading = false
    // The last sheep is the only one that needs to think.
    let lx = from
    let run = 0
    let pt = 0
    let phase: 'wait' | 'trot' | 'ponder' | 'round' | 'hop' | 'asleep' | 'off' = 'wait'
    const hopOf = (s: Stage, x: number) => {
      const d = (dir * (x - fenceX)) / s.u / 27
      return Math.abs(d) < 1 ? { lift: (1 - d * d) * 23, rot: d * 0.38 } : { lift: 0, rot: 0 }
    }
    return makeAct({
      update(s, dt, t) {
        pt += dt
        show = clamp(show + (fading ? -dt * 0.8 : dt * 1.2))
        if (phase === 'wait' && t > (n - 1) * gap) phase = 'trot'
        else if (phase === 'trot') {
          lx += dir * speed * s.u * dt
          run += dt * 13
          if (past(dir, lx, stopX)) {
            phase = 'ponder'
            pt = 0
          }
        } else if (phase === 'ponder' && pt > 2.6) {
          phase = nap ? 'hop' : 'round'
          pt = 0
        } else if (phase === 'round') {
          lx += dir * 38 * s.u * dt
          run += dt * 8
          if (dir * (lx - fenceX) > 40 * s.u) phase = 'off'
        } else if (phase === 'hop' && pt > 0.8) {
          phase = 'asleep'
          pt = 0
        } else if (phase === 'asleep' && pt > 4.6) fading = true
        else if (phase === 'off') {
          lx += dir * speed * s.u * dt
          run += dt * 13
          if (dir * (lx - fenceX) > 120 * s.u) fading = true
        }
        return !(fading && show <= 0 && (nap || past(dir, lx, to)))
      },
      draw(s, t) {
        const { ctx } = s
        const behind = phase === 'round' || phase === 'off'
        const last = () => {
          if (phase === 'wait') return
          const d = (dir * (lx - fenceX)) / s.u
          const back = behind ? easeInOut(clamp(1 - Math.abs(d) / 40)) : 0
          let lift = 0
          let px = lx
          if (phase === 'hop') {
            const p = seg(pt, 0, 0.8)
            px = lerp(stopX, fenceX, easeInOut(p))
            lift = Math.sin(p * Math.PI) * 14 + p * 9.5
          } else if (phase === 'asleep') {
            px = fenceX
            lift = 9.5
          }
          const look = phase === 'ponder' ? (pt < 1.1 ? 0.5 : 0) : 0
          at(ctx, px, s.ground - (lift + back * 5) * s.u, s.u * (1 - back * 0.07), dir, () => {
            if (lift < 1) groundShadow(ctx, 0, 15, 0.2)
            drawSheep(ctx, {
              run,
              stride: phase === 'ponder' ? 0 : phase === 'round' ? 0.55 : 0.9,
              tilt: phase === 'asleep' ? 0.55 : look,
              out: phase === 'ponder' && pt > 1.4,
              eyes: phase === 'asleep' ? 'closed' : 'normal',
              flop: phase === 'hop' || phase === 'asleep',
            })
          })
          if (phase === 'ponder' && pt > 1.5) say(s, px + dir * 16 * s.u, s.ground - 34 * s.u, '...')
          if (phase === 'asleep' && pt > 0.6 && !fading) snore(s, px + dir * 20 * s.u, s.ground - 34 * s.u, t)
        }
        ctx.globalAlpha = show
        if (behind) last()
        at(ctx, fenceX, s.ground, s.u, 1, () => drawFence(ctx))
        ctx.globalAlpha = 1
        for (let i = 0; i < n - 1; i++) {
          const age = t - i * gap
          if (age < 0) continue
          const x = from + dir * speed * s.u * age
          if (past(dir, x, to)) continue
          const h = hopOf(s, x)
          at(ctx, x, s.ground - h.lift * s.u, s.u, dir, () => {
            groundShadow(ctx, 0, 15 - h.lift * 0.25, 0.2)
            ctx.translate(0, -11)
            ctx.rotate(h.rot)
            ctx.translate(0, 11)
            drawSheep(ctx, { run: age * 13 + i, stride: h.lift > 0 ? 0.35 : 0.9 })
          })
        }
        if (!behind) {
          ctx.globalAlpha = nap ? show : 1
          last()
          ctx.globalAlpha = 1
        }
      },
    })
  },
}

// ─── The hedgehog ────────────────────────────────────────────────────────────

const SPINE = '#7d6452'
const HOG_FACE = '#dcc3a0'

/** A hedgehog about 26 units long. `ball` 1 is curled right up; `roll` spins it. */
function drawHedgehog(ctx: Ctx, o: { walk: number; stride: number; sniff?: number; ball?: number; roll?: number; dizzy?: boolean }) {
  const tip = '#ab927a'
  if ((o.ball ?? 0) > 0.5) {
    ctx.save()
    ctx.translate(0, -8.5)
    ctx.rotate(o.roll ?? 0)
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU
      fillPoly(ctx, [Math.cos(a - 0.2) * 7.6, Math.sin(a - 0.2) * 7.6, Math.cos(a) * 11.4, Math.sin(a) * 11.4, Math.cos(a + 0.2) * 7.6, Math.sin(a + 0.2) * 7.6], tip)
    }
    fillCirc(ctx, 0, 0, 8.5, SPINE)
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + 0.3
      line(ctx, Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * 5.6, Math.sin(a) * 5.6, 0.9, tip)
    }
    // Just the nose showing.
    fillEll(ctx, 6.6, 1.5, 2.6, 2, HOG_FACE)
    fillCirc(ctx, 8.4, 1.6, 1.1, '#4a3838')
    ctx.restore()
    return
  }
  const sn = o.sniff ?? 0
  for (const [fx, ph] of [[-6, 0], [-2, Math.PI], [5, 1], [9, Math.PI + 1]] as const) {
    fillEll(ctx, fx + Math.sin(o.walk + ph) * 1.6 * o.stride, -0.8 - Math.max(0, Math.cos(o.walk + ph)) * 1.2 * o.stride, 2.2, 1.3, shade(HOG_FACE, -0.3))
  }
  for (let k = 0; k < 11; k++) {
    const a = Math.PI * (1.02 + (k / 10) * 0.86)
    const cx = -1 + Math.cos(a) * 10.4
    const cy = -2 + Math.sin(a) * 11
    fillPoly(ctx, [cx - 1.8, cy + 1.2, -1 + Math.cos(a - 0.12) * 14, -2 + Math.sin(a - 0.12) * 14.6, cx + 1.8, cy + 1.6], tip)
  }
  ctx.beginPath()
  ctx.ellipse(-1, -2, 11, 11.5, 0, Math.PI, TAU)
  ctx.closePath()
  ctx.fillStyle = SPINE
  ctx.fill()
  for (const [mx, my] of [[-7, -7], [-3, -10], [2, -9], [-5, -4], [0, -5.5], [5, -5]] as const) line(ctx, mx, my, mx - 1.6, my - 2.2, 0.9, tip)
  fillEll(ctx, 0, -1.6, 9, 2, HOG_FACE)
  // Face: snout that lifts when it sniffs, a black nose, one bright eye.
  fillEll(ctx, 10, -4.6 - sn * 1.2, 6.6, 4.2, HOG_FACE, -0.12 - sn * 0.3)
  fillEll(ctx, 5.6, -8.6, 2, 2.4, shade(HOG_FACE, -0.22))
  fillCirc(ctx, 16, -4.4 - sn * 3, 1.5, '#4a3838')
  if (o.dizzy) {
    line(ctx, 8.6, -7.4, 10.6, -5.6, 0.8, C.ink)
    line(ctx, 10.6, -7.4, 8.6, -5.6, 0.8, C.ink)
  } else {
    fillCirc(ctx, 9.6, -6.4, 1.2, C.ink)
    fillCirc(ctx, 9.9, -6.8, 0.4, '#dfe4ee')
  }
  if (sn > 0.5) {
    ctx.lineWidth = 0.7
    ctx.strokeStyle = alpha('#cbd5e1', 0.6)
    for (let i = 0; i < 2; i++) {
      ctx.beginPath()
      ctx.arc(19 + i * 2.4, -7.5, 1.6 + i * 0.8, -0.9, 0.9)
      ctx.stroke()
    }
  }
}

// Snuffles a little way on, nose down, stopping to sniff the air. Then either
// it sneezes and potters home, or something gives it a start: it curls up,
// rolls back the way it came, and unrolls again somewhat giddy.

const hedgehog: ActDef = {
  id: 'night.hedgehog',
  weight: 2,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 24)
    const curls = chance(rng, 0.5)
    const spot = from + dir * (24 * stage.u + Math.min(stage.w * 0.4, 170 * stage.u) * range(rng, 0.8, 1))
    let x = from
    let walk = 0
    let pt = 0
    let roll = 0
    let phase: 'in' | 'find' | 'ball' | 'rolling' | 'giddy' | 'home' = 'in'
    return makeAct({
      update(s, dt, t) {
        pt += dt
        if (phase === 'in') {
          if (t % 2.7 < 1.9) {
            x += dir * 30 * s.u * dt
            walk += dt * 14
          }
          if (past(dir, x, spot)) {
            phase = 'find'
            pt = 0
          }
        } else if (phase === 'find' && pt > 2.2) {
          phase = curls ? 'ball' : 'home'
          pt = 0
        } else if (phase === 'ball' && pt > 1.1) {
          phase = 'rolling'
          pt = 0
        } else if (phase === 'rolling') {
          const v = 62 * Math.sin(seg(pt, 0, 1.5) * Math.PI) * s.u
          x -= dir * v * dt
          roll -= (v * dt) / (8.5 * s.u)
          if (pt > 1.5) {
            phase = 'giddy'
            pt = 0
          }
        } else if (phase === 'giddy' && pt > 2) {
          phase = 'home'
          pt = 0
        } else if (phase === 'home') {
          x -= dir * 38 * s.u * dt
          walk += dt * 16
          return !past(-dir, x, from)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const facing = (phase === 'home' ? -dir : dir) as Dir
        const paused = phase === 'in' && t % 2.7 >= 1.9
        const sneeze = phase === 'find' && !curls ? seg(pt, 1.5, 1.7) * (1 - seg(pt, 1.8, 2)) : 0
        at(ctx, x, s.ground, s.u, facing, () => {
          groundShadow(ctx, 0, 12, 0.2)
          const balled = phase === 'ball' || phase === 'rolling' || (phase === 'giddy' && pt < 0.5)
          if (phase === 'giddy' && !balled) ctx.rotate(Math.sin(pt * 6) * 0.09 * (1 - seg(pt, 0.5, 2)))
          ctx.translate(sneeze * -2, 0)
          drawHedgehog(ctx, {
            walk,
            stride: phase === 'in' && !paused ? 1 : phase === 'home' ? 1 : 0,
            sniff: paused || phase === 'find' ? 0.6 + Math.sin(t * 9) * 0.4 : 0,
            ball: balled ? 1 : 0,
            roll: roll * dir * facing,
            dizzy: phase === 'giddy',
          })
        })
        if (phase === 'find' && curls && pt > 1.5) say(s, x, s.ground - 22 * s.u, '!')
        if (phase === 'giddy' && pt > 0.5) say(s, x, s.ground - 22 * s.u, '@')
      },
    })
  },
}

// ─── The owl ─────────────────────────────────────────────────────────────────

interface OwlLook {
  body: string
  belly: string
  wing: string
}
const OWLS: OwlLook[] = [
  { body: '#a5845f', belly: '#d2bd9b', wing: '#86694a' },
  { body: '#8d96aa', belly: '#bfc6d3', wing: '#6f7890' },
]

/**
 * An owl seen from the front, feet at the origin. `spread` 0 is perched with
 * wings folded, 1 is gliding. `turn` swivels the head: 0 faces you, PI shows
 * the back of it.
 */
function drawOwl(ctx: Ctx, look: OwlLook, o: { spread: number; flap: number; turn?: number; shutL?: boolean; shutR?: boolean; glance?: number }) {
  const sp = o.spread
  if (sp > 0.05) {
    for (const side of [-1, 1]) {
      // Broad wings with a scalloped trailing edge.
      const tipX = side * (8 + sp * 27)
      const tipY = -19 + o.flap * 7 * sp
      const pts = [side * 6, -19, tipX, tipY - 3]
      for (let k = 0; k <= 4; k++) pts.push(tipX - side * k * sp * 6.2, tipY + 5 + (k % 2 ? 3 : 6) + k * 0.6)
      pts.push(side * 5, -7)
      fillPoly(ctx, pts, look.wing)
      line(ctx, side * 7, -17, tipX - side * 2, tipY, 1.4, shade(look.wing, 0.18))
    }
  }
  // Feet.
  for (const side of [-1, 1]) for (let k = -1; k <= 1; k++) line(ctx, side * 3.4, -1.4, side * 3.4 + k * 1.6, 0.6, 1, C.amber)
  fillEll(ctx, 0, -11, 8.6, 11, look.body)
  fillEll(ctx, 0, -9.5, 5.8, 8, look.belly)
  for (let r = 0; r < 3; r++) for (let k = -1; k <= 1; k++) line(ctx, k * 3 - 1, -12 + r * 3.4, k * 3, -11 + r * 3.4, 0.8, shade(look.belly, -0.25))
  if (sp < 0.6) {
    fillEll(ctx, -7.6, -10.5, 3.4, 8.6, look.wing, 0.12)
    fillEll(ctx, 7.6, -10.5, 3.4, 8.6, look.wing, -0.12)
  }
  // Head.
  const turn = o.turn ?? 0
  const cs = Math.cos(turn)
  fillPoly(ctx, [-7.6, -26, -8.6, -33, -3, -29.4], look.body)
  fillPoly(ctx, [7.6, -26, 8.6, -33, 3, -29.4], look.body)
  fillCirc(ctx, 0, -22.5, 8.8, look.body)
  if (cs <= 0.05) {
    for (const [mx, my] of [[-3, -25], [2, -26], [-1, -21], [4, -21.5], [-4.5, -20]] as const) line(ctx, mx, my, mx + 1.4, my + 1.4, 0.9, look.wing)
    return
  }
  ctx.save()
  ctx.translate(Math.sin(turn) * 6.5, -22.5)
  ctx.scale(Math.max(0.08, cs), 1)
  fillCirc(ctx, -3.7, 0, 4.5, look.belly)
  fillCirc(ctx, 3.7, 0, 4.5, look.belly)
  const eye = (ex: number, shut: boolean | undefined) => {
    if (shut) {
      line(ctx, ex - 2.2, 0.2, ex + 2.2, 0.2, 1.1, C.ink)
      return
    }
    fillCirc(ctx, ex, 0, 2.8, '#e2c25a')
    fillCirc(ctx, ex + (o.glance ?? 0) * 1.1, 0.2 + Math.abs(o.glance ?? 0) * 0.7, 1.5, C.ink)
  }
  eye(-3.7, o.shutL)
  eye(3.7, o.shutR)
  fillPoly(ctx, [-1.4, 2, 1.4, 2, 0, 5], C.amber)
  ctx.restore()
}

function drawMouse(ctx: Ctx, run: number, stride: number) {
  const col = '#a39486'
  poly(ctx, [-5, -2.4, -9, -1.2, -12, -3.4 + Math.sin(run) * 0.8 * stride], 0.8, '#c9a9a4')
  for (const [fx, ph] of [[-2.6, 0], [2.6, Math.PI]] as const) fillEll(ctx, fx + Math.sin(run + ph) * 1.4 * stride, -0.5, 1.4, 0.8, '#c9a9a4')
  fillEll(ctx, 0, -3.2, 5.4, 3.2, col)
  fillCirc(ctx, 4.6, -4, 2.6, col)
  fillCirc(ctx, 3.4, -6.6, 1.9, '#c9a9a4')
  fillCirc(ctx, 5.6, -4.6, 0.6, C.ink)
  fillCirc(ctx, 7.2, -3.6, 0.6, '#c9a9a4')
}

// Glides in without a sound, lands on a post, turns its head all the way
// round to check behind it, and winks one eye then the other. Some nights a
// mouse has been hiding at the foot of the post, and creeps away whenever the
// owl is facing the other way.

const owl: ActDef = {
  id: 'night.owl',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const look = pick(rng, OWLS)
    const mouse = chance(rng, 0.5)
    const postX = stage.w * range(rng, 0.35, 0.65)
    const POST = 36
    const high = 118
    const tIn = clamp(Math.abs(postX - from) / (150 * stage.u), 2.2, 4.5)
    const tOut = clamp(Math.abs(to - postX) / (150 * stage.u), 2.2, 4.5)
    // Landing, a look round, two winks, a pause, then off.
    const T = { swivel: tIn + 1, wink: tIn + 4.6, leave: tIn + 7.2 }
    let show = 0
    let mx = postX - dir * 7 * stage.u
    let mrun = 0
    let mspeed = 0
    const turnAt = (t: number) => easeInOut(seg(t, T.swivel, T.swivel + 3)) * TAU
    return makeAct({
      update(s, dt, t) {
        const done = t > T.leave + tOut
        if (mouse && t > T.swivel) {
          // Tiptoe while its back is turned, freeze when it looks, bolt once it has gone.
          const watching = t < T.leave && Math.cos(turnAt(t)) > 0.2
          mspeed = t > T.leave + 0.4 ? 120 : watching ? 0 : 30
          mx -= dir * mspeed * s.u * dt
          mrun += dt * mspeed * 0.4
        }
        const mouseGone = !mouse || past(-dir, mx, from)
        show = clamp(show + (done && mouseGone ? -dt : dt * 1.2))
        return !(done && mouseGone && show <= 0)
      },
      draw(s, t) {
        const { ctx } = s
        ctx.globalAlpha = show
        at(ctx, postX, s.ground, s.u, 1, () => {
          groundShadow(ctx, 0, 7, 0.2)
          fillRR(ctx, -3.6, -POST, 7.2, POST, 1.6, TIMBER)
          fillRR(ctx, -4.4, -POST, 8.8, 3, 1.4, shade(TIMBER, 0.18))
          line(ctx, -1, -POST + 8, -1.4, -6, 0.7, shade(TIMBER, -0.25))
          line(ctx, 1.6, -POST + 14, 1.4, -12, 0.7, shade(TIMBER, -0.25))
          for (let i = -1; i <= 1; i++) line(ctx, 5 + i * 1.5, 0, 5.5 + i * 3, -4, 1, '#5c8a5a')
        })
        ctx.globalAlpha = 1
        if (mouse && t > T.swivel) {
          at(ctx, mx, s.ground, s.u, (-dir) as Dir, () => drawMouse(ctx, mrun, mspeed > 0 ? 1 : 0))
        }
        // Where the owl is: gliding in, perched, or gliding away.
        let ox = postX
        let oy = POST
        let spread = 0
        let tilt = 0
        if (t < tIn) {
          const p = t / tIn
          ox = lerp(from, postX, easeOut(p))
          oy = lerp(high, POST, easeInOut(p)) + Math.sin(p * Math.PI) * -6
          spread = 1 - seg(p, 0.9, 1) * 0.3
          tilt = dir * 0.28 * (1 - p)
        } else if (t < T.leave) spread = 0.7 * (1 - easeOut(seg(t, tIn, tIn + 0.6))) + easeInOut(seg(t, T.leave - 0.4, T.leave)) * 0.8
        else {
          const p = seg(t, T.leave, T.leave + tOut)
          ox = lerp(postX, to, p * p * 0.6 + p * 0.4)
          oy = lerp(POST, high, easeInOut(p)) + Math.sin(p * Math.PI) * 5
          spread = 1
          tilt = dir * 0.28 * easeOut(seg(p, 0, 0.3))
          if (p >= 1) return
        }
        const perched = t >= tIn && t < T.leave
        const turn = perched ? turnAt(t) : 0
        const frozen = mouse && perched && t > T.swivel + 2.4 && Math.abs(mx - postX) < 90 * s.u
        at(ctx, ox, s.ground - oy * s.u, s.u, 1, () => {
          drawOwl(ctx, look, {
            spread,
            flap: perched ? 0 : Math.sin(t * 2.4),
            turn,
            shutL: perched && ((t > T.wink && t < T.wink + 0.7) || (t > tIn + 0.5 && blinking(t, 3) && turn === 0)),
            shutR: perched && ((t > T.wink + 1.1 && t < T.wink + 1.8) || (t > tIn + 0.5 && blinking(t, 3) && turn === 0)),
            glance: frozen ? -dir : 0,
          })
        }, tilt)
      },
    })
  },
}

// ─── The sleepwalker ─────────────────────────────────────────────────────────

const PYJAMAS: Look[] = [
  { ...CAST.dad, top: '#7fa3cf', hoops: '#bcd0ea', bottom: '#7fa3cf', shoe: '#b98aa0' },
  { ...CAST.kid, top: '#8fbf9f', hoops: '#c9e3d0', bottom: '#8fbf9f', shoe: '#c9a36a' },
  { ...CAST.mum, top: '#b59ad6', hoops: '#d9cbee', bottom: '#b59ad6', shoe: '#9fb4d6' },
]

/** A floppy nightcap with a pom on the end, drawn over a finished head. */
function drawNightcap(ctx: Ctx, a: Anchors, color: string, trim: string, sway: number) {
  const hx = a.head.x
  const hy = a.head.y
  ctx.beginPath()
  ctx.moveTo(hx - 11, hy - 4)
  ctx.quadraticCurveTo(hx - 10, hy - 15.5, hx + 1, hy - 14)
  ctx.quadraticCurveTo(hx + 10, hy - 12.5, hx + 11, hy - 5)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(hx - 3, hy - 13.6)
  ctx.quadraticCurveTo(hx - 17, hy - 17, hx - 19, hy - 3 + sway)
  ctx.lineTo(hx - 15, hy - 3 + sway)
  ctx.quadraticCurveTo(hx - 13, hy - 10, hx - 8, hy - 8)
  ctx.closePath()
  ctx.fill()
  fillRR(ctx, hx - 11.6, hy - 7, 23.4, 3.6, 1.8, trim)
  fillCirc(ctx, hx - 17, hy - 1 + sway, 3.1, trim)
}

function drawTeddy(ctx: Ctx, swing: number) {
  const fur = '#b08a62'
  ctx.save()
  ctx.rotate(swing)
  line(ctx, 0, 0, -0.5, 4, 2.2, fur)
  fillEll(ctx, -1, 8, 3.8, 4.6, fur)
  fillEll(ctx, -0.6, 8.6, 2.2, 2.8, '#d2b48c')
  line(ctx, -3, 6.5, -5.6, 9.5, 2.2, fur)
  line(ctx, -2.6, 11.6, -3.6, 15, 2.4, fur)
  line(ctx, 0.8, 11.6, 1, 15, 2.4, fur)
  fillCirc(ctx, -1.6, 2.4, 3.4, fur)
  fillCirc(ctx, -4.2, 0.2, 1.5, fur)
  fillCirc(ctx, 1, 0, 1.5, fur)
  fillCirc(ctx, -0.6, 3.2, 1.4, '#d2b48c')
  fillCirc(ctx, -2.6, 2, 0.5, C.ink)
  fillCirc(ctx, 0, 1.8, 0.5, C.ink)
  ctx.restore()
}

// Arms out, eyes shut, pyjamas, nightcap. With the dog on duty behind they get
// all the way across: when they drift to a stop it waits, then gives them a
// nudge. Without the dog they get half way, with a teddy, and turn back.

const sleepwalker: ActDef = {
  id: 'night.sleepwalker',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const look = pick(rng, PYJAMAS)
    const cap = pick(rng, ['#b0647a', '#5f8fb5', '#b89a4e'])
    const escort = chance(rng, 0.55)
    const stallX = escort ? stage.w * range(rng, 0.42, 0.58) : from + dir * (60 * stage.u + Math.min(stage.w * 0.45, 210 * stage.u))
    let x = from
    let dogX = from - dir * 30 * stage.u
    let walk = 0
    let run = 0
    let pt = 0
    let stalled = false
    let phase: 'walk' | 'stall' | 'back' = 'walk'
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'walk') {
          x += dir * 40 * s.u * dt
          walk += dt * 5.4
          if (!stalled && past(dir, x, stallX)) {
            stalled = true
            phase = 'stall'
            pt = 0
          }
        } else if (phase === 'stall') {
          if (pt > (escort ? 3.4 : 2.8)) {
            phase = escort ? 'walk' : 'back'
            pt = 0
          }
        } else {
          x -= dir * 40 * s.u * dt
          walk += dt * 5.4
        }
        if (escort) {
          // The dog keeps station just behind, and closes up for the nudge.
          const want = x - dir * (phase === 'stall' && pt > 2.6 ? 22 : 30) * s.u
          const step = clamp((want - dogX) * 4, -60 * s.u, 60 * s.u) * dt
          dogX += step
          run += Math.abs(step) * 0.42
          return !past(dir, dogX - dir * 30 * s.u, to)
        }
        return phase === 'back' ? !past(-dir, x, from) : true
      },
      draw(s, t) {
        const { ctx } = s
        const stall = phase === 'stall'
        const droop = stall ? easeInOut(seg(pt, 0, 0.8)) * (1 - easeOut(seg(pt, escort ? 2.9 : 2.4, escort ? 3.1 : 2.8))) : 0
        const facing = (phase === 'back' ? -dir : dir) as Dir
        if (escort) {
          at(ctx, dogX, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 14, 0.2)
            const sitting = stall && pt > 0.5 && pt < 2.4
            drawDog(ctx, DOG, { run, stride: sitting || (stall && pt < 2.6) ? 0 : 0.4, wag: t * 5, sitting, tilt: sitting ? Math.sin(pt * 2.2) * 0.22 : 0 })
          })
        }
        at(ctx, x, s.ground, s.u, facing, () => {
          groundShadow(ctx, 0, 11, 0.2)
          const a = drawPerson(ctx, look, {
            walk,
            stride: stall ? 0 : 0.34,
            armF: 1.5 - droop * 0.7,
            elbowF: 0.05,
            armB: escort ? 1.42 - droop * 0.7 : 0.12,
            elbowB: 0.05,
            lean: -0.05 + droop * 0.1 + Math.sin(t * 1.4) * 0.02,
            headTilt: droop * 0.3,
            eyes: 'closed',
            mouth: stall ? 'o' : 'flat',
          })
          drawNightcap(ctx, a, cap, '#d8dce8', Math.sin(walk * 1.2) * 1.4)
          if (!escort) {
            ctx.translate(a.handB.x, a.handB.y)
            drawTeddy(ctx, Math.sin(walk * 1.2) * 0.25)
          }
        })
        if (stall && pt > 0.7 && pt < (escort ? 2.9 : 2.4)) snore(s, x + facing * 10 * s.u, s.ground - 66 * s.u, t)
      },
    })
  },
}

// ─── The fox ─────────────────────────────────────────────────────────────────

const FOX = '#cf7a45'
const FOX_PALE = '#e6d6c2'
const FOX_SOCK = '#6f4a3c'

/** A fox about 46 units nose to tail tip. `out` turns its face to the viewer. */
function drawFox(ctx: Ctx, o: { run: number; stride: number; out?: boolean; shut?: boolean; wide?: boolean; ear?: number; tail?: number; slipper?: boolean }) {
  const sw = o.tail ?? Math.sin(o.run * 0.5) * 2
  // Brush.
  ctx.beginPath()
  ctx.moveTo(-11, -15)
  ctx.quadraticCurveTo(-22, -22 + sw, -32, -15 + sw)
  ctx.quadraticCurveTo(-24, -7 + sw, -12, -10)
  ctx.closePath()
  ctx.fillStyle = FOX
  ctx.fill()
  fillEll(ctx, -29, -14.6 + sw, 4, 3.4, FOX_PALE, 0.2)
  const legs: [number, number][] = [[-9, 0], [-6, Math.PI], [7, 0.8], [10, Math.PI + 0.8]]
  legs.forEach(([lx, ph], i) => {
    const a = Math.sin(o.run + ph) * 0.6 * o.stride
    const kx = lx + Math.sin(a) * 5.5
    const fx = kx + Math.sin(a * 0.4) * 5.5
    poly(ctx, [lx, -10, kx, -10 + Math.cos(a) * 5.5, fx, -Math.max(0, Math.sin(o.run + ph + 1.5)) * 2 * o.stride], 2.6, i % 2 ? shade(FOX_SOCK, -0.15) : FOX_SOCK)
  })
  fillEll(ctx, 0, -13, 14, 6.2, FOX)
  fillEll(ctx, 2, -10, 10, 3, FOX_PALE)
  fillEll(ctx, 11, -15, 5, 6, FOX, 0.5)
  const ear = o.ear ?? 0
  if (o.out) {
    // Full face: cheek ruffs, two eyes, a neat nose.
    fillPoly(ctx, [9.5, -24, 8.6 - ear, -32, 14, -27], FOX)
    fillPoly(ctx, [22.5, -24, 23.4, -32, 18, -27], FOX)
    fillPoly(ctx, [10.6, -26, 9.6 - ear, -30.6, 12.6, -27.4], FOX_SOCK)
    fillPoly(ctx, [21.4, -26, 22.4, -30.6, 19.4, -27.4], FOX_SOCK)
    fillCirc(ctx, 16, -20.5, 7, FOX)
    fillPoly(ctx, [8, -20, 11.5, -14, 16, -17], FOX_PALE)
    fillPoly(ctx, [24, -20, 20.5, -14, 16, -17], FOX_PALE)
    fillEll(ctx, 16, -16.4, 3.2, 2.8, FOX_PALE)
    fillEll(ctx, 16, -17, 1.4, 1, C.ink)
    for (const ex of [12.8, 19.2]) {
      if (o.shut) line(ctx, ex - 1.3, -21.4, ex + 1.3, -21.4, 0.9, C.ink)
      else {
        fillEll(ctx, ex, -21.5, 1.5, o.wide ? 2 : 1.6, '#e8c16a')
        fillEll(ctx, ex, -21.5, 0.6, 1.3, C.ink)
      }
    }
    if (o.slipper) drawSlipper(ctx, 16, -13.4)
    return
  }
  fillPoly(ctx, [13.6, -24, 13 - ear, -32.4, 18, -26], FOX)
  fillPoly(ctx, [14.6, -26, 14 - ear, -30.6, 16.6, -27], FOX_SOCK)
  fillCirc(ctx, 17, -20.5, 6.4, FOX)
  fillPoly(ctx, [19, -24.4, 29.6, -18.4, 19, -15], FOX)
  fillPoly(ctx, [15, -17, 29.4, -18.2, 19.6, -14.6], FOX_PALE)
  fillCirc(ctx, 29.4, -18.6, 1.3, C.ink)
  fillEll(ctx, 20, -21.4, 1.3, 1.5, C.ink)
  fillCirc(ctx, 20.4, -21.8, 0.4, '#dfe4ee')
  if (o.slipper) drawSlipper(ctx, 27.5, -16.4)
}

function drawSlipper(ctx: Ctx, x: number, y: number) {
  fillRR(ctx, x - 5, y, 11, 4.4, 2, '#b0647a')
  fillRR(ctx, x - 5, y + 3.2, 11, 1.6, 0.8, '#7d4658')
  fillRR(ctx, x - 5, y - 0.6, 5.4, 2.4, 1.2, '#d8c9a8')
  fillCirc(ctx, x + 3.6, y + 0.4, 1.4, '#d8c9a8')
}

// Trots through on business of its own, stops dead in the middle and looks
// straight at you for a long moment, then goes on its way. Occasionally it
// has somebody's slipper, and leaves rather faster.

const fox: ActDef = {
  id: 'night.fox',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const thief = chance(rng, 0.4)
    const stopX = stage.w * range(rng, 0.4, 0.6)
    let x = from
    let run = 0
    let pt = 0
    let phase: 'in' | 'stare' | 'out' = 'in'
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'stare') {
          if (pt > (thief ? 2.4 : 3.4)) {
            phase = 'out'
            pt = 0
          }
          return true
        }
        const v = phase === 'in' ? 76 * (1 - seg(dir * (x - stopX) / s.u, -30, 0) * 0.7) : (thief ? 120 : 70) * easeOut(seg(pt, 0, 0.6))
        x += dir * v * s.u * dt
        run += dt * v * 0.16
        if (phase === 'in' && past(dir, x, stopX)) {
          phase = 'stare'
          pt = 0
        }
        return !past(dir, x - dir * 20 * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        const stare = phase === 'stare'
        const out = stare && pt > 0.35 && pt < (thief ? 2.2 : 3.1)
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 16, 0.2)
          drawFox(ctx, {
            run,
            stride: stare ? 0 : phase === 'out' && thief ? 1 : 0.75,
            out,
            shut: out && !thief && ((pt > 1.3 && pt < 1.45) || (pt > 2.3 && pt < 2.45)),
            wide: thief,
            ear: stare && pt > 1.7 && pt < 2 ? 1.6 : 0,
            tail: stare ? Math.sin(t * 1.6) * 2.5 : undefined,
            slipper: thief,
          })
        })
      },
    })
  },
}

// ─── The shooting star ───────────────────────────────────────────────────────

const GOWNS: Look[] = [
  { ...CAST.grandad, top: '#7c6aa8', bottom: '#6b7fa3', shoe: '#8a6a52', hat: 'none', scarf: '#5a4d80' },
  { ...CAST.mum, top: '#5f9a94', bottom: '#8c9cc0', shoe: '#b98aa0', scarf: '#467a75' },
  { ...CAST.girl, top: '#9aa9d6', hoops: '#c5cfea', bottom: '#9aa9d6', shoe: '#c9a36a' },
]

// Somebody comes out to look at the sky and picks a direction. The star goes
// the other way, behind them. They turn round just after it has gone. Some
// nights the sky does it to them twice.

const shootingStar: ActDef = {
  id: 'night.shooting-star',
  weight: 2,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 40)
    const look = pick(rng, GOWNS)
    const twice = chance(rng, 0.5)
    const spot = from + dir * (40 * stage.u + Math.min(stage.w * 0.42, 210 * stage.u))
    const skyY = Math.max(22, stage.h * range(rng, 0.1, 0.2))
    let x = from
    let walk = 0
    let pt = 0
    let facing: Dir = dir
    let phase: 'in' | 'gaze' | 'late' | 'again' | 'out' = 'in'
    // The star: which side of the watcher it is on, and how far along (0..1).
    let starSide: Dir = dir
    let sp = -1
    const fire = (side: Dir) => {
      starSide = side
      sp = 0
    }
    const starAt = (s: Stage, p: number): [number, number] => [spot + starSide * (26 + p * 130) * s.u, skyY + p * 44 * s.u]
    return makeAct({
      update(s, dt, t) {
        pt += dt
        if (sp >= 0) {
          sp += dt / 0.85
          if (sp < 1 && tick(t, dt, 6)) {
            const [px, py] = starAt(s, sp)
            s.particles.emit({ kind: 'star', x: px, y: py, vx: starSide * 14 * s.u, vy: 8 * s.u, g: 14, size: range(rng, 1.6, 2.6) * s.u, color: pick(rng, ['#f3e7b0', '#dfe9f7']), life: 1.1 })
          }
          if (sp >= 1.2) sp = -1
        }
        if (phase === 'in') {
          x += dir * 46 * s.u * dt
          walk += dt * 7.4
          if (past(dir, x, spot)) {
            phase = 'gaze'
            pt = 0
          }
        } else if (phase === 'gaze') {
          if (pt >= 1.4 && pt - dt < 1.4) fire((-dir) as Dir)
          if (pt > 2.5) {
            phase = 'late'
            facing = (-dir) as Dir
            pt = 0
          }
        } else if (phase === 'late') {
          if (twice && pt >= 1.5 && pt - dt < 1.5) fire(dir)
          if (pt > 2.7) {
            phase = twice ? 'again' : 'out'
            facing = twice ? dir : ((-dir) as Dir)
            pt = 0
          }
        } else if (phase === 'again') {
          if (pt > 2.6) {
            phase = 'out'
            facing = (-dir) as Dir
            pt = 0
          }
        } else {
          x -= dir * 40 * s.u * dt
          walk += dt * 6.4
          return !past(-dir, x, from)
        }
        return true
      },
      draw(s) {
        const { ctx } = s
        if (sp >= 0 && sp < 1.15) {
          // A short bright streak that thins to nothing behind the head.
          const p = Math.min(1, sp)
          const fade = 1 - seg(sp, 0.85, 1.15)
          const [hx, hy] = starAt(s, p)
          for (let k = 0; k < 9; k++) {
            const [ax, ay] = starAt(s, Math.max(0, p - k * 0.03))
            const [bx, by] = starAt(s, Math.max(0, p - (k + 1) * 0.03))
            ctx.globalAlpha = fade * (1 - k / 9) * 0.9
            line(ctx, ax, ay, bx, by, (3.4 - k * 0.32) * s.u, '#f3e7b0')
          }
          // A soft halo, then a small four-point twinkle for the head.
          ctx.globalAlpha = fade * 0.25
          fillCirc(ctx, hx, hy, 6 * s.u, '#fdf6d8')
          ctx.globalAlpha = fade
          star(ctx, hx, hy, 5 * s.u, '#fffbe8', sp * 2, 0.32)
          fillCirc(ctx, hx, hy, 2.2 * s.u, '#ffffff')
          ctx.globalAlpha = 1
        }
        const gazing = phase === 'gaze' || (phase === 'late' && pt < 1.9) || (phase === 'again' && pt < 1.4)
        const fedUp = (phase === 'again' && pt >= 1.4) || (phase === 'late' && pt >= 1.9) || (phase === 'out' && twice)
        at(ctx, x, s.ground, s.u, facing, () => {
          groundShadow(ctx, 0, 11, 0.2)
          const shrug = phase === 'late' && pt >= 1.9 && !twice
          drawPerson(ctx, look, {
            walk,
            stride: phase === 'in' || phase === 'out' ? 0.6 : 0,
            armF: gazing ? 2.5 : shrug ? 1.1 : undefined,
            elbowF: gazing ? 1.5 : shrug ? 0.9 : undefined,
            armB: shrug ? -1.1 : undefined,
            elbowB: shrug ? -0.9 : undefined,
            headTilt: gazing ? -0.34 : fedUp ? 0.16 : 0,
            lean: gazing ? -0.06 : fedUp && phase !== 'late' ? 0.1 : 0,
            mouth: gazing ? 'smile' : fedUp ? 'frown' : 'flat',
            eyes: phase === 'late' && pt < 0.5 ? 'wide' : 'normal',
            blink: blinking(s.time, 7),
          })
        })
        if ((phase === 'late' && pt > 0.6 && pt < 1.9) || (phase === 'again' && pt > 0.5 && pt < 1.4)) say(s, x, s.ground - 70 * s.u, '?')
      },
    })
  },
}

// ─── The lantern ─────────────────────────────────────────────────────────────

/** A small storm lantern hanging from the origin. `lit` 0..1. */
function drawLantern(ctx: Ctx, lit: number, t: number) {
  glow(ctx, 0, 8, 30, '255,190,110', 0.34 * lit)
  ctx.beginPath()
  ctx.arc(0, 2, 2.6, Math.PI, TAU)
  ctx.lineWidth = 0.9
  ctx.strokeStyle = '#a58d5c'
  ctx.stroke()
  fillRR(ctx, -3.4, 2, 6.8, 2.2, 1, '#a58d5c')
  fillRR(ctx, -3, 4, 6, 8, 1.4, lit > 0.1 ? alpha('#ffd591', 0.35 + lit * 0.5) : '#51607c')
  if (lit > 0.1) fillEll(ctx, 0, 9 - Math.abs(Math.sin(t * 7)) * 0.6, 1.3 * lit, 2.4 * lit, '#ffe9b8')
  line(ctx, -3, 4.4, -3, 11.6, 0.8, '#a58d5c')
  line(ctx, 3, 4.4, 3, 11.6, 0.8, '#a58d5c')
  fillRR(ctx, -3.8, 11.6, 7.6, 2, 0.9, '#a58d5c')
}

function drawMoth(ctx: Ctx, flap: number) {
  const w = Math.abs(Math.sin(flap))
  fillPoly(ctx, [0, 0, -3.4, -3.4 * w - 0.6, -2.6, 1.2], '#cbbfa8')
  fillPoly(ctx, [0, 0, 3.4, -3.4 * w - 0.6, 2.6, 1.2], '#b8ab93')
  fillEll(ctx, 0, 0.2, 0.8, 1.6, '#8f8573')
}

// A very small person with a lantern, on their way to bed and yawning about
// it. Some nights the moths have found the light. Some nights the yawn blows
// it out, and it takes a shake to get it going again.

const lantern: ActDef = {
  id: 'night.lantern',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const moths = chance(rng, 0.5)
    const look: Look = pick(rng, [
      { skin: C.skinA, top: '#6f8fb5', bottom: '#56648a', shoe: '#8a6a52', hair: '#7a5a3a', hat: 'bobble', hatColor: '#b0647a', hatTrim: '#d8dce8', scarf: '#b89a4e' },
      { skin: C.skinB, top: '#8a7fb5', bottom: '#56648a', shoe: '#8a6a52', hair: '#3a2a1f', hat: 'flatcap', hatColor: '#7d8a6a', scarf: '#b0647a' },
    ] as Look[])
    const SC = 0.74
    const yawnX = stage.w * range(rng, 0.4, 0.6)
    let x = from
    let walk = 0
    let pt = 0
    let yawned = false
    let lit = 1
    let phase: 'walk' | 'yawn' = 'walk'
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'walk') {
          x += dir * 42 * s.u * dt
          walk += dt * 8.6
          if (!yawned && past(dir, x, yawnX)) {
            yawned = true
            phase = 'yawn'
            pt = 0
          }
        } else {
          if (!moths) lit = pt < 1.2 ? 1 : pt < 3 ? 0.06 : Math.min(1, lit + dt * 4)
          if (pt > (moths ? 2.6 : 3.9)) phase = 'walk'
        }
        return !past(dir, x - dir * 20 * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        const yawn = phase === 'yawn' ? easeInOut(seg(pt, 0, 0.5)) * (1 - easeInOut(seg(pt, 1.4, 1.9))) : 0
        const shaking = phase === 'yawn' && !moths && pt > 2.2 && pt < 3
        let lx = 0
        let ly = 0
        at(ctx, x, s.ground, s.u * SC, dir, () => {
          groundShadow(ctx, 0, 11, 0.2)
          const a = drawPerson(ctx, look, {
            walk,
            stride: phase === 'walk' ? 0.55 : 0,
            armF: 1.0 + (shaking ? Math.sin(t * 26) * 0.14 : 0),
            elbowF: 0.5,
            armB: yawn > 0.05 ? yawn * 2.5 : undefined,
            elbowB: yawn > 0.05 ? yawn * 1.9 : undefined,
            lean: -yawn * 0.1,
            headTilt: -yawn * 0.2,
            mouth: yawn > 0.3 ? 'o' : shaking ? 'flat' : 'smile',
            eyes: yawn > 0.3 ? 'closed' : phase === 'yawn' && !moths && pt > 1.9 ? 'wide' : 'normal',
            blink: blinking(s.time, 9),
          })
          lx = a.handF.x
          ly = a.handF.y
          ctx.translate(lx, ly)
          ctx.rotate(Math.sin(walk) * 0.12 + (shaking ? Math.sin(t * 26) * 0.3 : 0))
          drawLantern(ctx, lit, t)
        })
        if (moths) {
          // Two or three moths, forever nearly landing on it.
          const cx = x + dir * lx * SC * s.u
          const cy = s.ground + (ly + 8) * SC * s.u
          for (let i = 0; i < 3; i++) {
            const a = t * (2.1 + i * 0.6) + i * 2.1
            at(ctx, cx + Math.cos(a) * (11 + i * 3) * s.u, cy + Math.sin(a * 1.3) * (7 + i * 2) * s.u - 3 * s.u, s.u, 1, () => drawMoth(ctx, t * 22 + i))
          }
        }
      },
    })
  },
}

// ─── The cat ─────────────────────────────────────────────────────────────────

interface CatLook {
  coat: string
  bib?: string
  stripe?: string
}
const CATS: CatLook[] = [
  { coat: '#8f97a8', stripe: '#6f7789' },
  { coat: '#c98a52', stripe: '#a86d3c', bib: '#e6d6c2' },
  { coat: '#5d6880', bib: '#d8dce8' },
]

function catHead(ctx: Ctx, look: CatLook, x: number, y: number, rot: number, eyes: 'normal' | 'closed' | 'wide') {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  fillPoly(ctx, [-4.6, -3, -4.4, -9, -0.6, -4.6], look.coat)
  fillPoly(ctx, [0.6, -4.8, 3.8, -9.4, 5, -3], look.coat)
  fillPoly(ctx, [1.6, -5, 3.6, -8, 4.2, -4], '#c9a9a4')
  fillCirc(ctx, 0, 0, 5.6, look.coat)
  if (look.bib) fillEll(ctx, 3, 2.4, 3, 2.2, look.bib)
  if (look.stripe) for (let i = -1; i <= 1; i++) line(ctx, -1 + i * 1.8, -5, -1 + i * 1.8, -3, 0.8, look.stripe)
  if (eyes === 'closed') line(ctx, 1.2, -0.8, 3.8, -0.4, 0.9, C.ink)
  else {
    fillEll(ctx, 2.6, -0.8, eyes === 'wide' ? 1.9 : 1.5, eyes === 'wide' ? 2.1 : 1.6, '#c9d37a')
    fillEll(ctx, 2.9, -0.8, eyes === 'wide' ? 1.1 : 0.5, 1.4, C.ink)
  }
  fillCirc(ctx, 5.6, 1, 0.8, '#c9a9a4')
  line(ctx, 4.6, 1.6, 9, 0.8, 0.4, alpha('#dfe4ee', 0.7))
  line(ctx, 4.6, 2.2, 9, 3, 0.4, alpha('#dfe4ee', 0.7))
  ctx.restore()
}

/** A cat, feet at the origin, facing right. Prowling, stretching, or sat washing. */
function drawCat(ctx: Ctx, look: CatLook, o: { pose: 'walk' | 'stretch' | 'sit'; walk: number; stride: number; t: number; eyes?: 'normal' | 'closed' | 'wide'; bat?: number }) {
  const dark = shade(look.coat, -0.2)
  const tailTo = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(x1, y1, x2, y2)
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.strokeStyle = look.coat
    ctx.stroke()
  }
  if (o.pose === 'sit') {
    const sw = Math.sin(o.t * 1.5) * 2
    tailTo(-7, -2, -17, 1, -17, -6 + sw)
    fillEll(ctx, -4, -4.6, 7.4, 4.8, look.coat)
    fillEll(ctx, -1, -11, 6, 9.4, look.coat, 0.18)
    if (look.bib) fillEll(ctx, 2.4, -11, 2.8, 5, look.bib, 0.18)
    line(ctx, 2, -8, 3, -0.8, 2.6, dark)
    fillEll(ctx, 4, -0.8, 2.4, 1.3, look.bib ?? dark)
    const bat = o.bat ?? 0
    const lick = bat > 0 ? 0 : Math.sin(o.t * 6) * 1.2
    // The paw being washed, or swiped at a passing moth.
    const px = 8.4 + bat * 5
    const py = -17.5 + lick - bat * 8
    poly(ctx, [3.4, -13, 7, -12 - bat * 3, px, py], 2.6, look.coat)
    fillCirc(ctx, px, py, 1.9, look.bib ?? look.coat)
    catHead(ctx, look, 4.4, -22.4, bat > 0 ? -0.3 : 0.32 + lick * 0.03, o.eyes ?? 'closed')
    if (bat <= 0 && Math.sin(o.t * 6) > 0.2) fillEll(ctx, 8.6, -19.4, 0.9, 1.3, '#d9909a')
    return
  }
  if (o.pose === 'stretch') {
    // Front end down, back end up, toes spread.
    tailTo(-11, -17, -18, -24, -13, -30)
    line(ctx, -9, -13, -10, -0.8, 2.6, dark)
    line(ctx, -6, -13, -6, -0.8, 2.6, look.coat)
    fillEll(ctx, 0, -11, 13.5, 5, look.coat, 0.42)
    if (look.stripe) for (let i = 0; i < 4; i++) line(ctx, -8 + i * 4, -17.5 + i * 2, -7.4 + i * 4, -14.5 + i * 2, 1, look.stripe)
    line(ctx, 9, -5, 20, -1, 2.6, dark)
    line(ctx, 9, -4, 22, -0.8, 2.6, look.coat)
    for (let i = -1; i <= 1; i++) line(ctx, 22, -0.8, 24, -0.8 + i * 1.2, 0.7, look.bib ?? look.coat)
    catHead(ctx, look, 15, -7.6, 0.25, 'closed')
    return
  }
  // Prowling: long and low, tail carried in a hook.
  tailTo(-12, -11, -21, -12, -22, -21 + Math.sin(o.t * 2) * 2)
  const legs: [number, number][] = [[-9, 0], [-6, Math.PI], [7, 0.8], [10, Math.PI + 0.8]]
  legs.forEach(([lx, ph], i) => {
    const a = Math.sin(o.walk + ph) * 0.55 * o.stride
    const kx = lx + Math.sin(a) * 4.4
    poly(ctx, [lx, -8.6, kx, -8.6 + Math.cos(a) * 4.4, kx + Math.sin(a * 0.3) * 4.4, -Math.max(0, Math.sin(o.walk + ph + 1.5)) * 1.6 * o.stride], 2.6, i % 2 ? dark : look.coat)
  })
  fillEll(ctx, 0, -10, 13, 5, look.coat)
  if (look.stripe) for (let i = 0; i < 4; i++) line(ctx, -7 + i * 4, -14.4, -6.6 + i * 4, -11.4, 1, look.stripe)
  if (look.bib) fillEll(ctx, 9.5, -8.6, 3.4, 3, look.bib)
  catHead(ctx, look, 14.6, -13 + Math.sin(o.walk * 2) * 0.4, 0.12, o.eyes ?? 'normal')
}

// On the prowl, low and purposeful, until it reaches the exact middle of
// nowhere. There it has a long stretch, sits down, and washes a paw. If a moth
// comes by it takes one dignified swipe, misses, and carries on as though it
// had not.

const cat: ActDef = {
  id: 'night.cat',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const look = pick(rng, CATS)
    const moth = chance(rng, 0.5)
    const spot = from + dir * (40 * stage.u + Math.min(stage.w * 0.42, 200 * stage.u) * range(rng, 0.8, 1))
    const wash = moth ? 5.4 : 3.6
    let x = from
    let walk = 0
    let pt = 0
    let phase: 'in' | 'stretch' | 'wash' | 'out' = 'in'
    /** The moth, once it turns up: a slow pass in front of the cat's nose, then away. */
    const mothAt = (s: Stage): [number, number] | null => {
      if (!moth || phase !== 'wash' || pt < 1.4) return null
      const p = pt - 1.4
      const away = seg(p, 2.3, 3.6)
      return [x + dir * (lerp(46, 13, easeInOut(seg(p, 0, 1.8))) + Math.sin(p * 5) * 3 + away * 30) * s.u, s.ground - (27 + Math.sin(p * 7) * 4 + away * away * 80) * s.u]
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'in') {
          x += dir * 42 * s.u * dt
          walk += dt * 9
          if (past(dir, x, spot)) {
            phase = 'stretch'
            pt = 0
          }
        } else if (phase === 'stretch' && pt > 2) {
          phase = 'wash'
          pt = 0
        } else if (phase === 'wash' && pt > wash) {
          phase = 'out'
          pt = 0
        } else if (phase === 'out') {
          x += dir * 56 * s.u * dt
          walk += dt * 11
        }
        return !past(dir, x - dir * 25 * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        const m = mothAt(s)
        const p = pt - 1.4
        const watching = m !== null && p > 0.5 && p < 3.2
        const bat = m !== null ? Math.sin(seg(p, 2, 2.5) * Math.PI) : 0
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 13, 0.2)
          drawCat(ctx, look, {
            pose: phase === 'stretch' ? 'stretch' : phase === 'wash' ? 'sit' : 'walk',
            walk,
            stride: 0.8,
            t,
            eyes: phase === 'wash' ? (watching ? 'wide' : 'closed') : blinking(t, 4) ? 'closed' : 'normal',
            bat: watching ? Math.max(0.001, bat) : 0,
          })
        })
        if (m) at(ctx, m[0], m[1], s.u, 1, () => drawMoth(ctx, t * 22))
      },
    })
  },
}

// ─── Fireflies ───────────────────────────────────────────────────────────────
// Summer nights only. Two of them drift across at head height, blinking out
// of step. In the middle they either find each other's rhythm and dance a few
// turns, or one goes dark and the other has to come back for it.

const fireflies: ActDef = {
  id: 'night.fireflies',
  weight: 2,
  when: (c) => c.season === 'summer' || c.season === 'spring',
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 20)
    const dims = chance(rng, 0.5)
    const height = range(rng, 52, 66)
    const mid = stage.w * range(rng, 0.42, 0.58)
    let x = from
    let pt = -1
    let lag = 0
    return makeAct({
      update(s, dt) {
        if (pt < 0 && past(dir, x, mid)) pt = 0
        if (pt >= 0) pt += dt
        const busy = pt >= 0 && pt < (dims ? 4.2 : 3.4)
        if (!busy) x += dir * 42 * s.u * dt
        // The second one falls behind when its light fails, and is fetched.
        if (dims && pt >= 0) lag = pt < 1.2 ? Math.min(34, lag + 42 * dt) : pt > 3.2 ? Math.max(0, lag - 30 * dt) : lag
        return !past(dir, x - dir * 40 * s.u, to)
      },
      draw(s, t) {
        const { ctx } = s
        const dance = !dims && pt >= 0 ? easeInOut(seg(pt, 0, 0.6)) * (1 - easeInOut(seg(pt, 2.8, 3.4))) : 0
        const fetch = dims && pt >= 0 ? easeInOut(seg(pt, 1.2, 2)) * (1 - easeInOut(seg(pt, 3.2, 4))) : 0
        const dark = dims && pt > 0.3 && pt < 2.8
        const fly = (i: number) => {
          const ph = i * 2.4
          let fx = x - dir * i * 22 * s.u + Math.sin(t * 0.7 + ph) * 5 * s.u
          let fy = s.ground - (height + Math.sin(t * 0.9 + ph) * 7 + Math.sin(t * 2.3 + ph) * 2.5) * s.u
          if (dance > 0) {
            const a = t * 3 + i * Math.PI
            fx = lerp(fx, x - dir * 11 * s.u + Math.cos(a) * 10 * s.u, dance)
            fy = lerp(fy, s.ground - height * s.u + Math.sin(a) * 8 * s.u, dance)
          }
          if (i === 1) fx -= dir * lag * s.u
          if (i === 0 && fetch > 0) {
            // Back to circle the one that has gone out.
            const a = t * 4
            fx = lerp(fx, x - dir * (22 + lag) * s.u + Math.cos(a) * 8 * s.u, fetch)
            fy = lerp(fy, s.ground - height * s.u + Math.sin(a) * 6 * s.u, fetch)
          }
          const beat = dance > 0.5 || (dims && pt > 2.8 && pt < 5) ? t * 2.6 : t * (2.2 + i * 0.5) + ph
          let pulse = 0.22 + 0.78 * Math.pow(Math.max(0, Math.sin(beat)), 2)
          if (i === 1 && dark) pulse = pt > 2.2 ? (Math.sin(t * 30) > 0.4 ? 0.5 : 0.03) : 0.03
          glow(ctx, fx, fy, 8 * s.u, '200,235,120', 0.5 * pulse)
          fillCirc(ctx, fx, fy, 1.5 * s.u, alpha('#e3f4a6', 0.25 + 0.75 * pulse))
          fillCirc(ctx, fx - dir * 1.6 * s.u, fy - 0.6 * s.u, 0.9 * s.u, '#6b7566')
        }
        fly(1)
        fly(0)
      },
    })
  },
}

export const NIGHT_ACTS: ActDef[] = [sheep, hedgehog, owl, sleepwalker, fox, shootingStar, lantern, cat, fireflies]
