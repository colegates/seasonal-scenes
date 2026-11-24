import { drawBird } from '../creatures'
import { C, TAU, alpha, at, clamp, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, poly, seg, shade, type Ctx } from '../draw'
import { blinking, bubble, burst, makeAct, sweat } from '../kit'
import { CAST, drawPerson, type Anchors, type Look, type Pose, type Pt } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Rng, Stage } from '../types'

// The house band: one French horn, one bassoon, and a conductor nobody asked
// for. The horn's notes are golden and float; the bassoon's are heavy and have
// to be swept up afterwards.

const GOLDS = [C.gold, C.yellow, C.cream, C.brass]
const LOWS = [C.purple, '#8b9cf7', C.rose, C.mint]
const SILVER = '#d5dde8'
const MAPLE = '#a65a30'
const BRASS_D = shade(C.brass, -0.32)
const BRASS_L = shade(C.brass, 0.4)

const PLAYERS: Look[] = [
  { ...CAST.mum, top: '#b4234a' },
  { ...CAST.dad, top: '#3f5f96' },
  { ...CAST.kid, top: '#e2e8f0', bottom: '#3d4a5c' },
  { ...CAST.girl, top: '#0f8f84' },
]

// ─── Timing helpers ──────────────────────────────────────────────────────────
// Every act here is a fixed script: walk on, do the bit, walk off. The walking
// times are known once the stage width is, so the whole thing is a function of
// the clock and nothing can get stuck.

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

const SPEED = 68

function entry(stage: Stage, rng: Rng, lo = 0.36, hi = 0.64, margin = 45) {
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1
  const m = margin * stage.u
  const from = dir === 1 ? -m : stage.w + m
  const to = dir === 1 ? stage.w + m : -m
  const spot = stage.w * range(rng, lo, hi)
  const secs = (a: number, b: number, speed = SPEED) => Math.abs(b - a) / (speed * stage.u)
  return { dir, from, to, spot, secs }
}

/** A speech bubble that is never mirrored, whichever way the speaker faces. */
function say(s: Stage, x: number, uy: number, text: string, opts?: Parameters<typeof bubble>[4]) {
  at(s.ctx, x, s.ground, s.u, 1, () => bubble(s.ctx, 0, uy, text, opts))
}

// ─── The French horn ─────────────────────────────────────────────────────────
// Origin at the middle of the coil. The bell points back and down past the
// player's hip, which is where the right hand lives.

const BELL_ANG = 2.45
/** The horn is drawn a little larger than life so the coil reads at a distance. */
const HORN_K = 1.25

function drawHorn(ctx: Ctx, cx: number, cy: number, rot: number, mouth?: Pt, finger = -1) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.scale(HORN_K, HORN_K)
  // Bell: a short throat, then the flare.
  ctx.save()
  ctx.rotate(BELL_ANG)
  line(ctx, 3, 0, 9, 0, 3, BRASS_D)
  ctx.beginPath()
  ctx.moveTo(7, -1.6)
  ctx.quadraticCurveTo(13, -2.2, 17, -8.6)
  ctx.lineTo(17, 8.6)
  ctx.quadraticCurveTo(13, 2.2, 7, 1.6)
  ctx.closePath()
  ctx.fillStyle = C.brass
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(8, 1)
  ctx.quadraticCurveTo(13, 1.6, 16.2, 6.6)
  ctx.lineWidth = 0.9
  ctx.strokeStyle = BRASS_L
  ctx.stroke()
  fillEll(ctx, 17, 0, 2.5, 8.6, BRASS_L)
  fillEll(ctx, 17.3, 0, 1.5, 7, shade(C.brass, -0.6))
  ctx.restore()
  // The coil: an outer loop, an inner loop, and a glint.
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, 7, 0, TAU)
  ctx.lineWidth = 2.6
  ctx.strokeStyle = C.brass
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0.4, 0.4, 4.2, 0, TAU)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = BRASS_D
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 7.3, 3.5, 4.9)
  ctx.lineWidth = 0.9
  ctx.strokeStyle = BRASS_L
  ctx.stroke()
  // Three rotary valves with their levers and finger paddles.
  for (let i = 0; i < 3; i++) {
    const down = finger >= 0 && Math.floor(finger * 5 + i * 1.3) % 3 === 0 ? 1.1 : 0
    const vx = -2.6 + i * 2.6
    line(ctx, vx, 0.3, vx + 0.9, -8.2 + down, 0.7, BRASS_D)
    fillCirc(ctx, vx, 0.3 + i * 0.25, 1.3, BRASS_L)
    fillCirc(ctx, vx, 0.3 + i * 0.25, 0.5, BRASS_D)
    fillEll(ctx, vx + 1.2, -8.6 + down, 1.5, 0.75, SILVER, -0.2)
  }
  if (!mouth) {
    // Not at the lips: the leadpipe ends in its little mouthpiece.
    poly(ctx, [5.4, -4.6, 7.6, -8.6, 7.4, -12.4], 1.3, C.brass)
    fillEll(ctx, 7.4, -13.2, 1.5, 1, SILVER)
  }
  ctx.restore()
  if (mouth) {
    ctx.beginPath()
    ctx.moveTo(cx + 5.4 * HORN_K, cy - 4.6 * HORN_K)
    ctx.quadraticCurveTo(cx + 11, cy - 10, mouth.x + 0.6, mouth.y + 0.6)
    ctx.lineWidth = 1.3
    ctx.lineCap = 'round'
    ctx.strokeStyle = C.brass
    ctx.stroke()
    fillEll(ctx, mouth.x + 0.4, mouth.y + 0.5, 1.5, 1.1, SILVER, -0.8)
  }
}

function bowTie(ctx: Ctx, a: Anchors, color: string) {
  const x = a.shoulder.x + Math.cos(a.lean) * 6 - Math.sin(a.lean) * 2.4
  const y = a.shoulder.y + Math.sin(a.lean) * 6 + Math.cos(a.lean) * 2.4
  fillPoly(ctx, [x - 2.8, y - 1.7, x, y, x - 2.8, y + 1.7], color)
  fillPoly(ctx, [x + 2.8, y - 1.7, x, y, x + 2.8, y + 1.7], color)
  fillCirc(ctx, x, y, 0.9, shade(color, -0.25))
}

/** Where the notes come out, in units from the player's feet, while playing. */
const HORN_BELL: Pt = { x: -10, y: -11 }

function hornist(ctx: Ctx, look: Look, pose: Pose, mode: 'carry' | 'play', finger = -1): Anchors {
  const playing = mode === 'play'
  const a = drawPerson(ctx, look, playing ? { armF: 0.9, elbowF: 1.3, armB: -0.35, elbowB: 0.3, ...pose } : { armF: 0.45, elbowF: 1.35, ...pose })
  bowTie(ctx, a, C.red)
  if (playing) {
    const cx = a.handF.x - 3.5
    const cy = a.handF.y + 10
    drawHorn(ctx, cx, cy, 0, a.mouth, finger)
    // Left hand on the paddles, right hand tucked in the bell.
    fillCirc(ctx, a.handF.x - 2, a.handF.y + 0.4, 2.6, look.skin)
    fillCirc(ctx, cx + Math.cos(BELL_ANG) * 20.5, cy + Math.sin(BELL_ANG) * 20.5 - 3.5, 2.6, shade(look.skin, -0.1))
  } else {
    drawHorn(ctx, a.handF.x - 6, a.handF.y + 2, 0.5)
    fillCirc(ctx, a.handF.x, a.handF.y, 2.7, look.skin)
  }
  return a
}

// ─── The bassoon ─────────────────────────────────────────────────────────────
// (bx, by) is the bottom of the boot and `ang` the lean from upright. Boot
// joint, wing joint, long joint, bell with its pale ring, and the silver crook
// curving round to the lips.

/** Drawn a fifth over scale: it should tower. */
const BSN_K = 1.2

function along(bx: number, by: number, ang: number, lx: number, ly: number): Pt {
  const x = lx * BSN_K
  const y = ly * BSN_K
  return { x: bx + x * Math.cos(ang) - y * Math.sin(ang), y: by + x * Math.sin(ang) + y * Math.cos(ang) }
}

function drawBassoon(ctx: Ctx, bx: number, by: number, ang: number, mouth?: Pt, parts = 4) {
  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(ang)
  ctx.scale(BSN_K, BSN_K)
  if (parts >= 2) {
    // Wing joint on the player's side, long joint on the far side.
    fillRR(ctx, -3.3, -41, 3.5, 21, 1.5, shade(MAPLE, 0.14))
    fillRR(ctx, -0.5, -52, 4.2, 32, 1.7, MAPLE)
    fillRR(ctx, 2, -50, 1, 28, 0.5, alpha('#ffffff', 0.2))
    fillCirc(ctx, 1.6, -33, 1.2, SILVER)
    fillCirc(ctx, 1.6, -44, 1.05, SILVER)
    line(ctx, 1.6, -34.5, 1.6, -42.5, 0.7, SILVER)
    fillEll(ctx, -1.8, -30, 1.1, 0.8, SILVER)
    fillEll(ctx, -1.8, -35.5, 1.1, 0.8, SILVER)
  }
  if (parts >= 3) {
    fillRR(ctx, -0.9, -62, 4.9, 11, 1.8, MAPLE)
    fillRR(ctx, -1.1, -52.8, 5.3, 1.5, 0.7, SILVER)
    fillRR(ctx, -1.4, -63.6, 5.9, 2.8, 1.3, C.cream)
  }
  // Boot joint with its silver cap.
  fillRR(ctx, -3.2, -22, 6.6, 22, 2.6, MAPLE)
  fillRR(ctx, -3.2, -20, 1.6, 17, 0.8, shade(MAPLE, -0.2))
  fillRR(ctx, -3.5, -3.2, 7.2, 3.6, 1.7, SILVER)
  fillRR(ctx, -3.5, -22.8, 7.2, 1.7, 0.8, SILVER)
  line(ctx, 1.4, -8, 1.4, -19, 0.8, SILVER)
  fillCirc(ctx, 1.4, -7, 1.3, SILVER)
  fillEll(ctx, -0.8, -13, 1.3, 0.9, SILVER)
  fillEll(ctx, -0.8, -17, 1.1, 0.8, SILVER)
  if (parts >= 4 && !mouth) {
    // Crook and reed, pointing at nobody.
    ctx.beginPath()
    ctx.moveTo(-1.6, -40.5)
    ctx.quadraticCurveTo(-3, -50, -8.5, -46.5)
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.strokeStyle = SILVER
    ctx.stroke()
    line(ctx, -8.5, -46.5, -10.4, -45.2, 1.7, C.tan)
  }
  ctx.restore()
  if (parts >= 4 && mouth) {
    const s = along(bx, by, ang, -1.6, -40.5)
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.quadraticCurveTo(s.x - 1, s.y - 11, mouth.x + 2.2, mouth.y + 0.4)
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.strokeStyle = SILVER
    ctx.stroke()
    line(ctx, mouth.x + 2.2, mouth.y + 0.4, mouth.x + 0.4, mouth.y + 0.7, 1.7, C.tan)
  }
}

const B_PLAY = { x: -2, y: -4, ang: 0.43 }
const B_CARRY = { x: 14.5, y: -11, ang: 0.07 }
/** Top of the bell while playing, in units from the player's feet. */
const BASSOON_BELL = along(B_PLAY.x, B_PLAY.y, B_PLAY.ang, 1.5, -64)

function gripOn(ctx: Ctx, hold: { x: number; y: number; ang: number }, hand: Pt, color: string) {
  // Slide the hand onto the nearest point of the tube.
  const ax = Math.sin(hold.ang)
  const ay = -Math.cos(hold.ang)
  const d = clamp((hand.x - hold.x) * ax + (hand.y - hold.y) * ay, 5, 60)
  fillCirc(ctx, hold.x + ax * d, hold.y + ay * d, 2.6, color)
}

function bassoonist(ctx: Ctx, look: Look, pose: Pose, mode: 'carry' | 'play' | 'none', behind?: (a: Anchors) => void): Anchors {
  const base: Pose = mode === 'play' ? { armF: 1.0, elbowF: 0.9, armB: 0.5, elbowB: 0.8 } : mode === 'carry' ? { armF: 0.9, elbowF: 0.9 } : {}
  const a = drawPerson(ctx, look, { ...base, ...pose }, behind)
  bowTie(ctx, a, C.mint)
  if (mode === 'none') return a
  const hold = mode === 'play' ? B_PLAY : B_CARRY
  drawBassoon(ctx, hold.x, hold.y, hold.ang, mode === 'play' ? a.mouth : undefined)
  if (mode === 'play') gripOn(ctx, hold, a.handB, shade(look.skin, -0.12))
  gripOn(ctx, hold, a.handF, look.skin)
  return a
}

// ─── Heavy things ────────────────────────────────────────────────────────────
// Bassoon notes do not float. They plop out, fall, bounce twice and lie there.
// The same little physics does for a cracked horn note and a rejected reed.

interface Plop {
  kind: 'note' | 'crack' | 'reed'
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  variant: number
  rot: number
  vr: number
  bounces: number
  fade: number
  big: boolean
}

function plop(list: Plop[], p: Partial<Plop> & { x: number; y: number; vx: number; vy: number; size: number; color: string }) {
  if (list.length < 24) list.push({ kind: 'note', variant: Math.floor(Math.random() * 3), rot: 0, vr: 0, bounces: 0, fade: 1, big: false, ...p })
}

/** Advance the heavy things. Returns how many big ones landed this frame. */
function stepPlops(s: Stage, list: Plop[], dt: number): number {
  let thuds = 0
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    if (p.bounces >= 3) {
      p.fade -= dt * 1.5
      if (p.fade <= 0) list.splice(i, 1)
      continue
    }
    p.vy += 620 * s.u * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vr * dt
    const floor = s.ground - p.size * 0.45
    if (p.y >= floor && p.vy > 0) {
      p.y = floor
      p.bounces++
      if (p.bounces === 1) {
        burst(s, 'dust', p.x, s.ground - 2, p.big ? 8 : 2, ['#cbd5e1'], p.big ? 70 : 40, [3, 6])
        if (p.big) thuds++
      }
      p.vy *= -0.42
      p.vx *= 0.6
      p.vr *= 0.3
      if (Math.abs(p.vy) < 42 * s.u) {
        p.bounces = 3
        p.rot = 0
      }
    }
  }
  return thuds
}

function drawPlops(ctx: Ctx, list: Plop[]) {
  for (const p of list) {
    const s = p.size
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.globalAlpha = clamp(p.fade)
    ctx.fillStyle = p.color
    ctx.strokeStyle = p.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (p.kind === 'reed') {
      fillPoly(ctx, [-s, -s * 0.18, s * 0.5, -s * 0.5, s, 0, s * 0.5, s * 0.5, -s, s * 0.18], p.color)
      line(ctx, -s * 0.5, 0, -s * 0.2, 0, s * 0.5, C.crimson)
    } else {
      ctx.lineWidth = Math.max(1, s * 0.22)
      ctx.beginPath()
      ctx.ellipse(0, 0, s * 0.62, s * 0.46, -0.4, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(s * 0.52, -s * 0.1)
      if (p.kind === 'crack') {
        // A stem that went wrong on the way up, and a few shards.
        ctx.lineTo(s * 0.1, -s * 0.7)
        ctx.lineTo(s * 0.9, -s * 1.2)
        ctx.lineTo(s * 0.2, -s * 1.7)
        ctx.lineTo(s * 0.8, -s * 2.2)
        ctx.stroke()
        for (let i = 0; i < 5; i++) {
          const an = -2.6 + i * 0.55
          line(ctx, Math.cos(an) * s * 1.5, Math.sin(an) * s * 1.5 - s * 0.6, Math.cos(an) * s * 2.1, Math.sin(an) * s * 2.1 - s * 0.6, Math.max(0.8, s * 0.14), p.color)
        }
      } else {
        ctx.lineTo(s * 0.52, -s * 2)
        ctx.stroke()
        if (p.variant === 0) {
          ctx.beginPath()
          ctx.moveTo(s * 0.52, -s * 2)
          ctx.quadraticCurveTo(s * 1.5, -s * 1.6, s * 1.2, -s * 0.8)
          ctx.stroke()
        } else if (p.variant === 1) {
          ctx.beginPath()
          ctx.ellipse(s * 1.8, -s * 0.4, s * 0.62, s * 0.46, -0.4, 0, TAU)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(s * 2.32, -s * 0.5)
          ctx.lineTo(s * 2.32, -s * 2.4)
          ctx.lineTo(s * 0.52, -s * 2)
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function hornNote(s: Stage, x: number, y: number, t: number) {
  s.particles.emit({
    kind: 'note',
    x,
    y,
    vx: Math.sin(t * 5) * 36 * s.u,
    vy: -(40 + Math.random() * 16) * s.u,
    size: (3.4 + Math.random() * 1.6) * s.u,
    color: GOLDS[Math.floor(Math.random() * GOLDS.length)],
    life: 2.4,
  })
}

function lowNote(s: Stage, list: Plop[], x: number, y: number, dir: number, big = false) {
  plop(list, {
    x,
    y,
    vx: dir * (10 + Math.random() * 38) * s.u,
    vy: -(70 + Math.random() * 50) * s.u,
    size: (big ? 13 : 5.5 + Math.random() * 2.5) * s.u,
    color: LOWS[Math.floor(Math.random() * LOWS.length)],
    vr: (Math.random() - 0.5) * 3,
    big,
  })
}

// ─── Horn solo ───────────────────────────────────────────────────────────────
// Marches on, plants both feet, takes a breath you could inflate a dinghy
// with, and plays. Usually it is lovely. Sometimes one note cracks. Sometimes
// nothing comes out at all, and then something does.

const hornSolo: ActDef = {
  id: 'music.horn-solo',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng)
    const look = pick(rng, PLAYERS)
    const gag = pick(rng, ['gold', 'crack', 'bird'] as const)
    const tl = timeline([
      ['in', secs(from, spot)],
      ['plant', 0.5],
      ['breath', 1.0],
      ['play', 4.4],
      ['react', 2.0],
      ['out', secs(spot, to)],
    ])
    const CRACK = 2.6
    const BIRD = 3.3
    const plops: Plop[] = []
    const bird = { on: false, x: 0, y: 0 }
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    return makeAct({
      update(s, dt, t) {
        const bx = spot + dir * HORN_BELL.x * s.u
        const by = s.ground + HORN_BELL.y * s.u
        if (tl.on('play', t)) {
          const pt = tl.since('play', t)
          const sounding = gag === 'gold' || (gag === 'crack' && pt < CRACK) || (gag === 'bird' && pt < 1.5)
          if (sounding && every(t, dt, 4.5)) hornNote(s, bx, by, t)
          if (gag === 'crack' && hit(pt, dt, CRACK)) {
            plop(plops, { kind: 'crack', x: bx, y: by, vx: -dir * 60 * s.u, vy: -190 * s.u, size: 7 * s.u, color: C.red, vr: -dir * 5 })
            burst(s, 'spark', bx, by, 6, [C.red, C.orange], 70, [2, 3])
          }
          if (gag === 'bird' && hit(pt, dt, BIRD)) {
            bird.on = true
            bird.x = bx
            bird.y = by
            burst(s, 'dust', bx, by, 5, ['#cbd5e1'], 50, [3, 6])
          }
        }
        if (gag === 'gold' && hit(t, dt, tl.start.react + 0.9)) burst(s, 'star', spot, s.ground - 62 * s.u, 6, GOLDS, 60, [3, 5])
        if (bird.on) {
          bird.x -= dir * 115 * s.u * dt
          bird.y -= 135 * s.u * dt
          if (bird.y < -30) bird.on = false
        }
        stepPlops(s, plops, dt)
        return t < tl.total || bird.on
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.8 : 0, blink: blinking(s.time, 2) }
        let mode: 'carry' | 'play' = 'carry'
        let finger = -1
        let wet = false
        let says = ''
        if (tl.on('plant', t)) mode = 'play'
        else if (tl.on('breath', t)) {
          const p = tl.p('breath', t)
          mode = 'play'
          pose = { ...pose, lean: -0.16 * easeOut(p), mouth: p < 0.78 ? 'o' : 'puff', eyes: 'closed' }
        } else if (tl.on('play', t)) {
          const pt = tl.since('play', t)
          mode = 'play'
          if (gag === 'crack' && pt >= CRACK) {
            pose = { ...pose, mouth: 'frown', eyes: 'closed', headTilt: -0.2, lean: -0.1 }
            says = '!'
          } else if (gag === 'bird' && pt >= BIRD) pose = { ...pose, mouth: 'o', eyes: 'wide', lean: -0.12 }
          else if (gag === 'bird' && pt >= 1.5) {
            // Nothing is coming out. Blow harder.
            pose = { ...pose, mouth: 'puff', eyes: 'wide', lean: 0.1 + Math.sin(t * 34) * 0.02 }
            finger = t * 2
            wet = true
          } else {
            pose = { ...pose, mouth: 'puff', eyes: 'closed', lean: Math.sin(t * 5) * 0.04, headTilt: Math.sin(t * 2.5) * 0.06 }
            finger = t
          }
        } else if (tl.on('react', t)) {
          const p = tl.p('react', t)
          if (gag === 'gold') pose = { ...pose, lean: Math.sin(p * Math.PI) * 0.7, eyes: 'closed', mouth: 'smile' }
          else if (gag === 'crack') pose = { ...pose, mouth: 'flat', headTilt: 0.12, armB: -1.2 * Math.sin(p * Math.PI), elbowB: -0.8 }
          else {
            pose = { ...pose, mouth: 'o', eyes: 'wide', headTilt: -0.28 }
            if (p > 0.25) says = '?'
          }
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const a = hornist(ctx, look, pose, mode, finger)
          if (wet) sweat(ctx, a.head.x, a.head.y - 8, t)
        })
        if (says) say(s, x, -66, says, { color: C.crimson })
        if (bird.on) at(ctx, bird.x, bird.y, s.u, (-dir) as 1 | -1, () => drawBird(ctx, t * 22, true))
        drawPlops(ctx, plops)
      },
    })
  },
}

// ─── Bassoon solo ────────────────────────────────────────────────────────────
// The bassoon is taller than whoever is playing it. Its notes come out of the
// top, think about it, and drop. One time in three it has to be put together
// first, and it goes together upside down.

function drawCase(ctx: Ctx, x: number, y: number, open: number) {
  // A long case, (x, y) at the middle of its base.
  if (open > 0.02) {
    ctx.save()
    ctx.translate(x + 17, y - 7)
    ctx.rotate(open * 1.25)
    fillRR(ctx, -34, -3.4, 34, 3.4, 1.5, '#3f5f96')
    fillRR(ctx, -32.5, -1.2, 31, 1.2, 0.6, C.crimson)
    ctx.restore()
  } else fillRR(ctx, x - 17, y - 10.2, 34, 3.6, 1.6, '#3f5f96')
  fillRR(ctx, x - 17, y - 7, 34, 7, 2, '#33507a')
  if (open > 0.02) fillRR(ctx, x - 15.5, y - 7, 31, 1.6, 0.6, C.crimson)
  fillRR(ctx, x - 9, y - 5.2, 2.2, 2.4, 0.5, SILVER)
  fillRR(ctx, x + 7, y - 5.2, 2.2, 2.4, 0.5, SILVER)
  poly(ctx, [x - 3.5, y - 6, x - 3.5, y - 3.6, x + 3.5, y - 3.6, x + 3.5, y - 6], 1, '#22344f')
}

const bassoonSolo: ActDef = {
  id: 'music.bassoon-solo',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng)
    const look = pick(rng, PLAYERS)
    const assemble = chance(rng, 0.36)
    const big = chance(rng, 0.5)
    const tl = timeline([
      ['in', secs(from, spot)],
      ['assemble', assemble ? 5.2 : 0],
      ['ready', 0.7],
      ['play', 4.8],
      ['react', 1.7],
      ['pack', assemble ? 0.7 : 0],
      ['out', secs(spot, to)],
    ])
    const plops: Plop[] = []
    let jolt = 0
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    return makeAct({
      update(s, dt, t) {
        const bx = spot + dir * BASSOON_BELL.x * s.u
        const by = s.ground + BASSOON_BELL.y * s.u
        if (tl.on('play', t)) {
          const pt = tl.since('play', t)
          if (pt < 4.0 && every(pt, dt, 1.9)) lowNote(s, plops, bx, by, dir)
          if (big && hit(pt, dt, 4.3)) lowNote(s, plops, bx, by, dir, true)
        }
        if (stepPlops(s, plops, dt) > 0) jolt = 1
        jolt = Math.max(0, jolt - dt * 1.6)
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        const hop = Math.sin(clamp(jolt) * Math.PI) * 5
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.8 : 0, blink: blinking(s.time, 4), lift: hop }
        let mode: 'carry' | 'play' | 'none' = 'carry'
        let says = ''
        // The case: in the back hand on the move, on the floor in between.
        const caseDown = assemble && t >= tl.start.assemble + 0.5 && t < tl.start.pack + 0.4
        let caseOpen = 0
        // Loose bassoon while it is being put together: [x, y, angle, parts].
        let loose: [number, number, number, number] | null = null
        if (tl.on('in', t) && assemble) mode = 'none'
        else if (tl.on('assemble', t)) {
          const pt = tl.since('assemble', t)
          mode = 'none'
          caseOpen = easeOut(seg(pt, 0.6, 1.1)) * (1 - easeInOut(seg(pt, 4.5, 5.0)))
          const dip = Math.sin(seg(pt, 0, 1.2) * Math.PI) * 0.8
          pose = { ...pose, crouch: dip, lean: dip * 0.5, armF: 1.3, elbowF: 0.6, armB: 1.0, elbowB: 0.7 }
          if (pt >= 1.2) {
            const parts = pt < 1.9 ? 1 : pt < 2.6 ? 2 : 3
            // Bell end down. Something about this is not right.
            const turn = easeInOut(seg(pt, 3.7, 4.5))
            loose = [lerp(19, B_PLAY.x, turn), lerp(-63 * BSN_K, B_PLAY.y, turn), lerp(Math.PI + 0.06, B_PLAY.ang + TAU, turn), parts]
            pose = { ...pose, armF: 1.5 - turn * 0.5, elbowF: 0.5 + turn * 0.4, armB: 1.2 - turn * 0.7, elbowB: 0.6, mouth: pt > 2.7 && pt < 3.7 ? 'flat' : 'smile', headTilt: pt > 2.7 && pt < 3.7 ? -0.2 : 0 }
            if (pt > 2.8 && pt < 3.7) says = '?'
          }
        } else if (tl.on('ready', t)) {
          mode = 'play'
          pose = { ...pose, mouth: 'o', eyes: 'closed', lean: -0.1 * tl.p('ready', t) }
        } else if (tl.on('play', t)) {
          const pt = tl.since('play', t)
          mode = 'play'
          pose = { ...pose, mouth: 'puff', eyes: jolt > 0 ? 'wide' : 'closed', lean: Math.sin(t * 3.8) * 0.035, crouch: pt < 4 ? Math.max(0, Math.sin(pt * 1.9 * Math.PI)) * 0.16 : 0 }
        } else if (tl.on('react', t)) {
          const p = tl.p('react', t)
          if (jolt > 0) pose = { ...pose, mouth: 'o', eyes: 'wide' }
          else pose = { ...pose, lean: Math.sin(p * Math.PI) * 0.32, eyes: 'closed', mouth: 'smile' }
        } else if (tl.on('pack', t)) {
          const dip = Math.sin(tl.p('pack', t) * Math.PI)
          pose = { ...pose, crouch: dip * 0.8, lean: dip * 0.4, armB: 0.9, elbowB: 0.2 }
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11 - hop * 0.4)
          if (caseDown) {
            groundShadow(ctx, 30, 18)
            drawCase(ctx, 30, 0, caseOpen)
          }
          const a = bassoonist(ctx, look, pose, mode, (an) => {
            if (assemble && !caseDown) drawCase(ctx, an.handB.x, an.handB.y + 10, 0)
          })
          if (loose) {
            drawBassoon(ctx, loose[0], loose[1], loose[2], undefined, loose[3])
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, look.skin)
          }
        })
        if (says) say(s, x, -72, says)
        drawPlops(ctx, plops)
      },
    })
  },
}

// ─── The duet ────────────────────────────────────────────────────────────────
// One from each side. They meet in the middle, bow to each other, and play:
// bright notes going up, heavy ones coming down, crossing in the air between
// them. Sometimes the bassoon has one more thing to say after the bow.

const duet: ActDef = {
  id: 'music.duet',
  weight: 3,
  create(stage, rng) {
    const hd: 1 | -1 = rng() < 0.5 ? 1 : -1 // the way the horn player faces
    const bd = (-hd) as 1 | -1
    const m = 45 * stage.u
    const centre = stage.w * range(rng, 0.44, 0.56)
    const hornSpot = centre - hd * 27 * stage.u
    const bsnSpot = centre + hd * 38 * stage.u
    const hornFrom = hd === 1 ? -m : stage.w + m
    const bsnFrom = hd === 1 ? stage.w + m : -m
    const walkSecs = Math.max(Math.abs(hornSpot - hornFrom), Math.abs(bsnSpot - bsnFrom)) / (SPEED * stage.u)
    const hornLook = pick(rng, PLAYERS)
    const bsnLook = pick(rng, PLAYERS.filter((l) => l !== hornLook))
    const encore = chance(rng, 0.5)
    const tl = timeline([
      ['in', walkSecs],
      ['greet', 1.3],
      ['ready', 0.9],
      ['play', 5.6],
      ['bow', 1.5],
      ['encore', encore ? 2.2 : 0],
      ['out', walkSecs],
    ])
    const plops: Plop[] = []
    return makeAct({
      update(s, dt, t) {
        const hx = hornSpot + hd * HORN_BELL.x * s.u
        const hy = s.ground + HORN_BELL.y * s.u
        const bx = bsnSpot + bd * BASSOON_BELL.x * s.u
        const by = s.ground + BASSOON_BELL.y * s.u
        if (tl.on('play', t)) {
          const pt = tl.since('play', t)
          if (pt < 5.2 && every(t, dt, 3.6)) hornNote(s, hx, hy, t * hd)
          if (pt < 5.0 && every(pt, dt, 1.5)) lowNote(s, plops, bx, by, bd)
        }
        if (hit(t, dt, tl.start.bow + 0.7)) burst(s, 'star', centre, s.ground - 66 * s.u, 8, [...GOLDS, C.purple, C.rose], 70, [3, 5])
        if (encore && hit(t, dt, tl.start.encore + 0.6)) lowNote(s, plops, bx, by, bd, true)
        stepPlops(s, plops, dt)
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const pin = tl.p('in', t)
        const pout = tl.p('out', t)
        const leaving = t >= tl.start.out
        const hx = leaving ? lerp(hornSpot, hornFrom, pout) : lerp(hornFrom, hornSpot, pin)
        const bx = leaving ? lerp(bsnSpot, bsnFrom, pout) : lerp(bsnFrom, bsnSpot, pin)
        const moving = tl.on('in', t) || leaving
        const walk = (leaving ? pout : pin) * walkSecs * SPEED / 6.2
        let hp: Pose = { walk, stride: moving ? 0.8 : 0, blink: blinking(s.time, 2) }
        let bp: Pose = { walk: walk + 1.5, stride: moving ? 0.8 : 0, blink: blinking(s.time, 6) }
        let playing = false
        let glare = false
        if (tl.on('greet', t)) {
          const bow = Math.sin(tl.p('greet', t) * Math.PI) * 0.55
          hp = { ...hp, lean: bow, eyes: 'closed' }
          bp = { ...bp, lean: Math.sin(clamp(tl.p('greet', t) * 1.2 - 0.2) * Math.PI) * 0.55, eyes: 'closed' }
        } else if (tl.on('ready', t)) {
          const p = tl.p('ready', t)
          playing = true
          hp = { ...hp, mouth: p < 0.75 ? 'o' : 'puff', lean: -0.14 * p, eyes: 'closed' }
          bp = { ...bp, mouth: 'o', lean: -0.1 * p, eyes: 'closed' }
        } else if (tl.on('play', t)) {
          playing = true
          hp = { ...hp, mouth: 'puff', eyes: 'closed', lean: Math.sin(t * 5) * 0.045, headTilt: Math.sin(t * 2.5) * 0.06 }
          bp = { ...bp, mouth: 'puff', eyes: 'closed', lean: Math.sin(t * 5 + 1.6) * 0.04, crouch: Math.max(0, Math.sin(t * 1.5 * Math.PI)) * 0.14 }
        } else if (tl.on('bow', t)) {
          const bow = Math.sin(tl.p('bow', t) * Math.PI) * 0.7
          hp = { ...hp, lean: bow, eyes: 'closed', mouth: 'grin' }
          bp = { ...bp, lean: bow, eyes: 'closed', mouth: 'grin' }
        } else if (tl.on('encore', t)) {
          const pt = tl.since('encore', t)
          glare = pt > 0.7
          hp = { ...hp, mouth: glare ? 'flat' : 'smile', eyes: pt > 0.6 && pt < 1.0 ? 'wide' : 'normal', headTilt: glare ? 0.1 : 0 }
          bp = pt < 1.0 ? { ...bp, mouth: 'puff', eyes: 'closed' } : { ...bp, mouth: 'grin', eyes: 'closed', headTilt: -0.12 }
        }
        const hornFace = (leaving ? -hd : hd) as 1 | -1
        const bsnFace = (leaving ? -bd : bd) as 1 | -1
        at(ctx, hx, s.ground, s.u, hornFace, () => {
          groundShadow(ctx, 0, 11)
          hornist(ctx, hornLook, hp, playing ? 'play' : 'carry', tl.on('play', t) ? t : -1)
        })
        at(ctx, bx, s.ground, s.u, bsnFace, () => {
          groundShadow(ctx, 0, 11)
          bassoonist(ctx, bsnLook, bp, playing || (tl.on('encore', t) && tl.since('encore', t) < 1.0) ? 'play' : 'carry')
        })
        if (glare) say(s, hx, -66, '...', { size: 9 })
        drawPlops(ctx, plops)
      },
    })
  },
}

// ─── Emptying the water ──────────────────────────────────────────────────────
// Every horn player knows the gurgle. The horn comes off the face, gets turned
// round and round like a steering wheel, and a quite unreasonable amount of
// water falls out. Occasionally so does a duck.

function drawDuck(ctx: Ctx, body: string, waddle = 0, legs = true) {
  ctx.save()
  ctx.rotate(Math.sin(waddle) * 0.1)
  if (legs) {
    line(ctx, -1, -3, -1 + Math.sin(waddle) * 2.2, -0.4, 1.1, C.orange)
    line(ctx, 2, -3, 2 - Math.sin(waddle) * 2.2, -0.4, 1.1, C.orange)
  }
  const lift = legs ? 0 : 2.6
  fillPoly(ctx, [-5.5, -8.4 + lift, -10.6, -11 + lift, -5, -4.4 + lift], body)
  fillEll(ctx, 0, -6.2 + lift, 7, 4.6, body)
  fillEll(ctx, -1, -6.4 + lift, 4, 2.4, shade(body, -0.14), 0.15)
  fillEll(ctx, 4.6, -9 + lift, 2.6, 3.4, body)
  fillCirc(ctx, 5.4, -12 + lift, 3.7, body)
  fillPoly(ctx, [8.4, -12.8 + lift, 12.6, -11.4 + lift, 8.4, -10.2 + lift], C.orange)
  fillCirc(ctx, 6.6, -12.8 + lift, 0.75, C.ink)
  ctx.restore()
}

const waterEmpty: ActDef = {
  id: 'music.empty-the-water',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng)
    const look = pick(rng, PLAYERS)
    const duck = chance(rng, 0.4)
    const tl = timeline([
      ['in', secs(from, spot)],
      ['play', 2.4],
      ['stop', 1.0],
      ['spin', 2.2],
      ['pour', 3.2],
      ['shame', 1.7],
      ['pick', duck ? 0.9 : 0],
      ['out', secs(spot, to)],
    ])
    const DUCK_AT = 2.3
    const puddleMax = duck ? 27 : 20
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    return makeAct({
      update(s, dt, t) {
        if (tl.on('play', t)) {
          const pt = tl.since('play', t)
          const bx = spot + dir * HORN_BELL.x * s.u
          const by = s.ground + HORN_BELL.y * s.u
          if (pt < 1.1) {
            if (every(t, dt, 4.5)) hornNote(s, bx, by, t)
          } else if (every(t, dt, 6)) {
            // The gurgle.
            s.particles.emit({ kind: 'bubble', x: bx, y: by, vx: -dir * range(rng, 5, 30) * s.u, vy: -range(rng, 20, 40) * s.u, size: range(rng, 2, 4) * s.u, life: 1.3 })
          }
        }
        if (tl.on('pour', t) && every(t, dt, 34)) {
          const gush = tl.p('pour', t) < 0.85 ? 1 : 0.3
          if (Math.random() < gush) {
            s.particles.emit({
              kind: 'drop',
              x: spot + dir * (22 + range(rng, -3, 3)) * s.u,
              y: s.ground - 12 * s.u,
              vx: range(rng, -14, 14) * s.u,
              vy: range(rng, 10, 50) * s.u,
              size: range(rng, 3, 5) * s.u,
              color: pick(rng, [C.sky, '#a5e3fb', C.cyan]),
            })
          }
        }
        if (duck && hit(t, dt, tl.start.pour + DUCK_AT + 0.25)) burst(s, 'drop', spot + dir * 22 * s.u, s.ground - 3 * s.u, 8, [C.sky, '#a5e3fb'], 80, [2, 3.5])
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.8 : 0, blink: blinking(s.time, 3) }
        let mode: 'carry' | 'play' | 'out' = 'carry'
        let hornRot = 0
        let blush = 0
        let says = ''
        const pourT = tl.since('pour', t)
        const grow = easeOut(tl.p('pour', t))
        const dry = t >= tl.start.out ? clamp((t - tl.start.out) / Math.min(2.6, tl.total - tl.start.out - 0.2)) : 0
        const puddle = puddleMax * grow * (1 - dry)
        // The duck: falls from the bell, bobs, then rides off on a head.
        let duckAt: Pt | null = null
        let onHead = 0
        if (duck && t >= tl.start.pour + DUCK_AT) {
          const fall = seg(pourT, DUCK_AT, DUCK_AT + 0.25)
          duckAt = { x: 22, y: lerp(-12, 0, fall * fall) + (fall >= 1 ? Math.sin(t * 4) * 0.5 : 0) }
          if (t >= tl.start.pick) onHead = easeInOut(seg(tl.p('pick', t), 0.35, 0.9))
          if (t >= tl.start.out) onHead = 1
        }
        if (tl.on('play', t)) {
          const pt = tl.since('play', t)
          mode = 'play'
          pose = pt < 1.1 ? { ...pose, mouth: 'puff', eyes: 'closed', lean: Math.sin(t * 5) * 0.04 } : { ...pose, mouth: 'puff', eyes: 'wide', lean: 0.06 }
        } else if (tl.on('stop', t)) {
          mode = 'out'
          hornRot = 0.2
          pose = { ...pose, mouth: 'flat', headTilt: 0.18 }
          says = '?'
        } else if (tl.on('spin', t)) {
          mode = 'out'
          hornRot = 0.2 + easeInOut(tl.p('spin', t)) * TAU * 2
          pose = { ...pose, mouth: 'flat', headTilt: 0.12 }
        } else if (tl.on('pour', t)) {
          mode = 'out'
          const shake = Math.sin(t * 30) * 0.13 * (pourT > 0.4 ? 1 : 0)
          hornRot = lerp(0.2, Math.PI / 2 - BELL_ANG, easeInOut(seg(pourT, 0, 0.4))) + shake
          const amazed = pourT > 1.4
          pose = { ...pose, mouth: amazed ? 'o' : 'flat', eyes: amazed ? 'wide' : 'normal', headTilt: 0.2 }
        } else if (tl.on('shame', t)) {
          const p = tl.p('shame', t)
          blush = Math.sin(p * Math.PI)
          // A quick look each way to see who noticed.
          pose = { ...pose, mouth: 'flat', eyes: 'wide', headTilt: Math.sin(p * TAU * 1.5) * 0.14 }
        } else if (tl.on('pick', t)) {
          const dip = Math.sin(tl.p('pick', t) * Math.PI)
          pose = { ...pose, crouch: dip * 0.9, lean: dip * 0.55, armB: 1.2, elbowB: 0.1, mouth: 'smile' }
        } else if (tl.on('out', t)) blush = 0.5
        if (puddle > 0.5) {
          at(ctx, spot + dir * 22 * s.u, s.ground, s.u, dir, () => {
            fillEll(ctx, 0, 0.8, puddle, Math.max(0.8, puddle * 0.12), alpha(C.sky, 0.6))
            fillEll(ctx, -puddle * 0.3, 0.4, puddle * 0.35, Math.max(0.3, puddle * 0.035), alpha('#ffffff', 0.55))
          })
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          let a: Anchors
          if (mode === 'out') {
            // Held out in front with both hands, like something that has misbehaved.
            a = drawPerson(ctx, look, { armF: 1.6, elbowF: 0.25, armB: 1.4, elbowB: 0.3, ...pose })
            bowTie(ctx, a, C.red)
            if (tl.on('pour', t) && pourT > 0.4 && tl.p('pour', t) < 0.85) {
              // The stream itself, wavering as the horn is shaken.
              const wob = Math.sin(t * 30) * 1.2
              poly(ctx, [22, -13, 22 + wob, -8, 22 - wob * 0.6, -4, 22, 0], 2.2, alpha(C.sky, 0.75))
              poly(ctx, [22.5, -13, 22.5 + wob, -8, 22.5 - wob * 0.6, -4], 0.8, alpha('#ffffff', 0.7))
            }
            drawHorn(ctx, 22, -34, hornRot)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, look.skin)
          } else a = hornist(ctx, look, pose, mode, tl.on('play', t) ? t : -1)
          if (blush > 0) {
            ctx.globalAlpha = blush * 0.7
            fillCirc(ctx, a.head.x + 5, a.head.y + 4.5, 2.8, C.rose)
            ctx.globalAlpha = 1
          }
          if (duckAt && onHead > 0) {
            ctx.save()
            ctx.translate(lerp(duckAt.x, a.crown.x - 1, onHead), lerp(duckAt.y, a.crown.y + 1.5, onHead))
            drawDuck(ctx, C.yellow, 0, false)
            ctx.restore()
          }
        })
        if (duckAt && onHead === 0) {
          const d = duckAt
          at(ctx, spot + dir * d.x * s.u, s.ground + d.y * s.u, s.u, dir, () => drawDuck(ctx, C.yellow, 0, false))
        }
        if (says) say(s, x, -66, says)
      },
    })
  },
}

// ─── The reed ────────────────────────────────────────────────────────────────
// A bassoonist owns forty reeds and likes one of them. Each is inspected,
// soaked, tried, and thrown over the shoulder. The noise a bad reed makes is
// exactly the noise a duck makes, which is occasionally misunderstood.

function drawReedBox(ctx: Ctx, x: number, y: number) {
  fillRR(ctx, x - 7, y - 4.2, 14, 4.2, 1, '#7c5a3a')
  fillRR(ctx, x - 6, y - 4.8, 12, 1.6, 0.6, C.crimson)
  for (let i = 0; i < 6; i++) {
    line(ctx, x - 5 + i * 2, y - 4.6, x - 5 + i * 2, y - 7.4, 1.2, C.tan)
    line(ctx, x - 5 + i * 2, y - 4.6, x - 5 + i * 2, y - 5.4, 1.3, C.crimson)
  }
  // The lid, propped open.
  fillPoly(ctx, [x - 7, y - 4.2, x - 9.5, y - 12, x - 8.3, y - 12.4, x - 5.6, y - 4.2], '#93704d')
}

const reedFuss: ActDef = {
  id: 'music.the-reed',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng)
    const look = pick(rng, PLAYERS)
    const ending = pick(rng, ['good', 'duck'] as const)
    const TRY = 3.3
    const tl = timeline([
      ['in', secs(from, spot)],
      ['setup', 0.7],
      ['try0', TRY],
      ['try1', TRY],
      ['try2', TRY - 0.6],
      ['finale', ending === 'duck' ? 2.6 : 1.8],
      ['pack', 0.7],
      ['out', secs(spot, to)],
    ])
    const tries = ['try0', 'try1', 'try2'] as const
    const plops: Plop[] = []
    const duckHome = spot + dir * 50 * stage.u
    const duckStart = tl.start.try2 + 2.0
    const duckWalk = Math.abs(to - duckHome) / (70 * stage.u)
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    return makeAct({
      update(s, dt, t) {
        for (let i = 0; i < 3; i++) {
          const pt = tl.since(tries[i], t)
          if (i === 2) break
          if (hit(pt, dt, 2.9)) {
            // Over the shoulder with it.
            plop(plops, { kind: 'reed', x: spot - dir * 4 * s.u, y: s.ground - 50 * s.u, vx: -dir * range(rng, 60, 100) * s.u, vy: -150 * s.u, size: 4.5 * s.u, color: C.tan, vr: -dir * 12 })
          }
        }
        if (ending === 'good' && tl.on('finale', t) && tl.since('finale', t) < 1.0 && every(t, dt, 5)) {
          s.particles.emit({ kind: 'note', x: spot + dir * 14 * s.u, y: s.ground - 44 * s.u, vx: dir * range(rng, 10, 40) * s.u, vy: -range(rng, 30, 50) * s.u, size: range(rng, 3.4, 5) * s.u, color: pick(rng, [C.mint, C.green, C.gold]), life: 2.2 })
        }
        stepPlops(s, plops, dt)
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.8 : 0, blink: blinking(s.time, 5) }
        const busy = t >= tl.start.setup + 0.35 && t < tl.start.pack + 0.35
        let reed: 'none' | 'eye' | 'mouth' = 'none'
        let quack = false
        let says = ''
        for (let i = 0; i < 3; i++) {
          if (!tl.on(tries[i], t)) continue
          const pt = tl.since(tries[i], t)
          if (pt < 0.6) {
            const dip = Math.sin((pt / 0.6) * Math.PI)
            pose = { ...pose, crouch: dip * 0.9, lean: dip * 0.5, armF: 1.0, elbowF: 0.1 }
          } else if (pt < 1.3) {
            reed = 'eye'
            pose = { ...pose, armF: 1.9, elbowF: 0.8, headTilt: -0.08, mouth: 'flat' }
          } else if (pt < 1.9) {
            reed = 'mouth'
            pose = { ...pose, armF: 1.3, elbowF: 1.7, mouth: 'o', eyes: 'closed' }
          } else if (pt < 2.7) {
            reed = 'mouth'
            quack = pt > 2.05
            pose = { ...pose, armF: 1.3, elbowF: 1.7, mouth: 'puff', eyes: quack ? 'wide' : 'closed', lean: quack ? -0.06 : 0 }
          } else {
            const fling = seg(pt, 2.7, 3.0)
            reed = pt < 2.9 ? 'eye' : 'none'
            pose = { ...pose, armF: lerp(1.9, 3.6, fling), elbowF: 0.6, mouth: 'frown', headTilt: 0.08 }
          }
        }
        if (tl.on('setup', t)) {
          const dip = Math.sin(tl.p('setup', t) * Math.PI)
          pose = { ...pose, crouch: dip * 0.9, lean: dip * 0.5, armF: 1.0, elbowF: 0.1 }
        } else if (tl.on('finale', t)) {
          const pt = tl.since('finale', t)
          if (ending === 'good') {
            reed = 'mouth'
            pose = pt < 1.0 ? { ...pose, armF: 1.3, elbowF: 1.7, mouth: 'puff', eyes: 'closed' } : { ...pose, armF: 2.6, elbowF: 0.3, mouth: 'grin', eyes: 'closed', lift: Math.abs(Math.sin(pt * 9)) * 3 }
            if (pt >= 1.0) reed = 'eye'
          } else {
            pose = { ...pose, mouth: 'o', eyes: 'wide', lean: -0.1 }
            if (pt > 1.5) says = '?'
          }
        } else if (tl.on('pack', t)) {
          const dip = Math.sin(tl.p('pack', t) * Math.PI)
          pose = { ...pose, crouch: dip * 0.9, lean: dip * 0.5, armB: 1.0, elbowB: 0.1 }
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          if (busy) drawReedBox(ctx, 17, 0)
          const a = bassoonist(ctx, look, busy ? { armB: -0.5, elbowB: 0.5, ...pose } : pose, busy ? 'none' : 'carry', (an) => {
            // Parked upright in the other hand while the reeds are judged.
            if (busy) drawBassoon(ctx, -11, 0, -0.03)
            else drawReedBox(ctx, an.handB.x, an.handB.y + 5)
          })
          if (reed !== 'none') {
            const r = reed === 'mouth' ? { x: a.mouth.x + 9.5, y: a.mouth.y + 2 } : { x: a.handF.x + 1, y: a.handF.y - 2 }
            // Drawn several sizes too big, or nobody would see what the fuss is about.
            ctx.save()
            ctx.translate(r.x, r.y)
            ctx.rotate(reed === 'mouth' ? Math.PI + 0.15 : -1.1)
            fillPoly(ctx, [0, -0.9, 4, -1.1, 8.5, -2.6, 9.4, 0, 8.5, 2.6, 4, 1.1, 0, 0.9], C.tan)
            fillRR(ctx, 1.2, -1.4, 2.6, 2.8, 0.8, C.crimson)
            line(ctx, 5, 0, 8.6, 0, 0.5, shade(C.tan, -0.25))
            ctx.restore()
          }
        })
        if (quack) say(s, x + dir * 22 * s.u, -50, 'quack', { size: 9, color: C.rust })
        if (says) say(s, x, -66, says)
        if (ending === 'duck' && t >= duckStart) {
          // Summoned. Waddles up, has a look, and leads the way off.
          const arrive = seg(t, duckStart, duckStart + duckWalk)
          const leave = seg(t, tl.start.out, tl.start.out + duckWalk)
          const dx = leave > 0 ? lerp(duckHome, to, leave) : lerp(to, duckHome, arrive)
          const still = arrive >= 1 && leave <= 0
          const face = (leave > 0 ? dir : -dir) as 1 | -1
          at(ctx, dx, s.ground, s.u * 1.25, face, () => {
            groundShadow(ctx, 0, 7)
            drawDuck(ctx, C.white, still ? 0 : t * 14)
          })
          if (still && tl.on('finale', t) && tl.since('finale', t) < 1.4 && tl.since('finale', t) > 0.3) say(s, dx, -26, 'quack?', { size: 9, color: C.rust })
        }
        drawPlops(ctx, plops)
      },
    })
  },
}

// ─── The conductor ───────────────────────────────────────────────────────────
// White tie, tails, a podium the size of a biscuit tin, and no orchestra. This
// does not hold him back. It ends when the baton leaves.

const MAESTRO: Look = {
  skin: C.skinA,
  top: '#43557c',
  bottom: '#33415f',
  shoe: '#1f2937',
  hair: '#e2e8f0',
  hairStyle: 'long',
  moustache: '#e2e8f0',
  apron: '#f1f5f9',
}

function drawPodium(ctx: Ctx, x: number, y: number) {
  fillRR(ctx, x - 11, y - 7, 22, 7, 1.4, '#9a6b3f')
  fillRR(ctx, x - 11, y - 3, 22, 3, 1.2, '#7c5330')
  fillRR(ctx, x - 12, y - 8.2, 24, 2.4, 1, '#c48a52')
  fillRR(ctx, x - 9, y - 8.7, 18, 1.4, 0.6, C.crimson)
}

function drawBaton(ctx: Ctx, x: number, y: number, ang: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  line(ctx, 0, 0, 16, 0, 1.3, C.white)
  fillEll(ctx, 0, 0, 2, 1.3, C.tan)
  ctx.restore()
}

const conductor: ActDef = {
  id: 'music.conductor',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to, spot, secs } = entry(stage, rng)
    const ending = pick(rng, ['stuck', 'bonk'] as const)
    const tl = timeline([
      ['in', secs(from, spot)],
      ['set', 0.7],
      ['hop', 0.45],
      ['tap', 1.1],
      ['slow', 2.6],
      ['fast', 2.8],
      ['frenzy', 2.2],
      ['fly', 1.5],
      ['stare', 1.2],
      ['down', 0.45],
      ['pack', 0.7],
      ['out', secs(spot, to)],
    ])
    const H = 8.2 // podium height
    const landX = ending === 'stuck' ? 36 : 17
    const landPx = spot + dir * landX * stage.u
    const xAt = (t: number) => (t < tl.start.out ? lerp(from, spot, tl.p('in', t)) : lerp(spot, to, tl.p('out', t)))
    const reached = (x: number) => (dir === 1 ? x >= landPx - 12 * stage.u : x <= landPx + 12 * stage.u)
    return makeAct({
      update(s, dt, t) {
        if (tl.on('tap', t) && every(tl.since('tap', t), dt, 3.2)) burst(s, 'spark', spot + dir * 17 * s.u, s.ground - 34 * s.u, 2, [C.white, C.yellow], 30, [1.5, 2.5])
        if ((tl.on('fast', t) && every(t, dt, 2)) || (tl.on('frenzy', t) && every(t, dt, 5))) {
          // He can hear it, even if nobody else can.
          s.particles.emit({ kind: 'note', x: spot + dir * range(rng, 18, 46) * s.u, y: s.ground - range(rng, 20, 50) * s.u, vy: -range(rng, 16, 30) * s.u, size: range(rng, 3, 4.4) * s.u, color: alpha(C.white, 0.5), life: 1.6 })
        }
        if (ending === 'bonk' && hit(t, dt, tl.start.fly + 1.05)) burst(s, 'star', spot, s.ground - 74 * s.u, 6, [C.yellow, C.white], 60, [3, 4.5])
        if (ending === 'stuck' && hit(t, dt, tl.start.fly + 1.5)) burst(s, 'dust', landPx, s.ground - 2, 3, ['#cbd5e1'], 40, [3, 5])
        if (hit(t, dt, tl.start.out) || (t > tl.start.out && reached(xAt(t)) && !reached(xAt(t - dt)))) burst(s, 'spark', landPx, s.ground - 8 * s.u, 3, [C.white], 40, [1.5, 2.5])
        return t < tl.total
      },
      draw(s, t) {
        const { ctx } = s
        const x = xAt(t)
        const moving = tl.on('in', t) || tl.on('out', t)
        const up = t >= tl.start.hop && t < tl.start.down + 0.45
        const podiumDown = t >= tl.start.set + 0.35 && t < tl.start.pack + 0.35
        let lift = 0
        if (up) lift = H * easeOut(tl.p('hop', t)) * (1 - easeInOut(tl.p('down', t))) + Math.sin(tl.p('hop', t) * Math.PI) * 5 + Math.sin(tl.p('down', t) * Math.PI) * 3
        let pose: Pose = { walk: Math.abs(x - from) / s.u / 6.2, stride: moving ? 0.8 : 0, blink: blinking(s.time, 7), lift }
        let hasBaton = t < tl.start.fly
        let wet = false
        let says = ''
        let dizzy = false
        if (tl.on('set', t) || tl.on('pack', t)) {
          const dip = Math.sin((tl.on('set', t) ? tl.p('set', t) : tl.p('pack', t)) * Math.PI)
          pose = { ...pose, crouch: dip * 0.9, lean: dip * 0.5, armB: 0.8, elbowB: 0.2 }
        } else if (tl.on('tap', t)) {
          const tap = Math.abs(Math.sin(tl.since('tap', t) * 3.2 * Math.PI))
          pose = { ...pose, armF: 1.35 + tap * 0.18, elbowF: 0.5, armB: 0.3, elbowB: 1.2, mouth: 'flat', headTilt: -0.06 }
        } else if (tl.on('slow', t)) {
          const b = tl.since('slow', t) * 5
          pose = { ...pose, armF: 1.8 + Math.sin(b) * 0.4, elbowF: 0.5 + Math.cos(b * 2) * 0.25, armB: 1.3 + Math.sin(b + 1) * 0.2, elbowB: 0.6, eyes: 'closed', mouth: 'smile', headTilt: Math.sin(b * 0.5) * 0.08 }
        } else if (tl.on('fast', t)) {
          const b = tl.since('fast', t) * 9
          pose = { ...pose, armF: 2.0 + Math.sin(b) * 0.7, elbowF: 0.4 + Math.cos(b * 2) * 0.4, armB: 1.6 + Math.sin(b + 2) * 0.6, elbowB: 0.5, eyes: 'closed', mouth: 'grin', lean: Math.sin(b * 0.5) * 0.12, headTilt: Math.sin(b) * 0.1 }
        } else if (tl.on('frenzy', t)) {
          const b = tl.since('frenzy', t) * 15
          wet = true
          pose = { ...pose, armF: 2.1 + Math.sin(b) * 1.0, elbowF: 0.3 + Math.cos(b * 2) * 0.5, armB: 1.9 + Math.sin(b + 2.4) * 0.9, elbowB: 0.4, eyes: 'closed', mouth: 'o', lean: Math.sin(b * 0.5) * 0.2, headTilt: Math.sin(b) * 0.16, lift: lift + Math.abs(Math.sin(b * 0.5)) * 3.5 }
        } else if (tl.on('fly', t) || tl.on('stare', t)) {
          const pt = tl.since('fly', t)
          if (ending === 'bonk' && pt > 1.05) {
            dizzy = true
            pose = { ...pose, armF: 0.4, armB: 0.3, eyes: 'closed', mouth: 'frown', headTilt: Math.sin(t * 5) * 0.1, crouch: 0.2 }
          } else {
            pose = { ...pose, armF: 2.9, elbowF: 0.1, armB: 0.5, eyes: 'wide', mouth: 'o', headTilt: ending === 'bonk' ? -0.3 : 0 }
            if (pt > 0.5) says = '?'
          }
        } else if (tl.on('down', t)) pose = { ...pose, mouth: 'flat' }
        // The baton once it has left: [x, y, angle] in his frame.
        let loose: [number, number, number] | null = null
        const collected = t > tl.start.out && reached(x)
        if (!hasBaton && !collected) {
          const pt = t - tl.start.fly
          if (ending === 'stuck') {
            const p = clamp(pt / 1.5)
            if (p < 1) loose = [lerp(10, landX, p), lerp(-62, 0, p) - Math.sin(p * Math.PI) * 58, pt * 16]
            else loose = [landX, 0, -Math.PI / 2 - 0.25 + Math.sin(t * 38) * 0.18 * Math.exp(-(pt - 1.5) * 2.2)]
          } else if (pt < 1.05) {
            const p = pt / 1.05
            loose = [lerp(10, 2, p), lerp(-62, -60 - H, p) - Math.sin(p * Math.PI) * 80, pt * 18]
          } else {
            const p = clamp((pt - 1.05) / 0.5)
            loose = [lerp(2, landX, p), lerp(-60 - H, -0.8, p * p) - Math.sin(p * Math.PI) * 12, p < 1 ? pt * 14 : 0.05]
          }
        }
        if (collected) hasBaton = true
        const off = (spot - x) / s.u / dir // his frame slides once he walks off
        at(ctx, x, s.ground, s.u, dir, () => {
          if (podiumDown) {
            groundShadow(ctx, 0, 14)
            drawPodium(ctx, 0, 0)
          } else groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, MAESTRO, pose, (an) => {
            // Tails, and the podium under one arm when travelling.
            fillPoly(ctx, [an.hip.x - 7.5, an.hip.y - 5, an.hip.x - 13, an.hip.y + 11, an.hip.x - 9.5, an.hip.y + 10, an.hip.x - 8, an.hip.y + 12.5, an.hip.x - 3, an.hip.y + 1], '#3a4a6e')
            if (!podiumDown) drawPodium(ctx, an.handB.x - 2, an.handB.y + 6)
          })
          bowTie(ctx, a, C.white)
          if (hasBaton) {
            const ang = Math.atan2(a.handF.y - a.elbowF.y, a.handF.x - a.elbowF.x) - 0.5
            drawBaton(ctx, a.handF.x, a.handF.y, ang)
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, MAESTRO.skin)
          }
          if (wet) sweat(ctx, a.head.x, a.head.y - 8, t)
          if (dizzy) {
            for (let i = 0; i < 3; i++) {
              const an = t * 5 + (i * TAU) / 3
              fillCirc(ctx, a.crown.x + Math.cos(an) * 9, a.crown.y - 3 + Math.sin(an) * 2.5, 1.3, C.yellow)
            }
          }
          if (loose) drawBaton(ctx, loose[0] + off, loose[1], loose[2])
        })
        if (says) say(s, x, -78, says)
      },
    })
  },
}

export const MUSIC_ACTS: ActDef[] = [hornSolo, bassoonSolo, duet, waterEmpty, reedFuss, conductor]
