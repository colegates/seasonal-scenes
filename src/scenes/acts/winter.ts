import { DOG, drawBird, drawDog } from '../creatures'
import {
  C,
  TAU,
  alpha,
  at,
  clamp,
  easeBack,
  easeIn,
  easeInOut,
  easeOut,
  fillCirc,
  fillEll,
  fillPoly,
  fillRR,
  groundShadow,
  lerp,
  line,
  poly,
  seg,
  shade,
  star,
  type Ctx,
} from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { CAST, drawPerson, type Look } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, AmbientDef, Stage } from '../types'

export const WINTER_SNOW = ['#f1f5f9', '#e6f1fb', '#dbeafe', '#ffffff', '#cfe6fa']

export const WINTER_AMBIENT: AmbientDef = {
  kind: 'snow',
  colors: WINTER_SNOW,
  rate: 5,
  flurry: [26, 12],
  settle: true,
  pile: 'drift',
  maxPile: 20,
  size: [3, 6],
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

type Dir = 1 | -1

/** Children are drawn at this fraction of an adult. */
const KID = 0.8

const past = (x: number, target: number, dir: Dir) => (dir === 1 ? x >= target : x <= target)

/** Loose snow thrown from (x, y). Velocities in units/s; it never rejoins the drift. */
function puff(s: Stage, x: number, y: number, n: number, vx: number, vy: number, spread = 60, big = false) {
  for (let i = 0; i < n; i++) {
    s.particles.emit({
      kind: 'snow',
      x: x + (Math.random() - 0.5) * 6 * s.u,
      y,
      vx: (vx + (Math.random() - 0.5) * spread) * s.u,
      vy: (vy - Math.random() * spread * 0.8) * s.u,
      g: 240 * s.u,
      drag: 0.6,
      sway: 0,
      size: (big ? 3 + Math.random() * 3 : 2 + Math.random() * 2.5) * s.u,
      color: WINTER_SNOW[Math.floor(Math.random() * WINTER_SNOW.length)],
      life: 1.1 + Math.random() * 0.6,
      settle: false,
    })
  }
}

/** A packed snowball centred on (x, y). The dimples turn with `rot` so a roll reads. */
function drawSnowball(ctx: Ctx, x: number, y: number, r: number, rot = 0) {
  fillCirc(ctx, x, y, r, '#f4f8fc')
  fillEll(ctx, x - r * 0.12, y + r * 0.3, r * 0.82, r * 0.62, '#d5e3f1')
  fillEll(ctx, x + r * 0.1, y - r * 0.12, r * 0.84, r * 0.74, '#f4f8fc')
  for (let i = 0; i < 3; i++) {
    const a = rot + i * 2.2
    fillCirc(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.13, '#c3d4e6')
  }
  fillEll(ctx, x + r * 0.3, y - r * 0.45, r * 0.3, r * 0.18, '#ffffff', -0.5)
}

/** One ski under a foot: long, thin, tip turned up, with a binding. */
function drawSki(ctx: Ctx, fx: number, fy: number, color: string, tilt = 0, len = 1) {
  ctx.save()
  ctx.translate(fx, fy)
  ctx.rotate(tilt)
  poly(ctx, [-12 * len, 0.6, 13 * len, 0.6, 16.5 * len, -2.4], 1.9, color)
  line(ctx, -12 * len, 0.6, -8 * len, 0.6, 1.9, shade(color, -0.25))
  fillRR(ctx, -2.5, -1.2, 5.5, 1.6, 0.6, '#334155')
  ctx.restore()
}

/** A ski pole from a hand. `ang` is measured from straight down, positive forward. */
function drawPole(ctx: Ctx, hx: number, hy: number, ang: number, len = 25, color = '#cbd5e1') {
  const ex = hx + Math.sin(ang) * len
  const ey = hy + Math.cos(ang) * len
  line(ctx, hx - Math.sin(ang) * 3, hy - Math.cos(ang) * 3, ex, ey, 1.1, color)
  const bx = hx + Math.sin(ang) * (len - 3.5)
  const by = hy + Math.cos(ang) * (len - 3.5)
  fillEll(ctx, bx, by, 2.4, 1, C.orange, ang)
  line(ctx, hx - Math.sin(ang) * 3, hy - Math.cos(ang) * 3, hx + Math.sin(ang) * 2, hy + Math.cos(ang) * 2, 2, '#1f2937')
}

/** Stars circling a dazed head. Unit space. */
function dizzy(ctx: Ctx, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + (i * TAU) / 3
    star(ctx, x + Math.cos(a) * 10, y + Math.sin(a) * 3, 2.4, i === 1 ? C.white : C.yellow, a)
  }
}

// ─── The snow shovel ─────────────────────────────────────────────────────────
// Dad clears the path the honest way: push, scoop, heave it over his shoulder,
// repeat. Sometimes the path wins and he goes flat on his back. Sometimes a
// small person follows at a safe distance with an armful of snowballs.

const snowShovel: ActDef = {
  id: 'winter.snow-shovel',
  weight: 3,
  clears: true,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const speed = Math.max(48 * stage.u, stage.w / 22)
    const roll = rng()
    const gag = roll < 0.4 ? 'slip' : roll < 0.8 ? 'kid' : 'plain'
    const slipAt = stage.w * range(rng, 0.35, 0.6)
    const man: Look = { ...CAST.dad, hat: 'bobble', hatColor: C.red, hatTrim: C.white, scarf: C.yellow, gloves: '#334155' }
    const kid: Look = chance(rng, 0.5)
      ? { ...CAST.kid, hat: 'bobble', hatColor: C.mint, hatTrim: C.white, gloves: C.red }
      : { ...CAST.girl, hat: 'bobble', hatColor: C.pink, hatTrim: C.white, scarf: C.sky, gloves: C.purple }
    let x = from
    let walk = 0
    let cyc = 0 // scoop cycle, one per heave
    let down = 0 // seconds left of the slip
    let slipped = false
    let kx = from - dir * 105 * stage.u
    let kwalk = 0
    let throwIn = range(rng, 1.6, 2.4)
    let ballT = -1 // 0..1 while a snowball is in the air
    let ballX0 = 0
    let ballY0 = 0
    let hit = 0 // seconds of flinch left
    let hits = 0
    const SLIP = 3.2
    return makeAct({
      update(s, dt) {
        const travelled = dir === 1 ? x : s.w - x
        if (gag === 'slip' && !slipped && travelled > slipAt) {
          slipped = true
          down = SLIP
          puff(s, x, s.ground - 3 * s.u, 12, -dir * 30, -70, 120, true)
        }
        if (down > 0) {
          down -= dt
        } else {
          x += dir * speed * dt
          walk += dt * 8
          const before = cyc % 1
          cyc += dt * 1.05
          s.particles.sweep(x - dir * 12 * s.u, x + dir * 27 * s.u)
          // The heave: a shovelful sails back over his shoulder.
          if (before < 0.66 && cyc % 1 >= 0.66) {
            puff(s, x - dir * 12 * s.u, s.ground - 58 * s.u, 8, -dir * 95, -70, 70, true)
          }
        }
        hit = Math.max(0, hit - dt)
        if (gag === 'kid') {
          kx += dir * speed * dt
          kwalk += dt * 10
          const both = kx > 10 && kx < s.w - 10 && x > 10 && x < s.w - 10
          if (ballT < 0) {
            throwIn -= dt
            if (throwIn <= 0 && both) {
              ballT = 0
              ballX0 = kx + dir * 9 * s.u
              ballY0 = s.ground - 40 * s.u * KID
              throwIn = range(rng, 2.2, 3.4)
            }
          } else {
            ballT += dt / 0.6
            if (ballT >= 1) {
              ballT = -1
              hit = 0.7
              hits++
              puff(s, x - dir * 7 * s.u, s.ground - 38 * s.u, 9, -dir * 20, -40, 110)
            }
          }
        }
        const lastX = gag === 'kid' ? kx : x
        return !past(lastX, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const tt = SLIP - down
        const fall = down <= 0 ? 0 : tt < 0.35 ? easeIn(tt / 0.35) : tt < 2.3 ? 1 : 1 - easeInOut((tt - 2.3) / 0.9)
        const flat = fall > 0.5
        const c = cyc % 1
        // 0 pushing along the ground, 1 at the top of the heave.
        const heave = c < 0.5 ? 0 : c < 0.68 ? easeOut((c - 0.5) / 0.18) : 1 - easeInOut((c - 0.68) / 0.32)
        if (down > 0) {
          // The shovel, dropped where he stood.
          at(ctx, x + dir * 26 * s.u, s.ground, s.u, dir, () => {
            line(ctx, -16, -1.5, 8, -1.5, 2, C.wood)
            fillRR(ctx, 8, -4.5, 10, 5, 1.5, '#9fb3c8')
            fillRR(ctx, 8, -4.5, 10, 1.6, 0.8, '#d7e2ee')
            line(ctx, -18, -3.5, -18, 0.5, 2, C.red)
          })
        }
        at(
          ctx,
          x - dir * fall * 6 * s.u,
          s.ground - fall * 4 * s.u,
          s.u,
          dir,
          () => {
            if (!flat) groundShadow(ctx, 0, 12)
            const flinch = hit > 0 ? Math.sin((hit / 0.7) * Math.PI) : 0
            const a = drawPerson(ctx, man, {
              walk,
              stride: down > 0 ? fall * 0.9 : 0.8,
              armF: down > 0 ? 1.9 : lerp(0.6, 2.7, heave),
              elbowF: down > 0 ? 0.3 : lerp(0.2, 0.5, heave),
              armB: down > 0 ? -1.2 : lerp(0.3, 2.2, heave),
              elbowB: down > 0 ? 0.4 : lerp(1.6, 0.8, heave),
              lean: down > 0 ? -0.1 : lerp(0.22, -0.12, heave) + flinch * 0.22,
              mouth: down > 0 ? (flat ? 'frown' : 'o') : flinch > 0.2 ? 'o' : heave > 0.4 ? 'puff' : 'flat',
              eyes: down > 0 && tt < 0.5 ? 'wide' : flat ? 'closed' : flinch > 0.2 ? 'wide' : 'normal',
              blink: blinking(s.time, 2),
            })
            if (down > 0) {
              if (flat) dizzy(ctx, a.head.x, a.head.y - 15, t)
              return
            }
            // Shovel: the shaft runs through the front hand to the blade.
            const tipX = lerp(27, a.head.x - 13, heave)
            const tipY = lerp(-2, a.head.y - 19, heave)
            const tailX = a.handF.x + (a.handF.x - tipX) * 0.42
            const tailY = a.handF.y + (a.handF.y - tipY) * 0.42
            line(ctx, tailX, tailY, tipX, tipY, 2, C.wood)
            line(ctx, tailX - 1.6, tailY + 1.8, tailX + 1.6, tailY - 1.8, 2, C.red)
            ctx.save()
            ctx.translate(tipX, tipY)
            ctx.rotate(Math.atan2(tipY - tailY, tipX - tailX))
            fillRR(ctx, -2, -5, 10, 10, 2, '#9fb3c8')
            fillRR(ctx, -2, -5, 3, 10, 1.2, '#d7e2ee')
            // A load of snow on the blade until it is flung.
            if (c > 0.3 && c < 0.66) fillEll(ctx, 3.5, -4.5, 5.5, 3.2 * clamp((c - 0.3) * 6), '#f1f5f9')
            ctx.restore()
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, '#334155')
            fillCirc(ctx, tailX, tailY, 2.4, '#334155')
            if (heave > 0.3) sweat(ctx, a.head.x - 4, a.head.y - 6, t)
            // Snow splattered on his back after a direct hit.
            if (hits > 0) {
              fillEll(ctx, a.back.x - 1.5, a.back.y - 2, 2.6, 3.4, '#f1f5f9')
              if (hits > 1) fillEll(ctx, a.back.x - 1, a.back.y + 5, 2.2, 2.6, '#e6f1fb')
            }
            if (hit > 0.2 && hits >= 2) bubble(ctx, a.head.x, a.head.y - 20, '!', { size: 9 })
          },
          -dir * fall * 1.42,
        )
        if (gag === 'kid') {
          const wind = ballT < 0 ? clamp(1 - throwIn / 0.5) : 0 // winding up
          const flung = ballT >= 0 && ballT < 0.5
          at(ctx, kx, s.ground, s.u * KID, dir, () => {
            groundShadow(ctx, 0, 11)
            const a = drawPerson(ctx, kid, {
              walk: kwalk,
              stride: 0.8,
              armF: flung ? 1.9 : wind > 0 ? lerp(0.3, -2.4, wind) : undefined,
              elbowF: flung ? 0.1 : wind > 0 ? 0.9 : undefined,
              armB: 0.7,
              elbowB: 1.3,
              lean: flung ? 0.25 : -wind * 0.15,
              mouth: hit > 0 ? 'grin' : 'smile',
              eyes: hit > 0 ? 'closed' : 'normal',
              blink: blinking(s.time, 5),
            })
            // Ammunition under one arm, the next one in hand.
            fillCirc(ctx, a.handB.x + 1, a.handB.y - 1, 3.4, '#f4f8fc')
            fillCirc(ctx, a.handB.x - 2.5, a.handB.y - 3, 3, '#e6f1fb')
            if (wind > 0) fillCirc(ctx, a.handF.x, a.handF.y, 3.2, '#f4f8fc')
          })
          if (ballT >= 0) {
            const tx = x - dir * 7 * s.u
            const ty = s.ground - 38 * s.u
            const bx = lerp(ballX0, tx, ballT)
            const by = lerp(ballY0, ty, ballT) - Math.sin(ballT * Math.PI) * 20 * s.u
            fillCirc(ctx, bx, by, 3 * s.u, '#f4f8fc')
            fillCirc(ctx, bx - dir * 0.8 * s.u, by + 0.8 * s.u, 1.6 * s.u, '#d5e3f1')
          }
        }
      },
    })
  },
}

// ─── The ride-on snow blower ─────────────────────────────────────────────────
// A machine slightly too small for its driver, chewing the drift up at the
// front and firing it out of the chute in a great arc behind. One time in
// three it coughs, dies, and has to be pushed home.

function drawBlower(ctx: Ctx, t: number, running: boolean, wheel: number, body: string) {
  // Chute: up from the auger housing and curling back over the driver's side.
  poly(ctx, [19, -19, 19, -33, 15, -40, 8, -43], 5.6, '#475569')
  poly(ctx, [20.4, -20, 20.4, -33, 16, -39], 1.2, alpha('#ffffff', 0.25))
  fillRR(ctx, 15.5, -24.5, 7, 2.4, 1, '#334155')
  ctx.save()
  ctx.translate(8, -43)
  ctx.rotate(-0.35)
  fillRR(ctx, -5, -3.8, 7, 7.6, 2, '#334155')
  ctx.restore()
  // Bodywork.
  fillRR(ctx, -17, -21, 31, 15, 4.5, body)
  fillRR(ctx, -17, -11, 31, 5, 2.5, shade(body, -0.22))
  fillRR(ctx, -1, -20, 13, 3, 1.5, shade(body, 0.25))
  for (let i = 0; i < 3; i++) line(ctx, 1 + i * 3.4, -15.5, 1 + i * 3.4, -12.5, 1, shade(body, -0.35))
  fillCirc(ctx, 12.2, -16, 1.8, running ? C.yellow : '#b7a56a')
  // Seat back and the little exhaust.
  fillRR(ctx, -19, -29, 4, 10, 2, '#1f2937')
  fillRR(ctx, -8, -24, 2.4, 4, 1, '#64748b')
  // Auger housing, with the screw turning inside.
  fillPoly(ctx, [13, -21, 24, -19.5, 28.5, -9, 28.5, -1, 13, -1], C.gold)
  fillPoly(ctx, [13, -21, 24, -19.5, 25.5, -16, 13, -17], shade(C.gold, 0.25))
  fillRR(ctx, 18, -13.5, 10.5, 12.5, 2, '#1f2937')
  for (let i = 0; i < 3; i++) {
    const p = (((running ? t * 3 : 0) + i / 3) % 1) * 12.5
    line(ctx, 19.5, -13 + p, 27, -13 + ((p + 4) % 12.5), 1.6, '#cbd5e1')
  }
  // Wheels: a fat one at the back, a small one under the nose.
  const tyre = (cx: number, r: number) => {
    fillCirc(ctx, cx, -r, r, '#1f2937')
    fillCirc(ctx, cx, -r, r * 0.52, '#94a3b8')
    for (let i = 0; i < 4; i++) {
      const a = wheel / r + (i * TAU) / 4
      line(ctx, cx + Math.cos(a) * r * 0.6, -r + Math.sin(a) * r * 0.6, cx + Math.cos(a) * r * 0.92, -r + Math.sin(a) * r * 0.92, 1.3, '#475569')
    }
    fillCirc(ctx, cx, -r, r * 0.2, '#334155')
  }
  tyre(-9, 7)
  tyre(7, 4.6)
  // Handlebar on its column.
  line(ctx, 3, -20, 0.5, -29, 1.6, '#334155')
  line(ctx, -1.5, -29.5, 2.5, -28.5, 2.2, '#1f2937')
}

const snowBlower: ActDef = {
  id: 'winter.snow-blower',
  weight: 3,
  clears: true,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 55)
    const speed = Math.max(62 * stage.u, stage.w / 18)
    const gag = rng() < 0.36 ? 'breakdown' : 'plain'
    const dieAt = stage.w * range(rng, 0.4, 0.58)
    const body = pick(rng, [C.red, '#2f80c2', C.orange])
    const driver: Look = {
      ...pick(rng, [CAST.grandad, CAST.mum, CAST.gardener] as Look[]),
      hat: 'bobble',
      hatColor: pick(rng, [C.mint, C.yellow, C.purple]),
      hatTrim: C.white,
      scarf: pick(rng, [C.red, C.sky, C.pink]),
      gloves: '#334155',
    }
    let x = from
    let wheel = 0
    let phase: 'drive' | 'cough' | 'hop' | 'push' = 'drive'
    let pt = 0
    let walk = 0
    let acc = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const nose = x + dir * 24 * s.u
        const travelled = dir === 1 ? x : s.w - x
        if (phase === 'drive') {
          x += dir * speed * dt
          wheel += (speed / s.u) * dt
          // The auger churns up whatever is in front and the chute throws it clear.
          const depth = s.particles.heightAt(nose)
          s.particles.blast(nose, 9 * s.u, -dir * 0.15, 45 * s.u)
          acc += dt * (depth > 1.5 ? 34 : 9)
          while (acc >= 1) {
            acc -= 1
            puff(s, x + dir * 5 * s.u, s.ground - 46 * s.u, 1, -dir * range(rng, 70, 150), -range(rng, 110, 170), 30, depth > 1.5)
          }
          if (gag === 'breakdown' && travelled > dieAt) {
            phase = 'cough'
            pt = 0
          }
        } else if (phase === 'cough') {
          // Two bangs and a cloud of smoke.
          for (const at2 of [0.35, 1.0]) {
            if (pt >= at2 && pt - dt < at2) {
              burst(s, 'dust', x - dir * 7 * s.u, s.ground - 26 * s.u, 7, ['#64748b', '#94a3b8', '#475569'], 55, [5, 10])
              burst(s, 'spark', x - dir * 7 * s.u, s.ground - 24 * s.u, 4, [C.amber, C.yellow], 70, [1.5, 2.5])
            }
          }
          if (pt > 2.3) {
            phase = 'hop'
            pt = 0
          }
        } else if (phase === 'hop') {
          if (pt > 0.6) {
            phase = 'push'
            pt = 0
          }
        } else {
          const v = Math.max(44 * s.u, s.w / 26)
          x += dir * v * dt
          wheel += (v / s.u) * dt
          walk += dt * 8.5
          s.particles.sweep(x - dir * 30 * s.u, nose + dir * 4 * s.u)
          // It is still smoking gently.
          if (Math.floor(t * 3) !== Math.floor((t - dt) * 3)) {
            s.particles.emit({
              kind: 'dust',
              x: x - dir * 7 * s.u,
              y: s.ground - 26 * s.u,
              vx: -dir * 10 * s.u,
              vy: -range(rng, 20, 40) * s.u,
              size: range(rng, 4, 7) * s.u,
              color: '#64748b',
              life: 1.1,
            })
          }
        }
        const tail = phase === 'push' ? x - dir * 34 * s.u : x - dir * 20 * s.u
        return !past(tail, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const running = phase === 'drive'
        const coughing = phase === 'cough'
        const shake = running ? Math.sin(t * 46) * 0.35 : coughing && pt < 1.2 ? Math.sin(t * 60) * 1.1 : 0
        const seated = phase === 'drive' || phase === 'cough'
        const hop = phase === 'hop' ? pt / 0.6 : 0
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 2, 26)
          if (seated) {
            // The driver sits low; the bodywork hides everything below the waist.
            ctx.save()
            ctx.translate(-9, -8 + shake * 0.5)
            const a = drawPerson(ctx, driver, {
              crouch: 0.9,
              armF: 1.25,
              elbowF: 0.35,
              armB: 1.05,
              elbowB: 0.5,
              lean: coughing ? (pt > 1.2 ? 0.3 : -0.12) : 0.06,
              headTilt: coughing && pt > 1.2 ? 0.25 : 0,
              mouth: coughing ? (pt < 1.2 ? 'o' : 'frown') : 'grin',
              eyes: coughing && pt < 1.2 ? 'wide' : 'normal',
              blink: blinking(s.time, 3),
            })
            if (coughing && pt > 1.3) bubble(ctx, a.head.x, a.head.y - 19, '?', { size: 9 })
            ctx.restore()
          }
          ctx.save()
          ctx.translate(0, shake)
          drawBlower(ctx, t, running, wheel, body)
          ctx.restore()
        })
        if (!seated) {
          // Off he gets, round the back, and puts his shoulder into it.
          const px = x - dir * lerp(9, 31, easeInOut(hop || 1)) * s.u
          const lift = hop > 0 ? Math.sin(hop * Math.PI) * 9 : 0
          at(ctx, px, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 12)
            const a = drawPerson(ctx, driver, {
              walk,
              stride: phase === 'push' ? 0.75 : 0,
              lift,
              armF: 1.35,
              elbowF: 0.15,
              armB: 1.2,
              elbowB: 0.2,
              lean: phase === 'push' ? 0.42 : 0.1,
              mouth: 'puff',
              eyes: phase === 'push' ? 'closed' : 'normal',
            })
            if (phase === 'push') sweat(ctx, a.head.x - 3, a.head.y - 8, t)
          })
        }
      },
    })
  },
}

// ─── Building a snowman ──────────────────────────────────────────────────────
// A child rolls a snowball in (it grows as it picks up the drift), goes back
// for a second, pats a head together, then the carrot, the twigs and the hat.
// What happens to the finished article varies. Either way it sinks back into
// the snow once nobody is looking.

interface SnowmanState {
  base: number
  mid: number
  head: number
  carrot: number
  arms: number
  hat: number
  /** Hat lifted off the head, units. */
  hatLift: number
  hatTip: number
  wink: boolean
  /** Head has left the building: the hat sits on the shoulders instead. */
  headless: boolean
  headRot: number
  melt: number
}

function drawSnowHat(ctx: Ctx) {
  fillRR(ctx, -6.4, -1.8, 12.8, 2.2, 1, '#334155')
  fillRR(ctx, -4.4, -10, 8.8, 9, 1.6, '#3f4d63')
  fillRR(ctx, -4.4, -4.6, 8.8, 2.4, 0.5, C.red)
  fillRR(ctx, -4.4, -10, 2.2, 5.4, 1, '#56657d')
}

/** The head on its own, centred on the origin, so it can also roll away. */
function drawSnowHead(ctx: Ctx, carrot: number, wink: boolean) {
  drawSnowball(ctx, 0, 0, 6.3, 0.6)
  if (wink) line(ctx, 0.6, -1.8, 2.6, -1.8, 0.9, C.ink)
  else fillCirc(ctx, 1.6, -1.8, 0.95, C.ink)
  fillCirc(ctx, 4.6, -1.8, 0.95, C.ink)
  for (let i = 0; i < 4; i++) fillCirc(ctx, 0.6 + i * 1.3, 2.6 + Math.sin((i / 3) * Math.PI) * 0.9, 0.5, C.ink)
  if (carrot > 0) {
    fillPoly(ctx, [4.6, -0.9, 4.6, 1.5, 4.6 + 8.5 * carrot, 0.7], C.orange)
    fillPoly(ctx, [4.6, 0.4, 4.6, 1.5, 4.6 + 8.5 * carrot, 0.7], shade(C.orange, -0.2))
  }
}

function drawSnowman(ctx: Ctx, m: SnowmanState, t: number) {
  if (m.melt >= 1) return
  ctx.save()
  ctx.scale(1 + m.melt * 0.45, 1 - m.melt)
  if (m.base > 0) {
    groundShadow(ctx, 0, 14 * m.base, 0.22)
    drawSnowball(ctx, 0, -12, 13 * m.base, 0.3)
  }
  if (m.mid > 0) {
    drawSnowball(ctx, 0, -31, 9 * m.mid, 1.4)
    if (m.arms > 0) {
      // Twig arms, with a couple of fingers each.
      const w = Math.sin(t * 2) * 0.6
      poly(ctx, [7, -33, 7 + 11 * m.arms, -39 - w, 7 + 15 * m.arms, -38 - w], 1.3, C.brown)
      line(ctx, 7 + 11 * m.arms, -39 - w, 7 + 13 * m.arms, -43 - w, 1.1, C.brown)
      poly(ctx, [-7, -33, -7 - 11 * m.arms, -40 + w, -7 - 15 * m.arms, -39 + w], 1.3, C.brown)
      line(ctx, -7 - 11 * m.arms, -40 + w, -7 - 12 * m.arms, -44 + w, 1.1, C.brown)
      fillCirc(ctx, 3.4, -33.5, 1, '#334155')
      fillCirc(ctx, 3.8, -29, 1, '#334155')
      fillCirc(ctx, 3.4, -24.6, 1, '#334155')
    }
  }
  if (m.head > 0 && !m.headless) {
    ctx.save()
    ctx.translate(0, -44.5)
    ctx.rotate(m.headRot)
    ctx.scale(m.head, m.head)
    drawSnowHead(ctx, m.carrot, m.wink)
    ctx.restore()
    // A scarf where the head meets the shoulders.
    fillRR(ctx, -6, -40.4, 12, 2.8, 1.4, C.crimson)
    poly(ctx, [-4, -39, -6.5, -34.5, -6, -31], 2.4, C.crimson)
  }
  if (m.hat > 0) {
    ctx.save()
    ctx.translate(0, m.headless ? -39 : -49.6 - m.hatLift)
    ctx.rotate((m.headless ? 0.28 : 0) + m.headRot * 0.6 - m.hatTip)
    ctx.scale(m.hat, m.hat)
    drawSnowHat(ctx)
    ctx.restore()
  }
  ctx.restore()
}

const snowman: ActDef = {
  id: 'winter.snowman',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const u = stage.u
    const edge = dir === 1 ? 0 : stage.w
    const spot = edge + dir * Math.min(stage.w * 0.45, 230 * u)
    const gag = pick(rng, ['dog', 'head', 'proud'] as const)
    const look: Look = chance(rng, 0.5)
      ? { ...CAST.kid, hat: 'bobble', hatColor: C.red, hatTrim: C.white, scarf: C.mint, gloves: C.red }
      : { ...CAST.girl, hat: 'bobble', hatColor: C.pink, hatTrim: C.white, scarf: C.yellow, gloves: C.purple }
    type Phase = 'roll1' | 'back' | 'roll2' | 'lift' | 'head' | 'dress' | 'admire' | 'gag' | 'chase' | 'tip' | 'melt'
    let phase: Phase = 'roll1'
    let pt = 0
    let x = from
    let face: Dir = dir
    let walk = 0
    let r1 = 5
    let r2 = 3
    let spin = 0
    let b2x = 0
    const rollFrom = from
    const m: SnowmanState = {
      base: 0, mid: 0, head: 0, carrot: 0, arms: 0, hat: 0, hatLift: 0, hatTip: 0, wink: false, headless: false, headRot: 0, melt: 0,
    }
    // Dog gag.
    let dogX = to
    let dogFace: Dir = -dir as Dir
    let dogRun = 0
    let dogHas = false
    const dogSpeed = Math.max(175 * u, Math.abs(to - spot) / 2.4)
    // Runaway head gag.
    let hx = 0
    let hy = 0
    let hrot = 0
    const next = (p: Phase) => {
      phase = p
      pt = 0
    }
    const go = (s: Stage, dt: number, v: number, d: Dir) => {
      x += d * v * s.u * dt
      walk += dt * (v / 5.6)
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'roll1') {
          go(s, dt, 50, dir)
          const p = clamp((x - rollFrom) / (spot - 20 * s.u * dir - rollFrom))
          r1 = lerp(5, 13, p)
          spin += (50 * dt) / r1
          const bx = x + dir * (r1 + 7) * s.u
          s.particles.sweep(bx - r1 * s.u, bx + r1 * s.u)
          if (past(bx, spot, dir)) {
            m.base = 1
            face = -dir as Dir
            next('back')
          }
        } else if (phase === 'back') {
          go(s, dt, 55, -dir as Dir)
          if (Math.abs(x - spot) > 78 * s.u) {
            face = dir
            r2 = 3
            spin = 0
            next('roll2')
          }
        } else if (phase === 'roll2') {
          go(s, dt, 46, dir)
          b2x = x + dir * (r2 + 7) * s.u
          const gap = Math.abs(spot - b2x) / s.u
          r2 = lerp(9, 3, clamp((gap - 20) / 48))
          spin += (46 * dt) / r2
          s.particles.sweep(b2x - r2 * s.u, b2x + r2 * s.u)
          if (gap <= 20) next('lift')
        } else if (phase === 'lift') {
          if (pt > 0.9) {
            m.mid = 1
            puff(s, spot, s.ground - 24 * s.u, 5, 0, -20, 70)
            next('head')
          }
        } else if (phase === 'head') {
          if (pt > 1.4) {
            m.head = 1
            next('dress')
          }
        } else if (phase === 'dress') {
          m.carrot = easeBack(seg(pt, 0.2, 0.55))
          m.arms = easeOut(seg(pt, 0.7, 1.0))
          m.hat = easeBack(seg(pt, 1.2, 1.6))
          if (pt > 1.9) next('admire')
        } else if (phase === 'admire') {
          if (gag === 'dog') {
            dogX += dogFace * dogSpeed * dt
            dogRun += dt * 15
            if (past(dogX, spot + dir * 25 * s.u, dogFace)) next('gag')
          } else if (pt > (gag === 'proud' ? 1.6 : 0.9)) next(gag === 'proud' ? 'chase' : 'gag')
        } else if (phase === 'gag') {
          if (gag === 'dog') {
            // Up, snap, and away with the nose.
            if (pt >= 0.3 && !dogHas) {
              dogHas = true
              m.carrot = 0
              puff(s, spot + dir * 6 * s.u, s.ground - 44 * s.u, 4, dir * 20, -10, 50)
            }
            if (pt > 0.6) {
              dogFace = dir
              next('chase')
            }
          } else {
            // The head works loose, topples and makes a run for it.
            m.headRot = Math.sin(pt * 13) * 0.12 * clamp(pt / 0.6) + easeIn(seg(pt, 0.7, 1.2)) * 1.3
            if (pt > 0.7) {
              m.headless = true
              const p = seg(pt, 0.7, 1.2)
              hx = spot + dir * lerp(4, 22, p) * s.u
              hy = s.ground - lerp(44.5, 6.3, easeIn(p)) * s.u
              hrot = p * 2.4
            }
            if (pt > 1.2) {
              puff(s, hx, s.ground - 2 * s.u, 6, dir * 20, -30, 80)
              next('chase')
            }
          }
        } else if (phase === 'chase') {
          if (gag === 'dog') {
            dogX += dir * dogSpeed * 1.05 * dt
            dogRun += dt * 17
          } else if (gag === 'head') {
            const v = Math.min(150, 70 + pt * 60)
            hx += dir * v * s.u * dt
            hrot += (v * dt) / 6.3
            hy = s.ground - (6.3 + Math.abs(Math.sin(pt * 7)) * 2.2 * clamp(1 - pt / 3)) * s.u
          }
          // The child sets off a beat late.
          if (gag === 'proud' || pt > 0.45) go(s, dt, gag === 'proud' ? 100 : 128, dir)
          const lead = gag === 'dog' ? dogX : gag === 'head' ? hx : x
          if (past(x, to, dir) && past(lead, to, dir)) next(gag === 'proud' ? 'tip' : 'melt')
        } else if (phase === 'tip') {
          // Alone at last: a tip of the hat for whoever is still watching.
          const p = Math.sin(seg(pt, 0.3, 1.5) * Math.PI)
          m.hatTip = p * 0.5
          m.hatLift = p * 3
          m.wink = pt > 0.5 && pt < 1.4
          if (pt > 1.9) next('melt')
        } else {
          m.melt = easeInOut(clamp(pt / 1.7))
          if (pt > 1.7) return false
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const built = phase !== 'roll1'
        if (built) at(ctx, spot, s.ground, s.u, dir, () => drawSnowman(ctx, m, t))
        // Loose balls on their way to becoming a snowman.
        if (phase === 'roll1') {
          const bx = x + dir * (r1 + 7) * s.u
          at(ctx, bx, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, r1)
            drawSnowball(ctx, 0, -r1 + 1, r1, spin)
          })
        } else if (phase === 'roll2') {
          at(ctx, b2x, s.ground, s.u, dir, () => drawSnowball(ctx, 0, -r2 + 1, r2, spin))
        } else if (phase === 'lift') {
          const p = easeInOut(clamp(pt / 0.9))
          at(ctx, spot, s.ground, s.u, dir, () => drawSnowball(ctx, lerp(-20, 0, p), lerp(-8, -31, p) - Math.sin(p * Math.PI) * 9, 9, spin + p))
        } else if (phase === 'head' && pt > 0.15) {
          const grow = clamp((pt - 0.15) / 0.5)
          const p = easeInOut(seg(pt, 0.75, 1.4))
          at(ctx, spot, s.ground, s.u, dir, () =>
            drawSnowball(ctx, lerp(-17, 0, p), lerp(-7, -44.5, p) - Math.sin(p * Math.PI) * 10, 6.3 * grow, p * 3),
          )
        }
        if (gag === 'head' && m.headless) {
          at(ctx, hx, hy, s.u, dir, () => {
            ctx.rotate(hrot)
            drawSnowHead(ctx, m.carrot, false)
          })
        }
        if (gag === 'dog' && (phase === 'admire' || phase === 'gag' || phase === 'chase')) {
          const jump = phase === 'gag' ? Math.sin(clamp(pt / 0.6) * Math.PI) * 21 : 0
          at(ctx, dogX, s.ground - jump * s.u, s.u, dogFace, () => {
            if (!jump) groundShadow(ctx, 0, 14)
            const d = drawDog(ctx, DOG, { run: dogRun, stride: phase === 'gag' ? 0.3 : 0.9, wag: t * 16, mouthOpen: phase === 'gag' && !dogHas })
            if (dogHas) {
              fillPoly(ctx, [d.mouth.x - 2, d.mouth.y - 1.6, d.mouth.x - 2, d.mouth.y + 0.8, d.mouth.x + 8, d.mouth.y - 0.4], C.orange)
            }
          })
        }
        // The builder.
        const pushing = phase === 'roll1' || phase === 'roll2'
        const lifting = phase === 'lift' || (phase === 'head' && pt > 0.75)
        const scooping = phase === 'head' && pt <= 0.75
        const dressing = phase === 'dress'
        const shocked = phase === 'gag' || (phase === 'chase' && gag !== 'proud')
        const cheering = phase === 'admire' && gag !== 'dog' ? Math.abs(Math.sin(pt * 6)) : 0
        const reach = dressing ? Math.sin(seg(pt, 0.1, 0.6) * Math.PI) + Math.sin(seg(pt, 1.1, 1.7) * Math.PI) : 0
        const gone = phase === 'tip' || phase === 'melt'
        if (!gone) {
          at(ctx, x, s.ground, s.u * KID, face, () => {
            groundShadow(ctx, 0, 11)
            const a = drawPerson(ctx, look, {
              walk,
              stride: pushing || phase === 'back' ? 0.8 : phase === 'chase' && (gag === 'proud' || pt > 0.45) ? 1 : 0,
              armF: pushing ? 1.2 : lifting ? 2.5 : scooping ? 0.5 : reach > 0 ? 1.2 + reach * 1.3 : cheering ? 2.9 : shocked ? 1.6 : undefined,
              elbowF: pushing ? 0.25 : lifting ? 0.3 : scooping ? 0.4 : cheering ? 0.1 : shocked ? 0.2 : undefined,
              armB: pushing ? 1.05 : lifting ? 2.2 : scooping ? 0.8 : cheering ? 2.6 : shocked ? 1.3 : undefined,
              elbowB: pushing ? 0.3 : lifting ? 0.3 : cheering ? 0.1 : undefined,
              lean: pushing ? 0.34 : scooping ? 0.5 : shocked && phase === 'chase' ? 0.25 : 0,
              crouch: scooping ? 0.8 : 0,
              lift: cheering * 5 + (dressing && pt > 1.1 && pt < 1.6 ? Math.sin(seg(pt, 1.1, 1.6) * Math.PI) * 7 : 0),
              mouth: shocked ? 'o' : cheering || (phase === 'chase' && gag === 'proud') ? 'grin' : pushing ? 'puff' : 'smile',
              eyes: shocked ? 'wide' : 'normal',
              blink: blinking(s.time, 4),
            })
            if (phase === 'gag' && pt < 0.6) bubble(ctx, a.head.x, a.head.y - 20, '!', { size: 10 })
            // Carrot, then hat, carried up in the front hand.
            if (dressing && pt < 0.35) fillPoly(ctx, [a.handF.x, a.handF.y - 1.2, a.handF.x, a.handF.y + 1.2, a.handF.x + 9, a.handF.y], C.orange)
            if (dressing && pt > 0.95 && pt < 1.3) {
              ctx.save()
              ctx.translate(a.handF.x + 2, a.handF.y - 1)
              drawSnowHat(ctx)
              ctx.restore()
            }
          })
        }
      },
    })
  },
}

// ─── The sledge run ──────────────────────────────────────────────────────────
// Two on a wooden sledge, far too fast. A bump, and the one at the back is no
// longer on it. Sometimes neither of them is.

function drawSledge(ctx: Ctx) {
  // Red runners curling up at the front, wooden slats on top.
  poly(ctx, [-17, -0.4, 15, -0.4, 19.5, -3, 19.5, -7.5, 16.5, -9], 1.7, C.red)
  line(ctx, -12, -0.4, -12, -6, 1.5, shade(C.red, -0.2))
  line(ctx, 8, -0.4, 8, -6, 1.5, shade(C.red, -0.2))
  fillRR(ctx, -17, -8.4, 32, 2.8, 1.2, C.tan)
  fillRR(ctx, -17, -6.6, 32, 1, 0.5, shade(C.tan, -0.25))
  for (let i = 0; i < 3; i++) line(ctx, -9 + i * 9, -8, -9 + i * 9, -6.2, 0.7, shade(C.tan, -0.3))
}

interface Tumbler {
  look: Look
  x: number
  phase: 'on' | 'air' | 'sit' | 'run'
  pt: number
  walk: number
  /** Seat position on the sledge, units. */
  seat: number
  seed: number
}

const sledgeRun: ActDef = {
  id: 'winter.sledge-run',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const speed = Math.max(230 * stage.u, stage.w / 5)
    const gag = rng() < 0.62 ? 'one' : 'both'
    const bumpAt = stage.w * range(rng, 0.3, 0.45)
    const flip = chance(rng, 0.5)
    const lookA: Look = { ...CAST.kid, hat: 'bobble', hatColor: C.red, hatTrim: C.white, scarf: C.sky, gloves: C.red }
    const lookB: Look = { ...CAST.girl, hat: 'bobble', hatColor: C.mint, hatTrim: C.white, scarf: C.pink, gloves: C.purple }
    const riders: Tumbler[] = [
      { look: flip ? lookA : lookB, x: 0, phase: 'on', pt: 0, walk: 0, seat: 6, seed: 1 },
      { look: flip ? lookB : lookA, x: 0, phase: 'on', pt: 0, walk: 0, seat: -8, seed: 2 },
    ]
    let x = from
    let bumped = false
    let hop = 1 // 0..1 through the bump
    return makeAct({
      update(s, dt, t) {
        x += dir * speed * dt
        hop = Math.min(1, hop + dt / 0.38)
        const travelled = dir === 1 ? x : s.w - x
        if (!bumped && travelled > bumpAt) {
          bumped = true
          hop = 0
          puff(s, x, s.ground - 2 * s.u, 8, -dir * 40, -50, 90, true)
          const off = gag === 'both' ? riders : [riders[1]]
          for (const r of off) {
            r.phase = 'air'
            r.pt = r.seat > 0 ? -0.12 : 0
            r.x = x + dir * r.seat * s.u
          }
        }
        // Spray off the runners.
        if (x > -20 && x < s.w + 20 && Math.floor(t * 22) !== Math.floor((t - dt) * 22)) {
          puff(s, x - dir * 16 * s.u, s.ground - 1.5 * s.u, 1, -dir * 70, -35, 40)
        }
        let allGone = past(x - dir * 30 * s.u, to, dir)
        for (const r of riders) {
          if (r.phase === 'on') continue
          r.pt += dt
          if (r.phase === 'air') {
            if (r.pt > 0) r.x += dir * speed * 0.42 * (1 - clamp(r.pt / 0.7)) * dt
            if (r.pt > 0.7) {
              r.phase = 'sit'
              r.pt = 0
              puff(s, r.x, s.ground - 3 * s.u, 16, 0, -60, 150, true)
            }
          } else if (r.phase === 'sit') {
            if (r.pt > (r.seat > 0 ? 1.9 : 1.5)) {
              r.phase = 'run'
              r.pt = 0
            }
          } else {
            r.x += dir * 150 * s.u * dt
            r.walk += dt * 20
          }
          if (!past(r.x - dir * 20 * s.u, to, dir)) allGone = false
        }
        return !allGone
      },
      draw(s, t) {
        const { ctx } = s
        const lift = Math.sin(hop * Math.PI) * 7
        const pitch = -dir * Math.sin(hop * Math.PI) * 0.16
        at(
          ctx,
          x,
          s.ground - lift * s.u,
          s.u,
          dir,
          () => {
            groundShadow(ctx, 0, 18, 0.2)
            speedLines(ctx, -24, -14, 16, t)
            // Back rider first so the one in front overlaps.
            for (let i = 1; i >= 0; i--) {
              const r = riders[i]
              if (r.phase !== 'on') continue
              ctx.save()
              ctx.translate(r.seat, -7)
              ctx.scale(KID, KID)
              const front = i === 0
              const a = drawPerson(ctx, r.look, {
                walk: t * 18 + i,
                crouch: 1,
                lean: front ? 0.3 : 0.12,
                armF: front ? 1.1 : 2.8 + Math.sin(t * 9) * 0.2,
                elbowF: front ? 0.5 : 0.1,
                armB: front ? 0.9 : 2.5 + Math.cos(t * 9) * 0.2,
                elbowB: front ? 0.6 : 0.1,
                mouth: front ? 'o' : 'grin',
                eyes: front ? 'wide' : 'closed',
              })
              if (front) {
                // The steering rope, for all the good it does.
                ctx.scale(1 / KID, 1 / KID)
                poly(ctx, [a.handF.x * KID, a.handF.y * KID, 14 - r.seat, -3, 18.5 - r.seat, -0.5], 0.8, C.cream)
              }
              ctx.restore()
            }
            drawSledge(ctx)
          },
          pitch,
        )
        for (const r of riders) {
          if (r.phase === 'on') continue
          const air = r.phase === 'air' ? clamp(r.pt / 0.7) : 0
          const sitting = r.phase === 'sit'
          const rising = sitting && r.pt > 1.1
          at(
            ctx,
            r.x,
            s.ground - (r.phase === 'air' ? (7 + Math.sin(air * Math.PI) * 20) * (1 - air * 0.3) * s.u : 0),
            s.u * KID,
            dir,
            () => {
              if (r.phase !== 'air') groundShadow(ctx, 0, 11)
              const a = drawPerson(ctx, r.look, {
                walk: r.walk,
                stride: r.phase === 'run' ? 1 : 0,
                crouch: r.phase === 'air' ? 0.8 : sitting ? (rising ? 0.4 : 1.1) : 0,
                armF: r.phase === 'run' ? 1.7 : r.phase === 'air' ? 2.6 : rising ? 0.6 : -0.5,
                elbowF: r.phase === 'run' ? 0.2 : 0.3,
                armB: r.phase === 'air' ? -2.2 : sitting ? -0.7 : undefined,
                lean: r.phase === 'run' ? 0.3 : sitting && !rising ? -0.25 : 0,
                mouth: r.phase === 'run' ? 'o' : sitting && !rising ? 'frown' : 'o',
                eyes: r.phase === 'air' ? 'wide' : sitting && !rising ? 'closed' : 'normal',
                blink: blinking(s.time, r.seed),
              })
              if (sitting) {
                // A dollop of snow on the hat, and a moment to think about it.
                fillEll(ctx, a.crown.x - 1, a.crown.y - 3, 6, 3, '#f4f8fc')
                if (!rising) dizzy(ctx, a.head.x, a.head.y - 18, t + r.seed)
              }
              if (r.phase === 'run' && r.pt < 0.8) bubble(ctx, a.head.x, a.head.y - 20, '!', { size: 10 })
            },
            r.phase === 'air' ? -dir * air * TAU : 0,
          )
        }
      },
    })
  },
}

// ─── Penguins ────────────────────────────────────────────────────────────────
// Nobody knows where they came from. A penguin waddles in with great dignity,
// decides walking is for other birds, and toboggans the rest of the way on its
// front. Sometimes it has brought the family.

interface PenguinLook {
  scarf?: string
  hat?: string
  fish?: boolean
}

/**
 * A penguin about 31 units tall. `step` is the waddle phase, `slide` 0..1 tips
 * it forward onto its belly, `flap` lifts the flippers.
 */
function drawPenguin(ctx: Ctx, step: number, slide: number, flap: number, look: PenguinLook, blink: boolean) {
  const coat = '#4a5d86'
  const dark = '#33415f'
  ctx.save()
  ctx.translate(-7 * slide, -8.5 * slide)
  ctx.rotate(slide * 1.5 + Math.sin(step) * 0.13 * (1 - slide))
  // Feet: paddling when upright, trailing when sliding.
  const fl = Math.max(0, Math.sin(step)) * 2 * (1 - slide)
  const fr = Math.max(0, -Math.sin(step)) * 2 * (1 - slide)
  fillEll(ctx, -2.5 - slide * 2, -0.5 - fr + slide * 1.5, 4, 1.7, shade(C.orange, -0.15), slide * 0.9)
  fillEll(ctx, 3 - slide * 3, -0.5 - fl + slide * 1, 4.2, 1.8, C.orange, slide * 0.9)
  // Tail, body, belly.
  fillPoly(ctx, [-6, -6, -11.5, -1.5, -5, -1], dark)
  fillEll(ctx, 0, -13, 8.8, 13, coat)
  fillEll(ctx, -3.4, -13, 4.6, 11.5, dark)
  fillEll(ctx, 2.6, -11.6, 6, 10.6, '#f4f8fc')
  fillEll(ctx, 3.6, -8, 4.6, 6.4, '#ffffff')
  // Head, with the yellow ear patch.
  fillCirc(ctx, 1, -25, 7.2, coat)
  fillEll(ctx, -1.6, -25.6, 4, 5.6, dark)
  fillEll(ctx, 4, -23.6, 4.3, 4.6, '#f4f8fc')
  fillEll(ctx, -0.4, -21.4, 2.6, 3.4, C.yellow, 0.4)
  if (blink) line(ctx, 3.6, -26, 5.8, -26, 0.9, C.ink)
  else {
    fillCirc(ctx, 4.8, -26, 1.25, C.ink)
    fillCirc(ctx, 5.2, -26.4, 0.4, '#ffffff')
  }
  fillPoly(ctx, [7.2, -25, 13.4, -23, 7.2, -21.4], C.orange)
  fillPoly(ctx, [7.2, -23, 13.4, -23, 7.2, -21.4], shade(C.orange, -0.2))
  if (look.fish) {
    fillEll(ctx, 12.5, -20.5, 1.8, 4.2, C.sky, 0.15)
    fillPoly(ctx, [12, -16.8, 10.2, -13.8, 14.4, -14.2], C.sky)
    fillCirc(ctx, 12.9, -23, 0.5, C.ink)
  }
  if (look.scarf) {
    fillRR(ctx, -5.6, -20.4, 12.4, 3, 1.5, look.scarf)
    const f = Math.sin(step * 1.3) * 1.5 + slide * 3
    poly(ctx, [-4, -19, -9, -16 - f, -12 - slide * 5, -12 - f], 2.6, look.scarf)
  }
  if (look.hat) {
    ctx.beginPath()
    ctx.arc(0.6, -29, 6.4, Math.PI * 1.02, Math.PI * 1.98)
    ctx.closePath()
    ctx.fillStyle = look.hat
    ctx.fill()
    fillRR(ctx, -6, -30.2, 13.4, 2.6, 1.2, '#f4f8fc')
    fillCirc(ctx, 0.2, -36.4, 2.3, '#f4f8fc')
  }
  // Near flipper, over everything.
  ctx.save()
  ctx.translate(-1.5, -18.5)
  ctx.rotate(0.25 + flap * 1.3 + slide * 1.1 + Math.sin(step) * 0.2 * (1 - slide))
  fillEll(ctx, -1, 6, 2.6, 7, dark)
  fillEll(ctx, -0.4, 6, 1.2, 5.4, coat)
  ctx.restore()
  ctx.restore()
}

interface Penguin {
  x: number
  scale: number
  step: number
  /** 0 waddling, 1 looking at the slope, 2 hop, 3 sliding. */
  mode: 0 | 1 | 2 | 3
  pt: number
  pause: number
  look: PenguinLook
  seed: number
}

const penguins: ActDef = {
  id: 'winter.penguins',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 30)
    const u = stage.u
    const edge = dir === 1 ? 0 : stage.w
    const slideAt = edge + dir * Math.min(stage.w * 0.5, 210 * u)
    const trio = chance(rng, 0.45)
    const flock: Penguin[] = trio
      ? [
          { x: from, scale: 1, step: 0, mode: 0, pt: 0, pause: 0.5, look: { scarf: C.red }, seed: 1 },
          { x: from - dir * 31 * u, scale: 0.78, step: 1, mode: 0, pt: 0, pause: 0.25, look: {}, seed: 2 },
          { x: from - dir * 56 * u, scale: 0.58, step: 2, mode: 0, pt: 0, pause: 1.3, look: { hat: C.red }, seed: 3 },
        ]
      : [
          {
            x: from, scale: 1, step: 0, mode: 0, pt: 0, pause: 0.7, seed: 1,
            look: chance(rng, 0.4) ? { fish: true } : { scarf: pick(rng, [C.red, C.yellow, C.mint]) },
          },
        ]
    return makeAct({
      update(s, dt, t) {
        let allGone = true
        for (const p of flock) {
          p.pt += dt
          if (p.mode === 0) {
            p.x += dir * 36 * p.scale ** 0.4 * s.u * dt
            p.step += dt * (7.5 / p.scale ** 0.6)
            if (past(p.x, slideAt, dir)) {
              p.mode = 1
              p.pt = 0
            }
          } else if (p.mode === 1) {
            if (p.pt > p.pause) {
              p.mode = 2
              p.pt = 0
            }
          } else if (p.mode === 2) {
            p.x += dir * 60 * s.u * dt
            if (p.pt > 0.4) {
              p.mode = 3
              p.pt = 0
              puff(s, p.x + dir * 8 * s.u, s.ground - 2 * s.u, 8, dir * 40, -40, 80)
            }
          } else {
            // The little one has ground to make up, and knows it.
            const v = (p.scale < 0.6 ? 235 : 180) * s.u
            p.x += dir * Math.max(v, s.w / 6) * dt
            if (p.x > 0 && p.x < s.w && Math.floor(t * 16 + p.seed) !== Math.floor((t - dt) * 16 + p.seed)) {
              puff(s, p.x + dir * 12 * p.scale * s.u, s.ground - 2 * s.u, 1, dir * 20, -45, 50)
            }
          }
          if (!past(p.x - dir * 25 * s.u, to, dir)) allGone = false
        }
        return !allGone
      },
      draw(s, t) {
        const { ctx } = s
        for (let i = flock.length - 1; i >= 0; i--) {
          const p = flock[i]
          const hop = p.mode === 2 ? clamp(p.pt / 0.4) : 0
          const slide = p.mode === 3 ? 1 : easeIn(hop)
          const lift = Math.sin(hop * Math.PI) * 7
          at(ctx, p.x, s.ground - lift * p.scale * s.u, s.u * p.scale, dir, () => {
            groundShadow(ctx, slide * 2, 9 + slide * 5, 0.22)
            if (p.mode === 3) speedLines(ctx, -18, -8, 12, t + p.seed * 0.3)
            // Peering down the run before committing: flippers out for balance.
            const flap = p.mode === 1 ? 0.5 + Math.sin(p.pt * 16) * 0.3 : p.mode === 2 ? 1 : 0
            drawPenguin(ctx, p.mode === 0 ? p.step : 0, slide, flap, p.look, blinking(s.time, p.seed + 6))
            if (p.mode === 1 && p.pause > 1 && p.pt > 0.3) bubble(ctx, 2, -40, '?', { size: 11 })
          })
        }
      },
    })
  },
}

// ─── The robin ───────────────────────────────────────────────────────────────
// The quiet one. A robin drops out of the sky, has a look round, pecks at the
// snow and is gone again. Sometimes it brings its own fence post.

type RobinStep = { k: 'hop' | 'peck' | 'look' | 'chirp' | 'wait'; d: number }

const robin: ActDef = {
  id: 'winter.robin',
  weight: 2,
  create(stage, rng) {
    const dir: Dir = chance(rng, 0.5) ? 1 : -1
    const onPost = chance(rng, 0.5)
    const home = stage.w * range(rng, 0.22, 0.78)
    const POST = 30
    const steps: RobinStep[] = onPost
      ? [
          { k: 'wait', d: 0.5 }, { k: 'look', d: 0.7 }, { k: 'chirp', d: 0.6 }, { k: 'chirp', d: 0.7 }, { k: 'look', d: 0.7 },
          { k: 'peck', d: 0.3 }, { k: 'peck', d: 0.3 }, { k: 'wait', d: 0.5 }, { k: 'peck', d: 0.3 }, { k: 'chirp', d: 0.8 },
        ]
      : [
          { k: 'wait', d: 0.4 }, { k: 'hop', d: 0.3 }, { k: 'hop', d: 0.3 }, { k: 'peck', d: 0.28 }, { k: 'peck', d: 0.28 },
          { k: 'look', d: 0.6 }, { k: 'hop', d: 0.3 }, { k: 'hop', d: 0.3 }, { k: 'hop', d: 0.3 }, { k: 'wait', d: 0.3 },
          { k: 'peck', d: 0.28 }, { k: 'peck', d: 0.28 }, { k: 'peck', d: 0.4 }, { k: 'wait', d: 0.7 },
        ]
    const RISE = onPost ? 0.9 : 0
    const IN = 1.5
    const OUT = 1.5
    let idx = 0
    let st = 0
    let off = 0 // px along the ground from `home`
    let face: Dir = dir
    let berry = false
    let stage2: 'rise' | 'in' | 'perch' | 'out' | 'sink' = onPost ? 'rise' : 'in'
    let pt = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        if (stage2 === 'rise') {
          if (pt > RISE) {
            stage2 = 'in'
            pt = 0
          }
        } else if (stage2 === 'in') {
          if (pt > IN) {
            stage2 = 'perch'
            pt = 0
          }
        } else if (stage2 === 'perch') {
          const step = steps[idx]
          const before = st
          st += dt
          if (step.k === 'hop') off += (face * 9 * s.u * dt) / step.d
          if (step.k === 'look' && before < step.d / 2 && st >= step.d / 2) face = -face as Dir
          const bx = home + off
          const by = onPost ? s.ground - (POST + 2) * s.u : s.ground - s.particles.heightAt(bx)
          if (step.k === 'peck' && before < step.d / 2 && st >= step.d / 2) {
            puff(s, bx + face * 9 * s.u, by - 1 * s.u, 2, face * 25, -25, 40)
          }
          if (step.k === 'chirp' && before === 0) {
            s.particles.emit({ kind: 'note', x: bx + face * 10 * s.u, y: by - 12 * s.u, vx: face * 10 * s.u, size: 6 * s.u, color: C.cream })
          }
          if (st >= step.d) {
            st = 0
            idx++
            if (idx >= steps.length) {
              // On the ground it leaves with a berry it dug out.
              berry = !onPost
              face = dir
              stage2 = 'out'
              pt = 0
            }
          }
        } else if (stage2 === 'out') {
          if (pt > OUT) {
            if (!onPost) return false
            stage2 = 'sink'
            pt = 0
          }
        } else if (pt > 0.9) return false
        return true
      },
      draw(s, t) {
        const { ctx } = s
        if (onPost) {
          const up = stage2 === 'rise' ? easeOut(clamp(pt / RISE)) : stage2 === 'sink' ? 1 - easeIn(clamp(pt / 0.9)) : 1
          const h = POST * up
          at(ctx, home, s.ground, s.u, 1, () => {
            // A weathered post with a cap of snow.
            fillRR(ctx, -3.6, -h, 7.2, h, 1.2, '#a8763e')
            fillRR(ctx, -3.6, -h, 2.4, h, 1, '#c79457')
            fillRR(ctx, 1.6, -h, 2, h, 1, '#86592b')
            if (h > 14) {
              line(ctx, -0.4, -h + 8, -0.4, -h + 13, 0.6, '#86592b')
              fillEll(ctx, 0.4, -h * 0.45, 0.9, 1.5, '#86592b')
            }
            fillEll(ctx, 0, -h - 0.6, 5.6, 2.8 * up, '#f4f8fc')
            fillEll(ctx, -1, -h - 1.2, 3.4, 1.4 * up, '#ffffff')
            fillEll(ctx, 0, -0.5, 7, 2, '#e6f1fb')
          })
        }
        if (stage2 === 'rise' || stage2 === 'sink') return
        const perchX = home + off
        const perchY = onPost ? s.ground - (POST + 2) * s.u : s.ground - s.particles.heightAt(perchX)
        let bx = perchX
        let by = perchY
        let flying = false
        let tilt = 0
        let fade = 1
        if (stage2 === 'in') {
          const p = clamp(pt / IN)
          bx = lerp(perchX - dir * 150 * s.u, perchX, easeOut(p))
          by = lerp(perchY - 150 * s.u, perchY, easeInOut(p)) - Math.sin(p * Math.PI) * 6 * s.u
          flying = p < 0.94
          tilt = (1 - p) * 0.45
          fade = clamp(p * 5)
        } else if (stage2 === 'out') {
          const p = clamp(pt / OUT)
          bx = lerp(perchX, perchX + dir * 190 * s.u, easeIn(p) * 0.5 + p * 0.5)
          by = perchY - easeInOut(p) * 170 * s.u
          flying = true
          tilt = -0.45 * clamp(p * 4)
          fade = clamp((1 - p) * 4)
        } else {
          const step = steps[idx]
          const p = clamp(st / step.d)
          if (step.k === 'hop') by -= Math.sin(p * Math.PI) * 4.5 * s.u
          if (step.k === 'peck') tilt = Math.sin(p * Math.PI) * 0.85
          if (step.k === 'chirp') {
            by -= Math.abs(Math.sin(p * Math.PI * 2)) * 1.2 * s.u
            tilt = -0.2 * Math.sin(p * Math.PI)
          }
          if (step.k === 'wait') tilt = Math.sin(t * 9) > 0.9 ? -0.12 : 0
        }
        ctx.globalAlpha = fade
        at(ctx, bx, by, s.u * 1.15, face, () => {
          ctx.rotate(tilt)
          drawBird(ctx, t * 26, flying)
          if (berry) fillCirc(ctx, 10.2, -7.4, 1.5, C.red)
        })
        ctx.globalAlpha = 1
      },
    })
  },
}

export const WINTER_ACTS: ActDef[] = [snowShovel, snowBlower, snowman, sledgeRun, penguins, robin]

// ═════════════════════════════════════════════════════════════════════════════
// Skiing
// ═════════════════════════════════════════════════════════════════════════════

const SKI_TOPS = ['#ef4444', '#22d3ee', '#fde047', '#a78bfa', '#4ade80', '#fb923c']

function skierLook(rng: () => number, base: Look = CAST.dad): Look {
  const top = pick(rng, SKI_TOPS)
  return {
    ...base,
    top,
    bottom: '#334155',
    shoe: '#1f2937',
    beard: undefined,
    hat: 'helmet',
    hatColor: pick(rng, [C.white, C.yellow, C.mint, C.pink]),
    hatTrim: top,
    goggles: pick(rng, [C.orange, C.cyan, C.purple]),
    gloves: '#1f2937',
  }
}

// ─── Slalom ──────────────────────────────────────────────────────────────────
// A proper racer: helmet, goggles, tuck. Four gates pop out of the snow and he
// carves round them throwing up a sheet of spray at every turn. The last gate
// is the one that decides how the run is remembered.

function drawGate(ctx: Ctx, color: string, up: number, flat: number, wave: number) {
  ctx.save()
  ctx.rotate(flat * 1.45)
  const h = 20 * up
  line(ctx, 0, 0, 0, -h, 1.3, '#e2e8f0')
  if (up > 0.4) {
    const f = Math.sin(wave) * 1.2
    fillPoly(ctx, [0.5, -h, 10, -h + 3 + f, 0.5, -h + 7], color)
    fillPoly(ctx, [0.5, -h + 3.5, 10, -h + 3 + f, 0.5, -h + 7], shade(color, -0.2))
  }
  ctx.restore()
  if (up > 0.02) fillEll(ctx, 0, -0.4, 3, 1.1, '#e6f1fb')
}

const slalom: ActDef = {
  id: 'skiing.slalom',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const u = stage.u
    const N = 4
    const gap = Math.min(72 * u, (stage.w * 0.78) / N)
    const first = stage.w / 2 - dir * gap * (N - 1) * 0.5
    const gates = Array.from({ length: N }, (_, i) => first + dir * gap * i)
    const speed = Math.max(150 * u, stage.w / 7.5)
    const gag = rng() < 0.45 ? 'wipeout' : 'cheer'
    const look = skierLook(rng, chance(rng, 0.5) ? CAST.dad : CAST.mum)
    const skiColor = pick(rng, [C.cyan, C.yellow, C.rose, C.green])
    const lastGate = gates[N - 1]
    let x = from
    let passed = 0
    let state: 'ski' | 'tumble' | 'ball' = 'ski'
    let pt = 0
    let rot = 0
    let cheered = false
    const RISE = 0.9
    return makeAct({
      update(s, dt, t) {
        if (t < RISE) return true // gates first, then the racer
        pt += dt
        const v = state === 'ball' ? speed * 0.72 : state === 'tumble' ? speed * 0.85 : speed
        x += dir * v * dt
        if (state === 'ski') {
          while (passed < N && past(x, gates[passed], dir)) {
            // Edge in: a sheet of snow off the outside ski.
            puff(s, x - dir * 4 * s.u, s.ground - 2 * s.u, 9, -dir * 60, -55, 90)
            passed++
            if (passed === N && gag === 'wipeout') {
              state = 'tumble'
              pt = 0
              puff(s, x, s.ground - 8 * s.u, 14, dir * 30, -70, 160, true)
            }
          }
          if (x > 0 && x < s.w && Math.floor(t * 18) !== Math.floor((t - dt) * 18)) {
            puff(s, x - dir * 12 * s.u, s.ground - 1.5 * s.u, 1, -dir * 50, -25, 30)
          }
          if (gag === 'cheer' && !cheered && past(x, lastGate + dir * 34 * s.u, dir)) {
            cheered = true
            burst(s, 'star', x, s.ground - 62 * s.u, 7, [C.yellow, C.white, C.gold], 70, [3, 5])
          }
        } else {
          rot += (v / s.u / 13) * dt
          if (state === 'tumble' && pt > 0.5) {
            state = 'ball'
            pt = 0
          }
          if (x > 0 && x < s.w && Math.floor(t * 10) !== Math.floor((t - dt) * 10)) {
            puff(s, x - dir * 8 * s.u, s.ground - 2 * s.u, 1, -dir * 30, -30, 40)
          }
        }
        // Stay until the last gate has ducked away or faded, too.
        return !(past(x - dir * 30 * s.u, to, dir) && past(x, lastGate + dir * 215 * s.u, dir))
      },
      draw(s, t) {
        const { ctx } = s
        const rel = (dir * (x - first)) / gap // gates passed, fractional
        const between = rel > -0.5 && rel < N - 0.5 && state === 'ski'
        const carve = between ? Math.sin(rel * Math.PI) : 0
        const edge = between ? Math.abs(Math.cos(rel * Math.PI)) : 0
        const gate = (i: number) => {
          const up = easeBack(seg(t, i * 0.12, 0.45 + i * 0.12))
          // Each gate ducks back into the snow once the racer is clear of it.
          const clear = (dir * (x - gates[i])) / s.u
          const hit = i === N - 1 && gag === 'wipeout'
          const down = hit ? 0 : easeIn(seg(clear, 70, 110))
          const flat = hit ? easeOut(seg(clear, 0, 16)) : 0
          const fadeHit = hit ? 1 - seg(clear, 150, 210) : 1
          if (fadeHit <= 0) return
          ctx.globalAlpha = fadeHit
          at(ctx, gates[i], s.ground, s.u, dir, () => drawGate(ctx, i % 2 === 0 ? C.red : C.blue, up * (1 - down), flat, t * 6 + i))
          ctx.globalAlpha = 1
        }
        // He passes in front of the even gates and behind the odd ones.
        for (let i = 0; i < N; i += 2) gate(i)
        if (state === 'ski') {
          const done = cheered
          at(ctx, x, s.ground + carve * 2.2 * s.u, s.u, dir, () => {
            groundShadow(ctx, 0, 14)
            if (!done) speedLines(ctx, -16, -26, 15, t)
            const pose = {
              crouch: done ? 0.08 : 0.5 + edge * 0.25,
              lean: done ? -0.1 : 0.32 + edge * 0.08,
              armF: done ? 2.85 : 0.9 + carve * 0.55,
              elbowF: done ? 0.1 : 0.7,
              armB: done ? 2.5 : 0.3 - carve * 0.55,
              elbowB: done ? 0.1 : 0.9,
              headTilt: done ? -0.15 : carve * 0.12,
              mouth: done ? ('grin' as const) : ('flat' as const),
            }
            const anchors = drawPerson(ctx, look, pose, (a) => {
              drawSki(ctx, a.footB.x, 0, shade(skiColor, -0.25), -carve * 0.05)
              drawPole(ctx, a.handB.x, a.handB.y, done ? Math.PI - 0.25 : -1.0 + carve * 0.3)
            })
            drawSki(ctx, anchors.footF.x, 0, skiColor, carve * 0.05)
            drawPole(ctx, anchors.handF.x, anchors.handF.y, done ? Math.PI + 0.2 : -0.9 - carve * 0.3)
            fillCirc(ctx, anchors.handF.x, anchors.handF.y, 2.5, '#1f2937')
          })
        } else {
          // Somewhere inside that snowball is a racer.
          const grow = state === 'tumble' ? clamp(pt / 0.5) : 1
          const r = lerp(8, 15, grow) + (state === 'ball' ? Math.min(3, pt * 0.8) : 0)
          const bounceY = state === 'tumble' ? Math.sin(grow * Math.PI) * 10 : Math.abs(Math.sin(pt * 6)) * 2.5 * clamp(1 - pt / 2)
          at(ctx, x, s.ground - bounceY * s.u, s.u, dir, () => {
            groundShadow(ctx, 0, r)
            ctx.save()
            ctx.translate(0, -r)
            ctx.rotate(rot)
            // Skis, a pole and one glove poke out and go round with it.
            line(ctx, -r * 0.2, 0, r + 12, -3, 1.9, skiColor)
            line(ctx, r + 12, -3, r + 14.5, -5.5, 1.9, skiColor)
            line(ctx, r * 0.1, r * 0.2, -r - 10, r * 0.75, 1.9, shade(skiColor, -0.25))
            line(ctx, 0, 0, -3, -r - 11, 1.1, '#cbd5e1')
            fillEll(ctx, -2.3, -r - 8, 2.4, 1, C.orange, 0.2)
            line(ctx, 0, 0, r * 0.5, r + 4, 2.6, look.top)
            fillCirc(ctx, r * 0.5, r + 4.5, 2.4, '#1f2937')
            drawSnowball(ctx, 0, 0, r, 0)
            // The helmet and goggles, looking out of the side.
            ctx.beginPath()
            ctx.arc(-r * 0.55, -r * 0.5, 6, Math.PI * 0.75, Math.PI * 1.85)
            ctx.closePath()
            ctx.fillStyle = look.hatColor ?? C.white
            ctx.fill()
            fillRR(ctx, -r * 0.55 - 5.2, -r * 0.5 - 1.5, 6.5, 3.4, 1.4, look.goggles ?? C.orange)
            ctx.restore()
          })
        }
        for (let i = 1; i < N; i += 2) gate(i)
      },
    })
  },
}

// ─── The beginner ────────────────────────────────────────────────────────────
// First day on skis: snowplough, knees together, arms going like a windmill,
// covering about a yard a minute. Then something very small and very fast goes
// past at knee height.

const beginner: ActDef = {
  id: 'skiing.beginner',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const u = stage.u
    const edge = dir === 1 ? 0 : stage.w
    const stopAt = edge + dir * Math.min(stage.w * 0.42, 170 * u)
    const gag = rng() < 0.5 ? 'backwards' : 'runaway'
    const twins = chance(rng, 0.45)
    const look: Look = {
      ...(chance(rng, 0.5) ? CAST.dad : CAST.mum),
      top: pick(rng, ['#f97316', '#e0607e', '#22d3ee']),
      hat: 'bobble',
      hatColor: C.yellow,
      hatTrim: C.red,
      scarf: C.green,
      gloves: C.red,
      goggles: C.cyan,
    }
    const kidLooks: Look[] = [
      { ...CAST.kid, hat: 'helmet', hatColor: C.red, hatTrim: C.white, goggles: C.yellow, top: C.green },
      { ...CAST.girl, hat: 'helmet', hatColor: C.pink, hatTrim: C.white, goggles: C.cyan, top: C.yellow },
    ]
    const kidSpeed = Math.max(300 * u, stage.w / 3.2)
    let x = from
    let v = 26 * u
    let kidsOut = false
    const kx = [from - dir * 30 * u, from - dir * 130 * u]
    let sprayed = false
    let pt = 0 // since being sprayed
    let hatX = 0
    return makeAct({
      update(s, dt, t) {
        if (!kidsOut && past(x, stopAt - dir * 55 * s.u, dir)) kidsOut = true
        if (kidsOut) {
          for (let i = 0; i < (twins ? 2 : 1); i++) {
            kx[i] += dir * kidSpeed * dt
            if (kx[i] > 0 && kx[i] < s.w && Math.floor(t * 24) !== Math.floor((t - dt) * 24)) {
              puff(s, kx[i] - dir * 9 * s.u, s.ground - 1.5 * s.u, 1, -dir * 60, -40, 50)
            }
          }
        }
        if (!sprayed) {
          x += dir * v * dt
          if (kidsOut && past(kx[0], x, dir)) {
            sprayed = true
            hatX = x
            puff(s, x - dir * 4 * s.u, s.ground - 20 * s.u, 16, dir * 60, -60, 170, true)
          }
        } else {
          pt += dt
          if (gag === 'backwards') {
            // Spun right round, and now gravity has taken over in reverse.
            v = pt < 0.7 ? lerp(26, 0, pt / 0.7) * s.u : -Math.min(95, (pt - 0.7) * 70) * s.u
          } else {
            // Skis together by accident. That is the fast position.
            v = Math.min(Math.max(270 * s.u, s.w / 4), v + 190 * s.u * dt)
          }
          x += dir * v * dt
        }
        const lastKid = kx[twins ? 1 : 0]
        const kidsGone = kidsOut && past(lastKid - dir * 40 * s.u, to, dir)
        const gone = gag === 'backwards' ? sprayed && past(x + dir * 40 * s.u, from, -dir as Dir) && pt > 1 : past(x - dir * 40 * s.u, to, dir)
        return !(kidsGone && gone)
      },
      draw(s, t) {
        const { ctx } = s
        const panic = sprayed
        const back = sprayed && gag === 'backwards'
        const fast = sprayed && gag === 'runaway'
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 14)
          if (fast && pt > 0.5) speedLines(ctx, -16, -30, 16, t)
          const flail = panic ? t * 15 : 0
          const wob = Math.sin(t * 6.5)
          const a = drawPerson(
            ctx,
            { ...look, hat: fast && pt > 0.4 ? 'none' : 'bobble' },
            {
              crouch: fast ? 0.35 : 0.6 + wob * 0.06,
              lean: fast ? -0.38 : back ? 0.28 + Math.sin(t * 9) * 0.12 : 0.16 + wob * 0.09,
              armF: panic ? 1.6 + Math.sin(flail) * 1.3 : 1.5 + wob * 0.5,
              elbowF: 0.2,
              armB: panic ? -1.4 + Math.cos(flail) * 1.3 : -1.1 - Math.sin(t * 5.2) * 0.5,
              elbowB: 0.2,
              headTilt: fast ? -0.2 : wob * 0.1,
              mouth: panic ? 'o' : 'flat',
              eyes: panic ? 'wide' : 'normal',
              blink: blinking(s.time, 7),
            },
            (b) => {
              // Far ski and pole. In a snowplough the tips point at each other.
              drawSki(ctx, b.footB.x + (fast ? 0 : 2), 0, shade(C.rose, -0.25), fast ? 0 : 0.07)
              drawPole(ctx, b.handB.x, b.handB.y, panic ? -2 + Math.cos(flail) : -0.6 + wob * 0.4, 23)
            },
          )
          drawSki(ctx, a.footF.x - (fast ? 0 : 2), 0, C.rose, fast ? 0 : -0.07)
          drawPole(ctx, a.handF.x, a.handF.y, panic ? 2 + Math.sin(flail) : 0.5 + wob * 0.4, 23)
          fillCirc(ctx, a.handF.x, a.handF.y, 2.5, C.red)
          if (sprayed && !fast) {
            // Wearing most of what the child threw up.
            fillEll(ctx, a.crown.x - 1, a.crown.y - 4, 6.5, 2.6, '#f4f8fc')
            fillEll(ctx, a.shoulder.x - 3, a.shoulder.y - 2, 4, 2, '#f4f8fc')
          }
          if (!sprayed && x !== from) sweat(ctx, a.head.x - 4, a.head.y - 8, t)
          if (sprayed && pt < 1) bubble(ctx, a.head.x, a.head.y - 22, '!', { size: 10 })
        })
        if (fast && pt > 0.4 && pt < 2.2) {
          // The bobble hat stays where it was.
          const p = clamp((pt - 0.4) / 0.7)
          ctx.globalAlpha = clamp((2.2 - pt) / 0.5)
          at(ctx, hatX + dir * 30 * s.u, s.ground - lerp(58, 3, easeIn(p)) * s.u, s.u, dir, () => {
            ctx.rotate(p * 2.2)
            ctx.beginPath()
            ctx.arc(0, 0, 8, Math.PI, TAU)
            ctx.closePath()
            ctx.fillStyle = C.yellow
            ctx.fill()
            fillRR(ctx, -8.5, -1.5, 17, 3, 1.5, C.red)
            fillCirc(ctx, 0, -9.5, 3, C.red)
          })
          ctx.globalAlpha = 1
        }
        if (kidsOut) {
          for (let i = 0; i < (twins ? 2 : 1); i++) {
            const sc = i === 0 ? 0.6 : 0.5
            at(ctx, kx[i], s.ground, s.u * sc, dir, () => {
              groundShadow(ctx, 0, 13)
              speedLines(ctx, -18, -22, 22, t + i * 0.4)
              const a = drawPerson(
                ctx,
                kidLooks[i],
                { crouch: 1, lean: 0.55, armF: -0.9, elbowF: 0.3, armB: -1.1, elbowB: 0.3, mouth: 'grin' },
                (b) => drawSki(ctx, b.footB.x, 0, shade(C.yellow, -0.25)),
              )
              drawSki(ctx, a.footF.x, 0, C.yellow)
            })
          }
        }
      },
    })
  },
}

// ─── The chairlift ───────────────────────────────────────────────────────────
// A cable appears across the sky and one chair trundles along it with two
// passengers and their dangling skis. Things get dropped from chairlifts.

function drawChairBack(ctx: Ctx) {
  // Grip on the cable, the bent hanger arm, the backrest.
  fillRR(ctx, -4, -47.5, 8, 4, 1.5, '#475569')
  fillCirc(ctx, -2, -47, 1.4, '#94a3b8')
  fillCirc(ctx, 2, -47, 1.4, '#94a3b8')
  poly(ctx, [0, -44, 0, -34, -11, -28, -11, -1], 1.8, '#94a3b8')
  for (let i = 0; i < 3; i++) line(ctx, -11, -6 - i * 4.5, -9.4, -6 - i * 4.5, 2.4, '#64748b')
}

function drawChairFront(ctx: Ctx) {
  // Bench, the safety bar, and the footrest hanging off it.
  fillRR(ctx, -12, -1.4, 22, 3, 1.4, '#64748b')
  fillRR(ctx, -12, -1.4, 22, 1.1, 0.5, '#94a3b8')
  poly(ctx, [-10, -22, 8, -13, 12, -11], 1.3, '#cbd5e1')
  poly(ctx, [12, -11, 13, 12, 18, 12.5], 1.2, '#94a3b8')
}

const chairlift: ActDef = {
  id: 'skiing.chairlift',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const speed = Math.max(55 * stage.u, stage.w / 15)
    const dropKind = pick(rng, ['glove', 'pole', 'none'] as const)
    const boarder = chance(rng, 0.4)
    const dropAt = stage.w * range(rng, 0.35, 0.6)
    const near = skierLook(rng, CAST.mum)
    const far = boarder
      ? { ...CAST.kid, top: C.purple, bottom: '#57534e', hat: 'bobble' as const, hatColor: C.orange, hatTrim: C.white, goggles: C.green, gloves: '#1f2937' }
      : skierLook(rng, CAST.dad)
    const CABLE = 150 // units above the floor
    const RS = 0.72 // rider scale
    let x = from
    let fadeOut = 0
    let dropped = false
    let dt0 = 0 // time since the drop
    let ix = 0
    let iy = 0
    let ivy = 0
    let irot = 0
    let landed = -1 // time since it hit the floor
    let floorY = 0
    return makeAct({
      update(s, dt) {
        x += dir * speed * dt
        const travelled = dir === 1 ? x : s.w - x
        if (dropKind !== 'none' && !dropped && travelled > dropAt) {
          dropped = true
          ix = x + dir * 9 * s.u
          iy = s.ground - (CABLE - 34) * s.u
          ivy = -30 * s.u
          floorY = s.ground - s.particles.heightAt(ix) * 0.5
        }
        if (dropped) {
          dt0 += dt
          if (landed < 0) {
            ivy += 300 * s.u * dt
            iy += ivy * dt
            ix += dir * speed * 0.5 * Math.max(0, 1 - dt0) * dt
            irot += dt * (dropKind === 'glove' ? 7 : 2.2)
            if (iy >= floorY) {
              iy = floorY
              landed = 0
              puff(s, ix, floorY - 2 * s.u, 8, 0, -40, 100)
            }
          } else landed += dt
        }
        const itemDone = dropKind === 'none' || landed > 3.2
        if (past(x - dir * 30 * s.u, to, dir) && itemDone) {
          fadeOut += dt
          if (fadeOut > 0.7) return false
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const cy = s.ground - CABLE * s.u
        const show = clamp(t / 0.7) * (1 - clamp(fadeOut / 0.7))
        // The cable, sagging a touch under the chair.
        ctx.globalAlpha = show * 0.75
        poly(ctx, [0, cy - 1.5 * s.u, clamp(x, 0, s.w), cy + 2 * s.u, s.w, cy - 1.5 * s.u], 1, '#94a3b8')
        ctx.globalAlpha = 1
        const swing = Math.sin(t * 1.7) * 0.05
        const looking = dropped && dt0 < 2.6
        at(
          ctx,
          x,
          cy + 2 * s.u,
          s.u,
          dir,
          () => {
            ctx.translate(0, 47)
            drawChairBack(ctx)
            const rider = (lk: Look, dx: number, isNear: boolean) => {
              ctx.save()
              ctx.translate(dx, 0)
              ctx.scale(RS, RS)
              ctx.translate(0, 20)
              const oops = looking && isNear
              const a = drawPerson(ctx, lk, {
                walk: t * 2.4 + (isNear ? 0 : 1.7),
                stride: 0.3,
                armF: oops ? 0.5 : 0.9,
                elbowF: oops ? 0.1 : 1.1,
                armB: 0.8,
                elbowB: 1.2,
                lean: oops ? 0.4 : 0.04,
                headTilt: oops ? 0.35 : looking ? 0.15 : Math.sin(t * 0.9 + dx) * 0.06,
                mouth: oops ? 'o' : looking ? 'grin' : 'smile',
                eyes: oops ? 'wide' : 'normal',
                blink: blinking(s.time, isNear ? 8 : 9),
              })
              const kick = Math.sin(t * 2.4 + (isNear ? 0 : 1.7)) * 0.12
              if (!isNear && boarder) {
                // One foot strapped in, the board hanging off it at an angle.
                ctx.save()
                ctx.translate(a.footF.x, a.footF.y)
                ctx.rotate(0.35 + kick)
                fillRR(ctx, -13, -0.4, 27, 3, 1.5, C.green)
                fillRR(ctx, -13, -0.4, 27, 1.1, 0.5, shade(C.green, 0.3))
                fillRR(ctx, -3, -1.6, 6, 1.8, 0.6, '#1f2937')
                ctx.restore()
              } else {
                const col = isNear ? C.rose : C.cyan
                drawSki(ctx, a.footB.x, a.footB.y, shade(col, -0.25), -0.1 - kick, 1.15)
                drawSki(ctx, a.footF.x, a.footF.y, col, -0.06 + kick, 1.15)
              }
              // The near rider keeps hold of whatever has not been dropped yet.
              if (isNear && dropKind === 'pole' && !dropped) drawPole(ctx, a.handF.x, a.handF.y, 0.9, 24)
              if (isNear && dropKind === 'glove' && dropped) fillCirc(ctx, a.handF.x, a.handF.y, 2.6, lk.skin)
              ctx.restore()
            }
            // Side on, the far seat sits up the cable a little: enough that
            // the two riders read as two people, not one with four arms.
            ctx.save()
            ctx.translate(-3, -3)
            rider(far, -8, false)
            ctx.restore()
            rider(near, 6, true)
            drawChairFront(ctx)
          },
          swing * dir,
        )
        if (dropped) {
          const fade = landed < 0 ? 1 : clamp((3.2 - landed) / 0.6)
          ctx.globalAlpha = fade
          if (dropKind === 'glove') {
            at(ctx, ix, iy, s.u, dir, () => {
              ctx.rotate(landed < 0 ? irot : 0.3)
              // A fat mitten with a thumb and a striped cuff.
              fillRR(ctx, -3.2, -6.5, 6.4, 7, 3, '#1f2937')
              fillEll(ctx, 3.2, -3, 1.6, 2.6, '#1f2937', 0.5)
              fillRR(ctx, -3.2, -1.4, 6.4, 2.6, 1, near.top)
            })
          } else {
            // The pole comes down point first, sticks, and quivers.
            const quiver = landed < 0 ? 0 : Math.sin(landed * 30) * 0.35 * Math.exp(-landed * 3)
            at(ctx, ix, iy + (landed < 0 ? 0 : 3 * s.u), s.u, dir, () => {
              ctx.rotate(landed < 0 ? Math.sin(irot) * 0.3 : 0.18 + quiver)
              line(ctx, 0, 0, 0, -26, 1.1, '#cbd5e1')
              fillEll(ctx, 0, -4.5, 2.6, 1, C.orange)
              line(ctx, 0, -26, 0, -21, 2, '#1f2937')
              line(ctx, 0, -26, 2.5, -23, 0.7, '#1f2937')
            })
          }
          ctx.globalAlpha = 1
          if (looking && dt0 > 0.3) at(ctx, x, cy + 2 * s.u, s.u, 1, () => bubble(ctx, dir * 4, 4, '!', { size: 10 }))
        }
      },
    })
  },
}

export const SKIING_ACTS: ActDef[] = [slalom, beginner, chairlift]
