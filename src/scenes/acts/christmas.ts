import { DOG, drawBird, drawDog } from '../creatures'
import { C, TAU, at, clamp, easeBack, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, star, type Ctx } from '../draw'
import { banner, blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { CAST, drawPerson, type Anchors, type Look, type Pose, type Pt } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Stage } from '../types'

// Advent. This theme runs every day from the first of December and comes up
// more and more as the 25th gets close, so it has the biggest cast of all: the
// children will see each of these many times and should still not know which
// one is next. Everything plays over falling snow.

type Dir = 1 | -1

const passed = (x: number, target: number, dir: number) => (dir === 1 ? x >= target : x <= target)
/** True on the frames where a clock running at `hz` ticks over. */
const tick = (t: number, dt: number, hz: number) => Math.floor(t * hz) !== Math.floor((t - dt) * hz)
/** x at fraction `f` of the way across, measured from the side the act came in. */
const along = (s: Stage, dir: number, f: number) => (dir === 1 ? s.w * f : s.w * (1 - f))
/** Floor level at x, on top of whatever snow has drifted there. */
const floorAt = (s: Stage, x: number) => s.ground - s.particles.heightAt(x) * 0.7
/** Wide screens get a brisker walk, so a crossing never drags. */
const pace = (s: Stage) => clamp(s.w / (1000 * s.u), 1, 1.5)

const SPARKLE = [C.gold, C.yellow, C.white, '#fde68a']
const BULBS = [C.red, C.gold, C.green, C.sky, C.pink]
const SANTA_RED = '#d92b3a'

// ─── The cast ────────────────────────────────────────────────────────────────

const SANTA: Look = {
  skin: C.skinA, top: SANTA_RED, bottom: SANTA_RED, shoe: '#27303f', hair: C.white,
  beard: C.white, moustache: C.white, hat: 'santa', hatColor: SANTA_RED, gloves: C.white,
}
// The same man after a chimney.
const SOOTY: Look = {
  ...SANTA, skin: '#a98b78', top: '#6d2a33', bottom: '#5c252d', hatColor: '#6d2a33',
  hair: '#8b909b', beard: '#8b909b', moustache: '#7a7f8a', gloves: '#7a7f8a',
}
const ELF_A: Look = { skin: C.skinA, top: '#2fa35a', bottom: '#c62f3d', shoe: '#8a5a2b', hair: '#b8742a', hat: 'elf', hatColor: '#2fa35a', hatTrim: C.red }
const ELF_B: Look = { skin: C.skinB, top: '#c62f3d', bottom: '#2fa35a', shoe: '#8a5a2b', hair: '#2a1a10', hat: 'elf', hatColor: C.red, hatTrim: C.gold }

/** Santa is the ordinary rig plus a belt, a buckle and a fur hem. */
function drawSanta(ctx: Ctx, pose: Pose, look: Look = SANTA, behind?: (a: Anchors) => void): Anchors {
  const a = drawPerson(ctx, look, pose, behind)
  ctx.save()
  ctx.translate(a.hip.x, a.hip.y)
  ctx.rotate(a.lean)
  fillRR(ctx, -8, -6, 16, 3, 1, '#27303f')
  fillRR(ctx, 2.6, -6.7, 4.4, 4.4, 1, C.gold)
  fillRR(ctx, 3.8, -5.5, 2, 2, 0.5, '#27303f')
  fillRR(ctx, -8, 0.6, 16, 2.4, 1.2, look === SANTA ? C.white : '#8b909b')
  ctx.restore()
  return a
}

const ELF = 0.72

/** An elf is a three-quarter-size person with a pointed ear. Anchors come back in the caller's units. */
function drawElf(ctx: Ctx, look: Look, pose: Pose = {}, behind?: (a: Anchors) => void) {
  ctx.save()
  ctx.scale(ELF, ELF)
  const a = drawPerson(ctx, look, pose, behind)
  ctx.save()
  ctx.translate(a.head.x, a.head.y)
  ctx.rotate(a.lean * 0.5 + (pose.headTilt ?? 0))
  fillPoly(ctx, [-5.2, -0.6, -10, -6.5, -1.6, -2.4], shade(look.skin, -0.08))
  ctx.restore()
  ctx.restore()
  const k = (p: Pt): Pt => ({ x: p.x * ELF, y: p.y * ELF })
  return { handF: k(a.handF), handB: k(a.handB), head: k(a.head), crown: k(a.crown), mouth: k(a.mouth) }
}

// ─── Props ───────────────────────────────────────────────────────────────────

/** A wrapped box sitting on y, centred on x, with a ribbon both ways and a bow. */
function drawPresent(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, ribbon: string, bow = true) {
  fillRR(ctx, x - w / 2, y - h, w, h, Math.min(2, w * 0.08), color)
  fillRR(ctx, x - w / 2, y - h, w * 0.2, h, Math.min(2, w * 0.08), shade(color, -0.18))
  fillRR(ctx, x - w / 2, y - h * 0.55, w, h * 0.13, 0, ribbon)
  fillRR(ctx, x - w / 2 - w * 0.02, y - h, w * 1.04, h * 0.17, Math.min(1.5, w * 0.06), shade(color, 0.14))
  fillRR(ctx, x - w * 0.07, y - h, w * 0.14, h, 0, ribbon)
  if (!bow) return
  fillEll(ctx, x - w * 0.14, y - h - w * 0.06, w * 0.15, w * 0.085, ribbon, 0.5)
  fillEll(ctx, x + w * 0.14, y - h - w * 0.06, w * 0.15, w * 0.085, ribbon, -0.5)
  fillCirc(ctx, x, y - h - w * 0.01, w * 0.065, shade(ribbon, -0.2))
}

/** Santa's sack, centred on (x, y). Squash it with sx / sy. */
function drawSack(ctx: Ctx, x: number, y: number, sx = 1, sy = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sx, sy)
  // A candy cane and a parcel poking out of the neck.
  poly(ctx, [3, -8, 5, -17, 8, -18.5, 9.5, -16], 1.8, C.white)
  line(ctx, 4, -12, 4.6, -14.5, 1.8, C.red)
  line(ctx, 6.5, -18, 8.4, -18.2, 1.8, C.red)
  drawPresent(ctx, -4, -9, 7, 7, C.green, C.gold)
  fillEll(ctx, 0, 0, 11, 11.5, '#a8743a')
  fillEll(ctx, -3, 1.5, 7, 8.5, '#946230')
  fillEll(ctx, 3.5, -3.5, 4.2, 5, '#bd8748')
  fillRR(ctx, -5, -12.5, 10, 3, 1.5, '#946230')
  line(ctx, -4.5, -11, 4.5, -11, 1.3, C.red)
  fillRR(ctx, -6.5, 2, 5, 4.6, 0.8, '#c9995c')
  ctx.restore()
}

interface DeerPose {
  /** Gallop phase, radians. */
  run?: number
  /** 0 standing, 1 flat out. */
  stride?: number
  /** 0..1, how brightly the nose is lit. */
  glow?: number
  nose?: string
  /** 0 head up, 1 nose on the floor. */
  head?: number
  tilt?: number
  eyes?: 'normal' | 'closed' | 'wide' | 'crossed'
  /** Wear the red harness collar and bell. */
  bell?: boolean
  /** Chewing phase; omit when the mouth is shut. */
  chew?: number
}

const COAT = '#a8703f'
const ANTLER = '#dcc7a2'

/**
 * A reindeer, about 30 units long and 46 to the antler tips. Returns where the
 * nose, the antlers and the collar ended up, in the caller's units.
 */
function drawReindeer(ctx: Ctx, p: DeerPose = {}) {
  const run = p.run ?? 0
  const stride = p.stride ?? 0
  const dark = shade(COAT, -0.26)
  const bob = Math.abs(Math.sin(run)) * 1.6 * stride
  const leg = (x: number, phase: number, far: boolean) => {
    const a = Math.sin(run + phase) * 0.95 * stride
    const bend = Math.max(0, Math.cos(run + phase)) * 0.95 * stride
    const kx = x + Math.sin(a) * 7
    const ky = -14 - bob + Math.cos(a) * 7
    const fx = kx + Math.sin(a - bend) * 7.4
    const fy = Math.min(0, ky + Math.cos(a - bend) * 7.4)
    poly(ctx, [x, -15 - bob, kx, ky, fx, fy], 3, far ? dark : COAT)
    fillEll(ctx, fx + 0.6, fy - 0.4, 2.1, 1.4, '#5a4632')
  }
  leg(-8, Math.PI + 0.5, true)
  leg(8, 0.5, true)
  // Scut of a tail.
  fillEll(ctx, -13, -22 - bob, 2.6, 3.4, '#f3e3c8', 0.5)
  fillEll(ctx, 0, -19 - bob, 13, 6.8, COAT)
  fillEll(ctx, 0.5, -15.6 - bob, 9.5, 3, '#c79462')
  fillEll(ctx, -5, -22.5 - bob, 6, 2.6, shade(COAT, 0.1))
  leg(-10, Math.PI, false)
  leg(10, 0, false)
  // Neck and head swing down together to graze.
  const h = p.head ?? 0
  const na = lerp(-1.05, 0.95, h)
  const nbx = 9
  const nby = -21 - bob
  const hx = nbx + Math.cos(na) * 12
  const hy = nby + Math.sin(na) * 12
  line(ctx, nbx, nby + 1, hx - 1, hy + 1, 6.6, COAT)
  fillEll(ctx, 11, -16.5 - bob, 3.6, 5, '#e7cfa8', 0.2)
  if (p.bell) {
    line(ctx, nbx - 1.5, nby - 3.5, nbx + 4.5, nby + 3, 2.2, C.red)
    fillCirc(ctx, nbx + 5.4, nby + 4.4, 1.7, C.gold)
  }
  const ha = lerp(0.12, 1.1, h) + (p.tilt ?? 0)
  const antler = (ox: number, col: string) => {
    poly(ctx, [ox - 1, -3.5, ox - 3, -10, ox + 1, -15.5], 1.5, col)
    line(ctx, ox - 2.4, -8, ox + 2.6, -9.6, 1.3, col)
    line(ctx, ox - 1.6, -12.5, ox - 5.6, -15.5, 1.3, col)
  }
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(ha)
  antler(2, shade(ANTLER, -0.25))
  fillEll(ctx, -3.6, -2.6, 3.8, 1.8, dark, -0.5)
  fillEll(ctx, 0, 0, 5.2, 4.4, COAT)
  fillRR(ctx, 1, -2.2, 9.6, 5.2, 2.6, '#c79462')
  if (p.chew !== undefined) fillEll(ctx, 7, 3 + Math.sin(p.chew) * 0.7, 2.6, 1.1, dark)
  // The nose: a dull red bulb, and the lit one faded in over it.
  const g = clamp(p.glow ?? 0)
  const lit = p.nose ?? '#ff4343'
  fillCirc(ctx, 10.6, 0.4, 2.3, '#7c3a3a')
  if (g > 0.02) {
    ctx.globalAlpha = 0.14 * g
    fillCirc(ctx, 10.6, 0.4, 8, lit)
    ctx.globalAlpha = 0.3 * g
    fillCirc(ctx, 10.6, 0.4, 4.6, lit)
    ctx.globalAlpha = g
    fillCirc(ctx, 10.6, 0.4, 2.4, lit)
    fillCirc(ctx, 10, -0.3, 0.8, C.white)
    ctx.globalAlpha = 1
  }
  const eyes = p.eyes ?? 'normal'
  if (eyes === 'closed') line(ctx, 0.8, -1.2, 3, -1, 1, C.ink)
  else if (eyes === 'normal') {
    fillCirc(ctx, 1.9, -1.4, 1.35, C.ink)
    fillCirc(ctx, 2.3, -1.8, 0.45, C.white)
  } else {
    fillCirc(ctx, 1.9, -1.5, 2.1, C.white)
    fillCirc(ctx, eyes === 'crossed' ? 3 : 2.1, eyes === 'crossed' ? -0.9 : -1.5, 1, C.ink)
  }
  antler(-1, ANTLER)
  ctx.restore()
  const cs = Math.cos(ha)
  const sn = Math.sin(ha)
  const out = (lx: number, ly: number): Pt => ({ x: hx + cs * lx - sn * ly, y: hy + sn * lx + cs * ly })
  return { nose: out(10.6, 0.4), antler: out(0, -15.5), collar: { x: nbx + 2, y: nby } }
}

/** Where a point in an `at()` frame lands on screen. */
function toScreen(ox: number, oy: number, scale: number, dir: number, rot: number, lx: number, ly: number): Pt {
  const px = lx * scale * dir
  const py = ly * scale
  return { x: ox + Math.cos(rot) * px - Math.sin(rot) * py, y: oy + Math.sin(rot) * px + Math.cos(rot) * py }
}

/** The sleigh with Santa in it, runners on y = 0. Returns his rein hand. */
function drawSleigh(ctx: Ctx, t: number): Pt {
  // The sack rides behind the seat with a couple of parcels on top.
  drawPresent(ctx, -11, -31, 6.5, 6.5, C.green, C.gold)
  drawPresent(ctx, -18.5, -30, 5.5, 5.5, C.purple, C.yellow)
  fillEll(ctx, -15, -23, 8.5, 9, '#a8743a', 0.15)
  fillEll(ctx, -17, -22, 5, 6.5, '#946230', 0.15)
  // Santa from the waist up; the sleigh side hides the rest.
  ctx.save()
  ctx.beginPath()
  ctx.rect(-30, -90, 70, 81)
  ctx.clip()
  ctx.translate(0, 11)
  const a = drawSanta(ctx, { armF: 1.25, elbowF: 0.5, armB: 1.05, elbowB: 0.6, mouth: 'grin', lean: 0.06, headTilt: Math.sin(t * 2.2) * 0.05 })
  ctx.restore()
  // Body: a high back, a low middle and a curled dash.
  ctx.beginPath()
  ctx.moveTo(-20, -4.5)
  ctx.lineTo(13, -4.5)
  ctx.quadraticCurveTo(21.5, -5.5, 20.5, -18)
  ctx.quadraticCurveTo(15, -15.5, 9, -12)
  ctx.lineTo(-6, -12)
  ctx.quadraticCurveTo(-12, -12, -13, -22.5)
  ctx.lineTo(-21.5, -24.5)
  ctx.quadraticCurveTo(-23.5, -12, -20, -4.5)
  ctx.closePath()
  ctx.fillStyle = '#c62f3d'
  ctx.fill()
  fillRR(ctx, -20, -7.6, 34, 3.2, 1.6, shade('#c62f3d', -0.2))
  poly(ctx, [-21.5, -24.5, -13, -22.5], 1.6, C.gold)
  poly(ctx, [9, -12, 15, -15.5, 20.5, -18], 1.6, C.gold)
  star(ctx, 2, -9.6, 2.6, C.gold)
  // Runners with a curl at the front.
  line(ctx, -12, -4.5, -12, 0, 1.3, C.gold)
  line(ctx, 8, -4.5, 8, 0, 1.3, C.gold)
  ctx.beginPath()
  ctx.moveTo(-21, 0)
  ctx.lineTo(13, 0)
  ctx.quadraticCurveTo(23, 0, 22, -8)
  ctx.quadraticCurveTo(21, -11.5, 17.5, -9.5)
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.strokeStyle = C.gold
  ctx.stroke()
  return { x: a.handF.x, y: a.handF.y + 11 }
}

// ─── Santa's sleigh ──────────────────────────────────────────────────────────
// Three or four reindeer and a sleigh, bounding across the sky in long shallow
// arcs and shedding stars. A parcel slides out of the back; an elf who has
// clearly done this before runs on to fetch it. Sometimes the rear reindeer has
// been harnessed the wrong way round, and sometimes it is a very small one
// working four times as hard as the others. On the 24th and 25th the same team
// tows a banner instead.

function sleighAct(id: string, weight: number, towing: boolean): ActDef {
  return {
    id,
    weight,
    when: towing ? (c) => c.adventDay >= 24 : undefined,
    create(stage, rng) {
      const { dir, from } = crossing(stage, rng, 0)
      const K = 0.8 // the whole team is drawn small: it is up in the sky
      const gag = towing ? 'plain' : pick(rng, ['plain', 'backwards', 'tiny'] as const)
      const deer = gag === 'plain' && chance(rng, 0.5) ? 4 : 3
      const GAP = 32
      const sleighOff = (deer - 1) * GAP + 44
      const speed = 120 * stage.u
      const base = range(rng, 134, 146)
      const amp = 22
      const phase0 = range(rng, 0, TAU)
      const wave = 1 / (70 * stage.u)
      const dropAt = along(stage, dir, range(rng, 0.4, 0.6))
      const giftCol = pick(rng, [C.green, C.blue, C.purple, C.amber])
      let bw = 110 // banner width, learnt from the first draw
      let x = from - dir * 34 * stage.u
      let run = 0
      let gift: 'none' | 'aboard' | 'falling' | 'landed' | 'carried' = towing ? 'none' : 'aboard'
      let gx = 0
      let gy = 0
      let gvy = 0
      let grot = 0
      let gt = 0
      let ex = from - dir * 30 * stage.u
      let ewalk = 0
      const yAt = (s: Stage, px: number) => s.ground - (base + amp * Math.sin(px * wave + phase0)) * s.u
      const rotAt = (s: Stage, px: number) => Math.atan(-amp * s.u * wave * Math.cos(px * wave + phase0))
      return makeAct({
        update(s, dt, t) {
          x += dir * speed * dt
          run += dt * 13
          const sx = x - dir * sleighOff * K * s.u
          if (tick(t, dt, 16) && sx > -20 && sx < s.w + 20) {
            s.particles.emit({
              kind: 'star',
              x: sx - dir * 20 * K * s.u,
              y: yAt(s, sx) - range(rng, 0, 6) * s.u,
              vx: -dir * range(rng, 10, 40) * s.u,
              vy: range(rng, -10, 20) * s.u,
              size: range(rng, 2, 4.2) * s.u,
              color: pick(rng, SPARKLE),
              life: 1.1,
            })
          }
          if (gift === 'aboard' && passed(sx, dropAt, dir)) {
            gift = 'falling'
            gx = sx - dir * 17 * K * s.u
            gy = yAt(s, sx) - 24 * K * s.u
            gvy = -50 * s.u
          } else if (gift === 'falling') {
            gvy += 420 * s.u * dt
            gy += gvy * dt
            gx += dir * speed * 0.3 * dt
            grot += dt * 5 * dir
            const fl = floorAt(s, gx)
            if (gy >= fl) {
              gy = fl
              gift = 'landed'
              burst(s, 'snow', gx, gy - 2, 8, [C.white], 70, [2, 4])
              burst(s, 'star', gx, gy - 6 * s.u, 5, SPARKLE, 60, [2, 3.5])
            }
          } else if (gift === 'landed') {
            gt += dt
            if (gt > 1.2) {
              ex += dir * 215 * s.u * dt
              ewalk += dt * 17
              if (passed(ex, gx - dir * 6 * s.u, dir)) gift = 'carried'
            }
          } else if (gift === 'carried') {
            ex += dir * 185 * s.u * dt
            ewalk += dt * 16
          }
          const tail = sx - dir * (towing ? 60 + bw : 30) * K * s.u
          if (dir === 1 ? tail < s.w + 10 : tail > -10) return true
          if (gift === 'none') return false
          return !(gift === 'carried' && passed(ex, dir === 1 ? s.w + 30 * s.u : -30 * s.u, dir))
        },
        draw(s, t) {
          const { ctx } = s
          const u = s.u * K
          const sx = x - dir * sleighOff * u
          const sy = yAt(s, sx)
          const srot = rotAt(s, sx)
          if (towing) {
            const bx = sx - dir * (44 + bw / 2) * u
            const by = yAt(s, bx) - 12 * u
            const hitch = toScreen(sx, sy, u, dir, srot, -22, -14)
            line(ctx, hitch.x, hitch.y, bx + dir * (bw / 2 - 4) * u, by, 1, C.tan)
            at(ctx, bx, by, u, 1, () => {
              bw = Math.max(60, banner(ctx, 0, 0, 'Merry Christmas', { size: 12, wave: t * 5, bg: '#1f8a4c', color: C.white }))
            }, rotAt(s, bx) * 0.5)
          }
          let hand: Pt = { x: 12, y: -24 }
          at(ctx, sx, sy, u, dir, () => {
            hand = drawSleigh(ctx, t)
          }, srot)
          // Reins: one line from Santa's glove through every collar.
          const h = toScreen(sx, sy, u, dir, srot, hand.x, hand.y)
          ctx.beginPath()
          ctx.moveTo(h.x, h.y)
          for (let i = deer - 1; i >= 0; i--) {
            const px = x - dir * i * GAP * u
            const c = toScreen(px, yAt(s, px), u, dir, rotAt(s, px), 10, -22)
            ctx.lineTo(c.x, c.y)
          }
          ctx.lineWidth = 1
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = '#b98a55'
          ctx.stroke()
          for (let i = deer - 1; i >= 0; i--) {
            const px = x - dir * i * GAP * u
            const py = yAt(s, px)
            const odd = i === deer - 1 && gag !== 'plain'
            const glow = i === 0 ? 0.8 + Math.sin(t * 5) * 0.2 : 0
            if (odd && gag === 'tiny') {
              // Half the size, twice the leg speed, and feeling it.
              at(ctx, px, py - 4 * u, u * 0.55, dir, () => {
                drawReindeer(ctx, { run: run * 2.6, stride: 1, bell: true, eyes: 'wide' })
                sweat(ctx, 16, -36, t)
              }, rotAt(s, px))
            } else if (odd) {
              at(ctx, px, py, u, (-dir) as Dir, () => {
                drawReindeer(ctx, { run: -run + i, stride: 1, bell: true, eyes: 'wide', tilt: Math.sin(t * 3) * 0.1 })
              }, rotAt(s, px))
            } else {
              at(ctx, px, py, u, dir, () => {
                drawReindeer(ctx, { run: run + i * 0.9, stride: 1, bell: true, glow })
              }, rotAt(s, px))
            }
          }
          if (gift === 'falling') {
            at(ctx, gx, gy - 5 * s.u, s.u, 1, () => {
              ctx.rotate(grot)
              drawPresent(ctx, 0, 5, 10, 10, giftCol, C.gold)
            })
          } else if (gift === 'landed') {
            const q = 0.3 * (1 - seg(gt, 0, 0.3))
            at(ctx, gx, gy, s.u, 1, () => {
              groundShadow(ctx, 0, 7)
              ctx.scale(1 + q, 1 - q)
              drawPresent(ctx, 0, 0, 10, 10, giftCol, C.gold)
            })
          }
          if (gift === 'carried' || (gift === 'landed' && gt > 1.2)) {
            const has = gift === 'carried'
            at(ctx, ex, s.ground, s.u, dir, () => {
              groundShadow(ctx, 0, 8)
              const a = drawElf(ctx, ELF_A, {
                walk: ewalk, stride: 1, lean: 0.24, mouth: has ? 'grin' : 'o',
                armF: has ? 2.8 : undefined, armB: has ? 3.4 : undefined, elbowF: has ? 0.2 : undefined, elbowB: has ? -0.2 : undefined,
              })
              if (has) drawPresent(ctx, a.head.x - 1, a.crown.y - 9, 10, 10, giftCol, C.gold)
            })
          }
        },
      })
    },
  }
}

// ─── The enormous present ────────────────────────────────────────────────────
// One elf hauls a parcel three times his size on a rope, a heave at a time. A
// second elf rides on top eating a mince pie and has not been noticed. When the
// first one stops to look back, the passenger ducks. The other time the ribbon
// gives way and what is inside turns out to be on a spring.

const bigPresent: ActDef = {
  id: 'christmas.big-present',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 100)
    const gag = chance(rng, 0.5) ? 'jack' : 'duck'
    const gagAt = along(stage, dir, range(rng, 0.45, 0.6))
    const [wrap, ribbon] = pick(rng, [['#2f80c2', C.gold], ['#7c3aed', C.mint], ['#1f8a4c', '#ff6b6b']] as const)
    const v = 70 * stage.u * pace(stage)
    const HOLD = gag === 'jack' ? 3 : 3.4
    const BX = -62
    const BW = 46
    const BH = 42
    let x = from
    let walk = 0
    let hold = 0
    let done = false
    let popped = false
    let sprung = 0
    return makeAct({
      update(s, dt, t) {
        if (!done && passed(x, gagAt, dir)) {
          done = true
          hold = HOLD
        }
        if (popped) sprung = Math.min(1, sprung + dt * 2.4)
        if (hold > 0) {
          hold -= dt
          if (gag === 'jack' && !popped && HOLD - hold > 0.7) {
            popped = true
            const bx = x + dir * BX * s.u
            burst(s, 'star', bx, s.ground - (BH + 6) * s.u, 16, SPARKLE, 150, [2.5, 5])
            burst(s, 'confetti', bx, s.ground - (BH + 6) * s.u, 14, BULBS, 130, [3, 5])
          }
          return true
        }
        const heave = Math.max(0, Math.sin(t * 3.6))
        x += dir * v * (0.3 + 1.4 * heave) * dt
        walk += dt * (3 + 9 * heave)
        if (heave > 0.5 && tick(t, dt, 7)) {
          s.particles.emit({ kind: 'dust', x: x + dir * (BX - 22) * s.u, y: s.ground - 2 * s.u, vx: -dir * 30 * s.u, vy: -12 * s.u, size: range(rng, 4, 7) * s.u, color: '#dbe7f3' })
        }
        return !passed(x, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const stalled = hold > 0
        const ht = HOLD - hold
        const heave = stalled ? 0 : Math.max(0, Math.sin(t * 3.6))
        const looking = stalled && ht > 0.9 && ht < HOLD - 0.6
        const bite = Math.max(0, Math.sin(t * 2.3))
        const rider = (y: number, hidden: boolean) => {
          ctx.save()
          ctx.translate(BX + 4, y)
          const a = drawElf(ctx, ELF_B, {
            armF: hidden ? 0.4 : 1.2 + bite * 0.4, elbowF: hidden ? 0.3 : 0.9 + bite * 0.4, armB: 0.3,
            mouth: hidden ? 'flat' : bite > 0.6 ? 'o' : 'puff', eyes: hidden ? 'wide' : 'normal', blink: blinking(s.time, 4),
            headTilt: Math.sin(t * 1.3) * 0.05,
          })
          if (!hidden) {
            // The mince pie.
            fillEll(ctx, a.handF.x + 1, a.handF.y - 1, 3.1, 1.9, '#d09a55')
            fillEll(ctx, a.handF.x + 1, a.handF.y - 1.9, 2.5, 1.2, '#f1d79a')
            star(ctx, a.handF.x + 1, a.handF.y - 2, 1, '#d09a55')
          }
          ctx.restore()
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, BX, 27)
          const duck = gag === 'duck' && stalled ? easeInOut(seg(ht, 0.45, 0.8)) * (1 - easeInOut(seg(ht, HOLD - 0.5, HOLD - 0.1))) : 0
          if (!popped) rider(-BH + 14 + duck * 25, duck > 0.5)
          if (popped) {
            // The lid has gone back on its hinge.
            ctx.save()
            ctx.translate(BX - BW / 2, -BH)
            ctx.rotate(-1.9 * easeOut(sprung))
            fillRR(ctx, 0, -5, BW, 6, 1.5, shade(wrap, 0.14))
            fillRR(ctx, BW * 0.43, -5, BW * 0.14, 6, 0, ribbon)
            ctx.restore()
          }
          drawPresent(ctx, BX, 0, BW, BH, wrap, ribbon, !popped)
          // A gift tag on a string.
          line(ctx, BX + 14, -BH + 7, BX + 17, -BH + 14, 0.7, C.white)
          fillRR(ctx, BX + 13.5, -BH + 13, 7, 9, 1.2, C.cream)
          line(ctx, BX + 15, -BH + 17, BX + 19, -BH + 17, 0.7, C.tan)
          line(ctx, BX + 15, -BH + 19.4, BX + 18, -BH + 19.4, 0.7, C.tan)
          if (popped) {
            fillRR(ctx, BX - BW / 2 + 2, -BH - 1.4, BW - 4, 3.4, 1.7, '#27303f')
            const bobbing = stalled ? Math.sin(t * 6) * 2 * (1 - seg(ht, 1.2, 2.6)) : Math.sin(t * 3.6 * 2) * 3
            const sh = 30 * easeBack(sprung) + bobbing * sprung
            // Spring.
            ctx.beginPath()
            ctx.moveTo(BX, -BH)
            for (let i = 1; i <= 8; i++) ctx.lineTo(BX + (i % 2 ? 5 : -5) * (i < 8 ? 1 : 0), -BH - (sh * i) / 8)
            ctx.lineWidth = 1.5
            ctx.lineJoin = 'round'
            ctx.strokeStyle = C.grey
            ctx.stroke()
            // Jack: a ruff, a round face, a red nose and a great many teeth.
            const jy = -BH - sh - 8
            for (let i = -2; i <= 2; i++) fillPoly(ctx, [BX + i * 4 - 3, jy + 7, BX + i * 4, jy + 12, BX + i * 4 + 3, jy + 7], i % 2 ? C.yellow : C.red)
            fillCirc(ctx, BX, jy, 8.5, C.cream)
            fillCirc(ctx, BX - 3.2, jy - 1.5, 1.3, C.ink)
            fillCirc(ctx, BX + 3.6, jy - 1.5, 1.3, C.ink)
            fillCirc(ctx, BX + 0.4, jy + 1.4, 2, C.red)
            ctx.beginPath()
            ctx.arc(BX + 0.2, jy + 2.6, 4.6, Math.PI * 0.12, Math.PI * 0.88)
            ctx.closePath()
            ctx.fillStyle = C.white
            ctx.fill()
            fillEll(ctx, BX - 6, jy + 2, 1.8, 1.2, 'rgba(244,114,128,0.5)')
            fillEll(ctx, BX + 6.6, jy + 2, 1.8, 1.2, 'rgba(244,114,128,0.5)')
            fillPoly(ctx, [BX - 8, jy - 4, BX - 12, jy - 13, BX - 2, jy - 8], C.plum)
            fillPoly(ctx, [BX + 8, jy - 4, BX + 12, jy - 13, BX + 2, jy - 8], C.green)
            fillCirc(ctx, BX - 12, jy - 13, 1.5, C.gold)
            fillCirc(ctx, BX + 12, jy - 13, 1.5, C.gold)
            // The passenger has gone up with him and carries on eating.
            rider(jy - 7 + 14, false)
          }
          // The rope: taut on the heave, slack when he lets go.
          const ringX = BX + BW / 2
          const ringY = -BH * 0.55
          if (looking) {
            poly(ctx, [ringX, ringY, ringX + 5, -1, ringX + 18, -0.6, -8, -0.8], 1.3, C.tan)
          }
          ctx.save()
          if (looking) ctx.scale(-1, 1)
          groundShadow(ctx, 0, 8)
          const a = drawElf(ctx, ELF_A, looking
            ? { armF: gag === 'duck' ? 2.5 : 0.4, elbowF: gag === 'duck' ? 1.9 : 0.3, mouth: gag === 'jack' ? 'o' : 'flat', eyes: gag === 'jack' ? 'wide' : 'normal', blink: blinking(s.time, 2) }
            : {
                walk, stride: stalled ? 0 : 0.45 + heave * 0.55, lean: stalled ? 0.05 : 0.4 + heave * 0.16,
                armF: -1.0, armB: -1.25, elbowF: -0.3, elbowB: -0.2,
                mouth: heave > 0.3 ? 'puff' : 'flat', eyes: heave > 0.55 ? 'closed' : 'normal',
              })
          ctx.restore()
          if (!looking) {
            const sag = (1 - heave) * 5
            ctx.beginPath()
            ctx.moveTo(a.handB.x, a.handB.y)
            ctx.quadraticCurveTo((a.handB.x + ringX) / 2, (a.handB.y + ringY) / 2 + sag, ringX, ringY)
            ctx.lineWidth = 1.3
            ctx.lineCap = 'round'
            ctx.strokeStyle = C.tan
            ctx.stroke()
            if (!stalled && heave > 0.4) sweat(ctx, a.head.x, a.head.y - 6, t)
          }
        })
        if (looking) at(ctx, x, s.ground, s.u, 1, () => bubble(ctx, 0, -46, gag === 'jack' ? '!' : '?', { color: gag === 'jack' ? C.crimson : C.ink }))
      },
    })
  },
}

// ─── Decorating the tree ─────────────────────────────────────────────────────
// Dad carries a fir on over his shoulder, stands it up and decorates it at
// silent-film speed: baubles, tinsel, lights, and the star on tiptoe. Then
// either the star proves too heavy and the whole thing leans slowly over on
// top of him, or the dog leaves with one end of the tinsel.

const TINSEL = [-17, -11, 14, -17, -12, -24, 10, -29, -8, -36, 6, -41, -3, -48, 2, -53]
const BAUBLES: [number, number, string][] = [
  [-12, -12.5, C.red], [1, -13.5, C.gold], [12, -12, C.sky], [-8, -24, C.purple], [6, -23.5, C.orange],
  [-4, -34.5, C.sky], [6, -35, C.red], [0, -45.5, C.gold], [-1, -24.5, C.pink],
]

/**
 * A small fir in a red tub, about 62 units tall. `baubles` counts how many have
 * popped on (fractions animate the newest), `tinsel` is how much of the garland
 * is still wound on from the top, `lights` and `topper` are 0..1.
 */
function drawTree(ctx: Ctx, time: number, baubles = 0, tinsel = 0, lights = 0, topper = 0) {
  fillRR(ctx, -2.4, -11, 4.8, 8, 1, C.brown)
  fillPoly(ctx, [-7.5, -8, 7.5, -8, 5.6, 0, -5.6, 0], '#c62f3d')
  fillRR(ctx, -8.2, -9.4, 16.4, 2.8, 1.4, shade('#c62f3d', 0.16))
  for (let i = 0; i < 4; i++) {
    const by = -9 - i * 11
    const hw = 21 - i * 4.2
    const ty = by - 19
    ctx.beginPath()
    ctx.moveTo(0, ty)
    ctx.lineTo(hw, by)
    ctx.quadraticCurveTo(hw * 0.5, by - 3.2, 0, by - 0.6)
    ctx.quadraticCurveTo(-hw * 0.5, by - 3.2, -hw, by)
    ctx.closePath()
    ctx.fillStyle = i % 2 ? '#2f8a55' : '#277a4a'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, ty)
    ctx.lineTo(hw, by)
    ctx.quadraticCurveTo(hw * 0.5, by - 3.2, hw * 0.2, by - 2)
    ctx.closePath()
    ctx.fillStyle = 'rgba(160,235,170,0.2)'
    ctx.fill()
    // A dab of snow on each tip.
    fillEll(ctx, -hw + 2, by - 1.2, 2.6, 1.2, C.white, 0.5)
    fillEll(ctx, hw - 2, by - 1.2, 2.6, 1.2, C.white, -0.5)
  }
  if (tinsel > 0.01) {
    const segs = TINSEL.length / 2 - 1
    const upto = segs * (1 - clamp(tinsel))
    ctx.beginPath()
    for (let i = segs; i >= 0; i--) {
      if (i < Math.floor(upto)) break
      let px = TINSEL[i * 2]
      let py = TINSEL[i * 2 + 1]
      if (i < upto) {
        const f = upto - i
        px = lerp(px, TINSEL[i * 2 + 2], f)
        py = lerp(py, TINSEL[i * 2 + 3], f)
      }
      if (i === segs) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = C.gold
    ctx.stroke()
    ctx.lineWidth = 0.8
    ctx.strokeStyle = '#fff3c4'
    ctx.stroke()
  }
  if (lights > 0.01) {
    for (let j = 0; j < 4; j++) {
      const by = -9 - j * 11
      const hw = (21 - j * 4.2) * 0.74
      for (let k = 0; k < 4 - (j > 2 ? 1 : 0); k++) {
        const i = j * 4 + k
        const f = k / (3 - (j > 2 ? 1 : 0)) - 0.5
        const lx = f * 2 * hw
        const ly = by - 6.5 + (1 - 4 * f * f) * 2
        // Slow colour changes and a gentle swell: never a flash.
        const col = BULBS[(i + Math.floor(time * 0.35 + i * 0.37)) % BULBS.length]
        const a = lights * (0.7 + 0.3 * Math.sin(time * 1.5 + i * 2.1))
        ctx.globalAlpha = a * 0.22
        fillCirc(ctx, lx, ly, 3.4, col)
        ctx.globalAlpha = a
        fillCirc(ctx, lx, ly, 1.3, col)
      }
    }
    ctx.globalAlpha = 1
  }
  for (let i = 0; i < BAUBLES.length; i++) {
    const k = clamp(baubles - i)
    if (k <= 0) break
    const [bx, by, col] = BAUBLES[i]
    const r = 2.5 * easeBack(k)
    fillRR(ctx, bx - 0.7, by - r - 1.2, 1.4, 1.6, 0.4, C.gold)
    fillCirc(ctx, bx, by, r, col)
    fillCirc(ctx, bx - r * 0.35, by - r * 0.35, r * 0.3, 'rgba(255,255,255,0.7)')
  }
  if (topper > 0.01) {
    const r = 6.5 * easeBack(clamp(topper))
    ctx.globalAlpha = 0.2
    fillCirc(ctx, 0, -64, r * 1.5, C.yellow)
    ctx.globalAlpha = 1
    star(ctx, 0, -64, r, C.gold, Math.sin(time * 1.2) * 0.08)
    star(ctx, 0, -64, r * 0.5, '#fff3c4', Math.sin(time * 1.2) * 0.08)
  }
}

/** The lower end of the tinsel while `tinsel` of it is left, in tree units. */
function tinselEnd(tinsel: number): Pt {
  const segs = TINSEL.length / 2 - 1
  const upto = Math.min(segs - 0.001, segs * (1 - clamp(tinsel)))
  const i = Math.floor(upto)
  const f = upto - i
  return { x: lerp(TINSEL[i * 2], TINSEL[i * 2 + 2], f), y: lerp(TINSEL[i * 2 + 1], TINSEL[i * 2 + 3], f) }
}

const tree: ActDef = {
  id: 'christmas.tree',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const gag = pick(rng, ['tip', 'dog', 'plain'] as const)
    const look: Look = chance(rng, 0.5) ? { ...CAST.dad, scarf: C.red } : { ...CAST.mum, scarf: C.mint, hat: 'bobble', hatColor: C.crimson }
    const spot = along(stage, dir, range(rng, 0.36, 0.5))
    const GAG = gag === 'tip' ? 4.4 : gag === 'dog' ? 3.2 : 2.2
    let x = from
    let walk = 0
    let phase: 'in' | 'stand' | 'decor' | 'gag' | 'out' = 'in'
    let pt = 0
    let tx = 0 // where the tree stands
    let starred = false
    let dogX = from - dir * 40 * stage.u
    let dogRun = 0
    let tinsel = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'in') {
          x += dir * 76 * s.u * pace(s) * dt
          walk += dt * 10
          if (passed(x, spot, dir)) {
            phase = 'stand'
            pt = 0
            tx = x + dir * 26 * s.u
          }
        } else if (phase === 'stand') {
          if (pt > 0.9) {
            phase = 'decor'
            pt = 0
          }
        } else if (phase === 'decor') {
          walk += dt * 22
          tinsel = seg(pt, 2.6, 3.4)
          if (!starred && pt > 5) {
            starred = true
            burst(s, 'star', tx, s.ground - 64 * s.u, 10, SPARKLE, 80, [2, 4])
          }
          if (pt > 5.6) {
            phase = 'gag'
            pt = 0
          }
        } else if (phase === 'gag') {
          if (gag === 'dog') {
            dogX += dir * 190 * s.u * dt
            dogRun += dt * 16
            // Once the dog is past the tree the garland pays out behind it.
            const past = ((dogX - tx) * dir) / s.u
            tinsel = 1 - seg(past, 0, 150)
          }
          const dogGone = gag !== 'dog' || passed(dogX, dir === 1 ? s.w + 60 * s.u : -60 * s.u, dir)
          if (pt > GAG && dogGone) {
            phase = 'out'
            pt = 0
            x = tx - dir * 15 * s.u
          }
        } else {
          x += dir * 68 * s.u * pace(s) * dt
          walk += dt * 9
          return !passed(x, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const baubles = phase === 'decor' ? pt * 2.2 : phase === 'gag' || phase === 'out' ? 20 : 0
        const lights = phase === 'decor' ? seg(pt, 3.4, 4.2) : phase === 'gag' || phase === 'out' ? 1 : 0
        const topper = phase === 'decor' ? seg(pt, 5, 5.3) : phase === 'gag' || phase === 'out' ? 1 : 0
        const paint = () => drawTree(ctx, s.time, baubles, tinsel, lights, topper)
        // Where he is while he scurries round it, hanging things.
        let px = x
        let facing: Dir = dir
        let pose: Pose = { walk, stride: 0.85, blink: blinking(s.time, 2) }
        if (phase === 'in') {
          pose = { ...pose, armF: 2.3, elbowF: 0.9, lean: 0.1 }
        } else if (phase === 'stand') {
          pose = { armF: 1.5, armB: 1.3, elbowF: 0.3, lean: 0.12, mouth: 'puff' }
        } else if (phase === 'decor') {
          if (pt < 4.5) {
            const sw = Math.cos(pt * 3.4)
            px = tx - dir * sw * 25 * u
            facing = (Math.sin(pt * 3.4) * dir > 0 ? 1 : -1) as Dir
            pose = { walk, stride: 1, armF: 2.2 + Math.sin(pt * 14) * 0.5, elbowF: 0.5, lean: 0.12, mouth: 'smile' }
          } else {
            px = tx - dir * 24 * u
            const reach = seg(pt, 4.6, 5) * (1 - seg(pt, 5.2, 5.6))
            pose = { armF: 1.2 + reach * 1.6, elbowF: 0.4, lift: reach * 5, lean: reach * 0.12, mouth: reach > 0.5 ? 'o' : 'grin' }
          }
        } else if (phase === 'gag') {
          px = tx - dir * 24 * u
          if (gag === 'plain') pose = { armF: 0.9, armB: -0.9, elbowF: -1.6, elbowB: 1.6, lean: -0.08, mouth: 'grin', eyes: pt > 0.6 && pt < 1.6 ? 'closed' : 'normal' }
          else if (gag === 'dog') pose = { armF: pt > 0.5 ? 2.2 + Math.sin(t * 16) * 0.2 : 0.4, elbowF: 0.3, mouth: pt > 0.5 ? 'o' : 'smile', eyes: pt > 0.5 ? 'wide' : 'normal', lean: 0.1 }
          else {
            const caught = pt > 1.9
            pose = caught
              ? { armF: 2.5, armB: 2.2, elbowF: 0.2, elbowB: 0.2, lean: pt < 2.6 ? -0.2 : 0.15, crouch: pt < 2.6 ? 0.3 : 0, mouth: 'puff', eyes: 'closed' }
              : { armF: pt > 0.9 ? 2.1 : 0.4, mouth: pt > 0.9 ? 'o' : 'grin', eyes: pt > 0.9 ? 'wide' : 'normal', lean: pt > 0.9 ? -0.15 : 0 }
          }
        } else {
          pose = { walk, stride: 0.7, armF: 1.3, armB: 1.5, elbowF: 0.5, elbowB: 0.3, lean: -0.06, mouth: gag === 'dog' ? 'flat' : 'smile', blink: blinking(s.time, 2) }
        }
        // The tree.
        if (phase === 'in') {
          at(ctx, x - dir * 2 * u, s.ground - 37 * u + Math.sin(walk * 2) * u, u, dir, paint, -dir * 1.42)
        } else if (phase === 'stand') {
          const k = easeInOut(seg(pt, 0, 0.75))
          const wob = Math.sin(pt * 22) * 0.06 * seg(pt, 0.7, 0.75) * (1 - seg(pt, 0.75, 0.9))
          at(ctx, lerp(x - dir * 2 * u, tx, k), s.ground - 37 * u * (1 - k), u, dir, () => {
            if (k > 0.95) groundShadow(ctx, 0, 12)
            paint()
          }, -dir * (1.42 * (1 - k) + wob))
        } else if (phase === 'out') {
          at(ctx, x + dir * 15 * u, s.ground - (4 + Math.abs(Math.sin(walk)) * 1.5) * u, u, dir, paint, -dir * 0.07)
        } else {
          let tilt = 0
          if (phase === 'gag' && gag === 'tip') {
            // Slowly over, a held breath, then heaved back with a wobble.
            tilt = pt < 1.9 ? 0.5 * easeIn(seg(pt, 0.3, 1.9)) : pt < 2.6 ? 0.5 + Math.sin(t * 30) * 0.012 : 0.5 * (1 - easeBack(seg(pt, 2.6, 3.5)))
          }
          if (phase === 'gag' && gag === 'dog' && tinsel > 0 && tinsel < 1) tilt = -Math.sin(t * 26) * 0.035
          at(ctx, tx, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 12)
            paint()
          }, -dir * tilt)
        }
        at(ctx, px, s.ground, u, facing, () => {
          groundShadow(ctx, 0, 10)
          const a = drawPerson(ctx, look, pose)
          if (phase === 'decor' && pt > 4.5 && pt < 5) star(ctx, a.handF.x + 1, a.handF.y - 4, 5.5, C.gold)
          if (phase === 'decor' && pt < 2.4) fillCirc(ctx, a.handF.x + 1, a.handF.y - 2, 2.3, BULBS[Math.floor(pt * 2.2) % BULBS.length])
          if (phase === 'gag' && gag === 'tip' && pt > 2 && pt < 3.5) sweat(ctx, a.head.x, a.head.y - 8, t)
        })
        if (phase === 'gag' && gag === 'tip' && pt > 0.9 && pt < 1.9) at(ctx, px, s.ground, u, 1, () => bubble(ctx, 0, -62, '!', { color: C.crimson }))
        if (phase === 'gag' && gag === 'dog') {
          let mouth: Pt = { x: 0, y: 0 }
          at(ctx, dogX, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 14)
            mouth = drawDog(ctx, DOG, { run: dogRun, stride: 1, wag: t * 18 }).mouth
          })
          const mx = dogX + dir * mouth.x * u
          const my = s.ground + mouth.y * u
          if (passed(dogX, tx, dir)) {
            // Tinsel from the tree to the dog while any is left, then a tail of it.
            const e = tinselEnd(Math.max(tinsel, 0.001))
            const ax = tinsel > 0 ? tx + dir * e.x * u : mx - dir * 60 * u
            const ay = tinsel > 0 ? s.ground + e.y * u : s.ground - 4 * u
            ctx.beginPath()
            ctx.moveTo(ax, ay)
            ctx.quadraticCurveTo((ax + mx) / 2, Math.max(ay, my) + 5 * u + Math.sin(t * 9) * 3 * u, mx, my)
            ctx.lineCap = 'round'
            ctx.lineWidth = 2.2 * u
            ctx.strokeStyle = C.gold
            ctx.stroke()
            ctx.lineWidth = 0.8 * u
            ctx.strokeStyle = '#fff3c4'
            ctx.stroke()
          }
        }
      },
    })
  },
}

// ─── Fairy lights ────────────────────────────────────────────────────────────
// Two people string coloured lights on short posts the whole length of the
// floor. One bulb is dead. Somebody small comes back, gives it a tap, and
// every light goes out; another tap and they are all on. (Sometimes they all
// come back red first.) The string fades away from one end before the act ends.

const fairyLights: ActDef = {
  id: 'christmas.fairy-lights',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const P = 46 * stage.u
    const STEP = 7.6 * stage.u
    const count = Math.floor(stage.w / STEP)
    const dead = Math.floor(count * range(rng, 0.64, 0.8))
    const mono = chance(rng, 0.5)
    const pair: Look[] = chance(rng, 0.5)
      ? [{ ...CAST.dad, hat: 'bobble', hatColor: C.green }, { ...CAST.mum, scarf: C.yellow }]
      : [{ ...CAST.grandad, scarf: C.red }, { ...CAST.gardener, hat: 'bobble', hatColor: C.sky, scarf: C.white }]
    const kid: Look = chance(rng, 0.5) ? { ...CAST.kid, hat: 'bobble', hatColor: C.red, scarf: C.sky } : { ...CAST.girl, hat: 'earmuffs', hatColor: C.pink, scarf: C.yellow }
    const speed = 92 * stage.u * pace(stage)
    const X = (d: number) => (dir === 1 ? d : stage.w - d)
    const deadX = X(dead * STEP)
    const wireH = (d: number) => {
      const f = d / P - Math.floor(d / P)
      return (17 - 36 * f * (1 - f)) * stage.u
    }
    let xA = from
    let walk = 0
    let strung = 0
    let mode: 'on' | 'off' | 'mono' = 'on'
    let mended = false
    let phase: 'string' | 'kid-in' | 'tap' | 'kid-out' | 'glow' | 'fade' = 'string'
    let pt = 0
    let kx = to
    let kwalk = 0
    let fade = -50
    return makeAct({
      update(s, dt) {
        pt += dt
        const tapAt = (when: number) => pt >= when && pt - dt < when
        if (phase === 'string') {
          xA += dir * speed * dt
          walk += dt * 11.5
          const xB = xA - dir * 38 * s.u
          strung = clamp(dir === 1 ? xB : s.w - xB, 0, s.w)
          if (passed(xB, to, dir)) {
            phase = 'kid-in'
            pt = 0
          }
        } else if (phase === 'kid-in') {
          kx -= dir * 88 * s.u * dt
          kwalk += dt * 11
          if (!passed(kx, deadX + dir * 13 * s.u, dir)) {
            phase = 'tap'
            pt = 0
          }
        } else if (phase === 'tap') {
          if (tapAt(0.6)) mode = 'off'
          if (tapAt(1.8)) {
            mode = mono ? 'mono' : 'on'
            mended = true
          }
          if (mono && tapAt(3)) mode = 'on'
          if (tapAt(0.6) || tapAt(1.8) || (mono && tapAt(3))) burst(s, 'star', deadX, s.ground - 10 * s.u, 4, SPARKLE, 50, [1.5, 3])
          if (pt > (mono ? 4 : 2.9)) {
            phase = 'kid-out'
            pt = 0
          }
        } else if (phase === 'kid-out') {
          kx += dir * 92 * s.u * dt
          kwalk += dt * 11
          if (passed(kx, to, dir)) {
            phase = 'glow'
            pt = 0
          }
        } else if (phase === 'glow') {
          if (pt > 1.6) phase = 'fade'
        } else {
          fade += (dt * s.w) / 2.2
          return fade < s.w + 10
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const soft = (d: number) => clamp((d - fade) / (50 * u))
        // Posts.
        for (let d = 0; d <= strung; d += P) {
          const a = soft(d)
          if (a <= 0) continue
          ctx.globalAlpha = a
          line(ctx, X(d), s.ground, X(d), s.ground - 17 * u, 1.8 * u, C.brown)
          fillCirc(ctx, X(d), s.ground - 17.6 * u, 1.5 * u, C.tan)
        }
        // The wire, in swags from post to post.
        const d0 = Math.max(0, fade)
        if (strung > d0) {
          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.moveTo(X(d0), s.ground - wireH(d0))
          for (let d = d0 + P / 8; d < strung; d += P / 8) ctx.lineTo(X(d), s.ground - wireH(d))
          ctx.lineTo(X(strung), s.ground - wireH(strung))
          ctx.lineWidth = 0.9 * u
          ctx.lineJoin = 'round'
          ctx.strokeStyle = '#5f8a72'
          ctx.stroke()
        }
        // Bulbs.
        for (let i = Math.max(1, Math.ceil(d0 / STEP)); i * STEP <= strung; i++) {
          const d = i * STEP
          const bx = X(d)
          const by = s.ground - wireH(d) + 2.4 * u
          const dud = mode === 'off' || (i === dead && !mended)
          const col = dud ? C.slate : mode === 'mono' ? C.red : BULBS[i % BULBS.length]
          const a = soft(d)
          if (!dud) {
            const tw = 0.72 + 0.28 * Math.sin(s.time * 1.4 + i * 2.4)
            ctx.globalAlpha = a * tw * 0.2
            fillCirc(ctx, bx, by, 3.8 * u, col)
            ctx.globalAlpha = a * tw
          } else ctx.globalAlpha = a
          fillEll(ctx, bx, by, 1.5 * u, 2 * u, col)
        }
        ctx.globalAlpha = 1
        if (phase === 'string') {
          const xB = xA - dir * 38 * u
          const sag = Math.max(0, Math.cos(((dir === 1 ? xB : s.w - xB) / P) * TAU))
          const bend = sag * sag * sag
          line(ctx, X(strung), s.ground - wireH(strung), xA + dir * 9 * u, s.ground - 25 * u, 0.9 * u, '#5f8a72')
          at(ctx, xB, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 10)
            drawPerson(ctx, pair[1], { walk, stride: 0.85, crouch: bend * 0.55, lean: 0.1 + bend * 0.3, armF: 0.7, elbowF: 0.2, mouth: 'smile', blink: blinking(s.time, 6) })
          })
          at(ctx, xA, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 10)
            const a = drawPerson(ctx, pair[0], { walk, stride: 0.85, armF: 1.15, elbowF: 0.45, armB: 0.95, elbowB: 0.6, mouth: 'smile', blink: blinking(s.time, 1) })
            // The cable drum, turning as it pays out.
            const cx = a.handF.x + 1
            const cy = a.handF.y - 1
            fillCirc(ctx, cx, cy, 7, C.wood)
            fillCirc(ctx, cx, cy, 5.2, '#5f8a72')
            for (let k = 0; k < 3; k++) {
              const an = -walk * 0.7 + (k * TAU) / 3
              fillCirc(ctx, cx + Math.cos(an) * 3.4, cy + Math.sin(an) * 3.4, 1, BULBS[k])
            }
            fillCirc(ctx, cx, cy, 1.6, C.tan)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, pair[0].skin)
          })
        }
        if (phase === 'kid-in' || phase === 'tap' || phase === 'kid-out') {
          const tapping = phase === 'tap'
          const poke = tapping ? Math.max(1 - Math.abs(pt - 0.6) * 5, 1 - Math.abs(pt - 1.8) * 5, mono ? 1 - Math.abs(pt - 3) * 5 : 0, 0) : 0
          const last = mono ? 3 : 1.8
          at(ctx, kx, s.ground, u * 0.82, (phase === 'kid-out' ? dir : -dir) as Dir, () => {
            groundShadow(ctx, 0, 9)
            drawPerson(ctx, kid, tapping
              ? {
                  crouch: pt > last + 0.3 ? 0 : 0.55, lean: pt > last + 0.3 ? 0 : 0.25, armF: pt > last + 0.3 ? 2.8 : 0.75 + poke * 0.3, elbowF: 0.15, armB: pt > last + 0.3 ? -2.8 : undefined,
                  lift: pt > last + 0.3 ? Math.abs(Math.sin((pt - last) * 9)) * 5 : 0,
                  mouth: pt > last ? 'grin' : mode === 'on' ? 'flat' : 'o', eyes: mode === 'off' || (mode === 'mono' && pt < 3) ? 'wide' : 'normal',
                }
              : { walk: kwalk, stride: 0.85, mouth: 'smile', blink: blinking(s.time, 3) })
          })
          if (tapping && mode === 'off') at(ctx, kx, s.ground, u, 1, () => bubble(ctx, 0, -50, '!', { color: C.crimson }))
          if (tapping && mode === 'mono' && pt > 2.2 && pt < 3) at(ctx, kx, s.ground, u, 1, () => bubble(ctx, 0, -50, '?'))
        }
        void t
      },
    })
  },
}

// ─── Carol singers ───────────────────────────────────────────────────────────
// Three or four of them, well wrapped up and all different heights, with a
// lantern on a pole. A robin comes down to listen and stays on the lantern
// when they move on. Either one of them has had the sheet upside down the
// whole time, or the smallest one has the biggest voice.

const NOTE_COLORS = [C.white, C.gold, C.mint, C.pink]

function drawLantern(ctx: Ctx, x: number, top: number, time: number) {
  // Pole, hook, and a lamp with a slow warm flicker.
  line(ctx, x, top, x, top + 56, 1.6, C.wood)
  poly(ctx, [x, top, x + 3, top - 3, x + 6, top - 1, x + 6, top + 2], 1.2, C.grey)
  const g = 0.75 + Math.sin(time * 2.3) * 0.12 + Math.sin(time * 3.7) * 0.08
  ctx.globalAlpha = 0.16 * g
  fillCirc(ctx, x + 6, top + 8, 13, C.amber)
  ctx.globalAlpha = 0.24 * g
  fillCirc(ctx, x + 6, top + 8, 7.5, C.yellow)
  ctx.globalAlpha = 1
  fillPoly(ctx, [x + 1.5, top + 3.5, x + 6, top + 0.5, x + 10.5, top + 3.5], C.slate)
  fillRR(ctx, x + 2.4, top + 3.5, 7.2, 9.5, 1, '#fde68a')
  fillEll(ctx, x + 6, top + 9, 1.5, 2.6, C.amber)
  line(ctx, x + 2.4, top + 3.5, x + 2.4, top + 13, 0.9, C.slate)
  line(ctx, x + 9.6, top + 3.5, x + 9.6, top + 13, 0.9, C.slate)
  fillRR(ctx, x + 1.5, top + 12.6, 9, 1.8, 0.8, C.slate)
}

function drawSheet(ctx: Ctx, x: number, y: number, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  fillRR(ctx, -4.5, -6, 9, 12, 1, C.cream)
  line(ctx, -2.6, -4.2, 1.4, -4.2, 0.9, C.red)
  // One big quaver, so you can tell which way up it is.
  fillEll(ctx, -1.2, 3, 1.9, 1.4, C.ink, -0.4)
  line(ctx, 0.5, 2.6, 0.5, -2.4, 0.8, C.ink)
  line(ctx, 0.5, -2.4, 2.8, -1.2, 0.8, C.ink)
  ctx.restore()
}

const carolSingers: ActDef = {
  id: 'christmas.carol-singers',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 110)
    const n = chance(rng, 0.5) ? 4 : 3
    const gag = chance(rng, 0.5) ? 'upside' : 'loud'
    const sizes = n === 4 ? [1, 0.8, 0.64, 0.92] : [1, 0.66, 0.88]
    const looks: Look[] = [
      { ...CAST.grandad, scarf: C.red, gloves: C.tan },
      { ...CAST.girl, hat: 'bobble', hatColor: C.mint, hatTrim: C.white, scarf: C.yellow, gloves: C.pink },
      { ...CAST.kid, hat: 'earmuffs', hatColor: C.sky, scarf: C.orange, gloves: C.red },
      { ...CAST.mum, hat: 'bobble', hatColor: C.crimson, hatTrim: C.white, scarf: C.sky, gloves: C.white },
    ]
    if (n === 3) looks.splice(1, 1)
    const small = sizes.indexOf(Math.min(...sizes))
    const odd = gag === 'upside' ? n - 1 : small
    const spot = along(stage, dir, range(rng, 0.52, 0.62))
    const GAP = 23
    const SING = 8.6
    let x = from
    let walk = 0
    let phase: 'in' | 'sing' | 'out' = 'in'
    let pt = 0
    let poleX = 9
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'in') {
          x += dir * 72 * s.u * pace(s) * dt
          walk += dt * 9.5
          if (passed(x, spot, dir)) {
            phase = 'sing'
            pt = 0
          }
        } else if (phase === 'sing') {
          if (tick(pt, dt, 2.8)) {
            const i = Math.floor(rng() * n)
            const k = sizes[i] * s.u
            s.particles.emit({
              kind: 'note', x: x - dir * i * GAP * s.u + dir * 11 * k, y: s.ground - 43 * k,
              vx: dir * range(rng, 4, 16) * s.u, vy: -range(rng, 18, 30) * s.u, size: range(rng, 2.8, 4) * s.u, color: pick(rng, NOTE_COLORS),
            })
          }
          if (gag === 'loud' && pt >= 4.6 && pt - dt < 4.6) {
            const k = sizes[small] * s.u
            s.particles.emit({ kind: 'note', x: x - dir * small * GAP * s.u + dir * 12 * k, y: s.ground - 44 * k, vx: dir * 14 * s.u, vy: -24 * s.u, size: 8.5 * s.u, color: C.gold, life: 3 })
          }
          if (pt > SING) {
            phase = 'out'
            pt = 0
          }
        } else {
          x += dir * 72 * s.u * pace(s) * dt
          walk += dt * 9.5
          return !passed(x, to, dir)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const singing = phase === 'sing'
        const blast = singing && gag === 'loud' && pt > 4.6 && pt < 5.8
        for (let i = n - 1; i >= 0; i--) {
          const k = sizes[i]
          at(ctx, x - dir * i * GAP * s.u, s.ground, s.u * k, dir, () => {
            groundShadow(ctx, 0, 10)
            const open = singing && (blast && i === small ? true : Math.sin(t * 5.2 + i * 1.9) > -0.2)
            const recoil = blast && i !== small
            const flipped = gag === 'upside' && i === odd
            const turn = flipped ? (phase === 'out' ? 1 : singing ? easeInOut(seg(pt, 5, 5.5)) : 0) : 1
            const a = drawPerson(ctx, looks[i], {
              walk: walk + i * 1.3,
              stride: singing ? 0 : 0.8,
              lean: singing ? (recoil ? -0.16 : Math.sin(t * 2 + i * 0.9) * 0.07) : 0.03,
              headTilt: singing ? (blast && i === small ? -0.25 : Math.sin(t * 2 + i * 0.9 + 1) * 0.08) : 0,
              armF: 1.0, elbowF: 1.1,
              armB: i === 0 ? 0.95 : 0.9, elbowB: i === 0 ? 0.75 : 1.2,
              mouth: open ? 'o' : flipped && singing && pt > 5.5 && pt < 7 ? 'flat' : 'smile',
              eyes: recoil ? 'wide' : open && i !== odd ? 'closed' : 'normal',
              blink: blinking(s.time, i),
            })
            drawSheet(ctx, a.handF.x + 2.5, a.handF.y - 4.5, 0.12 + Math.PI * (1 - turn))
            if (i === 0) {
              poleX = a.handB.x
              drawLantern(ctx, poleX, singing ? -62 : -66 + Math.sin(walk * 2) * 0.8, s.time)
              fillCirc(ctx, a.handB.x, a.handB.y, 2.7, looks[0].gloves ?? looks[0].skin)
            }
          })
        }
        if (singing && gag === 'upside' && pt > 3.4 && pt < 4.8) {
          at(ctx, x - dir * (odd - 1) * GAP * s.u, s.ground, s.u * sizes[odd - 1], 1, () => bubble(ctx, 0, -66, '?'))
        }
        // The robin: in from the sky, then it rides the lantern off stage.
        const perchX = x + dir * (poleX + 4) * s.u
        const perchY = s.ground - (phase === 'sing' ? 63.5 : 67.5) * s.u
        if (phase !== 'in' && !(singing && pt < 1.6)) {
          const k = singing ? easeOut(seg(pt, 1.6, 3.2)) : 1
          const startle = blast ? Math.sin(seg(pt, 4.6, 5.8) * Math.PI) : 0
          const flying = k < 1 || startle > 0.05
          const bx = lerp(perchX + dir * 190 * s.u, perchX, k)
          const by = lerp(perchY - 110 * s.u, perchY, k) - Math.sin(k * Math.PI) * 14 * s.u - startle * 18 * s.u
          at(ctx, bx, by, s.u, (k < 1 ? -dir : dir) as Dir, () => drawBird(ctx, t * 30, flying))
        }
      },
    })
  },
}

// ─── The snowman ─────────────────────────────────────────────────────────────
// He shuffles on, hears someone coming and goes rigid. They walk past. He
// tiptoes after them, and every time they look round he is a perfectly
// ordinary snowman again, only closer. Sometimes they come back and poke his
// nose to be sure.

interface SnowmanPose {
  /** Hop phase; 0 when standing. */
  hop: number
  lean: number
  /** Stick-arm directions, radians anticlockwise from straight ahead. */
  armF: number
  armB: number
  eyes: 'ahead' | 'side' | 'shut'
  grin: boolean
  /** Nose droop, for when it has just been poked. */
  nose?: number
}

function drawSnowman(ctx: Ctx, p: SnowmanPose) {
  const lift = Math.abs(Math.sin(p.hop)) * 4.5
  const squash = 1 - Math.max(0, Math.cos(p.hop * 2)) * 0.06 * (p.hop ? 1 : 0)
  const ball = (x: number, y: number, r: number) => {
    fillCirc(ctx, x, y, r, '#c5d9ea')
    fillCirc(ctx, x + r * 0.14, y - r * 0.14, r * 0.86, '#f3f8fc')
  }
  const arm = (sx: number, sy: number, a: number) => {
    const ex = sx + Math.cos(a) * 8
    const ey = sy - Math.sin(a) * 8
    const hx = ex + Math.cos(a + 0.35) * 6.5
    const hy = ey - Math.sin(a + 0.35) * 6.5
    poly(ctx, [sx, sy, ex, ey, hx, hy], 1.5, C.maple)
    line(ctx, hx, hy, hx + Math.cos(a + 1) * 3, hy - Math.sin(a + 1) * 3, 1.1, C.maple)
    line(ctx, hx, hy, hx + Math.cos(a - 0.5) * 3, hy - Math.sin(a - 0.5) * 3, 1.1, C.maple)
  }
  ctx.save()
  ctx.translate(0, -lift)
  ctx.scale(2 - squash, squash)
  ctx.rotate(p.lean)
  arm(-6, -31, p.armB)
  ball(0, -12, 13)
  ball(0.5, -30, 9.6)
  arm(6.5, -32, p.armF)
  // Coal buttons, and a scarf with a tail.
  for (let i = 0; i < 3; i++) fillCirc(ctx, 6.5 - i * 0.6, -34 + i * 4.6, 1.2, C.slate)
  ball(1.5, -44.5, 7.6)
  fillRR(ctx, -5.6, -39.6, 13.4, 3.6, 1.8, C.red)
  poly(ctx, [-4, -38, -8.5, -33, -9.5, -27.5], 3.2, C.red)
  line(ctx, -9.9, -29.5, -8.6, -29.2, 1, C.white)
  // Face.
  if (p.eyes === 'shut') {
    line(ctx, 3, -47, 5, -46.6, 1, C.ink)
    line(ctx, 6.8, -46.8, 8.4, -46.4, 1, C.ink)
  } else {
    const dx = p.eyes === 'side' ? 0.5 : 0
    fillCirc(ctx, 4 + dx, -47, 1.25, C.ink)
    fillCirc(ctx, 7.6 + dx, -46.8, 1.1, C.ink)
    fillCirc(ctx, 4.4 + dx * 2, -47.4, 0.4, C.white)
  }
  for (let i = 0; i < 4; i++) {
    const a = (p.grin ? 0.15 : 0.3) + i * (p.grin ? 0.5 : 0.28)
    fillCirc(ctx, 5.4 + Math.cos(a) * (p.grin ? 3.6 : 2.6) - 1.4, -43.6 + Math.sin(a) * (p.grin ? 2.6 : 1.2), 0.65, C.ink)
  }
  const droop = p.nose ?? 0
  fillPoly(ctx, [8, -45.6, 17, -44.2 + droop * 3, 8, -43], C.orange)
  // Top hat with a holly sprig.
  fillRR(ctx, -6.6, -52.6, 16, 2.6, 1.3, '#5b6b82')
  fillRR(ctx, -3.6, -63, 10.4, 11, 1.2, '#5b6b82')
  fillRR(ctx, -3.6, -55.6, 10.4, 2.6, 0.4, C.red)
  fillEll(ctx, 3.4, -55, 2.1, 1.1, C.green, 0.5)
  fillCirc(ctx, 5.4, -54.4, 0.9, '#ff6b6b')
  ctx.restore()
}

const snowman: ActDef = {
  id: 'christmas.snowman',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const gag = chance(rng, 0.5) ? 'poke' : 'plain'
    const look: Look = pick(rng, [
      { ...CAST.mum, hat: 'bobble', hatColor: C.purple, scarf: C.yellow },
      { ...CAST.dad, hat: 'bobble', hatColor: C.orange, scarf: C.green },
      { ...CAST.grandad, scarf: C.sky },
    ] as Look[])
    const s0 = along(stage, dir, 0.17)
    const stops = [0.4, 0.6, 0.8].map((f) => along(stage, dir, f))
    let sx = from
    let hop = 0
    let sstate: 'enter' | 'still' | 'follow' = 'enter'
    let stillT = 0
    let moving = false
    let relief = 0
    let px = from - dir * 20 * stage.u
    let pwalk = 0
    let pstate: 'walk' | 'pause' | 'look' | 'poke-in' | 'poke' = 'walk'
    let ptm = 0
    let looks = 0
    return makeAct({
      update(s, dt) {
        const v = 64 * s.u * pace(s)
        // The snowman.
        moving = false
        if (sstate === 'enter') {
          sx += dir * 52 * s.u * dt
          hop += dt * 9
          moving = true
          if (passed(sx, s0, dir)) sstate = 'still'
        } else if (sstate === 'still') {
          stillT += dt
          if (passed(px, sx + dir * 58 * s.u, dir)) sstate = 'follow'
        } else {
          const frozen = pstate === 'look' || pstate === 'poke-in' || pstate === 'poke'
          if (relief > 0) relief -= dt
          else if (!frozen && (px - sx) * dir > 32 * s.u) {
            sx += dir * v * 1.2 * dt
            hop += dt * 10
            moving = true
          }
        }
        if (!moving) hop = 0
        // The passer-by.
        ptm += dt
        if (sstate !== 'enter' && stillT > 0.5) {
          if (pstate === 'walk') {
            px += dir * v * dt
            pwalk += dt * 9.5
            if (looks < 3 && sstate === 'follow' && passed(px, stops[looks], dir)) {
              pstate = 'pause'
              ptm = 0
            }
          } else if (pstate === 'pause') {
            if (ptm > 0.5) {
              pstate = 'look'
              ptm = 0
              looks++
            }
          } else if (pstate === 'look') {
            if (ptm > 1.3) {
              pstate = gag === 'poke' && looks === 3 ? 'poke-in' : 'walk'
              ptm = 0
            }
          } else if (pstate === 'poke-in') {
            px -= dir * v * dt
            pwalk += dt * 9.5
            if (!passed(px, sx + dir * 27 * s.u, dir)) {
              pstate = 'poke'
              ptm = 0
            }
          } else if (ptm > 1.9) {
            pstate = 'walk'
            ptm = 0
            relief = 1.5
          }
        }
        return !(passed(sx, to, dir) && passed(px, to, dir))
      },
      draw(s, t) {
        const { ctx } = s
        const frozen = sstate !== 'enter' && !moving
        const watched = pstate === 'look' || pstate === 'poke-in' || pstate === 'poke'
        const poked = pstate === 'poke' && ptm > 0.5 && ptm < 1.3
        let pose: SnowmanPose
        if (moving) pose = { hop, lean: 0.14, armF: 0.75 + Math.sin(hop) * 0.25, armB: 0.45 - Math.sin(hop) * 0.25, eyes: 'side', grin: true }
        else if (relief > 0) pose = { hop: 0, lean: -0.05, armF: 1.75, armB: 2.8, eyes: 'shut', grin: false }
        else if (frozen && watched && looks === 2) pose = { hop: 0, lean: 0.2, armF: 1.1, armB: 2.3, eyes: 'ahead', grin: false }
        else if (frozen && watched && looks === 3) pose = { hop: 0, lean: 0, armF: 0.2, armB: 2.95, eyes: 'ahead', grin: false, nose: poked ? Math.abs(Math.sin(t * 20)) : 0 }
        else pose = { hop: 0, lean: 0, armF: 0.4, armB: 2.75, eyes: sstate === 'still' && stillT < 0.4 ? 'side' : 'ahead', grin: false }
        at(ctx, sx, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 14)
          drawSnowman(ctx, pose)
          if (relief > 0.3) sweat(ctx, 2, -52, t)
        })
        const back = pstate === 'look' || pstate === 'poke-in' || pstate === 'poke'
        at(ctx, px, s.ground, s.u, (back ? -dir : dir) as Dir, () => {
          groundShadow(ctx, 0, 10)
          const walking = pstate === 'walk' || pstate === 'poke-in'
          drawPerson(ctx, look, {
            walk: pwalk, stride: walking ? 0.8 : 0,
            armF: pstate === 'poke' && ptm < 1.3 ? 1.45 : pstate === 'poke' ? 2.5 : pstate === 'look' && ptm > 0.8 && looks < 3 ? 2.5 : undefined,
            elbowF: pstate === 'poke' && ptm < 1.3 ? 0.1 : pstate === 'poke' || pstate === 'look' ? 1.9 : undefined,
            lean: pstate === 'poke' && ptm < 1.3 ? 0.12 : 0,
            headTilt: pstate === 'pause' ? -0.1 : 0,
            mouth: pstate === 'pause' || back ? 'flat' : 'smile',
            eyes: pstate === 'pause' ? 'wide' : 'normal',
            blink: blinking(s.time, 3),
          })
        })
        if (pstate === 'pause' || (pstate === 'look' && ptm < 0.9)) at(ctx, px, s.ground, s.u, 1, () => bubble(ctx, 0, -62, '?'))
      },
    })
  },
}

// ─── Santa and the chimney ───────────────────────────────────────────────────
// A chimney pot rises out of the floor. Either a pair of boots is already
// kicking out of the top of it, and what follows them is no longer red; or he
// walks up, climbs in, and finds the sack is wider than the pot.

function drawChimney(ctx: Ctx) {
  fillRR(ctx, -13, -38, 26, 38, 1, '#b4532a')
  // Courses of brick, staggered.
  for (let r = 0; r < 6; r++) {
    const y = -38 + r * 6.4
    line(ctx, -12.4, y, 12.4, y, 0.7, '#e2a27c')
    for (let c = -1; c <= 1; c++) {
      const bx = c * 8.6 + (r % 2 ? 4.3 : 0)
      if (Math.abs(bx) < 12) line(ctx, bx, y, bx, y + 6.4, 0.7, '#e2a27c')
    }
  }
  fillRR(ctx, -13, -38, 4.5, 38, 1, 'rgba(60,20,10,0.25)')
  fillRR(ctx, -15.5, -43, 31, 5.4, 1.4, C.grey)
  fillPoly(ctx, [-6.6, -43, -5.4, -54, 5.4, -54, 6.6, -43], '#d9773c')
  fillPoly(ctx, [-6.6, -43, -5.4, -54, -3, -54, -3.8, -43], '#b85f2c')
  fillRR(ctx, -6.6, -56.4, 13.2, 3.2, 1.4, '#e58a4e')
  fillEll(ctx, 0, -56.2, 5, 1.1, '#27303f')
  // Snow on the ledge.
  fillEll(ctx, -9.5, -43.4, 5.4, 2.2, C.white)
  fillEll(ctx, 10, -43.4, 4.6, 1.9, C.white)
}

const POT_TOP = 56

const chimney: ActDef = {
  id: 'christmas.chimney',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const gag = chance(rng, 0.5) ? 'stuck' : 'sack'
    const cx = stage.w * range(rng, 0.38, 0.62)
    // In the stuck version he walks off whichever way is nearer.
    const side: Dir = cx > stage.w / 2 ? 1 : -1
    let x = gag === 'sack' ? from : cx
    let walk = 0
    let phase: 'walk' | 'jump' | 'drop' | 'tug' | 'wave' | 'kick' | 'pop' | 'cough' | 'leave' | 'sink' = gag === 'sack' ? 'walk' : 'kick'
    let pt = 0
    let rise = 0
    let sink = 0
    const soot = (s: Stage, n: number, speed = 60) => burst(s, 'dust', cx, s.ground - (POT_TOP + 2) * s.u, n, ['#6b7280', '#4b5563', '#9ca3af'], speed, [4, 8])
    return makeAct({
      update(s, dt) {
        pt += dt
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        if (gag === 'sack') {
          const stand = cx - dir * 30 * s.u
          rise = Math.max(rise, 1 - clamp(((stand - x) * dir) / (150 * s.u) - 0.2))
          if (phase === 'walk') {
            x += dir * 66 * s.u * pace(s) * dt
            walk += dt * 9
            if (passed(x, stand, dir)) next('jump')
          } else if (phase === 'jump') {
            if (pt > 0.8) next('drop')
          } else if (phase === 'drop') {
            if (pt > 1.5) next('tug')
          } else if (phase === 'tug') {
            for (const when of [0.5, 1.3, 2.1]) if (pt >= when && pt - dt < when) burst(s, 'star', cx, s.ground - (POT_TOP + 6) * s.u, 4, SPARKLE, 60, [1.5, 3])
            if (pt > 2.9) {
              next('wave')
              burst(s, 'star', cx, s.ground - (POT_TOP + 4) * s.u, 14, SPARKLE, 120, [2, 4.5])
              soot(s, 5)
            }
          } else if (phase === 'wave') {
            if (pt > 1.7) next('sink')
          } else {
            sink = Math.min(1, sink + dt * 0.9)
            return sink < 1
          }
          return true
        }
        if (phase === 'kick') {
          rise = Math.min(1, rise + dt * 0.85)
          if (pt > 1.3 && tick(pt, dt, 2)) soot(s, 3, 40)
          if (pt > 4.3) {
            next('pop')
            soot(s, 18, 130)
          }
        } else if (phase === 'pop') {
          if (pt > 1.1) {
            next('cough')
            x = cx + side * 40 * s.u
            burst(s, 'dust', x, s.ground - 3 * s.u, 6, ['#6b7280', '#9ca3af'], 50, [4, 7])
          }
        } else if (phase === 'cough') {
          if (pt > 0.5 && pt < 1.8 && tick(pt, dt, 2.2)) burst(s, 'dust', x + side * 10 * s.u, s.ground - 42 * s.u, 3, ['#6b7280', '#9ca3af'], 40, [3, 6])
          if (pt > 2.5) next('leave')
        } else {
          sink = Math.min(1, sink + dt * 0.8)
          x += side * 72 * s.u * pace(s) * dt
          walk += dt * 9.5
          return !passed(x, side === 1 ? s.w + 40 * s.u : -40 * s.u, side)
        }
        void to
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const up = clamp(easeOut(rise) - sink)
        const shake = phase === 'kick' && pt > 1.3 ? Math.sin(t * 34) * 0.6 * u : phase === 'tug' ? Math.sin(t * 40) * 0.5 * u * (Math.sin(pt * 7.85) > 0.6 ? 1 : 0) : 0
        const stack = () => {
          ctx.save()
          ctx.beginPath()
          ctx.rect(cx - 30 * u, s.ground - 90 * u, 60 * u, 90 * u)
          ctx.clip()
          at(ctx, cx + shake, s.ground + (1 - up) * 60 * u, u, 1, () => drawChimney(ctx))
          ctx.restore()
        }
        // Everything that happens inside the pot is clipped at its rim.
        const inPot = (fn: () => void) => {
          ctx.save()
          ctx.beginPath()
          ctx.rect(cx - 50 * u, s.ground - 240 * u, 100 * u, (240 - POT_TOP) * u)
          ctx.clip()
          fn()
          ctx.restore()
        }
        if (gag === 'sack') {
          if (phase === 'walk' || phase === 'jump') {
            stack()
            const k = phase === 'jump' ? seg(pt, 0.15, 0.8) : 0
            const jx = lerp(x, cx, easeInOut(k))
            const jy = k > 0 ? POT_TOP * easeOut(k) + Math.sin(k * Math.PI) * 16 : 0
            at(ctx, jx, s.ground - jy * u, u, dir, () => {
              if (k === 0) groundShadow(ctx, 0, 11)
              drawSanta(ctx, {
                walk, stride: phase === 'walk' ? 0.75 : 0.2, crouch: phase === 'jump' && pt < 0.15 ? 0.6 : 0,
                armB: -0.5, elbowB: -2.2, armF: phase === 'jump' ? 2.2 : undefined, mouth: phase === 'jump' ? 'o' : 'smile', blink: blinking(s.time, 1),
              }, SANTA, (a) => drawSack(ctx, a.back.x - 7, a.back.y - 3))
            })
            return
          }
          const down = phase === 'drop' ? easeIn(seg(pt, 0.5, 1.3)) : 1
          const tug = phase === 'tug' ? Math.max(0, Math.sin(pt * 7.85)) : 0
          const gone = phase === 'wave' || phase === 'sink'
          if (!gone || phase === 'wave') {
            inPot(() => {
              at(ctx, cx, s.ground - POT_TOP * u + down * 70 * u, u, dir, () => {
                drawSanta(ctx, { armF: 3.0, armB: 3.3, elbowF: 0.2, elbowB: -0.2, mouth: phase === 'drop' && pt < 0.5 ? 'grin' : 'o', eyes: down > 0.2 ? 'wide' : 'normal' })
              })
              if (phase === 'wave') {
                // One glove comes back up to say it is all in hand.
                const k = easeOut(seg(pt, 0.3, 0.6)) * (1 - easeIn(seg(pt, 1.3, 1.6)))
                at(ctx, cx, s.ground - POT_TOP * u, u, 1, () => {
                  const wv = Math.sin(pt * 12) * 3
                  line(ctx, 0, 14 - k * 16, wv * k, 2 - k * 16, 4.6, SANTA_RED)
                  fillCirc(ctx, wv * k, 1 - k * 16, 3.2, C.white)
                  fillRR(ctx, -2.6 + wv * k * 0.6, 4 - k * 16, 5.2, 2.6, 1.3, C.white)
                })
              }
            })
          }
          stack()
          if (!gone) {
            // The sack follows his hands down and then sits on the rim, far too wide.
            const sy = Math.max(11, 62 * (1 - down) + 8)
            const sq = phase === 'tug' ? tug * 0.3 : 0
            at(ctx, cx + shake, s.ground - (POT_TOP + sy) * u + sq * 5 * u, u, 1, () => drawSack(ctx, 0, 0, 1 + sq * 0.5, 1 - sq))
          }
          return
        }
        // Stuck: boots first.
        if (phase === 'pop' && pt < 0.3) {
          // He leaves the pot from inside, so he is drawn behind it for the first moment.
        }
        const flight = () => {
          const k = seg(pt, 0, 1.1)
          const fx = lerp(cx, cx + side * 40 * u, k)
          const fy = lerp(POT_TOP - 18, 32, k) + Math.sin(k * Math.PI) * 62
          ctx.save()
          ctx.translate(fx, s.ground - fy * u)
          ctx.rotate(side * Math.PI * (1 - easeOut(k)) * 1.0 + side * Math.PI * 2 * 0)
          ctx.scale(u * side, u)
          ctx.translate(0, 32)
          drawSanta(ctx, { armF: 2.4, armB: -2.2, crouch: 0.4, mouth: 'o', eyes: 'wide' }, SOOTY)
          ctx.restore()
        }
        if (phase === 'pop' && pt < 0.28) inPot(flight)
        stack()
        if (phase === 'kick' && pt > 1.3) {
          at(ctx, cx + shake, s.ground, u, 1, () => {
            for (const k of [-1, 1]) {
              const a = Math.sin(t * 9 + (k > 0 ? Math.PI : 0)) * 0.7
              const kx = k * 2.2 + Math.sin(a) * 8
              const ky = -POT_TOP - Math.cos(a) * 8
              const fx = kx + Math.sin(a * 1.9) * 8
              const fy = ky - Math.cos(a * 1.9) * 8
              poly(ctx, [k * 2.2, -POT_TOP, kx, ky, fx, fy], 5, k > 0 ? SANTA_RED : shade(SANTA_RED, -0.2))
              fillCirc(ctx, fx, fy, 3, C.white)
              fillEll(ctx, fx + Math.sin(a * 1.9) * 3 + 1.5, fy - Math.cos(a * 1.9) * 3, 4.6, 2.8, '#3b4658', a * 1.9)
            }
          })
          if (pt > 2.2 && pt < 3.6) at(ctx, cx, s.ground, u, 1, () => bubble(ctx, 22, -62, '!', { color: C.crimson }))
        }
        if (phase === 'pop' && pt >= 0.28) flight()
        if (phase === 'cough' || phase === 'leave') {
          at(ctx, x, s.ground, u, side, () => {
            groundShadow(ctx, 0, 11)
            const hack = phase === 'cough' && pt > 0.4 && pt < 1.9 ? Math.max(0, Math.sin(pt * 13.8)) : 0
            const dusting = phase === 'cough' && pt >= 1.9
            drawSanta(ctx, phase === 'leave'
              ? { walk, stride: 0.8, mouth: 'flat', blink: blinking(s.time, 1) }
              : {
                  crouch: pt < 0.3 ? 0.6 : 0, lean: hack * 0.25, armF: dusting ? 0.8 + Math.sin(t * 22) * 0.4 : 1.6, elbowF: dusting ? 1.2 : 1.5,
                  mouth: hack > 0.3 ? 'o' : 'flat', eyes: hack > 0.3 ? 'closed' : 'normal',
                }, SOOTY)
          })
        }
      },
    })
  },
}

// ─── The reindeer and the carrot ─────────────────────────────────────────────
// From the 18th. A carrot drops out of the sky; a reindeer trots on, eats it in
// three bites with its nose glowing, and then sneezes the light clean out.
// Getting it lit again takes some effort, and once in a while it comes back
// the wrong colour first. A robin sometimes watches from the antlers.

const reindeerSnack: ActDef = {
  id: 'christmas.reindeer-snack',
  weight: 2,
  when: (c) => c.adventDay >= 18,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 40)
    const gag = chance(rng, 0.5) ? 'robin' : 'colour'
    const cx = along(stage, dir, range(rng, 0.45, 0.6))
    let x = from
    let run = 0
    let phase: 'in' | 'sniff' | 'eat' | 'happy' | 'ah' | 'choo' | 'dark' | 'relit' | 'out' = 'in'
    let pt = 0
    let carrot = 1 // how much is left
    let glow = 1
    let noseCol = '#ff4343'
    let nose: Pt = { x: 0, y: 0 }
    return makeAct({
      update(s, dt, t) {
        pt += dt
        const next = (p: typeof phase) => {
          phase = p
          pt = 0
        }
        const stand = cx - dir * 27 * s.u
        if (phase === 'in') {
          x += dir * 95 * s.u * dt
          run += dt * 12
          if (passed(x, stand, dir)) next('sniff')
        } else if (phase === 'sniff') {
          if (pt > 1) next('eat')
        } else if (phase === 'eat') {
          for (const [when, left] of [[0.5, 0.66], [1.3, 0.33], [2.1, 0]]) {
            if (pt >= when && pt - dt < when) {
              carrot = left
              burst(s, 'spark', cx - dir * 2 * s.u, s.ground - 4 * s.u, 5, [C.orange, C.amber], 45, [1.5, 2.5])
            }
          }
          if (pt > 3) next('happy')
        } else if (phase === 'happy') {
          if (pt > 1) next('ah')
        } else if (phase === 'ah') {
          if (pt > 1.9) {
            next('choo')
            glow = 0
            const nx = x + dir * nose.x * s.u
            const ny = s.ground + nose.y * s.u
            for (let i = 0; i < 12; i++) {
              s.particles.emit({ kind: 'dust', x: nx, y: ny, vx: dir * range(rng, 60, 200) * s.u, vy: range(rng, -40, 30) * s.u, size: range(rng, 3, 7) * s.u, color: '#dbe7f3' })
            }
            // The light itself, sneezed off down the floor.
            s.particles.emit({ kind: 'ember', x: nx, y: ny, vx: dir * 190 * s.u, vy: -40 * s.u, g: 120, drag: 0.5, size: 4.5 * s.u, color: '#ff4343', life: 1.3 })
          }
        } else if (phase === 'choo') {
          if (pt > 0.7) next('dark')
        } else if (phase === 'dark') {
          // Three goes at it. The glow catches on the third.
          const cycle = pt % 1
          const go = Math.floor(pt)
          const last = gag === 'colour' ? 3 : 2
          glow = cycle > 0.6 && cycle < 0.85 ? 0.5 : 0
          if (gag === 'colour' && go === 2) noseCol = C.cyan
          if (gag === 'colour' && go === 2 && cycle > 0.6) glow = 1
          if (gag === 'colour' && go === 3 && cycle < 0.6) glow = 1
          if (go >= last && cycle > 0.6) {
            noseCol = '#ff4343'
            glow = 1
            next('relit')
            burst(s, 'star', x + dir * nose.x * s.u, s.ground + nose.y * s.u, 9, [C.red, C.gold, C.white], 80, [2, 4])
          }
        } else if (phase === 'relit') {
          if (pt > 1.3) next('out')
        } else {
          x += dir * 120 * s.u * dt
          run += dt * 13
          return !passed(x, to, dir)
        }
        void t
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        // The carrot: dropped in at the start, eaten from the pointed end.
        if (carrot > 0) {
          const fall = phase === 'in' ? clamp((x - from) * dir / (stage.w * 0.2)) : 1
          const fl = floorAt(s, cx)
          const hop = fall < 1 ? 0 : 0
          at(ctx, cx, lerp(fl - 200 * u, fl, easeIn(Math.min(1, fall * 1.6))) - hop, u, (-dir) as Dir, () => {
            if (fall * 1.6 >= 1) groundShadow(ctx, 0, 7)
            ctx.rotate(fall * 1.6 < 1 ? t * 9 : 0)
            const len = 3 + 11 * carrot
            fillPoly(ctx, [-6, -4.6, -6 + len, -2.6 - (1 - carrot) * 1.6, -6 + len, -0.6 + (1 - carrot) * 0.4, -6, -0.2], C.orange)
            line(ctx, -3, -3.6, -3, -1.4, 0.6, C.rust)
            if (carrot > 0.5) line(ctx, 1, -3, 1, -1.6, 0.6, C.rust)
            poly(ctx, [-6, -2.4, -9.5, -5.4], 1.4, C.green)
            poly(ctx, [-6, -2.4, -10.5, -2.4], 1.4, C.leaf)
            poly(ctx, [-6, -2.4, -9.5, 0], 1.4, C.green)
          })
        }
        let pose: DeerPose = { run, stride: 0.8, glow: 0.85 + Math.sin(t * 5) * 0.15, nose: noseCol }
        if (phase === 'sniff') pose = { head: 0.55 + Math.sin(pt * 12) * 0.05, glow: 0.7 + Math.sin(pt * 14) * 0.3, nose: noseCol }
        else if (phase === 'eat') pose = { head: 1 - Math.max(0, Math.sin(pt * 7.85 - 0.6)) * 0.18, chew: t * 18, glow: 1, nose: noseCol, eyes: 'closed' }
        else if (phase === 'happy') pose = { head: 0, chew: pt < 0.6 ? t * 18 : undefined, glow: 1, nose: noseCol, tilt: Math.sin(pt * 6) * 0.08 }
        else if (phase === 'ah') {
          const k = Math.min(3, Math.floor(pt / 0.6) + 1)
          pose = { head: 0, tilt: -0.16 * k - seg(pt % 0.6, 0, 0.2) * 0.06, glow: 1, nose: noseCol, eyes: 'closed' }
        } else if (phase === 'choo') pose = { head: 0.5 * (1 - seg(pt, 0.2, 0.7)), tilt: 0.3 * (1 - seg(pt, 0.2, 0.7)), glow: 0, eyes: 'closed' }
        else if (phase === 'dark') {
          const cycle = pt % 1
          pose = { head: 0, glow, nose: noseCol, eyes: cycle < 0.3 ? 'crossed' : 'closed', tilt: cycle >= 0.3 && cycle < 0.6 ? Math.sin(pt * 40) * 0.2 : 0 }
        } else if (phase === 'relit') pose = { head: 0, glow: 1, nose: noseCol, eyes: 'crossed', tilt: Math.sin(pt * 9) * 0.06 }
        let perch: Pt = { x: 0, y: 0 }
        at(ctx, x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 15)
          const d = drawReindeer(ctx, pose)
          nose = d.nose
          perch = d.antler
        })
        if (phase === 'ah') at(ctx, x + dir * 22 * u, s.ground, u, 1, () => bubble(ctx, 0, -50, pt < 0.6 ? 'ah' : pt < 1.2 ? 'aah' : 'aaah', { size: 9 + Math.floor(pt / 0.6) }))
        if (phase === 'choo') at(ctx, x + dir * 26 * u, s.ground, u, 1, () => bubble(ctx, 0, -46, 'CHOO!', { size: 12, color: C.crimson }))
        if (phase === 'dark' && pt % 1 < 0.3) at(ctx, x + dir * 22 * u, s.ground, u, 1, () => bubble(ctx, 0, -52, '?'))
        if (gag === 'robin' && phase !== 'in' && phase !== 'out') {
          // Blown off by the sneeze; back once the light is.
          const arrive = phase === 'sniff' ? easeOut(seg(pt, 0, 0.9)) : 1
          const away = phase === 'choo' ? easeOut(seg(pt, 0, 0.5)) : phase === 'dark' ? 1 : phase === 'relit' ? 1 - easeInOut(seg(pt, 0.2, 1)) : 0
          const px = x + dir * perch.x * u
          const py = s.ground + perch.y * u
          const bx = px - dir * (1 - arrive) * 120 * u - dir * away * 34 * u
          const by = py - (1 - arrive) * 90 * u - away * 26 * u + (away > 0.9 ? Math.sin(t * 5) * 3 * u : 0)
          at(ctx, bx, by, u, dir, () => drawBird(ctx, t * 30, arrive < 1 || away > 0.02))
        }
      },
    })
  },
}

// ─── The Christmas pudding ───────────────────────────────────────────────────
// A cook carries a flaming pudding across with tiny careful steps. A penguin,
// or a child, follows with a spoon. Halfway the flame goes out; while the cook
// is blowing on it the spoon gets its chance, and then the flame comes back
// all at once.

function drawPenguin(ctx: Ctx, waddle: number, flipper: number, munch = false): Pt {
  const sway = Math.sin(waddle) * 0.1
  fillEll(ctx, -3 + Math.max(0, Math.sin(waddle)) * 3, -0.8 - Math.max(0, Math.sin(waddle)) * 1.6, 4.2, 1.8, C.orange)
  fillEll(ctx, 4 + Math.max(0, -Math.sin(waddle)) * 3, -0.8 - Math.max(0, -Math.sin(waddle)) * 1.6, 4.2, 1.8, C.amber)
  ctx.save()
  ctx.rotate(sway)
  fillEll(ctx, 0, -13.5, 9, 13, '#3d4f6b')
  fillEll(ctx, -3.5, -13, 5, 11, '#2f3e57')
  fillEll(ctx, 3, -11.5, 6, 10, C.white)
  fillCirc(ctx, 2, -28, 7, '#3d4f6b')
  fillEll(ctx, 4.6, -26.6, 4, 4.4, C.white)
  fillCirc(ctx, 5.4, -28.6, 1.3, C.ink)
  fillCirc(ctx, 5.8, -29, 0.45, C.white)
  fillPoly(ctx, [8, -27.6, 14.4, -25.6 - (munch ? 1.2 : 0), 8, -24.8], C.amber)
  if (munch) fillPoly(ctx, [8, -25, 13.6, -23.6, 8, -23.6], C.orange)
  // A small red hat, because it is cold where he comes from.
  ctx.beginPath()
  ctx.arc(1.4, -31, 6.6, Math.PI * 1.02, Math.PI * 1.98)
  ctx.closePath()
  ctx.fillStyle = C.red
  ctx.fill()
  fillRR(ctx, -5.6, -32.6, 14, 2.8, 1.4, C.white)
  fillCirc(ctx, 0.5, -38.6, 2.2, C.white)
  // Flipper.
  const fx = 4 + Math.sin(flipper) * 11
  const fy = -19 + Math.cos(flipper) * 11
  line(ctx, 3, -19, fx, fy, 4.2, '#2f3e57')
  ctx.restore()
  return { x: fx, y: fy }
}

function drawSpoon(ctx: Ctx, x: number, y: number, ang: number, loaded: boolean) {
  const tx = x + Math.sin(ang) * 13
  const ty = y - Math.cos(ang) * 13
  line(ctx, x - Math.sin(ang) * 3, y + Math.cos(ang) * 3, tx, ty, 1.5, '#cbd5e1')
  fillEll(ctx, tx + Math.sin(ang) * 2.4, ty - Math.cos(ang) * 2.4, 2.6, 3.5, '#e2e8f0', ang)
  if (loaded) fillCirc(ctx, tx + Math.sin(ang) * 2.6, ty - Math.cos(ang) * 2.6, 2.4, '#5a3320')
}

const pudding: ActDef = {
  id: 'christmas.pudding',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const follower = chance(rng, 0.5) ? 'penguin' : 'child'
    const child: Look = chance(rng, 0.5) ? { ...CAST.kid } : { ...CAST.girl }
    const cook: Look = { skin: C.skinB, top: '#e8eef5', bottom: '#56657c', shoe: '#27303f', hair: '#3b2a1a', hat: 'chef', apron: '#c7d2e0', moustache: '#3b2a1a' }
    const gagAt = along(stage, dir, range(rng, 0.42, 0.58))
    const HOLD = 4.4
    const v = 56 * stage.u * pace(stage)
    let x = from
    let walk = 0
    let hold = 0
    let done = false
    let gap = 46 // follower's distance behind, units
    let scooped = false
    return makeAct({
      update(s, dt, t) {
        if (!done && passed(x, gagAt, dir)) {
          done = true
          hold = HOLD
          burst(s, 'dust', x + dir * 20 * s.u, s.ground - 44 * s.u, 4, ['#cbd5e1'], 30, [3, 5])
        }
        if (hold > 0) {
          hold -= dt
          const ht = HOLD - hold
          gap = ht < 0.5 ? 46 : ht < 1.8 ? lerp(46, 31, easeInOut(seg(ht, 0.5, 1.8))) : ht < 2.4 ? 31 : lerp(31, 46, easeOut(seg(ht, 2.4, 3)))
          if (ht >= 2.2) scooped = true
          if (ht >= 2.4 && ht - dt < 2.4) {
            // The whoosh.
            for (let i = 0; i < 12; i++) {
              s.particles.emit({ kind: 'ember', x: x + dir * range(rng, 15, 23) * s.u, y: s.ground - range(rng, 40, 52) * s.u, vy: -range(rng, 50, 130) * s.u, vx: range(rng, -20, 20) * s.u, size: range(rng, 2, 4) * s.u, color: pick(rng, ['#93c5fd', '#60a5fa', C.white]), life: 1 })
            }
          }
          return true
        }
        x += dir * v * dt
        walk += dt * 13
        void t
        return !passed(x - dir * 46 * s.u, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const stalled = hold > 0
        const ht = HOLD - hold
        const out = stalled && ht < 2.4
        const whoosh = stalled ? Math.sin(seg(ht, 2.4, 3) * Math.PI) : 0
        const blowing = stalled && ((ht > 0.9 && ht < 1.4) || (ht > 1.7 && ht < 2.3))
        const singed = done && (!stalled || ht >= 2.5)
        // The follower.
        const reach = stalled ? Math.sin(seg(ht, 1.8, 2.4) * Math.PI) : 0
        const eating = scooped && (!stalled || ht > 3)
        const fx = x - dir * gap * u
        if (follower === 'penguin') {
          at(ctx, fx, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 9)
            const hand = drawPenguin(ctx, stalled && ht > 0.5 && ht < 3 ? ht * 16 : stalled ? 0 : walk, 1.9 + reach * 0.5 - (eating ? 0.5 : 0), eating && Math.sin(t * 14) > 0)
            drawSpoon(ctx, hand.x, hand.y, 0.5 + reach * 0.9, scooped && stalled && ht < 3)
          })
        } else {
          at(ctx, fx, s.ground, u * 0.8, dir, () => {
            groundShadow(ctx, 0, 9)
            const a = drawPerson(ctx, child, {
              walk: stalled ? ht * 14 : walk, stride: stalled ? (ht > 0.5 && ht < 3 ? 0.4 : 0) : 0.55, crouch: stalled && ht < 2.4 ? 0.3 : 0.1,
              armF: 1.5 + reach * 0.5, elbowF: eating ? 1.6 : 0.8 - reach * 0.6, lean: 0.12 + reach * 0.2,
              mouth: eating ? 'puff' : 'o', eyes: eating ? 'closed' : 'wide', blink: blinking(s.time, 5),
            })
            drawSpoon(ctx, a.handF.x, a.handF.y, 0.4 + reach * 0.9, scooped && stalled && ht < 3)
          })
        }
        // The cook.
        at(ctx, x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, cook, {
            walk, stride: stalled ? 0 : 0.36, crouch: stalled ? 0 : 0.12,
            armF: 1.3, elbowF: 0.45, armB: 1.15, elbowB: 0.55,
            lean: whoosh > 0.1 ? -0.22 * whoosh : out && ht > 0.6 ? 0.16 : 0.02,
            mouth: whoosh > 0.1 ? 'o' : blowing ? 'puff' : out ? 'flat' : 'smile',
            eyes: whoosh > 0.1 || (out && ht < 0.8) ? 'wide' : 'normal', blink: blinking(s.time, 1),
          })
          const px = a.handF.x + 3
          const py = a.handF.y - 1.5
          // Plate, pudding, icing, holly.
          fillEll(ctx, px, py + 0.6, 11, 2.1, '#e2e8f0')
          ctx.beginPath()
          ctx.arc(px, py, 8, Math.PI, TAU)
          ctx.closePath()
          ctx.fillStyle = '#5a3320'
          ctx.fill()
          for (let i = 0; i < 5; i++) fillCirc(ctx, px - 5 + i * 2.5, py - 2 - (i % 2) * 2, 0.7, '#8a5a3a')
          ctx.beginPath()
          ctx.arc(px, py, 8, Math.PI * 1.18, Math.PI * 1.82)
          ctx.quadraticCurveTo(px + 4.6, py - 2.6, px + 3, py - 4.6)
          ctx.quadraticCurveTo(px + 1.5, py - 1.6, px - 0.5, py - 4.4)
          ctx.quadraticCurveTo(px - 2.6, py - 2, px - 4, py - 4.6)
          ctx.closePath()
          ctx.fillStyle = C.cream
          ctx.fill()
          if (scooped) fillEll(ctx, px - 6, py - 2.2, 2.4, 2.2, '#8a5a3a', 0.4)
          fillEll(ctx, px - 2, py - 8.4, 2.4, 1.2, C.green, 0.5)
          fillEll(ctx, px + 2, py - 8.4, 2.4, 1.2, C.forest, -0.5)
          fillCirc(ctx, px, py - 8.6, 1.1, '#ff6b6b')
          // The flame: small and blue, except for one moment.
          if (!out) {
            const fl = (1 + Math.sin(t * 13) * 0.14 + Math.sin(t * 23) * 0.08) * (1 + whoosh * 3)
            const tip = py - 10 - 7 * fl
            const sw = Math.sin(t * 9) * 1.2
            ctx.globalAlpha = 0.18
            fillCirc(ctx, px, py - 11, 6 + whoosh * 8, '#60a5fa')
            ctx.globalAlpha = 0.85
            fillPoly(ctx, [px - 3.4 - whoosh * 2, py - 8.5, px + sw, tip, px + 3.4 + whoosh * 2, py - 8.5], '#60a5fa')
            ctx.globalAlpha = 1
            fillPoly(ctx, [px - 1.8, py - 8.5, px + sw * 0.6, lerp(py - 8.5, tip, 0.6), px + 1.8, py - 8.5], '#dbeafe')
          } else if (ht < 0.8) {
            ctx.globalAlpha = 1 - ht / 0.8
            line(ctx, px, py - 10, px + Math.sin(ht * 9) * 2, py - 16 - ht * 8, 1, '#cbd5e1')
            ctx.globalAlpha = 1
          }
          if (blowing) speedLines(ctx, a.mouth.x + 12, a.mouth.y, -6, t)
          if (singed) {
            // A scorched hat and a sooty nose to remember it by.
            fillEll(ctx, a.crown.x + 3, a.crown.y - 12, 5.4, 3.6, 'rgba(60,50,45,0.75)', 0.3)
            fillEll(ctx, a.head.x + 9.6, a.head.y + 1.4, 2.6, 2.2, 'rgba(60,50,45,0.55)')
          }
        })
        if (out && ht > 0.2 && ht < 0.9) at(ctx, x, s.ground, u, 1, () => bubble(ctx, 0, -74, '!', { color: C.crimson }))
      },
    })
  },
}

// ─── The toy train ───────────────────────────────────────────────────────────
// A wind-up engine and three trucks of presents trundle on, slower and slower,
// and stop. An elf runs on and winds the key. It goes a great deal faster than
// he expected: either it leaves him spinning, or it takes him with it.

const TRUCKS = [C.blue, C.green, C.purple]

function drawTrain(ctx: Ctx, roll: number, key: number) {
  const wheel = (x: number, r: number) => {
    fillCirc(ctx, x, -r, r, '#3b4658')
    fillCirc(ctx, x, -r, r * 0.55, C.gold)
    line(ctx, x, -r, x + Math.cos(roll) * r * 0.8, -r + Math.sin(roll) * r * 0.8, 0.8, '#3b4658')
  }
  // Trucks, each with its own little heap.
  for (let i = 0; i < 3; i++) {
    const tx = -27 - i * 15
    line(ctx, tx + 6, -3.6, tx + 9.5, -3.6, 1.1, C.grey)
    drawPresent(ctx, tx - 2.4, -7.4, 5.4, 5, BULBS[i], C.white)
    drawPresent(ctx, tx + 2.6, -7.4, 4.6, 4, BULBS[i + 2], C.gold)
    if (i !== 1) drawPresent(ctx, tx, -11.6, 4.2, 3.8, BULBS[(i + 3) % 5], C.white, false)
    fillRR(ctx, tx - 6, -8.4, 12, 5.6, 1, TRUCKS[i])
    fillRR(ctx, tx - 6, -8.4, 12, 1.6, 0.8, shade(TRUCKS[i], 0.25))
    wheel(tx - 3.4, 2)
    wheel(tx + 3.4, 2)
  }
  line(ctx, -21, -3.6, -17, -3.6, 1.1, C.grey)
  // The key, standing out of the cab roof and seen edge-on as it turns.
  line(ctx, -11, -18, -11, -23, 1.3, C.brass)
  const kw = Math.abs(Math.cos(key)) * 3.4 + 0.5
  ctx.lineWidth = 1.3
  ctx.strokeStyle = C.brass
  ctx.beginPath()
  ctx.ellipse(-11 - kw, -25.6, kw, 2.6, 0, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(-11 + kw, -25.6, kw, 2.6, 0, 0, TAU)
  ctx.stroke()
  // Engine: cab, boiler, funnel, dome and cowcatcher.
  fillRR(ctx, -16, -16, 10, 12.4, 1.4, '#2fa35a')
  fillRR(ctx, -14, -14, 5.6, 4.6, 0.8, '#fde68a')
  fillRR(ctx, -17.4, -18.2, 12.8, 2.6, 1.2, '#27603c')
  fillRR(ctx, -7, -12.4, 16, 8.4, 4, '#d92b3a')
  fillRR(ctx, -7, -12.4, 16, 2.6, 1.3, shade('#d92b3a', 0.22))
  line(ctx, -1, -12.2, -1, -4.4, 1, C.gold)
  line(ctx, 4.6, -12.2, 4.6, -4.4, 1, C.gold)
  fillCirc(ctx, 1.8, -12.6, 2.2, C.gold)
  fillRR(ctx, 5.4, -17.6, 3.4, 6, 0.6, '#3b4658')
  fillRR(ctx, 4.4, -19, 5.4, 2, 1, '#3b4658')
  fillRR(ctx, -16.6, -4.6, 26, 2, 1, '#3b4658')
  fillPoly(ctx, [9, -5.6, 13.6, -0.6, 9, -0.6], C.gold)
  wheel(-11, 3.4)
  wheel(-3, 3.4)
  wheel(5.4, 2.2)
  line(ctx, -11 + Math.cos(roll) * 2, -3.4 + Math.sin(roll) * 2, -3 + Math.cos(roll) * 2, -3.4 + Math.sin(roll) * 2, 1.1, C.grey)
}

const toyTrain: ActDef = {
  id: 'christmas.toy-train',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 20)
    const gag = chance(rng, 0.5) ? 'dragged' : 'dizzy'
    const stopAt = along(stage, dir, range(rng, 0.46, 0.58))
    const V0 = 88 * stage.u * pace(stage)
    const LEN = 66 // engine nose to the last truck, units
    let x = from
    let v = V0
    let roll = 0
    let key = 0
    let phase: 'run' | 'stopped' | 'wind' | 'go' = 'run'
    let pt = 0
    let ex = from - dir * 30 * stage.u
    let ewalk = 0
    let elf: 'off' | 'run-in' | 'winding' | 'dizzy' | 'chase' | 'dragged' = 'off'
    return makeAct({
      update(s, dt, t) {
        pt += dt
        if (phase === 'run') {
          const left = (stopAt - x) * dir
          v = V0 * clamp(left / (130 * s.u), 0.07, 1)
          if (left < 1.5 * s.u) {
            phase = 'stopped'
            pt = 0
            v = 0
            s.particles.emit({ kind: 'dust', x: x + dir * 7 * s.u, y: s.ground - 20 * s.u, vy: -14 * s.u, size: 5 * s.u, color: '#dbe7f3', life: 1.4 })
          }
        } else if (phase === 'stopped') {
          if (pt > 0.9) elf = 'run-in'
          if (elf === 'run-in') {
            ex += dir * 220 * s.u * dt
            ewalk += dt * 18
            if (passed(ex, x - dir * 22 * s.u, dir)) {
              ex = x - dir * 22 * s.u
              elf = 'winding'
              phase = 'wind'
              pt = 0
            }
          }
        } else if (phase === 'wind') {
          key -= dt * 15
          if (tick(pt, dt, 7)) burst(s, 'spark', x - dir * 11 * s.u, s.ground - 26 * s.u, 1, [C.gold, C.white], 40, [1.5, 2.5])
          if (pt > 1.9) {
            phase = 'go'
            pt = 0
            elf = gag
            burst(s, 'dust', x - dir * 20 * s.u, s.ground - 3 * s.u, 8, ['#dbe7f3'], 80, [4, 8])
          }
        } else {
          v = Math.min(430 * s.u, v + 900 * s.u * dt)
          if (tick(t, dt, 18)) {
            s.particles.emit({ kind: 'star', x: x - dir * LEN * s.u, y: s.ground - range(rng, 2, 12) * s.u, vx: -dir * 30 * s.u, vy: -range(rng, 10, 50) * s.u, size: range(rng, 2, 3.6) * s.u, color: pick(rng, SPARKLE), life: 0.9 })
          }
          if (elf === 'dizzy' && pt > 2.2) elf = 'chase'
          if (elf === 'chase') {
            ex += dir * 150 * s.u * dt
            ewalk += dt * 16
          }
        }
        x += dir * v * dt
        roll += (v * dt) / (3 * s.u)
        if (phase === 'run' || phase === 'go') key += (v * dt) / (9 * s.u)
        // Puffs from the funnel, as often as it is moving.
        if (v > 4 && tick(roll, (v * dt) / (3 * s.u), 0.22)) {
          s.particles.emit({ kind: 'dust', x: x + dir * 7 * s.u, y: s.ground - 20 * s.u, vx: -dir * v * 0.2, vy: -22 * s.u, size: range(rng, 3, 5) * s.u, color: '#dbe7f3', life: 1 })
        }
        if (phase !== 'go') return true
        const edge = dir === 1 ? s.w + 20 * s.u : -20 * s.u
        const trainGone = passed(x - dir * (LEN + 30) * s.u, edge, dir)
        return !(trainGone && (elf !== 'chase' || passed(ex, to, dir)))
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const tremble = phase === 'wind' ? Math.sin(t * 50) * 0.5 * u : 0
        at(ctx, x + tremble, s.ground, u, dir, () => {
          groundShadow(ctx, -28, 40, 0.2)
          drawTrain(ctx, roll, key)
          if (phase === 'go') speedLines(ctx, -LEN - 8, -8, 16, t)
        })
        if (elf === 'off') return
        if (elf === 'dragged') {
          // Still holding the key, streaming out behind like a flag.
          at(ctx, x - dir * 11 * u, s.ground - 25 * u, u, dir, () => {
            ctx.rotate(-1.35 + Math.sin(t * 14) * 0.08)
            ctx.translate(0, 31)
            drawElf(ctx, ELF_A, { armF: 3.1, armB: 3.2, elbowF: 0, elbowB: 0, walk: t * 22, stride: 0.5, mouth: 'o', eyes: 'wide' })
          })
          return
        }
        const dizzy = elf === 'dizzy'
        const facing = (dizzy && pt < 1.2 ? (Math.floor(pt * 9) % 2 ? -dir : dir) : dir) as Dir
        at(ctx, ex, s.ground, u, facing, () => {
          groundShadow(ctx, 0, 8)
          const sat = dizzy && pt >= 1.2
          if (sat) ctx.translate(0, 9)
          const a = drawElf(ctx, ELF_A, elf === 'winding'
            ? { armF: 2.35 + Math.sin(pt * 15) * 0.3, elbowF: 0.35, lean: 0.14, mouth: 'puff', eyes: 'closed', crouch: 0.1 }
            : dizzy
              ? { crouch: sat ? 1 : 0.2, lean: sat ? -0.2 : Math.sin(pt * 20) * 0.15, armF: 0.6, armB: -0.6, mouth: 'o', eyes: sat ? 'closed' : 'wide', headTilt: Math.sin(t * 5) * 0.2 }
              : { walk: ewalk, stride: 1, lean: 0.25, armF: elf === 'chase' ? 2 : undefined, mouth: elf === 'chase' ? 'o' : 'grin' })
          if (dizzy) {
            for (let i = 0; i < 3; i++) {
              const an = t * 5 + (i * TAU) / 3
              star(ctx, a.head.x + Math.cos(an) * 9, a.crown.y - 6 + Math.sin(an) * 2.4, 1.8, C.yellow, an)
            }
          }
        })
      },
    })
  },
}

// ─── The countdown ───────────────────────────────────────────────────────────
// Up to Christmas Eve: an elf marches across with the number of sleeps left on
// a placard, and cannot get to the far side without a jump for joy. A second,
// smaller elf follows ringing a handbell, or the dog comes too.

const countdown: ActDef = {
  id: 'christmas.countdown',
  weight: 2,
  when: (c) => c.adventDay >= 1 && c.adventDay <= 24,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const day = stage.context.adventDay
    const sleeps = 25 - day
    const text = day < 1 || day > 24 ? 'Soon!' : sleeps === 1 ? '1 sleep!' : `${sleeps} sleeps`
    const friend = chance(rng, 0.5) ? 'bell' : 'dog'
    const jumpAt = along(stage, dir, range(rng, 0.4, 0.6))
    let x = from
    let walk = 0
    let hold = 0
    let done = false
    return makeAct({
      update(s, dt, t) {
        if (!done && passed(x, jumpAt, dir)) {
          done = true
          hold = 1.5
          burst(s, 'star', x, s.ground - 60 * s.u, 10, SPARKLE, 90, [2, 4])
        }
        if (hold > 0) {
          hold -= dt
          return true
        }
        x += dir * 74 * s.u * pace(s) * dt
        walk += dt * 13
        if (friend === 'bell' && tick(t, dt, 1.6)) {
          s.particles.emit({ kind: 'note', x: x - dir * 30 * s.u, y: s.ground - 30 * s.u, vx: -dir * 6 * s.u, vy: -22 * s.u, size: 3 * s.u, color: pick(rng, NOTE_COLORS) })
        }
        return !passed(x - dir * 46 * s.u, to, dir)
      },
      draw(s, t) {
        const { ctx } = s
        const u = s.u
        const jump = hold > 0 ? Math.abs(Math.sin((1.5 - hold) * 6.3)) * 9 : 0
        if (friend === 'dog') {
          at(ctx, x - dir * 44 * u, s.ground, u, dir, () => {
            groundShadow(ctx, 0, 14)
            drawDog(ctx, DOG, { run: hold > 0 ? 0 : walk * 0.9, stride: hold > 0 ? 0 : 0.5, wag: t * 16, sitting: hold > 0, mouthOpen: hold > 0 })
            // Antlers on a headband. He has agreed to this.
            const hx = hold > 0 ? 11 : 15
            const hy = hold > 0 ? -34 : -27 - Math.abs(Math.sin(walk * 0.9)) * 1.1
            poly(ctx, [hx - 2, hy, hx - 3, hy - 6, hx - 6, hy - 8], 1.3, ANTLER)
            line(ctx, hx - 3, hy - 4, hx, hy - 6, 1.1, ANTLER)
            poly(ctx, [hx + 2, hy, hx + 3, hy - 6, hx + 6, hy - 8], 1.3, ANTLER)
            line(ctx, hx + 3, hy - 4, hx, hy - 7, 1.1, ANTLER)
          })
        } else {
          at(ctx, x - dir * 32 * u, s.ground, u * 0.82, dir, () => {
            groundShadow(ctx, 0, 8)
            const ring = Math.sin(t * 10)
            const a = drawElf(ctx, ELF_B, { walk: walk + 1, stride: hold > 0 ? 0 : 0.9, armF: 1.9 + ring * 0.35, elbowF: 0.5, lift: jump * 0.6, mouth: 'grin', blink: blinking(s.time, 6) })
            ctx.save()
            ctx.translate(a.handF.x, a.handF.y)
            ctx.rotate(ring * 0.5)
            line(ctx, 0, 0, 0, -3, 1.4, C.wood)
            fillPoly(ctx, [-1.4, -3, 1.4, -3, 4, -9.5, -4, -9.5], C.gold)
            fillCirc(ctx, ring * 2.4, -10, 1.2, C.brass)
            ctx.restore()
          })
        }
        let hand: Pt = { x: 0, y: 0 }
        at(ctx, x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 8 - jump * 0.2)
          const a = drawElf(ctx, ELF_A, {
            walk, stride: hold > 0 ? 0 : 0.95, armF: 2.5, elbowF: 0.3, armB: hold > 0 ? -2.6 : undefined, lift: jump, crouch: hold > 0 && jump < 1 ? 0.3 : 0,
            mouth: 'grin', eyes: hold > 0 ? 'closed' : 'normal', blink: blinking(s.time, 2),
          })
          hand = a.handF
          line(ctx, a.handF.x, a.handF.y + 4, a.handF.x, a.handF.y - 22, 1.6, C.wood)
        })
        // The placard is drawn unmirrored so the words read the right way round.
        at(ctx, x + dir * hand.x * u, s.ground + (hand.y - 20) * u, u, 1, () => {
          ctx.rotate(Math.sin(walk) * 0.04)
          bubble(ctx, 0, 0, text, { size: 11, bg: C.cream, color: C.crimson })
        })
      },
    })
  },
}

export const CHRISTMAS_ACTS: ActDef[] = [
  sleighAct('christmas.sleigh', 3, false),
  sleighAct('christmas.merry-christmas', 4, true),
  bigPresent,
  tree,
  fairyLights,
  carolSingers,
  snowman,
  chimney,
  reindeerSnack,
  pudding,
  toyTrain,
  countdown,
]
