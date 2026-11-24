import { DOG, drawDog } from '../creatures'
import { C, TAU, alpha, at, clamp, easeBack, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, line, poly, seg, shade } from '../draw'
import { banner, blinking, bubble, burst, crossing, makeAct } from '../kit'
import { CAST, drawPerson, type Look } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, AmbientDef, SceneContext, Stage } from '../types'

export const PARTY_COLORS = ['#f472b6', '#facc15', '#22d3ee', '#a78bfa', '#4ade80', '#fb923c', '#f87171']

export const BIRTHDAY_AMBIENT: AmbientDef = {
  kind: 'confetti',
  colors: PARTY_COLORS,
  rate: 3,
  flurry: [14, 16],
  settle: true,
  pile: 'items',
  maxPile: 9,
  size: [3.5, 5.5],
}

/** "Ada", "Ada & Ben", "Ada, Ben & Cleo". */
function nameList(c: SceneContext): string {
  const n = c.birthdayNames
  if (n.length === 0) return ''
  if (n.length === 1) return n[0]
  return `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`
}

function greeting(c: SceneContext): string {
  const who = nameList(c)
  return who ? `Happy Birthday ${who}!` : 'Happy Birthday!'
}

const partyLook = (base: Look, i: number): Look => ({
  ...base,
  hat: 'party',
  hatColor: PARTY_COLORS[i % PARTY_COLORS.length],
  hatTrim: PARTY_COLORS[(i + 3) % PARTY_COLORS.length],
})

function balloon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, sway: number, stringTo?: { x: number; y: number }) {
  if (stringTo) {
    ctx.beginPath()
    ctx.moveTo(x, y + r * 1.25)
    ctx.quadraticCurveTo(x + sway * 6, (y + stringTo.y) / 2, stringTo.x, stringTo.y)
    ctx.lineWidth = 0.7
    ctx.strokeStyle = alpha(C.white, 0.7)
    ctx.stroke()
  }
  fillEll(ctx, x, y, r, r * 1.2, color)
  fillPoly(ctx, [x - 1.6, y + r * 1.15, x + 1.6, y + r * 1.15, x, y + r * 1.15 + 3], shade(color, -0.2))
  fillEll(ctx, x - r * 0.35, y - r * 0.45, r * 0.22, r * 0.36, alpha(C.white, 0.6), -0.5)
}

// ─── The banner plane ────────────────────────────────────────────────────────
// A little propeller plane tows the birthday message across, low over the
// floor. One time in three the pilot is the dog.

const bannerPlane: ActDef = {
  id: 'birthday.banner-plane',
  weight: 3,
  create(stage, rng) {
    const text = greeting(stage.context)
    const dogPilot = chance(rng, 0.33)
    const loop = chance(rng, 0.4)
    // The banner trails behind, so the plane has to fly on past the far edge.
    const tail = (text.length * 6.6 + 110) * stage.u
    let x = -70 * stage.u
    const speed = 72 * stage.u
    const loopAt = stage.w * 0.5
    let looped = 0 // 0..1 through the loop
    return makeAct({
      update(s, dt, t) {
        if (loop && looped < 1 && x > loopAt) looped = Math.min(1, looped + dt / 1.6)
        else x += speed * dt
        if (Math.floor(t * 5) !== Math.floor((t - dt) * 5) && x > 0 && x < s.w) {
          s.particles.emit({
            kind: 'confetti',
            x: x - 60 * s.u,
            y: s.ground - 120 * s.u,
            size: range(rng, 3.5, 5.5) * s.u,
            color: pick(rng, PARTY_COLORS),
            settle: true,
          })
        }
        return x - tail < s.w
      },
      draw(s, t) {
        const { ctx } = s
        const baseY = s.ground - (118 + Math.sin(t * 1.3) * 7) * s.u
        const a = looped > 0 && looped < 1 ? easeInOut(looped) * TAU : 0
        const R = 26 * s.u
        const px = x + Math.sin(a) * R
        const py = baseY - (1 - Math.cos(a)) * R
        // Tow rope and banner hang back from the tail and ignore the loop.
        ctx.save()
        ctx.translate(x - 44 * s.u, baseY + 3 * s.u)
        ctx.scale(s.u, s.u)
        line(ctx, 0, 0, 30, -3, 0.8, alpha(C.white, 0.7))
        const w = banner(ctx, -6 - text.length * 3.1, 0, text, { bg: '#be185d', wave: t * 4, size: 11 })
        line(ctx, -6 - text.length * 3.1 + w / 2, 0, 2, 0, 0.8, alpha(C.white, 0.7))
        ctx.restore()
        at(ctx, px, py, s.u, 1, () => {
          // Fuselage.
          fillPoly(ctx, [-26, -3, -30, -14, -22, -14, -14, -5], '#fbbf24')
          fillEll(ctx, 0, 0, 24, 8.5, '#f59e0b')
          fillEll(ctx, 2, 3, 20, 4, shade('#f59e0b', -0.15))
          fillRR(ctx, -12, -1.5, 26, 3.6, 1.8, '#fde68a')
          // Cockpit and pilot.
          ctx.beginPath()
          ctx.arc(2, -6, 8, Math.PI, TAU)
          ctx.closePath()
          ctx.fillStyle = alpha(C.sky, 0.45)
          ctx.fill()
          if (dogPilot) {
            fillCirc(ctx, 2, -8, 4.6, DOG.coat)
            fillRR(ctx, 4, -9, 6, 4, 2, DOG.patch ?? C.cream)
            fillCirc(ctx, 10, -7.6, 1.1, C.ink)
            fillEll(ctx, -1.5, -7, 2, 4, shade(DOG.coat, -0.25), 0.4 + Math.sin(t * 16) * 0.3)
            fillRR(ctx, 0.5, -10.4, 5, 2.8, 1.2, '#7c2d12')
          } else {
            fillCirc(ctx, 2, -8, 4.6, C.skinA)
            fillRR(ctx, -2.8, -13.4, 9.6, 5, 2.4, '#7c2d12')
            fillRR(ctx, 2, -9.6, 5.4, 3, 1.4, alpha(C.sky, 0.9))
            line(ctx, -3, -6, -12 - Math.sin(t * 9) * 2, -3 + Math.cos(t * 9) * 2, 2, C.red)
          }
          // Wing, wheel, propeller.
          fillRR(ctx, -8, 1, 20, 4, 2, '#fde68a')
          line(ctx, 2, 6, 4, 12, 1.4, '#475569')
          fillCirc(ctx, 4, 13, 3, '#1f2937')
          fillEll(ctx, 25, 0, 2.4, 3.2, '#b91c1c')
          ctx.globalAlpha = 0.55
          fillEll(ctx, 27, 0, 1.6, 11, C.white)
          ctx.globalAlpha = 1
          line(ctx, 27, -11 * Math.abs(Math.cos(t * 30)), 27, 11 * Math.abs(Math.cos(t * 30)), 1.6, '#cbd5e1')
        }, -a)
      },
    })
  },
}

// ─── The cake ────────────────────────────────────────────────────────────────
// Carried in with enormous care, set down, candles blown out in one go.
// Sometimes the dog gets to the icing first.

function drawCake(ctx: CanvasRenderingContext2D, t: number, lit: boolean, candles: number, licked: boolean) {
  fillRR(ctx, -17, -4, 34, 4, 2, '#e2e8f0')
  fillRR(ctx, -14, -17, 28, 13, 3, '#f9a8d4')
  fillRR(ctx, -14, -11, 28, 3, 0, '#fde68a')
  // Icing drips.
  fillRR(ctx, -14, -19, 28, 5, 2.5, C.white)
  for (let i = 0; i < 5; i++) fillEll(ctx, -11 + i * 5.6, -14.2, 2, 2.6 + (i % 2) * 1.4, C.white)
  if (licked) fillEll(ctx, 9, -17, 5, 3.4, '#f9a8d4')
  for (let i = 0; i < 6; i++) fillCirc(ctx, -11 + i * 4.4, -7, 1, PARTY_COLORS[i % PARTY_COLORS.length])
  for (let i = 0; i < candles; i++) {
    const cx = -((candles - 1) * 4.4) / 2 + i * 4.4
    fillRR(ctx, cx - 0.9, -27, 1.8, 8, 0.6, PARTY_COLORS[(i * 2) % PARTY_COLORS.length])
    if (lit) {
      const f = 1 + Math.sin(t * 13 + i * 2.1) * 0.18
      fillEll(ctx, cx, -30 * 1, 1.7, 3 * f, '#fb923c')
      fillEll(ctx, cx, -29.4, 0.9, 1.7 * f, '#fef08a')
    } else {
      ctx.globalAlpha = 0.5
      line(ctx, cx, -28, cx + Math.sin(t * 3 + i) * 1.5, -32, 0.8, '#cbd5e1')
      ctx.globalAlpha = 1
    }
  }
}

const cake: ActDef = {
  id: 'birthday.cake',
  weight: 3,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 50)
    const mid = stage.w * 0.5
    const dogLicks = chance(rng, 0.4)
    const candles = 3 + Math.floor(rng() * 4)
    const baker: Look = { ...CAST.mum, hat: 'chef', apron: C.white }
    const kid = partyLook(chance(rng, 0.5) ? CAST.kid : CAST.girl, 1)
    let x = from
    let walk = 0
    let phase: 'carry' | 'set' | 'blow' | 'cheer' | 'leave' = 'carry'
    let pt = 0
    let kidX = from - dir * 46 * stage.u
    let dogX = from - dir * 120 * stage.u
    let lit = true
    let licked = false
    return makeAct({
      update(s, dt) {
        pt += dt
        const speed = 40 * s.u
        if (phase === 'carry') {
          x += dir * speed * dt
          kidX += dir * speed * dt
          dogX += dir * speed * dt
          walk += dt * 6.5
          if ((dir === 1 && x >= mid - 20 * s.u) || (dir === -1 && x <= mid + 20 * s.u)) {
            phase = 'set'
            pt = 0
          }
        } else if (phase === 'set') {
          const kidGoal = x + dir * 52 * s.u
          kidX += clamp((kidGoal - kidX) * 3 * dt, -80 * s.u * dt, 80 * s.u * dt)
          if (dogLicks) dogX += (x + dir * 6 * s.u - dir * 30 * s.u - dogX) * 2 * dt
          if (dogLicks && pt > 1.4) licked = true
          if (pt > 2.4) {
            phase = 'blow'
            pt = 0
          }
        } else if (phase === 'blow') {
          if (pt > 0.9 && lit) {
            lit = false
            burst(s, 'confetti', x + dir * 26 * s.u, s.ground - 34 * s.u, 28, PARTY_COLORS, 150, [3.5, 5.5])
            burst(s, 'star', x + dir * 26 * s.u, s.ground - 34 * s.u, 8, ['#fde047', '#ffffff'], 90, [3, 5])
          }
          if (pt > 1.2) {
            phase = 'cheer'
            pt = 0
          }
        } else if (phase === 'cheer') {
          if (pt > 2.6) {
            phase = 'leave'
            pt = 0
          }
        } else {
          x += dir * 50 * s.u * dt
          kidX += dir * 50 * s.u * dt
          dogX += dir * 54 * s.u * dt
          walk += dt * 8
          const lastX = Math.min(x * dir, kidX * dir, dogX * dir) * dir
          return dir === 1 ? lastX < s.w + 60 * s.u : lastX > -60 * s.u
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const moving = phase === 'carry' || phase === 'leave'
        const down = phase === 'set' ? easeOut(seg(pt, 0, 0.7)) : phase === 'carry' ? 0 : phase === 'leave' ? 1 - easeOut(seg(pt, 0, 0.4)) : 1
        const cheer = phase === 'cheer'
        // The dog, behind everyone.
        at(ctx, dogX, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 13)
          const licking = phase === 'set' && dogLicks && pt > 0.9
          drawDog(ctx, DOG, { run: walk * 1.4, stride: moving ? 0.5 : 0, wag: t * (cheer || licking ? 22 : 9), mouthOpen: licking || cheer, sitting: cheer })
        })
        // The baker and the cake.
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, baker, {
            walk,
            stride: moving ? 0.5 : 0,
            armF: cheer ? 2.7 : 1.25 - down * 0.5,
            armB: cheer ? -2.7 : 1.15 - down * 0.5,
            elbowF: cheer ? -0.2 : 0.5,
            elbowB: cheer ? 0.2 : 0.5,
            lean: down * 0.25 * (cheer ? 0 : 1),
            crouch: down * 0.35 * (cheer ? 0 : 1),
            lift: cheer ? Math.abs(Math.sin(t * 9)) * 3 : 0,
            mouth: cheer ? 'grin' : 'smile',
            blink: blinking(s.time, 2),
          })
          // Cake: in the hands while carried, on a little stand once set down.
          const cx = 26
          const cy = moving || down < 1 ? a.handF.y - 2 + down * 0 : -14
          if (down > 0.99 && !moving) {
            line(ctx, cx, 0, cx, -14, 2.4, '#94a3b8')
            fillEll(ctx, cx, 0, 8, 1.8, '#94a3b8')
          }
          ctx.save()
          ctx.translate(moving || down < 1 ? a.handF.x + 12 : cx, moving || down < 1 ? cy + 4 : -14)
          drawCake(ctx, t, lit, candles, licked)
          ctx.restore()
        })
        // The birthday child, on the far side of the cake.
        at(ctx, kidX, s.ground, s.u * 0.82, (phase === 'carry' || phase === 'leave' ? dir : -dir) as 1 | -1, () => {
          groundShadow(ctx, 0, 10)
          const puff = phase === 'blow' && pt < 0.9
          const a = drawPerson(ctx, kid, {
            walk: walk * 1.2,
            stride: moving ? 0.6 : 0,
            lean: puff ? 0.3 : 0,
            armF: cheer ? 2.8 : undefined,
            armB: cheer ? -2.6 : undefined,
            lift: cheer ? Math.abs(Math.sin(t * 10 + 1)) * 5 : 0,
            mouth: puff ? 'puff' : cheer ? 'grin' : 'o',
            eyes: phase === 'set' ? 'wide' : 'normal',
          })
          if (puff && pt > 0.5) {
            ctx.globalAlpha = 0.6
            for (let i = 0; i < 3; i++) line(ctx, a.mouth.x + 4, a.mouth.y + (i - 1) * 2, a.mouth.x + 14, a.mouth.y + (i - 1) * 4, 1, C.white)
            ctx.globalAlpha = 1
          }
        })
      },
    })
  },
}

// ─── Too many balloons ───────────────────────────────────────────────────────
// A child with a huge bunch of balloons is on tiptoe, then off the floor
// altogether, pedalling the air. A grown-up catches an ankle. Or one balloon
// gets away and pops.

const balloons: ActDef = {
  id: 'birthday.balloons',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const rescue = chance(rng, 0.55)
    const kid = partyLook(chance(rng, 0.5) ? CAST.girl : CAST.kid, 4)
    const n = 7
    const bunch = Array.from({ length: n }, (_, i) => ({
      dx: range(rng, -24, 24),
      dy: -44 - range(rng, 0, 34) - (i % 3) * 7,
      r: range(rng, 9.5, 13),
      color: PARTY_COLORS[i % PARTY_COLORS.length],
      ph: rng() * TAU,
    }))
    let x = from
    let walk = 0
    let lift = 0
    let dadX = from - dir * 90 * stage.u
    let escaped = -1 // seconds since one balloon got away
    return makeAct({
      update(s, dt, t) {
        const frac = dir === 1 ? x / s.w : 1 - x / s.w
        x += dir * 46 * s.u * dt
        walk += dt * 8
        if (rescue) {
          // Rises through the middle of the crossing, hauled back down near the end.
          const target = frac > 0.25 && frac < 0.72 ? 1 : 0
          lift += (target - lift) * dt * 1.6
          dadX += dir * (frac > 0.3 ? 62 : 44) * s.u * dt
          if ((dadX - x) * dir > -24 * s.u) dadX = x - dir * 24 * s.u
        } else {
          lift = Math.max(0, Math.sin(t * 1.7)) * 0.35
          if (escaped < 0 && frac > 0.45) escaped = 0
          if (escaped >= 0) {
            const before = escaped
            escaped += dt
            if (before < 2.2 && escaped >= 2.2) {
              const b = bunch[n - 1]
              burst(s, 'confetti', x + (b.dx + 18) * s.u, s.ground - (64 - b.dy + 60) * s.u, 14, [b.color], 130, [3, 5])
              burst(s, 'star', x + (b.dx + 18) * s.u, s.ground - (64 - b.dy + 60) * s.u, 5, [C.white], 80, [3, 4])
            }
          }
        }
        const lastX = rescue ? dadX : x
        return dir === 1 ? lastX < to : lastX > to
      },
      draw(s, t) {
        const { ctx } = s
        const up = lift * 26
        if (rescue) {
          at(ctx, dadX, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 11)
            const reaching = lift > 0.15
            drawPerson(ctx, partyLook(CAST.dad, 2), {
              walk: walk * 1.1,
              stride: 0.9,
              lean: 0.16,
              armF: reaching ? 2.2 : undefined,
              elbowF: reaching ? 0.1 : undefined,
              mouth: reaching ? 'o' : 'smile',
              eyes: reaching ? 'wide' : 'normal',
            })
          })
        }
        at(ctx, x, s.ground, s.u * 0.82, dir, () => {
          groundShadow(ctx, 0, 10 - lift * 5, 0.28 - lift * 0.14)
          const a = drawPerson(ctx, kid, {
            walk: walk * (1 + lift),
            stride: 0.75,
            armF: 2.9,
            elbowF: 0.1,
            lift: up,
            mouth: lift > 0.4 ? 'o' : 'grin',
            eyes: lift > 0.4 ? 'wide' : 'normal',
            blink: blinking(s.time, 6),
          })
          bunch.forEach((b, i) => {
            const sway = Math.sin(t * 1.6 + b.ph)
            if (!rescue && i === n - 1 && escaped >= 0) {
              if (escaped < 2.2) balloon(ctx, a.handF.x + b.dx + sway * 2 + escaped * 8, a.handF.y + b.dy - escaped * 26, b.r, b.color, sway)
              return
            }
            balloon(ctx, a.handF.x + b.dx + sway * 2, a.handF.y + b.dy + Math.cos(t * 1.3 + b.ph) * 1.5, b.r, b.color, sway, a.handF)
          })
          if (!rescue && escaped > 2.2 && escaped < 3.6) bubble(ctx, a.head.x, a.head.y - 20, '!', { color: C.crimson })
        })
      },
    })
  },
}

// ─── Sweeping up ─────────────────────────────────────────────────────────────
// Someone has to hoover up the confetti. The bag fills as they go. Sometimes
// it holds.

function drawVacuum(ctx: CanvasRenderingContext2D, bag: number, t: number) {
  // Upright vacuum: the head on the floor, a handle, a cloth bag that swells.
  fillRR(ctx, 16, -6, 22, 6, 2.5, '#475569')
  fillRR(ctx, 30, -4.5, 8, 3, 1.5, '#1f2937')
  fillCirc(ctx, 19, -2, 2.4, '#1f2937')
  line(ctx, 22, -6, 9, -34, 3, '#94a3b8')
  const r = 6 + bag * 9
  const wob = bag > 0.75 ? Math.sin(t * 34) * (bag - 0.75) * 5 : 0
  fillEll(ctx, 14 + wob, -19, r * 0.8, r, '#ef4444', 0.42)
  fillEll(ctx, 12 + wob, -22, r * 0.25, r * 0.4, alpha(C.white, 0.35), 0.42)
  fillRR(ctx, 15.5, -8.5, 5, 4, 1, '#334155')
}

const vacuum: ActDef = {
  id: 'birthday.vacuum',
  weight: 1.5,
  clears: true,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const bursts = chance(rng, 0.45)
    const who = partyLook(chance(rng, 0.5) ? CAST.dad : CAST.grandad, 5)
    let x = from
    let walk = 0
    let bag = 0
    let popped = false
    let stun = 0
    return makeAct({
      update(s, dt) {
        if (stun > 0) {
          stun -= dt
          return true
        }
        const before = x
        x += dir * 54 * s.u * dt
        walk += dt * 8.5
        const got = s.particles.sweep(before + dir * 28 * s.u, x + dir * 40 * s.u)
        if (!popped) bag = clamp(bag + got * 0.006 + dt * 0.035)
        const frac = dir === 1 ? x / s.w : 1 - x / s.w
        if (bursts && !popped && frac > 0.72) {
          popped = true
          stun = 2.2
          bag = 0
          for (let i = 0; i < 70; i++) {
            const a = rng() * TAU
            s.particles.emit({
              kind: 'confetti',
              x: x + dir * 14 * s.u,
              y: s.ground - 20 * s.u,
              vx: Math.cos(a) * range(rng, 40, 190) * s.u,
              vy: Math.sin(a) * range(rng, 40, 190) * s.u - 120 * s.u,
              g: 160,
              drag: 0.45,
              size: range(rng, 3.5, 5.5) * s.u,
              color: pick(rng, PARTY_COLORS),
              life: 9,
              settle: true,
            })
          }
          burst(s, 'dust', x + dir * 14 * s.u, s.ground - 20 * s.u, 8, ['#cbd5e1'], 70, [6, 10])
        }
        return dir === 1 ? x < to : x > to
      },
      draw(s, t) {
        const { ctx } = s
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 6, 16)
          const shocked = stun > 0
          const a = drawPerson(ctx, who, {
            walk,
            stride: shocked ? 0 : 0.8,
            armF: 0.95,
            elbowF: 0.6,
            armB: 0.8,
            elbowB: 0.8,
            lean: shocked ? -0.2 : 0.1,
            mouth: shocked ? 'o' : 'flat',
            eyes: shocked ? 'wide' : 'normal',
            blink: blinking(s.time, 4),
          })
          void a
          drawVacuum(ctx, bag, t)
          if (shocked) {
            // The burst bag hangs in tatters.
            poly(ctx, [12, -24, 8, -15, 13, -11], 2, '#ef4444')
            poly(ctx, [16, -24, 20, -16, 16, -12], 2, '#ef4444')
          }
        })
      },
    })
  },
}

// ─── The present ─────────────────────────────────────────────────────────────
// A wrapped box far bigger than whoever is carrying it walks on, apparently by
// itself. It is put down, the lid lifts, and something looks out.

function drawPresent(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, ribbon: string, lidOpen: number) {
  fillRR(ctx, -w / 2, -h, w, h, 2, color)
  fillRR(ctx, -w / 2, -h, w * 0.22, h, 2, shade(color, -0.14))
  fillRR(ctx, -2.6, -h, 5.2, h, 0, ribbon)
  ctx.save()
  ctx.translate(-w / 2 - 1.5, -h)
  ctx.rotate(-lidOpen * 1.15)
  fillRR(ctx, 0, -6, w + 3, 7, 2, shade(color, 0.14))
  fillRR(ctx, w / 2 - 1.2, -6, 5.2, 7, 0, ribbon)
  // Bow.
  fillEll(ctx, w / 2 - 3, -9, 5, 3, ribbon, -0.5)
  fillEll(ctx, w / 2 + 6, -9, 5, 3, ribbon, 0.5)
  fillCirc(ctx, w / 2 + 1.5, -7.5, 2.2, shade(ribbon, -0.2))
  ctx.restore()
}

const present: ActDef = {
  id: 'birthday.present',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const mid = stage.w * range(rng, 0.42, 0.58)
    const inside = chance(rng, 0.5) ? 'dog' : 'balloons'
    const color = pick(rng, ['#22d3ee', '#a78bfa', '#4ade80', '#f472b6'])
    const carrier = partyLook(CAST.kid, 0)
    let x = from
    let walk = 0
    let phase: 'carry' | 'open' | 'leave' = 'carry'
    let pt = 0
    let boxX = 0
    let released = false
    let dogX = 0
    return makeAct({
      update(s: Stage, dt) {
        pt += dt
        if (phase === 'carry') {
          x += dir * 38 * s.u * dt
          walk += dt * 7
          if ((dir === 1 && x >= mid) || (dir === -1 && x <= mid)) {
            phase = 'open'
            pt = 0
            boxX = x + dir * 26 * s.u
            dogX = boxX
          }
        } else if (phase === 'open') {
          if (pt > 1.6 && !released) {
            released = true
            if (inside === 'balloons') {
              for (let i = 0; i < 9; i++) {
                s.particles.emit({
                  kind: 'heart',
                  x: boxX + range(rng, -12, 12) * s.u,
                  y: s.ground - 40 * s.u,
                  vx: range(rng, -30, 30) * s.u,
                  vy: -range(rng, 30, 80) * s.u,
                  size: range(rng, 4, 7) * s.u,
                  color: pick(rng, PARTY_COLORS),
                  life: 3.2,
                })
              }
            }
            burst(s, 'confetti', boxX, s.ground - 44 * s.u, 30, PARTY_COLORS, 160, [3.5, 5.5])
          }
          if (pt > 4.4) {
            phase = 'leave'
            pt = 0
          }
        } else {
          x += dir * 56 * s.u * dt
          dogX += dir * 78 * s.u * dt
          walk += dt * 9
          const lastX = inside === 'dog' ? Math.min(x * dir, dogX * dir) * dir : x
          return dir === 1 ? lastX < to : lastX > to
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const W = 40
        const H = 38
        if (phase === 'carry') {
          at(ctx, x, s.ground, s.u * 0.82, dir, () => {
            groundShadow(ctx, 12, 22)
            // Only the legs show under the box, and two hands round the sides.
            drawPerson(ctx, carrier, { walk, stride: 0.6, armF: 1.5, armB: 1.5, lean: -0.12, mouth: 'flat' })
            ctx.save()
            ctx.translate(20, -16 + Math.abs(Math.sin(walk)) * 1.5)
            ctx.rotate(Math.sin(walk * 0.5) * 0.05)
            drawPresent(ctx, W * 1.2, H * 1.2, color, '#fde047', 0)
            ctx.restore()
          })
          return
        }
        const open = phase === 'open' ? easeBack(seg(pt, 1.2, 1.7)) : 1
        const fade = phase === 'leave' ? 1 - seg(pt, 0.8, 1.6) : 1
        at(ctx, x, s.ground, s.u * 0.82, dir, () => {
          groundShadow(ctx, 0, 10)
          const jumping = phase === 'open' && pt > 1.7
          drawPerson(ctx, carrier, {
            walk,
            stride: phase === 'leave' ? 0.8 : 0,
            armF: jumping ? 2.8 : undefined,
            armB: jumping ? -2.7 : undefined,
            lift: jumping ? Math.abs(Math.sin(t * 9)) * 6 : 0,
            mouth: jumping ? 'grin' : phase === 'open' ? 'o' : 'smile',
            eyes: phase === 'open' && pt < 1.7 && pt > 0.6 ? 'wide' : 'normal',
          })
        })
        if (fade > 0.01) {
          ctx.globalAlpha = fade
          at(ctx, boxX, s.ground, s.u, 1, () => {
            groundShadow(ctx, 0, 22)
            const shake = phase === 'open' && pt > 0.4 && pt < 1.2 ? Math.sin(t * 40) * 1.5 : 0
            ctx.translate(shake, 0)
            if (inside === 'dog' && phase === 'open' && pt > 1.5) {
              // Head and paws over the rim.
              ctx.save()
              ctx.translate(-4, -H + 4 - easeOut(seg(pt, 1.5, 1.9)) * 9)
              fillCirc(ctx, 0, 0, 7, DOG.coat)
              fillRR(ctx, 2, -1.5, 10, 6.4, 3.2, DOG.patch ?? C.cream)
              fillCirc(ctx, 11.6, 0.2, 1.8, C.ink)
              fillCirc(ctx, 3.2, -2.6, 1.5, C.ink)
              fillEll(ctx, -4.4, 1, 3, 6, shade(DOG.coat, -0.22), 0.3)
              fillEll(ctx, 8, 6.4, 2, 2.6 + Math.sin(t * 20) * 0.8, C.rose)
              ctx.restore()
            }
            drawPresent(ctx, W, H, color, '#fde047', open)
          })
          ctx.globalAlpha = 1
        }
        if (inside === 'dog' && phase === 'leave') {
          at(ctx, dogX, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 13)
            drawDog(ctx, DOG, { run: walk * 1.8, stride: 1, wag: t * 22, mouthOpen: true })
          })
        }
      },
    })
  },
}

export const BIRTHDAY_ACTS: ActDef[] = [bannerPlane, cake, balloons, present, vacuum]
