import { DOG, drawDog } from '../creatures'
import { C, TAU, alpha, at, clamp, easeBack, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, star, type Ctx } from '../draw'
import { banner, blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { CAST, drawPerson, type Look } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Stage } from '../types'

// Bonfire Night and New Year. Everything that goes bang here goes bang quietly:
// bursts are a few dozen sparks, low over the floor, and nothing flashes. The
// comedy is in the people, who are all slightly nervous of the fireworks, and
// right to be.

// ─── Shared bits ─────────────────────────────────────────────────────────────

const FIRE = ['#fde047', '#fb923c', '#f59e0b', '#ef4444']
const GOLD_SILVER = ['#f5c542', '#fde68a', '#e2e8f0', '#cbd5e1']
const ROCKET_COLOURS: string[][] = [
  ['#f9a8d4', '#fb7185', '#fde047'],
  ['#5eead4', '#7dd3fc', '#f1f5f9'],
  ['#fde047', '#fb923c', '#f1f5f9'],
  ['#a78bfa', '#f9a8d4', '#7dd3fc'],
  ['#4ade80', '#fde047', '#5eead4'],
]

const past = (x: number, target: number, dir: 1 | -1) => (dir === 1 ? x >= target : x <= target)
const flip = (d: 1 | -1): 1 | -1 => (d === 1 ? -1 : 1)
/** The x that is fraction `f` of the way across, measured from the side the act came in on. */
const along = (s: Stage, dir: 1 | -1, f: number) => (dir === 1 ? s.w * f : s.w * (1 - f))

/** A speech bubble that reads the right way round whichever way the speaker faces. */
function say(s: Stage, x: number, up: number, text: string, opts?: { color?: string; bg?: string; size?: number }) {
  at(s.ctx, x, s.ground, s.u, 1, () => bubble(s.ctx, 0, -up, text, opts))
}

/** A ring of sparks with a few stars in the middle. Never more than 40 pieces. */
function ringBurst(s: Stage, x: number, y: number, colors: readonly string[], n = 26, speed = 105, size = 2.6) {
  const off = Math.random() * TAU
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU
    const v = speed * (0.9 + Math.random() * 0.2) * s.u
    s.particles.emit({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 55, drag: 0.42, size: size * s.u, color: colors[i % colors.length], life: 1.15 })
  }
  const stars = Math.min(8, Math.floor(n / 3))
  for (let i = 0; i < stars; i++) {
    const a = Math.random() * TAU
    const v = speed * 0.45 * Math.random() * s.u
    s.particles.emit({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: (size + 0.6) * s.u, color: colors[0], life: 1.1 })
  }
}

const WRAPPED: Record<'dad' | 'mum' | 'grandad' | 'kid' | 'girl', Look> = {
  dad: { ...CAST.dad, hat: 'bobble', hatColor: C.red, hatTrim: C.white, scarf: C.gold, gloves: '#475569' },
  mum: { ...CAST.mum, hat: 'earmuffs', hatColor: C.mint, scarf: C.purple, gloves: C.pink },
  grandad: { ...CAST.grandad, scarf: C.rust, gloves: '#7a6a52' },
  kid: { ...CAST.kid, hat: 'bobble', hatColor: C.blue, hatTrim: C.yellow, scarf: C.red, gloves: C.green },
  girl: { ...CAST.girl, hat: 'bobble', hatColor: C.pink, hatTrim: C.white, scarf: C.yellow, gloves: C.sky },
}

/** A long lighting taper held out from a hand, glowing at the far end. */
function drawTaper(ctx: Ctx, hx: number, hy: number, len: number, droop: number, t: number) {
  const tx = hx + len
  const ty = hy + droop
  line(ctx, hx - 2, hy, tx, ty, 1.1, '#e7d7b8')
  ctx.globalAlpha = 0.3
  fillCirc(ctx, tx, ty, 3.4 + Math.sin(t * 5) * 0.4, C.orange)
  ctx.globalAlpha = 1
  fillCirc(ctx, tx, ty, 1.5, C.orange)
  fillCirc(ctx, tx, ty, 0.7, C.yellow)
}

// ─── The bonfire ─────────────────────────────────────────────────────────────
// Dad arrives with an armful of logs, the fire catches, and everybody stands
// round it with their hands out, the way people have for a very long time.
// A child writes in the air with a sparkler. Sometimes a log pops and somebody
// finds out how high they can jump in wellingtons.

function drawBonfire(ctx: Ctx, t: number, fire: number, logs: number) {
  if (logs <= 0.01) return
  ctx.save()
  ctx.scale(logs, logs)
  if (fire > 0.02) {
    // Warm light on the floor and in the air. Steady, with a slow breath.
    const br = 0.9 + Math.sin(t * 1.7) * 0.1
    ctx.globalAlpha = 0.1 * fire * br
    fillEll(ctx, 0, -18, 40, 30, C.orange)
    ctx.globalAlpha = 0.16 * fire * br
    fillEll(ctx, 0, 0, 34, 4.5, C.amber)
    ctx.globalAlpha = 1
  }
  // Two logs laid flat, with pale cut ends.
  line(ctx, -16, -2.4, 14, -4, 4.4, '#8b5a2b')
  fillCirc(ctx, -16.5, -2.4, 2.1, '#d6b98a')
  line(ctx, -13, -5, 17, -2, 4.4, '#a16207')
  fillCirc(ctx, 17.5, -2, 2.1, '#e3c99a')
  // Back of the wigwam.
  line(ctx, -5, -1, 0.5, -22, 3.4, '#6b4423')
  line(ctx, 6, -1, 0, -21, 3.2, '#7a4a22')
  if (fire > 0.02) {
    const flame = (w: number, h: number, col: string, ph: number, ox = 0) => {
      const hh = h * fire * (0.9 + 0.1 * Math.sin(t * 5.6 + ph * 2))
      const sw = Math.sin(t * 4.2 + ph) * w * 0.4
      ctx.beginPath()
      ctx.moveTo(ox - w, -3)
      ctx.bezierCurveTo(ox - w * 1.25, -hh * 0.45, ox - w * 0.2 + sw, -hh * 0.6, ox + sw, -hh)
      ctx.bezierCurveTo(ox + w * 0.3 + sw * 0.5, -hh * 0.55, ox + w * 1.25, -hh * 0.4, ox + w, -3)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
    }
    ctx.globalAlpha = 0.92
    flame(6, 27, '#ef4444', 1.3, -8.5)
    flame(6, 30, '#ef4444', 2.6, 8.5)
    flame(13, 44, '#f4572f', 0)
    flame(9.5, 33, C.orange, 0.7, -1)
    flame(6.2, 23, C.yellow, 2.1, 1)
    flame(3, 12, '#fff7d6', 3.2)
    ctx.globalAlpha = 1
  }
  // Front of the wigwam, so the flames sit inside the stack.
  line(ctx, -12, 0, 1.5, -20, 3.6, '#8b5a2b')
  line(ctx, 12, 0, -1.5, -20, 3.6, '#a16207')
  if (fire > 0.3) {
    // Embers glowing in the base.
    ctx.globalAlpha = 0.5 + Math.sin(t * 2.3) * 0.2
    fillEll(ctx, -3, -1.6, 5, 1.4, C.orange)
    fillEll(ctx, 6, -1.2, 3.4, 1.1, C.yellow)
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

interface Walker {
  look: Look
  k: number
  x: number
  slot: number
  face: 1 | -1
  walk: number
  moving: boolean
}

/** Walk `p` toward `target`. Returns true once it is there. */
function walkTo(p: Walker, target: number, speed: number, s: Stage, dt: number): boolean {
  const d = target - p.x
  const step = speed * s.u * dt
  if (Math.abs(d) <= step) {
    p.x = target
    p.moving = false
    return true
  }
  p.x += Math.sign(d) * step
  p.face = d > 0 ? 1 : -1
  p.walk += dt * (speed / 5.6)
  p.moving = true
  return false
}

const bonfire: ActDef = {
  id: 'bonfire.bonfire',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const cx = stage.w * range(rng, 0.38, 0.62)
    const u = stage.u
    const third = stage.w > 520 && chance(rng, 0.6)
    const gag = chance(rng, 0.5) ? 'pop' : 'heart'
    const childLook = chance(rng, 0.5) ? WRAPPED.kid : WRAPPED.girl
    const mk = (look: Look, k: number, slot: number, i: number): Walker => ({ look, k, x: from - dir * i * 30 * u, slot, face: dir, walk: i * 1.7, moving: true })
    // In walking order. The far side of the fire fills up first.
    const cast: Walker[] = []
    if (third) cast.push(mk(WRAPPED.grandad, 1, cx + dir * 66 * u, cast.length))
    const far = mk(WRAPPED.mum, 1, cx + dir * 38 * u, cast.length)
    cast.push(far)
    const dad = mk(WRAPPED.dad, 1, cx - dir * 38 * u, cast.length)
    cast.push(dad)
    const child = mk(childLook, 0.8, cx - dir * 74 * u, cast.length)
    cast.push(child)
    let phase: 'in' | 'light' | 'burn' | 'die' | 'out' = 'in'
    let pt = 0
    let fire = 0
    let logs = 0
    let popped = false
    // The sparkler's recent path, in the child's own units, for the glowing trail.
    const TRAIL = 14
    const trail = new Float32Array(TRAIL * 2)
    let trailN = 0
    let tipX = 0
    let tipY = 0
    const tipAt = (t: number) => {
      const a = t * 4.6
      if (gag === 'heart') {
        const sn = Math.sin(a)
        tipX = 19 + 16 * sn * sn * sn * 0.62
        tipY = -44 - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.62
      } else {
        // A looping scribble: a big circle with a small one riding on it.
        tipX = 19 + Math.cos(a) * 8 + Math.cos(a * 2.5) * 3.5
        tipY = -42 + Math.sin(a) * 9 + Math.sin(a * 2.5) * 3.5
      }
    }
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const tick = (hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        if (phase === 'in') {
          let all = true
          for (const p of cast) if (!walkTo(p, p.slot, 58, s, dt)) all = false
          if (all) {
            next('light')
            burst(s, 'dust', cx, s.ground - 3 * s.u, 6, ['#cbd5e1'], 45, [4, 7])
          }
        } else if (phase === 'light') {
          logs = easeBack(seg(pt, 0, 0.45))
          fire = easeInOut(seg(pt, 0.9, 2.6)) * 0.6
          if (pt > 2.6) next('burn')
        } else if (phase === 'burn') {
          fire = 0.6 + easeOut(seg(pt, 0, 1.5)) * 0.4
          if (gag === 'pop' && !popped && pt > 4.4) {
            popped = true
            for (let i = 0; i < 12; i++) {
              s.particles.emit({ kind: 'spark', x: cx + dir * 6 * s.u, y: s.ground - 12 * s.u, vx: dir * range(rng, 20, 130) * s.u, vy: -range(rng, 60, 170) * s.u, size: range(rng, 2, 3.2) * s.u, color: pick(rng, FIRE), life: 1 })
            }
          }
          if (pt > 9.5) next('die')
        } else if (phase === 'die') {
          fire = 1 - easeInOut(seg(pt, 0, 1.4))
          logs = 1 - easeIn(seg(pt, 1.5, 2.1))
          if (pt >= 1.6 && pt - dt < 1.6) burst(s, 'dust', cx, s.ground - 6 * s.u, 9, ['#94a3b8', '#cbd5e1'], 50, [5, 9])
          if (pt > 2.3) next('out')
        } else {
          let gone = true
          for (const p of cast) {
            walkTo(p, to, 58, s, dt)
            if (!past(p.x, to, dir)) gone = false
          }
          return !gone
        }
        // Embers off the top of the fire.
        if (fire > 0.4 && tick(6)) {
          s.particles.emit({ kind: 'ember', x: cx + range(rng, -8, 8) * s.u, y: s.ground - range(rng, 22, 36) * s.u, vx: range(rng, -8, 8) * s.u, vy: -range(rng, 24, 46) * s.u, size: range(rng, 1.6, 3) * s.u, color: pick(rng, FIRE), life: range(rng, 1.2, 1.9) })
        }
        // The sparkler, once there is a fire to light it from.
        if (phase === 'burn' && pt > 0.8) {
          tipAt(t)
          if (tick(24)) {
            if (trailN < TRAIL) trailN++
            trail.copyWithin(2, 0, (TRAIL - 1) * 2)
            trail[0] = tipX
            trail[1] = tipY
            s.particles.emit({
              kind: 'spark',
              x: child.x + child.face * tipX * child.k * s.u,
              y: s.ground + tipY * child.k * s.u,
              vx: range(rng, -34, 34) * s.u,
              vy: range(rng, -40, 20) * s.u,
              g: 120,
              size: range(rng, 1.4, 2.4) * s.u,
              color: pick(rng, ['#fff7d6', '#fde047', '#f1f5f9']),
              life: 0.5,
            })
          }
        } else trailN = 0
        // Once they have stopped, everyone turns to the fire. The child turns away to wave.
        if (phase !== 'in') for (const p of cast) p.face = p === child ? (p.x < cx ? -1 : 1) : p.x < cx ? 1 : -1
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const lit = phase === 'burn' && pt > 0.8
        const jumpT = popped ? pt - 4.4 : -1
        const jump = jumpT >= 0 && jumpT < 0.55 ? Math.sin((jumpT / 0.55) * Math.PI) * 13 : 0
        const person = (p: Walker) => {
          at(ctx, p.x, s.ground, s.u * p.k, p.face, () => {
            const isFar = p === far
            const hop = isFar ? jump : 0
            groundShadow(ctx, 0, 11 - hop * 0.2)
            const warm = !p.moving && (phase === 'burn' || phase === 'die') && p !== child
            const rub = Math.sin(t * 3 + p.slot) * 0.08
            const lighting = p === dad && phase === 'light' && pt > 0.5 && pt < 2
            const carrying = p === dad && phase === 'in'
            const scare = isFar && jumpT >= 0 && jumpT < 1.3
            const waving = p === child && lit
            let armF: number | undefined
            let elbowF: number | undefined
            if (waving) {
              // Point the arm at wherever the sparkler tip has got to.
              armF = Math.atan2(tipX - 2, tipY + 35)
              elbowF = 0.12
            } else if (p === child && (phase === 'light' || phase === 'burn')) {
              armF = 1
              elbowF = 0.9
            } else if (scare) {
              armF = 2.7
              elbowF = 0.3
            } else if (lighting) {
              armF = 1.05
              elbowF = 0.1
            } else if (warm) {
              armF = 1.3 + rub
              elbowF = 0.25
            } else if (carrying) {
              armF = 0.7
              elbowF = 1.3
            }
            const a = drawPerson(ctx, p.look, {
              walk: p.walk,
              stride: p.moving ? 0.8 : 0,
              lift: hop,
              lean: scare ? -0.2 : lighting ? 0.3 : warm ? 0.06 : 0,
              crouch: lighting ? 0.55 : 0,
              armF,
              elbowF,
              armB: scare ? -2.3 : warm ? 1.05 - rub : carrying ? 0.6 : undefined,
              elbowB: warm ? 0.3 : carrying ? 1.2 : undefined,
              mouth: scare ? 'o' : waving ? 'grin' : warm ? 'smile' : lighting ? 'flat' : 'smile',
              eyes: scare ? 'wide' : 'normal',
              blink: blinking(s.time, p.slot),
            })
            if (carrying) {
              // An armful of logs.
              for (let i = 0; i < 3; i++) {
                line(ctx, a.handF.x - 9, a.handF.y - 1 - i * 3.6, a.handF.x + 9, a.handF.y - 3 - i * 3.6, 3.6, i === 1 ? '#a16207' : '#8b5a2b')
                fillCirc(ctx, a.handF.x + 9.5, a.handF.y - 3 - i * 3.6, 1.7, '#e3c99a')
              }
              fillCirc(ctx, a.handF.x, a.handF.y, 2.7, p.look.gloves ?? p.look.skin)
            }
            if (lighting) {
              // A match, struck and held to the kindling.
              line(ctx, a.handF.x, a.handF.y, a.handF.x + 6, a.handF.y + 2, 0.9, '#e7d7b8')
              fillCirc(ctx, a.handF.x + 6.5, a.handF.y + 2, 1.5 + Math.sin(t * 6) * 0.3, C.yellow)
            }
            if (p === child && (phase === 'light' || phase === 'burn')) {
              if (waving) {
                line(ctx, a.handF.x, a.handF.y, tipX, tipY, 0.8, '#cbd5e1')
                // The trail it leaves hanging in the air.
                ctx.lineCap = 'round'
                for (let i = 0; i + 1 < trailN; i++) {
                  ctx.globalAlpha = (1 - i / TRAIL) * 0.7
                  ctx.strokeStyle = i < 4 ? '#fff7d6' : C.yellow
                  ctx.lineWidth = 1.7 * (1 - i / TRAIL) + 0.4
                  ctx.beginPath()
                  ctx.moveTo(trail[i * 2], trail[i * 2 + 1])
                  ctx.lineTo(trail[i * 2 + 2], trail[i * 2 + 3])
                  ctx.stroke()
                }
                ctx.globalAlpha = 0.35
                fillCirc(ctx, tipX, tipY, 4, C.yellow)
                ctx.globalAlpha = 1
                star(ctx, tipX, tipY, 2.8, '#fff7d6', t * 5, 0.35)
              } else {
                line(ctx, a.handF.x, a.handF.y, a.handF.x + 3, a.handF.y - 13, 0.8, '#cbd5e1')
              }
            }
          })
        }
        // Whoever is on the far side of the fire is drawn first, so the flames overlap them a little.
        for (const p of cast) if (p !== dad && p !== child) person(p)
        at(ctx, cx, s.ground, s.u, 1, () => drawBonfire(ctx, t, fire, logs))
        person(dad)
        person(child)
        if (popped && jumpT > 0.1 && jumpT < 1.2) say(s, far.x, 82, '!', { color: C.crimson })
      },
    })
  },
}

// ─── The rocket ──────────────────────────────────────────────────────────────
// Somebody sets a rocket up in a milk bottle, retires to a safe distance,
// comes back on tiptoe with a taper at arm's length, lights it and runs. One
// time in three it goes up and bursts as intended. One time in three it is a
// crate of three. And one time in three it fizzles, waits for them to come
// and look, then falls over and chases them home.

function drawRocket(ctx: Ctx, col: string, fizz: number, t: number) {
  // Origin at the bottom of the stick, pointing up.
  line(ctx, 0, 0, 0, -24, 1.1, '#d6b98a')
  fillRR(ctx, -2.3, -34, 4.6, 11, 1.4, col)
  fillRR(ctx, -2.3, -30.5, 4.6, 2, 0.3, C.white)
  fillPoly(ctx, [-2.8, -33.4, 0, -40, 2.8, -33.4], shade(col, -0.25))
  line(ctx, 1.6, -23.4, 4, -20.6, 0.7, '#e7d7b8')
  if (fizz > 0) {
    ctx.globalAlpha = 0.35 * fizz
    fillCirc(ctx, 4.2, -20.4, 3 + Math.sin(t * 6) * 0.5, C.orange)
    ctx.globalAlpha = 1
    fillCirc(ctx, 4.2, -20.4, 1.1, C.yellow)
  }
}

function drawMilkBottle(ctx: Ctx) {
  fillRR(ctx, -3.4, -13, 6.8, 13, 2, '#5aa884')
  fillPoly(ctx, [-3.4, -12, -1.5, -17, 1.5, -17, 3.4, -12], '#5aa884')
  fillRR(ctx, -1.6, -21, 3.2, 5, 0.8, '#6fbf9a')
  ctx.globalAlpha = 0.4
  fillRR(ctx, -2.4, -11, 1.3, 8, 0.6, C.white)
  ctx.globalAlpha = 1
}

function drawCrate(ctx: Ctx) {
  for (const bx of [-8, 0, 8]) fillRR(ctx, bx - 1.5, -16, 3, 7, 0.8, '#6fbf9a')
  fillRR(ctx, -13.5, -10.5, 27, 10.5, 1.4, '#a16207')
  fillRR(ctx, -13.5, -7.4, 27, 1.4, 0.4, '#7a4a22')
  fillRR(ctx, -13.5, -3.6, 27, 1.4, 0.4, '#7a4a22')
  line(ctx, -9, -10, -9, -0.6, 1, '#7a4a22')
  line(ctx, 9, -10, 9, -0.6, 1, '#7a4a22')
}

const rocket: ActDef = {
  id: 'bonfire.rocket',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const mode = pick(rng, ['single', 'triple', 'fizzle'] as const)
    const look = pick(rng, [WRAPPED.dad, WRAPPED.grandad, WRAPPED.mum])
    const S = along(stage, dir, range(rng, 0.42, 0.52))
    const u = stage.u
    const n = mode === 'triple' ? 3 : 1
    const offs = mode === 'triple' ? [-8, 0, 8] : [0]
    const stemY = mode === 'triple' ? 12 : 15 // how high in the bottle the stick sits
    const cols: string[][] = []
    const used = Math.floor(rng() * ROCKET_COLOURS.length)
    for (let i = 0; i < n; i++) cols.push(ROCKET_COLOURS[(used + i * 2) % ROCKET_COLOURS.length])
    const apex = Math.min(stage.ground * 0.4, 215 * u)
    const launchAt = [1.6, 2.6, 3.6]
    const tilt = mode === 'triple' ? [-0.2, 0.04, 0.24] : [range(rng, -0.1, 0.1)]
    const FLIGHT = 0.85
    let x = from
    let walk = 0
    let face: 1 | -1 = dir
    let phase: 'in' | 'place' | 'retreat' | 'tiptoe' | 'light' | 'run' | 'hide' | 'cheer' | 'collect' | 'exit' | 'peek' | 'uhoh' | 'flee' = 'in'
    let pt = 0
    let placed = false
    let held = true
    let fuse = -1 // seconds since the fuse caught, or -1
    const state = [0, 0, 0] // per rocket: 0 waiting, 1 flying, 2 gone
    let propX = S
    let topple = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const tick = (hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        const go = (target: number, speed: number) => {
          const d = target - x
          const step = speed * s.u * dt
          walk += dt * (speed / 5.6)
          if (Math.abs(d) <= step) {
            x = target
            return true
          }
          x += Math.sign(d) * step
          face = d > 0 ? 1 : -1
          return false
        }
        if (fuse >= 0) fuse += dt
        if (phase === 'in') {
          if (go(S - dir * 16 * s.u, 54)) next('place')
        } else if (phase === 'place') {
          face = dir
          if (pt > 0.45) {
            placed = true
            held = false
          }
          if (pt > 0.9) next('retreat')
        } else if (phase === 'retreat') {
          if (go(S - dir * 54 * s.u, 50)) next('tiptoe')
        } else if (phase === 'tiptoe') {
          if (go(S - dir * 31 * s.u, 17)) next('light')
        } else if (phase === 'light') {
          face = dir
          if (pt > 0.7 && fuse < 0) fuse = 0
          if (pt > 1) next('run')
        } else if (phase === 'run') {
          if (go(S - dir * 92 * s.u, 150)) next('hide')
        } else if (phase === 'hide') {
          face = dir
          if (mode === 'fizzle') {
            if (fuse > 3.4) next('peek')
          } else if (fuse > launchAt[n - 1] + FLIGHT + 1.5) next('cheer')
        } else if (phase === 'cheer') {
          if (pt > 1.4) next('collect')
        } else if (phase === 'collect') {
          if (go(S - dir * 14 * s.u, 54)) {
            face = dir
            if (!held && pt > 0.1) {
              held = true
              placed = false
            }
            next('exit')
          }
        } else if (phase === 'exit') {
          go(to, 54)
          return !past(x, to, dir)
        } else if (phase === 'peek') {
          // It has gone out. Probably. Better have a look.
          if (pt > 0.9 && go(S - dir * 30 * s.u, 17)) next('uhoh')
        } else if (phase === 'uhoh') {
          face = dir
          topple = easeIn(seg(pt, 0.6, 1.1))
          if (pt >= 0.6 && pt - dt < 0.6) burst(s, 'spark', S, s.ground - 18 * s.u, 8, FIRE, 80, [1.6, 2.6])
          if (pt > 1.3) next('flee')
        } else {
          // Flat on its side, lit, and pointing at them. Everybody leaves the way they came.
          topple = 1
          go(from - dir * 80 * s.u, 165)
          propX -= dir * lerp(60, 190, easeOut(seg(pt, 0, 1.2))) * s.u * dt
          if (tick(26)) {
            s.particles.emit({ kind: 'spark', x: propX + dir * 4 * s.u, y: s.ground - range(rng, 2, 6) * s.u, vx: dir * range(rng, 30, 110) * s.u, vy: -range(rng, 0, 50) * s.u, size: range(rng, 1.6, 2.8) * s.u, color: pick(rng, FIRE), life: 0.5 })
          }
          return !past(propX, from - dir * 30 * s.u, flip(dir))
        }
        // The fuse, the launches and the bursts run on their own clock.
        if (fuse >= 0) {
          const fizzing = mode === 'fizzle' ? fuse < 1.5 : fuse < launchAt[n - 1]
          if (fizzing && tick(14)) {
            const i = mode === 'triple' ? Math.min(2, Math.floor(Math.max(0, fuse - 0.6))) : 0
            s.particles.emit({ kind: 'spark', x: S + (offs[i] + 4) * s.u, y: s.ground - (stemY + 20) * s.u, vx: range(rng, -30, 30) * s.u, vy: -range(rng, 10, 50) * s.u, size: range(rng, 1.3, 2.2) * s.u, color: pick(rng, FIRE), life: 0.4 })
          }
          if (mode === 'fizzle' && fuse >= 1.5 && fuse - dt < 1.5) burst(s, 'dust', S + 4 * s.u, s.ground - 34 * s.u, 4, ['#94a3b8'], 30, [3, 5])
          if (mode !== 'fizzle') {
            for (let i = 0; i < n; i++) {
              const q = (fuse - launchAt[i]) / FLIGHT
              if (state[i] === 0 && q >= 0) {
                state[i] = 1
                burst(s, 'dust', S + offs[i] * s.u, s.ground - 20 * s.u, 4, ['#cbd5e1'], 50, [4, 7])
              }
              if (state[i] === 1) {
                const rx = S + (offs[i] + Math.sin(tilt[i]) * (apex / s.u) * 0.5 * q) * s.u
                const ry = s.ground - stemY * s.u - apex * easeOut(clamp(q)) * (i === 1 ? 1 : 0.86)
                if (tick(30)) s.particles.emit({ kind: 'spark', x: rx, y: ry, vx: range(rng, -14, 14) * s.u, vy: range(rng, 20, 70) * s.u, size: range(rng, 1.4, 2.4) * s.u, color: pick(rng, ['#fde047', '#fb923c']), life: 0.38 })
                if (q >= 1) {
                  state[i] = 2
                  ringBurst(s, rx, ry - 34 * s.u, cols[i], mode === 'triple' ? 24 : 30, mode === 'triple' ? 92 : 112)
                }
              }
            }
          }
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const lit = fuse >= 0 && (mode === 'fizzle' ? fuse < 1.5 || phase === 'uhoh' || phase === 'flee' : true)
        const droop = mode === 'fizzle' && fuse > 1.5 ? easeOut(seg(fuse, 1.5, 2.1)) * 0.5 : 0
        const prop = () => {
          if (mode === 'triple') drawCrate(ctx)
          else drawMilkBottle(ctx)
          for (let i = 0; i < n; i++) {
            if (state[i] !== 0) continue
            ctx.save()
            ctx.translate(offs[i], -stemY)
            ctx.rotate(tilt[i] * 0.4 + droop * dir)
            const fz = lit && (mode !== 'triple' || fuse > i + 0.6 - 0.6 * (i === 0 ? 1 : 0)) ? 1 : 0
            drawRocket(ctx, cols[i][0], fz, t)
            ctx.restore()
          }
        }
        if (placed) {
          at(ctx, propX, s.ground, s.u, 1, () => groundShadow(ctx, 0, mode === 'triple' ? 16 : 6))
          // Tipped right over, it lies along the floor with its nose toward the runner.
          at(ctx, propX, s.ground - topple * 4 * s.u, s.u, 1, prop, -dir * topple * (Math.PI / 2))
        }
        // Rockets in the air.
        for (let i = 0; i < n; i++) {
          if (state[i] !== 1) continue
          const q = clamp((fuse - launchAt[i]) / FLIGHT)
          const rx = S + (offs[i] + Math.sin(tilt[i]) * (apex / s.u) * 0.5 * q) * s.u
          const ry = s.ground - stemY * s.u - apex * easeOut(q) * (i === 1 ? 1 : 0.86)
          at(ctx, rx, ry, s.u, 1, () => drawRocket(ctx, cols[i][0], 1, t), tilt[i] * (0.4 + q))
        }
        const tip = phase === 'tiptoe' || phase === 'peek'
        const hiding = phase === 'hide'
        const cheer = phase === 'cheer'
        const taper = phase === 'retreat' || phase === 'tiptoe' || phase === 'light' || phase === 'run'
        const moving = phase === 'in' || phase === 'retreat' || phase === 'run' || phase === 'collect' || phase === 'exit' || phase === 'flee' || (phase === 'tiptoe' && true) || (phase === 'peek' && pt > 0.9)
        const fast = phase === 'run' || phase === 'flee'
        const hopUp = cheer ? Math.abs(Math.sin(pt * 7)) * 7 : 0
        at(ctx, x, s.ground, s.u, face, () => {
          groundShadow(ctx, 0, 11 - hopUp * 0.2)
          const reach = phase === 'light'
          const flinch = hiding && mode !== 'fizzle' && fuse > launchAt[0]
          const a = drawPerson(ctx, look, {
            walk,
            stride: !moving ? 0 : fast ? 1 : tip ? 0.32 : 0.8,
            crouch: phase === 'place' ? 0.7 : tip ? 0.3 : hiding ? 0.55 : reach ? 0.25 : 0,
            lean: fast ? 0.3 : reach ? 0.34 : tip ? 0.1 : phase === 'uhoh' ? -0.2 : 0,
            lift: hopUp,
            armF: cheer ? 2.9 : hiding ? 2.2 : reach || tip ? 1.45 : taper ? 1.1 : phase === 'place' ? 1 : held ? 0.8 : phase === 'uhoh' ? 2.5 : undefined,
            elbowF: cheer ? 0.2 : hiding ? 1.5 : reach || tip ? 0.1 : taper ? 0.5 : held ? 0.9 : undefined,
            armB: cheer ? -2.9 : hiding ? 2 : tip ? -0.9 : phase === 'uhoh' ? -2.2 : undefined,
            elbowB: hiding ? 1.5 : undefined,
            mouth: cheer ? 'grin' : fast || phase === 'uhoh' ? 'o' : tip || reach ? 'flat' : hiding ? (flinch ? 'grin' : 'flat') : 'smile',
            eyes: fast || phase === 'uhoh' ? 'wide' : hiding && !flinch ? 'closed' : 'normal',
            blink: blinking(s.time, 3),
          })
          if (held && !placed) {
            ctx.save()
            ctx.translate(a.handF.x + (mode === 'triple' ? 6 : 3), a.handF.y + (mode === 'triple' ? 8 : 14))
            prop()
            ctx.restore()
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.gloves ?? look.skin)
          }
          if (taper && phase !== 'peek') drawTaper(ctx, a.handF.x, a.handF.y, phase === 'run' ? 12 : 22, reach ? 1 : -3, t)
          if (fast) speedLines(ctx, -14, -30, 14, t)
          if (tip) sweat(ctx, a.head.x, a.head.y - 8, t)
        })
        if (phase === 'peek' && pt < 0.9) say(s, x, 68, '?')
        if (phase === 'uhoh' && pt > 0.6) say(s, x, 80, '!', { color: C.crimson })
        if (hiding && mode !== 'fizzle' && fuse > launchAt[0] + FLIGHT && fuse < launchAt[n - 1] + FLIGHT + 1.3) say(s, x, 66, 'ooh')
      },
    })
  },
}

// ─── The Catherine wheel ─────────────────────────────────────────────────────
// Nailed to a post, lit, admired. Then the nail gives up. The wheel lands on
// its edge, still going, and takes a strong interest in whoever lit it. When
// the coast is clear the dog comes and fetches the post, since somebody
// obviously threw it.

function drawWheel(ctx: Ctx, ang: number, lit: number) {
  if (lit > 0) {
    ctx.globalAlpha = 0.22 * lit
    fillCirc(ctx, 0, 0, 13, C.gold)
    ctx.globalAlpha = 1
  }
  ctx.save()
  ctx.rotate(ang)
  fillCirc(ctx, 0, 0, 9, '#be123c')
  fillCirc(ctx, 0, 0, 6.6, '#fb7185')
  // The coiled fuse, wound out from the middle.
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU * 2.5
    const r = 1 + (i / 40) * 7.4
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.strokeStyle = C.gold
  ctx.stroke()
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU
    fillRR(ctx, Math.cos(a) * 8.6 - 1.5, Math.sin(a) * 8.6 - 1.5, 3, 3, 0.8, '#1e3a5f')
  }
  ctx.restore()
  fillCirc(ctx, 0, 0, 1.7, C.grey)
}

const catherineWheel: ActDef = {
  id: 'bonfire.catherine-wheel',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 50)
    const stall = chance(rng, 0.5)
    const look = pick(rng, [WRAPPED.grandad, WRAPPED.dad, WRAPPED.mum])
    const sparks = pick(rng, [GOLD_SILVER, ['#fde047', '#f9a8d4', '#f1f5f9'], ['#5eead4', '#fde047', '#f1f5f9']])
    const S = along(stage, dir, range(rng, 0.34, 0.46))
    const HUB = 46
    const dropAt = stall ? 5 : 3.9
    const back = flip(dir)
    let x = from
    let walk = 0
    let face: 1 | -1 = dir
    let phase: 'in' | 'plant' | 'light' | 'back' | 'watch' | 'closer' | 'gulp' | 'flee' | 'dog-in' | 'dog-grab' | 'dog-out' = 'in'
    let pt = 0
    let lit = -1
    let ang = 0
    let spin = 0
    // The wheel once it is loose, in px.
    let wx = S
    let wy = 0
    let wvy = 0
    let loose = false
    let rolling = false
    let dogX = from - dir * 40 * stage.u
    let dogRun = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const tick = (hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        const go = (target: number, speed: number) => {
          const d = target - x
          const step = speed * s.u * dt
          walk += dt * (speed / 5.6)
          if (Math.abs(d) <= step) {
            x = target
            return true
          }
          x += Math.sign(d) * step
          face = d > 0 ? 1 : -1
          return false
        }
        if (lit >= 0) lit += dt
        if (phase === 'in') {
          if (go(S - dir * 20 * s.u, 54)) next('plant')
        } else if (phase === 'plant') {
          face = dir
          if (pt >= 0.4 && pt - dt < 0.4) burst(s, 'dust', S, s.ground - 2 * s.u, 4, ['#cbd5e1'], 35, [3, 6])
          if (pt > 1) next('light')
        } else if (phase === 'light') {
          if (pt > 0.7 && lit < 0) lit = 0
          if (pt > 1.1) next('back')
        } else if (phase === 'back') {
          if (go(S - dir * 58 * s.u, 60)) {
            face = dir
            next('watch')
          }
        } else if (phase === 'watch') {
          if (stall && lit > 3.2) next('closer')
          if (loose) next('gulp')
        } else if (phase === 'closer') {
          if (go(S - dir * 34 * s.u, 20)) face = dir
          if (loose) next('gulp')
        } else if (phase === 'gulp') {
          face = dir
          if (pt > 0.75) next('flee')
        } else if (phase === 'flee') {
          go(from - dir * 60 * s.u, 150)
          if (past(wx, from - dir * 20 * s.u, back)) next('dog-in')
        } else if (phase === 'dog-in') {
          dogX += dir * 120 * s.u * dt
          dogRun += dt * 17
          if (past(dogX, S - dir * 24 * s.u, dir)) next('dog-grab')
        } else if (phase === 'dog-grab') {
          if (pt > 1.3) next('dog-out')
        } else {
          dogX -= dir * 100 * s.u * dt
          dogRun += dt * 15
          return !past(dogX, from - dir * 50 * s.u, back)
        }
        // The wheel: spins up, perhaps sulks, then comes off.
        if (lit >= 0 && !loose) {
          const want = stall && lit > 2.4 && lit < 4.6 ? 0 : 15
          spin += clamp(want - spin, -14 * dt, 12 * dt)
          wy = s.ground - HUB * s.u
          if (lit > dropAt) {
            loose = true
            spin = 15
            burst(s, 'spark', S, wy, 10, sparks, 90, [1.6, 2.8])
          }
        } else if (loose) {
          const floor = s.ground - 9 * s.u
          if (!rolling) {
            wvy += 420 * s.u * dt
            wy += wvy * dt
            if (wy >= floor) {
              wy = floor
              if (wvy > 90 * s.u) wvy = -wvy * 0.38
              else rolling = true
            }
          } else {
            wy = floor
            const v = lerp(30, 138, easeOut(seg(phase === 'flee' ? pt + 0.75 : pt, 0, 2.2)))
            wx += back * v * s.u * dt
            spin = v / 9
          }
        }
        ang += spin * dt * (rolling ? back : 1)
        if (lit >= 0 && spin > 3 && tick(26) && wx > -20 && wx < s.w + 20) {
          // Sparks thrown off the rim, along the way it is turning.
          const a = Math.random() * TAU
          const v = spin * 9 * s.u
          const sgn = rolling ? back : 1
          s.particles.emit({
            kind: 'spark',
            x: wx + Math.cos(a) * 9 * s.u,
            y: wy + Math.sin(a) * 9 * s.u,
            vx: -Math.sin(a) * v * sgn + range(rng, -10, 10),
            vy: Math.cos(a) * v * sgn - 20 * s.u,
            g: 90,
            size: range(rng, 1.5, 2.6) * s.u,
            color: pick(rng, sparks),
            life: 0.55,
          })
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const dogPhase = phase === 'dog-in' || phase === 'dog-grab' || phase === 'dog-out'
        const postUp = phase !== 'in' && !(phase === 'dog-grab' && pt > 0.7) && phase !== 'dog-out'
        if (postUp) {
          const k = phase === 'plant' ? easeBack(seg(pt, 0.3, 0.7)) : 1
          const wobble = lit > dropAt - 0.7 && !loose ? Math.sin(t * 30) * 0.03 : 0
          const nudge = phase === 'dog-grab' ? Math.sin(pt * 20) * 0.05 : 0
          if (k > 0.02) {
            at(
              ctx,
              S,
              s.ground,
              s.u,
              1,
              () => {
                groundShadow(ctx, 0, 5)
                line(ctx, 0, 0, 0, -(HUB + 6) * k, 3, '#a16207')
                line(ctx, -0.8, -2, -0.8, -(HUB + 4) * k, 0.8, alpha('#ffffff', 0.25))
                if (loose) fillCirc(ctx, 0, -HUB, 1, C.grey)
              },
              wobble + nudge,
            )
          }
        }
        if (lit >= 0 || phase === 'plant' || phase === 'light' || phase === 'back') {
          if (!loose) {
            const k = phase === 'plant' ? easeBack(seg(pt, 0.3, 0.7)) : 1
            if (k > 0.02) at(ctx, S, s.ground - HUB * k * s.u, s.u, 1, () => drawWheel(ctx, ang, lit >= 0 && spin > 1 ? 1 : 0))
          } else if (wx > -30 && wx < s.w + 30) {
            at(ctx, wx, s.ground, s.u, 1, () => groundShadow(ctx, 0, 8, 0.2))
            at(ctx, wx, wy, s.u, 1, () => drawWheel(ctx, ang, 1))
          }
        }
        if (!dogPhase) {
          const moving = phase === 'in' || phase === 'back' || phase === 'flee' || (phase === 'closer' && !past(x, S - dir * 34 * s.u, dir))
          at(ctx, x, s.ground, s.u, face, () => {
            groundShadow(ctx, 0, 11)
            const flee = phase === 'flee'
            const gulp = phase === 'gulp'
            const lighting = phase === 'light'
            const peer = phase === 'closer'
            const admire = phase === 'watch' && !(stall && lit > 2.6)
            const a = drawPerson(ctx, look, {
              walk,
              stride: !moving ? 0 : flee ? 1 : peer ? 0.32 : 0.8,
              lean: flee ? 0.3 : gulp ? -0.22 : peer ? 0.16 : lighting ? 0.1 : 0,
              crouch: peer ? 0.2 : 0,
              armF: lighting ? 2 : gulp ? 2.6 : admire ? 0.5 : phase === 'in' ? 1 : phase === 'plant' ? 1.3 : undefined,
              elbowF: lighting ? 0.15 : admire ? 2 : phase === 'in' ? 1.1 : phase === 'plant' ? 0.3 : undefined,
              armB: gulp ? -2.4 : admire ? 0.4 : undefined,
              elbowB: admire ? 2 : undefined,
              headTilt: admire || lighting ? -0.18 : 0,
              mouth: flee || gulp ? 'o' : admire ? 'grin' : peer || (phase === 'watch' && stall) ? 'flat' : 'smile',
              eyes: flee || gulp ? 'wide' : 'normal',
              blink: blinking(s.time, 5),
            })
            if (phase === 'in' || (phase === 'plant' && pt < 0.3)) {
              // The post over one shoulder, wheel already nailed to the end.
              line(ctx, a.handF.x + 4, a.handF.y + 6, a.handF.x - 26, a.handF.y - 26, 3, '#a16207')
              ctx.save()
              ctx.translate(a.handF.x - 24, a.handF.y - 24)
              drawWheel(ctx, 0.6, 0)
              ctx.restore()
              fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.gloves ?? look.skin)
            }
            if (lighting) drawTaper(ctx, a.handF.x, a.handF.y, 12, -7, t)
            if (flee) speedLines(ctx, -14, -30, 14, t)
          })
          if (phase === 'closer' && past(x, S - dir * 40 * s.u, dir)) say(s, x, 70, '?')
          if (phase === 'gulp') say(s, x, 80, '!', { color: C.crimson })
        } else {
          const out = phase === 'dog-out'
          const grab = phase === 'dog-grab'
          at(ctx, dogX, s.ground, s.u, out ? back : dir, () => {
            groundShadow(ctx, 0, 14)
            const d = drawDog(ctx, DOG, { run: dogRun, stride: grab ? 0 : 0.7, wag: t * 16, tilt: grab && pt < 0.7 ? -0.3 : 0, mouthOpen: phase === 'dog-in' })
            if (out || (grab && pt > 0.7)) {
              // Best stick in the whole garden.
              line(ctx, d.mouth.x - 3, d.mouth.y - 16, d.mouth.x + 2, d.mouth.y + 22, 3, '#a16207')
            }
          })
        }
      },
    })
  },
}

// ─── Watching from a safe distance ───────────────────────────────────────────
// Scarf, bobble hat, a hot chocolate or a toffee apple, and somebody else's
// display going off over the rooftops. The dog does not care for it and sits
// behind their legs with a paw over its eyes. It gets a proper fuss afterwards,
// and sometimes the loan of the earmuffs for the walk home.

function drawMug(ctx: Ctx, x: number, y: number, t: number) {
  ctx.beginPath()
  ctx.arc(x + 3.2, y + 0.4, 2.2, -Math.PI / 2, Math.PI / 2)
  ctx.lineWidth = 1.1
  ctx.strokeStyle = C.rose
  ctx.stroke()
  fillRR(ctx, x - 3, y - 3, 6, 6.6, 1.3, C.rose)
  fillRR(ctx, x - 3, y - 0.4, 6, 1.4, 0.3, C.white)
  fillEll(ctx, x, y - 3, 2.6, 0.9, '#7a4a22')
  ctx.lineWidth = 0.9
  ctx.lineCap = 'round'
  ctx.strokeStyle = C.white
  for (let i = 0; i < 2; i++) {
    const p = (t * 0.5 + i * 0.5) % 1
    ctx.globalAlpha = (1 - p) * 0.55
    ctx.beginPath()
    ctx.moveTo(x - 1 + i * 2, y - 4 - p * 8)
    ctx.quadraticCurveTo(x - 2.4 + i * 2 + Math.sin(t * 3 + i) * 1.4, y - 7 - p * 8, x - 1 + i * 2, y - 9.5 - p * 8)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawToffeeApple(ctx: Ctx, x: number, y: number) {
  line(ctx, x, y + 3, x + 1, y - 5, 1, '#e7d7b8')
  fillCirc(ctx, x + 1.4, y - 9, 4.4, '#c81e3a')
  fillEll(ctx, x + 1.4, y - 5.6, 3.6, 1.3, '#a16207')
  fillEll(ctx, x - 0.2, y - 10.6, 1.3, 1.9, 'rgba(255,255,255,0.55)', 0.5)
}

const oohAah: ActDef = {
  id: 'bonfire.ooh-aah',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const treat = chance(rng, 0.5) ? 'mug' : 'apple'
    const muffs = chance(rng, 0.5)
    const base = chance(rng, 0.5) ? CAST.mum : CAST.grandad
    const look: Look = { ...base, hat: muffs ? 'earmuffs' : 'bobble', hatColor: muffs ? C.red : C.mint, hatTrim: C.white, scarf: C.gold, gloves: C.purple }
    const spot = along(stage, dir, range(rng, 0.34, 0.46))
    const bangs = [1.2, 3.4, 5.6]
    const words = ['ooh', 'aah', 'ooh']
    let x = from
    let walk = 0
    let dogX = from - dir * 36 * stage.u
    let dogRun = 0
    let phase: 'in' | 'watch' | 'pat' | 'out' = 'in'
    let pt = 0
    let done = 0
    let hearts = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'in') {
          x += dir * 52 * s.u * dt
          walk += dt * 9.3
          dogX += dir * 52 * s.u * dt
          dogRun += dt * 12
          if (past(x, spot, dir)) {
            phase = 'watch'
            pt = 0
          }
        } else if (phase === 'watch') {
          // The dog tucks itself in behind their legs.
          if (!past(dogX, x - dir * 15 * s.u, dir)) {
            dogX += dir * 40 * s.u * dt
            dogRun += dt * 10
          }
          if (done < bangs.length && pt >= bangs[done]) {
            // Somebody else's fireworks: small, well ahead, and a long way off.
            const bx = clamp(x + dir * range(rng, 50, 120) * s.u, 30, s.w - 30)
            const by = s.ground - range(rng, 110, 150) * s.u
            ringBurst(s, bx, by, pick(rng, ROCKET_COLOURS), 14, 42, 1.9)
            done++
          }
          if (pt > 7.4) {
            phase = 'pat'
            pt = 0
          }
        } else if (phase === 'pat') {
          if (hearts < 2 && pt > 1 + hearts * 0.6) {
            hearts++
            s.particles.emit({ kind: 'heart', x: dogX + dir * 10 * s.u, y: s.ground - 36 * s.u, size: 3.2 * s.u, color: C.rose, life: 1.8 })
          }
          if (pt > 3) {
            phase = 'out'
            pt = 0
          }
        } else {
          x += dir * 52 * s.u * dt
          walk += dt * 9.3
          if (pt > 0.3) {
            dogX += dir * 54 * s.u * dt
            dogRun += dt * 12.5
          }
          return !past(dogX, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const since = done > 0 && phase === 'watch' ? pt - bangs[done - 1] : 99
        const hiding = phase === 'watch' && past(dogX, x - dir * 16 * s.u, dir)
        const covered = hiding && pt > bangs[0] - 0.4
        const patting = phase === 'pat'
        const dogHasMuffs = muffs && (phase === 'out' || (patting && pt > 1.6))
        // The dog first, so the legs are in front of it.
        at(ctx, dogX, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 14)
          const sit = hiding || patting
          const shake = covered && since < 0.6 ? Math.sin(t * 40) * 0.6 : 0
          ctx.translate(shake, 0)
          const stride = sit ? 0 : 0.55
          const hop = Math.abs(Math.sin(dogRun)) * 2.2 * stride
          drawDog(ctx, DOG, { run: dogRun, stride, sitting: sit, wag: patting ? t * 18 : covered ? 0 : t * 9, mouthOpen: patting && pt > 0.8, tilt: covered ? 0.25 : 0 })
          const hx = sit ? 11 : 15
          const hy = sit ? -28 : -20 - hop
          if (covered) {
            // One paw up over its eyes.
            poly(ctx, [6, -13, 12.5, -21, 14.6, -29.6], 3.4, DOG.coat)
            fillEll(ctx, 14.8, -30.4, 3, 2.4, shade(DOG.coat, 0.12), 0.3)
          }
          if (dogHasMuffs) {
            ctx.beginPath()
            ctx.arc(hx - 1.5, hy - 1, 7.6, Math.PI * 1.1, Math.PI * 1.8)
            ctx.lineWidth = 1.8
            ctx.lineCap = 'round'
            ctx.strokeStyle = shade(C.red, -0.3)
            ctx.stroke()
            fillEll(ctx, hx - 3.4, hy + 0.6, 3.6, 4.6, C.red)
            fillEll(ctx, hx - 3.4, hy + 0.6, 1.9, 2.6, shade(C.red, 0.25))
          }
        })
        const facing = patting ? flip(dir) : dir
        at(ctx, x, s.ground, s.u, facing, () => {
          groundShadow(ctx, 0, 11)
          const wow = since < 1.3
          const a = drawPerson(ctx, dogHasMuffs ? { ...look, hat: 'none' } : look, {
            walk,
            stride: phase === 'in' || phase === 'out' ? 0.75 : 0,
            crouch: patting ? 0.5 * easeInOut(seg(pt, 0, 0.5)) * (1 - seg(pt, 2.5, 3)) : 0,
            lean: patting ? 0.22 : phase === 'watch' ? -0.08 : 0,
            headTilt: phase === 'watch' ? -0.3 : 0,
            armF: patting ? 1.05 + Math.sin(t * 9) * 0.12 : 1,
            elbowF: patting ? 0.15 : 1.25,
            armB: patting ? 0.9 : undefined,
            elbowB: patting ? 1.2 : undefined,
            mouth: wow ? 'o' : patting ? 'grin' : 'smile',
            eyes: wow ? 'wide' : 'normal',
            blink: blinking(s.time, 6),
          })
          const hand = patting ? a.handB : a.handF
          if (treat === 'mug') drawMug(ctx, hand.x + 2.5, hand.y - 2, t)
          else drawToffeeApple(ctx, hand.x + 1, hand.y - 2)
        })
        if (phase === 'watch' && since > 0.25 && since < 1.5) say(s, x, 80, words[(done - 1) % 3])
      },
    })
  },
}

// ─── Happy New Year ──────────────────────────────────────────────────────────
// Two people in party hats carry the banner across while gold and silver go
// off low behind them. Either the one in front stops to wave and gets walked
// into, or the one behind lets off a party popper at exactly the wrong moment.

function drawPartyHat(ctx: Ctx, col: string, trim: string) {
  fillPoly(ctx, [-7, 5, 1.5, -15, 8, 4], col)
  line(ctx, -3.6, -1.5, 5.4, -2.6, 1.8, trim)
  fillCirc(ctx, 1.5, -15.5, 2.4, trim)
}

const newYearBanner: ActDef = {
  id: 'newyear.banner',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const gag = chance(rng, 0.5) ? 'bump' : 'popper'
    const year = stage.context.year + (stage.context.month === 12 ? 1 : 0)
    const text = `Happy New Year ${year}`
    const GAP = 122
    const speed = Math.max(50 * stage.u, stage.w / 17) // px/s, so a wide screen does not take all night
    const gagAt = along(stage, dir, range(rng, 0.42, 0.55))
    const front: Look = { ...CAST.dad, hat: 'party', hatColor: C.gold, hatTrim: C.white, scarf: C.red }
    const rear: Look = { ...CAST.mum, hat: 'party', hatColor: '#cbd5e1', hatTrim: C.gold, scarf: C.sky }
    let ax = from
    let bx = from - dir * GAP * stage.u
    let aWalk = 0
    let bWalk = 1.4
    let gt = -1 // seconds since the gag started
    let aStopped = false
    let bStopped = false
    let hatGone = false
    let hx = 0
    let hy = 0
    let hvx = 0
    let hvy = 0
    let hrot = 0
    let nextBang = 1.2
    return makeAct({
      update(s, dt, t) {
        if (gt < 0 && past(ax, gagAt, dir)) gt = 0
        else if (gt >= 0) gt += dt
        aStopped = gag === 'bump' && gt >= 0 && gt < 2.4
        const gapNow = Math.abs(ax - bx) / s.u
        bStopped = gag === 'bump' && gt >= 0 && (gapNow < 74 || bStopped) && gapNow < GAP - 1
        if (!aStopped) {
          ax += dir * speed * dt
          aWalk += dt * (speed / s.u / 5.6)
        }
        if (!bStopped) {
          bx += dir * speed * dt
          bWalk += dt * (speed / s.u / 5.6)
        }
        if (gag === 'popper' && gt >= 0.5 && gt - dt < 0.5) {
          for (let i = 0; i < 20; i++) {
            s.particles.emit({ kind: 'confetti', x: bx + dir * 16 * s.u, y: s.ground - 44 * s.u, vx: dir * range(rng, 30, 150) * s.u, vy: -range(rng, 40, 170) * s.u, g: 210, drag: 0.5, size: range(rng, 3, 4.6) * s.u, color: pick(rng, GOLD_SILVER), life: 2.2 })
          }
          hatGone = true
          hx = ax
          hy = s.ground - 64 * s.u
          hvx = dir * 50 * s.u
          hvy = -150 * s.u
        }
        if (hatGone && gt < 2.2) {
          hvy += 330 * s.u * dt
          hx += hvx * dt
          hy = Math.min(s.ground - 5 * s.u, hy + hvy * dt)
          hrot += dt * 7 * dir
        }
        // Gold and silver, low, a little way behind the banner.
        if (t >= nextBang) {
          nextBang = t + range(rng, 1.3, 1.9)
          const mid = (ax + bx) / 2
          if (mid > 40 && mid < s.w - 40) ringBurst(s, mid + range(rng, -70, 70) * s.u, s.ground - range(rng, 92, 122) * s.u, GOLD_SILVER, 18, 66, 2.3)
        }
        return !past(bx, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const gapNow = Math.abs(ax - bx) / s.u
        const sag = clamp((GAP - gapNow) / 50)
        const bumped = gag === 'bump' && bStopped && gt > 0
        const startle = gag === 'popper' && gt >= 0.5 && gt < 1.5
        const jump = startle && gt < 1.05 ? Math.sin(((gt - 0.5) / 0.55) * Math.PI) * 11 : 0
        const poleTop = -76
        let aPole = 0
        let bPole = 0
        const carrier = (x: number, look: Look, walk: number, isFront: boolean) => {
          at(ctx, x, s.ground, s.u, dir, () => {
            const moving = isFront ? !aStopped : !bStopped
            const hop = isFront ? jump : 0
            groundShadow(ctx, 0, 11 - hop * 0.2)
            const waving = isFront && aStopped
            const pop = !isFront && gag === 'popper' && gt >= 0.2 && gt < 1.6
            const a = drawPerson(ctx, isFront && hatGone ? { ...look, hat: 'none' } : look, {
              walk,
              stride: moving ? 0.8 : 0,
              lift: hop,
              lean: !isFront && bumped ? -0.12 : 0,
              armF: 1.25,
              elbowF: 1.1,
              armB: waving ? -2.6 + Math.sin(t * 9) * 0.35 : pop ? 1.5 : undefined,
              elbowB: waving ? -0.3 : pop ? 0.3 : undefined,
              headTilt: waving ? -0.15 : 0,
              mouth: (isFront && startle) || (!isFront && bumped) ? 'o' : 'grin',
              eyes: (isFront && startle) || (!isFront && bumped) ? 'wide' : 'normal',
              blink: blinking(s.time, isFront ? 1 : 2),
            })
            line(ctx, a.handF.x, a.handF.y + 5, a.handF.x, poleTop, 1.6, '#d6b98a')
            fillCirc(ctx, a.handF.x, poleTop, 1.8, C.gold)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
            if (pop) {
              // The popper: a little cone, pointing where it should not.
              fillPoly(ctx, [a.handB.x - 1, a.handB.y + 2, a.handB.x + 7, a.handB.y - 5, a.handB.x + 4, a.handB.y - 7], C.rose)
            }
            if (isFront) aPole = a.handF.x
            else bPole = a.handF.x
          })
        }
        carrier(bx, rear, bWalk, false)
        carrier(ax, front, aWalk, true)
        // The banner itself, strung between the pole tops. Drawn unmirrored so it reads.
        const x1 = (bx + dir * bPole * s.u) / s.u
        const x2 = (ax + dir * aPole * s.u) / s.u
        const mid = (x1 + x2) / 2
        ctx.save()
        ctx.translate(0, s.ground)
        ctx.scale(s.u, s.u)
        const by = poleTop + 11 + sag * 9
        const half = Math.min(56, Math.abs(x2 - x1) / 2 - 2)
        ctx.lineWidth = 0.8
        ctx.strokeStyle = C.white
        ctx.globalAlpha = 0.7
        for (const sd of [-1, 1]) {
          const px = sd * dir === 1 ? Math.max(x1, x2) : Math.min(x1, x2)
          ctx.beginPath()
          ctx.moveTo(px, poleTop)
          ctx.lineTo(mid + sd * dir * half, by - 6)
          ctx.moveTo(px, poleTop + 14)
          ctx.lineTo(mid + sd * dir * half, by + 6)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        banner(ctx, mid, by, text, { bg: '#2f5f9c', color: C.gold, size: 9, wave: t * 3 + sag * 2 })
        star(ctx, mid - half + 1, by - 10, 2.6, C.gold, t)
        star(ctx, mid + half - 1, by - 10, 2.6, '#e2e8f0', -t)
        ctx.restore()
        if (hatGone && gt < 2.2) {
          ctx.globalAlpha = clamp((2.2 - gt) / 0.5)
          at(ctx, hx, hy, s.u, dir, () => drawPartyHat(ctx, C.gold, C.white), hrot)
          ctx.globalAlpha = 1
        }
        if (bumped) say(s, bx, 80, 'oof', { size: 9 })
        if (startle) say(s, ax, 86, '!', { color: C.crimson })
      },
    })
  },
}

// ─── Auld Lang Syne ──────────────────────────────────────────────────────────
// Four in a row with their arms linked, swaying. One of them is facing the
// wrong way and either works it out halfway through the verse or does not work
// it out at all. Sometimes there is a piper, which helps nobody keep time.

function drawPipes(ctx: Ctx, sx: number, sy: number, mx: number, my: number, hx: number, hy: number, t: number) {
  const puff = 1 + Math.sin(t * 3) * 0.06
  // Drones over the shoulder, with tassels.
  for (let i = 0; i < 3; i++) {
    const tx = sx - 9 - i * 3.5
    const ty = sy - 30 + i * 4
    line(ctx, sx - 3, sy + 5, tx, ty, 1.7, '#3b2a1a')
    fillRR(ctx, tx - 1.4, ty - 1.5, 2.8, 3, 0.8, '#e7d7b8')
  }
  line(ctx, sx - 11, sy - 22, sx - 15, sy - 14, 0.9, C.gold)
  // The bag, in tartan, under the arm.
  fillEll(ctx, sx - 1, sy + 8, 7.6 * puff, 5.6 * puff, '#b91c1c', -0.2)
  line(ctx, sx - 7, sy + 7, sx + 5, sy + 6, 0.9, '#14532d')
  line(ctx, sx - 2, sy + 3, sx - 1, sy + 13, 0.9, '#14532d')
  line(ctx, sx - 6, sy + 10, sx + 5, sy + 9.5, 0.6, C.gold)
  // Blowpipe to the mouth, chanter down to the fingers.
  line(ctx, sx + 2, sy + 4, mx, my, 1.4, '#3b2a1a')
  line(ctx, sx + 4, sy + 9, hx + 2, hy + 6, 1.8, '#3b2a1a')
  fillRR(ctx, hx + 0.6, hy + 5, 3, 2.6, 0.8, '#e7d7b8')
}

const auldLangSyne: ActDef = {
  id: 'newyear.auld-lang-syne',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const u = stage.u
    const piper = chance(rng, 0.5)
    const notices = chance(rng, 0.5)
    const wrong = 1 + Math.floor(rng() * 2) // one of the middle two
    const cx = stage.w * range(rng, 0.42, 0.58) - (piper ? dir * 18 * u : 0)
    const SP = 25
    const hats = [C.gold, '#cbd5e1', C.rose, C.mint]
    const bases: Look[] = [CAST.dad, CAST.mum, CAST.grandad, CAST.girl]
    const cast: Walker[] = []
    // In walking order: the first in has furthest to go.
    for (let i = 0; i < 4; i++) {
      const slot = 3 - i
      cast.push({ look: { ...bases[i], hat: 'party', hatColor: hats[i], hatTrim: C.white }, k: i === 3 ? 0.82 : 1, x: from - dir * (i + (piper ? 1.4 : 0)) * 32 * u, slot: cx + dir * (slot - 1.5) * SP * u, face: dir, walk: i * 1.3, moving: true })
    }
    const pipe: Walker = {
      look: { skin: C.skinA, top: '#14532d', bottom: '#b91c1c', shoe: '#1f2937', hair: '#c2571d', beard: '#c2571d', hat: 'beret', hatColor: '#14532d', shorts: true },
      k: 1,
      x: from,
      slot: cx + dir * (1.5 * SP + 36) * u,
      face: dir,
      walk: 0,
      moving: true,
    }
    const odd = cast[3 - wrong]
    let phase: 'in' | 'sing' | 'out' = 'in'
    let pt = 0
    let turned = false
    let oddMode: 'with' | 'astray' | 'stop' | 'dash' = 'with'
    let ot = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const tick = (hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
        if (phase === 'in') {
          let all = true
          for (const p of cast) if (!walkTo(p, p.slot, 58, s, dt)) all = false
          if (piper && !walkTo(pipe, pipe.slot, 58, s, dt)) all = false
          if (all) {
            phase = 'sing'
            pt = 0
          }
        } else if (phase === 'sing') {
          for (const p of cast) p.face = dir
          pipe.face = dir
          if (notices && pt > 4.2) turned = true
          if (!turned) odd.face = flip(dir)
          if (tick(1.6)) {
            const p = piper && chance(rng, 0.5) ? pipe : cast[Math.floor(rng() * 4) % 4]
            s.particles.emit({ kind: 'note', x: p.x + range(rng, -6, 6) * s.u, y: s.ground - 66 * s.u, size: 4 * s.u, color: pick(rng, [C.gold, C.white, C.sky]), life: 2.4 })
          }
          if (pt > 8) {
            phase = 'out'
            pt = 0
            if (!turned) oddMode = 'astray'
          }
        } else {
          let gone = true
          for (const p of cast) {
            if (p === odd && oddMode !== 'with') continue
            walkTo(p, to, 58, s, dt)
            if (!past(p.x, to, dir)) gone = false
          }
          if (piper) walkTo(pipe, to, 58, s, dt)
          // The odd one out sets off the wrong way, alone, still singing.
          if (oddMode !== 'with') {
            ot += dt
            if (oddMode === 'astray') {
              walkTo(odd, from, 58, s, dt)
              if (ot > 1.7) {
                oddMode = 'stop'
                ot = 0
                odd.moving = false
              }
            } else if (oddMode === 'stop') {
              if (ot > 0.5) odd.face = dir
              if (ot > 1.1) oddMode = 'dash'
            } else walkTo(odd, to, 150, s, dt)
            if (!past(odd.x, to, dir)) gone = false
          }
          return !gone
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const singing = phase === 'sing'
        const sway = singing ? Math.sin(t * 2.2) * 0.1 : 0
        const pump = singing ? Math.sin(t * 4.4) * 0.14 : 0
        if (piper) {
          at(ctx, pipe.x, s.ground, s.u, pipe.face, () => {
            groundShadow(ctx, 0, 11)
            const a = drawPerson(ctx, pipe.look, { walk: pipe.walk, stride: pipe.moving ? 0.7 : 0, armF: 0.75, elbowF: 0.9, armB: 0.6, elbowB: 0.8, mouth: 'puff', lift: singing ? Math.abs(Math.sin(t * 2.2)) * 1.5 : 0, blink: blinking(s.time, 9) })
            // A sporran, and long socks.
            fillEll(ctx, a.hip.x + 5, a.hip.y + 4, 2.6, 3.2, C.white)
            drawPipes(ctx, a.shoulder.x, a.shoulder.y, a.mouth.x, a.mouth.y, a.handF.x, a.handF.y, t)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, pipe.look.skin)
          })
        }
        // Back to front, so the arms cross over the next one along.
        for (let i = 3; i >= 0; i--) {
          const p = cast[i]
          const isOdd = p === odd
          const dash = isOdd && oddMode === 'dash'
          const puzzled = isOdd && (oddMode === 'stop' || (singing && notices && pt > 3.2 && pt < 4.2))
          at(ctx, p.x, s.ground, s.u * p.k, p.face, () => {
            groundShadow(ctx, 0, 11)
            const f = p.face === dir ? 1 : -1
            drawPerson(ctx, p.look, {
              walk: p.walk,
              stride: p.moving ? (dash ? 1 : 0.8) : 0,
              lean: dash ? 0.28 : sway * f,
              armF: singing ? 1.05 + pump : undefined,
              elbowF: singing ? 0.45 : undefined,
              armB: singing ? -1.05 - pump : undefined,
              elbowB: singing ? -0.45 : undefined,
              headTilt: singing ? Math.sin(t * 2.2 + i) * 0.1 : 0,
              mouth: puzzled || dash ? 'o' : singing ? (Math.sin(t * 6 + i * 2) > 0 ? 'o' : 'grin') : 'smile',
              eyes: puzzled || dash ? 'wide' : singing && !isOdd && Math.sin(t * 1.1 + i) > 0.6 ? 'closed' : 'normal',
              blink: blinking(s.time, i + 3),
            })
            if (dash) speedLines(ctx, -14, -30, 14, t)
          })
          if (puzzled) say(s, p.x, 84, oddMode === 'stop' ? '!' : '?', { size: 10 })
        }
      },
    })
  },
}

// ─── The cork ────────────────────────────────────────────────────────────────
// Somebody wrestles with a bottle of fizz. It goes off, the cork sets out on a
// tour of the screen, and the foam goes everywhere except the glass they did
// not bring. So they try to drink the fountain.

function drawFizzBottle(ctx: Ctx) {
  // Origin at the middle of the base, standing upright. The mouth is at (0, -21).
  fillRR(ctx, -3.3, -12, 6.6, 12, 2, '#2f7d4f')
  fillPoly(ctx, [-3.3, -11, -1.4, -16.5, 1.4, -16.5, 3.3, -11], '#2f7d4f')
  fillRR(ctx, -1.4, -21, 2.8, 5.5, 0.6, '#2f7d4f')
  fillRR(ctx, -1.8, -21, 3.6, 3.6, 0.8, C.gold)
  fillRR(ctx, -2.8, -8.6, 5.6, 4.6, 0.6, C.cream)
  line(ctx, -1.8, -6.3, 1.8, -6.3, 0.7, C.gold)
  ctx.globalAlpha = 0.3
  fillRR(ctx, -2.5, -11, 1.1, 9, 0.5, C.white)
  ctx.globalAlpha = 1
}

const cork: ActDef = {
  id: 'newyear.cork',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const ending = chance(rng, 0.5) ? 'hat' : 'hic'
    const base = pick(rng, [CAST.dad, CAST.mum, CAST.grandad])
    const look: Look = { ...base, hat: 'party', hatColor: pick(rng, [C.gold, C.rose, C.mint]), hatTrim: C.white }
    const spot = along(stage, dir, range(rng, 0.38, 0.5))
    let x = from
    let walk = 0
    let phase: 'in' | 'struggle' | 'fount' | 'daze' | 'out' = 'in'
    let pt = 0
    // The cork, in px.
    let cx = 0
    let cy = 0
    let cvx = 0
    let cvy = 0
    let ct = -1
    let corkLive = false
    let hits = 0
    let hatGone = false
    let hatT = 0
    let hx = 0
    let hy = 0
    let hvy = 0
    // Where the mouth of the bottle is, in the drinker's own units. Set while drawing.
    let mouthX = 14
    let mouthY = -44
    let homeX = 0
    let homeY = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const tick = (hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
        const bx = x + dir * mouthX * s.u
        const by = s.ground + mouthY * s.u
        if (phase === 'in') {
          x += dir * 54 * s.u * dt
          walk += dt * 9.6
          if (past(x, spot, dir)) {
            phase = 'struggle'
            pt = 0
          }
        } else if (phase === 'struggle') {
          if (pt > 2.8) {
            phase = 'fount'
            pt = 0
            corkLive = true
            ct = 0
            cx = bx
            cy = by
            cvx = dir * 250 * s.u
            cvy = -210 * s.u
            burst(s, 'star', bx, by, 5, [C.white, C.gold], 70, [2, 3])
          }
        } else if (phase === 'fount') {
          // The fountain: strong for two seconds, then it gives out.
          const flow = 1 - seg(pt, 1.8, 3)
          if (flow > 0 && tick(26) && Math.random() < flow) {
            s.particles.emit({ kind: 'drop', x: bx, y: by, vx: (dir * 12 + range(rng, -42, 42)) * s.u, vy: -range(rng, 110, 220) * s.u * (0.5 + flow * 0.5), g: 400 * s.u, size: range(rng, 1.8, 3) * s.u, color: pick(rng, [C.white, C.cream, '#fef3c7']), life: 1.6 })
          }
          if (flow > 0 && tick(5)) s.particles.emit({ kind: 'bubble', x: bx + range(rng, -6, 6) * s.u, y: by - 6 * s.u, vy: -range(rng, 26, 44) * s.u, size: range(rng, 1.8, 3.2) * s.u, life: 1.5 })
          if (pt > 3.4 && !corkLive) {
            phase = 'daze'
            pt = 0
          }
        } else if (phase === 'daze') {
          if (pt > 1.5) {
            phase = 'out'
            pt = 0
          }
        } else {
          x += dir * 54 * s.u * dt
          walk += dt * 9.6
          // Hiccups, each one a bubble.
          if (ending === 'hic' && tick(1.1)) s.particles.emit({ kind: 'bubble', x: x + dir * 10 * s.u, y: s.ground - 42 * s.u, vx: dir * 10 * s.u, vy: -30 * s.u, size: range(rng, 2, 3.4) * s.u, life: 1.6 })
          return !past(x, to, dir)
        }
        // The cork: off the walls, the floor, and a ceiling a little above head height.
        if (corkLive) {
          ct += dt
          const homing = ending === 'hat' && ct > 2.6
          if (homing) {
            // Last bounce: straight back at the hat that launched it.
            const q = seg(ct, 2.6, 3)
            if (ct - dt <= 2.6) {
              homeX = cx
              homeY = cy
            }
            const tx = x + dir * 2 * s.u
            const ty = s.ground - 66 * s.u
            cx = lerp(homeX, tx, q)
            cy = lerp(homeY, ty, q) - Math.sin(q * Math.PI) * 16 * s.u
            if (q >= 1) {
              corkLive = false
              hatGone = true
              hatT = 0
              hx = tx
              hy = ty
              hvy = -150 * s.u
              burst(s, 'star', tx, ty, 5, [C.white, C.yellow], 60, [2, 3])
            }
          } else {
            cvy += 260 * s.u * dt
            cx += cvx * dt
            cy += cvy * dt
            const roof = s.ground - 150 * s.u
            const floor = s.ground - 2 * s.u
            if (ending === 'hat' || hits < 4) {
              if (cx < 5 && cvx < 0) {
                cx = 5
                cvx = -cvx * 0.92
                hits++
              } else if (cx > s.w - 5 && cvx > 0) {
                cx = s.w - 5
                cvx = -cvx * 0.92
                hits++
              }
            }
            if (cy > floor && cvy > 0) {
              cy = floor
              cvy = -Math.max(cvy * 0.8, 150 * s.u)
              hits++
            } else if (cy < roof && cvy < 0) {
              cy = roof
              cvy = -cvy * 0.8
              hits++
            }
            // The other ending: after a few bounces it simply leaves, or runs out of time.
            if (cx < -20 || cx > s.w + 20 || ct > 7) corkLive = false
          }
        }
        if (hatGone) {
          hatT += dt
          hvy += 330 * s.u * dt
          hx -= dir * 34 * s.u * dt
          hy = Math.min(s.ground - 5 * s.u, hy + hvy * dt)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const struggle = phase === 'struggle'
        const fount = phase === 'fount'
        const flow = fount ? 1 - seg(pt, 1.8, 3) : 0
        const drinking = fount && pt > 0.7 && flow > 0
        const strain = struggle ? Math.sin(pt * 22) * (0.4 + seg(pt, 0, 2.8)) : 0
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, hatGone ? { ...look, hat: 'none' } : look, {
            walk,
            stride: phase === 'in' || phase === 'out' ? 0.8 : 0,
            lean: struggle ? -0.1 + strain * 0.04 : drinking ? 0.26 : fount ? -0.2 : 0,
            lift: drinking ? Math.abs(Math.sin(t * 7)) * 3 : 0,
            armF: struggle ? 1.15 + strain * 0.03 : fount ? 0.95 : phase === 'in' ? 0.9 : 0.5,
            elbowF: struggle ? 0.9 : fount ? 0.5 : phase === 'in' ? 0.9 : 0.5,
            armB: struggle ? 1.3 : drinking ? -1.2 : fount ? -2.2 : undefined,
            elbowB: struggle ? 1.2 : undefined,
            headTilt: drinking ? -0.3 : phase === 'daze' && ending === 'hat' ? -0.3 : 0,
            mouth: struggle ? 'puff' : drinking ? 'o' : fount ? 'o' : phase === 'daze' ? 'flat' : 'grin',
            eyes: struggle && pt > 1.4 ? 'closed' : fount && !drinking ? 'wide' : drinking ? 'closed' : 'normal',
            blink: blinking(s.time, 4),
          })
          // The bottle, gripped by the neck, angled forwards and up.
          const tiltB = struggle ? 0.5 + strain * 0.05 : fount ? 0.28 : 0.15
          const bx = a.handF.x + 1 + strain * 0.5
          const by = a.handF.y + 9
          ctx.save()
          ctx.translate(bx, by)
          ctx.rotate(tiltB)
          drawFizzBottle(ctx)
          if (struggle) fillRR(ctx, -1.6, -24.4, 3.2, 3.8, 1, C.tan)
          if (flow > 0) {
            // A fat column of foam where it leaves the neck.
            ctx.globalAlpha = 0.85
            fillEll(ctx, 0, -25 - flow * 4, 2.6 + Math.sin(t * 6) * 0.5, 5 + flow * 5, C.white)
            fillCirc(ctx, 0, -22, 2.8, C.cream)
            ctx.globalAlpha = 1
          }
          ctx.restore()
          mouthX = bx + Math.sin(tiltB) * 21
          mouthY = by - Math.cos(tiltB) * 21
          fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
          if (struggle) {
            fillCirc(ctx, a.handB.x, a.handB.y, 2.6, shade(look.skin, -0.15))
            if (pt > 0.8) sweat(ctx, a.head.x, a.head.y - 8, t)
          }
        })
        if (corkLive) {
          // Tiny, with a short streak behind it so the eye can follow.
          const sp = Math.hypot(cvx, cvy) || 1
          ctx.globalAlpha = 0.45
          line(ctx, cx, cy, cx - (cvx / sp) * 9 * s.u, cy - (cvy / sp) * 9 * s.u, 1 * s.u, C.white)
          ctx.globalAlpha = 1
          at(ctx, cx, cy, s.u, 1, () => {
            fillRR(ctx, -1.4, -1.9, 2.8, 3.8, 0.9, C.tan)
            fillRR(ctx, -1.7, -2.3, 3.4, 1.6, 0.8, shade(C.tan, 0.2))
          }, ct * 9)
        }
        if (hatGone && hatT < 1.8) {
          ctx.globalAlpha = clamp((1.8 - hatT) / 0.5)
          at(ctx, hx, hy, s.u, dir, () => drawPartyHat(ctx, look.hatColor ?? C.gold, C.white), -dir * hatT * 6)
          ctx.globalAlpha = 1
        }
        if (phase === 'daze' && ending === 'hat' && pt > 0.3) say(s, x, 74, '?')
        if (phase === 'daze' && ending === 'hic' && pt > 0.4) say(s, x, 80, 'hic', { size: 9 })
      },
    })
  },
}

// ─── Out with the old ────────────────────────────────────────────────────────
// Old Father Time shuffles off one way, bent over his crook, beard to his
// knees. The New Year toddles on from the other in a nappy, a sash and a top
// hat three sizes too big. They meet in the middle and are very civil about it.

const FATHER_TIME: Look = { skin: C.skinA, top: '#b8c4d9', bottom: '#b8c4d9', shoe: '#8b5a2b', hair: C.white, hairStyle: 'bald', beard: C.white, moustache: C.white }
const BABY: Look = { skin: C.skinA, top: C.skinA, bottom: C.white, shoe: C.skinA, hairStyle: 'bald', shorts: true }

function drawHourglass(ctx: Ctx, x: number, y: number, t: number) {
  fillRR(ctx, x - 3.6, y - 6, 7.2, 1.6, 0.6, '#a16207')
  fillRR(ctx, x - 3.6, y + 4.4, 7.2, 1.6, 0.6, '#a16207')
  fillPoly(ctx, [x - 3, y - 4.4, x + 3, y - 4.4, x, y], alpha('#7dd3fc', 0.55))
  fillPoly(ctx, [x - 3, y + 4.4, x + 3, y + 4.4, x, y], alpha('#7dd3fc', 0.55))
  fillPoly(ctx, [x - 1.6, y - 2.6, x + 1.6, y - 2.6, x, y - 0.4], C.gold)
  fillPoly(ctx, [x - 2.6, y + 4.4, x + 2.6, y + 4.4, x, y + 1.6 + Math.sin(t * 2) * 0.3], C.gold)
  line(ctx, x, y - 0.4, x, y + 2, 0.5, C.gold)
}

const fatherTime: ActDef = {
  id: 'newyear.father-time',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const gag = chance(rng, 0.5) ? 'hourglass' : 'hat'
    const speed = Math.max(34 * stage.u, stage.w / 15) // px/s
    const KB = 0.54
    const back = flip(dir)
    let fx = from
    let bx = to
    let fWalk = 0
    let bWalk = 0
    let phase: 'approach' | 'meet' | 'part' = 'approach'
    let pt = 0
    let sat = 0 // counts down while the baby is sitting on its bottom
    let hasSat = false
    let sparkle = false
    return makeAct({
      update(s, dt) {
        pt += dt
        const fStep = () => {
          fx += dir * speed * dt
          fWalk += dt * 6.5
        }
        const bStep = () => {
          bx += back * speed * 0.9 * dt
          bWalk += dt * 12
        }
        if (phase === 'approach') {
          fStep()
          // New legs. It goes down with a bump once, and gets straight up again.
          if (sat > 0) sat -= dt
          else bStep()
          const seen = bx > 30 && bx < s.w - 30
          if (!hasSat && seen && pt > 1.6) {
            hasSat = true
            sat = 1.1
            burst(s, 'dust', bx, s.ground - 2 * s.u, 4, ['#cbd5e1'], 35, [3, 6])
          }
          if (Math.abs(bx - fx) < 44 * s.u) {
            phase = 'meet'
            pt = 0
          }
        } else if (phase === 'meet') {
          if (gag === 'hourglass' && !sparkle && pt > 2) {
            sparkle = true
            burst(s, 'star', bx, s.ground - 44 * s.u, 8, [C.gold, C.white], 70, [2, 3.4])
          }
          if (pt > 3.4) {
            phase = 'part'
            pt = 0
          }
        } else {
          fStep()
          bStep()
          return !(past(fx, to, dir) && past(bx, from, back))
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const meet = phase === 'meet'
        const sitting = phase === 'approach' && sat > 0
        // Variant one: the hourglass changes hands, 0.8s to 1.5s into the meeting.
        const handing = gag === 'hourglass' && meet ? seg(pt, 0.8, 1.5) : 0
        const babyHasIt = gag === 'hourglass' && (phase === 'part' || (meet && pt >= 1.5))
        // Variant two: the hat slips over the baby's eyes and is gently put right.
        const slip = gag === 'hat' && meet ? easeOut(seg(pt, 0.3, 0.6)) * (1 - easeInOut(seg(pt, 1.6, 2.2))) : 0
        const bend = meet ? easeInOut(seg(pt, 0.5, 1)) * (1 - easeInOut(seg(pt, 2.4, 3))) : 0
        let glassX = 0
        let glassY = 0
        // Father Time.
        at(ctx, fx, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 12)
          const a = drawPerson(ctx, FATHER_TIME, {
            walk: fWalk,
            stride: meet ? 0 : 0.42,
            lean: 0.2 + bend * 0.22,
            crouch: 0.12 + bend * 0.2,
            armF: 1.15,
            elbowF: 0.75,
            armB: meet ? 0.5 + bend * 0.75 : 0.35,
            elbowB: meet ? 0.3 : 0.9,
            headTilt: -0.1,
            mouth: meet ? 'grin' : 'flat',
            eyes: meet ? 'normal' : 'closed',
            blink: blinking(s.time, 8),
          })
          // The robe: one long pale gown from the waist to the ankles.
          const sw = Math.sin(fWalk) * 1.6 * (meet ? 0 : 1)
          fillPoly(ctx, [a.hip.x - 8, a.hip.y - 2, a.hip.x + 8, a.hip.y - 2, a.hip.x + 10 + sw, -2.6, a.hip.x - 9 - sw, -2.6], '#b8c4d9')
          fillPoly(ctx, [a.hip.x - 8, a.hip.y - 2, a.hip.x - 4.5, a.hip.y - 2, a.hip.x - 6 - sw, -2.6, a.hip.x - 9 - sw, -2.6], shade('#b8c4d9', -0.14))
          line(ctx, a.hip.x - 7, a.hip.y - 1, a.hip.x + 8, a.hip.y - 1.6, 1.4, C.gold)
          // The beard, right down past his belt.
          const bsw = Math.sin(t * 2 + fWalk) * 1.2
          fillPoly(ctx, [a.head.x, a.head.y + 8, a.head.x + 11, a.head.y + 6, a.head.x + 9 + bsw, a.head.y + 22, a.head.x + 5 + bsw * 1.4, a.head.y + 31, a.head.x + 2, a.head.y + 20], C.white)
          line(ctx, a.head.x + 5, a.head.y + 12, a.head.x + 5 + bsw, a.head.y + 26, 0.7, '#cbd5e1')
          // A tall shepherd's crook for a walking stick. (Traditionally a
          // scythe, but that reads as the grim reaper to a small child.)
          const px = a.handF.x + 1
          const top = -76 + bend * 6
          line(ctx, px + 3, 0, px - 1, top + 6, 2, '#8b5a2b')
          ctx.beginPath()
          ctx.arc(px + 4, top + 6, 5, Math.PI, Math.PI * 2.1)
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.strokeStyle = '#8b5a2b'
          ctx.stroke()
          fillCirc(ctx, px + 9.2, top + 7, 1.2, C.gold)
          fillCirc(ctx, a.handF.x, a.handF.y, 2.7, FATHER_TIME.skin)
          glassX = a.handB.x + 3
          glassY = a.handB.y + 2
          if (gag === 'hourglass' && !babyHasIt && handing <= 0) drawHourglass(ctx, glassX, glassY, t)
          if (gag === 'hat' && slip > 0.5) fillCirc(ctx, a.handB.x, a.handB.y, 2.7, FATHER_TIME.skin)
        })
        // The New Year.
        let babyHandX = 0
        let babyHandY = 0
        at(ctx, bx, s.ground, s.u * KB, back, () => {
          groundShadow(ctx, 0, 11)
          const blind = slip > 0.4
          const cheer = babyHasIt && meet
          const a = drawPerson(ctx, BABY, {
            walk: bWalk,
            stride: meet || sitting ? 0 : 0.5,
            crouch: sitting ? 1 : 0,
            lean: sitting ? -0.25 : meet ? 0 : Math.sin(bWalk) * 0.12,
            armF: cheer ? 2.8 : blind ? 1.6 + Math.sin(t * 12) * 0.3 : sitting ? 1.9 : handing > 0 ? 1.5 : babyHasIt ? 1.2 : 1.2 + Math.sin(bWalk) * 0.3,
            elbowF: cheer ? 0.1 : babyHasIt ? 0.9 : 0.2,
            armB: blind ? -1.6 - Math.sin(t * 12) * 0.3 : sitting ? -1.9 : -1.2 + Math.sin(bWalk) * 0.3,
            elbowB: -0.2,
            mouth: sitting || blind ? 'o' : meet ? 'grin' : 'smile',
            eyes: sitting ? 'wide' : 'normal',
            blink: blinking(s.time, 10),
          })
          // One curl, a nappy pin and the sash.
          fillRR(ctx, a.hip.x - 8.4, a.hip.y - 4, 16.8, 7.4, 3.4, C.white)
          fillCirc(ctx, a.hip.x + 5, a.hip.y - 1.6, 1.3, C.gold)
          line(ctx, a.shoulder.x + 6, a.shoulder.y - 1, a.hip.x - 7, a.hip.y - 3, 3.4, C.sky)
          line(ctx, a.shoulder.x + 6, a.shoulder.y - 1, a.hip.x - 7, a.hip.y - 3, 0.9, C.gold)
          poly(ctx, [a.hip.x - 7, a.hip.y - 3, a.hip.x - 10, a.hip.y + 4], 3, C.sky)
          // The top hat: far too big, and it rides lower when it slips.
          ctx.save()
          ctx.translate(a.head.x - 0.5, a.head.y - 7 + slip * 8)
          ctx.rotate(-0.08 + slip * 0.1)
          ctx.scale(1.2, 1.2)
          fillRR(ctx, -13.5, -1.5, 27, 3.4, 1.7, '#475f8a')
          fillRR(ctx, -8.6, -18, 17.2, 17.5, 1.6, '#3f5580')
          fillRR(ctx, -8.6, -5.4, 17.2, 3.6, 0.5, C.gold)
          fillRR(ctx, -7.2, -17, 2.4, 11, 1, 'rgba(255,255,255,0.14)')
          ctx.restore()
          babyHandX = a.handF.x
          babyHandY = a.handF.y
          if (babyHasIt) drawHourglass(ctx, a.handF.x + 2, a.handF.y - 5, t)
        })
        if (handing > 0 && !babyHasIt) {
          // In transit between a very old hand and a very new one.
          const x1 = fx + dir * glassX * s.u
          const y1 = s.ground + glassY * s.u
          const x2 = bx + back * (babyHandX + 2) * KB * s.u
          const y2 = s.ground + (babyHandY - 5) * KB * s.u
          at(ctx, lerp(x1, x2, handing), lerp(y1, y2, handing) - Math.sin(handing * Math.PI) * 6 * s.u, s.u, 1, () => drawHourglass(ctx, 0, 0, t))
        }
        if (sitting && sat < 0.8) say(s, bx, 46, 'oop', { size: 9 })
        if (meet && gag === 'hat' && pt > 0.6 && pt < 1.6) say(s, bx, 52, '?', { size: 9 })
      },
    })
  },
}

export const BONFIRE_ACTS: ActDef[] = [bonfire, rocket, catherineWheel, oohAah]
export const NEWYEAR_ACTS: ActDef[] = [newYearBanner, auldLangSyne, cork, fatherTime]
