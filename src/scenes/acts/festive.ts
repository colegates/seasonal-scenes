import { DOG, drawDog } from '../creatures'
import { C, TAU, at, clamp, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, heart, lerp, line, poly, seg, shade, type Ctx } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines, zzz } from '../kit'
import { CAST, drawPerson, type Look, type Pose, type Pt } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Stage } from '../types'

// The three small spring holidays: Easter, Valentine's Day and Pancake Day.
// Each only owns a day or a weekend, so the casts are short, but every act
// still has its two ways of going wrong.

type Dir = 1 | -1

const passed = (x: number, target: number, dir: number) => (dir === 1 ? x >= target : x <= target)
/** True on the frames where a clock running at `hz` ticks over. */
const tick = (t: number, dt: number, hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
/** x at fraction `f` of the way across, measured from the side the act came in. */
const along = (s: Stage, dir: number, f: number) => (dir === 1 ? s.w * f : s.w * (1 - f))
/** Wide screens get a brisker walk, so a crossing never drags. */
const pace = (s: Stage) => clamp(s.w / (1000 * s.u), 1, 1.5)

const SPARKLE = [C.gold, C.yellow, C.white, '#fde68a']
const HEARTS = [C.rose, C.pink, '#ff6b81', C.red]

// ═══ Easter ══════════════════════════════════════════════════════════════════

const EGG_COLS: [string, string][] = [
  [C.pink, C.white], [C.sky, C.yellow], [C.yellow, C.rose], [C.mint, C.purple], [C.purple, C.yellow], [C.orange, C.white],
]

/** An egg standing on y. `pat`: 0 band, 1 spots, 2 zigzag, anything else plain. */
function drawEgg(ctx: Ctx, x: number, y: number, r: number, a: string, b: string, pat: number, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.translate(0, -r)
  fillEll(ctx, 0, 0, r * 0.78, r, a)
  if (pat === 0) {
    fillRR(ctx, -r * 0.74, -r * 0.2, r * 1.48, r * 0.4, 0, b)
    line(ctx, -r * 0.55, r * 0.5, r * 0.55, r * 0.5, r * 0.12, b)
  } else if (pat === 1) {
    fillCirc(ctx, -r * 0.3, -r * 0.3, r * 0.17, b)
    fillCirc(ctx, r * 0.32, 0, r * 0.19, b)
    fillCirc(ctx, -r * 0.2, r * 0.42, r * 0.17, b)
    fillCirc(ctx, r * 0.1, -r * 0.62, r * 0.12, b)
  } else if (pat === 2) {
    poly(ctx, [-r * 0.66, r * 0.12, -r * 0.33, -r * 0.2, 0, r * 0.12, r * 0.33, -r * 0.2, r * 0.66, r * 0.12], r * 0.16, b)
  }
  fillEll(ctx, -r * 0.3, -r * 0.45, r * 0.15, r * 0.26, 'rgba(255,255,255,0.55)', 0.4)
  ctx.restore()
}

/** A wicker basket hanging from (x, y), showing up to three eggs. */
function drawBasket(ctx: Ctx, x: number, y: number, eggs: number) {
  ctx.beginPath()
  ctx.arc(x, y + 4, 6, Math.PI, TAU)
  ctx.lineWidth = 1.3
  ctx.strokeStyle = C.wood
  ctx.stroke()
  for (let i = 0; i < Math.min(3, eggs); i++) fillEll(ctx, x - 3.2 + i * 3.2, y + 3.6, 1.9, 2.5, EGG_COLS[i][0])
  fillPoly(ctx, [x - 6.6, y + 4, x + 6.6, y + 4, x + 5, y + 10.5, x - 5, y + 10.5], C.tan)
  line(ctx, x - 6, y + 6.2, x + 6, y + 6.2, 0.8, C.wood)
  line(ctx, x - 5.4, y + 8.4, x + 5.4, y + 8.4, 0.8, C.wood)
  for (let i = -1; i <= 1; i++) line(ctx, x + i * 3, y + 4.4, x + i * 2.6, y + 10, 0.7, C.wood)
}

/** The Easter bunny, about 40 units to the ear tips. `hop` is 0..1 through one bound. Returns the front paw. */
function drawBunny(ctx: Ctx, hop: number): Pt {
  const st = Math.sin(hop * Math.PI)
  const lift = st * 9
  const fur = '#f1e9dc'
  ctx.save()
  ctx.translate(0, -lift)
  fillCirc(ctx, -11, -9.5, 3.6, C.white)
  fillEll(ctx, -5 - st * 5, -2.2 - st * 1.5, 7, 2.5, shade(fur, -0.14), st * 0.6)
  fillEll(ctx, 0, -11, 11, 8.4, fur, -0.15 - st * 0.18)
  fillEll(ctx, -5, -9, 6.6, 6.4, shade(fur, -0.07))
  line(ctx, 6, -9, 9.5 + st * 4, -2.4 - st * 3, 2.8, fur)
  // Ears lie back in the air.
  fillEll(ctx, 9.6, -32, 2.3, 7.4, shade(fur, -0.12), 0.1 - st * 0.5)
  fillCirc(ctx, 10, -20, 6.4, fur)
  ctx.save()
  ctx.translate(7.5, -25)
  ctx.rotate(-0.2 - st * 0.55)
  fillEll(ctx, 0, -7, 2.6, 7.8, fur)
  fillEll(ctx, 0.2, -7, 1.2, 5.6, C.pink)
  ctx.restore()
  fillCirc(ctx, 13.4, -18.4, 2.8, C.white)
  fillCirc(ctx, 16, -20, 1.1, C.rose)
  fillCirc(ctx, 11.6, -21.8, 1.3, C.ink)
  fillCirc(ctx, 12, -22.2, 0.45, C.white)
  line(ctx, 14.5, -18.4, 19, -19.4, 0.5, C.white)
  line(ctx, 14.5, -17.6, 19, -16.8, 0.5, C.white)
  // A bow tie: he is working.
  fillPoly(ctx, [6, -15.6, 9, -14, 6, -12.4], C.sky)
  fillPoly(ctx, [12, -15.6, 9, -14, 12, -12.4], C.sky)
  ctx.restore()
  return { x: 9.5 + st * 4, y: -2.4 - st * 3 - lift }
}

/** A chick, about 13 units tall. */
function drawChick(ctx: Ctx, hop: number) {
  const l = Math.abs(Math.sin(hop)) * 3
  line(ctx, -1, -1.6 - l, -1.6 + Math.sin(hop) * 1.5, 0, 0.9, C.orange)
  line(ctx, 1.4, -1.6 - l, 1.4 - Math.sin(hop) * 1.5, 0, 0.9, C.orange)
  fillCirc(ctx, 0, -5 - l, 4.4, '#fde047')
  fillEll(ctx, -1.2, -4.6 - l, 2.6, 1.8, '#f5c542', 0.4 + Math.sin(hop * 2) * 0.3)
  fillCirc(ctx, 3, -10 - l, 3.1, '#fde047')
  fillPoly(ctx, [5.6, -10.6 - l, 8.6, -9.6 - l, 5.6, -8.8 - l], C.orange)
  fillCirc(ctx, 3.8, -10.8 - l, 0.75, C.ink)
  line(ctx, 2.4, -13 - l, 1.6, -14.6 - l, 0.8, '#fde047')
}

// ─── The egg hunt ────────────────────────────────────────────────────────────
// The Easter bunny bounds across leaving painted eggs behind him. Then a child
// with a basket follows the trail. The last egg is not like the others: it
// either hatches, and the chick decides the child is its mother, or it grows
// legs and makes a run for it.

const eggHunt: ActDef = {
  id: 'easter.egg-hunt',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const gag = chance(rng, 0.5) ? 'hatch' : 'runaway'
    const n = clamp(Math.floor(stage.w / (95 * stage.u)), 3, 7)
    const eggs = Array.from({ length: n }, (_, i) => ({
      x: along(stage, dir, 0.14 + (0.68 * (i + (i > 0 && i < n - 1 ? range(rng, -0.25, 0.25) : 0))) / (n - 1)),
      col: Math.floor(rng() * EGG_COLS.length),
      pat: Math.floor(rng() * 3),
      state: 'none' as 'none' | 'down' | 'got',
      age: 0,
    }))
    const last = eggs[n - 1]
    const look: Look = chance(rng, 0.5) ? CAST.kid : { ...CAST.girl, hat: 'sunhat', hatColor: C.yellow, hatTrim: C.pink }
    let phase: 'hide' | 'seek' | 'find' | 'out' = 'hide'
    let pt = 0
    let bx = from
    let hop = 0
    let cx = from
    let walk = 0
    let count = 0
    let chickX = last.x
    let chickHop = 0
    let cracked = false
    return makeAct({
      update(s, dt) {
        pt += dt
        for (const e of eggs) if (e.state === 'down') e.age += dt
        if (phase === 'hide') {
          bx += dir * 122 * s.u * pace(s) * dt
          hop = (hop + dt * 2.3) % 1
          for (const e of eggs) if (e.state === 'none' && passed(bx, e.x + dir * 10 * s.u, dir)) e.state = 'down'
          if (passed(bx, to, dir)) phase = 'seek'
        } else if (phase === 'seek') {
          cx += dir * 88 * s.u * pace(s) * dt
          walk += dt * 10.5
          for (const e of eggs) {
            if (e !== last && e.state === 'down' && passed(cx + dir * 10 * s.u, e.x, dir)) {
              e.state = 'got'
              count++
              burst(s, 'star', e.x, s.ground - 6 * s.u, 3, SPARKLE, 40, [1.5, 3])
            }
          }
          if (passed(cx, last.x - dir * 17 * s.u, dir)) {
            phase = 'find'
            pt = 0
          }
        } else if (phase === 'find') {
          if (!cracked && pt > 1.5) {
            cracked = true
            if (gag === 'hatch') {
              last.state = 'got'
              for (let i = 0; i < 7; i++) {
                s.particles.emit({ kind: 'confetti', x: last.x, y: s.ground - 6 * s.u, vx: range(rng, -70, 70) * s.u, vy: -range(rng, 40, 120) * s.u, g: 320, size: range(rng, 2.5, 4) * s.u, color: EGG_COLS[last.col][0], life: 1.3, sway: 0 })
              }
            }
          }
          if (cracked && gag === 'runaway') chickX += dir * 176 * s.u * dt
          if (pt > (gag === 'hatch' ? 2.8 : 2.1)) phase = 'out'
        } else {
          cx += dir * (gag === 'hatch' ? 84 : 150) * s.u * pace(s) * dt
          walk += dt * (gag === 'hatch' ? 10 : 16)
          chickHop += dt * 18
          if (gag === 'runaway') chickX += dir * 176 * s.u * pace(s) * dt
          else {
            const d = (cx - dir * 20 * s.u - chickX) * dir
            chickX += dir * clamp(d, 0, 130 * s.u * dt)
          }
          return !passed(cx - dir * 34 * s.u, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        for (const e of eggs) {
          if (e.state !== 'down') continue
          const pop = easeOut(seg(e.age, 0, 0.25))
          const [a, b] = EGG_COLS[e.col]
          const lastOne = e === last && phase === 'find'
          const wob = lastOne && pt > 0.5 && !cracked ? Math.sin(pt * 20) * 0.22 * seg(pt, 0.5, 1.5) : 0
          const legs = lastOne && cracked
          at(ctx, legs ? chickX : e.x, s.ground - (legs ? 4 * u : 0), u, dir, () => {
            if (legs) {
              line(ctx, -1.5, 0, -1.5 + Math.sin(t * 30) * 2.5, 4, 1, C.orange)
              line(ctx, 1.5, 0, 1.5 - Math.sin(t * 30) * 2.5, 4, 1, C.orange)
            }
            drawEgg(ctx, 0, 0, 6 * pop, a, b, e.pat, wob)
          })
        }
        if (gag === 'runaway' && phase === 'out') {
          const [a, b] = EGG_COLS[last.col]
          at(ctx, chickX, s.ground - 4 * u, u, dir, () => {
            line(ctx, -1.5, 0, -1.5 + Math.sin(t * 30) * 2.5, 4, 1, C.orange)
            line(ctx, 1.5, 0, 1.5 - Math.sin(t * 30) * 2.5, 4, 1, C.orange)
            drawEgg(ctx, 0, 0, 6, a, b, last.pat, 0.15)
            speedLines(ctx, -8, -6, 8, t)
          })
        }
        if (phase === 'hide') {
          at(ctx, bx, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 11)
            const paw = drawBunny(ctx, hop)
            drawBasket(ctx, paw.x + 3, paw.y - 9, 3)
          })
          return
        }
        if (gag === 'hatch' && cracked) {
          at(ctx, chickX, s.ground, u, dir, () => {
            // Half a shell stays on its head for a moment.
            drawChick(ctx, phase === 'out' ? chickHop : pt * 14)
            if (phase === 'find' && pt < 2.3) fillPoly(ctx, [-1, -13, 0.5, -16, 2, -13.6, 3.5, -16, 5.5, -13, 5, -11.4, -0.6, -11.4], EGG_COLS[last.col][0])
          })
        }
        const finding = phase === 'find'
        at(ctx, cx, s.ground, u * 0.84, dir, () => {
          groundShadow(ctx, 0, 9)
          const pose: Pose = finding
            ? {
                crouch: pt < 1.5 ? 0.55 : 0.1, lean: pt < 1.5 ? 0.25 : -0.1, armB: 1.0, elbowB: 0.3,
                mouth: cracked ? (pt > 2.1 ? 'grin' : 'o') : 'smile', eyes: cracked ? 'wide' : 'normal',
              }
            : { walk, stride: phase === 'out' && gag === 'runaway' ? 1 : 0.8, lean: phase === 'out' && gag === 'runaway' ? 0.25 : 0.04, armB: phase === 'out' && gag === 'runaway' ? 1.8 : undefined, mouth: phase === 'out' && gag === 'runaway' ? 'o' : 'smile', blink: blinking(s.time, 3) }
          const a = drawPerson(ctx, look, { ...pose, armF: 0.55, elbowF: 0.5 })
          drawBasket(ctx, a.handF.x + 1, a.handF.y - 3, count)
        })
        if (finding && cracked && pt < 2.1) at(ctx, cx, s.ground, u, 1, () => bubble(ctx, 0, -58, '!', { color: C.crimson }))
      },
    })
  },
}

// ─── The hen and her chicks ──────────────────────────────────────────────────
// A hen marches across with a file of chicks behind her. Either she stops dead
// to peck at something and they concertina into each other, or the last chick
// gets distracted, looks up to find everyone gone, and has to sprint.

function drawHen(ctx: Ctx, strut: number, peck: number) {
  const col = '#c9703a'
  const leg = (x: number, phase: number) => {
    const a = Math.sin(strut + phase) * 0.5
    const fx = x + Math.sin(a) * 9
    const fy = Math.min(0, -9 + Math.cos(a) * 9.2)
    line(ctx, x, -9, fx, fy, 1.4, C.amber)
    line(ctx, fx, fy, fx + 3, fy, 1.2, C.amber)
  }
  leg(-2, Math.PI)
  fillPoly(ctx, [-8, -17, -19, -29, -14, -15], shade(col, -0.3))
  fillPoly(ctx, [-8, -15, -20, -22, -13, -12], shade(col, -0.18))
  fillEll(ctx, 0, -15, 11.5, 8.6, col)
  fillEll(ctx, 2.5, -11.6, 7.4, 4.8, '#e3a56a')
  fillEll(ctx, -2.5, -15.6, 6.6, 4.4, shade(col, -0.16), 0.2)
  leg(3, 0)
  // The head nods forward with every step, and goes right down to peck.
  const nod = Math.cos(strut) * 1.6 * (1 - peck)
  const hx = lerp(10.5, 15, peck) + nod
  const hy = lerp(-27, -6.5, peck)
  line(ctx, 6.5, -18, hx, hy, 5.6, col)
  const pa = peck * 1.15
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(pa)
  for (let i = 0; i < 3; i++) fillCirc(ctx, -1.8 + i * 1.9, -4.4 - (i === 1 ? 0.8 : 0), 1.5, C.red)
  fillCirc(ctx, 0, 0, 4.1, col)
  fillPoly(ctx, [3.4, -1.4, 8, 0.2, 3.4, 1.6], C.amber)
  fillEll(ctx, 3, 3.6, 1.3, 2.1, C.red)
  fillCirc(ctx, 1.4, -1, 0.9, C.ink)
  ctx.restore()
}

const henAndChicks: ActDef = {
  id: 'easter.hen-and-chicks',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 30)
    const gag = chance(rng, 0.5) ? 'pile-up' : 'straggler'
    const n = 4 + Math.floor(rng() * 3)
    const gagAt = along(stage, dir, range(rng, 0.45, 0.6))
    const chicks = Array.from({ length: n }, (_, i) => ({ x: from - dir * (16 + i * 11) * stage.u, hop: i * 1.3, moving: true }))
    let x = from
    let strut = 0
    let hold = 0
    let lag = 0
    let done = false
    let since = 9
    return makeAct({
      update(s, dt) {
        if (!done && passed(x, gagAt, dir)) {
          done = true
          if (gag === 'pile-up') hold = 1.8
          else lag = 2.6
        }
        if (hold > 0) hold -= dt
        else {
          x += dir * 62 * s.u * pace(s) * dt
          strut += dt * 10
        }
        if (lag > 0) {
          lag -= dt
          if (lag <= 0) since = 0
        }
        since += dt
        const gap = hold > 0 ? 6 : 11
        for (let i = 0; i < n; i++) {
          const c = chicks[i]
          const lastOne = i === n - 1 && gag === 'straggler'
          if (lastOne && (lag > 0 || since < 0.5)) {
            c.moving = false
            continue
          }
          // Chicks only ever go forwards: when she stops, they bunch up behind her.
          const d = (x - dir * (16 + i * gap) * s.u - c.x) * dir
          const step = clamp(d, 0, (lastOne ? 200 : 125) * s.u * dt)
          c.x += dir * step
          c.moving = step > 0.01
          if (c.moving) c.hop += dt * (lastOne && d > 14 * s.u ? 30 : 17)
        }
        return !passed(chicks[n - 1].x, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        for (let i = n - 1; i >= 0; i--) {
          const c = chicks[i]
          const bumped = hold > 0 && !c.moving
          at(ctx, c.x, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 4.5, 0.2)
            if (bumped) ctx.rotate(0.3 * Math.max(0, 1 - (1.8 - hold) * 1.5))
            drawChick(ctx, c.moving ? c.hop : 0)
          })
        }
        const st = chicks[n - 1]
        if (gag === 'straggler' && lag <= 0 && since < 0.6) at(ctx, st.x, s.ground, u, 1, () => bubble(ctx, 0, -18, '!', { color: C.crimson, size: 9 }))
        if (gag === 'straggler' && lag > 0.4) {
          // What it stopped for: a ladybird.
          at(ctx, st.x + dir * 9 * u, s.ground, u, dir, () => {
            fillEll(ctx, Math.sin(t * 2) * 1.5, -1.6, 2, 1.5, C.red)
            fillCirc(ctx, 1.6 + Math.sin(t * 2) * 1.5, -1.6, 0.8, C.ink)
          })
        }
        at(ctx, x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 11)
          const k = 1.8 - hold
          const peck = hold > 0 ? clamp(seg(k, 0.1, 0.3) - seg(k, 1.5, 1.75)) * (0.8 + 0.2 * Math.abs(Math.sin(k * 12))) : 0
          drawHen(ctx, strut, peck)
        })
      },
    })
  },
}

// ─── The lamb ────────────────────────────────────────────────────────────────
// A lamb crosses the only way lambs can: straight up and down on four stiff
// legs. Either it is following a butterfly, which stops for a rest on its nose,
// or it has a smaller brother who is not going to be left behind.

/** A lamb, about 28 units tall. `air` 0..1 splays the legs; `cross` crosses the eyes. Returns the nose. */
function drawLamb(ctx: Ctx, air: number, wag: number, cross = false): Pt {
  const wool = '#f4f1ea'
  const face = '#7f8da3'
  for (const [lx, far] of [[-7, true], [5, true], [-4, false], [8, false]] as const) {
    const splay = (lx < 0 ? -1 : 1) * air * 2.2
    line(ctx, lx, -10, lx + splay, -1, 2.2, far ? shade(face, -0.2) : face)
    fillEll(ctx, lx + splay + 0.5, -0.6, 1.9, 1.2, '#4b5669')
  }
  fillCirc(ctx, -11.5 - Math.sin(wag) * 1.5, -16 - Math.abs(Math.cos(wag)) * 1.5, 2.7, wool)
  fillCirc(ctx, -4, -10.6, 5.2, '#dcd7cc')
  fillCirc(ctx, 4, -10.6, 5.2, '#dcd7cc')
  fillCirc(ctx, 0, -14, 8.6, wool)
  fillCirc(ctx, -6.4, -14.4, 6.6, wool)
  fillCirc(ctx, 6.4, -14.8, 6.6, wool)
  fillCirc(ctx, 0, -18.6, 6.6, wool)
  fillCirc(ctx, -2, -12.5, 4, '#e9e5dc')
  fillEll(ctx, 8.4, -23, 3.2, 1.6, face, -0.5 + Math.sin(wag) * 0.2)
  fillEll(ctx, 12.4, -20.4, 5.2, 4.3, face, 0.15)
  fillCirc(ctx, 9.6, -24.6, 3.3, wool)
  fillCirc(ctx, 12.6, -21.6, 1.5, C.white)
  fillCirc(ctx, cross ? 13.4 : 12.9, cross ? -21.2 : -21.6, 0.8, C.ink)
  fillEll(ctx, 16.6, -19.4, 1.1, 0.8, C.pink)
  line(ctx, 14, -17.6, 16, -17.4, 0.6, C.ink)
  return { x: 17.2, y: -20.4 }
}

function drawButterfly(ctx: Ctx, flap: number, col: string) {
  const w = Math.abs(Math.sin(flap)) * 0.85 + 0.15
  fillPoly(ctx, [0, 0, -4.6 * w, -4.6, -5.4 * w, 0.6], col)
  fillPoly(ctx, [0, 0, 4.6 * w, -4.6, 5.4 * w, 0.6], col)
  fillPoly(ctx, [0, 0, -3.4 * w, 3.4, -1, 2.6], shade(col, -0.2))
  fillPoly(ctx, [0, 0, 3.4 * w, 3.4, 1, 2.6], shade(col, -0.2))
  line(ctx, 0, -1.6, 0, 2.2, 0.9, C.ink)
}

const lamb: ActDef = {
  id: 'easter.lamb',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const gag = chance(rng, 0.5) ? 'butterfly' : 'twins'
    const gagAt = along(stage, dir, range(rng, 0.42, 0.58))
    const HOLD = gag === 'butterfly' ? 2.6 : 1.3
    const wing = pick(rng, [C.sky, C.pink, C.yellow, C.purple])
    let x = from
    let p = 0 // through one pronk, 0..1
    let hold = 0
    let done = false
    let ahead = -42 // where the little one is relative to the big one, units
    return makeAct({
      update(s, dt) {
        if (!done && p < 0.08 && passed(x, gagAt, dir)) {
          done = true
          hold = HOLD
          p = 0
        }
        if (hold > 0) {
          hold -= dt
          if (gag === 'twins') ahead = lerp(-42, 40, easeInOut(1 - hold / HOLD))
          return true
        }
        const before = p
        p = (p + dt * 1.9) % 1
        if (p < before) burst(s, 'dust', x, s.ground - 1 * s.u, 2, ['#dbe7f3'], 30, [2.5, 4])
        x += dir * 100 * s.u * pace(s) * dt
        return !passed(x - dir * 50 * s.u, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const stalled = hold > 0
        const air = stalled ? 0 : Math.sin(p * Math.PI)
        let nose: Pt = { x: 17, y: -20 }
        const one = (lx: number, k: number, a: number, extra: number, cross: boolean, squat: number) => {
          at(ctx, lx, s.ground, u * k, dir, () => {
            groundShadow(ctx, 0, 12 - a * 4)
            ctx.translate(0, -a * 21 - extra + squat * 3)
            ctx.scale(1 + squat * 0.1, 1 - squat * 0.14)
            const n = drawLamb(ctx, Math.max(a, extra > 2 ? 1 : 0), t * 14, cross)
            if (k === 1) nose = { x: n.x, y: n.y - a * 21 }
          })
        }
        if (gag === 'twins') {
          // The small one is half a beat late until it takes the lead with one enormous leap.
          const lp = (p + 0.6) % 1
          const leap = stalled ? Math.sin((1 - hold / HOLD) * Math.PI) * 50 : 0
          one(x + dir * ahead * u, 0.66, stalled ? 0 : Math.sin(lp * Math.PI), leap, false, 0)
        }
        const k = HOLD - hold
        const landed = gag === 'butterfly' && stalled && k > 0.5 && k < 2.1
        one(x, 1, air, 0, landed, stalled && gag === 'twins' ? Math.sin((1 - hold / HOLD) * Math.PI) : 0)
        if (gag === 'butterfly') {
          const fx = x + dir * (36 + Math.sin(t * 2.1) * 9) * u
          const fy = s.ground - (33 + Math.sin(t * 5.3) * 8) * u
          const nx = x + dir * (nose.x + 1.5) * u
          const ny = s.ground + (nose.y - 2.4) * u
          const sit = stalled ? easeInOut(seg(k, 0, 0.5)) * (1 - easeInOut(seg(k, 2.1, 2.6))) : 0
          at(ctx, lerp(fx, nx, sit), lerp(fy, ny, sit), u, dir, () => drawButterfly(ctx, landed ? t * 4 : t * 22, wing))
        }
      },
    })
  },
}

// ─── Egg and spoon ───────────────────────────────────────────────────────────
// Two children, two spoons, two eggs and a great deal of concentration. The one
// behind loses theirs. It either bounces, all the way to the finish and well
// ahead of everybody, or it cracks open and there is somebody inside.

const eggAndSpoon: ActDef = {
  id: 'easter.egg-and-spoon',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const gag = chance(rng, 0.5) ? 'bounce' : 'chick'
    const swap = chance(rng, 0.5)
    const lookA: Look = swap ? CAST.girl : CAST.kid
    const lookB: Look = swap ? { ...CAST.kid, hat: 'cap', hatColor: C.green } : { ...CAST.girl, hat: 'cap', hatColor: C.orange }
    const dropAt = along(stage, dir, range(rng, 0.38, 0.5))
    const v = 86 * stage.u * pace(stage)
    let xa = from
    let xb = from - dir * 36 * stage.u
    let walk = 0
    let egg: 'spoon' | 'air' | 'loose' = 'spoon'
    let since = 0
    let ex = 0
    let eh = 0 // height above the floor, px
    let evy = 0
    let chickHop = 0
    return makeAct({
      update(s, dt) {
        walk += dt * 15
        xa += dir * v * dt
        if (egg === 'spoon') {
          xb += dir * v * dt
          if (passed(xb, dropAt, dir)) {
            egg = 'air'
            ex = xb + dir * 21 * s.u
            eh = 30 * s.u
            evy = 60 * s.u
          }
          return true
        }
        since += dt
        if (egg === 'air' || gag === 'bounce') {
          evy -= 520 * s.u * dt
          eh += evy * dt
          if (gag === 'bounce') ex += dir * v * 2.1 * dt
          if (eh <= 0) {
            eh = 0
            if (gag === 'bounce') {
              evy = 250 * s.u
              egg = 'loose'
              burst(s, 'dust', ex, s.ground - 1 * s.u, 2, ['#dbe7f3'], 30, [2.5, 4])
            } else {
              egg = 'loose'
              for (let i = 0; i < 8; i++) {
                s.particles.emit({ kind: 'confetti', x: ex, y: s.ground - 4 * s.u, vx: range(rng, -70, 70) * s.u, vy: -range(rng, 40, 120) * s.u, g: 320, size: range(rng, 2.5, 4) * s.u, color: '#fdf6e3', life: 1.3, sway: 0 })
              }
            }
          }
        }
        if (gag === 'bounce') {
          if (since > 0.6) xb += dir * v * 1.75 * dt
          return !(passed(xa, to, dir) && passed(xb, to, dir))
        }
        // The chick trots after whoever dropped it.
        if (since > 1.9) xb += dir * v * dt
        if (egg === 'loose') {
          const d = (xb - dir * 17 * s.u - ex) * dir
          const step = clamp(d, 0, 140 * s.u * dt)
          ex += dir * step
          if (step > 0.01) chickHop += dt * 18
        }
        return !passed(ex, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const runner = (x: number, look: Look, seed: number, has: boolean, lost: boolean) => {
          at(ctx, x, s.ground, u * 0.84, dir, () => {
            groundShadow(ctx, 0, 9)
            const stopped = lost && (gag === 'bounce' ? since < 0.6 : since < 1.9)
            const sprint = lost && gag === 'bounce' && !stopped
            const a = drawPerson(ctx, look, {
              walk: walk + seed, stride: stopped ? 0 : sprint ? 1 : 0.5, lean: sprint ? 0.25 : 0.06,
              armF: sprint ? 1.9 : 1.35, elbowF: 0.2, armB: sprint ? -0.8 : 0.3,
              mouth: lost ? (gag === 'chick' && since > 1.2 ? 'grin' : 'o') : 'flat', eyes: lost && since < 1.5 ? 'wide' : 'normal', blink: blinking(s.time, seed),
              headTilt: stopped && gag === 'chick' ? 0.25 : 0,
            })
            // Spoon, and the egg wobbling on it.
            line(ctx, a.handF.x - 1, a.handF.y, a.handF.x + 9, a.handF.y - 1, 1.4, '#cbd5e1')
            fillEll(ctx, a.handF.x + 11.5, a.handF.y - 1, 3.4, 1.6, '#e2e8f0')
            if (has) drawEgg(ctx, a.handF.x + 11.5, a.handF.y - 1.4, 4.4, '#fdf6e3', C.tan, 3, Math.sin(t * 11 + seed) * 0.16)
          })
        }
        runner(xb, lookB, 2, egg === 'spoon', egg !== 'spoon')
        runner(xa, lookA, 0, true, false)
        if (egg === 'spoon') return
        if (gag === 'chick' && egg === 'loose') {
          at(ctx, ex, s.ground, u, dir, () => drawChick(ctx, chickHop || since * 12))
        } else {
          at(ctx, ex, s.ground - eh, u, dir, () => {
            const squash = gag === 'bounce' && eh < 3 * u ? 0.25 : 0
            ctx.scale(1 + squash, 1 - squash)
            drawEgg(ctx, 0, 0, 4.4, '#fdf6e3', C.tan, 3, gag === 'bounce' ? since * 9 : since * 3)
          })
        }
        if (since < 0.7) at(ctx, xb, s.ground, u, 1, () => bubble(ctx, 0, -58, '!', { color: C.crimson }))
      },
    })
  },
}

export const EASTER_ACTS: ActDef[] = [eggHunt, henAndChicks, lamb, eggAndSpoon]

// ═══ Valentine's Day ═════════════════════════════════════════════════════════

function drawFlower(ctx: Ctx, x: number, y: number) {
  line(ctx, x, y + 3, x, y - 9, 1.2, C.green)
  fillEll(ctx, x + 2, y - 3, 2.4, 1.1, C.green, -0.6)
  fillCirc(ctx, x, y - 11, 3.6, C.rose)
  fillCirc(ctx, x - 0.8, y - 11.6, 2, '#e11d48')
  fillCirc(ctx, x + 0.6, y - 10.8, 0.9, C.pink)
}

function drawChocolates(ctx: Ctx, x: number, y: number) {
  heart(ctx, x, y - 5, 5.6, C.crimson)
  line(ctx, x - 4.4, y - 6.4, x + 4.4, y - 3.4, 1.1, C.gold)
  fillCirc(ctx, x, y - 5, 1.4, C.gold)
}

// ─── The shy pair ────────────────────────────────────────────────────────────
// Two people arrive from opposite sides, each with something hidden behind
// their back, and neither can quite look at the other. They both produce it at
// exactly the same moment. Sometimes it turns out to be exactly the same thing.

const shyPair: ActDef = {
  id: 'valentine.shy-pair',
  weight: 3,
  create(stage, rng) {
    const { dir, to } = crossing(stage, rng, 50)
    const same = chance(rng, 0.4)
    const young = chance(rng, 0.4)
    const k = young ? 0.82 : 1
    const lookL: Look = young ? { ...CAST.kid } : { ...CAST.dad, scarf: C.red }
    const lookR: Look = young ? { ...CAST.girl } : { ...CAST.mum }
    const mid = stage.w * range(rng, 0.42, 0.58)
    const GAP = 19 * k * stage.u
    const sp = 70 * stage.u * pace(stage)
    let xl = -40 * stage.u
    let xr = stage.w + 40 * stage.u
    let walk = 0
    let phase: 'approach' | 'shy' | 'present' | 'react' | 'leave' = 'approach'
    let pt = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'approach') {
          walk += dt * 9
          xl = Math.min(xl + sp * dt, mid - GAP)
          xr = Math.max(xr - sp * dt, mid + GAP)
          if (xl >= mid - GAP && xr <= mid + GAP) {
            phase = 'shy'
            pt = 0
          }
        } else if (phase === 'shy') {
          if (pt > 1.8) {
            phase = 'present'
            pt = 0
          }
        } else if (phase === 'present') {
          if (pt > 0.5) {
            phase = 'react'
            pt = 0
          }
        } else if (phase === 'react') {
          if (pt > 0.5 && tick(pt, dt, 4)) {
            s.particles.emit({ kind: 'heart', x: mid + range(rng, -12, 12) * s.u, y: s.ground - range(rng, 44, 58) * s.u, vx: range(rng, -14, 14) * s.u, vy: -range(rng, 20, 34) * s.u, size: range(rng, 2.5, 4.5) * s.u, color: pick(rng, HEARTS) })
          }
          if (pt > 2.4) {
            phase = 'leave'
            pt = 0
          }
        } else {
          walk += dt * 9
          xl += dir * 62 * s.u * pace(s) * dt
          xr += dir * 62 * s.u * pace(s) * dt
          if (tick(pt, dt, 1.5)) {
            s.particles.emit({ kind: 'heart', x: (xl + xr) / 2, y: s.ground - 56 * k * s.u, vx: -dir * 8 * s.u, vy: -24 * s.u, size: 3.2 * s.u, color: pick(rng, HEARTS) })
          }
          return !(passed(xl, to, dir) && passed(xr, to, dir))
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const out = phase === 'present' ? easeOut(seg(pt, 0, 0.4)) : phase === 'react' || phase === 'leave' ? 1 : 0
        const one = (x: number, look: Look, home: Dir, seed: number, gift: 'flower' | 'chocs') => {
          const facing = phase === 'leave' ? dir : home
          at(ctx, x, s.ground, s.u * k, facing, () => {
            groundShadow(ctx, 0, 10)
            const shy = phase === 'shy'
            const laugh = phase === 'react' && pt > 0.6
            const paint = (p: Pt) => (gift === 'flower' ? drawFlower(ctx, p.x, p.y - 2) : drawChocolates(ctx, p.x + 2, p.y))
            const a = drawPerson(ctx, look, {
              walk: walk + seed, stride: phase === 'approach' ? 0.7 : phase === 'leave' ? 0.75 : 0,
              armB: lerp(-0.9, 0.3, out), elbowB: lerp(-0.7, 0.3, out),
              armF: lerp(0.15, 1.45, out), elbowF: 0.3,
              lean: shy ? Math.sin(t * 3 + seed) * 0.05 : laugh && same ? -0.1 + Math.sin(t * 16) * 0.04 : 0,
              headTilt: shy ? 0.2 + Math.sin(t * 2.2 + seed * 2) * 0.12 : 0,
              mouth: phase === 'approach' || shy ? 'flat' : phase === 'present' || (phase === 'react' && pt < 0.6) ? 'o' : 'grin',
              eyes: phase === 'present' || (phase === 'react' && pt < 0.6) ? 'wide' : laugh && same ? 'closed' : 'normal',
              blink: blinking(s.time, seed),
            }, (b) => {
              if (out < 0.5) paint(b.handB)
            })
            if (out >= 0.5) paint(a.handF)
            // Both of them have gone rather pink.
            if (phase !== 'approach') fillEll(ctx, a.head.x + 4, a.head.y + 4.6, 3.6, 2.5, 'rgba(244,114,128,0.5)')
          })
        }
        one(xl, lookL, 1, 0, 'flower')
        one(xr, lookR, -1, 2, same ? 'flower' : 'chocs')
        if (phase === 'shy' && pt > 0.4) {
          at(ctx, (xl + xr) / 2, s.ground, s.u, 1, () => bubble(ctx, 0, -64 * k, '...', { size: 9 }))
        }
      },
    })
  },
}

// ─── Cupid ───────────────────────────────────────────────────────────────────
// A small winged archer with more confidence than aim. The arrow finds the
// dog, who was sniffing a lamp post and now thinks the lamp post is wonderful;
// or it finds a snail, and snails are in no hurry about anything, until they are.

const CUPID: Look = { skin: C.skinA, top: '#fbcfe8', bottom: C.white, shoe: C.skinA, hair: C.gold, hairStyle: 'curly', shorts: true }

type CupidMood = 'calm' | 'aim' | 'oops' | 'palm' | 'sleep'

/** Cupid, hovering with his feet on y = 0. Returns where the arrow leaves the bow. */
function drawCupid(ctx: Ctx, t: number, mood: CupidMood, draw: number, armed: boolean): Pt {
  const flap = Math.sin(t * (mood === 'sleep' ? 7 : 17))
  for (const far of [true, false]) {
    ctx.globalAlpha = far ? 0.6 : 0.92
    fillEll(ctx, -9, -27 - flap * 3, 9, 4.4, C.white, -0.55 - flap * 0.45 + (far ? 0.25 : 0))
    fillEll(ctx, -8, -21 - flap * 1.5, 6, 3, '#e2e8f0', -0.2 - flap * 0.3 + (far ? 0.25 : 0))
  }
  ctx.globalAlpha = 1
  ctx.save()
  ctx.scale(0.62, 0.62)
  const aiming = mood === 'aim'
  const a = drawPerson(ctx, CUPID, {
    crouch: 0.4, walk: t * 3, stride: 0.12,
    armF: aiming ? 1.52 : mood === 'sleep' ? 0.3 : 0.9, elbowF: aiming ? 0.05 : 0.5,
    armB: aiming ? 1.2 : mood === 'palm' ? 2.3 : 0.3, elbowB: aiming ? 1.5 + draw * 0.5 : mood === 'palm' ? 2.1 : 0.4,
    mouth: mood === 'oops' ? 'o' : mood === 'palm' || mood === 'sleep' ? 'flat' : aiming ? 'flat' : 'smile',
    eyes: mood === 'oops' ? 'wide' : mood === 'palm' || mood === 'sleep' ? 'closed' : 'normal',
    headTilt: mood === 'sleep' ? 0.3 : 0,
  })
  // The bow, belly at his fist, and the string drawn back.
  const hx = a.handF.x
  const hy = a.handF.y
  ctx.beginPath()
  ctx.arc(hx - 10, hy, 10, -1.1, 1.1)
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.strokeStyle = C.wood
  ctx.stroke()
  const tx = hx - 10 + Math.cos(1.1) * 10
  const ty = Math.sin(1.1) * 10
  const pull = tx - draw * 9
  poly(ctx, [tx, hy - ty, pull, hy, tx, hy + ty], 0.7, C.white)
  if (armed) {
    line(ctx, pull, hy, pull + 19, hy, 1, C.tan)
    heart(ctx, pull + 20, hy, 2.6, C.rose)
    fillPoly(ctx, [pull, hy, pull - 3, hy - 2.4, pull + 2, hy], C.white)
    fillPoly(ctx, [pull, hy, pull - 3, hy + 2.4, pull + 2, hy], C.white)
  }
  ctx.restore()
  return { x: (hx + 8) * 0.62, y: hy * 0.62 }
}

function drawSnail(ctx: Ctx, crawl: number, shell: string, smitten: boolean) {
  const st = (Math.sin(crawl) + 1) * 1.2
  const body = '#d9c9a3'
  fillRR(ctx, -10 - st * 0.4, -4.2, 22 + st, 4.4, 2.2, body)
  line(ctx, 11 + st * 0.6, -3, 14 + st * 0.6, -9.6, 3.8, body)
  for (const ox of [13.2, 15.8]) {
    const tipX = ox + st * 0.6 + (ox > 14 ? 1.6 : -0.4)
    line(ctx, ox + st * 0.6, -10.6, tipX, -15.6, 0.9, body)
    if (smitten) heart(ctx, tipX, -16.6, 1.5, C.rose)
    else {
      fillCirc(ctx, tipX, -16.4, 1.4, C.white)
      fillCirc(ctx, tipX + 0.3, -16.4, 0.7, C.ink)
    }
  }
  fillCirc(ctx, -1, -10.4, 8.2, shell)
  fillCirc(ctx, -1, -10.4, 5.6, shade(shell, 0.22))
  fillCirc(ctx, -0.4, -10.2, 3, shell)
  fillCirc(ctx, 0, -10, 1.2, shade(shell, 0.22))
  line(ctx, 14.6 + st * 0.6, -6.2, 16 + st * 0.6, -6.6, 0.6, C.ink)
}

function drawLampPost(ctx: Ctx, time: number) {
  fillRR(ctx, -4.4, -7, 8.8, 7, 1.2, '#56657c')
  fillRR(ctx, -1.7, -70, 3.4, 64, 1, '#6b7a92')
  fillRR(ctx, -2.8, -40, 5.6, 2, 1, '#56657c')
  line(ctx, -6, -62, 6, -62, 1.4, '#56657c')
  const g = 0.8 + Math.sin(time * 1.7) * 0.1
  ctx.globalAlpha = 0.13 * g
  fillCirc(ctx, 0, -77, 19, C.amber)
  ctx.globalAlpha = 0.2 * g
  fillCirc(ctx, 0, -77, 11, C.yellow)
  ctx.globalAlpha = 1
  fillPoly(ctx, [-4.6, -70, 4.6, -70, 6.6, -83, -6.6, -83], '#fde68a')
  line(ctx, -4.6, -70, -6.6, -83, 0.9, '#56657c')
  line(ctx, 4.6, -70, 6.6, -83, 0.9, '#56657c')
  line(ctx, 0, -70, 0, -83, 0.7, '#56657c')
  fillPoly(ctx, [-8.4, -83, 8.4, -83, 0, -90], '#56657c')
  fillCirc(ctx, 0, -90.6, 1.5, '#6b7a92')
}

const cupid: ActDef = {
  id: 'valentine.cupid',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const gag = chance(rng, 0.5) ? 'dog' : 'snails'
    const hoverX = along(stage, dir, gag === 'dog' ? 0.22 : 0.3)
    const HOVER = 56
    const tx = along(stage, dir, range(rng, 0.6, 0.68))
    const shells = pick(rng, [[C.amber, C.purple], [C.rose, C.mint], [C.orange, C.sky]] as const)
    let phase: 'arrive' | 'aim' | 'fly' | 'love' | 'exit' = 'arrive'
    let pt = 0
    let cx = from
    let ch = 150 // cupid's height, units
    let mood: CupidMood = 'calm'
    let bow: Pt = { x: 8, y: -20 }
    let ax = 0
    let ay = 0
    let ax0 = 0
    let ay0 = 0
    // The dog, or the nearer snail.
    let dx = to
    let run = 0
    let arrived = false
    // The second snail, and how far apart they are.
    let gap = 44
    let post = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        const targetX = gag === 'dog' ? tx + dir * 27 * s.u : tx
        const hitY = s.ground - (gag === 'dog' ? 17 : 9) * s.u
        if (phase === 'arrive') {
          const k = easeOut(seg(pt, 0, 2))
          cx = lerp(from, hoverX, k)
          ch = lerp(150, HOVER, k)
          if (gag === 'dog') post = Math.min(1, post + dt * 0.9)
          if (!arrived) {
            dx -= dir * (gag === 'dog' ? 125 : 42) * s.u * dt
            run += dt * (gag === 'dog' ? 14 : 6)
            if (!passed(dx, targetX, dir)) {
              dx = targetX
              arrived = true
            }
          }
          if (arrived && pt > 2.2) {
            phase = 'aim'
            pt = 0
            mood = 'aim'
          }
        } else if (phase === 'aim') {
          if (pt > 1.4) {
            phase = 'fly'
            pt = 0
            mood = 'calm'
            ax0 = cx + dir * bow.x * s.u
            ay0 = s.ground - ch * s.u + bow.y * s.u
          }
        } else if (phase === 'fly') {
          const k = seg(pt, 0, 0.45)
          ax = lerp(ax0, dx, k)
          ay = lerp(ay0, hitY, k) - Math.sin(k * Math.PI) * 10 * s.u
          if (k >= 1) {
            phase = 'love'
            pt = 0
            mood = 'oops'
            burst(s, 'heart', dx, hitY - 6 * s.u, 9, HEARTS, 70, [2.5, 4.5])
          }
        } else if (phase === 'love') {
          if (tick(pt, dt, 2)) {
            s.particles.emit({ kind: 'heart', x: dx + range(rng, -6, 10) * s.u, y: s.ground - range(rng, 22, 34) * s.u, vx: range(rng, -8, 8) * s.u, vy: -range(rng, 20, 30) * s.u, size: range(rng, 2.5, 4) * s.u, color: pick(rng, HEARTS) })
          }
          if (gag === 'dog') {
            mood = pt < 1.2 ? 'oops' : 'palm'
            if (pt > 2.6) {
              // He gives up and goes home; the lamp post goes home too.
              cx -= dir * 150 * s.u * dt
              ch += 60 * dt
            }
            if (pt > 3.6) post = Math.max(0, post - dt * 0.75)
            if (pt > 5.6) {
              phase = 'exit'
              pt = 0
            }
          } else {
            mood = pt < 1 ? 'oops' : pt < 1.8 ? 'palm' : 'sleep'
            gap = Math.max(15, gap - 8.5 * dt)
            if (gap <= 15) {
              phase = 'exit'
              pt = 0
              mood = 'oops'
              burst(s, 'heart', dx + dir * 8 * s.u, s.ground - 20 * s.u, 12, HEARTS, 90, [3, 5])
            }
          }
        } else if (gag === 'dog') {
          if (pt > 0.9) {
            dx += dir * 105 * s.u * dt
            run += dt * 12
          }
          return !passed(dx, to, dir)
        } else {
          // Two snails, leaving at speed.
          dx += dir * Math.min(280, 40 + pt * 300) * s.u * dt
          run += dt * 30
          if (pt > 0.7) {
            cx -= dir * 170 * s.u * dt
            ch += 70 * dt
          }
          return !(passed(dx, to, dir) && !passed(cx, from, dir))
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        if (gag === 'dog') {
          if (post > 0) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(tx - 30 * u, s.ground - 120 * u, 60 * u, 120 * u)
            ctx.clip()
            at(ctx, tx, s.ground + (1 - easeOut(post)) * 96 * u, u, 1, () => drawLampPost(ctx, s.time))
            ctx.restore()
          }
          const smitten = phase === 'love' || phase === 'exit'
          const leaving = phase === 'exit' && pt > 0.9
          at(ctx, dx - (smitten && !leaving ? dir * 6 * u * easeOut(seg(pt, 0.6, 1.4)) * (phase === 'love' ? 1 : 0) : 0), s.ground, u, (leaving ? dir : -dir) as Dir, () => {
            groundShadow(ctx, 0, 14)
            const d = drawDog(ctx, DOG, {
              run, stride: !arrived ? 0.6 : leaving ? 0.45 : 0, wag: smitten ? t * 22 : t * 6,
              sitting: phase === 'love' && pt > 0.6, tilt: phase === 'love' ? -0.3 + (pt > 3.6 ? seg(pt, 3.6, 5.2) * 0.5 : 0) : phase === 'exit' && !leaving ? 0.25 : arrived && !smitten ? 0.2 : 0,
              mouthOpen: phase === 'love' && pt < 3.6,
            })
            if (phase === 'love' && pt < 3.6) heart(ctx, d.mouth.x - 9, d.mouth.y - 15 - Math.sin(t * 6) * 1.5, 3, C.rose)
          })
          if (phase === 'exit' && pt < 0.9) at(ctx, dx, s.ground, u, 1, () => bubble(ctx, 0, -36, '?'))
        } else {
          const smitten = phase === 'love' || phase === 'exit'
          const zoom = phase === 'exit'
          // The one that was hit turns round to look at the one behind.
          at(ctx, dx, s.ground, u, (smitten ? dir : -dir) as Dir, () => {
            groundShadow(ctx, 0, 11, 0.2)
            drawSnail(ctx, run, shells[0], smitten)
            if (zoom) speedLines(ctx, -14, -8, 14, t)
          })
          at(ctx, dx + dir * gap * u, s.ground, u, (zoom ? dir : -dir) as Dir, () => {
            groundShadow(ctx, 0, 11, 0.2)
            drawSnail(ctx, run + 2, shells[1], smitten && (zoom || pt > 1.2))
          })
          if (phase === 'love' && pt > 0.4 && pt < 1.2) at(ctx, dx + dir * gap * u, s.ground, u, 1, () => bubble(ctx, 0, -24, '!', { color: C.crimson, size: 9 }))
        }
        // Cupid.
        const bobY = Math.sin(t * 3.2) * 2.5 * u + (mood === 'sleep' ? 8 * u : 0)
        const back = (phase === 'love' && gag === 'dog' && pt > 2.6) || (phase === 'exit' && gag === 'snails' && pt > 0.7)
        if (ch < 200) {
          at(ctx, cx, s.ground - ch * u + bobY, u, (back ? -dir : dir) as Dir, () => {
            bow = drawCupid(ctx, t, mood, phase === 'aim' ? easeInOut(seg(pt, 0.2, 1.1)) : 0, phase === 'arrive' || phase === 'aim')
          })
          if (mood === 'sleep') at(ctx, cx, s.ground - ch * u + bobY, u, 1, () => zzz(ctx, 6, -46, t, C.pink))
        }
        if (phase === 'fly') {
          const ang = Math.atan2(s.ground - (gag === 'dog' ? 17 : 9) * u - ay0, (dx - ax0) * 1)
          ctx.save()
          ctx.translate(ax, ay)
          ctx.rotate(ang)
          ctx.scale(u, u)
          line(ctx, -12, 0, 0, 0, 0.9, C.tan)
          heart(ctx, 1, 0, 2.2, C.rose)
          fillPoly(ctx, [-12, 0, -15, -2, -10, 0], C.white)
          fillPoly(ctx, [-12, 0, -15, 2, -10, 0], C.white)
          ctx.restore()
        }
      },
    })
  },
}

// ─── The postman ─────────────────────────────────────────────────────────────
// He staggers on with an envelope nearly his own size, props it up, knocks,
// and tiptoes away as fast as tiptoeing allows. Whoever it was for comes to
// find it. Once in three times it was for the dog.

function drawCard(ctx: Ctx, x: number, y: number, open = 0) {
  if (open > 0.02) {
    fillRR(ctx, x - 13, y - 24 - 9 * open, 26, 12, 1.5, '#fbcfe8')
    heart(ctx, x, y - 26 - 5 * open, 3.4 * open, C.rose)
    fillPoly(ctx, [x - 17, y - 24, x, y - 24 - 13 * open, x + 17, y - 24], '#e8d9b8')
  }
  fillRR(ctx, x - 17, y - 24, 34, 24, 2, C.cream)
  poly(ctx, [x - 16.4, y - 0.8, x - 3, y - 11, x + 3, y - 11, x + 16.4, y - 0.8], 0.8, C.tan)
  if (open < 0.5) {
    poly(ctx, [x - 16.4, y - 23.4, x, y - 11, x + 16.4, y - 23.4], 0.9, C.tan)
    heart(ctx, x, y - 11.4, 3.8, C.crimson)
  }
  // A stamp, properly franked.
  fillRR(ctx, x + 9, y - 22, 5.6, 6.4, 0.6, C.sky)
  line(ctx, x + 5, y - 20.6, x + 9, y - 19.4, 0.6, C.slate)
  line(ctx, x + 5, y - 18.6, x + 9, y - 17.4, 0.6, C.slate)
}

const POSTIE: Look = { skin: C.skinB, top: '#2f6fc0', bottom: '#33507a', shoe: '#27303f', hair: '#3b2a1a', hat: 'cap', hatColor: '#2f6fc0', hatTrim: C.red, pack: '#b4662a', moustache: '#3b2a1a' }

const postman: ActDef = {
  id: 'valentine.postman',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const who = pick(rng, ['girl', 'grandad', 'dog'] as const)
    const look: Look = who === 'grandad' ? CAST.grandad : CAST.girl
    const spot = along(stage, dir, range(rng, 0.46, 0.56))
    const cardX = spot + dir * 24 * stage.u
    const k = who === 'girl' ? 0.84 : 1
    let px = from
    let pwalk = 0
    let pphase: 'carry' | 'set' | 'knock' | 'sneak' | 'gone' = 'carry'
    let pt = 0
    let rx = to
    let rwalk = 0
    let rphase: 'wait' | 'come' | 'open' | 'take' = 'wait'
    let rt = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        rt += dt
        if (pphase === 'carry') {
          px += dir * 62 * s.u * pace(s) * dt
          pwalk += dt * 8.5
          if (passed(px, spot, dir)) {
            pphase = 'set'
            pt = 0
          }
        } else if (pphase === 'set') {
          if (pt > 0.8) {
            pphase = 'knock'
            pt = 0
          }
        } else if (pphase === 'knock') {
          for (const when of [0.2, 0.45, 0.7]) if (pt >= when && pt - dt < when) burst(s, 'star', px + dir * 9 * s.u, s.ground - 2 * s.u, 2, [C.white, C.yellow], 35, [1.5, 2.5])
          if (pt > 1) {
            pphase = 'sneak'
            pt = 0
          }
        } else if (pphase === 'sneak') {
          px -= dir * 112 * s.u * pace(s) * dt
          pwalk += dt * 15
          if (rphase === 'wait' && pt > 0.9) rphase = 'come'
          if (!passed(px, from, dir)) pphase = 'gone'
        }
        if (rphase === 'come') {
          rx -= dir * (who === 'dog' ? 120 : 78) * s.u * pace(s) * dt
          rwalk += dt * (who === 'dog' ? 14 : 9.5)
          if (!passed(rx, cardX + dir * (who === 'dog' ? 30 : 23 * k) * s.u, dir)) {
            rphase = 'open'
            rt = 0
          }
        } else if (rphase === 'open') {
          if (rt > 0.8 && rt < 2.2 && tick(rt, dt, 5)) {
            s.particles.emit({ kind: 'heart', x: cardX + range(rng, -10, 10) * s.u, y: s.ground - 30 * s.u, vx: range(rng, -20, 20) * s.u, vy: -range(rng, 24, 44) * s.u, size: range(rng, 2.5, 4.5) * s.u, color: pick(rng, HEARTS) })
          }
          if (rt > 2.7) {
            rphase = 'take'
            rt = 0
          }
        } else if (rphase === 'take') {
          rx += dir * (who === 'dog' ? 110 : 74) * s.u * pace(s) * dt
          rwalk += dt * (who === 'dog' ? 13 : 9.5)
          return !(passed(rx, to, dir) && pphase === 'gone')
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const delivered = pphase === 'knock' || pphase === 'sneak' || pphase === 'gone'
        if (delivered && rphase !== 'take') {
          const open = rphase === 'open' && who !== 'dog' ? easeOut(seg(rt, 0.5, 0.9)) : 0
          at(ctx, cardX, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 16, 0.2)
            ctx.rotate(-0.07)
            drawCard(ctx, 0, 0, open)
          })
        }
        if (pphase !== 'gone') {
          const sneaking = pphase === 'sneak'
          at(ctx, px, s.ground, u, (sneaking ? -dir : dir) as Dir, () => {
            groundShadow(ctx, 0, 10)
            const setting = pphase === 'set' ? easeInOut(seg(pt, 0, 0.7)) : 0
            const rap = pphase === 'knock' ? Math.abs(Math.sin(pt * 12.5)) : 0
            const a = drawPerson(ctx, POSTIE, sneaking
              ? { walk: pwalk, stride: 0.55, lift: Math.abs(Math.sin(pwalk)) * 3.5, armF: 1.1, elbowF: 1.7, armB: 0.9, elbowB: 1.6, lean: 0.12, mouth: 'flat', eyes: 'wide' }
              : pphase === 'knock'
                ? { crouch: 0.6, lean: 0.3, armF: 0.6 + rap * 0.3, elbowF: 0.1, mouth: 'smile' }
                : { walk: pwalk, stride: pphase === 'carry' ? 0.6 : 0, armF: 1.2 - setting * 0.5, armB: 1.05 - setting * 0.4, elbowF: 0.5, elbowB: 0.6, lean: -0.08 + setting * 0.3, crouch: setting * 0.4, mouth: 'puff', blink: blinking(s.time, 1) })
            if (pphase === 'carry' || pphase === 'set') {
              const cx = lerp(a.handF.x + 10, 24, setting)
              const cy = lerp(a.handF.y + 12, 0, setting)
              ctx.save()
              ctx.translate(cx, cy)
              ctx.rotate(-0.07 * setting + (pphase === 'carry' ? Math.sin(pwalk) * 0.04 : 0))
              drawCard(ctx, 0, 0)
              ctx.restore()
              fillCirc(ctx, a.handF.x, a.handF.y, 2.7, POSTIE.skin)
            }
          })
        }
        if (rphase === 'wait') return
        const taking = rphase === 'take'
        if (who === 'dog') {
          at(ctx, rx, s.ground, u, (taking ? dir : -dir) as Dir, () => {
            groundShadow(ctx, 0, 14)
            const d = drawDog(ctx, DOG, {
              run: rwalk, stride: rphase === 'open' ? 0 : 0.6, wag: t * (rphase === 'come' ? 10 : 22),
              tilt: rphase === 'open' ? Math.sin(rt * 5) * 0.25 : 0, sitting: rphase === 'open' && rt > 1 && rt < 2.3,
            })
            if (taking) {
              ctx.save()
              ctx.translate(d.mouth.x + 3, d.mouth.y + 11)
              ctx.rotate(0.12)
              drawCard(ctx, 0, 0)
              ctx.restore()
            }
          })
          return
        }
        at(ctx, rx, s.ground, u * k, (taking ? dir : -dir) as Dir, () => {
          groundShadow(ctx, 0, 10)
          const opening = rphase === 'open'
          const a = drawPerson(ctx, look, opening
            ? { crouch: rt < 1 ? 0.45 : 0.1, lean: rt < 1 ? 0.25 : -0.06, armF: rt < 1 ? 0.9 : 2.2, elbowF: rt < 1 ? 0.2 : 1.6, mouth: rt < 0.6 ? 'o' : 'grin', eyes: rt < 0.9 ? 'wide' : rt > 1.6 ? 'closed' : 'normal' }
            : { walk: rwalk, stride: 0.78, armF: taking ? 1.25 : undefined, armB: taking ? 1.1 : undefined, elbowF: taking ? 0.5 : undefined, elbowB: taking ? 0.6 : undefined, mouth: taking ? 'grin' : 'smile', blink: blinking(s.time, 4) })
          if (opening && rt > 0.9) fillEll(ctx, a.head.x + 4, a.head.y + 4.6, 3.6, 2.5, 'rgba(244,114,128,0.5)')
          if (taking) {
            ctx.save()
            ctx.translate(a.handF.x + 9, a.handF.y + 12)
            ctx.scale(1 / k, 1 / k)
            drawCard(ctx, 0, 0)
            ctx.restore()
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
          }
        })
      },
    })
  },
}

export const VALENTINE_ACTS: ActDef[] = [shyPair, cupid, postman]

// ═══ Pancake Day ═════════════════════════════════════════════════════════════

const BATTER = '#eab868'
const BROWNED = '#c98d4b'

/** A pancake seen from the side, turning over as `spin` advances. */
function drawPancake(ctx: Ctx, x: number, y: number, r: number, spin = 0) {
  const ry = 1.1 + Math.abs(Math.sin(spin)) * r * 0.55
  fillEll(ctx, x, y + 0.5, r, ry, BROWNED)
  fillEll(ctx, x, y - 0.3, r * 0.94, ry * 0.8, BATTER)
  if (ry > 2.4) {
    fillEll(ctx, x - r * 0.3, y - 0.4, r * 0.22, ry * 0.2, BROWNED)
    fillEll(ctx, x + r * 0.35, y, r * 0.16, ry * 0.16, BROWNED)
  }
}

/** A frying pan held at (hx, hy), pointing forwards or (side = -1) back. Returns where a pancake rests. */
function drawPan(ctx: Ctx, hx: number, hy: number, side = 1): Pt {
  line(ctx, hx - side * 1.5, hy, hx + side * 8, hy - 1, 2.1, '#8b98ab')
  const x0 = side === 1 ? hx + 7 : hx - 22
  fillRR(ctx, x0, hy - 3.4, 15, 3.8, 1.8, '#64748b')
  fillRR(ctx, x0, hy - 3.4, 15, 1.3, 0.65, '#8b98ab')
  return { x: x0 + 7.5, y: hy - 4.2 }
}

const CHEF: Look = { skin: C.skinA, top: '#e8eef5', bottom: '#56657c', shoe: '#27303f', hair: '#7a3f1d', hat: 'chef', apron: '#fca5a5' }

// ─── The toss ────────────────────────────────────────────────────────────────
// A cook flips a pancake. Then higher. Then so high that it does not come back
// at all, and there is a long wait with an empty pan. It does come down in the
// end: either on the hat, well after everyone has stopped looking, or neatly
// into the pan behind the cook's back.

const toss: ActDef = {
  id: 'pancake.toss',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const gag = chance(rng, 0.5) ? 'hat' : 'catch'
    const look: Look = chance(rng, 0.5) ? CHEF : { ...CAST.dad, hat: 'chef', apron: '#bfdbfe' }
    const spot = along(stage, dir, range(rng, 0.4, 0.55))
    const TOSS = [1.6, 2.1, 1.0]
    let x = from
    let walk = 0
    let phase: 'in' | 'toss' | 'wait' | 'catch' | 'out' = 'in'
    let pt = 0
    let n = 0
    let stuck = 0 // seconds since the pancake landed on the hat
    let landed = false
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'in') {
          x += dir * 70 * s.u * pace(s) * dt
          walk += dt * 9.5
          if (passed(x, spot, dir)) {
            phase = 'toss'
            pt = 0
          }
        } else if (phase === 'toss') {
          if (pt > TOSS[n]) {
            pt = 0
            n++
            if (n === 3) phase = 'wait'
          }
        } else if (phase === 'wait') {
          if (pt > 3.4) {
            phase = gag === 'catch' ? 'catch' : 'out'
            pt = 0
          }
        } else if (phase === 'catch') {
          if (!landed && pt > 1.1) {
            landed = true
            burst(s, 'star', x - dir * 16 * s.u, s.ground - 24 * s.u, 8, SPARKLE, 80, [2, 4])
          }
          if (pt > 3) {
            phase = 'out'
            pt = 0
          }
        } else {
          if (gag === 'hat' && !landed && pt > 1.5) {
            landed = true
            burst(s, 'star', x, s.ground - 74 * s.u, 6, SPARKLE, 70, [2, 3.5])
          }
          if (gag === 'hat' && landed) stuck += dt
          if (gag === 'hat' && landed && stuck < 1.3) return true
          x += dir * 70 * s.u * pace(s) * dt
          walk += dt * 9.5
          return !passed(x, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        // How high the pancake is above the pan, and how far round it has gone.
        let high = 0
        let spin = 0
        let inPan = phase === 'in' || phase === 'toss'
        let wind = 0
        if (phase === 'toss') {
          const hang = TOSS[n] - 0.6
          const k = seg(pt, 0.4, 0.4 + hang)
          wind = Math.sin(seg(pt, 0, 0.4) * Math.PI)
          if (n < 2) {
            high = (n === 0 ? 34 : 82) * 4 * k * (1 - k)
            spin = k * Math.PI * (n === 0 ? 2 : 4)
          } else {
            high = k * k * 900 + k * 200
            spin = k * 30
            inPan = pt < 0.4 || high < 600
          }
        }
        const behind = phase === 'catch' || (phase === 'out' && gag === 'catch')
        const k = phase === 'catch' ? pt : 0
        let pose: Pose
        if (phase === 'in') pose = { walk, stride: 0.75, armF: 1.2, elbowF: 0.5, mouth: 'smile', blink: blinking(s.time, 1) }
        else if (phase === 'toss') {
          const up = seg(pt, 0.4, 0.55)
          pose = { crouch: wind * 0.35 * (1 - up), armF: 1.2 + up * 0.5 * (1 - seg(pt, 0.7, 1)), elbowF: 0.5, lift: up * (1 - seg(pt, 0.55, 0.8)) * (n + 1) * 2, headTilt: -clamp(high / 120) * 0.5, mouth: high > 60 ? 'o' : 'smile', eyes: n === 2 && pt > 0.5 ? 'wide' : 'normal' }
        } else if (phase === 'wait') {
          if (pt < 1.3) pose = { armF: 1.2, elbowF: 0.5, armB: 2.4, elbowB: 1.9, headTilt: -0.5, mouth: 'o', eyes: 'wide' }
          else if (pt < 2.3) pose = { armF: 1.5, elbowF: 0.9, headTilt: 0.3, lean: 0.1, mouth: 'flat' }
          else pose = { armF: 1.0, elbowF: -0.2, armB: -1.0, elbowB: 0.2, headTilt: Math.sin(pt * 7) * 0.08, mouth: 'flat', eyes: 'closed' }
        } else if (phase === 'catch') {
          pose = k < 1.1
            ? { armF: -0.9, elbowF: -0.3, armB: 0.3, mouth: 'flat', eyes: 'closed', headTilt: 0.1 }
            : k < 1.8
              ? { armF: -0.9, elbowF: -0.3, mouth: 'o', eyes: 'wide', headTilt: -0.1 }
              : { armF: -0.9, elbowF: -0.3, armB: 1.6, elbowB: 0.2, lean: 0.45 * Math.sin(seg(k, 1.8, 3) * Math.PI), mouth: 'grin', eyes: 'closed' }
        } else {
          const halted = gag === 'hat' && landed && stuck < 1.3
          pose = halted
            ? { armF: 1.0, elbowF: 0.4, headTilt: -0.15, mouth: 'flat', eyes: stuck < 0.6 ? 'wide' : 'closed' }
            : { walk, stride: 0.75, armF: gag === 'catch' ? -0.9 : 1.0, elbowF: gag === 'catch' ? -0.3 : 0.4, mouth: gag === 'catch' ? 'grin' : 'flat', blink: blinking(s.time, 1) }
        }
        at(ctx, x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, look, pose)
          const rest = drawPan(ctx, a.handF.x, a.handF.y, behind ? -1 : 1)
          fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
          if (inPan) drawPancake(ctx, rest.x, rest.y - high, 7, spin)
          if (phase === 'catch' && k > 0.6 && k < 1.1) drawPancake(ctx, rest.x, rest.y - (1 - easeIn(seg(k, 0.6, 1.1))) * 260, 7, k * 14)
          if (behind && landed) drawPancake(ctx, rest.x, rest.y, 7, 0)
          if (gag === 'hat' && phase === 'out') {
            const hy = a.crown.y - 16.5
            if (!landed && pt > 1) drawPancake(ctx, a.crown.x + 1, hy - (1 - easeIn(seg(pt, 1, 1.5))) * 260, 7, pt * 14)
            if (landed) {
              // Draped over the top of the hat, drooping at both sides.
              fillEll(ctx, a.crown.x + 1, hy + 0.6, 9.4, 2.6, BROWNED)
              fillEll(ctx, a.crown.x + 1, hy, 9, 2.2, BATTER)
              fillEll(ctx, a.crown.x - 7.4, hy + 2.6, 2.4, 3.4, BATTER, 0.3)
              fillEll(ctx, a.crown.x + 9.4, hy + 2.6, 2.4, 3.4, BATTER, -0.3)
            }
          }
        })
        if (phase === 'wait' && pt > 1.3 && pt < 2.3) at(ctx, x, s.ground, u, 1, () => bubble(ctx, 0, -78, '?'))
        void t
      },
    })
  },
}

// ─── The pancake race ────────────────────────────────────────────────────────
// Two or three runners, pans out in front, pancakes going up and down in time.
// The dog is running too, for reasons of its own. One pancake goes long: it
// either lands across the dog's head like a hat, or the dog simply catches it.

const race: ActDef = {
  id: 'pancake.race',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 80)
    const n = chance(rng, 0.5) ? 3 : 2
    const loser = Math.floor(rng() * n)
    const gag = chance(rng, 0.5) ? 'draped' : 'caught'
    const loseAt = along(stage, dir, range(rng, 0.34, 0.48))
    const looks: Look[] = [
      { ...CAST.mum, apron: '#fde68a', hat: 'cap', hatColor: C.pink },
      { ...CAST.grandad, apron: C.white },
      { ...CAST.dad, apron: '#bfdbfe', hat: 'bobble', hatColor: C.orange },
    ]
    const GAP = 27
    let x = from
    let run = 0
    let lost = false
    let lt = 0
    let dogAhead = 36
    let pan: Pt = { x: 0, y: 0 } // the loser's pan, on screen
    let land: Pt = { x: 0, y: 0 } // where on the dog it comes down, on screen
    return makeAct({
      update(s, dt) {
        x += dir * 132 * s.u * pace(s) * dt
        run += dt * 15
        if (!lost && passed(x - dir * loser * GAP * s.u, loseAt, dir)) lost = true
        if (lost) {
          lt += dt
          dogAhead += 15 * dt
        }
        return !passed(x - dir * (n * GAP + 12) * s.u, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const q = lost ? lt / 0.9 : 0
        for (let i = n - 1; i >= 0; i--) {
          const mine = i === loser
          const off = mine && lost ? lerp(i * GAP, -(dogAhead - 20), easeInOut(seg(lt, 0.9, 3))) : i * GAP
          const rx = x - dir * off * u
          at(ctx, rx, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 10)
            const empty = mine && lost
            const a = drawPerson(ctx, looks[i], {
              walk: run + i * 2, stride: 1, lean: empty ? 0.3 : 0.18,
              armF: empty ? 1.75 : 1.2, elbowF: empty ? 0.1 : 0.5,
              mouth: empty ? 'o' : 'grin', eyes: empty ? 'wide' : 'normal', blink: blinking(s.time, i),
            })
            const rest = drawPan(ctx, a.handF.x, a.handF.y)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, looks[i].skin)
            if (mine) pan = { x: rx + dir * rest.x * u, y: s.ground + rest.y * u }
            if (!empty) {
              const c = ((run * 0.33 + i * 2.1) / TAU) % 1
              const k = c < 0.6 ? c / 0.6 : 0
              drawPancake(ctx, rest.x, rest.y - Math.sin(k * Math.PI) * 20, 6.5, k * TAU)
            }
          })
        }
        const got = q >= 1
        const jump = gag === 'caught' && lost ? Math.sin(seg(lt, 0.5, 1.3) * Math.PI) * 11 : 0
        const dogX = x + dir * dogAhead * u
        at(ctx, dogX, s.ground - jump * u, u, dir, () => {
          if (jump < 1) groundShadow(ctx, 0, 14)
          const d = drawDog(ctx, DOG, { run: run * 0.95, stride: 1, wag: t * 18, mouthOpen: gag === 'caught' && lost && !got })
          const hx = d.mouth.x - 10
          const hy = d.mouth.y - 12.5
          const tx = gag === 'draped' ? hx : d.mouth.x + 2
          const ty = gag === 'draped' ? hy : d.mouth.y - 0.5
          land = { x: dogX + dir * tx * u, y: s.ground - jump * u + ty * u }
          if (!got) return
          if (gag === 'draped') {
            // Right over its eyes. It has not slowed down at all.
            fillEll(ctx, hx, hy + 0.6, 8.6, 2.8, BROWNED)
            fillEll(ctx, hx, hy, 8.2, 2.4, BATTER)
            fillEll(ctx, hx + 6.4, hy + 3.2, 2.6, 4, BATTER, -0.25)
            fillEll(ctx, hx - 6.6, hy + 2.6, 2.4, 3.2, BATTER, 0.3)
          } else {
            fillEll(ctx, tx, ty + 2.4 + Math.sin(run) * 0.8, 3, 5.6, BATTER, 0.15)
            fillEll(ctx, tx, ty + 6 + Math.sin(run) * 0.8, 2.6, 2, BROWNED, 0.15)
          }
        })
        if (lost && !got) {
          // The long one, from the pan it left to the dog it is going to meet.
          at(ctx, lerp(pan.x, land.x, q), lerp(pan.y, land.y, q) - Math.sin(q * Math.PI) * 44 * u, u, dir, () => drawPancake(ctx, 0, 0, 6.5, q * 9))
        }
      },
    })
  },
}

// ─── The stack ───────────────────────────────────────────────────────────────
// A tower of pancakes with butter and syrup, carried very carefully and swaying
// all the way up. A child follows, and every few steps the tower is one shorter.
// Sometimes the carrier turns round, and finds a child looking at the ceiling.

const stack: ActDef = {
  id: 'pancake.stack',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const gag = chance(rng, 0.5) ? 'turn' : 'oblivious'
    const carrier: Look = chance(rng, 0.5) ? CHEF : { ...CAST.grandad, apron: C.white }
    const child: Look = chance(rng, 0.5) ? CAST.kid : CAST.girl
    const turnAt = along(stage, dir, range(rng, 0.5, 0.62))
    const v = 52 * stage.u * pace(stage)
    let count = 11
    let x = from
    let walk = 0
    let stealIn = 1.4
    let grab = -1 // seconds into a grab, or -1
    let took = false
    let eat = 0
    let hold = 0
    let done = false
    return makeAct({
      update(s, dt, t) {
        if (gag === 'turn' && !done && grab < 0 && passed(x, turnAt, dir)) {
          done = true
          hold = 2.6
        }
        if (hold > 0) {
          hold -= dt
          if (hold < 1.6 && hold + dt >= 1.6) s.particles.emit({ kind: 'note', x: x - dir * 24 * s.u, y: s.ground - 40 * s.u, vx: -dir * 8 * s.u, vy: -22 * s.u, size: 3 * s.u, color: C.white })
          return true
        }
        x += dir * v * dt
        walk += dt * 8.5
        eat = Math.max(0, eat - dt)
        const onStage = x > 50 * s.u && x < s.w - 50 * s.u
        if (grab < 0) {
          if (onStage) stealIn -= dt
          if (stealIn <= 0 && count > 3) grab = 0
        } else {
          grab += dt
          if (!took && grab >= 0.36) {
            took = true
            count--
            eat = 1.1
          }
          if (grab >= 0.72) {
            grab = -1
            took = false
            stealIn = range(rng, 1, 1.7)
          }
        }
        if (tick(t, dt, 1.2) && onStage) {
          s.particles.emit({ kind: 'drop', x: x + dir * range(rng, 14, 26) * s.u, y: s.ground - 34 * s.u, size: 2.2 * s.u, color: '#d97706', life: 1 })
        }
        return !passed(x - dir * 44 * s.u, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const turned = hold > 0 && hold < 2.2 && hold > 0.5
        const hop = grab >= 0 ? Math.sin((grab / 0.72) * Math.PI) : 0
        // The thief.
        at(ctx, x - dir * (30 - hop * 9) * u, s.ground, u * 0.82, dir, () => {
          groundShadow(ctx, 0, 9 - hop * 3)
          const a = drawPerson(ctx, child, hold > 0
            ? { armF: -0.8, elbowF: -0.5, armB: -0.6, headTilt: -0.3, mouth: 'o', eyes: 'closed' }
            : {
                walk: walk * 1.3, stride: grab >= 0 ? 0.3 : 0.6, lift: hop * 15, crouch: grab >= 0 && grab < 0.1 ? 0.4 : 0.1,
                armF: grab >= 0 ? 2.75 : eat > 0 ? 1.6 : 0.6, elbowF: grab >= 0 ? 0.1 : eat > 0 ? 1.3 : 0.5, lean: 0.12,
                mouth: eat > 0 && grab < 0 ? 'puff' : grab >= 0 ? 'o' : 'smile', eyes: grab >= 0 ? 'wide' : 'normal', blink: blinking(s.time, 3),
              })
          if ((took || eat > 0.3) && hold <= 0) drawPancake(ctx, a.handF.x + 1, a.handF.y - 1.5, 6, 0.9)
          if (hold > 0) drawPancake(ctx, a.handF.x - 2, a.handF.y, 5, 1.2)
        })
        // The carrier and the tower.
        at(ctx, x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 11)
          if (turned) ctx.scale(-1, 1)
          const a = drawPerson(ctx, carrier, {
            walk, stride: hold > 0 ? 0 : 0.42, armF: 1.2, elbowF: 0.5, armB: 1.05, elbowB: 0.6, lean: -0.1,
            headTilt: turned ? 0 : -0.22, mouth: turned ? 'flat' : 'o', eyes: turned ? 'normal' : 'wide', blink: blinking(s.time, 1),
          })
          const px = a.handF.x + 5
          const py = a.handF.y - 1
          fillEll(ctx, px, py + 0.8, 12, 2.2, '#e2e8f0')
          let topX = px
          for (let i = 0; i < count; i++) {
            const sway = Math.sin(t * 2.6 + i * 0.36) * i * 0.34 + Math.sin(walk) * i * 0.12
            topX = px + sway
            const y = py - 1.4 - i * 2.5
            fillEll(ctx, topX, y + 0.7, 9.2, 1.9, BROWNED)
            fillEll(ctx, topX, y, 9, 1.6, BATTER)
          }
          const ty = py - 1.4 - (count - 1) * 2.5
          // Syrup over the top and down the sides, and a pat of butter.
          fillEll(ctx, topX, ty - 0.5, 6.4, 1.3, '#d97706')
          line(ctx, topX - 6.6, ty, topX - 7.4, ty + 5, 1.5, '#d97706')
          line(ctx, topX + 5.4, ty, topX + 6.6, ty + 7.5, 1.5, '#d97706')
          line(ctx, topX + 1, ty + 0.6, topX + 1.4, ty + 3.4, 1.3, '#d97706')
          fillRR(ctx, topX - 2.2, ty - 2.6, 4.4, 2.2, 0.6, '#fef08a')
          fillCirc(ctx, a.handF.x, a.handF.y, 2.7, carrier.skin)
        })
        if (turned) at(ctx, x, s.ground, u, 1, () => bubble(ctx, 0, -70, '?'))
      },
    })
  },
}

export const PANCAKE_ACTS: ActDef[] = [toss, race, stack]
