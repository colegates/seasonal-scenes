import { DOG, drawDog, drawSquirrel } from '../creatures'
import { C, alpha, at, clamp, easeInOut, easeOut, fillCirc, fillEll, fillRR, groundShadow, line, poly, seg, shade } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, sweat } from '../kit'
import { CAST, drawPerson } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, AmbientDef } from '../types'

export const AUTUMN_LEAVES = ['#f59e0b', '#ea7317', '#c2571d', '#e3b341', '#b23a1d', '#8a4b2a', '#d97706']

export const AUTUMN_AMBIENT: AmbientDef = {
  kind: 'leaf',
  colors: AUTUMN_LEAVES,
  rate: 2.4,
  flurry: [20, 26],
  settle: true,
  pile: 'items',
  maxPile: 15,
  size: [4, 7],
}

// ─── The leaf blower ─────────────────────────────────────────────────────────
// The scene the whole feature started from. He walks the length of the floor
// with a backpack blower and the pile takes off ahead of him. One time in
// three the machine has other ideas, and one time in three the dog follows
// along behind, carefully undoing his work one leaf at a time.

const leafBlower: ActDef = {
  id: 'autumn.leaf-blower',
  weight: 3,
  clears: true,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const speed = 58 * stage.u
    const gag = rng() < 0.34 ? 'backfire' : rng() < 0.5 ? 'dog' : 'plain'
    const backfireAt = stage.w * range(rng, 0.35, 0.6)
    let x = from
    let walk = 0
    let hold = 0 // seconds left standing still for the backfire gag
    let backfired = false
    let dogX = from - dir * 150 * stage.u
    let dogRun = 0
    let dropTimer = 1.5
    let hatOff = 0 // 0..1, earmuffs blown askew
    return makeAct({
      update(s, dt, t) {
        const travelled = dir === 1 ? x : s.w - x
        if (gag === 'backfire' && !backfired && travelled > backfireAt) {
          backfired = true
          hold = 3.2
        }
        if (hold > 0) {
          hold -= dt
          // 0.9s in, the blower coughs a cloud of leaves straight back at him.
          if (hold < 2.3 && hold + dt >= 2.3) {
            for (let i = 0; i < 16; i++) {
              s.particles.emit({
                kind: 'leaf',
                x: x + dir * 26 * s.u,
                y: s.ground - 30 * s.u,
                vx: -dir * range(rng, 30, 150) * s.u,
                vy: -range(rng, 20, 160) * s.u,
                g: 170,
                drag: 0.5,
                vr: range(rng, -10, 10),
                size: range(rng, 4, 7) * s.u,
                color: pick(rng, AUTUMN_LEAVES),
                life: 2.4,
              })
            }
            burst(s, 'dust', x + dir * 24 * s.u, s.ground - 28 * s.u, 6, ['#cbd5e1'], 50, [5, 9])
            hatOff = 1
          }
        } else {
          x += dir * speed * dt
          walk += dt * 9
          hatOff = Math.max(0, hatOff - dt * 0.25)
          // The air stream lifts the pile a little way ahead of the nozzle.
          s.particles.blast(x + dir * 44 * s.u, 20 * s.u, dir, 250 * s.u)
          if (Math.floor(t * 12) !== Math.floor((t - dt) * 12)) {
            s.particles.emit({
              kind: 'dust',
              x: x + dir * 40 * s.u,
              y: s.ground - 3 * s.u,
              vx: dir * range(rng, 60, 140) * s.u,
              vy: -range(rng, 5, 40) * s.u,
              size: range(rng, 4, 8) * s.u,
              color: '#cbd5e1',
            })
          }
        }
        if (gag === 'dog') {
          dogX += dir * speed * 0.98 * dt
          dogRun += dt * 11
          dropTimer -= dt
          const onStage = dogX > 20 && dogX < s.w - 20
          if (dropTimer <= 0 && onStage) {
            dropTimer = range(rng, 0.9, 1.6)
            s.particles.emit({
              kind: 'leaf',
              x: dogX + dir * 24 * s.u,
              y: s.ground - 18 * s.u,
              vy: 30,
              sway: 10,
              size: range(rng, 5, 7) * s.u,
              color: pick(rng, AUTUMN_LEAVES),
              settle: true,
            })
          }
        }
        const lastX = gag === 'dog' ? dogX : x
        return dir === 1 ? lastX < to : lastX > to
      },
      draw(s, t) {
        const { ctx } = s
        const stalled = hold > 0
        const shock = stalled && hold < 2.3
        const peering = stalled && hold >= 2.3
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 12)
          const shake = peering ? Math.sin(t * 40) * 0.08 : 0
          const a = drawPerson(
            ctx,
            { ...CAST.gardener, pack: '#f97316', hat: hatOff > 0.5 ? 'none' : 'earmuffs' },
            {
              walk,
              stride: stalled ? 0 : 0.85,
              armF: peering ? 1.5 : 0.85 + shake,
              elbowF: peering ? 1.5 : 0.55,
              armB: peering ? 1.3 : 0.6,
              elbowB: peering ? 1.2 : 0.7,
              lean: shock ? -0.22 : 0.08,
              mouth: shock ? 'o' : peering ? 'flat' : 'smile',
              eyes: shock ? 'wide' : 'normal',
              blink: blinking(s.time, 1),
            },
          )
          // The blower: a hose from the backpack, a fat tube, a flared nozzle.
          const hx = a.handF.x
          const hy = a.handF.y
          const tipX = peering ? a.head.x + 13 : hx + 26
          const tipY = peering ? a.head.y + 2 : -6
          poly(ctx, [a.back.x - 2, a.back.y + 2, a.hip.x + 2, a.hip.y + 3, hx - 3, hy + 2], 2.6, '#334155')
          line(ctx, hx - 4, hy + 1, tipX, tipY, 5.4, '#f97316')
          line(ctx, hx - 4, hy - 0.4, tipX, tipY - 1.4, 1.4, alpha('#ffffff', 0.35))
          const ang = Math.atan2(tipY - hy, tipX - hx)
          ctx.save()
          ctx.translate(tipX, tipY)
          ctx.rotate(ang)
          fillRR(ctx, -2, -4.2, 8, 8.4, 2, '#1f2937')
          ctx.restore()
          fillCirc(ctx, hx, hy, 2.8, CAST.gardener.skin)
          if (!stalled) {
            // Wind.
            ctx.lineCap = 'round'
            for (let i = 0; i < 4; i++) {
              const p = (t * 2.6 + i * 0.25) % 1
              ctx.globalAlpha = (1 - p) * 0.5
              ctx.strokeStyle = C.white
              ctx.lineWidth = 1.3
              ctx.beginPath()
              ctx.moveTo(tipX + 6 + p * 26, tipY + (i - 1.5) * 2.2 + p * (i - 1.5) * 3)
              ctx.lineTo(tipX + 14 + p * 30, tipY + (i - 1.5) * 2.2 + p * (i - 1.5) * 4.5)
              ctx.stroke()
            }
            ctx.globalAlpha = 1
          }
          if (peering) bubble(ctx, a.head.x - 4, a.head.y - 20, '?')
          if (shock) {
            // A leaf stuck to his face, and the earmuffs knocked off.
            fillEll(ctx, a.head.x + 7, a.head.y + 2, 5, 2.8, '#ea7317', 0.6)
            const fall = clamp((2.3 - hold) / 0.6)
            ctx.save()
            ctx.translate(a.head.x - 10 - fall * 8, a.head.y - 6 + fall * fall * 44)
            ctx.rotate(-fall * 2)
            fillEll(ctx, 0, 0, 4.2, 5.2, C.red)
            ctx.restore()
          }
        })
        if (gag === 'dog') {
          at(ctx, dogX, s.ground, s.u, dir, () => {
            groundShadow(ctx, 0, 14)
            const d = drawDog(ctx, DOG, { run: dogRun, stride: 0.55, wag: t * 14 })
            fillEll(ctx, d.mouth.x + 2, d.mouth.y - 1, 5.5, 3, '#ea7317', -0.3)
            line(ctx, d.mouth.x - 3, d.mouth.y - 1, d.mouth.x + 6, d.mouth.y - 1, 0.8, 'rgba(40,20,5,0.5)')
          })
        }
      },
    })
  },
}

// ─── Leaf-pile jump ──────────────────────────────────────────────────────────
// A child spots the pile, takes a run-up, and cannonballs into it.

const leafJump: ActDef = {
  id: 'autumn.leaf-jump',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng)
    const target = stage.w * range(rng, 0.4, 0.6)
    const look = chance(rng, 0.5) ? { ...CAST.kid, scarf: C.red } : { ...CAST.girl, scarf: C.yellow, hat: 'bobble' as const, hatColor: C.mint }
    const startX = target - dir * 150 * stage.u
    let x = from
    let walk = 0
    let phase: 'walk' | 'spot' | 'run' | 'air' | 'buried' | 'leave' = 'walk'
    let pt = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        const go = (speed: number) => {
          x += dir * speed * s.u * dt
          walk += dt * (speed / 6.2)
        }
        if (phase === 'walk') {
          go(52)
          if ((dir === 1 && x >= startX) || (dir === -1 && x <= startX)) {
            phase = 'spot'
            pt = 0
          }
        } else if (phase === 'spot') {
          if (pt > 1.1) {
            phase = 'run'
            pt = 0
          }
        } else if (phase === 'run') {
          go(150)
          if (Math.abs(x - target) < 46 * s.u) {
            phase = 'air'
            pt = 0
          }
        } else if (phase === 'air') {
          x += dir * 82 * s.u * dt
          if (pt > 0.55) {
            phase = 'buried'
            pt = 0
            const lifted = s.particles.blast(x, 46 * s.u, dir * 0.15, 230 * s.u)
            const extra = Math.max(0, 16 - lifted)
            for (let i = 0; i < extra; i++) {
              s.particles.emit({
                kind: 'leaf',
                x: x + range(rng, -20, 20) * s.u,
                y: s.ground - 6 * s.u,
                vx: range(rng, -120, 120) * s.u,
                vy: -range(rng, 80, 240) * s.u,
                g: 200,
                drag: 0.6,
                vr: range(rng, -10, 10),
                size: range(rng, 4, 7) * s.u,
                color: pick(rng, AUTUMN_LEAVES),
                life: 2.6,
                settle: true,
              })
            }
          }
        } else if (phase === 'buried') {
          if (pt > 2.2) {
            phase = 'leave'
            pt = 0
          }
        } else {
          go(60)
          return dir === 1 ? x < to : x > to
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const jump = phase === 'air' ? Math.sin(seg(pt, 0, 0.55) * Math.PI) * 26 : 0
        const sunk = phase === 'buried' ? (pt < 1.5 ? 1 : 1 - easeOut(seg(pt, 1.5, 2.2))) : 0
        at(ctx, x, s.ground, s.u, dir, () => {
          if (phase !== 'buried') groundShadow(ctx, 0, 10 - jump * 0.15)
          if (sunk > 0) {
            // Only the head and two arms stick out of the heap.
            ctx.save()
            ctx.beginPath()
            ctx.rect(-40, -80, 80, 80 - 2)
            ctx.clip()
            ctx.translate(0, sunk * 30)
            drawPerson(ctx, look, { armF: 2.6, armB: -2.6, elbowF: -0.3, elbowB: 0.3, mouth: 'grin', eyes: 'closed', headTilt: Math.sin(t * 5) * 0.08 })
            ctx.restore()
            // A leaf perched on the head.
            fillEll(ctx, 1, -34 + sunk * 30 - 62 * (1 - sunk) * 0 - 10, 5, 2.6, '#f59e0b', 0.3)
            return
          }
          const a = drawPerson(ctx, look, {
            walk,
            stride: phase === 'spot' ? 0 : phase === 'run' ? 1 : phase === 'air' ? 0.3 : 0.8,
            lean: phase === 'run' ? 0.26 : phase === 'air' ? 0.5 : 0,
            armF: phase === 'spot' ? 2.1 : phase === 'air' ? 2.8 : undefined,
            armB: phase === 'air' ? -2.4 : undefined,
            crouch: phase === 'air' ? 0.7 : 0,
            lift: jump,
            mouth: phase === 'spot' ? 'o' : phase === 'air' ? 'grin' : 'smile',
            eyes: phase === 'spot' ? 'wide' : 'normal',
            blink: blinking(s.time, 3),
          })
          if (phase === 'spot') bubble(ctx, a.head.x, a.head.y - 18, '!', { color: C.crimson })
          if (phase === 'leave') fillEll(ctx, a.crown.x, a.crown.y - 1, 5, 2.6, '#f59e0b', 0.3)
        })
      },
    })
  },
}

// ─── The squirrel ────────────────────────────────────────────────────────────
// Bounds on with an acorn, buries it with great secrecy, bounds off. Sometimes
// a second squirrel was watching the whole time.

const squirrel: ActDef = {
  id: 'autumn.squirrel',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 30)
    const spot = stage.w * range(rng, 0.3, 0.7)
    const thief = chance(rng, 0.45)
    let x = from
    let hop = 0
    let phase: 'in' | 'look' | 'dig' | 'out' | 'thief-in' | 'thief-dig' | 'thief-out' = 'in'
    let pt = 0
    let tx = from - dir * 30 * stage.u
    return makeAct({
      update(s, dt) {
        pt += dt
        const bound = (pos: number, speed = 105) => {
          hop = (hop + dt * 3.1) % 1
          return pos + dir * speed * s.u * dt
        }
        if (phase === 'in') {
          x = bound(x)
          if ((dir === 1 && x >= spot) || (dir === -1 && x <= spot)) {
            phase = 'look'
            pt = 0
            hop = 0
          }
        } else if (phase === 'look') {
          if (pt > 1.4) {
            phase = 'dig'
            pt = 0
          }
        } else if (phase === 'dig') {
          if (Math.floor(pt * 9) !== Math.floor((pt - dt) * 9)) {
            burst(s, 'dust', x + dir * 8 * s.u, s.ground - 2, 1, ['#a8a29e'], 60, [3, 5])
            s.particles.blast(x + dir * 8 * s.u, 10 * s.u, -dir * 0.6, 90 * s.u)
          }
          if (pt > 1.5) {
            phase = 'out'
            pt = 0
          }
        } else if (phase === 'out') {
          x = bound(x, 125)
          const gone = dir === 1 ? x > to : x < to
          if (gone) {
            if (!thief) return false
            phase = 'thief-in'
            pt = 0
          }
        } else if (phase === 'thief-in') {
          tx = bound(tx, 70)
          if ((dir === 1 && tx >= spot) || (dir === -1 && tx <= spot)) {
            phase = 'thief-dig'
            pt = 0
            hop = 0
          }
        } else if (phase === 'thief-dig') {
          if (Math.floor(pt * 9) !== Math.floor((pt - dt) * 9)) burst(s, 'dust', tx + dir * 8 * s.u, s.ground - 2, 1, ['#a8a29e'], 60, [3, 5])
          if (pt > 1.2) {
            phase = 'thief-out'
            pt = 0
          }
        } else {
          // The thief leaves the way it came, acorn in mouth.
          hop = (hop + dt * 3.4) % 1
          tx -= dir * 140 * s.u * dt
          return dir === 1 ? tx > from : tx < from
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const first = phase === 'in' || phase === 'look' || phase === 'dig' || phase === 'out'
        if (first) {
          const facing = phase === 'look' ? ((Math.floor(pt * 2.4) % 2 === 0 ? 1 : -1) as 1 | -1) : dir
          at(ctx, x, s.ground, s.u, (facing * 1) as 1 | -1, () => {
            groundShadow(ctx, 0, 8)
            const dig = phase === 'dig' ? Math.abs(Math.sin(t * 22)) * 0.5 : 0
            ctx.rotate(dig * 0.5)
            drawSquirrel(ctx, phase === 'look' || phase === 'dig' ? 0 : hop, phase !== 'out')
          })
          if (phase === 'look') at(ctx, x, s.ground, s.u, 1, () => bubble(ctx, 0, -28, '...', { size: 9 }))
        } else {
          const back = phase === 'thief-out'
          at(ctx, tx, s.ground, s.u, (back ? -dir : dir) as 1 | -1, () => {
            groundShadow(ctx, 0, 8)
            const dig = phase === 'thief-dig' ? Math.abs(Math.sin(t * 22)) * 0.5 : 0
            ctx.rotate(dig * 0.5)
            drawSquirrel(ctx, phase === 'thief-dig' ? 0 : hop, back, '#7c7f86')
          })
        }
      },
    })
  },
}

// ─── The rake ────────────────────────────────────────────────────────────────
// Grandad does it the old way, with a rake and a wheelbarrow, and it takes him
// a great deal longer. He stops halfway to mop his brow.

const raker: ActDef = {
  id: 'autumn.raker',
  weight: 1.5,
  clears: true,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const restAt = stage.w * range(rng, 0.4, 0.6)
    let x = from
    let walk = 0
    let rest = 0
    let rested = false
    let load = 0
    return makeAct({
      update(s, dt) {
        const travelled = dir === 1 ? x : s.w - x
        if (!rested && travelled > restAt) {
          rested = true
          rest = 2.6
        }
        if (rest > 0) {
          rest -= dt
          return true
        }
        const before = x
        x += dir * 44 * s.u * dt
        walk += dt * 7.5
        const got = s.particles.sweep(before + dir * 30 * s.u, x + dir * 30 * s.u)
        load = clamp(load + got * 0.012)
        return dir === 1 ? x < to : x > to
      },
      draw(s, t) {
        const { ctx } = s
        const resting = rest > 0
        at(ctx, x, s.ground, s.u, dir, () => {
          // Wheelbarrow, pushed ahead.
          const bx = 30
          groundShadow(ctx, bx + 4, 16)
          fillCirc(ctx, bx + 14, -5, 5, '#1f2937')
          fillCirc(ctx, bx + 14, -5, 2, '#94a3b8')
          ctx.beginPath()
          ctx.moveTo(bx - 10, -19)
          ctx.lineTo(bx + 18, -19)
          ctx.lineTo(bx + 12, -8)
          ctx.lineTo(bx - 5, -8)
          ctx.closePath()
          ctx.fillStyle = '#2f7d4f'
          ctx.fill()
          line(ctx, bx - 6, -8, bx - 8, 0, 1.8, '#475569')
          if (load > 0.02) {
            // The heap in the barrow grows as he goes.
            const hgt = 4 + load * 12
            fillEll(ctx, bx + 4, -19, 13, hgt, '#c2571d')
            fillEll(ctx, bx - 1, -20 - hgt * 0.3, 7, hgt * 0.6, '#f59e0b')
            fillEll(ctx, bx + 9, -20 - hgt * 0.2, 6, hgt * 0.5, '#e3b341')
          }
          groundShadow(ctx, 0, 11)
          const mop = resting ? easeInOut(seg(2.6 - rest, 0.2, 0.8)) * (1 - seg(2.6 - rest, 2.0, 2.5)) : 0
          const a = drawPerson(ctx, CAST.grandad, {
            walk,
            stride: resting ? 0 : 0.6,
            armF: resting ? 0.9 + mop * 1.7 : 0.95,
            elbowF: resting ? 0.4 + mop * 1.4 : 0.35,
            armB: 0.7,
            elbowB: 0.5,
            lean: resting ? -0.05 : 0.14,
            mouth: resting ? 'puff' : 'flat',
            eyes: resting && mop > 0.5 ? 'closed' : 'normal',
            blink: blinking(s.time, 5),
          })
          line(ctx, a.handB.x, a.handB.y, bx - 10, -18, 1.8, '#475569')
          if (resting) {
            if (mop > 0.4) sweat(ctx, a.head.x, a.head.y - 8, t)
            // The rake, parked upright.
            line(ctx, -14, 0, -15, -44, 1.8, '#a16207')
            for (let i = 0; i < 5; i++) line(ctx, -19 + i * 2, -44, -19.5 + i * 2, -39, 1, '#94a3b8')
            line(ctx, -19.5, -44, -10.5, -44, 1.6, '#94a3b8')
          } else {
            // Raking stroke, out and back.
            const stroke = Math.sin(t * 5)
            const rx = 15 + stroke * 5
            line(ctx, a.handF.x - 5, a.handF.y - 9, rx, -3, 1.8, '#a16207')
            for (let i = 0; i < 5; i++) line(ctx, rx - 4 + i * 2, -3, rx - 4.5 + i * 2, 0, 1, '#94a3b8')
            line(ctx, rx - 4.5, -3, rx + 4.5, -3, 1.6, '#94a3b8')
          }
        })
      },
    })
  },
}

void shade
export const AUTUMN_ACTS: ActDef[] = [leafBlower, leafJump, squirrel, raker]
