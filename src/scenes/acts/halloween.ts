import { DOG, drawDog } from '../creatures'
import { C, TAU, at, bounce, clamp, easeBack, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, star, type Ctx } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { drawPerson, type Anchors, type Look, type Pose } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, AmbientDef, Stage } from '../types'

// Halloween week, 25 to 31 October. Spooky in the way a school play is spooky:
// everybody is smiling, nothing has teeth worth worrying about, and whatever
// tries to be frightening comes off worst.

export const HALLOWEEN_LEAVES = ['#f59e0b', '#ea7317', '#fb923c', '#c2571d', '#7a3a12', '#8b5cf6', '#7c4dbd', '#5b3a6b', '#a16207']

export const HALLOWEEN_AMBIENT: AmbientDef = {
  kind: 'leaf',
  colors: HALLOWEEN_LEAVES,
  rate: 2,
  flurry: [20, 16],
  settle: true,
  pile: 'items',
  maxPile: 12,
  size: [4, 7],
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

const SWEETS = [C.pink, C.yellow, C.mint, C.red, C.purple, C.sky]
const BONE = '#ece8d9'
const BONE_DK = '#b9b4a0'
const FUR = '#5a4d85' // the "black" cat: dark enough to be one, light enough to see
const PUMPKIN = '#fb8a2c'

const past = (x: number, target: number, dir: 1 | -1) => (dir === 1 ? x >= target : x <= target)
const flip = (d: 1 | -1): 1 | -1 => (d === 1 ? -1 : 1)
/** The x that is fraction `f` of the way across, measured from the side the act came in on. */
const along = (s: Stage, dir: 1 | -1, f: number) => (dir === 1 ? s.w * f : s.w * (1 - f))

/** A speech bubble that reads the right way round whichever way the speaker faces. */
function say(s: Stage, x: number, up: number, text: string, opts?: { color?: string; bg?: string; size?: number }) {
  at(s.ctx, x, s.ground, s.u, 1, () => bubble(s.ctx, 0, -up, text, opts))
}

const WITCH: Look = {
  skin: '#b5d88a', top: '#7c4dbd', bottom: '#4c3a78', shoe: '#3a2d5c', hair: '#f97316', hairStyle: 'long',
  hat: 'witch', hatColor: '#6a45a8', hatTrim: C.orange,
}

/** A crooked little witch hat for things that are not people. Brim centre at (x, y). */
function miniWitchHat(ctx: Ctx, x: number, y: number, k: number, col = '#6a45a8', trim: string = C.orange) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  fillEll(ctx, 0, 0, 8, 1.9, shade(col, -0.15), -0.08)
  fillPoly(ctx, [-4.6, -0.4, -1.6, -8, -4.2, -12.5, 2, -9, 4.6, -0.6], col)
  line(ctx, -3.5, -2.6, 3.8, -2.8, 1.7, trim)
  fillRR(ctx, -0.6, -3.8, 2.2, 2.2, 0.4, C.gold)
  ctx.restore()
}

/** A besom: handle from (x1, y1) to the binding at (x2, y2), twigs fanning on past it. */
function drawBroom(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, splay = 0) {
  line(ctx, x1, y1, x2, y2, 2, '#b07a3a')
  ctx.save()
  ctx.translate(x2, y2)
  ctx.rotate(Math.atan2(y2 - y1, x2 - x1))
  fillPoly(ctx, [0, -2.4, 12, -5.5 - splay, 13.5, 0, 12, 5.5 + splay, 0, 2.4], '#e3b341')
  for (let i = -2; i <= 2; i++) line(ctx, 2.5, i * 0.9, 12, i * (2.3 + splay * 0.4), 0.7, '#b8862a')
  fillRR(ctx, -1, -2.9, 3.4, 5.8, 1, C.rust)
  ctx.restore()
}

interface CatPose {
  run?: number
  stride?: number
  sit?: boolean
  wide?: boolean
  time?: number
}

/** A black cat, about 24 units long. Sits with its tail wrapped round, trots with it up. */
function drawCat(ctx: Ctx, p: CatPose = {}) {
  const run = p.run ?? 0
  const stride = p.stride ?? 0
  const t = p.time ?? 0
  const hi = shade(FUR, 0.18)
  const dk = shade(FUR, -0.18)
  const sway = Math.sin(t * 3)
  let hx = 10
  let hy = -14
  if (p.sit) {
    poly(ctx, [-4, -2, -9, -2.5, -11, -8 + sway], 2.6, FUR)
    fillEll(ctx, -1, -7, 6.2, 7.4, FUR, 0.15)
    fillEll(ctx, 0.5, -5.5, 3.2, 4.6, hi, 0.15)
    line(ctx, 3, -7, 3.6, -0.8, 2.6, FUR)
    line(ctx, 0.6, -6, 1, -0.8, 2.6, dk)
    hx = 3.5
    hy = -17
  } else {
    const hop = Math.abs(Math.sin(run)) * 1.6 * stride
    ctx.save()
    ctx.translate(0, -hop)
    poly(ctx, [-9, -10, -14, -15, -13 + sway * 2, -23], 2.4, FUR)
    const leg = (x: number, ph: number, far: boolean) => {
      const a = Math.sin(run + ph) * 0.8 * stride
      line(ctx, x, -7, x + Math.sin(a) * 7, Math.min(hop, -7 + Math.cos(a) * 7 + hop * 0.4), 2.4, far ? dk : FUR)
    }
    leg(-7, Math.PI, true)
    leg(6, 0.5, true)
    fillEll(ctx, 0, -9.5, 10, 4.6, FUR)
    fillEll(ctx, 1, -8, 6, 2, hi)
    leg(-8.5, 0, false)
    leg(7.5, Math.PI + 0.5, false)
    ctx.restore()
    hy -= hop
  }
  // Head: two sharp ears, lamp-yellow eyes, pink nose, whiskers.
  fillPoly(ctx, [hx - 4.6, hy - 2.5, hx - 4, hy - 8.5, hx - 0.6, hy - 4.4], FUR)
  fillPoly(ctx, [hx + 0.6, hy - 4.6, hx + 3.6, hy - 8.8, hx + 4.8, hy - 2.4], FUR)
  fillPoly(ctx, [hx + 1.8, hy - 4.6, hx + 3.4, hy - 7, hx + 4, hy - 3.6], C.pink)
  fillCirc(ctx, hx, hy, 5.3, FUR)
  const er = p.wide ? 1.9 : 1.4
  fillEll(ctx, hx + 0.4, hy - 0.8, er, er * (p.wide ? 1 : 0.85), C.yellow)
  fillEll(ctx, hx + 3.8, hy - 0.8, er * 0.9, er * (p.wide ? 1 : 0.85), C.yellow)
  fillEll(ctx, hx + 0.7, hy - 0.8, p.wide ? 1 : 0.45, er * 0.8, C.ink)
  fillEll(ctx, hx + 4, hy - 0.8, p.wide ? 0.9 : 0.4, er * 0.8, C.ink)
  fillPoly(ctx, [hx + 4.4, hy + 1.2, hx + 6, hy + 1.2, hx + 5.2, hy + 2.3], C.pink)
  ctx.globalAlpha = 0.6
  line(ctx, hx + 4.4, hy + 2, hx + 9, hy + 1, 0.5, C.white)
  line(ctx, hx + 4.4, hy + 2.6, hx + 9, hy + 3.4, 0.5, C.white)
  ctx.globalAlpha = 1
}

/** A small bat, origin at the middle of its body, about 28 units wingtip to wingtip. */
function drawBat(ctx: Ctx, flap: number, o: { perched?: boolean; wide?: boolean } = {}) {
  const wing = '#7256b8'
  const body = '#8f74d4'
  if (o.perched) {
    fillEll(ctx, -4, 1, 2.6, 5, wing, 0.25)
    fillEll(ctx, 4, 1, 2.6, 5, wing, -0.25)
  } else {
    const w = Math.sin(flap) * 6
    for (const sd of [-1, 1]) {
      fillPoly(
        ctx,
        [3 * sd, -2, 8 * sd, -6 - w * 0.6, 14 * sd, -3.5 - w, 11.5 * sd, 1 - w * 0.6, 9 * sd, -1 - w * 0.5, 6.5 * sd, 2.5 - w * 0.3, 4.5 * sd, 0.5, 3 * sd, 2],
        wing,
      )
      line(ctx, 3 * sd, -1.5, 8 * sd, -6 - w * 0.6, 0.8, shade(wing, 0.25))
    }
  }
  fillPoly(ctx, [-3.6, -3, -3.2, -8, -0.8, -4.4], body)
  fillPoly(ctx, [3.6, -3, 3.2, -8, 0.8, -4.4], body)
  fillEll(ctx, 0, 0, 4.2, 4.8, body)
  fillEll(ctx, 0, 1.6, 2.4, 2.4, shade(body, 0.2))
  const er = o.wide ? 1.7 : 1.2
  fillCirc(ctx, -1.7, -1.2, er, C.white)
  fillCirc(ctx, 1.7, -1.2, er, C.white)
  fillCirc(ctx, -1.5, -1.1, er * 0.5, C.ink)
  fillCirc(ctx, 1.9, -1.1, er * 0.5, C.ink)
  // A smile with two very small fangs.
  ctx.beginPath()
  ctx.arc(0, 0.8, 1.9, Math.PI * 0.15, Math.PI * 0.85)
  ctx.lineWidth = 0.7
  ctx.lineCap = 'round'
  ctx.strokeStyle = C.ink
  ctx.stroke()
  fillPoly(ctx, [-1.2, 2.2, -0.4, 2.5, -0.9, 3.5], C.white)
  fillPoly(ctx, [1.2, 2.2, 0.4, 2.5, 0.9, 3.5], C.white)
}

/** A plastic pumpkin bucket hanging from a hand at (x, y). */
function drawBucket(ctx: Ctx, x: number, y: number, full = true) {
  ctx.beginPath()
  ctx.arc(x, y + 3.4, 3.6, Math.PI, TAU)
  ctx.lineWidth = 0.9
  ctx.strokeStyle = C.grey
  ctx.stroke()
  if (full) {
    fillCirc(ctx, x - 1.8, y + 3, 1.5, C.pink)
    fillCirc(ctx, x + 1.4, y + 2.6, 1.5, C.mint)
    fillCirc(ctx, x + 0.2, y + 2.2, 1.3, C.yellow)
  }
  fillPoly(ctx, [x - 4.6, y + 3.4, x + 4.6, y + 3.4, x + 3.5, y + 10.4, x - 3.5, y + 10.4], PUMPKIN)
  fillRR(ctx, x - 4.8, y + 3, 9.6, 1.6, 0.8, shade(PUMPKIN, -0.2))
  fillCirc(ctx, x - 1.6, y + 6.2, 0.8, '#6b2a0c')
  fillCirc(ctx, x + 1.6, y + 6.2, 0.8, '#6b2a0c')
  line(ctx, x - 1.6, y + 8.2, x + 1.6, y + 8.2, 0.8, '#6b2a0c')
}

// ─── Costumes ────────────────────────────────────────────────────────────────

type Costume = 'sheet' | 'pumpkin' | 'wizard' | 'vampire'

const COSTUME: Record<Costume, Look> = {
  sheet: { skin: C.skinA, top: '#e8ecf3', bottom: '#e8ecf3', shoe: C.red },
  pumpkin: { skin: C.skinA, top: C.orange, bottom: '#2f7d4f', shoe: '#1f5136', hair: '#b8742a', hat: 'cap', hatColor: '#3c9a62', hatTrim: '#8b5a2b' },
  wizard: { skin: C.skinB, top: '#5b6ee1', bottom: '#4453b8', shoe: '#2c3570', hair: '#2a1a10', hat: 'witch', hatColor: '#5b6ee1', hatTrim: C.gold },
  vampire: { skin: '#f3e3d3', top: '#e8ecf3', bottom: '#4a3f6b', shoe: '#2f2944', hair: '#3a3352' },
}

/** A child in costume, with a pumpkin bucket. Scale it down with `at()`. */
function drawTreater(ctx: Ctx, c: Costume, pose: Pose, o: { bucket?: boolean; full?: boolean; askew?: number } = {}): Anchors {
  const look = COSTUME[c]
  const flap = Math.sin((pose.walk ?? 0) * 1.2) * 2.5 * (pose.stride ?? 0)
  const cape = (col: string) => (a: Anchors) => {
    fillPoly(ctx, [a.shoulder.x - 3, a.shoulder.y - 2, a.shoulder.x + 4, a.shoulder.y - 1, a.hip.x - 1, a.hip.y + 2, a.hip.x - 15 - flap, a.hip.y + 9, a.hip.x - 12, a.hip.y - 6], col)
  }
  const behind = c === 'wizard' ? cape('#8b5cf6') : c === 'vampire' ? cape('#6a45a8') : undefined
  const a = drawPerson(ctx, look, pose, behind)
  const s = a.shoulder
  if (c === 'wizard') {
    star(ctx, a.hip.x + 2 + Math.sin(a.lean) * 8, a.hip.y - 8, 3, C.gold, 0.2)
    star(ctx, a.crown.x - 1, a.crown.y - 3, 1.8, C.gold)
  } else if (c === 'vampire') {
    // Stand-up collar with a red lining, a medallion, and plastic fangs.
    fillPoly(ctx, [s.x - 8, s.y + 2, s.x - 11, s.y - 9, s.x - 2, s.y - 2], C.crimson)
    fillPoly(ctx, [s.x + 2, s.y - 1, s.x + 8, s.y - 6, s.x + 7, s.y + 3], '#6a45a8')
    fillCirc(ctx, a.hip.x + 3 + Math.sin(a.lean) * 10, a.hip.y - 10, 1.8, C.gold)
    fillPoly(ctx, [a.mouth.x - 2.6, a.mouth.y + 0.6, a.mouth.x - 1.4, a.mouth.y + 0.6, a.mouth.x - 2, a.mouth.y + 2.6], C.white)
    fillPoly(ctx, [a.mouth.x + 0.2, a.mouth.y + 0.4, a.mouth.x + 1.4, a.mouth.y + 0.4, a.mouth.x + 0.8, a.mouth.y + 2.4], C.white)
  } else if (c === 'pumpkin') {
    // A padded pumpkin suit, round as a beach ball, with the face on the tummy.
    const cx = a.hip.x + Math.sin(a.lean) * 9
    const cy = a.hip.y - 9
    fillEll(ctx, cx, cy, 12.5, 11, shade(PUMPKIN, -0.14))
    fillEll(ctx, cx + 1, cy, 8, 11, PUMPKIN)
    fillEll(ctx, cx + 2, cy, 3.4, 10.6, shade(PUMPKIN, 0.12))
    fillPoly(ctx, [cx + 1, cy - 2, cx + 3, cy - 5.5, cx + 5, cy - 2], '#6b2a0c')
    fillPoly(ctx, [cx + 6.5, cy - 2, cx + 8.2, cy - 5.5, cx + 10, cy - 2], '#6b2a0c')
    ctx.beginPath()
    ctx.moveTo(cx, cy + 2)
    ctx.quadraticCurveTo(cx + 5.5, cy + 8, cx + 11, cy + 2)
    ctx.quadraticCurveTo(cx + 5.5, cy + 4.5, cx, cy + 2)
    ctx.fillStyle = '#6b2a0c'
    ctx.fill()
    poly(ctx, [s.x, s.y, a.elbowF.x, a.elbowF.y, a.handF.x, a.handF.y], 4.4, shade(C.orange, -0.1))
    fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
    // The stalk on the cap.
    poly(ctx, [a.crown.x, a.crown.y - 2, a.crown.x + 1, a.crown.y - 6], 2.4, '#8b5a2b')
  } else {
    // An old bedsheet with two holes cut in it, and it is far too long.
    const h = a.head
    const ask = o.askew ?? 0
    const hem = -8
    ctx.beginPath()
    ctx.arc(h.x, h.y, 12.6, Math.PI, TAU)
    ctx.lineTo(h.x + 14 + flap * 0.4, hem)
    ctx.quadraticCurveTo(h.x + 9, hem + 4, h.x + 5, hem)
    ctx.quadraticCurveTo(h.x, hem + 4.5, h.x - 5, hem + 0.5)
    ctx.quadraticCurveTo(h.x - 10, hem + 5, h.x - 15 - flap, hem + 2)
    ctx.closePath()
    ctx.fillStyle = '#eef2f7'
    ctx.fill()
    fillRR(ctx, h.x - 12.6, h.y - 1, 4.4, hem - h.y - 1, 2.2, '#cfd8e6')
    line(ctx, h.x + 2, h.y + 14, h.x + 3, hem - 3, 0.8, '#cfd8e6')
    const ex = h.x - ask * 6
    const ey = h.y - 1 + ask * 3
    fillEll(ctx, ex + 3.2, ey, 2, 2.8, C.ink, ask * 0.4)
    fillEll(ctx, ex + 8.6, ey, 1.8, 2.6, C.ink, ask * 0.4)
    fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
  }
  if (o.bucket) drawBucket(ctx, a.handF.x, a.handF.y, o.full ?? true)
  return a
}

// ─── The witch and the leaves ────────────────────────────────────────────────
// She sweeps the floor from one side to the other, with the cat either riding
// the broom head like a tram or trotting along behind. Half the time she loses
// patience, hops on, and does the rest of it at speed from thirty units up. If
// the cat was walking, nobody told the cat.

const witchSweep: ActDef = {
  id: 'halloween.witch-sweep',
  weight: 3,
  clears: true,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const flies = chance(rng, 0.5)
    const catRides = chance(rng, 0.5)
    const giveUpAt = stage.w * range(rng, 0.28, 0.48)
    let x = from
    let walk = 0
    let phase: 'sweep' | 'huff' | 'fly' = 'sweep'
    let pt = 0
    let catX = from - dir * 36 * stage.u
    let catRun = 0
    let catMode: 'trot' | 'stare' | 'chase' = 'trot'
    let catWait = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const tick = (hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
        if (phase === 'sweep') {
          x += dir * 46 * s.u * dt
          walk += dt * 8
          // A broom only flicks them a little way: low and forwards.
          s.particles.blast(x + dir * 30 * s.u, 13 * s.u, dir, 105 * s.u)
          if (tick(5)) burst(s, 'dust', x + dir * 32 * s.u, s.ground - 2 * s.u, 1, ['#cbd5e1'], 30, [3, 6])
          const travelled = dir === 1 ? x : s.w - x
          if (flies && travelled > giveUpAt) {
            phase = 'huff'
            pt = 0
          }
        } else if (phase === 'huff') {
          if (pt > 2) {
            phase = 'fly'
            pt = 0
            burst(s, 'star', x, s.ground - 10 * s.u, 6, [C.purple, C.gold], 60, [2, 3.5])
          }
        } else {
          x += dir * lerp(40, 180, easeOut(seg(pt, 0, 1.2))) * s.u * dt
          // The wake pulls the leaves up and back after her.
          s.particles.blast(x - dir * 12 * s.u, 26 * s.u, -dir * 0.35, 200 * s.u)
        }
        if (!catRides) {
          if (catMode === 'trot') {
            if (phase === 'sweep') {
              catX += dir * 46 * s.u * dt
              catRun += dt * 12
            } else if (phase === 'fly') {
              catMode = 'stare'
              catWait = 1.1
            }
          } else if (catMode === 'stare') {
            catWait -= dt
            if (catWait <= 0) catMode = 'chase'
          } else {
            catX += dir * 210 * s.u * dt
            catRun += dt * 22
          }
        }
        return !(past(x, to, dir) && (catRides || past(catX, to, dir)))
      },
      draw(s, t) {
        const { ctx } = s
        const blink = blinking(s.time, 2)
        if (!catRides) {
          at(ctx, catX, s.ground, s.u * 0.85, dir, () => {
            groundShadow(ctx, 0, 9)
            const sitting = phase === 'huff' || catMode === 'stare'
            drawCat(ctx, { run: catRun, stride: catMode === 'chase' ? 1 : sitting ? 0 : 0.6, sit: sitting, wide: catMode !== 'trot', time: t })
          })
          if (catMode === 'stare' && catWait < 0.7) say(s, catX, 30, '!', { size: 9 })
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          if (phase === 'fly') {
            const lift = easeOut(seg(pt, 0, 0.9)) * 30 + Math.sin(t * 4) * 2.5
            groundShadow(ctx, 0, 12, 0.14)
            drawPerson(
              ctx,
              WITCH,
              { crouch: 0.9, lean: 0.3, lift, armF: 1.3, elbowF: 0.2, armB: 1.1, elbowB: 0.3, mouth: 'grin', blink },
              (a) => {
                drawBroom(ctx, a.hip.x + 30, a.hip.y - 1, a.hip.x - 20, a.hip.y + 4, 1)
                if (catRides) {
                  ctx.save()
                  ctx.translate(a.hip.x - 25, a.hip.y + 2)
                  ctx.scale(0.85, 0.85)
                  drawCat(ctx, { sit: true, wide: true, time: t * 3 })
                  ctx.restore()
                }
              },
            )
            speedLines(ctx, -38, -lift - 14, 16, t)
            return
          }
          groundShadow(ctx, 0, 11)
          const huff = phase === 'huff'
          const rx = 25 + Math.sin(t * 6) * 6
          const a = drawPerson(ctx, WITCH, {
            walk,
            stride: huff ? 0 : 0.6,
            armF: huff ? 0.7 : 0.95,
            elbowF: huff ? 1.3 : 0.4,
            armB: huff ? 0.2 : 0.55,
            elbowB: huff ? 0.3 : 0.9,
            lean: huff ? -0.04 : 0.12,
            mouth: huff ? 'puff' : 'flat',
            eyes: huff && pt > 0.5 && pt < 1.3 ? 'closed' : 'normal',
            blink,
          })
          if (huff) {
            // Broom stood on end while she gets her breath back and has a think.
            drawBroom(ctx, a.handF.x + 1, a.handF.y - 24, a.handF.x + 1, -13)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, WITCH.skin)
            if (pt < 1.3) sweat(ctx, a.head.x, a.head.y - 8, t)
          } else {
            drawBroom(ctx, a.handB.x - 5, a.handB.y - 9, rx, -3.5)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.7, WITCH.skin)
          }
          if (catRides) {
            ctx.save()
            if (huff) ctx.translate(26, 0)
            else ctx.translate(rx + 7, -5 - Math.abs(Math.sin(t * 6)) * 1.5)
            ctx.scale(0.85, 0.85)
            drawCat(ctx, { sit: true, time: t })
            ctx.restore()
          }
        })
        if (phase === 'huff' && pt > 1.2) say(s, x, 78, '!', { color: C.plum })
      },
    })
  },
}

// ─── The ghost who says boo ──────────────────────────────────────────────────
// A small ghost follows a trick-or-treater at head height, waits until they
// stop to count their sweets, and says boo. It works about half the time. The
// other half the child turns round, quite unbothered, and offers it a toffee,
// and the ghost goes pink all over.

function drawGhost(ctx: Ctx, t: number, o: { mood?: 'calm' | 'boo' | 'giggle'; blush?: number; sweet?: string } = {}) {
  const mood = o.mood ?? 'calm'
  const blush = o.blush ?? 0
  ctx.globalAlpha = 0.94
  ctx.beginPath()
  ctx.arc(0, -4, 11, Math.PI, TAU)
  ctx.lineTo(11, 11)
  for (let i = 0; i < 4; i++) {
    const x0 = 11 - i * 5.5
    const dip = 3 + Math.sin(t * 5 + i * 1.7) * 1.6
    ctx.quadraticCurveTo(x0 - 2.75, 11 + dip, x0 - 5.5, 11 - (i === 3 ? 0 : 1))
  }
  ctx.closePath()
  ctx.fillStyle = '#f1f4fb'
  ctx.fill()
  fillRR(ctx, -11, -4, 4, 13, 2, '#d4dcec')
  if (blush > 0) {
    ctx.globalAlpha = blush * 0.3
    fillEll(ctx, 1, 0, 10, 10, C.pink)
    ctx.globalAlpha = blush * 0.85
    fillEll(ctx, 0.5, -0.5, 2.6, 1.7, C.rose)
    fillEll(ctx, 9, -0.5, 2, 1.6, C.rose)
  }
  ctx.globalAlpha = 1
  // Stubby arms: up for the boo, out in front otherwise.
  if (mood === 'boo') {
    fillEll(ctx, 11, -11, 3, 4.4, '#f1f4fb', 0.5)
    fillEll(ctx, -9, -12, 3, 4.4, '#d4dcec', -0.5)
  } else {
    fillEll(ctx, 11.5, 3, 4, 2.6, '#f1f4fb', 0.3)
  }
  if (o.sweet) {
    fillCirc(ctx, 15.5, 3.6, 2, o.sweet)
    fillPoly(ctx, [17, 3.6, 19.4, 2, 19.4, 5.2], o.sweet)
  }
  if (mood === 'giggle') {
    for (const ex of [3, 8]) {
      ctx.beginPath()
      ctx.arc(ex, -4.6, 1.7, Math.PI * 1.1, Math.PI * 1.9)
      ctx.lineWidth = 1.1
      ctx.lineCap = 'round'
      ctx.strokeStyle = C.ink
      ctx.stroke()
    }
    fillEll(ctx, 5.6, 1, 2.6, 1.8, C.ink)
  } else {
    const big = mood === 'boo' ? 1.4 : 1
    fillEll(ctx, 3, -5, 1.8 * big, 2.5 * big, C.ink)
    fillEll(ctx, 8, -5, 1.6 * big, 2.3 * big, C.ink)
    fillCirc(ctx, 3.5, -5.8, 0.6, C.white)
    fillCirc(ctx, 8.4, -5.8, 0.5, C.white)
    if (mood === 'boo') fillEll(ctx, 5.8, 2.4, 2.8, 3.6, C.ink)
    else {
      ctx.beginPath()
      ctx.arc(5.6, 0, 2.6, Math.PI * 0.15, Math.PI * 0.85)
      ctx.lineWidth = 1
      ctx.lineCap = 'round'
      ctx.strokeStyle = C.ink
      ctx.stroke()
    }
  }
}

const ghostBoo: ActDef = {
  id: 'halloween.ghost-boo',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const brave = chance(rng, 0.5)
    const costume = pick(rng, ['pumpkin', 'wizard', 'vampire'] as const)
    const sweet = pick(rng, SWEETS)
    const spot = along(stage, dir, range(rng, 0.32, 0.45))
    const K = 0.8
    let x = from
    let walk = 0
    let gx = from - dir * 120 * stage.u
    let phase: 'in' | 'count' | 'boo' | 'jump' | 'flee' | 'turn' | 'offer' | 'friends' = 'in'
    let pt = 0
    let blush = 0
    let given = false
    return makeAct({
      update(s, dt) {
        pt += dt
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        const creep = (target: number, speed: number) => {
          if (!past(gx, target, dir)) gx += dir * speed * s.u * dt
        }
        if (phase === 'in') {
          x += dir * 62 * s.u * dt
          walk += dt * 11
          creep(x - dir * 70 * s.u, 66)
          if (past(x, spot, dir)) next('count')
        } else if (phase === 'count') {
          creep(x - dir * 36 * s.u, 60)
          if (past(gx, x - dir * 37 * s.u, dir) && pt > 1) next('boo')
        } else if (phase === 'boo') {
          if (pt > 0.9) {
            if (brave) next('turn')
            else {
              next('jump')
              // Up go the sweets.
              for (let i = 0; i < 12; i++) {
                s.particles.emit({
                  kind: 'confetti',
                  x: x + dir * 10 * s.u,
                  y: s.ground - 22 * s.u,
                  vx: range(rng, -70, 70) * s.u,
                  vy: -range(rng, 90, 190) * s.u,
                  g: 330,
                  sway: 0,
                  vr: range(rng, -8, 8),
                  size: range(rng, 3, 4.5) * s.u,
                  color: pick(rng, SWEETS),
                  life: 2.4,
                })
              }
            }
          }
        } else if (phase === 'jump') {
          if (pt > 0.7) next('flee')
        } else if (phase === 'flee') {
          x += dir * 150 * s.u * dt
          walk += dt * 20
          // The ghost has a good laugh, then drifts off after its sheet-less friend.
          if (pt > 1.5) gx += dir * 90 * s.u * dt
          return !past(gx, to, dir)
        } else if (phase === 'turn') {
          if (pt > 1) next('offer')
        } else if (phase === 'offer') {
          blush = clamp(blush + dt * 1.4)
          if (!given && pt > 1.1) {
            given = true
            for (let i = 0; i < 3; i++) s.particles.emit({ kind: 'heart', x: gx + range(rng, -6, 6) * s.u, y: s.ground - 52 * s.u, size: 3.2 * s.u, color: C.rose, life: 1.8 + i * 0.3 })
          }
          if (pt > 2.6) next('friends')
        } else {
          x += dir * 62 * s.u * dt
          walk += dt * 11
          creep(x - dir * 32 * s.u, 70)
          return !past(gx, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const facing = phase === 'turn' || phase === 'offer' ? flip(dir) : dir
        const jump = phase === 'jump' ? Math.sin(seg(pt, 0, 0.6) * Math.PI) * 16 : 0
        const still = phase !== 'in' && phase !== 'flee' && phase !== 'friends'
        at(ctx, x, s.ground, s.u * K, facing, () => {
          groundShadow(ctx, 0, 11 - jump * 0.2)
          const offering = phase === 'offer' && !given
          const a = drawTreater(
            ctx,
            costume,
            {
              walk,
              stride: still ? 0 : phase === 'flee' ? 1 : 0.8,
              lean: phase === 'flee' ? 0.3 : 0,
              lift: jump,
              armF: offering ? 1.5 : phase === 'jump' ? 2.6 : phase === 'flee' ? undefined : 0.55,
              elbowF: offering ? 0.2 : phase === 'flee' ? undefined : 0.6,
              armB: phase === 'jump' ? -2.4 : undefined,
              headTilt: phase === 'count' ? 0.35 : 0,
              mouth: phase === 'jump' || phase === 'flee' ? 'o' : phase === 'turn' || phase === 'offer' || phase === 'friends' ? 'grin' : 'smile',
              eyes: phase === 'jump' || phase === 'flee' ? 'wide' : 'normal',
              blink: blinking(s.time, 4),
            },
            { bucket: !offering, full: brave || (phase !== 'jump' && phase !== 'flee') },
          )
          if (offering) {
            drawBucket(ctx, a.handB.x, a.handB.y)
            fillCirc(ctx, a.handF.x + 2.5, a.handF.y - 1, 2.2, sweet)
            fillPoly(ctx, [a.handF.x + 4, a.handF.y - 1, a.handF.x + 6.6, a.handF.y - 2.8, a.handF.x + 6.6, a.handF.y + 0.8], sweet)
          }
        })
        // The ghost: wobbles as it drifts, shoots up for the boo, shakes when it laughs.
        const laugh = phase === 'jump' || (phase === 'flee' && pt < 1.5)
        const rise = phase === 'boo' ? easeBack(seg(pt, 0, 0.3)) * 7 : 0
        const gy = s.ground - (36 + Math.sin(t * 2.6) * 3 + rise + (laugh ? Math.abs(Math.sin(t * 16)) * 2 : 0)) * s.u
        at(
          ctx,
          gx,
          gy,
          s.u * 0.9,
          dir,
          () => drawGhost(ctx, t, { mood: phase === 'boo' ? 'boo' : laugh ? 'giggle' : 'calm', blush, sweet: given ? sweet : undefined }),
          Math.sin(t * 1.9) * 0.1,
        )
        if (phase === 'boo' && pt > 0.15) say(s, gx - dir * 4 * s.u, 58, 'boo!', { size: 11 })
        if (phase === 'turn' && pt > 0.35) say(s, x, 62, '?', { size: 10 })
      },
    })
  },
}

// ─── Trick-or-treaters ───────────────────────────────────────────────────────
// Three in a line, tallest first. The smallest is under a bedsheet made for a
// much bigger ghost, and goes flat on their face every few yards, then gets up
// with the eye holes round the side and runs to catch up. Sometimes the dog
// has been allowed to come, on condition that it wears the hat.

const trickOrTreat: ActDef = {
  id: 'halloween.trick-or-treaters',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const lead: Costume = chance(rng, 0.5) ? 'wizard' : 'vampire'
    const dogKit = pick(rng, ['none', 'hat', 'cape'] as const)
    const speed = 52
    let x = from
    let walk = 0
    let sx = from - dir * 64 * stage.u
    let sWalk = 0
    let small: 'walk' | 'down' | 'catch' = 'walk'
    let st = 0
    let nextTrip = range(rng, 2.2, 3.4)
    let askew = 0
    let dogX = from - dir * 104 * stage.u
    let dogRun = 0
    let dogStride = 0
    return makeAct({
      update(s, dt) {
        x += dir * speed * s.u * dt
        walk += dt * 9.5
        st += dt
        askew = Math.max(0, askew - dt * 0.45)
        const slot = x - dir * 64 * s.u
        if (small === 'walk') {
          sx = slot
          sWalk += dt * 10
          nextTrip -= dt
          if (nextTrip <= 0 && sx > 40 && sx < s.w - 40) {
            small = 'down'
            st = 0
          }
        } else if (small === 'down') {
          if (st > 0.28 && st - dt <= 0.28) burst(s, 'dust', sx + dir * 14 * s.u, s.ground - 2 * s.u, 5, ['#cbd5e1'], 45, [4, 7])
          if (st > 1.7) {
            small = 'catch'
            askew = 1
          }
        } else {
          sx += dir * 118 * s.u * dt
          sWalk += dt * 19
          if (past(sx, slot, dir)) {
            small = 'walk'
            nextTrip = range(rng, 2.8, 4.6)
          }
        }
        // The dog keeps a length behind the littlest one, and waits when they go down.
        const step = Math.min(120 * s.u * dt, Math.max(0, dir * (sx - dir * 40 * s.u - dogX)))
        dogX += dir * step
        dogRun += step / (4.4 * s.u)
        dogStride = clamp(step / dt / (70 * s.u), 0, 0.9)
        return !past(dogKit === 'none' ? sx : dogX, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        if (dogKit !== 'none') {
          at(ctx, dogX, s.ground, s.u * 0.9, dir, () => {
            groundShadow(ctx, 0, 14)
            const hop = Math.abs(Math.sin(dogRun)) * 2.2 * dogStride
            const d = drawDog(ctx, DOG, { run: dogRun, stride: dogStride, wag: t * 13, tilt: dogStride < 0.1 ? 0.25 : 0 })
            if (dogKit === 'hat') miniWitchHat(ctx, 14, -26.5 - hop, 0.95)
            else {
              const f = Math.sin(t * 7) * 1.5
              fillPoly(ctx, [8, -20 - hop, -12, -21 - hop, -19 - f, -11 - hop, -6, -15 - hop], C.plum)
              fillPoly(ctx, [8, -20 - hop, 4, -24 - hop, 1, -20 - hop], C.crimson)
            }
            drawBucket(ctx, d.mouth.x + 1, d.mouth.y - 2)
          })
        }
        // The smallest, at the back.
        const fall = small === 'down' ? easeIn(seg(st, 0, 0.28)) * (1 - easeInOut(seg(st, 1.25, 1.7))) : 0
        at(
          ctx,
          sx,
          s.ground,
          s.u * 0.62,
          dir,
          () => {
            groundShadow(ctx, fall * 16, 10 + fall * 10)
            drawTreater(
              ctx,
              'sheet',
              {
                walk: sWalk,
                stride: small === 'down' ? 0 : small === 'catch' ? 1 : 0.75,
                lean: small === 'catch' ? 0.25 : 0,
                armF: 1 + fall * 1.4,
                elbowF: 0.5,
              },
              { bucket: true, askew },
            )
          },
          dir * fall * 1.45,
        )
        if (small === 'down' && st > 0.5 && st < 1.3) say(s, sx + dir * 20 * s.u, 20, 'oof', { size: 9 })
        at(ctx, x - dir * 34 * s.u, s.ground, s.u * 0.74, dir, () => {
          groundShadow(ctx, 0, 12)
          drawTreater(ctx, 'pumpkin', { walk: walk + 2, stride: 0.7, armF: 0.5, elbowF: 0.6, mouth: 'grin', blink: blinking(s.time, 6) }, { bucket: true })
        })
        at(ctx, x, s.ground, s.u * 0.84, dir, () => {
          groundShadow(ctx, 0, 12)
          // The eldest looks back when there is a thud behind.
          const back = small === 'down' && st > 0.4 && st < 1.4
          drawTreater(ctx, lead, { walk, stride: 0.7, armF: 0.5, elbowF: 0.6, headTilt: back ? -0.25 : 0, mouth: back ? 'flat' : 'smile', blink: blinking(s.time, 7) }, { bucket: true })
        })
      },
    })
  },
}

// ─── The pumpkin patch ───────────────────────────────────────────────────────
// Three jack-o'-lanterns come up through the floor, candles lit. One of them
// has a sneeze coming and blows its own candle out. A bat uses one as a perch:
// either the dark one afterwards, which seems fair, or the sneezer beforehand,
// which does not end well for the bat.

interface PumpkinOpts {
  lit: number
  flick: number
  scrunch?: number
  look?: number
  squash?: number
}

function drawPumpkin(ctx: Ctx, r: number, face: number, o: PumpkinOpts) {
  const sq = o.squash ?? 0
  const w = r * 1.12 * (1 + sq * 0.14)
  const h = r * 0.86 * (1 - sq * 0.14)
  const cy = -h
  if (o.lit > 0) {
    // Candlelight spilling out: two soft discs, breathing slowly.
    ctx.globalAlpha = 0.09 * o.lit * (0.8 + 0.2 * o.flick)
    fillEll(ctx, 0, cy, w * 1.8, h * 1.8, '#fbbf24')
    ctx.globalAlpha = 0.12 * o.lit * (0.8 + 0.2 * o.flick)
    fillEll(ctx, 0, cy, w * 1.35, h * 1.35, C.orange)
    ctx.globalAlpha = 1
  }
  poly(ctx, [0, -2 * h + 1.5, 0.8, -2 * h - 2.5, 4, -2 * h - 4.5], 2.8, '#5d8a3a')
  fillEll(ctx, -w * 0.5, cy, w * 0.52, h * 0.95, shade(PUMPKIN, -0.14))
  fillEll(ctx, w * 0.5, cy, w * 0.52, h * 0.95, shade(PUMPKIN, -0.2))
  fillEll(ctx, 0, cy, w * 0.64, h, PUMPKIN)
  ctx.globalAlpha = 0.16
  fillEll(ctx, -w * 0.16, cy - h * 0.34, w * 0.16, h * 0.36, C.white, 0.2)
  ctx.globalAlpha = 1
  const e = r * 0.2
  const ey = cy - h * 0.2
  const lx = (o.look ?? 0) * 1.4
  const my = cy + h * 0.22
  const scr = (o.scrunch ?? 0) > 0.5
  const cut = (col: string) => {
    ctx.fillStyle = col
    ctx.strokeStyle = col
    ctx.lineWidth = 1.7
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const tri = (x: number) => {
      ctx.beginPath()
      ctx.moveTo(x - e, ey + e * 0.7)
      ctx.lineTo(x, ey - e)
      ctx.lineTo(x + e, ey + e * 0.7)
      ctx.closePath()
      ctx.fill()
    }
    const smile = (off: number, wide: number) => {
      ctx.beginPath()
      ctx.moveTo(off - w * wide, my)
      ctx.quadraticCurveTo(off, my + h * 0.62, off + w * wide, my - (off ? h * 0.1 : 0))
      ctx.quadraticCurveTo(off, my + h * 0.2, off - w * wide, my)
      ctx.fill()
    }
    if (scr) {
      // Eyes screwed shut, mouth a small round hole: the moment before the sneeze.
      for (const sd of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(sd * w * 0.32 - sd * e, ey - e * 0.7)
        ctx.lineTo(sd * w * 0.32 + sd * e * 0.6, ey)
        ctx.lineTo(sd * w * 0.32 - sd * e, ey + e * 0.7)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.ellipse(0, my + h * 0.12, w * 0.13, h * 0.17, 0, 0, TAU)
      ctx.fill()
      return
    }
    if (face === 1) {
      for (const sd of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(sd * w * 0.32 + lx, ey, e * 0.95, 0, TAU)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.ellipse(0, my + h * 0.16, w * 0.17, h * 0.2, 0, 0, TAU)
      ctx.fill()
    } else if (face === 2) {
      ctx.beginPath()
      ctx.arc(-w * 0.32, ey + e * 0.6, e, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      tri(w * 0.32 + lx)
      smile(w * 0.08, 0.42)
    } else {
      tri(-w * 0.32 + lx)
      tri(w * 0.32 + lx)
      ctx.beginPath()
      ctx.moveTo(-e * 0.5, ey + e * 1.9)
      ctx.lineTo(0, ey + e * 1.1)
      ctx.lineTo(e * 0.5, ey + e * 1.9)
      ctx.closePath()
      ctx.fill()
      smile(0, 0.5)
    }
  }
  cut('#6b2a0c')
  if (o.lit > 0) {
    ctx.globalAlpha = o.lit * (0.72 + 0.28 * o.flick)
    cut('#fde68a')
    ctx.globalAlpha = 1
  }
  if (!scr && face !== 1) {
    // One square tooth left in the grin.
    const tx = face === 2 ? w * 0.16 : -w * 0.12
    fillRR(ctx, tx - 1.6, my + h * 0.1, 3.2, h * 0.2, 0.4, PUMPKIN)
  }
}

const pumpkinPatch: ActDef = {
  id: 'halloween.pumpkin-patch',
  weight: 2.5,
  create(stage, rng) {
    const cx = stage.w * range(rng, 0.3, 0.7)
    const batFirst = chance(rng, 0.5)
    const k = Math.floor(rng() * 3) % 3
    const side: 1 | -1 = chance(rng, 0.5) ? 1 : -1
    const faces = pick(rng, [[0, 1, 2], [2, 0, 1], [1, 2, 0]] as const)
    const sizes = [range(rng, 12.5, 14.5), range(rng, 15, 17), range(rng, 11.5, 13.5)]
    const T = batFirst
      ? { batIn: 3.8, land: 5.8, build: 6.5, choo: 7.8, batOut: 7.8, sink: 10.2 }
      : { build: 4.3, choo: 5.6, batIn: 6.2, land: 8.2, batOut: 10.2, sink: 10.6 }
    const end = Math.max(T.sink + 1.8, T.batOut + 2.6)
    const riseAt = (i: number) => 0.3 + i * 0.9
    const px = (s: Stage, i: number) => cx + (i - 1) * 42 * s.u
    let sneezed = false
    return makeAct({
      update(s, dt, t) {
        const kx = px(s, k)
        const top = s.ground - sizes[k] * 1.75 * s.u
        for (let i = 0; i < 3; i++) {
          if (t >= riseAt(i) && t - dt < riseAt(i)) burst(s, 'dust', px(s, i), s.ground - 2 * s.u, 5, ['#cbd5e1'], 40, [4, 7])
        }
        if (!sneezed && t >= T.choo) {
          sneezed = true
          burst(s, 'dust', kx, s.ground - sizes[k] * 0.7 * s.u, 9, ['#e2e8f0'], 110, [4, 8])
          burst(s, 'spark', kx, s.ground - sizes[k] * 0.7 * s.u, 8, ['#fde68a', C.orange], 120, [2, 3])
        }
        // A thread of smoke from the snuffed wick.
        if (sneezed && t < T.choo + 1.8 && Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
          s.particles.emit({ kind: 'dust', x: kx + 2 * s.u, y: top, vx: range(rng, -6, 6), vy: -26 * s.u, g: -14, drag: 0.7, size: 3.5 * s.u, color: '#cbd5e1', life: 1.3 })
        }
        return t < end
      },
      draw(s, t) {
        const { ctx } = s
        const building = seg(t, T.build, T.choo)
        const after = t - T.choo
        for (let i = 0; i < 3; i++) {
          const r = sizes[i]
          const up = easeBack(seg(t, riseAt(i), riseAt(i) + 0.8)) * (1 - easeIn(seg(t, T.sink + i * 0.35, T.sink + i * 0.35 + 0.8)))
          if (up <= 0.01) continue
          const me = i === k
          // The sneezer swells and tips back, then snaps forward flat.
          let squash = 0
          let tilt = 0
          let lit = 1
          let scrunch = 0
          if (me && t >= T.build) {
            if (after < 0) {
              squash = -building * 0.9 - Math.sin(building * Math.PI * 3) * 0.25
              tilt = -building * 0.2
              scrunch = building > 0.35 ? 1 : 0
            } else {
              squash = (1 - seg(after, 0, 0.5)) * 1.6
              tilt = (1 - seg(after, 0, 0.6)) * 0.22
              scrunch = after < 0.5 ? 1 : 0
              lit = 0
            }
          }
          // The neighbours look round at the noise.
          const look = !me && t > T.build + 0.4 && after < 2 ? Math.sign(k - i) : 0
          at(ctx, px(s, i), s.ground, s.u, 1, () => {
            groundShadow(ctx, 0, r * 1.1 * up, 0.24 * clamp(up))
            ctx.save()
            ctx.beginPath()
            ctx.rect(-40, -70, 80, 70)
            ctx.clip()
            ctx.translate(0, (1 - up) * r * 2)
            ctx.rotate(tilt + Math.sin(t * 1.3 + i * 2) * 0.03)
            const flick = Math.sin(t * 5.3 + i * 2.1) * 0.6 + Math.sin(t * 8.3 + i) * 0.4
            drawPumpkin(ctx, r, faces[i], { lit, flick, squash, scrunch, look })
            ctx.restore()
          })
          if (me && building > 0.3 && after < 0) say(s, px(s, i), r * 1.9 + 8, building > 0.75 ? 'ah...' : 'ah', { size: 9 })
          if (me && after > 0 && after < 0.9) say(s, px(s, i), r * 1.9 + 8, 'CHOO', { size: 11, color: C.crimson })
        }
        // The bat.
        if (t > T.batIn && t < T.batOut + 2.6) {
          const perchX = px(s, k)
          const perchY = s.ground - (sizes[k] * 1.72 + 7) * s.u
          const inX = side === 1 ? s.w + 30 : -30
          const outX = side === 1 ? -40 : s.w + 40
          let bx = perchX
          let by = perchY
          let rot = 0
          let perched = false
          if (t < T.land) {
            const p = easeInOut(seg(t, T.batIn, T.land))
            bx = lerp(inX, perchX, p)
            by = lerp(s.ground - 95 * s.u, perchY, p) - Math.sin(p * Math.PI) * 18 * s.u + Math.sin(t * 9) * 2 * s.u * (1 - p)
          } else if (t < T.batOut) {
            perched = true
          } else {
            const q = seg(t, T.batOut, T.batOut + 2.6)
            bx = lerp(perchX, outX, q * q)
            by = perchY - easeOut(seg(q, 0, 0.35)) * (batFirst ? 75 : 40) * s.u + Math.sin(t * 9) * 2 * s.u
            // Blown clean off by the sneeze: two somersaults before the wings catch.
            if (batFirst) rot = (1 - easeOut(seg(q, 0, 0.4))) * TAU * 2
          }
          const frantic = batFirst && t >= T.batOut
          at(ctx, bx, by, s.u * 0.9, 1, () => drawBat(ctx, t * (frantic ? 34 : 20), { perched, wide: frantic || (perched && building > 0.3) }), rot)
        }
      },
    })
  },
}

// ─── The skeleton and the skeleton dog ───────────────────────────────────────
// Out for an evening walk. Either the dog remembers that its owner is made
// entirely of bones and helps itself to a shin, or the skull drops off and the
// rest of him strolls on for a while before noticing the view has gone.

function drawSkull(ctx: Ctx, o: { agape?: boolean } = {}) {
  fillCirc(ctx, 0, 0, 8.6, BONE)
  ctx.beginPath()
  ctx.arc(0, 0, 8.6, Math.PI * 0.6, Math.PI * 1.3)
  ctx.quadraticCurveTo(-4, 0, Math.cos(Math.PI * 0.6) * 8.6, Math.sin(Math.PI * 0.6) * 8.6)
  ctx.closePath()
  ctx.fillStyle = BONE_DK
  ctx.fill()
  const jy = o.agape ? 2.4 : 0
  fillRR(ctx, 0, 4.5 + jy, 8.6, 5.2, 2, BONE)
  if (o.agape) fillRR(ctx, 1.5, 5.6, 6, 2.6, 1, C.ink)
  fillEll(ctx, 2.6, -1, 2.2, 2.7, C.ink)
  fillEll(ctx, 7, -1, 1.7, 2.4, C.ink)
  fillCirc(ctx, 3.2, -1.6, 0.7, C.white)
  fillCirc(ctx, 7.3, -1.6, 0.55, C.white)
  fillPoly(ctx, [8.2, 2, 9.4, 4.2, 7.6, 4], C.ink)
  // A friendly row of teeth.
  line(ctx, 1.6, 6.6 + jy, 8, 6.2 + jy, 0.7, BONE_DK)
  for (let i = 0; i < 4; i++) line(ctx, 2.6 + i * 1.6, 5.4 + jy, 2.6 + i * 1.6, 7.8 + jy, 0.6, BONE_DK)
}

function bone(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w = 2.2, col: string = BONE) {
  line(ctx, x1, y1, x2, y2, w, col)
  fillCirc(ctx, x1, y1, w * 0.8, col)
  fillCirc(ctx, x2, y2, w * 0.8, col)
}

interface SkelPose {
  walk?: number
  stride?: number
  lift?: number
  lean?: number
  head?: boolean
  /** The near leg has only a thigh left. */
  shinGone?: boolean
  armF?: number
  elbowF?: number
  agape?: boolean
  /** Skull on back to front. */
  headBack?: boolean
}

function drawSkeleton(ctx: Ctx, p: SkelPose = {}) {
  const walk = p.walk ?? 0
  const stride = p.stride ?? 0
  const lean = p.lean ?? 0
  const legAt = (hipX: number, ph: number) => {
    const swing = Math.sin(ph) * 0.6 * stride
    const bend = Math.max(0, -Math.cos(ph)) * 0.9 * stride
    const kx = hipX + Math.sin(swing) * 9
    const ky = Math.cos(swing) * 9
    return { kx, ky, fx: kx + Math.sin(swing - bend) * 9.5, fy: ky + Math.cos(swing - bend) * 9.5 }
  }
  const lf = legAt(1.5, walk)
  const lb = legAt(-1.5, walk + Math.PI)
  const hy = -Math.max(p.shinGone ? 0 : lf.fy, lb.fy) - 1.4 - (p.lift ?? 0)
  const up = (d: number, side = 0) => ({ x: Math.sin(lean) * d + Math.cos(lean) * side, y: hy - Math.cos(lean) * d + Math.sin(lean) * side })
  const sh = up(16)
  const swingA = Math.sin(walk) * 0.6 * stride
  const arm = (a: number, e: number) => {
    const ex = sh.x + Math.sin(a) * 7.5
    const ey = sh.y + Math.cos(a) * 7.5
    return { ex, ey, hx: ex + Math.sin(a + e) * 7.5, hy: ey + Math.cos(a + e) * 7.5 }
  }
  const aB = arm(swingA, 0.3 + stride * 0.3)
  const aF = arm(p.armF ?? -swingA, p.elbowF ?? 0.3 + stride * 0.3)
  // Far arm, far leg.
  bone(ctx, sh.x, sh.y, aB.ex, aB.ey, 2, BONE_DK)
  bone(ctx, aB.ex, aB.ey, aB.hx, aB.hy, 1.8, BONE_DK)
  bone(ctx, -1.5, hy, lb.kx, hy + lb.ky, 2.2, BONE_DK)
  bone(ctx, lb.kx, hy + lb.ky, lb.fx, hy + lb.fy, 2, BONE_DK)
  fillEll(ctx, lb.fx + 2, hy + lb.fy + 0.3, 3.6, 1.6, BONE_DK)
  // Spine, pelvis, three ribs and a breastbone.
  const mid = up(8)
  line(ctx, 0, hy, sh.x, sh.y, 2.2, BONE)
  for (let i = 0; i < 5; i++) {
    const v = up(2 + i * 3.2, -0.2)
    fillCirc(ctx, v.x, v.y, 1.5, BONE_DK)
  }
  fillEll(ctx, 0.5, hy, 5, 2.8, BONE, lean)
  fillEll(ctx, 0.5, hy + 0.3, 2, 1.1, C.ink, lean)
  ctx.lineWidth = 1.4
  ctx.strokeStyle = BONE
  for (let i = 0; i < 3; i++) {
    const c = up(8.5 + i * 3, 1)
    ctx.beginPath()
    ctx.ellipse(c.x, c.y, 5.6 - i * 0.5, 1.5, lean, 0, TAU)
    ctx.stroke()
  }
  line(ctx, mid.x + 5.4, mid.y, sh.x + 4.6, sh.y + 2, 1.4, BONE)
  // Near leg.
  bone(ctx, 1.5, hy, lf.kx, hy + lf.ky, 2.4)
  if (!p.shinGone) {
    bone(ctx, lf.kx, hy + lf.ky, lf.fx, hy + lf.fy, 2.2)
    fillEll(ctx, lf.fx + 2, hy + lf.fy + 0.3, 3.8, 1.7, BONE)
  }
  // Skull.
  const neck = up(18.5, 0.5)
  const head = up(26, 1)
  if (p.head !== false) {
    line(ctx, sh.x, sh.y, neck.x, neck.y, 2, BONE)
    ctx.save()
    ctx.translate(head.x, head.y)
    ctx.rotate(lean * 0.5)
    if (p.headBack) ctx.scale(-1, 1)
    drawSkull(ctx, { agape: p.agape })
    ctx.restore()
  } else {
    line(ctx, sh.x, sh.y, neck.x, neck.y, 2, BONE)
    fillCirc(ctx, neck.x, neck.y, 1.6, BONE_DK)
  }
  bone(ctx, sh.x, sh.y, aF.ex, aF.ey, 2.2)
  bone(ctx, aF.ex, aF.ey, aF.hx, aF.hy, 2)
  return { head, hand: { x: aF.hx, y: aF.hy }, knee: { x: lf.kx, y: hy + lf.ky } }
}

/** The dog, same idea. Returns where its mouth is, and its collar for the lead. */
function drawBoneDog(ctx: Ctx, p: { run?: number; stride?: number; wag?: number; sit?: boolean } = {}) {
  const run = p.run ?? 0
  const stride = p.stride ?? 0
  const sit = p.sit ? 1 : 0
  const hop = Math.abs(Math.sin(run)) * 1.8 * stride
  ctx.save()
  ctx.translate(0, -hop)
  ctx.rotate(-sit * 0.4)
  const leg = (x: number, ph: number, far: boolean) => {
    const a = Math.sin(run + ph) * 0.75 * stride
    bone(ctx, x, -11, x + Math.sin(a) * 10.5, Math.min(hop, -11 + Math.cos(a) * 10.5 + hop * 0.4), 1.8, far ? BONE_DK : BONE)
  }
  const wag = Math.sin(p.wag ?? run * 0.8) * 0.6
  for (let i = 0; i < 3; i++) bone(ctx, -12 - i * 2.6 - wag * i * 1.6, -15 - i * 3.6, -13.5 - i * 2.6 - wag * (i + 1) * 1.6, -18 - i * 3.6, 1.4)
  leg(-9, Math.PI, true)
  leg(8, 0.4, true)
  line(ctx, -12, -13.5, 10, -15, 2.2, BONE)
  for (let i = 0; i < 6; i++) fillCirc(ctx, -11 + i * 4, -13.6 - i * 0.28, 1.5, BONE_DK)
  ctx.lineWidth = 1.2
  ctx.strokeStyle = BONE
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.arc(-1 + i * 3, -13.5, 5.2 - i * 0.5, Math.PI * 0.15, Math.PI * 0.75)
    ctx.stroke()
  }
  fillEll(ctx, -10.5, -12.5, 3, 2.2, BONE)
  leg(-11, 0, false)
  leg(10, Math.PI + 0.4, false)
  ctx.restore()
  const hx = 15 - sit * 4
  const hy = -20 - hop - sit * 8
  line(ctx, 9.5 - sit * 5, -15 - hop - sit * 6, hx - 2, hy + 2, 2, BONE)
  fillRR(ctx, hx - 7, hy + 2.6, 6.5, 2.4, 1.2, C.red)
  fillEll(ctx, hx, hy, 5.8, 5, BONE)
  fillRR(ctx, hx + 2, hy - 1.2, 9.6, 5.4, 2.4, BONE)
  fillRR(ctx, hx + 2.5, hy + 4, 7.6, 1.8, 0.9, BONE_DK)
  fillEll(ctx, hx + 2.2, hy - 1.6, 1.9, 2.2, C.ink)
  fillCirc(ctx, hx + 2.7, hy - 2.1, 0.6, C.white)
  fillPoly(ctx, [hx + 10.2, hy - 0.6, hx + 11.8, hy + 0.4, hx + 10.2, hy + 1.2], C.ink)
  fillPoly(ctx, [hx - 4.5, hy - 3.4, hx - 3.4, hy - 8, hx - 0.6, hy - 4.2], BONE)
  return { mouth: { x: hx + 10, y: hy + 4 }, collar: { x: hx - 4, y: hy + 4 } }
}

const skeletonWalk: ActDef = {
  id: 'halloween.skeleton-walk',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const gag = chance(rng, 0.5) ? 'bone' : 'head'
    const stopAt = along(stage, dir, range(rng, 0.34, 0.48))
    const GAP = 40
    let x = from
    let walk = 0
    let dogX = from + dir * GAP * stage.u
    let dogRun = 0
    let dogFace: 1 | -1 = dir
    let face: 1 | -1 = dir
    let phase: 'stroll' | 'sniff' | 'tug' | 'gasp' | 'chase' | 'drop' | 'onward' | 'pat' | 'back' | 'fix' | 'off' = 'stroll'
    let pt = 0
    // The loose skull, in px.
    let hx = 0
    let hy = 0
    let hvx = 0
    let hvy = 0
    let hrot = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        const step = (speed: number, d: 1 | -1 = dir) => {
          x += d * speed * s.u * dt
          walk += dt * (speed / 5)
        }
        const dogStep = (speed: number, d: 1 | -1) => {
          dogX += d * speed * s.u * dt
          dogRun += dt * (speed / 4)
          dogFace = d
        }
        if (phase === 'stroll') {
          step(44)
          dogStep(44, dir)
          if (past(x, stopAt, dir)) {
            if (gag === 'bone') next('sniff')
            else {
              next('drop')
              hx = x + dir * 2 * s.u
              hy = s.ground - 44 * s.u
              hvx = -dir * 46 * s.u
              hvy = -60 * s.u
            }
          }
        } else if (phase === 'sniff') {
          // The dog turns round and has a long look at that leg.
          if (!past(dogX, x + dir * 22 * s.u, flip(dir))) dogStep(40, flip(dir))
          else if (pt > 1.5) next('tug')
        } else if (phase === 'tug') {
          if (pt > 0.7) {
            next('gasp')
            burst(s, 'star', x + dir * 8 * s.u, s.ground - 8 * s.u, 6, [C.white, C.yellow], 70, [2, 3.5])
          }
        } else if (phase === 'gasp') {
          if (pt > 0.3) dogStep(96, dir)
          if (pt > 1.1) next('chase')
        } else if (phase === 'chase') {
          dogStep(96, dir)
          x += dir * 70 * s.u * dt
          walk += dt * 9
          return !past(x, to, dir)
        } else if (phase === 'drop' || phase === 'onward' || phase === 'pat') {
          // Skull physics: a couple of bounces, then it rolls to a stop face up.
          const floor = s.ground - 8.6 * s.u
          hvy += 520 * s.u * dt
          hx += hvx * dt
          hy += hvy * dt
          if (hy > floor) {
            hy = floor
            hvy = Math.abs(hvy) > 70 * s.u ? -hvy * 0.45 : 0
            hvx *= 0.7
          }
          hvx *= Math.pow(0.35, dt)
          hrot += (hvx / (8.6 * s.u)) * dt
          if (phase === 'drop') {
            step(44)
            dogStep(44, dir)
            if (pt > 0.5) next('onward')
          } else if (phase === 'onward') {
            step(44)
            // The dog goes back and sits by it. Somebody has to.
            if (!past(dogX, hx + dir * 20 * s.u, flip(dir))) dogStep(60, flip(dir))
            if (pt > 1.5) next('pat')
          } else if (pt > 2) {
            next('back')
            face = flip(dir)
          }
        } else if (phase === 'back') {
          step(52, flip(dir))
          if (past(x, hx + dir * 6 * s.u, flip(dir))) {
            next('fix')
            face = dir
          }
        } else if (phase === 'fix') {
          if (pt > 2.6) next('off')
        } else {
          step(44)
          dogStep(past(dogX, x + dir * GAP * s.u, dir) ? 44 : 70, dir)
          return !past(x, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const headless = phase === 'drop' || phase === 'onward' || phase === 'pat' || phase === 'back' || (phase === 'fix' && pt < 0.7)
        const oneLeg = phase === 'gasp' || phase === 'chase'
        const dogSits = (phase === 'onward' && past(dogX, hx + dir * 20 * s.u, flip(dir))) || phase === 'pat' || phase === 'back' || phase === 'fix'
        const dogMoving = !dogSits && phase !== 'tug' && !(phase === 'sniff' && past(dogX, x + dir * 22 * s.u, flip(dir))) && !(phase === 'gasp' && pt <= 0.3)
        let hand = { x: 0, y: 0 }
        let knee = { x: 0, y: 0 }
        const hop = oneLeg && phase === 'chase' ? Math.abs(Math.sin(walk)) * 8 : 0
        at(ctx, x, s.ground, s.u, face, () => {
          groundShadow(ctx, 0, 10 - hop * 0.3, 0.22)
          const pat = phase === 'pat' ? Math.sin(t * 9) * 0.3 : 0
          const sk = drawSkeleton(ctx, {
            walk: oneLeg ? Math.PI : walk,
            stride: phase === 'stroll' || phase === 'drop' || phase === 'onward' || phase === 'back' || phase === 'off' ? 0.7 : oneLeg ? 0.25 : 0,
            lift: hop,
            lean: phase === 'chase' ? 0.22 : phase === 'fix' && pt < 0.7 ? 0.5 * Math.sin(seg(pt, 0, 0.7) * Math.PI) : phase === 'tug' ? -0.1 : 0.04,
            head: !headless,
            headBack: phase === 'fix' && pt < 1.7,
            shinGone: oneLeg,
            agape: phase === 'tug' || oneLeg,
            armF: phase === 'pat' ? 2.75 + pat : phase === 'chase' ? 1.5 : phase === 'gasp' ? 2.4 : phase === 'fix' && pt < 1.9 ? 2.6 : phase === 'stroll' || phase === 'off' ? 0.9 : undefined,
            elbowF: phase === 'pat' ? 0.9 : phase === 'chase' ? 0.2 : phase === 'fix' && pt < 1.9 ? 0.8 : phase === 'stroll' || phase === 'off' ? 0.5 : undefined,
          })
          hand = sk.hand
          knee = sk.knee
        })
        if (phase === 'pat' && pt > 0.4) say(s, x, 62, '?', { size: 10 })
        if (phase === 'gasp') say(s, x, 76, '!', { color: C.crimson })
        if (phase === 'fix' && pt > 0.9 && pt < 1.7) say(s, dogX, 46, '!', { size: 9 })
        if (headless && phase !== 'fix') {
          at(ctx, hx, hy, s.u, dir, () => drawSkull(ctx), hrot)
          if (phase === 'pat' || phase === 'back') at(ctx, hx, s.ground, s.u, 1, () => groundShadow(ctx, 0, 8, 0.2))
        }
        // The lead, while there is still a hand on the end of it.
        const leaded = phase === 'stroll' || phase === 'sniff' || phase === 'tug' || phase === 'off'
        let collar = { x: 0, y: 0 }
        at(ctx, dogX, s.ground, s.u * 0.95, dogFace, () => {
          groundShadow(ctx, 0, 13, 0.22)
          const tug = phase === 'tug' ? Math.sin(pt * 26) * 1.2 : 0
          ctx.translate(tug, 0)
          const d = drawBoneDog(ctx, { run: dogRun, stride: dogMoving ? 0.6 : 0, wag: t * (dogSits || phase === 'chase' ? 16 : 9), sit: dogSits })
          collar = d.collar
          if (phase === 'gasp' || phase === 'chase') {
            // Somebody's shin, carried crossways like a stick.
            bone(ctx, d.mouth.x + 1, d.mouth.y - 7, d.mouth.x + 2, d.mouth.y + 5, 2.4)
          }
        })
        if (leaded) {
          const x1 = x + face * hand.x * s.u
          const y1 = s.ground + hand.y * s.u
          const x2 = dogX + dogFace * collar.x * 0.95 * s.u
          const y2 = s.ground + collar.y * 0.95 * s.u
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + 9 * s.u, x2, y2)
          ctx.lineWidth = 1.2 * s.u
          ctx.lineCap = 'round'
          ctx.strokeStyle = C.red
          ctx.stroke()
        }
        if (phase === 'tug') {
          // Wobble lines round the knee that is about to be one bone short.
          at(ctx, x, s.ground, s.u, face, () => {
            ctx.globalAlpha = 0.7
            for (const sd of [-1, 1]) line(ctx, knee.x + sd * 4, knee.y + 2, knee.x + sd * 6.5, knee.y + 5, 0.9, C.white)
            ctx.globalAlpha = 1
          })
        }
      },
    })
  },
}

// ─── Bats ────────────────────────────────────────────────────────────────────
// Half a dozen crossing in a wavy line, well clear of everybody's head. The
// last one was not ready when they set off.

const bats: ActDef = {
  id: 'halloween.bats',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 30)
    const n = 4 + Math.floor(rng() * 3) // plus the straggler: five to seven
    const overshoot = chance(rng, 0.5)
    const lagPx = 150 * stage.u
    const gap = 26 * stage.u
    const phases: number[] = []
    for (let i = 0; i <= n; i++) phases.push(range(rng, 0, TAU))
    let x = from
    return makeAct({
      update(s, dt) {
        x += dir * 96 * s.u * dt
        return !past(x - dir * (n * gap + lagPx + 40 * s.u), to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const p = clamp((dir === 1 ? x : s.w - x) / s.w)
        const height = (bx: number, ph: number, amp: number) => s.ground - 130 * s.u - Math.sin(bx * 0.013 + ph * 0.25) * amp * s.u
        for (let i = 0; i < n; i++) {
          const bx = x - dir * i * gap
          const by = height(bx, i * 1.3, 24) + Math.sin(t * 7 + phases[i]) * 2 * s.u
          at(ctx, bx, by, s.u * 0.8, dir, () => drawBat(ctx, t * 19 + phases[i]), Math.cos(bx * 0.013 + i * 0.3) * 0.2 * dir)
        }
        // The straggler: a long way back, flapping at twice the rate, closing slowly.
        const end = overshoot ? -34 * s.u : n * gap
        const lag = lerp(n * gap + lagPx, end, easeInOut(seg(p, 0.3, 0.85)))
        const closing = p > 0.3 && p < 0.85
        const sx = x - dir * lag
        const sy = height(sx, 2, 30) + Math.sin(t * 15) * 4 * s.u
        at(
          ctx,
          sx,
          sy,
          s.u * 0.72,
          dir,
          () => {
            drawBat(ctx, t * 38 + phases[n], { wide: true })
            if (closing || p <= 0.3) sweat(ctx, 0, -6, t)
          },
          Math.sin(t * 15) * 0.2,
        )
      },
    })
  },
}

// ─── The cauldron ────────────────────────────────────────────────────────────
// A witch conjures a pot, stirs it, and adds one last ingredient without
// reading the label. Green puff: she is a frog, and the hat still fits. Pink
// puff: nothing has happened to her at all, but the cat is the size of a pony.

function drawCauldron(ctx: Ctx, t: number, bubbling: number) {
  // A few sticks and a small fire underneath.
  line(ctx, -11, -1, 9, -2.4, 2.6, '#8b5a2b')
  line(ctx, -8, -2.6, 12, -1, 2.6, '#a16207')
  for (let i = 0; i < 3; i++) {
    const fl = Math.sin(t * 6 + i * 2.1)
    fillPoly(ctx, [-8 + i * 7, -2, -5 + i * 7 + fl, -8 - fl * 1.5, -2 + i * 7, -2], i === 1 ? C.yellow : C.orange)
  }
  line(ctx, -9, -6, -12, 0, 2.4, '#566178')
  line(ctx, 9, -6, 12, 0, 2.4, '#566178')
  fillEll(ctx, 0, -13, 15, 10.5, '#566178')
  fillEll(ctx, -3, -12, 9, 8, '#64708a')
  ctx.globalAlpha = 0.25
  fillEll(ctx, -7, -15, 2.2, 4.6, C.white, 0.5)
  ctx.globalAlpha = 1
  fillEll(ctx, 0, -22, 14.5, 3.6, '#7a86a0')
  fillEll(ctx, 0, -22.2, 12.2, 2.5, '#22c55e')
  fillEll(ctx, -2, -22.6, 7, 1.2, C.green)
  // Bubbles swelling on the surface and popping.
  for (let i = 0; i < 3; i++) {
    const p = (t * (0.9 + i * 0.23) + i * 0.37) % 1
    if (p < 0.85) fillCirc(ctx, -7 + i * 6.5, -22.6 - p * 1.5, (0.8 + p * 2.6) * bubbling, i === 1 ? '#bbf7d0' : '#86efac')
  }
  for (const sd of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sd * 14.6, -17, 2.4, 0, TAU)
    ctx.lineWidth = 1.2
    ctx.strokeStyle = '#7a86a0'
    ctx.stroke()
  }
}

/** A frog about 14 units tall. `hop` runs 0..1 through one jump. */
function drawFrog(ctx: Ctx, hop: number, blink: boolean, hat: boolean) {
  const up = Math.sin(hop * Math.PI)
  const g = '#4ade80'
  const dk = '#22a155'
  ctx.save()
  ctx.translate(0, -up * 13)
  ctx.rotate(-up * 0.25 + (hop > 0.5 ? (hop - 0.5) * 0.5 : 0))
  // Back leg: folded when sitting, trailing straight out mid-jump.
  if (up > 0.3) poly(ctx, [-5, -4, -11, -1 + up * 2, -17, 1 + up * 3], 2.6, dk)
  else {
    fillEll(ctx, -5, -3.6, 5.6, 3.4, dk, -0.3)
    fillEll(ctx, -3, -0.8, 5, 1.5, dk)
  }
  fillEll(ctx, 0, -6.5, 9, 6.4, g, -0.25)
  fillEll(ctx, 2.5, -4.6, 5.6, 3.6, '#bbf7d0', -0.25)
  poly(ctx, [5, -4, 7.5, -1 + up * 3, 10, -0.6 + up * 3], 2.2, dk)
  fillCirc(ctx, 3, -12.4, 3.2, g)
  fillCirc(ctx, 8.4, -11.6, 3, g)
  if (blink) {
    line(ctx, 1.4, -12.4, 4.6, -12.4, 0.9, C.ink)
    line(ctx, 7, -11.6, 9.8, -11.6, 0.9, C.ink)
  } else {
    fillCirc(ctx, 3.4, -12.6, 2, C.white)
    fillCirc(ctx, 8.8, -11.8, 1.8, C.white)
    fillCirc(ctx, 3.9, -12.6, 1, C.ink)
    fillCirc(ctx, 9.2, -11.8, 0.9, C.ink)
  }
  ctx.beginPath()
  ctx.arc(5, -8.6, 4.6, Math.PI * 0.05, Math.PI * 0.8)
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#166534'
  ctx.stroke()
  fillEll(ctx, 9.4, -7, 1.5, 1, 'rgba(244,114,128,0.5)')
  if (hat) miniWitchHat(ctx, 3.5, -15, 1.25)
  ctx.restore()
}

const cauldron: ActDef = {
  id: 'halloween.cauldron',
  weight: 2.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const gag = chance(rng, 0.5) ? 'frog' : 'cat'
    const spot = along(stage, dir, range(rng, 0.3, 0.42))
    const potX = spot + dir * 30 * stage.u
    const puffCol = gag === 'frog' ? [C.green, '#bbf7d0', C.mint] : [C.pink, C.rose, '#fbcfe8']
    let x = from
    let walk = 0
    let catX = from - dir * 30 * stage.u
    let catRun = 0
    let phase: 'in' | 'conjure' | 'stir' | 'drop' | 'puff' | 'reveal' | 'out' = 'in'
    let pt = 0
    let hop = 0
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const tick = (hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        const potTop = s.ground - 24 * s.u
        if (phase === 'in') {
          x += dir * 50 * s.u * dt
          walk += dt * 9
          catX += dir * 50 * s.u * dt
          catRun += dt * 12
          if (past(x, spot, dir)) next('conjure')
        } else if (phase === 'conjure') {
          if (pt >= 0.5 && pt - dt < 0.5) {
            burst(s, 'dust', potX, s.ground - 12 * s.u, 8, ['#c4b5fd'], 70, [5, 9])
            burst(s, 'star', potX, s.ground - 14 * s.u, 6, [C.gold, C.purple], 80, [2, 3.5])
          }
          if (pt > 1.3) next('stir')
        } else if (phase === 'stir' || phase === 'drop') {
          // Green fizz off the top. ('bubble' particles are always blue, so these are embers.)
          if (tick(7)) s.particles.emit({ kind: 'ember', x: potX + range(rng, -9, 9) * s.u, y: potTop, vy: -range(rng, 22, 40) * s.u, size: range(rng, 2, 4) * s.u, color: pick(rng, [C.green, '#86efac', '#bbf7d0']), life: 1.5 })
          if (tick(1.4)) s.particles.emit({ kind: 'bubble', x: potX + range(rng, -7, 7) * s.u, y: potTop, vy: -26 * s.u, size: range(rng, 2, 3.4) * s.u, life: 1.8 })
          if (tick(2.5)) burst(s, 'spark', potX + range(rng, -8, 8) * s.u, potTop, 2, [C.yellow, C.green], 70, [1.5, 2.5])
          if (phase === 'stir' && pt > 3.4) next('drop')
          if (phase === 'drop' && pt > 1.3) {
            next('puff')
            const px = gag === 'frog' ? x : catX
            burst(s, 'dust', px, s.ground - 22 * s.u, 14, puffCol, 90, [7, 12])
            burst(s, 'star', px, s.ground - 24 * s.u, 9, [C.white, puffCol[0]], 110, [2.5, 4])
            burst(s, 'spark', potX, potTop, 10, puffCol, 130, [2, 3])
          }
        } else if (phase === 'puff') {
          if (pt > 0.3) next('reveal')
        } else if (phase === 'reveal') {
          if (pt > 3) {
            next('out')
            burst(s, 'dust', potX, s.ground - 12 * s.u, 8, ['#c4b5fd'], 70, [5, 9])
          }
        } else {
          if (gag === 'frog') {
            // Off she hops, with the cat following at a respectful distance.
            hop = (hop + dt * 2.1) % 1
            if (hop > 0.08 && hop < 0.92) x += dir * 118 * s.u * dt
            if (pt > 0.9) {
              catX += dir * 96 * s.u * dt
              catRun += dt * 13
            }
            return !past(Math.min(dir * x, dir * catX) * dir, to, dir)
          }
          x += dir * 56 * s.u * dt
          walk += dt * 10
          if (pt > 0.7) {
            catX += dir * 56 * s.u * dt
            catRun += dt * 5
          }
          return !past(catX - dir * 40 * s.u, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const big = gag === 'cat' && (phase === 'reveal' || phase === 'out')
        const frog = gag === 'frog' && (phase === 'reveal' || phase === 'out')
        const catK = 0.85 * (big ? 1 + easeBack(seg(phase === 'reveal' ? pt : 1, 0, 0.5)) * 1.9 : 1)
        const catWalks = phase === 'in' || (phase === 'out' && pt > (gag === 'frog' ? 0.9 : 0.7))
        const drawTheCat = () =>
          at(ctx, catX, s.ground, s.u * catK, dir, () => {
            groundShadow(ctx, 0, 9)
            drawCat(ctx, { run: catRun, stride: catWalks ? 0.6 : 0, sit: !catWalks, wide: frog && phase === 'reveal' && pt < 1.5, time: t })
          })
        if (!big) drawTheCat()
        // The pot pops into being, and out again when the fun is over.
        const potK = phase === 'in' ? 0 : phase === 'conjure' ? easeBack(seg(pt, 0.5, 0.9)) : phase === 'out' ? 1 - easeIn(seg(pt, 0, 0.25)) : 1
        if (potK > 0.02) {
          at(ctx, potX, s.ground, s.u * potK, dir, () => {
            groundShadow(ctx, 0, 16)
            drawCauldron(ctx, t, phase === 'stir' || phase === 'drop' ? 1 : 0.5)
          })
        }
        if (frog) {
          at(ctx, x, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 9 - Math.sin(hop * Math.PI) * 3)
            drawFrog(ctx, phase === 'out' ? hop : 0, blinking(s.time * 2.5, 3), true)
          })
          if (phase === 'reveal' && pt > 0.8 && pt < 2.4) say(s, x, 36, 'ribbit', { size: 9, color: C.forest })
        } else if (phase !== 'puff' || gag === 'cat') {
          at(ctx, x, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 11)
            const stir = phase === 'stir'
            const dropping = phase === 'drop'
            const awe = big && phase === 'reveal'
            const a = drawPerson(ctx, WITCH, {
              walk,
              stride: phase === 'in' || phase === 'out' ? 0.7 : 0,
              armF: phase === 'conjure' ? 2.4 : stir ? 1.25 + Math.sin(t * 5) * 0.22 : dropping ? 1.9 - seg(pt, 0.5, 0.9) * 0.5 : awe ? -0.6 : undefined,
              elbowF: phase === 'conjure' ? 0.5 : stir ? 0.35 + Math.cos(t * 5) * 0.25 : dropping ? 0.3 : awe ? -0.5 : undefined,
              armB: stir || dropping ? 0.5 : awe ? -0.9 : undefined,
              lean: stir ? 0.12 : awe ? -0.16 : 0,
              headTilt: awe ? -0.12 : 0,
              mouth: awe ? 'o' : stir ? 'grin' : 'smile',
              eyes: awe ? 'wide' : 'normal',
              blink: blinking(s.time, 2),
            })
            if (stir) {
              // The spoon, going round.
              line(ctx, a.handF.x - 1, a.handF.y - 5, 30 + Math.sin(t * 5) * 6, -21, 1.8, '#b07a3a')
            } else if (phase === 'conjure') {
              line(ctx, a.handF.x, a.handF.y, a.handF.x + 6, a.handF.y - 9, 1.4, '#b07a3a')
              star(ctx, a.handF.x + 6.5, a.handF.y - 10, 2.6, C.gold, t * 4)
            } else if (dropping) {
              // A small bottle with a suspicious label, in an arc from hand to pot.
              const q = easeIn(seg(pt, 0.6, 1.2))
              const bx = lerp(a.handF.x + 2, 30, q)
              const by = lerp(a.handF.y - 3, -24, q) - Math.sin(q * Math.PI) * 8
              ctx.save()
              ctx.translate(bx, by)
              ctx.rotate(q * 5)
              fillRR(ctx, -2, -2.6, 4, 6, 1.2, gag === 'frog' ? C.green : C.pink)
              fillRR(ctx, -0.9, -4.6, 1.8, 2.4, 0.5, C.tan)
              fillRR(ctx, -1.4, -0.6, 2.8, 2, 0.4, C.white)
              ctx.restore()
            }
          })
          if (phase === 'drop' && pt < 0.6) say(s, x, 80, '?', { color: C.plum })
        }
        if (big) {
          drawTheCat()
          if (phase === 'reveal' && pt > 0.9 && pt < 2.5) say(s, catX + dir * 8 * s.u, 62, 'mew', { size: 12 })
        }
      },
    })
  },
}

// ─── The spider ──────────────────────────────────────────────────────────────
// Down from the top of the screen on a thread, a bounce, a quick look round,
// and away again before anyone can mind. Sometimes it has dressed up. Sometimes
// it notices it is being watched and leaves a good deal faster than it came.

function drawSpider(ctx: Ctx, t: number, spread: number, o: { wide?: boolean; wave?: boolean; hat?: boolean }) {
  const body = '#8f74d4'
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = (-0.7 + i * 0.45) * (0.5 + spread * 0.5)
      const wig = Math.sin(t * 7 + i * 1.3 + sd) * 0.8
      const waving = o.wave && sd === 1 && i === 0
      const kx = sd * (7 + Math.cos(a) * 5 * spread)
      const ky = Math.sin(a) * 7 - 3 * spread + (waving ? -4 : 0)
      const fx = sd * (9 + Math.cos(a) * 9 * spread)
      const fy = Math.sin(a) * 9 + 4 + wig + (waving ? -11 + Math.sin(t * 14) * 3 : 0)
      poly(ctx, [sd * 5, Math.sin(a) * 4, kx, ky, fx, fy], 1.3, shade(body, -0.2))
    }
  }
  fillCirc(ctx, 0, 0, 7.6, body)
  fillEll(ctx, -2, -2.4, 3.6, 2.6, shade(body, 0.2), -0.4)
  fillEll(ctx, 0, 3, 4.6, 2.6, shade(body, 0.12))
  const er = o.wide ? 2.9 : 2.3
  fillCirc(ctx, -2.8, -0.8, er, C.white)
  fillCirc(ctx, 2.8, -0.8, er, C.white)
  fillCirc(ctx, -2.4, o.wide ? -0.8 : -0.3, 1.15, C.ink)
  fillCirc(ctx, 3.2, o.wide ? -0.8 : -0.3, 1.15, C.ink)
  if (o.wide) fillEll(ctx, 0, 3.6, 1.3, 1.6, C.ink)
  else {
    ctx.beginPath()
    ctx.arc(0, 1.8, 2.6, Math.PI * 0.15, Math.PI * 0.85)
    ctx.lineWidth = 0.9
    ctx.lineCap = 'round'
    ctx.strokeStyle = C.ink
    ctx.stroke()
  }
  fillEll(ctx, -5, 2, 1.4, 0.9, 'rgba(244,114,128,0.55)')
  fillEll(ctx, 5, 2, 1.4, 0.9, 'rgba(244,114,128,0.55)')
  if (o.hat) miniWitchHat(ctx, 0, -6.6, 0.8)
}

const spider: ActDef = {
  id: 'halloween.spider',
  weight: 1.5,
  create(stage, rng) {
    const x = stage.w * range(rng, 0.12, 0.88)
    const startled = chance(rng, 0.45)
    const hat = chance(rng, 0.5)
    const DOWN = 2.4
    const dwell = startled ? 1.3 : 1.7
    const upTime = startled ? 0.55 : 1.9
    const total = DOWN + dwell + upTime
    return makeAct({
      duration: total + 0.1,
      draw(s, t) {
        const { ctx } = s
        const top = -16 * s.u
        const low = s.ground - 15 * s.u
        let y: number
        if (t < DOWN) y = lerp(top, low, bounce(seg(t, 0, DOWN)))
        else if (t < DOWN + dwell) y = low - Math.sin((t - DOWN) * 5) * 2.5 * s.u * (1 - seg(t, DOWN, DOWN + dwell) * 0.6)
        else y = lerp(low, top, startled ? easeIn(seg(t, DOWN + dwell, total)) : easeInOut(seg(t, DOWN + dwell, total)))
        const here = t >= DOWN && t < DOWN + dwell
        const seen = startled && t > DOWN + 0.6
        ctx.globalAlpha = 0.5
        line(ctx, x, 0, x, y - 6 * s.u, 0.8, C.white)
        ctx.globalAlpha = 1
        at(ctx, x, s.ground, s.u, 1, () => groundShadow(ctx, 0, 8 * clamp(1 - (s.ground - y) / (120 * s.u)), 0.2))
        const sway = Math.sin(t * 2.4) * 0.07
        at(ctx, x, y, s.u, 1, () => drawSpider(ctx, t, here ? 1 : 0.45, { wide: seen, wave: here && !startled && t > DOWN + 0.4, hat }), sway)
        if (seen && here) say(s, x + 14 * s.u, 34, '!', { size: 9, color: C.crimson })
      },
    })
  },
}

export const HALLOWEEN_ACTS: ActDef[] = [witchSweep, ghostBoo, trickOrTreat, pumpkinPatch, skeletonWalk, bats, cauldron, spider]
