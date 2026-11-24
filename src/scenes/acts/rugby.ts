import { DOG, drawBird, drawDog } from '../creatures'
import { C, alpha, at, clamp, easeBack, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, lerp, line, seg, shade, star, type Ctx } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { drawPerson, type Anchors, type Look, type Pose } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, Rng, Stage } from '../types'

// Rugby, mostly the bits that go wrong. Hooped shirts, scrum caps, a referee
// nobody is listening to, and a dog who has worked out where the ball is kept.

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface Mover {
  x: number
  walk: number
  dir: 1 | -1
}

/** Move `m` toward `target` (px) at `speed` units/s. True once it has arrived. */
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

/** True once `x` is past `mark` when travelling in `dir`. */
const past = (x: number, mark: number, dir: 1 | -1) => (dir === 1 ? x >= mark : x <= mark)

// ─── Kits and players ────────────────────────────────────────────────────────

interface Kit {
  top: string
  hoops: string
}

const KITS: Kit[] = [
  { top: C.crimson, hoops: C.white },
  { top: '#2563eb', hoops: C.yellow },
  { top: C.forest, hoops: C.gold },
  { top: '#f8fafc', hoops: C.red },
  { top: '#f59e0b', hoops: '#1e3a5f' },
]

const SKINS = [C.skinA, C.skinA, C.skinB, C.skinC, C.skinD]
const HAIRS = ['#4a3421', '#2a1a10', '#b8742a', '#d6b25e', C.rust]

function twoKits(rng: Rng): [Kit, Kit] {
  const i = Math.floor(rng() * KITS.length) % KITS.length
  const j = (i + 1 + (Math.floor(rng() * (KITS.length - 1)) % (KITS.length - 1))) % KITS.length
  return [KITS[i], KITS[j]]
}

function player(kit: Kit, rng: Rng, extra: Partial<Look> = {}): Look {
  return {
    skin: pick(rng, SKINS),
    top: kit.top,
    hoops: kit.hoops,
    bottom: kit.top === '#f8fafc' ? '#1e3a5f' : C.white,
    shoe: '#334155',
    shorts: true,
    hair: pick(rng, HAIRS),
    hairStyle: pick(rng, ['short', 'short', 'curly', 'bald'] as const),
    ...extra,
  }
}

const REF: Look = { skin: C.skinA, top: '#f472b6', bottom: '#334155', shoe: '#334155', shorts: true, hair: C.grey, hairStyle: 'short', glasses: true }

const RUN: Pose = { stride: 1, lean: 0.24 }

// ─── Props ───────────────────────────────────────────────────────────────────

/** A proper oval ball, about 12 units long, with its seam and laces. */
function drawRugbyBall(ctx: Ctx, x: number, y: number, rot = 0, k = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(k, k)
  fillEll(ctx, 0, 0, 6, 3.8, '#f8fafc')
  fillEll(ctx, 0, 1.2, 5, 2.2, '#dbe3ee')
  // Coloured tips.
  ctx.save()
  ctx.beginPath()
  ctx.rect(-6.2, -4, 2.4, 8)
  ctx.rect(3.8, -4, 2.4, 8)
  ctx.clip()
  fillEll(ctx, 0, 0, 6, 3.8, C.rose)
  ctx.restore()
  line(ctx, -3.6, -0.2, 3.6, -0.2, 0.6, '#64748b')
  for (let i = -1; i <= 1; i++) line(ctx, i * 1.6, -1.3, i * 1.6, 0.9, 0.6, '#64748b')
  ctx.restore()
}

/** A whistle clamped in a referee's teeth. */
function drawWhistle(ctx: Ctx, a: Anchors) {
  fillRR(ctx, a.mouth.x - 0.5, a.mouth.y - 1.4, 5, 2.6, 1, '#e2e8f0')
  fillCirc(ctx, a.mouth.x + 4.2, a.mouth.y + 0.4, 1.9, '#cbd5e1')
  line(ctx, a.mouth.x + 1, a.mouth.y + 1, a.shoulder.x + 3, a.shoulder.y + 2, 0.6, C.yellow)
}

/** Three little stars circling a head that has just met something solid. */
function dazed(ctx: Ctx, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * Math.PI * 2) / 3
    star(ctx, x + Math.cos(a) * 11, y + Math.sin(a) * 3.2, 2.4, i === 1 ? C.white : C.yellow, a)
  }
}

/** Splashes of mud on a figure who has earned them. */
function mud(ctx: Ctx, a: Anchors) {
  const m = '#7a5a34'
  fillEll(ctx, a.hip.x + 2, a.hip.y - 9, 3.4, 2.2, m, 0.4)
  fillEll(ctx, a.hip.x - 3, a.hip.y - 4, 2.2, 1.6, m, -0.3)
  fillCirc(ctx, a.hip.x + 5, a.hip.y - 13, 1.2, m)
  fillEll(ctx, a.head.x + 4, a.head.y + 6, 2.4, 1.4, m, 0.2)
  fillCirc(ctx, a.head.x - 2, a.head.y - 3, 1.3, m)
  fillEll(ctx, a.footF.x, a.footF.y - 5, 1.8, 2.4, m)
}

// ─── The break ───────────────────────────────────────────────────────────────
// Ball under one arm, three defenders of assorted sizes in pursuit. He stops
// dead and they dive straight past into a heap; or the smallest scrum-half in
// the county takes him round the ankles and the ball goes its own way.

const theBreak: ActDef = {
  id: 'rugby.break',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 50)
    const u = stage.u
    const gag = chance(rng, 0.5) ? 'sidestep' : 'tap'
    const [home, away] = twoKits(rng)
    const hero = player(home, rng, { hat: 'scrumcap', hatColor: C.yellow })
    const run: Mover = { x: from, walk: 0, dir }
    const SIZES = [1.18, 0.98, 0.84]
    const chasers = SIZES.map((scale, i) => ({
      m: { x: from - dir * (52 + i * 30) * u, walk: i * 2, dir } as Mover,
      scale,
      look: player(away, rng, i === 0 ? { beard: '#4a3421' } : i === 2 ? { hat: 'scrumcap' as const, hatColor: C.sky } : {}),
      st: 'run' as 'run' | 'dive' | 'down' | 'up' | 'stop',
      t: 0,
      x0: 0,
    }))
    const half = {
      m: { x: from - dir * 118 * u, walk: 1, dir } as Mover,
      look: player(away, rng, { hat: 'scrumcap', hatColor: C.mint, hairStyle: 'short' }),
      st: 'run' as 'run' | 'down' | 'up' | 'toBall' | 'pick' | 'go',
      t: 0,
    }
    const markX = stage.w / 2 + dir * range(rng, -30, 10) * u
    const pileX = markX + dir * 54 * u
    type Phase = 'run' | 'jink' | 'gloat' | 'away' | 'fall' | 'loose' | 'pursuit'
    let phase: Phase = 'run'
    let pt = 0
    let fallX = 0
    let ball: 'arm' | 'loose' | 'half' = 'arm'
    let bt = 0
    let heroUp = 0 // seconds since the tackled runner started getting up
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    const ballX = () => fallX + dir * (16 + 62 * easeOut(clamp(bt / 1.4))) * u
    return makeAct({
      update(s, dt) {
        pt += dt
        for (const c of chasers) c.t += dt
        half.t += dt
        if (phase === 'run') {
          stepTo(run, to, 135, s, dt)
          for (const c of chasers) stepTo(c.m, to, 135, s, dt)
          if (gag === 'sidestep') {
            if (past(run.x, markX, dir)) go('jink')
          } else {
            stepTo(half.m, to, 205, s, dt)
            if (dir * (run.x - half.m.x) < 15 * u && run.x > 30 * u && run.x < s.w - 30 * u) {
              fallX = run.x
              ball = 'loose'
              bt = 0
              half.st = 'down'
              half.t = 0
              burst(s, 'dust', run.x, s.ground - 3 * u, 6, ['#cbd5e1'], 60, [3, 6])
              go('fall')
            }
          }
        } else if (phase === 'jink' || phase === 'gloat' || phase === 'away') {
          // Sidestep: each defender launches as he reaches the spot, and lands on the last.
          chasers.forEach((c, i) => {
            if (c.st === 'run') {
              stepTo(c.m, to, phase === 'away' && c.x0 !== 0 ? 78 : 135, s, dt)
              if (c.x0 === 0 && past(c.m.x, markX - dir * 30 * u, dir)) {
                c.st = 'dive'
                c.t = 0
                c.x0 = c.m.x
              }
            } else if (c.st === 'dive') {
              const k = clamp(c.t / 0.45)
              c.m.x = lerp(c.x0, pileX - dir * i * 4 * u, k)
              if (k >= 1) {
                c.st = 'down'
                c.t = 0
                burst(s, 'star', c.m.x, s.ground - (10 + i * 8) * u, 4, [C.yellow, C.white], 70, [2, 4])
                burst(s, 'dust', c.m.x, s.ground - 3 * u, 4, ['#cbd5e1'], 60, [3, 6])
              }
            } else if (c.st === 'down') {
              if (phase === 'away' && c.t > 2.4 + (2 - i) * 0.35) {
                c.st = 'up'
                c.t = 0
              }
            } else if (c.st === 'up' && c.t > 0.5) c.st = 'run'
          })
          if (phase === 'jink') {
            if (chasers.every((c) => c.st === 'down')) go('gloat')
          } else if (phase === 'gloat') {
            if (pt > 1) go('away')
          } else {
            stepTo(run, to, 105, s, dt)
            const last = chasers[0]
            return !(past(last.m.x, to, dir) && past(run.x, to, dir))
          }
        } else {
          // Ankle tap.
          bt += dt
          if (phase === 'fall') {
            run.x += dir * 50 * u * dt * (1 - clamp(pt / 0.4))
            half.m.x = run.x - dir * 20 * u
            chasers.forEach((c, i) => {
              if (stepTo(c.m, fallX - dir * (46 + i * 28) * u, 135, s, dt)) c.st = 'stop'
            })
            if (pt > 0.4) go('loose')
          } else if (phase === 'loose') {
            chasers.forEach((c, i) => {
              if (c.st !== 'stop' && stepTo(c.m, fallX - dir * (46 + i * 28) * u, 135, s, dt)) c.st = 'stop'
            })
            if (half.st === 'down' && pt > 0.9) {
              half.st = 'up'
              half.t = 0
            } else if (half.st === 'up' && half.t > 0.35) half.st = 'toBall'
            else if (half.st === 'toBall') {
              if (stepTo(half.m, ballX() - dir * 8 * u, 205, s, dt)) {
                half.m.dir = dir
                half.st = 'pick'
                half.t = 0
              }
            } else if (half.st === 'pick' && half.t > 0.35) {
              ball = 'half'
              half.st = 'go'
              go('pursuit')
            }
          } else {
            stepTo(half.m, to + dir * 60 * u, 195, s, dt)
            if (pt > 0.45) {
              for (const c of chasers) {
                c.st = 'run'
                stepTo(c.m, to + dir * 60 * u, 140, s, dt)
              }
            }
            if (pt > 1) heroUp += dt
            if (heroUp > 1.3) return !stepTo(run, to, 118, s, dt)
          }
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const sidestep = gag === 'sidestep'
        // Defenders, biggest first so the little one is in front.
        chasers.forEach((c, i) => {
          const k = c.st === 'dive' ? clamp(c.t / 0.45) : c.st === 'down' ? 1 : c.st === 'up' ? 1 - clamp(c.t / 0.5) : 0
          const stack = sidestep ? (7 + i * 8) * u : 0
          const hopOver = !sidestep && phase === 'pursuit' ? Math.max(0, 1 - Math.abs(c.m.x - run.x) / (26 * u)) * 14 : 0
          at(
            ctx,
            c.m.x,
            s.ground - k * stack - (c.st === 'dive' ? Math.sin(k * Math.PI) * 16 * u : 0),
            u * c.scale,
            c.m.dir,
            () => {
              if (k < 0.2) groundShadow(ctx, 0, 11)
              if (c.st === 'stop') {
                // Skidding to a halt, staring at the loose ball.
                const a = drawPerson(ctx, c.look, { lean: -0.16, crouch: 0.2, armF: 1.1, armB: -0.8, mouth: 'o', eyes: 'wide' })
                if (phase === 'loose' && i === 0 && pt > 0.3) bubble(ctx, a.head.x * c.m.dir, a.head.y - 19, '?')
              } else if (k > 0) {
                const a = drawPerson(ctx, c.look, { armF: 2.9, armB: 2.6, elbowF: 0.1, walk: c.t * 3, stride: 0.4, mouth: c.st === 'down' ? 'flat' : 'o', eyes: c.st === 'down' ? 'closed' : 'wide' })
                if (c.st === 'down' && i === 2) dazed(ctx, a.head.x, a.head.y - 13, t)
              } else {
                const cheer = !sidestep && phase === 'pursuit'
                const glum = sidestep && phase === 'away'
                const a = drawPerson(ctx, c.look, {
                  ...RUN,
                  walk: c.m.walk,
                  lift: hopOver,
                  lean: glum ? 0.12 : 0.24,
                  stride: glum ? 0.7 : 1,
                  armF: cheer ? 2.8 : phase === 'run' ? 1.6 : undefined,
                  armB: cheer ? -2.6 : undefined,
                  mouth: cheer ? 'grin' : glum ? 'frown' : 'o',
                  blink: blinking(s.time, i),
                })
                if (i === 0 && phase === 'run') sweat(ctx, a.head.x, a.head.y - 8, t)
              }
            },
            c.m.dir * k * 1.45,
          )
        })
        // The scrum-half.
        if (!sidestep) {
          const hk = half.st === 'down' ? 1 : half.st === 'up' ? 1 - clamp(half.t / 0.35) : 0
          at(
            ctx,
            half.m.x,
            s.ground - hk * 6 * u,
            u * 0.64,
            half.m.dir,
            () => {
              if (hk < 0.2) groundShadow(ctx, 0, 11)
              if (hk > 0) {
                drawPerson(ctx, half.look, { armF: 2.9, armB: 2.7, elbowF: 0.1, mouth: 'grin', eyes: 'closed' })
              } else if (half.st === 'pick') {
                const d = Math.sin(clamp(half.t / 0.35) * Math.PI)
                drawPerson(ctx, half.look, { crouch: d * 0.8, lean: d * 0.5, armF: 1, armB: 0.8, mouth: 'grin' })
              } else {
                const a = drawPerson(ctx, half.look, { ...RUN, walk: half.m.walk * 1.4, lean: 0.34, armF: ball === 'half' ? 0.5 : undefined, elbowF: ball === 'half' ? 1.6 : undefined, mouth: ball === 'half' ? 'grin' : 'flat' })
                if (ball === 'half') drawRugbyBall(ctx, a.hip.x + 6, a.hip.y - 9, -0.5, 1.5)
                if (half.st === 'run') speedLines(ctx, a.hip.x - 12, a.hip.y - 8, 12, t)
              }
            },
            half.m.dir * hk * 1.45,
          )
        }
        // The runner.
        const down = sidestep ? 0 : phase === 'fall' ? easeIn(clamp(pt / 0.35)) : phase === 'loose' ? 1 : phase === 'pursuit' ? 1 - easeInOut(seg(heroUp, 0, 0.6)) : 0
        const jinking = phase === 'jink' && pt < 0.5
        const hop = jinking ? Math.sin((pt / 0.5) * Math.PI) * 9 : sidestep && phase === 'away' ? Math.max(0, 1 - Math.abs(run.x - pileX) / (34 * u)) * 30 : 0
        at(
          ctx,
          run.x,
          s.ground - down * 6 * u,
          u,
          dir,
          () => {
            if (down < 0.2) groundShadow(ctx, 0, 11 - hop * 0.1)
            let a: Anchors
            if (down > 0) {
              a = drawPerson(ctx, hero, { armF: 2.8, armB: 2.5, mouth: down > 0.9 ? 'flat' : 'o', eyes: down > 0.9 ? 'closed' : 'wide' })
              if (phase === 'loose' || (phase === 'pursuit' && heroUp < 0.2)) dazed(ctx, a.head.x, a.head.y - 13, t)
            } else if (phase === 'jink' || phase === 'gloat') {
              // Standing quite still while the opposition goes by at head height.
              const smug = phase === 'gloat'
              a = drawPerson(ctx, hero, { lift: hop, lean: jinking ? -0.2 : 0, armF: 0.5, elbowF: 1.6, armB: smug ? -2.4 + Math.sin(pt * 12) * 0.3 : -0.6, mouth: smug ? 'grin' : 'o', eyes: smug ? 'closed' : 'wide' })
            } else {
              const beaten = phase === 'pursuit'
              a = drawPerson(ctx, hero, {
                ...RUN,
                walk: run.walk,
                lift: hop,
                armF: beaten ? undefined : 0.5,
                elbowF: beaten ? undefined : 1.6,
                mouth: beaten ? 'frown' : phase === 'away' ? 'grin' : 'puff',
                blink: blinking(s.time, 7),
              })
              if (phase === 'run') speedLines(ctx, a.hip.x - 12, a.hip.y - 8, 14, t)
            }
            if (ball === 'arm') drawRugbyBall(ctx, a.hip.x + 6, a.hip.y - 9, -0.5)
          },
          dir * down * 1.45,
        )
        if (ball === 'loose') {
          const by = Math.abs(Math.sin(bt * 5.4)) * 28 * u * (1 - clamp(bt / 1.4))
          at(ctx, ballX(), s.ground - by - 4 * u, u, dir, () => drawRugbyBall(ctx, 0, 0, bt < 1.4 ? bt * 11 : 0.2))
        }
      },
    })
  },
}

// ─── The conversion ──────────────────────────────────────────────────────────

/** H posts, pads and all, 150 units tall. `rise` 0..1 brings them up through the floor. */
function drawPosts(ctx: Ctx, rise: number, wob: number, kit: Kit) {
  if (rise <= 0) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(-44, -180, 88, 180.6)
  ctx.clip()
  ctx.translate(0, (1 - rise) * 162)
  for (const sx of [-17, 17]) {
    ctx.save()
    ctx.translate(sx, 0)
    ctx.rotate(wob * (sx < 0 ? 1 : 0.55))
    line(ctx, 0, 14, 0, -150, 1.7, '#f8fafc')
    fillPoly(ctx, [0, -150, 6.5, -147.4, 0, -144.8], kit.top === '#f8fafc' ? kit.hoops : kit.top)
    fillRR(ctx, -3.8, -18, 7.6, 18, 2.4, kit.top)
    fillRR(ctx, -3.8, -12.5, 7.6, 3.2, 0.5, kit.hoops)
    fillRR(ctx, -3.8, -6, 7.6, 3.2, 0.5, kit.hoops)
    ctx.restore()
  }
  line(ctx, -17, -52, 17, -52, 1.7, '#f8fafc')
  ctx.restore()
}

// The kicker's routine takes longer than the match. Then either it sails over
// and two tiny flags go up from behind the pads, or it hits the upright with a
// boing and comes all the way back.

const conversion: ActDef = {
  id: 'rugby.conversion',
  weight: 3,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 50)
    const u = stage.u
    const gag = chance(rng, 0.5) ? 'over' : 'post'
    const [home, away] = twoKits(rng)
    const kicker = player(home, rng, { hairStyle: 'short' })
    const gap = Math.min(stage.w * 0.66, 480 * u)
    const teeX = stage.w / 2 - (dir * gap) / 2
    const postX = stage.w / 2 + (dir * gap) / 2
    const ballX = teeX + dir * 14 * u
    const farX = postX + dir * 90 * u // where a good kick would come down
    const pPost = gap / (gap + 90 * u) // flight fraction at which it passes the posts
    const m: Mover = { x: from, walk: 0, dir }
    type Phase = 'in' | 'place' | 'back' | 'routine' | 'run' | 'kick' | 'watch' | 'react' | 'fetch' | 'pick' | 'out'
    let phase: Phase = 'in'
    let pt = 0
    let ball: 'arm' | 'tee' | 'air' | 'back' | 'ground' | 'gone' = 'arm'
    let tee = false
    let bt = 0
    let bx = ballX
    let by = 7 * u
    let rt = -1 // seconds since the result; -1 before it
    let outT = 0
    let wob = 0
    const hitX = postX - dir * 17 * u
    const hitY = 96 * u
    const restX = teeX + dir * 62 * u
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        if (rt >= 0) rt += dt
        wob = Math.max(0, wob - dt * 0.9)
        if (phase === 'in') {
          if (stepTo(m, teeX, 78, s, dt)) {
            m.dir = dir
            go('place')
          }
        } else if (phase === 'place') {
          if (crossed(pt, dt, 0.5)) {
            tee = true
            ball = 'tee'
          }
          if (pt > 1.1) go('back')
        } else if (phase === 'back') {
          // Three precise paces backwards.
          m.x -= dir * 30 * u * dt
          m.walk -= dt * 6
          if (pt > 1.1) go('routine')
        } else if (phase === 'routine') {
          if (pt > 3.6) go('run')
        } else if (phase === 'run') {
          if (stepTo(m, teeX - dir * 2 * u, 125, s, dt)) go('kick')
        } else if (phase === 'kick') {
          if (crossed(pt, dt, 0.14)) {
            ball = 'air'
            bt = 0
            burst(s, 'dust', ballX, s.ground - 3 * u, 4, ['#cbd5e1'], 50, [3, 5])
          }
          if (pt > 0.3) go('watch')
        } else if (phase === 'react') {
          if (pt > (gag === 'over' ? 2 : 2.2)) go(gag === 'over' ? 'pick' : 'fetch')
        } else if (phase === 'fetch') {
          if (stepTo(m, restX - dir * 9 * u, 46, s, dt)) {
            m.dir = dir
            go('pick')
          }
        } else if (phase === 'pick') {
          if (crossed(pt, dt, 0.4)) {
            if (gag === 'over') tee = false
            else ball = 'arm'
          }
          if (pt > 0.8) go('out')
        } else if (phase === 'out') {
          outT += dt
          if (crossed(outT, dt, 0.05)) tee = false
          const gone = stepTo(m, edge(m.x, s), gag === 'over' ? 84 : 52, s, dt)
          return !(gone && outT > 0.9)
        }
        if (ball === 'air') {
          bt += dt
          if (gag === 'over') {
            const p = bt / 2.3
            bx = lerp(ballX, farX, p)
            by = 7 * u + 4 * 130 * u * p * (1 - p)
            if (crossed(p, dt / 2.3, pPost)) {
              rt = 0
              burst(s, 'star', postX, s.ground - 70 * u, 8, [C.yellow, C.gold, C.white], 90, [3, 5])
              go('react')
            }
            if (p > pPost + 0.1) ball = 'gone'
          } else {
            const p = bt / 1.5
            bx = lerp(ballX, hitX, p)
            by = lerp(7 * u, hitY, p) + 4 * 38 * u * p * (1 - p)
            if (p >= 1) {
              ball = 'back'
              bt = 0
              rt = 0
              wob = 1
              burst(s, 'star', hitX, s.ground - hitY, 7, [C.yellow, C.white], 90, [3, 5])
              go('react')
            }
          }
        } else if (ball === 'back') {
          // Off the upright and all the way home, in three bounces.
          bt += dt
          const p = clamp(bt / 2)
          bx = lerp(hitX, restX, easeOut(p) * 0.4 + p * 0.6)
          if (bt < 0.9) by = hitY * (1 - (bt / 0.9) * (bt / 0.9))
          else if (bt < 1.5) by = 4 * 26 * u * seg(bt, 0.9, 1.5) * (1 - seg(bt, 0.9, 1.5))
          else if (bt < 2) by = 4 * 9 * u * seg(bt, 1.5, 2) * (1 - seg(bt, 1.5, 2))
          else {
            by = 0
            ball = 'ground'
          }
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const rise = easeBack(seg(t, 0.2, 1)) * (1 - easeIn(seg(outT, 0.1, 0.8)))
        const flying = () => at(ctx, bx, s.ground - by - 4 * u, u, dir, () => drawRugbyBall(ctx, 0, 0, bt * 13))
        // A ball that has cleared the bar is behind the posts.
        if (ball === 'air' && gag === 'over' && rt >= 0) {
          ctx.globalAlpha = 1 - seg(bt / 2.3, pPost, pPost + 0.1)
          flying()
          ctx.globalAlpha = 1
        }
        // Touch judges, who have been behind the pads the whole time.
        const peek = rt < 0 ? 0 : easeOut(seg(rt, 0.15, 0.55)) * (1 - seg(outT, 0, 0.3))
        if (peek > 0.05) {
          for (const side of [-1, 1]) {
            at(ctx, postX + (side * 17 + side * peek * 9) * u, s.ground, u * 0.52, (-dir) as 1 | -1, () => {
              const up = gag === 'over' ? easeBack(seg(rt, 0.5, 0.9)) : 0
              const a = drawPerson(ctx, { ...REF, top: C.yellow, glasses: side === 1, hat: side === 1 ? 'flatcap' : 'none', hatColor: '#7a6a52' }, {
                armF: gag === 'over' ? 0.4 + up * 2.6 : 0.6 + Math.sin(rt * 9) * 0.5,
                armB: gag === 'over' ? 0.2 : 0.6 - Math.sin(rt * 9) * 0.5,
                elbowF: 0.1,
                mouth: gag === 'over' ? 'smile' : 'o',
                eyes: gag === 'over' ? 'normal' : 'wide',
              })
              const fx = a.handF.x + Math.sin(0.4 + up * 2.6) * 13
              const fy = a.handF.y + Math.cos(0.4 + up * 2.6) * 13
              if (gag === 'over') {
                line(ctx, a.handF.x, a.handF.y, fx, fy, 1.4, '#f1f5f9')
                fillPoly(ctx, [fx, fy, fx + 10, fy + 2 + Math.sin(t * 9) * 1.5, fx + 1, fy + 8], side === 1 ? C.yellow : C.orange)
              }
            })
          }
        }
        at(ctx, postX, s.ground, u, dir, () => drawPosts(ctx, rise, Math.sin(t * 30) * wob * 0.05, away))
        if (gag === 'post' && rt >= 0 && rt < 1) at(ctx, hitX - dir * 22 * u, s.ground - hitY - 14 * u, u, 1, () => bubble(ctx, 0, 0, 'boing', { color: C.crimson, size: 10 }))
        // The kicking tee: a little orange crown.
        if (tee) {
          at(ctx, ballX, s.ground, u, dir, () => {
            fillPoly(ctx, [-4, 0, -3, -4.6, -1.2, -2, 0, -4.6, 1.2, -2, 3, -4.6, 4, 0], C.orange)
            fillRR(ctx, -4.4, -1.2, 8.8, 1.8, 0.8, shade(C.orange, -0.2))
          })
        }
        if (ball === 'tee') at(ctx, ballX, s.ground - 8.6 * u, u, dir, () => drawRugbyBall(ctx, 0, 0, -1.25))
        at(ctx, m.x, s.ground, u, m.dir, () => {
          groundShadow(ctx, 0, 11)
          const blink = blinking(s.time, 3)
          let a: Anchors
          if (phase === 'in') {
            a = drawPerson(ctx, kicker, { walk: m.walk, stride: 0.85, armF: 0.5, elbowF: 1.6, mouth: 'flat', blink })
          } else if (phase === 'place') {
            const d = Math.sin(seg(pt, 0, 1.1) * Math.PI)
            a = drawPerson(ctx, kicker, { crouch: d * 0.85, lean: d * 0.5, armF: 0.6 + d * 0.5, armB: 0.5 + d * 0.4, elbowF: 0.1, headTilt: 0.2, mouth: 'flat', blink })
            if (ball === 'arm') drawRugbyBall(ctx, a.handF.x + 2, a.handF.y, -1.25)
          } else if (phase === 'back') {
            a = drawPerson(ctx, kicker, { walk: m.walk, stride: 0.5, armF: 0.2, armB: 0.1, headTilt: 0.2, mouth: 'flat' })
          } else if (phase === 'routine') {
            // Hands clasped, knees bent, eyes flicking from ball to posts and
            // back, with a wiggle and a tug of the shorts for luck.
            const look = Math.floor(pt * 1.9) % 2 === 0
            const tug = seg(pt, 2.5, 2.7) * (1 - seg(pt, 3, 3.2))
            a = drawPerson(ctx, kicker, {
              crouch: 0.42 + Math.sin(pt * 2.6) * 0.06,
              lean: 0.3 + Math.sin(pt * 11) * 0.03,
              armF: lerp(1.05, 0.1, tug),
              elbowF: lerp(1.25, 0.2, tug),
              armB: 0.95,
              elbowB: 1.35,
              headTilt: look ? 0.28 : -0.28,
              mouth: pt > 3.1 ? 'puff' : 'flat',
              eyes: look ? 'normal' : 'wide',
            })
            if (pt > 0.6 && Math.floor(pt * 1.9) % 2 === 1) sweat(ctx, a.head.x, a.head.y - 8, t)
          } else if (phase === 'run') {
            a = drawPerson(ctx, kicker, { ...RUN, walk: m.walk, mouth: 'puff' })
          } else if (phase === 'kick' || (phase === 'watch' && pt < 0.4)) {
            const k = phase === 'kick' ? easeOut(clamp(pt / 0.2)) : 1
            a = drawPerson(ctx, kicker, { walk: lerp(-1.3, 1.57, k), stride: 1.5, lean: lerp(0.15, -0.28, k), armF: -1.2, armB: 1.6, mouth: 'puff', eyes: 'closed' })
          } else if (phase === 'watch') {
            a = drawPerson(ctx, kicker, { armF: 2.25, elbowF: 1.5, lean: -0.08, headTilt: -0.25, mouth: 'o', blink })
          } else if (phase === 'react' && gag === 'over') {
            const k = Math.sin(pt * 9)
            a = drawPerson(ctx, kicker, { lift: Math.abs(k) * 6, armF: 2.8, armB: -2.7, headTilt: -0.15, mouth: 'grin', eyes: 'closed' })
          } else if (phase === 'react') {
            // Watches it come all the way back, then cannot watch at all.
            const hide = easeInOut(seg(pt, 0.5, 0.9))
            a = drawPerson(ctx, kicker, { armF: lerp(0.3, 2.5, hide), elbowF: lerp(0.3, 1.5, hide), armB: lerp(0.2, 2.3, hide), elbowB: lerp(0.3, 1.5, hide), lean: hide * 0.2, headTilt: hide * 0.3, mouth: 'frown', eyes: hide > 0.5 ? 'closed' : 'wide' })
          } else if (phase === 'pick') {
            const d = Math.sin(seg(pt, 0, 0.8) * Math.PI)
            a = drawPerson(ctx, kicker, { crouch: d * 0.85, lean: d * 0.5, armF: 0.6 + d * 0.5, elbowF: ball === 'arm' ? 1.2 : 0.1, mouth: gag === 'over' ? 'grin' : 'frown' })
            if (ball === 'arm') drawRugbyBall(ctx, a.handF.x + 1, a.handF.y, -0.5)
            else if (gag === 'over' && !tee) fillPoly(ctx, [a.handF.x - 3, a.handF.y + 2, a.handF.x, a.handF.y - 3, a.handF.x + 3, a.handF.y + 2], C.orange)
          } else {
            const happy = gag === 'over'
            a = drawPerson(ctx, kicker, {
              walk: m.walk,
              stride: happy ? 0.9 : 0.55,
              lean: happy ? 0.1 : 0.2,
              armF: happy ? 2.8 : 0.5,
              elbowF: happy ? 0.2 : 1.6,
              headTilt: happy ? 0 : 0.25,
              mouth: happy ? 'grin' : 'frown',
              blink,
            })
            if (!happy && ball === 'arm') drawRugbyBall(ctx, a.hip.x + 6, a.hip.y - 9, -0.5)
            if (happy) fillPoly(ctx, [a.handF.x - 3, a.handF.y, a.handF.x, a.handF.y - 5, a.handF.x + 3, a.handF.y], C.orange)
          }
          if (ball === 'arm' && phase === 'in') drawRugbyBall(ctx, a.hip.x + 6, a.hip.y - 9, -0.5)
        })
        if ((ball === 'air' && !(gag === 'over' && rt >= 0)) || ball === 'back') flying()
        if (ball === 'ground') at(ctx, restX, s.ground - 4 * u, u, dir, () => drawRugbyBall(ctx, 0, 0, 0.15))
      },
    })
  },
}

// ─── The scrum ───────────────────────────────────────────────────────────────

/** A lone boot, studs and all. */
function drawBoot(ctx: Ctx, x: number, y: number, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  fillRR(ctx, -4, -9, 5.6, 9, 2, '#a16207')
  fillRR(ctx, -4, -4.6, 11, 4.6, 2.2, '#a16207')
  fillRR(ctx, -4, -0.9, 11, 1.4, 0.6, '#5b3a12')
  for (let i = 0; i < 3; i++) fillRR(ctx, -3 + i * 3.6, 0.3, 1.5, 1.6, 0.4, '#e2e8f0')
  line(ctx, 0.5, -6.4, 2.6, -4.6, 0.6, C.white)
  line(ctx, 0.5, -4.8, 2.6, -6.2, 0.6, C.white)
  fillRR(ctx, -4.4, -10.4, 6.4, 2.4, 1, C.white)
  ctx.restore()
}

// Six of them locked together, steaming gently, going sideways like a crab.
// Something squirts out of the back: the ball, which nobody but the referee
// notices, or a single boot, which he wishes he had not.

const scrum: ActDef = {
  id: 'rugby.scrum',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 90)
    const u = stage.u
    const gag = chance(rng, 0.5) ? 'ball' : 'boot'
    const [home, away] = twoKits(rng)
    const packA = [0, 1, 2].map((i) => player(home, rng, i === 1 ? { hat: 'scrumcap', hatColor: C.sky } : {}))
    const packB = [0, 1, 2].map((i) => player(away, rng, i === 0 ? { hat: 'scrumcap', hatColor: C.yellow } : i === 2 ? { beard: '#2a1a10' } : {}))
    const speed = clamp(stage.w / (15 * u), 32, 74)
    const TRAIL = 80 // how far behind the middle of the scrum the referee trots
    const popAt = stage.w / 2 + dir * 10 * u
    let x = from
    let shuffle = 0
    const ref: Mover = { x: from - dir * TRAIL * u, walk: 0, dir }
    type Phase = 'trot' | 'spot' | 'pick' | 'ponder' | 'whistle' | 'catchup'
    let phase: Phase = 'trot'
    let pt = 0
    let item: 'in' | 'loose' | 'ref' = 'in'
    let it = 0
    let itemFrom = 0
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    const itemX = () => itemFrom - dir * 34 * u * easeOut(clamp(it / 0.7))
    return makeAct({
      update(s, dt, t) {
        pt += dt
        it += dt
        // The scrum never stops for anything.
        const surge = 0.55 + 0.9 * Math.max(0, Math.sin(t * 2.4))
        x += dir * speed * u * surge * dt
        shuffle += dt * 7 * surge
        if (Math.floor(t * 4) !== Math.floor((t - dt) * 4) && x > 0 && x < s.w) {
          s.particles.emit({ kind: 'dust', x: x + range(rng, -16, 16) * u, y: s.ground - 36 * u, vx: range(rng, -8, 8) * u, vy: -range(rng, 16, 30) * u, g: -14, drag: 0.6, size: range(rng, 4, 8) * u, color: alpha(C.white, 0.5), life: 1.3 })
        }
        if (item === 'in' && past(x, popAt, dir)) {
          item = 'loose'
          it = 0
          itemFrom = x - dir * 44 * u
          burst(s, 'dust', itemFrom, s.ground - 4 * u, 4, ['#cbd5e1'], 50, [3, 5])
        }
        if (phase === 'trot') {
          stepTo(ref, x - dir * TRAIL * u, speed * 1.5, s, dt)
          if (item === 'loose' && it > 0.5) go('spot')
        } else if (phase === 'spot') {
          if (pt > 0.3 && stepTo(ref, itemX() - dir * 10 * u, 60, s, dt)) {
            ref.dir = dir
            go('pick')
          }
        } else if (phase === 'pick') {
          if (crossed(pt, dt, 0.4)) item = 'ref'
          if (pt > 0.8) go('ponder')
        } else if (phase === 'ponder') {
          if (pt > 1.8) go('whistle')
        } else if (phase === 'whistle') {
          if (crossed(pt, dt, 0.15) || crossed(pt, dt, 0.5)) {
            s.particles.emit({ kind: 'note', x: ref.x + dir * 14 * u, y: s.ground - 52 * u, vx: dir * 16 * u, size: 7 * u, color: C.yellow })
          }
          if (pt > 1) go('catchup')
        } else {
          return !stepTo(ref, to, 112, s, dt)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        at(ctx, x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 40, 0.3)
          ctx.rotate(Math.sin(t * 2.4) * 0.025)
          const forward = (look: Look, ox: number, oy: number, i: number, flip: boolean) => {
            ctx.save()
            ctx.translate(ox, oy)
            if (flip) ctx.scale(-1, 1)
            drawPerson(ctx, look, {
              lean: 1.2 + Math.sin(t * 3 + i) * 0.04,
              crouch: 0.5,
              walk: (flip ? -shuffle : shuffle) + i * 2.1,
              stride: 0.45,
              armF: 1.9,
              armB: 1.7,
              elbowF: 0.2,
              headTilt: -0.5,
              mouth: 'puff',
              eyes: i % 2 === 0 ? 'closed' : 'normal',
            })
            ctx.restore()
          }
          // Back row first, then the front, so the packs overlap properly.
          forward(packA[0], -36, -1.5, 0, false)
          forward(packB[0], 36, -1.5, 3, true)
          forward(packA[1], -28, 0, 1, false)
          forward(packB[1], 28, 0, 4, true)
          forward(packA[2], -19, 1, 2, false)
          forward(packB[2], 19, 1, 5, true)
        })
        // What came out.
        if (item === 'loose') {
          const hop = Math.abs(Math.sin(clamp(it / 0.7) * Math.PI * 2)) * 8 * (1 - clamp(it / 0.7))
          at(ctx, itemX(), s.ground - hop * u, u, dir, () => {
            if (gag === 'ball') drawRugbyBall(ctx, 0, -4, it < 0.7 ? -it * 12 : 0.15)
            else drawBoot(ctx, 0, 0, it < 0.7 ? -it * 12 : 0)
          })
        }
        at(ctx, ref.x, s.ground, u, ref.dir, () => {
          groundShadow(ctx, 0, 11)
          const blink = blinking(s.time, 5)
          const holding = item === 'ref'
          let a: Anchors
          if (phase === 'trot' || phase === 'catchup' || (phase === 'spot' && pt > 0.3)) {
            const stink = holding && gag === 'boot'
            a = drawPerson(ctx, REF, {
              walk: ref.walk,
              stride: phase === 'catchup' ? 1 : 0.75,
              lean: phase === 'catchup' ? 0.2 : 0.26,
              armF: stink ? 1.55 : holding ? 0.5 : 1.3,
              elbowF: stink ? 0.05 : holding ? 1.6 : 0.3,
              armB: stink ? 2.3 : undefined,
              elbowB: stink ? 1.5 : undefined,
              mouth: stink ? 'frown' : 'flat',
              blink,
            })
          } else if (phase === 'spot') {
            a = drawPerson(ctx, REF, { lean: -0.1, armF: 0.6, mouth: 'o', eyes: 'wide' })
            bubble(ctx, a.head.x * ref.dir, a.head.y - 19, '!', { color: C.crimson })
          } else if (phase === 'pick') {
            const d = Math.sin(seg(pt, 0, 0.8) * Math.PI)
            a = drawPerson(ctx, REF, { crouch: d * 0.85, lean: d * 0.5, armF: 0.7 + d * 0.5, elbowF: 0.1, mouth: 'flat', blink })
          } else if (phase === 'ponder') {
            // Looks at it. Looks at them. Offers it. Nobody is interested.
            const offer = easeInOut(seg(pt, 0.6, 1)) * (1 - seg(pt, 1.5, 1.8))
            a = drawPerson(ctx, REF, {
              armF: gag === 'boot' ? 1.55 : 1.2 + offer * 0.5,
              elbowF: gag === 'boot' ? 0.05 : 0.6 - offer * 0.5,
              armB: gag === 'boot' ? 2.3 : 0.4 + offer * 0.9,
              elbowB: gag === 'boot' ? 1.5 : 0.3,
              lean: gag === 'boot' ? -0.15 : 0,
              headTilt: pt < 0.6 ? 0.25 : -0.05,
              mouth: gag === 'boot' ? 'frown' : pt < 0.6 ? 'flat' : 'o',
              eyes: gag === 'boot' ? 'closed' : 'normal',
            })
            if (gag === 'ball' && pt > 0.9 && pt < 1.6) bubble(ctx, (a.head.x + 4) * ref.dir, a.head.y - 19, '?')
          } else {
            a = drawPerson(ctx, REF, { armF: gag === 'boot' ? 1.55 : 0.5, elbowF: gag === 'boot' ? 0.05 : 1.6, armB: -2.9, lean: -0.08, mouth: 'puff', eyes: 'closed' })
          }
          drawWhistle(ctx, a)
          if (holding) {
            if (gag === 'ball') {
              if (phase === 'ponder') drawRugbyBall(ctx, a.handF.x + 3, a.handF.y - 2, -0.3)
              else drawRugbyBall(ctx, a.hip.x + 6, a.hip.y - 9, -0.5)
            } else {
              // Held by the laces, as far away as an arm allows.
              drawBoot(ctx, a.handF.x + 1, a.handF.y + 11, 0.2 + Math.sin(t * 6) * 0.15)
              line(ctx, a.handF.x, a.handF.y, a.handF.x + 1, a.handF.y + 2, 0.6, C.white)
              for (let i = 0; i < 3; i++) {
                const p = (t * 0.8 + i / 3) % 1
                ctx.globalAlpha = (1 - p) * 0.7
                const wx = a.handF.x + 4 + i * 3 + Math.sin(p * 9 + i) * 1.5
                line(ctx, wx, a.handF.y + 2 - p * 12, wx + Math.sin(p * 9 + i + 1) * 1.5, a.handF.y - 1 - p * 12, 0.9, '#a3e635')
              }
              ctx.globalAlpha = 1
            }
          }
        })
      },
    })
  },
}

// ─── The line-out ────────────────────────────────────────────────────────────
// Two lift a third. The throw is caught cleanly; or it bonks him on the head;
// or it sails clean over and they stand there holding him up, waiting, until a
// bird decides he is a perch.

const lineOut: ActDef = {
  id: 'rugby.line-out',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const u = stage.u
    const gag = pick(rng, ['catch', 'over', 'bonk'] as const)
    const kit = pick(rng, KITS)
    const jumper = player(kit, rng, { hat: 'scrumcap', hatColor: C.yellow })
    const props = [player(kit, rng, { beard: '#4a3421', hairStyle: 'bald' }), player(kit, rng, { hairStyle: 'curly' })]
    const spot = stage.w / 2 + dir * range(rng, -20, 20) * u
    const SP = 17 // lifters stand this far either side
    const LIFT = 38
    const m: Mover = { x: from, walk: 0, dir }
    // The throw comes in from the side they are walking toward.
    const throwX = spot + dir * Math.min(stage.w / 2 + 30 * u, 270 * u)
    const handY = (LIFT + 68) * u
    type Phase = 'in' | 'set' | 'lift' | 'hold' | 'wait' | 'lower' | 'out'
    let phase: Phase = 'in'
    let pt = 0
    let ball: 'none' | 'air' | 'held' | 'away' | 'gone' = 'none'
    let bt = 0
    let bx = throwX
    let by = 60 * u
    let stunned = false
    const bird = { x: throwX, y: 130 * u, on: false, t: 0 }
    const go = (p: Phase) => {
      phase = p
      pt = 0
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        bt += dt
        if (phase === 'in') {
          if (stepTo(m, spot, 70, s, dt)) {
            m.dir = dir
            go('set')
          }
        } else if (phase === 'set') {
          if (pt > 0.7) go('lift')
        } else if (phase === 'lift') {
          if (crossed(pt, dt, 0.1)) {
            ball = 'air'
            bt = 0
          }
          if (pt > 0.5) go('hold')
        } else if (phase === 'hold') {
          if (ball !== 'air' && pt > (gag === 'catch' ? 1.9 : 2.2)) go(gag === 'over' ? 'wait' : 'lower')
        } else if (phase === 'wait') {
          // The bird arrives, settles, and is still there when their arms give out.
          bird.t += dt
          if (pt > 1 && !bird.on) {
            const tx = spot + dir * 2 * u
            const ty = (LIFT + 76) * u
            const k = clamp((pt - 1) / 1.4)
            bird.x = lerp(throwX, tx, easeOut(k))
            bird.y = lerp(130 * u, ty, easeInOut(k))
            if (k >= 1) bird.on = true
          }
          if (pt > 4.6) {
            bird.on = false
            burst(s, 'dust', spot, s.ground - 3 * u, 6, ['#cbd5e1'], 60, [3, 6])
            go('lower')
          }
        } else if (phase === 'lower') {
          if (pt > 0.6) go('out')
        } else {
          if (gag === 'over') {
            bird.x -= dir * 110 * u * dt
            bird.y += 46 * u * dt
          }
          return !stepTo(m, to, gag === 'catch' ? 84 : 58, s, dt)
        }
        if (phase === 'lower' && gag === 'over') {
          bird.x -= dir * 110 * u * dt
          bird.y += 46 * u * dt
        }
        if (ball === 'air') {
          const T = 1.3
          const p = bt / T
          const topY = gag === 'over' ? handY + 34 * u : gag === 'bonk' ? handY - 12 * u : handY
          bx = lerp(throwX, spot + dir * 3 * u, p)
          by = lerp(60 * u, topY, p) + 4 * 34 * u * p * (1 - p)
          if (p >= 1) {
            bt = 0
            if (gag === 'catch') ball = 'held'
            else {
              ball = 'away'
              if (gag === 'bonk') {
                stunned = true
                burst(s, 'star', bx, s.ground - by, 7, [C.yellow, C.white], 90, [3, 5])
              }
            }
          }
        } else if (ball === 'away') {
          // Over the top and gone, or straight back up off his head.
          if (gag === 'over') {
            bx -= dir * 205 * u * dt
            by += (10 - bt * 150) * u * dt
          } else {
            bx += dir * 70 * u * dt
            by += (120 - bt * 260) * u * dt
          }
          if (bt > 1.1) ball = 'gone'
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const up = phase === 'lift' ? easeOut(clamp(pt / 0.5)) : phase === 'hold' || phase === 'wait' ? 1 : phase === 'lower' ? 1 - (gag === 'over' ? easeIn(clamp(pt / 0.25)) : easeInOut(clamp(pt / 0.6))) : 0
        const set = phase === 'set' ? easeInOut(clamp(pt / 0.5)) : phase === 'in' || phase === 'out' ? 0 : 1
        const moving = phase === 'in' || phase === 'out'
        const tired = phase === 'wait' ? clamp(pt / 4.6) : 0
        const tremble = tired * Math.sin(t * 26) * 0.05
        const lifter = (i: number) => {
          const side = i === 0 ? -1 : 1
          // The front one turns to face him for the lift.
          const facing = moving || i === 0 ? m.dir : ((-m.dir) as 1 | -1)
          at(ctx, m.x + m.dir * side * SP * u, s.ground, u, facing, () => {
            groundShadow(ctx, 0, 11)
            const a = drawPerson(ctx, props[i], {
              walk: m.walk + i * 2,
              stride: moving ? 0.8 : 0,
              crouch: set * (0.5 - up * 0.42) + tired * 0.3 + tremble,
              lean: set * (0.2 - up * 0.2),
              armF: moving ? undefined : 1 + up * 1.75,
              armB: moving ? undefined : 0.9 + up * 1.7,
              elbowF: 0.2,
              elbowB: 0.2,
              headTilt: -up * 0.3,
              mouth: up > 0.5 ? 'puff' : phase === 'out' && gag !== 'catch' ? 'frown' : 'flat',
              eyes: tired > 0.5 ? 'closed' : 'normal',
              blink: blinking(s.time, i + 1),
            })
            if (up > 0.5 && (i === 0 || tired > 0.3)) sweat(ctx, a.head.x, a.head.y - 8, t + i * 0.4)
          })
        }
        lifter(0)
        // The jumper.
        at(ctx, m.x, s.ground, u, m.dir, () => {
          if (up < 0.3) groundShadow(ctx, 0, 11)
          const arrived = ball === 'held' || ball === 'away' || ball === 'gone'
          const reach = gag === 'bonk' && !arrived ? up * 0.35 : up
          let a: Anchors
          if (moving) {
            const woozy = phase === 'out' && stunned
            a = drawPerson(ctx, jumper, {
              walk: m.walk + 1,
              stride: woozy ? 0.5 : 0.8,
              lean: woozy ? Math.sin(t * 4) * 0.15 : 0.04,
              armF: phase === 'out' && gag === 'catch' ? 0.5 : undefined,
              elbowF: phase === 'out' && gag === 'catch' ? 1.6 : undefined,
              mouth: phase === 'out' ? (gag === 'catch' ? 'grin' : 'frown') : 'flat',
              eyes: woozy ? 'closed' : 'normal',
              blink: blinking(s.time, 4),
            })
            if (woozy) dazed(ctx, a.head.x, a.head.y - 14, t)
            if (phase === 'out' && gag === 'catch') drawRugbyBall(ctx, a.hip.x + 6, a.hip.y - 9, -0.5)
          } else if (phase === 'wait') {
            // Arms slowly come down. A look at the wrist. Still nothing.
            const watch = seg(pt, 1.6, 2) * (1 - seg(pt, 3, 3.4))
            a = drawPerson(ctx, jumper, {
              lift: LIFT + tremble * 20,
              armF: lerp(lerp(2.9, 0.4, seg(pt, 0.4, 1.2)), 1.3, watch),
              elbowF: lerp(0.2, 1.3, watch),
              armB: lerp(2.7, 0.2, seg(pt, 0.4, 1.2)),
              headTilt: watch > 0.5 ? 0.3 : -0.2 + Math.sin(pt * 2) * 0.15,
              mouth: 'flat',
              eyes: bird.on ? 'wide' : 'normal',
            })
            if (pt > 2.2 && pt < 4) bubble(ctx, (a.head.x + 16) * m.dir, a.head.y - 6, '...', { size: 10 })
          } else {
            const hit = stunned && arrived
            a = drawPerson(ctx, jumper, {
              lift: up * LIFT,
              crouch: set * (1 - up) * 0.4,
              armF: 0.3 + reach * 2.6,
              armB: 0.2 + reach * 2.5,
              elbowF: 0.2,
              headTilt: hit ? 0.2 : -up * 0.25,
              mouth: hit ? 'o' : ball === 'held' ? 'grin' : up > 0.5 ? 'o' : 'flat',
              eyes: hit ? 'closed' : 'normal',
            })
            if (hit) dazed(ctx, a.head.x, a.head.y - 14, t)
            if (ball === 'held') drawRugbyBall(ctx, (a.handF.x + a.handB.x) / 2 + 1, a.handF.y - 3, -0.2)
          }
        })
        lifter(1)
        if (ball === 'air' || ball === 'away') {
          ctx.globalAlpha = ball === 'away' ? 1 - seg(bt, 0.7, 1.1) : 1
          at(ctx, bx, s.ground - by, u, dir, () => drawRugbyBall(ctx, 0, 0, -bt * 9))
          ctx.globalAlpha = 1
        }
        if (gag === 'over' && (phase === 'wait' ? pt > 1 : phase === 'lower' || phase === 'out')) {
          at(ctx, bird.x, s.ground - bird.y, u, phase === 'wait' ? ((-dir) as 1 | -1) : ((-dir) as 1 | -1), () => drawBird(ctx, t * 24, !bird.on))
        }
      },
    })
  },
}

// ─── The dog has the ball ────────────────────────────────────────────────────
// And the whole team, and the referee, would like it back. Either somebody
// dives and misses, or the dog doubles back through their legs and the entire
// chase has to turn round.

const dogSteal: ActDef = {
  id: 'rugby.dog',
  weight: 3,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 60)
    const u = stage.u
    const gag = chance(rng, 0.5) ? 'dive' : 'uturn'
    const kit = pick(rng, KITS)
    const GAPS = [54, 82, 108, 138, 170]
    const SCALES = [1, 1.16, 0.92, 0.68, 1]
    const pack = GAPS.map((gapU, i) => ({
      m: { x: from - dir * gapU * u, walk: i * 1.7, dir } as Mover,
      scale: SCALES[i],
      look: i === 4 ? REF : player(kit, rng, i === 1 ? { beard: '#4a3421' } : i === 3 ? { hat: 'scrumcap' as const, hatColor: C.mint } : i === 0 ? { hat: 'scrumcap' as const, hatColor: C.yellow } : {}),
      gapU,
      stun: 0,
      turned: false,
    }))
    const dog: Mover = { x: from, walk: 0, dir }
    const markX = stage.w / 2 + dir * (gag === 'uturn' ? stage.w * 0.16 : range(rng, -20, 30) * u)
    // The diver: number one in the chase.
    let dive: 'no' | 'air' | 'down' | 'up' | 'done' = 'no'
    let dvt = 0
    let dvx = 0
    let turned = false
    let skid = 0
    return makeAct({
      update(s, dt, t) {
        dvt += dt
        if (gag === 'dive') {
          stepTo(dog, to + dir * 40 * u, 150, s, dt)
          const dogGone = past(dog.x, to, dir)
          pack.forEach((p, i) => {
            if (i === 0 && dive !== 'no' && dive !== 'done') return
            // Once the dog is off, stop chasing it: the exit step below takes over.
            if (dogGone) return
            // Number one rejoins at the back, behind the referee.
            const want = i === 0 && dive === 'done' ? 200 : p.gapU
            stepTo(p.m, dog.x - dir * want * u, 150, s, dt)
            if (!past(p.m.x, dog.x - dir * want * u, dir) && dog.x !== to + dir * 40 * u) p.m.dir = dir
          })
          const first = pack[0]
          if (dive === 'no' && past(first.m.x, markX, dir)) {
            dive = 'air'
            dvt = 0
            dvx = first.m.x
          } else if (dive === 'air') {
            first.m.x = dvx + dir * 46 * u * easeOut(clamp(dvt / 0.45))
            if (dvt > 0.45) {
              dive = 'down'
              dvt = 0
              burst(s, 'dust', first.m.x + dir * 14 * u, s.ground - 3 * u, 7, ['#cbd5e1'], 70, [3, 6])
            }
          } else if (dive === 'down') {
            first.m.x += dir * 40 * u * dt * (1 - clamp(dvt / 0.5))
            if (dvt > 1.5) {
              dive = 'up'
              dvt = 0
            }
          } else if (dive === 'up' && dvt > 0.5) dive = 'done'
          // Once the dog is away, everyone simply runs for the exit.
          if (past(dog.x, to, dir)) for (const p of pack) if (!(p === first && dive !== 'done' && dive !== 'no')) stepTo(p.m, to, 150, s, dt)
          const tail = dive === 'done' || dive === 'no' ? pack.every((p) => past(p.m.x, to, dir)) : false
          return !tail
        }
        // U-turn.
        if (!turned) {
          stepTo(dog, to, 150, s, dt)
          for (const p of pack) stepTo(p.m, to, 150, s, dt)
          if (past(dog.x, markX, dir)) {
            turned = true
            skid = 0.35
            burst(s, 'dust', dog.x + dir * 12 * u, s.ground - 3 * u, 6, ['#cbd5e1'], 70, [3, 6])
          }
          return true
        }
        const back = (-dir) as 1 | -1
        if (skid > 0) {
          skid -= dt
          dog.x += dir * 60 * u * dt * (skid / 0.35)
        } else stepTo(dog, from + back * 60 * u, 165, s, dt)
        for (const p of pack) {
          if (!p.turned) {
            // Still thundering the wrong way until the dog has gone past.
            if (past(dog.x, p.m.x, back)) {
              p.turned = true
              p.stun = 0.5 + rng() * 0.25
              burst(s, 'dust', p.m.x + dir * 10 * u, s.ground - 3 * u, 3, ['#cbd5e1'], 50, [3, 5])
            } else stepTo(p.m, to, 150, s, dt)
          } else if (p.stun > 0) {
            p.stun -= dt
            p.m.x += dir * 50 * u * dt * clamp(p.stun / 0.6)
          } else stepTo(p.m, from + back * 10 * u, 150, s, dt)
        }
        void t
        return !pack.every((p) => p.turned && p.stun <= 0 && past(p.m.x, from, back))
      },
      draw(s, t) {
        const { ctx } = s
        // Back of the chase first.
        for (let i = pack.length - 1; i >= 0; i--) {
          const p = pack[i]
          const diver = gag === 'dive' && i === 0
          const k = diver ? (dive === 'air' ? clamp(dvt / 0.45) : dive === 'down' ? 1 : dive === 'up' ? 1 - clamp(dvt / 0.5) : 0) : 0
          const stunned = p.stun > 0
          const facing = stunned ? dir : p.m.dir
          at(
            ctx,
            p.m.x,
            s.ground - k * 6 * u * p.scale - (diver && dive === 'air' ? Math.sin(k * Math.PI) * 12 * u : 0),
            u * p.scale,
            facing,
            () => {
              if (k < 0.2) groundShadow(ctx, 0, 11)
              let a: Anchors
              if (k > 0) {
                a = drawPerson(ctx, p.look, { armF: 2.9, armB: 2.7, elbowF: 0.1, mouth: dive === 'air' ? 'o' : 'flat', eyes: dive === 'air' ? 'wide' : 'closed' })
                if (dive === 'down') dazed(ctx, a.head.x, a.head.y - 13, t)
              } else if (stunned) {
                // Heels dug in, arms going, watching it go back the other way.
                a = drawPerson(ctx, p.look, { lean: -0.3, crouch: 0.25, armF: 2 + Math.sin(t * 20 + i) * 0.6, armB: -1.4 - Math.sin(t * 20 + i) * 0.6, mouth: 'o', eyes: 'wide' })
              } else {
                a = drawPerson(ctx, p.look, {
                  ...RUN,
                  walk: p.m.walk * (i === 3 ? 1.5 : 1),
                  armF: i === 4 ? 2.7 : i % 2 === 0 ? 1.5 : undefined,
                  armB: i === 1 ? 1.3 : undefined,
                  elbowF: i === 4 ? 0.2 : undefined,
                  mouth: i === 3 ? 'puff' : 'o',
                  eyes: i === 2 ? 'wide' : 'normal',
                  blink: blinking(s.time, i),
                })
                if (i === 3 || i === 1) sweat(ctx, a.head.x, a.head.y - 8, t + i * 0.3)
              }
              if (i === 4) drawWhistle(ctx, a)
            },
            facing * k * 1.45,
          )
          if (i === 4 && !stunned && Math.floor(t * 2.5) % 3 === 0) at(ctx, p.m.x, s.ground, u, 1, () => bubble(ctx, p.m.dir * 14, -62, '!', { color: C.crimson, size: 10 }))
        }
        at(ctx, dog.x, s.ground, u, skid > 0 ? dir : dog.dir, () => {
          groundShadow(ctx, 0, 14)
          if (skid > 0) ctx.rotate(-0.18)
          const d = drawDog(ctx, DOG, { run: dog.walk * 1.2, stride: skid > 0 ? 0.1 : 1, wag: t * 22 })
          drawRugbyBall(ctx, d.mouth.x + 3, d.mouth.y - 0.5, -0.15, 0.85)
          if (skid <= 0) speedLines(ctx, -20, -14, 14, t)
        })
      },
    })
  },
}

// ─── The lap of honour ───────────────────────────────────────────────────────

/** The cup: gold, two handles, ribbons, on a wooden plinth. Base at (0, 0). */
function drawCup(ctx: Ctx, kit: Kit, lid: boolean, t: number) {
  // Ribbons.
  const fl = Math.sin(t * 7) * 2
  line(ctx, -5, -15, -11 - fl * 0.4, -5 + fl * 0.3, 1.8, kit.top)
  line(ctx, 5, -15, 10 - fl * 0.4, -4 - fl * 0.3, 1.8, kit.hoops)
  // Plinth and stem.
  fillRR(ctx, -5.5, -4.5, 11, 4.5, 1, '#7a4b22')
  fillRR(ctx, -3, -3.4, 6, 2, 0.5, C.gold)
  fillRR(ctx, -1.3, -9, 2.6, 5, 0.6, C.brass)
  fillEll(ctx, 0, -5, 3.6, 1.2, C.brass)
  // Handles.
  ctx.lineWidth = 1.4
  ctx.strokeStyle = C.brass
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * 6.6, -14.6, 3.4, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Bowl.
  ctx.beginPath()
  ctx.moveTo(-7, -20)
  ctx.quadraticCurveTo(-7, -9.5, 0, -8.6)
  ctx.quadraticCurveTo(7, -9.5, 7, -20)
  ctx.closePath()
  ctx.fillStyle = C.gold
  ctx.fill()
  fillRR(ctx, -7.6, -21, 15.2, 2, 1, C.brass)
  fillRR(ctx, -4.6, -18.4, 1.6, 7, 0.8, '#fff3c4')
  if (lid) drawLid(ctx, 0, -21)
}

function drawLid(ctx: Ctx, x: number, y: number) {
  ctx.beginPath()
  ctx.arc(x, y, 6.6, Math.PI, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = C.gold
  ctx.fill()
  fillRR(ctx, x - 7.2, y - 0.8, 14.4, 1.6, 0.8, C.brass)
  fillCirc(ctx, x, y - 7.6, 1.7, C.brass)
}

// Muddy from head to boot, cup held high, stars coming off it. A supporter in
// a scarf and bobble hat follows with a flag. The lid comes off and finds a
// new owner; or he stops to give the cup a kiss and the confetti goes up.

const lapOfHonour: ActDef = {
  id: 'rugby.lap-of-honour',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 70)
    const u = stage.u
    const gag = chance(rng, 0.5) ? 'lid' : 'kiss'
    const kit = pick(rng, KITS)
    const hero = player(kit, rng, { hairStyle: 'short' })
    const fan: Look = {
      skin: pick(rng, SKINS),
      top: '#475569',
      bottom: '#334155',
      shoe: '#1f2937',
      hair: pick(rng, HAIRS),
      hairStyle: 'long',
      hat: 'bobble',
      hatColor: kit.top,
      hatTrim: kit.hoops,
      scarf: kit.top === '#f8fafc' ? kit.hoops : kit.top,
      gloves: kit.hoops,
    }
    const GAP = 56
    const h: Mover = { x: from, walk: 0, dir }
    const f: Mover = { x: from - dir * GAP * u, walk: 2, dir }
    const markX = stage.w / 2 + dir * range(rng, 0, 30) * u
    let lid: 'on' | 'air' | 'fan' = 'on'
    let lt = 0
    let lx0 = 0
    let kiss = -1 // seconds into the kiss; -1 before, 99 after
    return makeAct({
      update(s, dt, t) {
        lt += dt
        const stopped = kiss >= 0 && kiss < 2.6
        if (stopped) {
          kiss += dt
          stepTo(f, h.x - dir * 30 * u, 70, s, dt)
          f.dir = dir
          if (crossed(kiss, dt, 0.9) || crossed(kiss, dt, 1.2)) {
            s.particles.emit({ kind: 'heart', x: h.x + dir * 16 * u, y: s.ground - 56 * u, vx: dir * 10 * u, size: 6 * u, color: C.rose })
          }
          if (crossed(kiss, dt, 1.3)) {
            for (let i = 0; i < 34; i++) {
              s.particles.emit({
                kind: 'confetti',
                x: h.x + range(rng, -30, 30) * u,
                y: s.ground - range(rng, 70, 110) * u,
                vx: range(rng, -40, 40) * u,
                vy: -range(rng, 10, 70) * u,
                g: 70,
                drag: 0.7,
                size: range(rng, 3, 5) * u,
                color: pick(rng, [kit.top, kit.hoops, C.gold, C.white]),
                life: 2.6,
              })
            }
          }
          if (kiss >= 2.6) kiss = 99
        } else {
          stepTo(h, to, 72, s, dt)
          stepTo(f, to, kiss === 99 && dir * (h.x - f.x) > GAP * u ? 80 : 72, s, dt)
          if (Math.floor(t * 3.5) !== Math.floor((t - dt) * 3.5) && h.x > 0 && h.x < s.w) {
            s.particles.emit({ kind: 'star', x: h.x + dir * range(rng, 2, 18) * u, y: s.ground - range(rng, 70, 92) * u, vx: range(rng, -30, 30) * u, vy: -range(rng, 10, 50) * u, size: range(rng, 3, 5) * u, color: pick(rng, [C.yellow, C.gold, C.white]) })
          }
          if (past(h.x, markX, dir)) {
            if (gag === 'kiss' && kiss < 0) kiss = 0
            if (gag === 'lid' && lid === 'on') {
              lid = 'air'
              lt = 0
              lx0 = h.x + dir * 10 * u
            }
          }
        }
        if (lid === 'air' && lt > 0.9) {
          lid = 'fan'
          burst(s, 'star', f.x, s.ground - 74 * u, 4, [C.yellow, C.white], 60, [2, 4])
        }
        return dir === 1 ? f.x < to : f.x > to
      },
      draw(s, t) {
        const { ctx } = s
        const kissing = kiss >= 0 && kiss < 2.6
        // The supporter.
        at(ctx, f.x, s.ground, u, f.dir, () => {
          groundShadow(ctx, 0, 11)
          const wave = Math.sin(t * 7)
          const crowned = lid === 'fan'
          const a = drawPerson(ctx, fan, {
            walk: f.walk,
            stride: kissing && Math.abs(f.x - (h.x - dir * 30 * u)) < 2 * u ? 0 : 0.8,
            lift: kissing ? Math.abs(Math.sin(t * 9)) * 4 : 0,
            armF: 2.6 + wave * 0.35,
            elbowF: 0.2,
            armB: crowned ? 0.3 : -2.2 - wave * 0.3,
            mouth: crowned ? 'o' : 'grin',
            eyes: crowned ? 'wide' : kissing ? 'closed' : 'normal',
            blink: blinking(s.time, 2),
          })
          // A flag on a stick, in the hoops.
          const ang = 2.6 + wave * 0.35 + 0.2
          const tx = a.handF.x + Math.sin(ang) * 24
          const ty = a.handF.y + Math.cos(ang) * 24
          line(ctx, a.handF.x - Math.sin(ang) * 3, a.handF.y - Math.cos(ang) * 3, tx, ty, 1.2, '#e2e8f0')
          const fw = Math.sin(t * 9) * 2
          for (let i = 0; i < 4; i++) {
            fillPoly(ctx, [tx - 16, ty + 1 + i * 3 + fw, tx, ty + i * 3, tx, ty + (i + 1) * 3, tx - 16, ty + 1 + (i + 1) * 3 + fw], i % 2 === 0 ? kit.top : kit.hoops)
          }
          if (crowned) drawLid(ctx, a.crown.x - 1, a.crown.y - 3)
        })
        // The lid, on its way from the cup to its new home.
        if (lid === 'air') {
          const p = clamp(lt / 0.9)
          const tx = f.x - dir * 1 * u
          at(ctx, lerp(lx0, tx, p), s.ground - lerp(92, 68, p) * u - 4 * 24 * u * p * (1 - p), u, dir, () => {
            ctx.rotate(-p * 6.283)
            drawLid(ctx, 0, 0)
          })
        }
        // The hero.
        at(ctx, h.x, s.ground, u, dir, () => {
          groundShadow(ctx, 0, 11)
          const smooch = kissing ? easeInOut(seg(kiss, 0.3, 0.7)) * (1 - easeInOut(seg(kiss, 1.5, 1.9))) : 0
          const pump = kissing ? 0 : Math.sin(t * 6) * 0.12
          const a = drawPerson(ctx, hero, {
            walk: h.walk,
            stride: kissing ? 0 : 0.85,
            lean: kissing ? -0.05 : 0.08,
            lift: kissing && kiss > 1.9 ? Math.abs(Math.sin(kiss * 9)) * 5 : 0,
            armF: lerp(2.85 + pump, 1.75, smooch),
            elbowF: lerp(0.15, 1.2, smooch),
            armB: kissing ? lerp(0.3, 1.5, smooch) : -2.3 + Math.sin(t * 8) * 0.4,
            elbowB: kissing ? 1 : 0.3,
            headTilt: smooch * 0.1 - 0.08,
            mouth: smooch > 0.6 ? 'puff' : 'grin',
            eyes: smooch > 0.6 || (kissing && kiss > 1.9) ? 'closed' : 'normal',
            blink: blinking(s.time, 6),
          })
          mud(ctx, a)
          ctx.save()
          ctx.translate(a.handF.x + 1, a.handF.y - 1)
          ctx.rotate(lerp(0.12 + pump, 0.5, smooch))
          drawCup(ctx, kit, lid === 'on', t)
          ctx.restore()
        })
      },
    })
  },
}

export const RUGBY_ACTS: ActDef[] = [theBreak, conversion, scrum, lineOut, dogSteal, lapOfHonour]
