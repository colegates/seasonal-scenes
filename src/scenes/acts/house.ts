import { DOG, drawDog } from '../creatures'
import { C, TAU, alpha, at, fillCirc, seg, fillEll, fillPoly, fillRR, groundShadow, line, poly, shade } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines } from '../kit'
import { CAST, drawPerson, type Look } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef } from '../types'

// Acts that can turn up in any daytime theme. Several are tied to what the
// house is really doing: the bins going out, the rain, a birthday tomorrow.

// ─── Bin night ───────────────────────────────────────────────────────────────
// Only cast when a bin is due. Someone in a dressing gown and slippers drags
// the right colour of wheelie bin across. It is the app's most useful joke.

const BIN_COLORS = { domestic: '#64748b', recycling: '#2563eb', food: '#92400e' } as const

function drawWheelieBin(ctx: CanvasRenderingContext2D, color: string, lid: number, small: boolean) {
  const k = small ? 0.6 : 1
  ctx.save()
  ctx.scale(k, k)
  fillCirc(ctx, -7, -4, 4, '#111827')
  fillCirc(ctx, -7, -4, 1.5, '#94a3b8')
  fillPoly(ctx, [-11, -36, 11, -36, 8, -3, -8, -3], color)
  fillPoly(ctx, [-11, -36, -6, -36, -5, -3, -8, -3], shade(color, -0.18))
  fillRR(ctx, -6, -24, 12, 2, 1, shade(color, 0.2))
  ctx.save()
  ctx.translate(-12, -37)
  ctx.rotate(-lid * 1.1)
  fillRR(ctx, 0, -3.5, 25, 4.5, 2, shade(color, 0.12))
  fillRR(ctx, 22, -4.5, 5, 3, 1.5, shade(color, -0.2))
  ctx.restore()
  ctx.restore()
}

const binNight: ActDef = {
  id: 'house.bin-night',
  weight: 5,
  when: (c) => c.house.binDay !== undefined,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const kind = stage.context.house.binDay ?? 'domestic'
    const stowaway = chance(rng, 0.45)
    const look: Look = { ...CAST.dad, top: '#7c3aed', bottom: '#7c3aed', shoe: '#f9a8d4', scarf: undefined }
    const peekAt = range(rng, 0.4, 0.6)
    let x = from
    let walk = 0
    let peek = 0
    return makeAct({
      update(s, dt) {
        x += dir * 42 * s.u * dt
        walk += dt * 7
        const frac = dir === 1 ? x / s.w : 1 - x / s.w
        const want = stowaway && frac > peekAt && frac < peekAt + 0.22 ? 1 : 0
        peek += (want - peek) * dt * 5
        return dir === 1 ? x < to : x > to
      },
      draw(s, t) {
        const { ctx } = s
        at(ctx, x, s.ground, s.u, dir, () => {
          // The bin trails behind, tipped onto its wheels.
          ctx.save()
          ctx.translate(-26, 0)
          groundShadow(ctx, 0, 12)
          ctx.rotate(0.3)
          ctx.translate(Math.sin(walk * 2) * 0.4, Math.abs(Math.sin(walk * 2)) * -0.6)
          if (peek > 0.05) {
            // A fox, having a look at where it is being taken.
            ctx.save()
            ctx.translate(2, -36 - peek * 9)
            fillPoly(ctx, [-6, -3, -4, -11, -1, -4], '#ea580c')
            fillPoly(ctx, [6, -3, 4, -11, 1, -4], '#ea580c')
            fillEll(ctx, 0, 0, 7.5, 6, '#ea580c')
            fillPoly(ctx, [-6, 1, 6, 1, 0, 8], C.white)
            fillCirc(ctx, 0, 7, 1.3, C.ink)
            fillCirc(ctx, -3, -1, 1.1, C.ink)
            fillCirc(ctx, 3, -1, 1.1, C.ink)
            ctx.restore()
          }
          drawWheelieBin(ctx, BIN_COLORS[kind], peek * 0.8, kind === 'food')
          ctx.restore()
          groundShadow(ctx, 0, 11)
          const a = drawPerson(ctx, look, {
            walk,
            stride: 0.6,
            armB: -1.0,
            elbowB: -0.2,
            lean: 0.12,
            mouth: 'flat',
            eyes: blinking(s.time, 2) ? 'closed' : 'normal',
          })
          // Dressing-gown cord and a mug of tea.
          line(ctx, a.hip.x - 6, a.hip.y - 5, a.hip.x + 7, a.hip.y - 5, 1.6, '#c4b5fd')
          line(ctx, a.hip.x + 4, a.hip.y - 5, a.hip.x + 5, a.hip.y + 4, 1.4, '#c4b5fd')
          fillRR(ctx, a.handF.x - 1, a.handF.y - 5, 6, 6.5, 1.5, C.white)
          for (let i = 0; i < 2; i++) {
            const p = (t * 0.7 + i * 0.5) % 1
            ctx.globalAlpha = (1 - p) * 0.5
            fillCirc(ctx, a.handF.x + 2 + Math.sin(p * 5 + i) * 2, a.handF.y - 7 - p * 9, 1.6 + p, C.white)
          }
          ctx.globalAlpha = 1
          line(ctx, a.handB.x, a.handB.y, -19, -30, 1.6, '#334155')
        })
      },
    })
  },
}

// ─── Rain ────────────────────────────────────────────────────────────────────
// When it is actually raining outside. An umbrella, and a gust.

function drawUmbrella(ctx: CanvasRenderingContext2D, x: number, y: number, inverted: number, color: string) {
  line(ctx, x, y, x, y - 30, 1.4, '#cbd5e1')
  ctx.save()
  ctx.translate(x, y - 30)
  const flip = 1 - inverted * 2
  ctx.beginPath()
  ctx.moveTo(-22, 0)
  ctx.quadraticCurveTo(-20, -18 * flip, 0, -19 * flip)
  ctx.quadraticCurveTo(20, -18 * flip, 22, 0)
  for (let i = 3; i >= -3; i -= 2) ctx.quadraticCurveTo(i * 5.5 + 2.7, -5 * flip, i * 5.5 - 2.7 > -22 ? i * 5.5 - 5.5 * 0.5 - 2.7 : -22, 0)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-7, -1)
  ctx.quadraticCurveTo(-6, -17 * flip, 0, -19 * flip)
  ctx.quadraticCurveTo(6, -17 * flip, 7, -1)
  ctx.closePath()
  ctx.fillStyle = shade(color, 0.16)
  ctx.fill()
  ctx.restore()
}

const rainyDay: ActDef = {
  id: 'house.rain',
  weight: 4,
  when: (c) => /rain|pour|lightning|hail/.test(c.house.weather ?? ''),
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const gust = chance(rng, 0.5)
    const look: Look = { ...pick(rng, [CAST.mum, CAST.grandad, CAST.dad]), top: '#facc15', shoe: '#16a34a' }
    const gustAt = range(rng, 0.4, 0.6)
    let x = from
    let walk = 0
    let inv = 0
    return makeAct({
      update(s, dt, t) {
        const frac = dir === 1 ? x / s.w : 1 - x / s.w
        const blown = gust && frac > gustAt
        inv += ((blown ? 1 : 0) - inv) * dt * 7
        x += dir * (blown ? 30 : 48) * s.u * dt
        walk += dt * (blown ? 5 : 8)
        // A private rain cloud's worth of drops around them.
        if (Math.floor(t * 26) !== Math.floor((t - dt) * 26)) {
          s.particles.emit({
            kind: 'drop',
            x: x + range(rng, -70, 70) * s.u,
            y: s.ground - range(rng, 110, 150) * s.u,
            vx: (blown ? -dir * 80 : -20) * s.u,
            vy: 200 * s.u,
            g: 300,
            size: range(rng, 2, 3) * s.u,
            color: alpha(C.sky, 0.8),
            life: 1.4,
          })
        }
        return dir === 1 ? x < to : x > to
      },
      draw(s, t) {
        const { ctx } = s
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          const blown = inv > 0.5
          const a = drawPerson(ctx, look, {
            walk,
            stride: 0.75,
            armF: blown ? 2.3 : 1.9,
            elbowF: blown ? 0.2 : 0.9,
            lean: blown ? 0.3 : 0.05,
            mouth: blown ? 'o' : 'smile',
            eyes: blown ? 'wide' : 'normal',
            blink: blinking(s.time, 7),
          })
          ctx.save()
          ctx.translate(a.handF.x, a.handF.y)
          ctx.rotate(blown ? -0.5 + Math.sin(t * 20) * 0.06 : 0)
          drawUmbrella(ctx, 0, 0, inv, '#ef4444')
          ctx.restore()
          if (blown) speedLines(ctx, a.head.x + 30, a.head.y - 6, -14, t)
        })
      },
    })
  },
}

// ─── The paper round ─────────────────────────────────────────────────────────
// Mornings only. A child on a bike lobs a rolled newspaper, which the dog
// fetches and proudly returns to nobody.

function drawBike(ctx: CanvasRenderingContext2D, spin: number, color: string) {
  for (const wx of [-15, 15]) {
    ctx.beginPath()
    ctx.arc(wx, -9, 9, 0, TAU)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#cbd5e1'
    ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 4
      line(ctx, wx - Math.cos(a) * 8, -9 - Math.sin(a) * 8, wx + Math.cos(a) * 8, -9 + Math.sin(a) * 8, 0.6, alpha('#cbd5e1', 0.7))
    }
  }
  poly(ctx, [-15, -9, -4, -24, 9, -24, 15, -9], 2.2, color)
  poly(ctx, [-4, -24, 1, -9, 9, -24], 2.2, color)
  line(ctx, -15, -9, 1, -9, 2.2, color)
  line(ctx, 9, -24, 11, -31, 2, color)
  line(ctx, 8, -31, 15, -32, 2.2, '#1f2937')
  fillRR(ctx, -9, -27.5, 9, 3, 1.5, '#1f2937')
  // A basket of papers on the front.
  fillRR(ctx, 14, -30, 10, 8, 2, '#a16207')
  for (let i = 0; i < 3; i++) fillRR(ctx, 15 + i * 3, -34, 2.4, 6, 1, C.white)
}

const paperRound: ActDef = {
  id: 'house.paper-round',
  weight: 2,
  when: (c) => c.dayPart === 'dawn' || c.dayPart === 'morning',
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const throwAt = range(rng, 0.3, 0.5)
    const withDog = chance(rng, 0.6)
    const rider: Look = { ...CAST.kid, hat: 'cap', hatColor: C.red }
    let x = from
    let spin = 0
    let thrown = false
    let paper: { x: number; y: number; vx: number; vy: number; rot: number; landed: boolean } | null = null
    let dogX = from - dir * 60 * stage.u
    let dogHas = false
    let paperFade = 0
    return makeAct({
      update(s, dt) {
        x += dir * 96 * s.u * dt
        spin += dt * 11 * dir
        const frac = dir === 1 ? x / s.w : 1 - x / s.w
        if (!thrown && frac > throwAt) {
          thrown = true
          paper = { x, y: s.ground - 50 * s.u, vx: -dir * 60 * s.u, vy: -150 * s.u, rot: 0, landed: false }
        }
        if (paper && !paper.landed) {
          paper.vy += 420 * s.u * dt
          paper.x += paper.vx * dt
          paper.y += paper.vy * dt
          paper.rot += dt * 12
          if (paper.y >= s.ground - 3 * s.u) {
            paper.y = s.ground - 3 * s.u
            paper.landed = true
            burst(s, 'dust', paper.x, s.ground - 2, 3, ['#cbd5e1'], 30, [3, 5])
          }
        }
        if (withDog) {
          dogX += dir * 118 * s.u * dt
          if (paper && paper.landed && !dogHas && (dogX - paper.x) * dir > -10 * s.u) dogHas = true
        }
        // Whoever is further behind decides when the scene is over.
        const lastX = withDog ? (dir === 1 ? Math.min(x, dogX) : Math.max(x, dogX)) : x
        const gone = dir === 1 ? lastX >= to : lastX <= to
        // With no dog to fetch it, the paper lies there a moment and fades.
        if (gone && paper && !dogHas) paperFade += dt
        return !gone || (paper !== null && !dogHas && paperFade < 1.2)
      },
      draw(s, t) {
        const { ctx } = s
        if (paper && !dogHas) {
          ctx.globalAlpha = 1 - Math.min(1, paperFade / 1.2)
          ctx.save()
          ctx.translate(paper.x, paper.y)
          ctx.rotate(paper.landed ? 0 : paper.rot)
          ctx.scale(s.u, s.u)
          fillRR(ctx, -6, -2, 12, 4, 2, C.white)
          line(ctx, 0, -2, 0, 2, 1, C.red)
          ctx.restore()
          ctx.globalAlpha = 1
        }
        if (withDog) {
          at(ctx, dogX, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 13)
            const d = drawDog(ctx, DOG, { run: t * 16, stride: 1, wag: t * 20 })
            if (dogHas) {
              fillRR(ctx, d.mouth.x - 3, d.mouth.y - 3, 4, 9, 2, C.white)
              line(ctx, d.mouth.x - 3, d.mouth.y + 1, d.mouth.x + 1, d.mouth.y + 1, 1, C.red)
            }
          })
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 22)
          const throwing = thrown && paper !== null && !paper.landed
          ctx.save()
          ctx.translate(-6, -14)
          ctx.scale(0.82, 0.82)
          drawPerson(ctx, rider, {
            walk: spin * dir,
            stride: 0.45,
            crouch: 0.45,
            lean: 0.3,
            armF: throwing ? -2.2 : 1.2,
            elbowF: throwing ? 0.3 : 0.4,
            armB: 1.2,
            mouth: 'grin',
            blink: blinking(s.time, 9),
          })
          ctx.restore()
          drawBike(ctx, spin * dir, C.cyan)
        })
      },
    })
  },
}

// ─── The stick ───────────────────────────────────────────────────────────────
// The dog has found the best stick in the world. It is far too long.

const dogStick: ActDef = {
  id: 'house.dog-stick',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 90)
    const postAt = stage.w * range(rng, 0.42, 0.58)
    const blocked = chance(rng, 0.6)
    let x = from
    let run = 0
    let phase: 'trot' | 'stuck' | 'think' | 'through' = 'trot'
    let pt = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        if (phase === 'trot') {
          x += dir * 74 * s.u * dt
          run += dt * 13
          if (blocked && (x - postAt) * dir > -34 * s.u) {
            phase = 'stuck'
            pt = 0
            burst(s, 'star', postAt, s.ground - 30 * s.u, 4, [C.white, C.yellow], 70, [3, 4])
          }
        } else if (phase === 'stuck') {
          // Two more tries, backing up and walking into the posts again.
          const cyc = pt % 1.2
          x += dir * (cyc < 0.6 ? -26 : 26) * s.u * dt
          run += dt * 9
          if (pt > 2.4) {
            phase = 'think'
            pt = 0
          }
        } else if (phase === 'think') {
          if (pt > 1.6) {
            phase = 'through'
            pt = 0
          }
        } else {
          x += dir * 92 * s.u * dt
          run += dt * 15
        }
        return dir === 1 ? x < to : x > to
      },
      draw(s, t) {
        const { ctx } = s
        // The arch fades in as the scene opens and out once the dog is through.
        const archAlpha = Math.min(1, t / 0.8) * (phase === 'through' ? 1 - seg(pt, 0.8, 1.6) : 1)
        if (blocked && archAlpha > 0.01) {
          ctx.globalAlpha = archAlpha
          // A low garden arch, a dog's width across.
          at(ctx, postAt, s.ground, s.u, 1, () => {
            for (const px of [-13, 13]) {
              fillRR(ctx, px - 2.5, -44, 5, 44, 1.5, '#a16207')
              fillRR(ctx, px - 2.5, -44, 2, 44, 1, shade('#a16207', -0.2))
              fillCirc(ctx, px, -45, 3.4, '#ca8a04')
            }
            // The crossbar the upright stick cannot get under.
            fillRR(ctx, -15, -40, 30, 4, 2, '#ca8a04')
          })
          ctx.globalAlpha = 1
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 14)
          const sideways = phase === 'through'
          const d = drawDog(ctx, DOG, {
            run,
            stride: phase === 'think' ? 0 : 0.8,
            wag: t * (phase === 'think' ? 4 : 18),
            sitting: phase === 'think',
            tilt: phase === 'think' ? Math.sin(t * 3) * 0.3 : 0,
          })
          ctx.save()
          ctx.translate(d.mouth.x - 1, d.mouth.y)
          ctx.rotate(sideways ? 0.05 : Math.PI / 2 - 0.12)
          line(ctx, -34, 0, 34, 0, 3, '#92400e')
          line(ctx, 12, 0, 20, -6, 2, '#92400e')
          line(ctx, -18, 0, -24, 5, 2, '#92400e')
          fillEll(ctx, 21, -7, 3, 1.6, '#65a30d', -0.6)
          ctx.restore()
          if (phase === 'think') bubble(ctx, d.back.x + 6, d.back.y - 20, pt > 1.0 ? '!' : '?')
        })
      },
    })
  },
}

// ─── Chasing the tail ────────────────────────────────────────────────────────

const dogTail: ActDef = {
  id: 'house.dog-tail',
  weight: 1.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const spot = stage.w * range(rng, 0.35, 0.65)
    const dizzy = chance(rng, 0.6)
    let x = from
    let phase: 'in' | 'spin' | 'dizzy' | 'out' = 'in'
    let pt = 0
    let run = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        run += dt * 14
        if (phase === 'in') {
          x += dir * 80 * s.u * dt
          if ((x - spot) * dir >= 0) {
            phase = 'spin'
            pt = 0
          }
        } else if (phase === 'spin') {
          if (pt > 3) {
            phase = dizzy ? 'dizzy' : 'out'
            pt = 0
          }
        } else if (phase === 'dizzy') {
          if (pt > 2.4) {
            phase = 'out'
            pt = 0
          }
        } else {
          x += dir * 70 * s.u * dt
        }
        return dir === 1 ? x < to : x > to
      },
      draw(s, t) {
        const { ctx } = s
        const spinning = phase === 'spin'
        // Spinning is drawn as fast flips with a hop, which reads as a whirl.
        const facing = spinning ? ((Math.floor(pt * 7) % 2 === 0 ? 1 : -1) as 1 | -1) : dir
        at(ctx, x + (phase === 'dizzy' ? Math.sin(t * 5) * 4 * s.u : 0), s.ground, s.u, facing, () => {
          groundShadow(ctx, 0, 14)
          if (spinning) ctx.translate(0, -Math.abs(Math.sin(pt * 22)) * 3)
          const d = drawDog(ctx, DOG, {
            run,
            stride: phase === 'dizzy' ? 0 : 0.9,
            wag: t * 20,
            sitting: phase === 'dizzy',
            mouthOpen: phase !== 'in',
            tilt: phase === 'dizzy' ? Math.sin(t * 5) * 0.35 : 0,
          })
          if (phase === 'dizzy') {
            for (let i = 0; i < 3; i++) {
              const a = t * 4 + (i * TAU) / 3
              ctx.globalAlpha = 0.9
              fillCirc(ctx, d.back.x + 16 + Math.cos(a) * 9, d.back.y - 12 + Math.sin(a) * 3, 1.6, C.yellow)
            }
            ctx.globalAlpha = 1
          }
        })
        if (spinning && Math.random() < 0.3) burst(s, 'dust', x, s.ground - 2, 1, ['#cbd5e1'], 50, [3, 5])
      },
    })
  },
}

// ─── A secret ────────────────────────────────────────────────────────────────
// The day before a birthday: someone tiptoes across hiding a wrapped present
// behind their back, finger to lips.

const birthdayEve: ActDef = {
  id: 'house.birthday-eve',
  weight: 5,
  when: (c) => c.birthdayTomorrow.length > 0,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const look = pick(rng, [CAST.mum, CAST.dad, CAST.grandad])
    const pauseAt = range(rng, 0.4, 0.6)
    let x = from
    let walk = 0
    let hush = 0
    let paused = false
    return makeAct({
      update(s, dt) {
        const frac = dir === 1 ? x / s.w : 1 - x / s.w
        if (!paused && frac > pauseAt) {
          paused = true
          hush = 2.4
        }
        if (hush > 0) hush -= dt
        else {
          x += dir * 30 * s.u * dt
          walk += dt * 5
        }
        return dir === 1 ? x < to : x > to
      },
      draw(s) {
        const { ctx } = s
        const shh = hush > 0
        at(ctx, x, s.ground, s.u, (shh && hush < 1.8 && hush > 0.9 ? -dir : dir) as 1 | -1, () => {
          groundShadow(ctx, 0, 11)
          const a = drawPerson(
            ctx,
            look,
            {
              walk,
              stride: shh ? 0 : 0.5,
              crouch: 0.3,
              lean: 0.12,
              armB: -0.9,
              elbowB: -0.9,
              armF: shh ? 2.4 : 0.5,
              elbowF: shh ? 2.0 : 0.6,
              mouth: shh ? 'o' : 'smile',
              eyes: shh ? 'wide' : 'normal',
              blink: blinking(s.time, 3),
            },
            (j) => {
              // The present, held behind the back.
              ctx.save()
              ctx.translate(j.handB.x - 6, j.handB.y + 2)
              fillRR(ctx, -8, -12, 16, 14, 2, '#f472b6')
              fillRR(ctx, -1.5, -12, 3, 14, 0, '#fde047')
              fillRR(ctx, -8, -6.5, 16, 3, 0, '#fde047')
              fillEll(ctx, -3, -14, 3.4, 2, '#fde047', -0.5)
              fillEll(ctx, 3, -14, 3.4, 2, '#fde047', 0.5)
              ctx.restore()
            },
          )
          if (shh) bubble(ctx, a.head.x + 4, a.head.y - 20, 'shh', { size: 9 })
        })
      },
    })
  },
}

export const HOUSE_ACTS: ActDef[] = [binNight, rainyDay, paperRound, dogStick, dogTail, birthdayEve]
