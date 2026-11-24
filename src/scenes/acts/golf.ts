import { DOG, drawBird, drawDog, drawSquirrel } from '../creatures'
import { C, alpha, at, clamp, easeBack, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, type Ctx } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { drawPerson, type Anchors, type Look, type Pose } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Stage } from '../types'

// Golf, as played by people who love it more than it loves them. Every act
// brings its own bit of course with it (a pin, a bunker, a buggy) and takes it
// away again when it leaves.

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface Mover {
  x: number
  walk: number
  dir: 1 | -1
}

/** Walk `m` toward `target` (px) at `speed` units/s. True once it has arrived. */
function stepTo(m: Mover, target: number, speed: number, s: Stage, dt: number): boolean {
  const d = target - m.x
  const step = speed * s.u * dt
  if (Math.abs(d) <= step) {
    m.x = target
    return true
  }
  m.dir = d > 0 ? 1 : -1
  m.x += m.dir * step
  m.walk += dt * (speed / 6.2)
  return false
}

/** x just off whichever edge is nearer to `x`. */
const edge = (x: number, s: Stage, margin = 50) => (x < s.w / 2 ? -margin * s.u : s.w + margin * s.u)

/** True on the one frame `pt` passes `mark`. */
const crossed = (pt: number, dt: number, mark: number) => pt >= mark && pt - dt < mark

const SAND = ['#e8d39a', '#d9bf7a', '#f3e3b5']

// ─── The golfers ─────────────────────────────────────────────────────────────
// Cap, polo shirt, and trousers that can be heard from the car park.

interface Golfer {
  look: Look
  /** Colour of the check on the trousers. */
  check: string
}

const GOLFERS: Golfer[] = [
  {
    look: { skin: C.skinA, top: '#f472b6', bottom: '#facc15', shoe: '#f8fafc', hair: C.grey, hat: 'cap', hatColor: C.white, hatTrim: C.red, moustache: C.grey },
    check: C.crimson,
  },
  {
    look: { skin: C.skinB, top: '#38bdf8', bottom: '#a3e635', shoe: '#f8fafc', hair: '#3b2a1a', hat: 'cap', hatColor: C.plum, hatTrim: C.yellow, gloves: C.white },
    check: '#15803d',
  },
  {
    look: { skin: C.skinA, top: C.cream, bottom: '#fb923c', shoe: '#f8fafc', hair: '#7a3f1d', hairStyle: 'long', hat: 'cap', hatColor: C.forest, hatTrim: C.white, glasses: true },
    check: C.navy,
  },
  {
    look: { skin: C.skinC, top: '#a78bfa', bottom: '#f87171', shoe: '#f8fafc', hair: '#2a1a10', hat: 'cap', hatColor: C.yellow, hatTrim: C.ink, beard: '#2a1a10' },
    check: C.white,
  },
]

/** The person rig, plus check bands on the near trouser leg. */
function drawGolfer(ctx: Ctx, g: Golfer, pose: Pose, behind?: (a: Anchors) => void): Anchors {
  const a = drawPerson(ctx, g.look, pose, behind)
  // Same leg geometry as the rig, so the bands ride the knee as it bends.
  const ph = pose.walk ?? 0
  const stride = pose.stride ?? 0
  const crouch = pose.crouch ?? 0
  const swing = Math.sin(ph) * 0.62 * stride + crouch * 0.55
  const bend = Math.max(0, -Math.cos(ph)) * 0.95 * stride + crouch * 1.25
  const hx = a.hip.x + 1.5
  const band = (ang: number, ox: number, oy: number, d: number) => {
    const px = ox + Math.sin(ang) * d
    const py = oy + Math.cos(ang) * d
    line(ctx, px - Math.cos(ang) * 2, py + Math.sin(ang) * 2, px + Math.cos(ang) * 2, py - Math.sin(ang) * 2, 1.3, g.check)
  }
  band(swing, hx, a.hip.y, 6.5)
  const kx = hx + Math.sin(swing) * 9
  const ky = a.hip.y + Math.cos(swing) * 9
  band(swing - bend, kx, ky, 2.5)
  band(swing - bend, kx, ky, 6)
  return a
}

// ─── Props ───────────────────────────────────────────────────────────────────

function drawBall(ctx: Ctx, x: number, y: number, r = 2.2) {
  fillCirc(ctx, x, y, r, '#ffffff')
  fillCirc(ctx, x - r * 0.3, y + r * 0.35, r * 0.45, '#cbd5e1')
  fillCirc(ctx, x + r * 0.3, y - r * 0.3, r * 0.3, '#ffffff')
}

type ClubKind = 'driver' | 'iron' | 'putter'

/**
 * A club held at (hx, hy). `ang` uses the arm convention: 0 hangs straight
 * down, PI/2 points forward. The head sticks out on the forward side.
 */
function drawClub(ctx: Ctx, hx: number, hy: number, ang: number, kind: ClubKind, len = 27) {
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(-ang)
  line(ctx, 0, 5, 0, len, 1.1, '#cbd5e1')
  line(ctx, 0, -3, 0, 6, 2.2, '#64748b')
  if (kind === 'driver') {
    fillEll(ctx, 2.6, len - 0.6, 4.6, 3, '#c2410c')
    fillEll(ctx, 2.2, len - 1.4, 2.6, 1.2, '#fb923c')
    fillRR(ctx, 5.6, len - 2.4, 1.3, 3.6, 0.6, '#fde9c9')
  } else if (kind === 'iron') {
    fillPoly(ctx, [-0.8, len - 3.4, 5.4, len + 0.4, -0.8, len + 0.6], '#e2e8f0')
    line(ctx, 0.4, len - 1.6, 3, len - 0.2, 0.5, '#94a3b8')
  } else {
    fillRR(ctx, -1.4, len - 1.6, 7, 2.8, 1, '#e2e8f0')
    fillRR(ctx, -1.4, len - 1.6, 7, 1, 0.5, '#f5c542')
  }
  ctx.restore()
}

/** A carry bag, base at (0, 0), about 46 units to the top of the tallest club. */
function drawBag(ctx: Ctx, color: string, trim: string, stand = false) {
  if (stand) {
    line(ctx, -2, -22, -13, 0, 1.1, '#94a3b8')
    line(ctx, -1, -22, -8, 0, 1.1, '#94a3b8')
  }
  // Clubs: a driver in a woolly headcover, an iron, a putter.
  line(ctx, -2, -30, -5, -40, 1.1, '#cbd5e1')
  fillEll(ctx, -5.4, -42, 2.8, 3.4, C.red, -0.2)
  fillRR(ctx, -7.4, -41, 4.4, 1.2, 0.5, C.white)
  fillCirc(ctx, -6.2, -45.8, 1.5, C.white)
  line(ctx, 1, -30, 1, -40, 1.1, '#cbd5e1')
  fillPoly(ctx, [0.4, -43, 5, -40.4, 0.4, -39.4], '#e2e8f0')
  line(ctx, 3.4, -30, 6.4, -37.5, 1.1, '#cbd5e1')
  fillRR(ctx, 5, -39.4, 4.8, 2.2, 0.8, '#e2e8f0')
  // The bag itself.
  fillRR(ctx, -6, -31, 12, 31, 4.5, color)
  fillRR(ctx, -6, -31, 3.2, 31, 1.6, shade(color, -0.16))
  fillRR(ctx, -6.6, -32, 13.2, 4.2, 2, shade(color, -0.28))
  fillRR(ctx, -1, -20, 6.6, 9.5, 2, trim)
  line(ctx, 0.8, -16.5, 4, -16.5, 0.7, shade(trim, -0.35))
  fillRR(ctx, -6.4, -4, 12.8, 4.2, 2, shade(color, -0.32))
  poly(ctx, [-5, -27, -10.5, -19, -6, -9], 1.6, shade(color, 0.3))
  fillRR(ctx, 4.6, -27.5, 3.2, 7.5, 1, C.white)
  line(ctx, 4.6, -24.5, 7.8, -24.5, 0.7, C.sky)
}

/** The bag slung on a walking golfer's back. Call from drawPerson's `behind`. */
function bagOnBack(ctx: Ctx, a: Anchors, color: string, trim: string) {
  ctx.save()
  ctx.translate(a.back.x - 1, a.back.y + 15)
  ctx.rotate(-0.28 + a.lean)
  drawBag(ctx, color, trim)
  ctx.restore()
}

/**
 * The hole, a patch of green round it, and the pin. `rise` 0..1 brings the
 * pin up out of the floor (it may overshoot a little; the shaft is long
 * enough to cover it).
 */
function drawPin(ctx: Ctx, t: number, rise: number, flag: string = C.red, shake = 0) {
  const show = clamp(rise * 2)
  if (show <= 0) return
  ctx.globalAlpha = show
  fillEll(ctx, 0, 1.4, 34, 2.8, '#1f7a48')
  fillEll(ctx, -4, 1, 24, 1.6, '#35a862')
  fillEll(ctx, 0, 1.1, 6.6, 2, '#04101f')
  ctx.globalAlpha = 1
  ctx.save()
  ctx.beginPath()
  ctx.rect(-30, -90, 60, 90.6)
  ctx.clip()
  ctx.translate(0, (1 - rise) * 64)
  ctx.rotate(Math.sin(t * 34) * shake * 0.08)
  line(ctx, 0, 10, 0, -58, 1.3, '#f1f5f9')
  line(ctx, 0, -6, 0, -12, 1.4, C.red)
  const w = Math.sin(t * 5) * 1.6
  ctx.beginPath()
  ctx.moveTo(0, -58)
  ctx.quadraticCurveTo(9, -59 + w, 17, -54 - w)
  ctx.quadraticCurveTo(9, -51 + w, 0, -47.5)
  ctx.closePath()
  ctx.fillStyle = flag
  ctx.fill()
  fillCirc(ctx, 0, -59, 1.3, C.gold)
  ctx.restore()
}

/** A mole in a tiny hard hat, coming up through the hole. `up` 0..1. */
function drawMole(ctx: Ctx, up: number, holding: boolean, t: number) {
  if (up <= 0) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(-16, -40, 34, 40.6)
  ctx.clip()
  ctx.translate(0, (1 - up) * 24)
  fillEll(ctx, 0, -5, 7.4, 12, '#8a756a')
  fillEll(ctx, 1.6, -3, 4.4, 8, '#b09a8c')
  fillEll(ctx, 6.6, -12, 4.2, 2.7, '#a18c7f')
  fillCirc(ctx, 10.4, -12.4, 1.7, C.pink)
  line(ctx, 3, -14.6, 5.2, -14.1, 0.9, C.ink)
  line(ctx, 8.4, -11, 12.6, -9.4, 0.4, alpha(C.white, 0.7))
  line(ctx, 8.4, -11.4, 12.8, -11.8 + Math.sin(t * 9) * 0.6, 0.4, alpha(C.white, 0.7))
  // Hard hat with a lamp.
  ctx.beginPath()
  ctx.arc(0.6, -15, 6, Math.PI, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = C.yellow
  ctx.fill()
  fillRR(ctx, -6.4, -15.6, 14.6, 1.6, 0.8, C.amber)
  fillCirc(ctx, 4.6, -18.4, 1.5, C.white)
  // Big digging paws.
  fillEll(ctx, -6.4, -2.6, 3.2, 1.9, C.pink, -0.3)
  fillEll(ctx, 7.4, holding ? -5.6 : -2.6, 3.2, 1.9, C.pink, 0.3)
  if (holding) drawBall(ctx, 8.4, -8.4)
  ctx.restore()
}

/** A slab of turf, grass side up. */
function drawDivot(ctx: Ctx, x: number, y: number, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  fillRR(ctx, -7, -1, 14, 5, 2.4, '#7a5a34')
  fillRR(ctx, -7.6, -3.4, 15.2, 4, 2, '#4ade80')
  for (let i = 0; i < 5; i++) line(ctx, -5.6 + i * 2.8, -3, -6.4 + i * 3, -6.4, 0.9, '#86efac')
  ctx.restore()
}

/**
 * Arm, club and lean through a full swing. `p`: 0 address, 1 top of the
 * backswing, 2 impact, 3 follow-through.
 */
function swing(p: number): { arm: number; club: number; lean: number } {
  const K = [
    [0.45, 0.78, 0.22],
    [-2.2, -3.9, 0.08],
    [0.45, 0.62, 0.26],
    [2.7, 4.6, -0.12],
  ]
  const q = clamp(p, 0, 2.999)
  const i = Math.floor(q)
  const f = q - i
  return { arm: lerp(K[i][0], K[i + 1][0], f), club: lerp(K[i][1], K[i + 1][1], f), lean: lerp(K[i][2], K[i + 1][2], f) }
}

const swingPose = (sw: { arm: number; lean: number }): Pose => ({
  armF: sw.arm,
  armB: sw.arm - 0.14,
  elbowF: 0.2,
  elbowB: 0.32,
  lean: sw.lean,
  crouch: 0.14,
})

// ─── The tee shot ────────────────────────────────────────────────────────────
// Bag down, tee in, an important waggle, and then one of three things: a hole
// in one and a jig; a perfectly good ball confiscated by the mole who lives in
// the hole; or the ball going a foot and the turf going a great deal further.

const teeShot: ActDef = {
  id: 'golf.tee-shot',
  weight: 3,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 50)
    const u = stage.u
    const g = pick(rng, GOLFERS)
    const gag = pick(rng, ['ace', 'mole', 'divot'] as const)
    const bagCol = pick(rng, [C.blue, C.crimson, C.forest, C.plum])
    const gap = Math.min(stage.w * 0.7, 560 * u)
    const teeX = stage.w / 2 - (dir * gap) / 2
    const ballX = teeX + dir * 26 * u
    const holeX = stage.w / 2 + (dir * gap) / 2
    const peak = Math.min(250 * u, stage.ground - 50)
    const m: Mover = { x: from, walk: 0, dir }
    type Phase = 'in' | 'tee' | 'waggle' | 'back' | 'swing' | 'watch' | 'react' | 'bag' | 'toHole' | 'retrieve' | 'out'
    let phase: Phase = 'in'
    let pt = 0
    let bagDown = false
    let ball: 'none' | 'ground' | 'air' | 'mole' | 'hand' | 'gone' = 'none'
    let bx = ballX
    let by = 3 * u // px above the floor; it starts on a tee
    let bt = 0 // seconds since impact
    let moleUp = 0
    let turf: 'none' | 'air' | 'head' = 'none'
    let pinT = 0
    let pinShake = 0
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        pinShake = Math.max(0, pinShake - dt * 1.4)
        if (phase === 'in') {
          if (stepTo(m, teeX, 64, s, dt)) {
            m.dir = dir
            bagDown = true
            go('tee')
          }
        } else if (phase === 'tee') {
          if (crossed(pt, dt, 0.6)) ball = 'ground'
          if (pt > 1.15) go('waggle')
        } else if (phase === 'waggle') {
          if (pt > 2) go('back')
        } else if (phase === 'back') {
          if (pt > 0.8) go('swing')
        } else if (phase === 'swing') {
          if (pt > 0.16) {
            ball = 'air'
            bt = 0
            burst(s, 'dust', ballX, s.ground - 2 * u, 4, ['#cbd5e1'], 40, [3, 5])
            if (gag === 'divot') {
              turf = 'air'
              burst(s, 'dust', ballX, s.ground - 2 * u, 10, ['#7a5a34', '#4ade80', '#65a30d'], 90, [2, 5])
            }
            go('watch')
          }
        } else if (phase === 'watch') {
          bt += dt
          if (gag === 'ace') {
            const p = bt / 2.4
            bx = lerp(ballX, holeX, p)
            by = 4 * peak * p * (1 - p) + 3 * u * (1 - p)
            if (p >= 1) {
              ball = 'gone'
              pinShake = 1
              burst(s, 'star', holeX, s.ground - 8 * u, 12, [C.yellow, C.gold, C.white], 110, [3, 6])
              go('react')
            }
          } else if (gag === 'mole') {
            // Lands short, takes one hop, and trickles up to the lip.
            if (bt < 2.4) {
              const p = bt / 2.4
              bx = lerp(ballX, holeX - dir * 32 * u, p)
              by = 4 * peak * p * (1 - p) + 3 * u * (1 - p)
            } else if (bt < 2.8) {
              const p = (bt - 2.4) / 0.4
              bx = holeX - dir * lerp(32, 19, p) * u
              by = 4 * 9 * u * p * (1 - p)
            } else {
              bx = holeX - dir * lerp(19, 10, easeOut(seg(bt, 2.8, 3.6))) * u
              by = 0
              if (bt > 3.6) {
                ball = 'ground'
                go('react')
              }
            }
            if (crossed(bt, dt, 2.4)) burst(s, 'dust', bx, s.ground - 2 * u, 3, ['#86efac'], 40, [2, 4])
          } else {
            bx = ballX + dir * 17 * u * easeOut(seg(bt, 0, 0.9))
            by = Math.abs(Math.sin(bt * 13)) * 3.5 * u * (1 - seg(bt, 0, 0.9))
            if (bt > 1.7) {
              turf = 'head'
              ball = 'ground'
              burst(s, 'dust', teeX, s.ground - 62 * u, 5, ['#7a5a34', '#4ade80'], 50, [2, 4])
              go('react')
            }
          }
        } else if (phase === 'react') {
          if (gag === 'ace') {
            if (Math.floor(pt * 4) !== Math.floor((pt - dt) * 4)) {
              burst(s, 'star', m.x + range(rng, -14, 14) * u, s.ground - range(rng, 40, 70) * u, 2, [C.yellow, C.gold, C.pink], 60, [3, 5])
            }
            if (pt > 2.6) go('bag')
          } else if (gag === 'mole') {
            moleUp = easeOut(seg(pt, 0.4, 0.9)) * (1 - easeIn(seg(pt, 2.3, 2.8)))
            if (crossed(pt, dt, 1.5)) ball = 'mole'
            if (crossed(pt, dt, 2.8)) ball = 'gone'
            if (pt > 4.2) go('bag')
          } else {
            if (crossed(pt, dt, 2.2)) ball = 'hand'
            if (pt > 2.7) go('bag')
          }
        } else if (phase === 'bag') {
          if (crossed(pt, dt, 0.3)) bagDown = false
          if (pt > 0.6) go(gag === 'ace' ? 'toHole' : 'out')
        } else if (phase === 'toHole') {
          if (stepTo(m, holeX - dir * 13 * u, 92, s, dt)) {
            m.dir = dir
            go('retrieve')
          }
        } else if (phase === 'retrieve') {
          if (crossed(pt, dt, 0.6)) ball = 'hand'
          if (pt > 1.7) go('out')
        } else {
          pinT += dt
          const gone = stepTo(m, edge(m.x, s), gag === 'ace' ? 72 : 56, s, dt)
          return !(gone && pinT > 0.8)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const rise = easeBack(seg(t, 0.2, 0.9)) * (1 - easeIn(seg(pinT, 0, 0.6)))
        at(ctx, holeX, s.ground, u, dir, () => {
          drawPin(ctx, t, rise, C.red, pinShake)
          // The mole comes up facing the ball, and the tee.
          ctx.scale(-1, 1)
          drawMole(ctx, moleUp, ball === 'mole', t)
        })
        // Tee markers, and the scar the divot left.
        const marks = clamp(rise) * (bagDown || phase === 'in' ? 1 : 1 - seg(pt, 0, 0.5))
        if (marks > 0.02) {
          at(ctx, teeX, s.ground, u, dir, () => {
            ctx.globalAlpha = marks
            fillCirc(ctx, 12, -2, 2.4, C.red)
            fillCirc(ctx, 38, -2, 2.4, C.red)
            if (turf !== 'none') fillEll(ctx, 27, 1, 8, 1.8, '#5b4226')
            ctx.globalAlpha = 1
          })
        }
        if (bagDown) {
          at(ctx, teeX - dir * 22 * u, s.ground, u, dir, () => {
            groundShadow(ctx, -3, 9)
            ctx.rotate(0.2)
            drawBag(ctx, bagCol, C.yellow, true)
          })
        }
        const walking = phase === 'in' || phase === 'toHole' || phase === 'out'
        at(ctx, m.x, s.ground, u, m.dir, () => {
          groundShadow(ctx, 0, 11)
          const blink = blinking(s.time, 2)
          const carry = bagDown ? undefined : (a: Anchors) => bagOnBack(ctx, a, bagCol, C.yellow)
          let a: Anchors
          let club: { x: number; y: number; ang: number } | undefined
          if (walking) {
            const glum = phase === 'out' && gag !== 'ace'
            a = drawGolfer(
              ctx,
              g,
              {
                walk: m.walk,
                stride: glum ? 0.55 : 0.8,
                lean: glum ? 0.16 : 0.04,
                mouth: glum ? 'frown' : phase === 'out' ? 'grin' : 'smile',
                armF: phase === 'out' && gag === 'ace' ? 2.7 : undefined,
                elbowF: phase === 'out' && gag === 'ace' ? 0.2 : undefined,
                blink,
              },
              carry,
            )
            if (phase === 'out' && gag === 'ace') drawBall(ctx, a.handF.x + 1, a.handF.y - 3)
          } else if (phase === 'tee') {
            const d = Math.sin(seg(pt, 0, 1.15) * Math.PI)
            a = drawGolfer(ctx, g, { crouch: d * 0.8, lean: d * 0.5, armF: 0.5 + d * 0.5, elbowF: 0.1, armB: -0.25, elbowB: 0.5, headTilt: 0.2, blink })
            club = { x: a.handB.x, y: a.handB.y, ang: 1.25 }
          } else if (phase === 'waggle' || phase === 'back' || phase === 'swing' || (phase === 'watch' && pt < 0.95)) {
            const p = phase === 'waggle' ? 0 : phase === 'back' ? easeInOut(pt / 0.8) : phase === 'swing' ? 1 + pt / 0.16 : 2 + easeOut(seg(pt, 0, 0.3))
            const sw = swing(p)
            const wag = phase === 'waggle' ? Math.sin(pt * 9) : 0
            const peek = phase === 'waggle' && pt > 0.8 && pt < 1.25
            a = drawGolfer(ctx, g, {
              ...swingPose(sw),
              lean: sw.lean + wag * 0.03,
              headTilt: phase === 'watch' ? -0.1 : peek ? -0.12 : 0.32,
              mouth: phase === 'waggle' ? 'flat' : phase === 'watch' ? 'smile' : 'puff',
              blink,
            })
            club = { x: a.handF.x, y: a.handF.y, ang: sw.club + wag * 0.09 }
            if (phase === 'swing') speedLines(ctx, a.handF.x - 4, a.handF.y, 10, t)
          } else if (phase === 'watch' || (phase === 'react' && gag === 'mole' && pt < 1.5)) {
            // Hand to the brow, following it all the way.
            a = drawGolfer(ctx, g, { armF: 2.25, elbowF: 1.5, armB: 0.2, elbowB: 0.3, lean: -0.06, headTilt: gag === 'divot' ? -0.2 : -0.12, mouth: 'smile', blink })
            club = { x: a.handB.x, y: a.handB.y, ang: 0.95 }
          } else if (phase === 'react' && gag === 'ace') {
            // The jig.
            const k = Math.sin(pt * 10)
            a = drawGolfer(ctx, g, {
              lift: Math.abs(k) * 7,
              walk: pt * 10,
              stride: 0.5,
              armF: 2.6 + k * 0.5,
              armB: -2.6 + k * 0.5,
              elbowF: 0.3,
              elbowB: -0.3,
              headTilt: k * 0.12,
              mouth: 'grin',
              eyes: 'closed',
            })
            club = { x: a.handB.x, y: a.handB.y, ang: Math.PI + k * 0.4 }
          } else if (phase === 'react' && gag === 'mole') {
            a = drawGolfer(ctx, g, { armF: 0.5, elbowF: 0.9, armB: 0.1, lean: 0.12, mouth: 'o', eyes: 'wide' })
            club = { x: a.handB.x, y: a.handB.y, ang: 0.95 }
            if (pt > 1.7 && pt < 3.8) bubble(ctx, a.head.x * m.dir, a.head.y - 19, '?!', { color: C.crimson })
          } else if (phase === 'react') {
            // Divot: a long moment, a look down, and the walk of shame begins.
            const down = easeInOut(seg(pt, 1.7, 2.2)) * (1 - seg(pt, 2.4, 2.7))
            a = drawGolfer(ctx, g, {
              crouch: down * 0.8,
              lean: down * 0.5,
              armF: down * 1.1,
              elbowF: 0.1,
              headTilt: pt > 1 ? 0.3 : 0,
              mouth: 'flat',
              eyes: pt < 1 ? 'wide' : 'normal',
            })
            club = { x: a.handB.x, y: a.handB.y, ang: 0.95 }
          } else if (phase === 'retrieve') {
            const d = Math.sin(seg(pt, 0, 1) * Math.PI)
            const up = easeOut(seg(pt, 1, 1.4))
            a = drawGolfer(ctx, g, { crouch: d * 0.9, lean: d * 0.55, armF: 0.6 + d * 0.4 + up * 2.1, elbowF: 0.1, mouth: 'grin', eyes: up > 0.5 ? 'closed' : 'normal' }, carry)
            if (ball === 'hand') drawBall(ctx, a.handF.x + 1, a.handF.y - 3)
          } else {
            // Shouldering the bag.
            const d = Math.sin(seg(pt, 0, 0.6) * Math.PI)
            a = drawGolfer(ctx, g, { crouch: d * 0.4, lean: -d * 0.15, armB: -d * 1.2, mouth: gag === 'ace' ? 'grin' : 'flat' }, carry)
          }
          if (club) drawClub(ctx, club.x, club.y, club.ang, 'driver')
          if (turf === 'head') drawDivot(ctx, a.crown.x - 1, a.crown.y - 3, -0.12)
        })
        // The tee peg, the ball, and the turf in flight.
        if (ball !== 'none' && (phase === 'tee' || phase === 'waggle' || phase === 'back' || phase === 'swing')) {
          at(ctx, ballX, s.ground, u, dir, () => line(ctx, 0, 0, 0, -2.6, 1.1, C.orange))
        }
        if (ball === 'ground' || ball === 'air') {
          at(ctx, bx, s.ground - by, u, 1, () => {
            if (ball === 'air' && by > 20 * u) {
              for (let i = 1; i <= 3; i++) {
                ctx.globalAlpha = 0.3 - i * 0.08
                fillCirc(ctx, -dir * i * 5, i * (bt < 1.2 ? 3 : -3), 1.8, C.white)
              }
              ctx.globalAlpha = 1
            }
            drawBall(ctx, 0, -2.2)
          })
        }
        if (turf === 'air') {
          const q = clamp(bt / 1.7)
          const tx = lerp(ballX, teeX + dir * 2 * u, q)
          const ty = s.ground - lerp(0, 62 * u, q) - 4 * 62 * u * q * (1 - q)
          at(ctx, tx, ty, u, dir, () => drawDivot(ctx, 0, 0, q * 9))
        }
      },
    })
  },
}

// ─── The putt ────────────────────────────────────────────────────────────────
// Four feet, read from every angle. It lips out and he drops to his knees; or
// it drops and he punches the air; or it stops on the edge until a firm stamp
// persuades it, and nobody saw that.

const putt: ActDef = {
  id: 'golf.putt',
  weight: 2,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 40)
    const u = stage.u
    const g = pick(rng, GOLFERS)
    const gag = pick(rng, ['lip', 'drop', 'stomp'] as const)
    const holeX = stage.w / 2 + dir * range(rng, 50, 75) * u
    const ballX = holeX - dir * 112 * u
    const standX = ballX - dir * 24 * u
    const m: Mover = { x: from, walk: 0, dir }
    type Phase = 'in' | 'place' | 'plumb' | 'read' | 'address' | 'tap' | 'roll' | 'react' | 'walkUp' | 'finish' | 'out'
    let phase: Phase = 'in'
    let pt = 0
    let placed = false
    let sunk = false
    let bx = ballX
    let by = 0
    let pinT = 0
    let pinShake = 0
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    const drop = (s: Stage) => {
      sunk = true
      pinShake = 1
      burst(s, 'star', holeX, s.ground - 6 * u, 6, [C.yellow, C.white], 70, [2, 4])
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        pinShake = Math.max(0, pinShake - dt * 1.4)
        if (phase === 'in') {
          if (stepTo(m, standX, 62, s, dt)) {
            m.dir = dir
            go('place')
          }
        } else if (phase === 'place') {
          if (crossed(pt, dt, 0.5)) placed = true
          if (pt > 1) go('plumb')
        } else if (phase === 'plumb') {
          if (pt > 2.2) go('read')
        } else if (phase === 'read') {
          if (pt > 1.5) go('address')
        } else if (phase === 'address') {
          if (pt > 1.7) go('tap')
        } else if (phase === 'tap') {
          if (pt > 0.2) go('roll')
        } else if (phase === 'roll') {
          if (gag === 'drop') {
            bx = lerp(ballX, holeX, easeOut(seg(pt, 0, 3)))
            if (pt > 2.85) {
              drop(s)
              go('react')
            }
          } else if (gag === 'lip') {
            // Up to the rim, once round it, and out the far side.
            if (pt < 2.6) bx = lerp(ballX, holeX - dir * 6.5 * u, easeOut(seg(pt, 0, 2.6)))
            else if (pt < 3.7) {
              const a = Math.PI + ((pt - 2.6) / 1.1) * Math.PI * 3
              bx = holeX + dir * Math.cos(a) * 6.5 * u
              by = -Math.sin(a) * 1.6 * u
            } else {
              bx = holeX + dir * lerp(6.5, 15, easeOut(seg(pt, 3.7, 4.3))) * u
              by = 0
              if (pt > 4.3) go('react')
            }
          } else {
            bx = lerp(ballX, holeX - dir * 8.5 * u, easeOut(seg(pt, 0, 3)))
            if (pt > 3.2) go('react')
          }
        } else if (phase === 'react') {
          if (pt > (gag === 'drop' ? 1.9 : gag === 'lip' ? 2.6 : 2.4)) go(gag === 'drop' ? 'out' : 'walkUp')
        } else if (phase === 'walkUp') {
          // Lip-out: round to the far side of the ball, to knock it back in.
          const stop = gag === 'lip' ? bx + dir * 24 * u : holeX - dir * 17 * u
          if (stepTo(m, stop, 40, s, dt)) {
            m.dir = gag === 'lip' ? ((-dir) as 1 | -1) : dir
            go('finish')
          }
        } else if (phase === 'finish') {
          if (gag === 'lip') {
            // A cross little back-handed tap-in from the far side.
            if (pt > 0.5 && !sunk) {
              bx = lerp(holeX + dir * 15 * u, holeX, seg(pt, 0.5, 0.8))
              if (pt > 0.8) drop(s)
            }
            if (pt > 1.5) go('out')
          } else {
            if (crossed(pt, dt, 0.75)) {
              burst(s, 'dust', m.x + dir * 8 * u, s.ground - 2 * u, 5, ['#cbd5e1'], 50, [3, 5])
              drop(s)
            }
            if (crossed(pt, dt, 1.6) || crossed(pt, dt, 2.1)) {
              s.particles.emit({ kind: 'note', x: m.x + dir * 12 * u, y: s.ground - 52 * u, vx: dir * 12 * u, size: 7 * u, color: C.sky })
            }
            if (pt > 2.6) go('out')
          }
        } else {
          pinT += dt
          const target = gag === 'lip' ? edge(m.x, s) : dir === 1 ? s.w + 50 * u : -50 * u
          return !(stepTo(m, target, 60, s, dt) && pinT > 0.8)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const rise = easeBack(seg(t, 0.2, 0.9)) * (1 - easeIn(seg(pinT, 0, 0.6)))
        at(ctx, holeX, s.ground, u, dir, () => drawPin(ctx, t, rise, C.yellow, pinShake))
        at(ctx, m.x, s.ground, u, m.dir, () => {
          groundShadow(ctx, 0, 11)
          const blink = blinking(s.time, 4)
          let a: Anchors
          let club: number | undefined // putter angle, held in the front hand
          if (phase === 'in' || phase === 'walkUp' || phase === 'out') {
            const cross = phase === 'walkUp' && gag === 'lip'
            const sly = phase === 'out' && gag === 'stomp'
            a = drawGolfer(ctx, g, {
              walk: m.walk,
              stride: cross ? 0.5 : 0.75,
              armF: 0.5,
              elbowF: 0.5,
              headTilt: sly ? -0.22 : 0,
              mouth: cross ? 'frown' : sly ? 'puff' : 'smile',
              blink,
            })
            club = 1.9
            if (phase === 'in') drawBall(ctx, a.handB.x, a.handB.y + 1)
          } else if (phase === 'place') {
            const d = Math.sin(seg(pt, 0, 1) * Math.PI)
            a = drawGolfer(ctx, g, { crouch: d * 0.85, lean: d * 0.5, armF: 0.4, elbowF: 0.4, armB: 0.3 + d * 0.9, elbowB: 0.1, blink })
            club = 1.2
            if (!placed) drawBall(ctx, a.handB.x + 1, a.handB.y + 1)
          } else if (phase === 'plumb') {
            // Putter dangled at arm's length, squinting past it at the hole.
            const up = easeOut(seg(pt, 0, 0.35)) * (1 - seg(pt, 1.9, 2.2))
            a = drawGolfer(ctx, g, { armF: 0.5 + up * 1.15, elbowF: 0.5 - up * 0.4, lean: -up * 0.1, headTilt: up * 0.1, mouth: 'flat', eyes: Math.floor(pt * 2.2) % 2 === 1 ? 'closed' : 'normal' })
            club = lerp(1.2, Math.sin(pt * 3.2) * 0.07, up)
          } else if (phase === 'read') {
            // Down on his haunches, reading the borrow.
            const d = easeInOut(seg(pt, 0, 0.35)) * (1 - easeInOut(seg(pt, 1.15, 1.5)))
            a = drawGolfer(ctx, g, { crouch: d, lean: d * 0.2, armF: 0.5 + d * 1.7, elbowF: 0.5 + d * 1, armB: 0.3, headTilt: -d * 0.05, mouth: 'flat', blink })
            club = undefined
            drawClub(ctx, a.handB.x, a.handB.y, 1.35, 'putter', 25)
            if (d > 0.9) bubble(ctx, a.head.x * m.dir, a.head.y - 18, '...', { size: 9 })
          } else if (phase === 'address' || phase === 'tap' || phase === 'roll') {
            const practice = phase === 'address' ? Math.sin(seg(pt, 0.3, 1.5) * Math.PI * 4) * 0.16 : 0
            const hit = phase === 'tap' ? lerp(-0.2, 0.12, pt / 0.2) : phase === 'roll' ? 0.12 : 0
            // Body english while it rolls: leaning it in.
            const will = phase === 'roll' ? Math.sin(pt * 3) * 0.06 + seg(pt, 0.5, 2.5) * 0.14 : 0
            a = drawGolfer(ctx, g, {
              armF: 0.36 + practice * 0.5 + hit * 0.6,
              armB: 0.24 + practice * 0.5 + hit * 0.6,
              elbowF: 0.2,
              elbowB: 0.3,
              lean: 0.22 + will,
              crouch: 0.14,
              headTilt: phase === 'roll' ? -0.1 : 0.3,
              mouth: phase === 'roll' && pt > 1.5 ? 'o' : 'flat',
              eyes: phase === 'roll' && pt > 2 ? 'wide' : 'normal',
            })
            club = 0.6 + practice + hit
          } else if (phase === 'react' && gag === 'drop') {
            // Fist pump.
            const k = Math.sin(seg(pt, 0.1, 1.5) * Math.PI * 3)
            a = drawGolfer(ctx, g, { armF: 2.4 + k * 0.4, elbowF: 1.1 - k * 0.6, lift: Math.max(0, k) * 5, lean: -0.1, mouth: 'grin', eyes: 'closed' })
            club = undefined
            drawClub(ctx, a.handB.x, a.handB.y, 0.25, 'putter', 25)
          } else if (phase === 'react' && gag === 'lip') {
            // To his knees, arms to the heavens, then the slump.
            const down = easeOut(seg(pt, 0, 0.3))
            const slump = easeInOut(seg(pt, 1.2, 1.8)) * (1 - seg(pt, 2.3, 2.6))
            const up = 1 - seg(pt, 2.3, 2.6)
            a = drawGolfer(ctx, g, {
              crouch: down * up,
              lean: (-0.3 + slump * 0.85) * up,
              armF: lerp(2.9, 0.3, slump),
              armB: lerp(-2.9, 0.1, slump),
              headTilt: lerp(-0.4, 0.4, slump),
              mouth: slump > 0.5 ? 'frown' : 'o',
              eyes: slump > 0.5 ? 'closed' : 'wide',
            })
            club = undefined
            // The putter, dropped where he stood.
            line(ctx, -16, -1, 8, -1, 1.1, '#cbd5e1')
            fillRR(ctx, -18, -3, 2.8, 4, 1, '#e2e8f0')
          } else if (phase === 'react') {
            // Stomp: a long stare, then a check over each shoulder.
            const look = pt > 1 ? (Math.floor((pt - 1) * 2.2) % 2 === 0 ? -1 : 1) : 1
            ctx.scale(look, 1)
            a = drawGolfer(ctx, g, { armF: 0.4, elbowF: 0.4, lean: pt < 1 ? 0.15 : 0, mouth: 'flat', eyes: pt > 1 ? 'wide' : 'normal' })
            club = 0.9
          } else if (gag === 'lip') {
            const hit = seg(pt, 0.35, 0.55)
            a = drawGolfer(ctx, g, { armF: 0.3 + hit * 0.3, elbowF: 0.2, armB: -0.5, elbowB: -0.9, lean: 0.12, mouth: 'frown' })
            club = 0.45 + hit * 0.3
          } else {
            // The stamp, then nothing to see here.
            const k = pt < 0.75 ? Math.sin(seg(pt, 0.3, 0.75) * Math.PI) : 0
            a = drawGolfer(ctx, g, {
              lift: k * 9,
              crouch: k * 0.3,
              armF: 0.5,
              elbowF: 0.5,
              headTilt: pt > 1.2 ? -0.25 : 0.2,
              mouth: pt > 1.2 ? 'puff' : 'flat',
              eyes: pt > 1.2 ? 'closed' : 'normal',
            })
            club = 1.9
          }
          if (club !== undefined) drawClub(ctx, a.handF.x, a.handF.y, club, 'putter', 25)
        })
        if (placed && !sunk) at(ctx, bx, s.ground - by, u, 1, () => drawBall(ctx, 0, -2.2))
      },
    })
  },
}

// ─── The bunker ──────────────────────────────────────────────────────────────
// Three good swings and a great deal of sand. Either the ball finally comes
// out, or he checks nobody is looking and throws it.

const bunker: ActDef = {
  id: 'golf.bunker',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const u = stage.u
    const g = pick(rng, GOLFERS)
    const gag = chance(rng, 0.5) ? 'out' : 'throw'
    const hacks = gag === 'out' ? 3 : pick(rng, [3, 4])
    const trapX = stage.w / 2 + range(rng, -30, 30) * u
    const standX = trapX - dir * 12 * u
    const ballX = standX + dir * 22 * u
    const m: Mover = { x: from, walk: 0, dir }
    type Phase = 'in' | 'eye' | 'hack' | 'puff' | 'guilty' | 'pick' | 'throw' | 'cheer' | 'out'
    let phase: Phase = 'in'
    let pt = 0
    let n = 0
    let ball: 'sand' | 'hand' | 'air' | 'gone' = 'sand'
    let hop = 0 // seconds since the last failed hack moved the ball
    let bt = 0
    let sandy = 0 // 0..1, how much of the bunker he is wearing
    let trapT = 0
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    const spray = (s: Stage, count: number) => {
      for (let i = 0; i < count; i++) {
        s.particles.emit({
          kind: 'dust',
          x: ballX + range(rng, -6, 6) * u,
          y: s.ground - 3 * u,
          vx: dir * range(rng, -20, 110) * u,
          vy: -range(rng, 40, 170) * u,
          g: 260,
          drag: 0.5,
          size: range(rng, 2.5, 6) * u,
          color: pick(rng, SAND),
          life: range(rng, 0.7, 1.2),
        })
      }
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        hop += dt
        if (phase === 'in') {
          if (stepTo(m, standX, 62, s, dt)) {
            m.dir = dir
            go('eye')
          }
        } else if (phase === 'eye') {
          if (pt > 1) go('hack')
        } else if (phase === 'hack') {
          if (crossed(pt, dt, 0.62)) {
            n++
            spray(s, 13)
            sandy = clamp(sandy + 0.34)
            if (gag === 'out' && n === hacks) {
              ball = 'air'
              bt = 0
            } else hop = 0
          }
          if (pt > 1.25) {
            if (n < hacks) go('hack')
            else go(gag === 'out' ? 'cheer' : 'puff')
          }
        } else if (phase === 'puff') {
          if (pt > 1.3) go('guilty')
        } else if (phase === 'guilty') {
          if (pt > 1.6) go('pick')
        } else if (phase === 'pick') {
          if (crossed(pt, dt, 0.4)) ball = 'hand'
          if (pt > 0.8) go('throw')
        } else if (phase === 'throw') {
          if (crossed(pt, dt, 0.3)) {
            ball = 'air'
            bt = 0
          }
          if (pt > 1) go('out')
        } else if (phase === 'cheer') {
          if (pt > 1.5) go('out')
        } else {
          trapT += dt
          if (gag === 'throw' && (crossed(pt, dt, 0.5) || crossed(pt, dt, 1.2))) {
            s.particles.emit({ kind: 'note', x: m.x + dir * 12 * u, y: s.ground - 52 * u, vx: dir * 12 * u, size: 7 * u, color: C.sky })
          }
          if (stepTo(m, to, 62, s, dt) && trapT > 0.8) return false
        }
        if (ball === 'air') {
          bt += dt
          if (bt > 1.7) ball = 'gone'
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const k = easeBack(seg(t, 0.2, 0.8)) * (1 - easeIn(seg(trapT, 0.1, 0.7)))
        if (k > 0.01) {
          at(ctx, trapX, s.ground, u, dir, () => {
            fillEll(ctx, 0, 1, 48 * k, 5.2 * k, '#2f9e5b')
            fillEll(ctx, 0, 1.6, 44 * k, 4.2 * k, SAND[0])
            fillEll(ctx, -5 * k, 2.4, 34 * k, 2.4 * k, SAND[1])
            fillEll(ctx, 14 * k, 0.6, 12 * k, 1.2 * k, SAND[2])
            // The rake nobody ever uses, lying at the far end.
            if (k > 0.9) {
              line(ctx, 30, -1, 52, -3, 1.2, '#a16207')
              line(ctx, 30, -3.4, 30, 1.4, 1.4, '#94a3b8')
              for (let i = 0; i < 4; i++) line(ctx, 30, -3 + i * 1.4, 28, -3 + i * 1.4, 0.8, '#94a3b8')
            }
          })
        }
        // The ball.
        if (ball === 'sand') {
          const h = hop < 0.6 && n > 0 ? Math.sin((hop / 0.6) * Math.PI) * (8 + n * 5) : 0
          at(ctx, ballX, s.ground, u, dir, () => drawBall(ctx, Math.sin(hop * 5) * (hop < 0.6 ? 2 : 0), -1.4 - h))
        } else if (ball === 'air') {
          const lob = gag === 'out'
          const x0 = lob ? ballX : m.x + dir * 8 * u
          const y0 = lob ? 0 : 50 * u
          const p = bt / 1.7
          const x = x0 + dir * bt * (lob ? 150 : 210) * u
          const y = s.ground - y0 - (lob ? 4 * 120 * u * p * (1 - p) : 90 * u * p - 140 * u * p * p)
          ctx.globalAlpha = 1 - seg(bt, 1.3, 1.7)
          at(ctx, x, y, u, 1, () => drawBall(ctx, 0, -2.2))
          ctx.globalAlpha = 1
        }
        at(ctx, m.x, s.ground, u, m.dir, () => {
          groundShadow(ctx, 0, 11)
          const blink = blinking(s.time, 6)
          let a: Anchors
          let club: { x: number; y: number; ang: number } | undefined
          if (phase === 'in' || phase === 'out') {
            const whistling = phase === 'out' && gag === 'throw'
            a = drawGolfer(ctx, g, {
              walk: m.walk,
              stride: 0.8,
              armF: 0.5,
              elbowF: 0.5,
              headTilt: whistling ? -0.22 : 0,
              mouth: whistling ? 'puff' : phase === 'out' ? 'grin' : 'flat',
              eyes: whistling ? 'closed' : 'normal',
              blink,
            })
            club = { x: a.handF.x, y: a.handF.y, ang: 1.9 }
          } else if (phase === 'eye') {
            a = drawGolfer(ctx, g, { ...swingPose(swing(0)), headTilt: 0.34, mouth: 'frown', blink })
            club = { x: a.handF.x, y: a.handF.y, ang: 0.78 + Math.sin(pt * 9) * 0.07 }
          } else if (phase === 'hack') {
            const p = pt < 0.5 ? easeInOut(pt / 0.5) : pt < 0.62 ? 1 + (pt - 0.5) / 0.12 : 2 + easeOut(seg(pt, 0.62, 0.85)) * (1 - easeInOut(seg(pt, 0.95, 1.25)) * 0.999)
            const sw = pt > 0.95 ? swing(lerp(3, 0, easeInOut(seg(pt, 0.95, 1.25)))) : swing(p)
            a = drawGolfer(ctx, g, { ...swingPose(sw), headTilt: 0.3, mouth: 'puff', eyes: pt > 0.62 && pt < 1 ? 'closed' : 'normal' })
            club = { x: a.handF.x, y: a.handF.y, ang: pt > 0.95 ? lerp(4.6, 0.78, easeInOut(seg(pt, 0.95, 1.25))) : sw.club }
          } else if (phase === 'puff') {
            a = drawGolfer(ctx, g, { lean: 0.38, crouch: 0.2, armF: 0.5, armB: 0.3, elbowF: 0.2, headTilt: 0.2 + Math.sin(pt * 9) * 0.05, mouth: 'puff', eyes: 'closed' })
            club = { x: a.handF.x, y: a.handF.y, ang: 0.2 }
            sweat(ctx, a.head.x, a.head.y - 8, t)
          } else if (phase === 'guilty') {
            const look = Math.floor(pt * 2.6) % 2 === 0 ? -1 : 1
            ctx.scale(look, 1)
            a = drawGolfer(ctx, g, { armF: 0.4, elbowF: 0.4, mouth: 'flat', eyes: 'wide' })
            club = { x: a.handF.x, y: a.handF.y, ang: 0.9 }
          } else if (phase === 'pick') {
            const d = Math.sin(seg(pt, 0, 0.8) * Math.PI)
            a = drawGolfer(ctx, g, { crouch: d * 0.85, lean: d * 0.55, armF: 0.7 + d * 0.5, elbowF: 0.1, armB: -0.3, mouth: 'flat', eyes: 'wide' })
            club = { x: a.handB.x, y: a.handB.y, ang: 0.2 }
            if (ball === 'hand') drawBall(ctx, a.handF.x + 1, a.handF.y)
          } else if (phase === 'throw') {
            const p = easeOut(seg(pt, 0.12, 0.38))
            a = drawGolfer(ctx, g, { armF: lerp(-2.4, 1.6, p), elbowF: 0.4, armB: -0.3, lean: lerp(-0.2, 0.25, p), mouth: 'puff' })
            club = { x: a.handB.x, y: a.handB.y, ang: 0.2 }
            if (ball === 'hand') drawBall(ctx, a.handF.x, a.handF.y - 2)
          } else {
            const kk = Math.sin(pt * 9)
            a = drawGolfer(ctx, g, { armF: 2.8, armB: -2.6 + kk * 0.2, elbowF: 0.2, lift: Math.abs(kk) * 4, mouth: 'grin', eyes: 'closed' })
            club = { x: a.handF.x, y: a.handF.y, ang: Math.PI + kk * 0.3 }
          }
          if (club) drawClub(ctx, club.x, club.y, club.ang, 'iron', 26)
          // Sand on the cap and shoulders.
          if (sandy > 0.3) {
            fillEll(ctx, a.crown.x - 1, a.crown.y - 1, 5 * sandy, 1.8 * sandy, SAND[0])
            fillEll(ctx, a.shoulder.x - 3, a.shoulder.y - 1.5, 4 * sandy, 1.4 * sandy, SAND[1])
          }
        })
      },
    })
  },
}

// ─── The buggy ───────────────────────────────────────────────────────────────

/**
 * A golf buggy, about 70 units long and 62 tall, wheels on the floor.
 * `riders` draws whoever is on the seat; `load` draws what is on the deck.
 */
function drawBuggy(ctx: Ctx, roll: number, color: string, beacon: number, riders: () => void, load: () => void) {
  const wheel = (x: number) => {
    fillCirc(ctx, x, -6.5, 6.5, '#334155')
    fillCirc(ctx, x, -6.5, 3.6, '#e2e8f0')
    for (let i = 0; i < 3; i++) {
      const a = roll + (i * Math.PI) / 3
      line(ctx, x - Math.cos(a) * 3.2, -6.5 - Math.sin(a) * 3.2, x + Math.cos(a) * 3.2, -6.5 + Math.sin(a) * 3.2, 0.8, '#64748b')
    }
    fillCirc(ctx, x, -6.5, 1.2, '#475569')
  }
  groundShadow(ctx, -2, 36)
  // Canopy posts and the seat back, behind the riders.
  line(ctx, -15, -20, -18, -58, 1.6, '#cbd5e1')
  line(ctx, 22, -24, 19, -58, 1.6, '#cbd5e1')
  fillRR(ctx, -14, -36, 5, 18, 2.4, '#c8a06a')
  riders()
  // Roof, with a jaunty pennant and (when reversing) a beacon.
  fillRR(ctx, -24, -62, 50, 4.6, 2.3, color)
  fillRR(ctx, -24, -59.4, 50, 2, 1, shade(color, -0.25))
  line(ctx, -20, -62, -20, -70, 0.9, '#cbd5e1')
  fillPoly(ctx, [-20, -70, -28, -68, -20, -66], C.yellow)
  if (beacon > 0) {
    fillRR(ctx, 6, -65.4, 5, 3.8, 1.6, C.amber)
    ctx.globalAlpha = beacon * 0.5
    fillCirc(ctx, 8.5, -64, 7, C.amber)
    ctx.globalAlpha = 1
  }
  // Seat, steering wheel, windscreen.
  fillRR(ctx, -14, -22, 22, 5, 2.4, '#c8a06a')
  line(ctx, 15, -22, 10.5, -31, 1.3, '#64748b')
  fillEll(ctx, 10, -31.6, 1.4, 3.6, '#475569', -0.45)
  line(ctx, 22, -25, 20, -44, 1, alpha(C.sky, 0.6))
  // Body: a long tub with a nose, a rear deck and a stripe.
  fillRR(ctx, -37, -18, 70, 10.5, 4.5, C.white)
  fillRR(ctx, 15, -27, 18, 16, 7, C.white)
  fillRR(ctx, -37, -11.6, 70, 2.6, 1.2, color)
  fillRR(ctx, -37, -18, 70, 2.4, 1.2, shade(C.white, -0.12))
  fillCirc(ctx, 31.4, -18, 2.2, C.yellow)
  fillRR(ctx, -38.5, -22, 2.2, 6, 1, '#94a3b8')
  load()
  wheel(-22)
  wheel(21)
}

// Two golfers trundling home. Sometimes the bags go overboard one at a time
// and it all has to be done again in reverse; sometimes the golfers are on
// foot, some way behind, and a squirrel is driving.

const buggy: ActDef = {
  id: 'golf.buggy',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const u = stage.u
    const gag = chance(rng, 0.5) ? 'bags' : 'squirrel'
    const color = pick(rng, [C.forest, C.crimson, C.blue])
    const driver = GOLFERS[Math.floor(rng() * GOLFERS.length)]
    const mate = GOLFERS[(GOLFERS.indexOf(driver) + 1 + Math.floor(rng() * 3)) % GOLFERS.length]
    const bagCols = [pick(rng, [C.blue, C.plum]), pick(rng, [C.crimson, C.amber])]
    const DECK = [-26, -33] // unit x of each bag on the rear deck
    const bags = [0, 1].map(() => ({ on: true, x: 0, ft: 0, hop: 1 }))
    const dropAt = [stage.w * 0.34, stage.w * 0.52]
    const stopAt = stage.w * 0.72
    const revSpeed = Math.max(62 * u, (stage.w * 0.4) / 4)
    let x = from
    let roll = 0
    let phase: 'fwd' | 'stop' | 'rev' | 'pause' | 'away' = 'fwd'
    let pt = 0
    const chasers: Mover[] = [
      { x: from - dir * 100 * u, walk: 0, dir },
      { x: from - dir * 138 * u, walk: 2, dir },
    ]
    return makeAct({
      update(s, dt) {
        pt += dt
        const along = dir === 1 ? x : s.w - x
        const move = (v: number) => {
          x += dir * v * dt
          roll += (v * dt) / (6.5 * u)
        }
        for (const b of bags) {
          b.ft += dt
          b.hop += dt
        }
        if (gag === 'squirrel') {
          move(96 * u)
          for (const c of chasers) stepTo(c, to, 94, s, dt)
          return dir === 1 ? chasers[1].x < to : chasers[1].x > to
        }
        if (phase === 'fwd') {
          move(72 * u)
          bags.forEach((b, i) => {
            if (b.on && along > dropAt[i]) {
              b.on = false
              b.x = x + dir * DECK[i] * u
              b.ft = 0
              burst(s, 'dust', b.x, s.ground - 3 * u, 3, ['#cbd5e1'], 40, [3, 5])
            }
          })
          if (along > stopAt) {
            phase = 'stop'
            pt = 0
          }
        } else if (phase === 'stop') {
          if (pt > 1.2) phase = 'rev'
        } else if (phase === 'rev') {
          move(-revSpeed)
          for (const b of bags) {
            if (!b.on && Math.abs(x - dir * 34 * u - b.x) < 6 * u) {
              b.on = true
              b.hop = 0
            }
          }
          if (bags.every((b) => b.on)) {
            phase = 'pause'
            pt = 0
          }
        } else if (phase === 'pause') {
          if (pt > 0.7) phase = 'away'
        } else {
          move(84 * u)
          return dir === 1 ? x < to : x > to
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        // Bags lying where they fell.
        bags.forEach((b, i) => {
          if (b.on) return
          const f = clamp(b.ft / 0.45)
          at(ctx, b.x, s.ground - (1 - f * f) * 17 * u - Math.abs(Math.sin(seg(b.ft, 0.45, 0.9) * Math.PI)) * 4 * u, u, dir, () => {
            groundShadow(ctx, 14 * f, 12)
            ctx.rotate(-0.3 + f * 1.87)
            drawBag(ctx, bagCols[i], C.yellow)
          })
        })
        const moving = phase === 'fwd' || phase === 'rev' || phase === 'away'
        const bob = moving ? Math.sin(t * 13) * 0.7 : 0
        at(ctx, x, s.ground, u, dir, () => {
          ctx.translate(0, bob)
          drawBuggy(
            ctx,
            roll,
            color,
            phase === 'rev' ? (Math.floor(t * 5) % 2 === 0 ? 1 : 0.2) : 0,
            () => {
              if (gag === 'squirrel') {
                // Standing on the seat to reach the wheel.
                ctx.save()
                ctx.translate(0, -22)
                ctx.scale(1.15, 1.15)
                drawSquirrel(ctx, 0, false)
                ctx.beginPath()
                ctx.arc(8, -14.6, 5, Math.PI, Math.PI * 2)
                ctx.closePath()
                ctx.fillStyle = C.red
                ctx.fill()
                fillRR(ctx, 10, -15.6, 6, 1.6, 0.8, shade(C.red, -0.2))
                ctx.restore()
                return
              }
              const alarm = phase === 'stop'
              const rider = (who: Golfer, ox: number, isDriver: boolean) => {
                ctx.save()
                ctx.translate(ox, -9)
                ctx.scale(0.86, 0.86)
                drawGolfer(ctx, who, {
                  crouch: 0.95,
                  lean: isDriver ? 0.06 : -0.05,
                  armF: isDriver ? 1.15 : alarm ? 2.6 : 0.5,
                  elbowF: isDriver ? 0.35 : 0.5,
                  armB: isDriver ? 1.05 : 0.4,
                  headTilt: Math.sin(t * 13 + ox) * 0.03,
                  mouth: alarm ? 'o' : phase === 'rev' ? 'flat' : 'smile',
                  eyes: alarm ? 'wide' : 'normal',
                  blink: blinking(s.time, ox),
                })
                ctx.restore()
              }
              rider(mate, -10, false)
              rider(driver, 3, true)
            },
            () => {
              bags.forEach((b, i) => {
                if (!b.on) return
                ctx.save()
                ctx.translate(DECK[i], -17 - Math.sin(clamp(b.hop / 0.35) * Math.PI) * 8 + Math.sin(t * 13 + i) * 0.5)
                ctx.rotate(-0.22 - i * 0.1)
                drawBag(ctx, bagCols[i], C.yellow)
                ctx.restore()
              })
              line(ctx, -37, -24, -20, -24, 1, '#94a3b8')
            },
          )
          if (phase === 'stop' && pt > 0.3) bubble(ctx, -4 * dir, -76, '!', { color: C.crimson })
        })
        if (gag === 'squirrel') {
          chasers.forEach((c, i) => {
            at(ctx, c.x, s.ground, u, dir, () => {
              groundShadow(ctx, 0, 11)
              const who = i === 0 ? driver : mate
              const a = drawGolfer(ctx, who, {
                walk: c.walk,
                stride: 1,
                lean: 0.24,
                armF: i === 0 ? 2.5 + Math.sin(t * 11) * 0.3 : 1.6,
                elbowF: 0.3,
                mouth: 'o',
                eyes: i === 0 ? 'wide' : 'normal',
              })
              if (i === 0) drawClub(ctx, a.handF.x, a.handF.y, Math.PI - 0.4 + Math.sin(t * 11) * 0.4, 'iron', 24)
              else sweat(ctx, a.head.x, a.head.y - 8, t + 0.3)
            })
          })
        }
      },
    })
  },
}

// ─── The lost ball ───────────────────────────────────────────────────────────
// The ball bounces in and stops. He walks straight past it and searches very
// thoroughly somewhere else, until a magpie or the dog settles the matter.

const lostBall: ActDef = {
  id: 'golf.lost-ball',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const u = stage.u
    const g = pick(rng, GOLFERS)
    const gag = chance(rng, 0.5) ? 'bird' : 'dog'
    const restX = stage.w / 2 - dir * range(rng, 40, 60) * u
    const searchX = restX + dir * 92 * u
    const m: Mover = { x: from - dir * 70 * u, walk: 0, dir }
    // The thief: comes in from where the golfer came from.
    const th: Mover = { x: from, walk: 0, dir }
    let thY = 70 * u // bird height above the floor, px
    type Phase = 'arrive' | 'search' | 'thiefIn' | 'take' | 'deliver' | 'notice' | 'chase'
    let phase: Phase = 'arrive'
    let pt = 0
    let bx = restX
    let by = 0
    let held = false
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    return makeAct({
      update(s, dt, t) {
        pt += dt
        // The ball drops in from a long way off and takes three bounces.
        if (!held) {
          const T = [0.9, 1.5, 1.9, 2.15]
          const start = restX - dir * 230 * u
          bx = lerp(start, restX, easeOut(seg(t, 0, 2.6)) * 0.35 + seg(t, 0, 2.6) * 0.65)
          if (t < T[0]) by = (s.ground + 20) * (1 - (t / T[0]) * (t / T[0]))
          else if (t < T[1]) by = 4 * 34 * u * seg(t, T[0], T[1]) * (1 - seg(t, T[0], T[1]))
          else if (t < T[2]) by = 4 * 14 * u * seg(t, T[1], T[2]) * (1 - seg(t, T[1], T[2]))
          else if (t < T[3]) by = 4 * 5 * u * seg(t, T[2], T[3]) * (1 - seg(t, T[2], T[3]))
          else by = 0
        }
        if (phase === 'arrive') {
          const far = Math.abs(m.x - searchX) > 170 * u
          if (stepTo(m, searchX, far ? 78 : 42, s, dt)) {
            m.dir = dir
            go('search')
          }
        } else if (phase === 'search') {
          if (pt > 1.2) go('thiefIn')
        } else if (phase === 'thiefIn') {
          const stop = restX - dir * (gag === 'bird' ? 10 : 22) * u
          const arrived = stepTo(th, stop, gag === 'bird' ? 120 : 84, s, dt)
          if (gag === 'bird') thY = 70 * u * (1 - easeOut(clamp(1 - Math.abs(th.x - stop) / (140 * u))))
          if (arrived) {
            th.dir = dir
            thY = 0
            go('take')
          }
        } else if (phase === 'take') {
          if (crossed(pt, dt, 0.9)) held = true
          if (pt > 1.3) go(gag === 'dog' ? 'deliver' : 'notice')
        } else if (phase === 'deliver') {
          // The dog brings it over and sits, very pleased, right behind him.
          if (stepTo(th, m.x - dir * 34 * u, 70, s, dt)) {
            th.dir = dir
            go('notice')
          }
        } else if (phase === 'notice') {
          if (gag === 'bird') {
            th.x += dir * 105 * u * dt
            thY = Math.min(96 * u, thY + 62 * u * dt)
          }
          if (pt > (gag === 'bird' ? 1.5 : 2.9)) go('chase')
        } else {
          if (gag === 'bird') {
            th.x += dir * 120 * u * dt
            thY = Math.min(110 * u, thY + 20 * u * dt)
          } else stepTo(th, to + dir * 80 * u, 150, s, dt)
          const done = stepTo(m, to, 120, s, dt)
          const thiefGone = dir === 1 ? th.x > s.w + 30 * u : th.x < -30 * u
          return !(done && thiefGone)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        if (!held) at(ctx, bx, s.ground - by, u, 1, () => drawBall(ctx, 0, -2.2))
        const sees = phase === 'notice' || phase === 'chase'
        // Dog first when it is behind the golfer's legs.
        const thief = () => {
          if (phase === 'arrive' || phase === 'search') return
          if (gag === 'bird') {
            at(ctx, th.x, s.ground - thY, u, th.dir, () => {
              if (thY < 1) groundShadow(ctx, 0, 6)
              const peck = phase === 'take' ? Math.sin(seg(pt, 0.5, 0.9) * Math.PI) * 0.5 : 0
              ctx.rotate(peck)
              ctx.scale(1.25, 1.25)
              drawBird(ctx, t * 22, thY > 1, '#cbd5e1', '#f8fafc')
              if (held) drawBall(ctx, 10.4, -7.4, 1.9)
            })
          } else {
            const sitting = phase === 'notice' && pt < 2.5
            const bolting = phase === 'chase' || (phase === 'notice' && pt >= 2.5)
            at(ctx, th.x, s.ground, u, th.dir, () => {
              groundShadow(ctx, 0, 14)
              const sniff = phase === 'take' && pt < 0.9 ? Math.sin(pt * 14) * 0.12 + 0.3 : 0
              const d = drawDog(ctx, DOG, {
                run: th.walk * 1.6,
                stride: phase === 'take' || sitting ? 0 : bolting ? 1 : 0.6,
                wag: t * (sitting ? 20 : 12),
                sitting,
                tilt: sniff,
              })
              if (held) drawBall(ctx, d.mouth.x + 1.5, d.mouth.y - 0.5)
            })
          }
        }
        if (gag === 'dog') thief()
        at(ctx, m.x, s.ground, u, m.dir, () => {
          groundShadow(ctx, 0, 11)
          const blink = blinking(s.time, 8)
          let a: Anchors
          let ang = 0.5
          if (phase === 'arrive') {
            // Peering under a hand, sweeping the rough with the club.
            a = drawGolfer(ctx, g, { walk: m.walk, stride: 0.6, lean: 0.24, armF: 0.55 + Math.sin(t * 4) * 0.25, elbowF: 0.2, armB: 2.2, elbowB: 1.5, headTilt: 0.1 + Math.sin(t * 2.2) * 0.12, mouth: 'flat', blink })
            ang = 0.75 + Math.sin(t * 4) * 0.3
          } else if (!sees) {
            // Parting the grass and having a really good look.
            const d = 0.5 + Math.sin(t * 1.7) * 0.5
            a = drawGolfer(ctx, g, { crouch: 0.35 + d * 0.5, lean: 0.4 + d * 0.15, armF: 0.6 + Math.sin(t * 6) * 0.2, elbowF: 0.15, armB: 0.9, elbowB: 0.4, headTilt: 0.2, mouth: 'flat', blink })
            ang = 0.85 + Math.sin(t * 6) * 0.28
            if (phase === 'search' || (phase === 'take' && pt < 0.8)) bubble(ctx, a.head.x * m.dir, a.head.y - 18, '?')
          } else if (phase === 'notice' && gag === 'dog') {
            // Turns round, is delighted, bends to take it...
            ctx.scale(-1, 1)
            const reach = easeInOut(seg(pt, 1.5, 2.4))
            a = drawGolfer(ctx, g, {
              crouch: reach * 0.7,
              lean: reach * 0.5,
              armF: pt < 1.4 ? 2.6 : 1 + reach * 0.2,
              armB: pt < 1.4 ? -2.6 : 0.2,
              elbowF: 0.2,
              mouth: pt >= 2.5 ? 'o' : 'grin',
              eyes: pt >= 2.5 ? 'wide' : 'normal',
            })
            ang = 0.2
            drawClub(ctx, a.handB.x, a.handB.y, ang, 'iron', 26)
            return
          } else if (phase === 'notice') {
            a = drawGolfer(ctx, g, { armF: 2.9, elbowF: 0.2, armB: 0.3, lean: -0.2, headTilt: -0.35, mouth: 'o', eyes: 'wide' })
            ang = Math.PI + Math.sin(t * 16) * 0.3
            bubble(ctx, (a.head.x - 14) * m.dir, a.head.y - 12, '!', { color: C.crimson })
          } else {
            a = drawGolfer(ctx, g, { walk: m.walk, stride: 1, lean: 0.26, armF: 2.6 + Math.sin(t * 12) * 0.3, elbowF: 0.2, mouth: 'o', eyes: 'wide' })
            ang = Math.PI - 0.5 + Math.sin(t * 12) * 0.35
            sweat(ctx, a.head.x, a.head.y - 8, t)
          }
          drawClub(ctx, a.handF.x, a.handF.y, ang, 'iron', 26)
        })
        if (gag === 'bird') thief()
      },
    })
  },
}

// ─── The caddie ──────────────────────────────────────────────────────────────

/** A tour bag with everything in it. Base at (0, 0), about 66 units tall. */
function drawTourBag(ctx: Ctx, t: number, color: string, sag: number) {
  // A fan of clubs, each with its own idea of a headcover.
  const covers = [C.red, '', C.yellow, '', C.mint, '', C.pink, '', C.orange]
  for (let i = 0; i < 9; i++) {
    const a = -0.62 + i * 0.155 + Math.sin(t * 5 + i) * 0.02
    const len = 15 + ((i * 7) % 5) * 2.4
    const ex = -1 + i * 0.6 + Math.sin(a) * len
    const ey = -41 - Math.cos(a) * len
    line(ctx, -4 + i, -40, ex, ey, 1, '#cbd5e1')
    if (covers[i]) {
      fillEll(ctx, ex, ey - 1.4, 2.6, 3.3, covers[i], a)
      fillCirc(ctx, ex + Math.sin(a) * 4, ey - 1.4 - Math.cos(a) * 4, 1.3, C.white)
    } else if (i % 4 === 1) fillPoly(ctx, [ex - 0.6, ey - 2.6, ex + 4.4, ey, ex - 0.6, ey + 0.8], '#e2e8f0')
    else fillRR(ctx, ex - 1.2, ey - 1.4, 5.4, 2.4, 0.8, '#e2e8f0')
  }
  // A furled umbrella, a ball retriever, and a pin he really should put back.
  line(ctx, 7, -38, 15, -62, 2.4, C.purple)
  line(ctx, 15.4, -63, 16.6, -66.5, 1, '#fde9c9')
  line(ctx, -7, -38, -15, -60, 0.9, '#cbd5e1')
  ctx.beginPath()
  ctx.arc(-16.4, -63, 3, 0, Math.PI * 2)
  ctx.lineWidth = 0.9
  ctx.strokeStyle = C.yellow
  ctx.stroke()
  line(ctx, 3, -40, 5, -70, 1, '#f1f5f9')
  fillPoly(ctx, [5, -70, 13, -68 + Math.sin(t * 5), 4.8, -65], C.red)
  // The bag.
  fillRR(ctx, -11, -42 + sag, 22, 42 - sag, 8, color)
  fillRR(ctx, -11, -42 + sag, 5.5, 42 - sag, 2.8, shade(color, -0.16))
  fillRR(ctx, -12, -43 + sag, 24, 5.6, 2.8, shade(color, -0.3))
  fillRR(ctx, -11, -31, 22, 2.6, 0.5, C.white)
  fillRR(ctx, -11, -27, 22, 1.4, 0.5, C.gold)
  fillRR(ctx, -1, -23, 11, 12, 3, shade(color, 0.22))
  line(ctx, 1, -18, 8, -18, 0.8, shade(color, -0.4))
  fillRR(ctx, -9, -12, 7.5, 8, 2.4, shade(color, 0.22))
  fillRR(ctx, -11.6, -4.6, 23.2, 5, 2.4, shade(color, -0.35))
  // Towel, and a tin mug swinging off the side.
  fillRR(ctx, 8.6, -37, 4.6, 11, 1.2, C.white)
  line(ctx, 8.6, -32, 13.2, -32, 0.8, C.sky)
  const sw = Math.sin(t * 6) * 0.4
  line(ctx, -11, -34, -12 - Math.sin(sw) * 5, -34 + Math.cos(sw) * 5, 0.7, '#94a3b8')
  fillRR(ctx, -14.4 - Math.sin(sw) * 5, -29.6 + Math.cos(sw) * 5 - 0.6, 4.6, 4.4, 1, '#cbd5e1')
}

// A very small golfer carrying nothing, and behind him a caddie carrying
// everything. He is handed a club, considers it, and throws it back over his
// shoulder; or the bag finally wins and the caddie goes over like a beetle.

const caddie: ActDef = {
  id: 'golf.caddie',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 80)
    const u = stage.u
    const gag = chance(rng, 0.5) ? 'club' : 'topple'
    const boss = pick(rng, GOLFERS)
    const bagCol = pick(rng, [C.crimson, C.blue, C.forest])
    const hasBird = chance(rng, 0.5)
    const lad: Look = { skin: pick(rng, [C.skinA, C.skinB, C.skinC]), top: C.white, bottom: '#475569', shoe: '#e2e8f0', hair: '#b8742a', hairStyle: 'curly', hat: 'cap', hatColor: bagCol }
    const speed = clamp(stage.w / (16 * u), 44, 70)
    const GAP = 52
    const stopX = stage.w / 2 + dir * 20 * u
    const g: Mover = { x: from, walk: 0, dir }
    const c: Mover = { x: from - dir * GAP * u, walk: 0, dir }
    type Phase = 'walk' | 'ask' | 'rummage' | 'hand' | 'inspect' | 'toss' | 'clonk' | 'tip' | 'beetle' | 'back' | 'haul' | 'off'
    let phase: Phase = 'walk'
    let pt = 0
    let done = false
    let club: 'bag' | 'caddie' | 'boss' | 'air' = 'bag'
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'walk') {
          stepTo(g, to, speed, s, dt)
          stepTo(c, to, speed, s, dt)
          if (!done && (dir === 1 ? g.x >= stopX : g.x <= stopX)) {
            done = true
            go(gag === 'club' ? 'ask' : 'tip')
          }
          return dir === 1 ? c.x < to : c.x > to
        }
        if (phase === 'ask') {
          // The caddie closes up to arm's length.
          stepTo(c, g.x - dir * 30 * u, 30, s, dt)
          if (pt > 1.1) go('rummage')
        } else if (phase === 'rummage') {
          if (crossed(pt, dt, 0.9)) club = 'caddie'
          if (pt > 1.3) go('hand')
        } else if (phase === 'hand') {
          if (crossed(pt, dt, 0.5)) club = 'boss'
          if (pt > 0.8) go('inspect')
        } else if (phase === 'inspect') {
          if (pt > 1.6) {
            club = 'air'
            go('toss')
          }
        } else if (phase === 'toss') {
          if (pt > 0.8) {
            club = 'bag'
            burst(s, 'star', c.x - dir * 14 * u, s.ground - 78 * u, 5, [C.yellow, C.white], 60, [2, 4])
            go('clonk')
          }
        } else if (phase === 'clonk') {
          if (pt > 0.9) go('walk')
        } else if (phase === 'tip') {
          stepTo(g, to, speed, s, dt)
          if (pt > 1.5) {
            burst(s, 'dust', c.x - dir * 30 * u, s.ground - 3 * u, 8, ['#cbd5e1'], 70, [4, 8])
            go('beetle')
          }
        } else if (phase === 'beetle') {
          if (pt < 0.9) stepTo(g, to, speed, s, dt)
          if (pt > 2.2) go('back')
        } else if (phase === 'back') {
          if (stepTo(g, c.x + dir * 20 * u, 50, s, dt)) go('haul')
        } else if (phase === 'haul') {
          if (pt > 1) {
            g.dir = dir
            go('walk')
          }
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const walking = phase === 'walk' || phase === 'off'
        // How far over he has gone: 0 upright, 1 flat on the bag.
        const tip = phase === 'tip' ? easeIn(seg(pt, 0.5, 1.5)) : phase === 'beetle' || phase === 'back' ? 1 : phase === 'haul' ? 1 - easeInOut(seg(pt, 0.1, 0.9)) : 0
        const sag = phase === 'clonk' ? Math.sin(seg(pt, 0, 0.5) * Math.PI) : 0
        // The caddie.
        at(
          ctx,
          c.x - dir * tip * 16 * u,
          s.ground - tip * 17 * u,
          u,
          dir,
          () => {
            if (tip < 0.3) groundShadow(ctx, -6, 18)
            const wobble = Math.sin(t * 3.1) * 0.05
            const flail = phase === 'tip' ? Math.sin(pt * 22) : 0
            const kick = tip > 0.95 ? t * 13 : 0
            const reach = phase === 'rummage' ? Math.sin(seg(pt, 0, 1.3) * Math.PI) : 0
            const give = phase === 'hand' ? easeOut(seg(pt, 0, 0.4)) * (1 - seg(pt, 0.6, 0.8)) : 0
            const a = drawPerson(
              ctx,
              lad,
              {
                walk: tip > 0.95 ? kick : c.walk,
                stride: tip > 0.95 ? 0.9 : walking || phase === 'ask' ? 0.55 : 0,
                lean: 0.36 + wobble - (phase === 'tip' ? seg(pt, 0, 0.5) * 0.3 : tip > 0 ? 0.3 : 0),
                crouch: 0.22 + sag * 0.5,
                armF: phase === 'tip' || tip > 0.95 ? 2 + (phase === 'tip' ? flail : Math.sin(t * 9)) * 0.9 : 0.7 + give * 0.9,
                armB: phase === 'tip' || tip > 0.95 ? -1 + (phase === 'tip' ? -flail : Math.cos(t * 9)) * 0.9 : -0.4 - reach * 2.2,
                elbowF: 0.5 - give * 0.4,
                elbowB: reach * 0.8,
                mouth: tip > 0.1 ? 'o' : 'puff',
                eyes: tip > 0.1 || sag > 0.2 ? 'wide' : 'normal',
                blink: blinking(s.time, 9),
              },
              (b) => {
                ctx.save()
                ctx.translate(b.back.x - 7, b.back.y + 16)
                ctx.rotate(-0.3 + b.lean)
                ctx.scale(1.45, 1.45)
                drawTourBag(ctx, t, bagCol, sag * 3)
                if (hasBird && tip < 0.2) {
                  ctx.save()
                  ctx.translate(-2, -62 + Math.abs(Math.sin(t * 3.1)) * 1.5)
                  ctx.rotate(0.3 - b.lean)
                  ctx.scale(0.75, 0.75)
                  drawBird(ctx)
                  ctx.restore()
                }
                ctx.restore()
              },
            )
            if (tip < 0.1 && !sag) sweat(ctx, a.head.x, a.head.y - 8, t)
            if (club === 'caddie') drawClub(ctx, a.handF.x, a.handF.y, 1.9 + give * 0.3, 'iron', 24)
          },
          -dir * tip * 1.3,
        )
        // The golfer, three-quarter size and entirely unburdened.
        const facing = phase === 'back' || phase === 'haul' ? ((-dir) as 1 | -1) : g.dir
        at(ctx, g.x, s.ground, u * 0.74, facing, () => {
          groundShadow(ctx, 0, 11)
          const blink = blinking(s.time, 10)
          const strolling = walking || phase === 'tip' || (phase === 'beetle' && pt < 0.9)
          let a: Anchors
          if (strolling) {
            a = drawGolfer(ctx, boss, { walk: g.walk * 1.3, stride: 0.6, armF: -0.5, armB: -0.6, elbowF: -0.5, elbowB: -0.5, headTilt: -0.24, mouth: 'smile', eyes: 'closed' })
          } else if (phase === 'ask' || phase === 'rummage' || phase === 'hand') {
            // Hand held out behind, without so much as a glance.
            a = drawGolfer(ctx, boss, { armF: -0.5, elbowF: -0.5, armB: -1.35 + Math.sin(pt * 12) * (phase === 'ask' ? 0.08 : 0), elbowB: -0.1, headTilt: -0.24, mouth: 'flat', eyes: 'closed' })
            if (club === 'boss') drawClub(ctx, a.handB.x, a.handB.y, 2.6, 'iron', 30)
          } else if (phase === 'inspect') {
            a = drawGolfer(ctx, boss, { armF: 1.5, elbowF: 0.7, armB: -0.5, headTilt: 0.1 + (pt > 0.8 ? Math.sin(pt * 14) * 0.14 : 0), mouth: pt > 0.8 ? 'frown' : 'flat', blink })
            drawClub(ctx, a.handF.x, a.handF.y, 2.9, 'iron', 30)
          } else if (phase === 'toss' || phase === 'clonk') {
            a = drawGolfer(ctx, boss, { armF: phase === 'toss' ? lerp(1.5, -2.6, easeOut(seg(pt, 0, 0.25))) : -0.5, elbowF: -0.3, armB: -0.5, headTilt: -0.24, mouth: 'flat', eyes: 'closed' })
          } else if (phase === 'beetle') {
            a = drawGolfer(ctx, boss, { armF: -0.5, armB: -0.5, headTilt: 0, mouth: 'flat' })
            if (pt > 1.2) bubble(ctx, a.head.x * facing, a.head.y - 22, '...', { size: 12 })
          } else if (phase === 'back') {
            a = drawGolfer(ctx, boss, { walk: g.walk * 1.3, stride: 0.6, lean: 0.1, mouth: 'frown', blink })
          } else {
            const pull = Math.sin(seg(pt, 0, 1) * Math.PI)
            a = drawGolfer(ctx, boss, { armF: 1.4, armB: 1.2, elbowF: 0.2, lean: -pull * 0.35, crouch: pull * 0.3, mouth: 'puff', eyes: 'closed' })
            sweat(ctx, a.head.x, a.head.y - 8, t)
          }
          void a
        })
        // The rejected club, end over end, back where it came from.
        if (club === 'air') {
          const p = clamp(pt / 0.8)
          const x0 = g.x - dir * 6 * u
          const x1 = c.x - dir * 14 * u
          at(ctx, lerp(x0, x1, p), s.ground - lerp(52, 80, p) * u - 4 * 26 * u * p * (1 - p), u, dir, () => drawClub(ctx, 0, -12, p * 11, 'iron', 24))
        }
      },
    })
  },
}

export const GOLF_ACTS: ActDef[] = [teeShot, putt, bunker, buggy, lostBall, caddie]
