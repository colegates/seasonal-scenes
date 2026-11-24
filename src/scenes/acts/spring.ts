import { drawBird } from '../creatures'
import { C, TAU, alpha, at, clamp, easeBack, easeIn, easeInOut, easeOut, fillCirc, fillEll, fillPoly, fillRR, groundShadow, heart, lerp, line, seg, shade, star, type Ctx } from '../draw'
import { blinking, bubble, burst, crossing, makeAct, speedLines, sweat } from '../kit'
import { CAST, drawPerson, personAnchors, type Look, type Pose } from '../person'
import { chance, pick, range } from '../rng'
import type { ActDef, AmbientDef } from '../types'

export const SPRING_PETALS = ['#fbcfe8', '#f9a8d4', '#fce7f3', '#fff1f5', '#f472b6', '#fde2e9']

export const SPRING_AMBIENT: AmbientDef = {
  kind: 'petal',
  colors: SPRING_PETALS,
  rate: 2.2,
  flurry: [20, 18],
  settle: true,
  pile: 'items',
  maxPile: 9,
  size: [3, 5],
}

const GRASS = ['#4ade80', '#65a30d', '#86efac', '#3f9d4a']
const SOIL = '#8b5a2b'
const SOIL_DUST = ['#a8805a', '#8b6a4a', '#c8a06a']

/** Has something travelling in `dir` got as far as `target`? */
const passed = (dir: 1 | -1, x: number, target: number) => (dir === 1 ? x >= target : x <= target)
/** True on the frame that `t` crosses `mark`. */
const hit = (t: number, dt: number, mark: number) => t >= mark && t - dt < mark
/** True `rate` times a second. */
const tick = (t: number, dt: number, rate: number) => Math.floor(t * rate) !== Math.floor((t - dt) * rate)

// ─── Props ───────────────────────────────────────────────────────────────────

/**
 * A petrol rotary mower centred on `cx`, about 30 units long. The handle runs
 * back to wherever the hands are. `spin` turns the wheel hubs.
 */
function drawMower(ctx: Ctx, cx: number, spin: number, shake: number, hx: number, hy: number, running: boolean) {
  groundShadow(ctx, cx, 17)
  // Handle: two rails back to the grip, with a cross brace.
  line(ctx, cx - 11, -9, hx, hy, 1.7, '#94a3b8')
  line(ctx, cx - 7, -9, lerp(cx - 7, hx, 0.55), lerp(-9, hy, 0.55), 1.2, '#64748b')
  line(ctx, hx - 2.5, hy + 0.6, hx + 2.5, hy - 0.6, 2.6, '#1f2937')
  ctx.save()
  ctx.translate(cx + shake, Math.abs(shake) * -0.6)
  // Deck, with a sloped nose and a dark skirt.
  ctx.beginPath()
  ctx.moveTo(-15, -4)
  ctx.lineTo(-15, -10)
  ctx.quadraticCurveTo(-14, -13, -10, -13)
  ctx.lineTo(8, -13)
  ctx.quadraticCurveTo(15, -12, 17, -6)
  ctx.lineTo(17, -4)
  ctx.closePath()
  ctx.fillStyle = '#e5484d'
  ctx.fill()
  fillRR(ctx, -15, -5.5, 32, 2.6, 1, '#9f1d28')
  fillRR(ctx, -12, -12.2, 16, 1.6, 0.8, alpha('#ffffff', 0.3))
  // The side chute the clippings come out of.
  fillEll(ctx, -3, -8, 4.4, 2.2, '#3a0d12')
  // Engine block, cooling fins, fuel cap, pull-start and a stubby exhaust.
  fillRR(ctx, -6, -21, 13, 9, 2, '#475569')
  for (let i = 0; i < 3; i++) line(ctx, -4, -18.6 + i * 2.2, 5, -18.6 + i * 2.2, 0.7, '#334155')
  fillRR(ctx, -8.5, -17, 3.5, 2.2, 1, '#64748b')
  fillCirc(ctx, 0.5, -21.5, 3.4, '#facc15')
  fillCirc(ctx, 0.5, -21.5, 1.3, '#a16207')
  fillRR(ctx, 6, -24, 3, 4, 1, '#1f2937')
  if (running) {
    const p = (spin * 0.35) % 1
    ctx.globalAlpha = 0.35 * (1 - p)
    fillCirc(ctx, -10 - p * 5, -17 - p * 5, 1.6 + p * 2.4, '#cbd5e1')
    ctx.globalAlpha = 1
  }
  ctx.restore()
  // Wheels: a bigger one at the back, hubs that turn.
  for (const [wx, r] of [
    [cx - 10, 5.2],
    [cx + 11, 4.3],
  ]) {
    fillCirc(ctx, wx, -r, r, '#1f2937')
    fillCirc(ctx, wx, -r, r * 0.55, '#facc15')
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * TAU) / 3
      line(ctx, wx, -r, wx + Math.cos(a) * r * 0.55, -r + Math.sin(a) * r * 0.55, 0.8, '#a16207')
    }
  }
}

interface DuckOpts {
  step: number
  body: string
  wing: string
  /** Head turned to look back down the line. */
  back?: boolean
  fluff?: boolean
  open?: boolean
  still?: boolean
}

/** A duck about 24 units long, 24 tall. Ducklings are the same bird, scaled. */
function drawDuck(ctx: Ctx, o: DuckOpts) {
  const moving = o.still ? 0 : 1
  ctx.save()
  ctx.rotate(Math.sin(o.step) * 0.08 * moving)
  for (let side = 0; side < 2; side++) {
    const ph = o.step + side * Math.PI
    const fx = -1.5 + side * 3 + Math.sin(ph) * 3.4 * moving
    const fy = -Math.max(0, Math.cos(ph)) * 2 * moving
    line(ctx, -1.5 + side * 3, -5, fx, fy - 0.8, 1.3, side ? C.orange : shade(C.orange, -0.2))
    fillPoly(ctx, [fx - 1.2, fy, fx + 3.8, fy, fx, fy - 2], side ? C.orange : shade(C.orange, -0.2))
  }
  fillPoly(ctx, [-7, -11, -15, -16.5, -9, -5], o.body)
  fillEll(ctx, 0, -9, 10.5, 6.6, o.body)
  fillEll(ctx, 1, -5.6, 8, 3, shade(o.body, -0.12))
  fillEll(ctx, -2, -10.4, 6.4, 3.7, o.wing, 0.16)
  line(ctx, -7, -9, -3, -8, 0.7, shade(o.wing, -0.18))
  line(ctx, -6, -11, -2, -10, 0.7, shade(o.wing, -0.18))
  // Neck and head. Looking back just swings the bill and eye round.
  line(ctx, 6, -12.5, 8.4, -18.5, 5, o.body)
  fillCirc(ctx, 8.8, -20, 4.5, o.body)
  const d = o.back ? -1 : 1
  if (o.open) fillRR(ctx, d === 1 ? 12.2 : 0.2, -19.4, 5.2, 1.8, 0.9, shade(C.orange, -0.25))
  ctx.save()
  ctx.translate(8.8 + d * 3.4, -20.4)
  ctx.rotate(o.open ? -0.22 * d : 0)
  fillRR(ctx, d === 1 ? 0 : -5.8, -1.3, 5.8, 2.5, 1.2, C.orange)
  ctx.restore()
  fillCirc(ctx, 8.8 + d * 1.5, -21.3, 1, C.ink)
  fillCirc(ctx, 8.8 + d * 1.8, -21.6, 0.35, C.white)
  if (o.fluff) {
    line(ctx, 8.2, -24, 7.4, -26.4, 0.9, o.body)
    line(ctx, 9.2, -24.2, 9.8, -26.2, 0.9, o.body)
  }
  ctx.restore()
}

/** A two-wing butterfly about 8 units across. `flap` in radians. */
function drawFlutter(ctx: Ctx, flap: number, color: string) {
  const w = 0.25 + Math.abs(Math.sin(flap)) * 0.75
  fillEll(ctx, -2.6 * w, -1.4, 3 * w, 3.4, color, -0.3)
  fillEll(ctx, 2.6 * w, -1.4, 3 * w, 3.4, color, 0.3)
  fillEll(ctx, -2 * w, 2, 2 * w, 2.2, shade(color, -0.18), 0.3)
  fillEll(ctx, 2 * w, 2, 2 * w, 2.2, shade(color, -0.18), -0.3)
  line(ctx, 0, -2.6, 0, 2.8, 1.1, '#3b2a1a')
}

/** A soil mound. `g` 0..1 is how far it has risen. */
function drawHill(ctx: Ctx, g: number) {
  if (g <= 0.02) return
  const w = 15 * (0.5 + g * 0.5)
  const h = 10 * g
  ctx.beginPath()
  ctx.moveTo(-w, 0.5)
  ctx.quadraticCurveTo(-w * 0.55, -h * 1.05, 0, -h)
  ctx.quadraticCurveTo(w * 0.6, -h * 1.05, w, 0.5)
  ctx.closePath()
  ctx.fillStyle = SOIL
  ctx.fill()
  fillEll(ctx, -w * 0.35, -h * 0.55, w * 0.3, h * 0.25, shade(SOIL, 0.16), -0.4)
  fillCirc(ctx, w * 0.3, -h * 0.4, 1.5 * g, shade(SOIL, -0.22))
  fillCirc(ctx, -w * 0.62, -h * 0.14, 1.2 * g, shade(SOIL, -0.22))
  fillCirc(ctx, w * 0.72, -0.6, 1.6 * g, shade(SOIL, 0.1))
  fillCirc(ctx, -w * 0.95, -0.4, 1.3 * g, SOIL)
}

interface MoleOpts {
  /** -1 looking left, 0 at us, 1 right. */
  look: number
  /** Paw positions; default is resting on the rim of the hill. */
  pawL?: [number, number]
  pawR?: [number, number]
  blink?: boolean
  mouth?: 'smile' | 'o'
}

const MOLE = '#85759a'

function molePaw(ctx: Ctx, x: number, y: number, side: number) {
  fillEll(ctx, x, y, 3.6, 2.6, C.pink, side * 0.3)
  for (let i = -1; i <= 1; i++) line(ctx, x + i * 1.8, y - 1.6, x + i * 2.4 + side * 0.6, y - 4, 0.9, C.cream)
}

/** The mole from the chest up, origin where it meets the hill. Tiny glasses. */
function drawMole(ctx: Ctx, o: MoleOpts) {
  const k = o.look
  const pl = o.pawL ?? [-10.5, -2.5]
  const pr = o.pawR ?? [10.5, -2.5]
  // A raised paw gets a stubby arm; at rest the arms are hidden in the fur.
  if (pl[1] < -6) line(ctx, -8, -7, pl[0], pl[1] + 1, 3.6, shade(MOLE, -0.1))
  if (pr[1] < -6) line(ctx, 8, -7, pr[0], pr[1] + 1, 3.6, shade(MOLE, -0.1))
  fillRR(ctx, -9.5, -24, 19, 34, 9.5, MOLE)
  fillEll(ctx, k * 2, -5, 5.6, 7.5, shade(MOLE, 0.2))
  fillEll(ctx, -4 + k, -21, 3.4, 1.6, shade(MOLE, 0.22), -0.5)
  // Snout and a shiny pink nose that leads the turn of the head.
  fillEll(ctx, k * 5.2, -12.4, 5, 3.8, shade(MOLE, 0.3))
  fillCirc(ctx, k * 8.4, -13.2, 2.2, C.rose)
  fillCirc(ctx, k * 8.4 - 0.6, -13.9, 0.6, alpha('#ffffff', 0.8))
  for (const sd of [-1, 1]) {
    line(ctx, k * 5.2 + sd * 3, -12, k * 5.2 + sd * 8.5, -13, 0.5, alpha(C.white, 0.6))
    line(ctx, k * 5.2 + sd * 3, -11, k * 5.2 + sd * 8, -9.6, 0.5, alpha(C.white, 0.6))
  }
  if (o.mouth === 'o') fillEll(ctx, k * 5, -9.6, 1.3, 1.6, '#4a2f3a')
  else {
    ctx.beginPath()
    ctx.arc(k * 5, -10.6, 2.2, 0.2, Math.PI - 0.2)
    ctx.lineWidth = 0.8
    ctx.strokeStyle = '#4a2f3a'
    ctx.stroke()
  }
  // The glasses: round gold frames far too small for anything but a mole.
  const gx = k * 2.6
  for (const sd of [-1, 1]) {
    const lx = gx + sd * 3.5
    fillCirc(ctx, lx, -18.2, 2.9, alpha('#dbeafe', 0.9))
    if (o.blink) line(ctx, lx - 1.2, -18, lx + 1.2, -18, 0.8, C.ink)
    else fillCirc(ctx, lx + k * 0.9, -18, 0.85, C.ink)
    fillCirc(ctx, lx - 1, -19.3, 0.6, '#ffffff')
    ctx.beginPath()
    ctx.arc(lx, -18.2, 2.9, 0, TAU)
    ctx.lineWidth = 0.9
    ctx.strokeStyle = C.gold
    ctx.stroke()
  }
  line(ctx, gx - 0.7, -18.6, gx + 0.7, -18.6, 0.9, C.gold)
  molePaw(ctx, pl[0], pl[1], -1)
  molePaw(ctx, pr[0], pr[1], 1)
}

function drawGolfBall(ctx: Ctx, x: number, y: number, rot = 0) {
  fillCirc(ctx, x, y, 3.2, '#f8fafc')
  fillCirc(ctx, x + 0.9, y + 0.9, 2.2, alpha('#94a3b8', 0.25))
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * TAU) / 4
    fillCirc(ctx, x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, 0.45, '#94a3b8')
  }
}

type Bloom = 'tulip' | 'daisy' | 'sunflower'

/** Where the top of a stem `h` tall ends up when bent. `bend` -1..1, + forward. */
function stemTip(h: number, bend: number) {
  const b = Math.abs(bend)
  return { x: Math.sign(bend) * b * h * 0.22, y: -h * (1 - 0.26 * b * b), rot: bend * 2.1 }
}

/**
 * A flower rooted at the origin. `h` stem height, `bloom` 0..1 opens the head,
 * `bend` nods it over. The sunflower has a face, because of course it does.
 */
function drawFlower(ctx: Ctx, kind: Bloom, h: number, bloom: number, color: string, bend = 0, grin = false) {
  if (h < 0.6) return
  const tip = stemTip(h, bend)
  const cy = -h * (1.02 + Math.abs(bend) * 0.1)
  const thick = kind === 'sunflower' ? 2.2 : 1.5
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(0, cy, tip.x, tip.y)
  ctx.lineWidth = thick
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#4ea85a'
  ctx.stroke()
  // Leaves, a pair low on the stem (which is still nearly straight there).
  const lf = clamp(h / 14)
  const ly = -Math.min(h * 0.4, 16)
  const ls = kind === 'sunflower' ? 1.5 : 1
  fillEll(ctx, 3.6 * ls * lf, ly, 4.2 * ls * lf, 1.7 * ls * lf, '#4ade80', -0.5)
  fillEll(ctx, -3.6 * ls * lf, ly * 0.72, 4.2 * ls * lf, 1.7 * ls * lf, '#3f9d4a', 0.5)
  ctx.save()
  ctx.translate(tip.x, tip.y)
  ctx.rotate(tip.rot)
  const b = Math.max(0, bloom)
  if (kind === 'tulip') {
    // A closed bud that opens into three cupped petals.
    fillEll(ctx, 0, -2, 2.2 + b * 0.6, 3.4, shade(color, -0.2))
    if (b > 0.02) {
      fillEll(ctx, -2.6 * b, -3.6, 2.6 * b + 0.6, 5 * b + 1, shade(color, -0.12), -0.3 * b)
      fillEll(ctx, 2.6 * b, -3.6, 2.6 * b + 0.6, 5 * b + 1, shade(color, -0.12), 0.3 * b)
      fillEll(ctx, 0, -4, 2.6 * b + 0.6, 5.4 * b + 1, color)
      fillEll(ctx, -0.7, -5, 0.8 * b, 2.8 * b, alpha('#ffffff', 0.35))
    }
  } else {
    const sun = kind === 'sunflower'
    const n = sun ? 14 : 9
    const r = sun ? 8.5 : 4.2
    const pl = (sun ? 5.5 : 3.6) * b
    fillCirc(ctx, 0, -2, 1.6 + b * 0.4, '#4ea85a')
    if (b > 0.02) {
      ctx.save()
      ctx.translate(0, -r * b - 1)
      // A sunflower faces the way it is looking; tilt the disc a touch.
      ctx.scale(sun ? 0.86 : 1, 1)
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n
        fillEll(ctx, Math.cos(a) * (r * b * 0.75 + pl * 0.5), Math.sin(a) * (r * b * 0.75 + pl * 0.5), pl, pl * 0.42, i % 2 ? color : shade(color, -0.12), a)
      }
      fillCirc(ctx, 0, 0, r * b * 0.78, sun ? '#7a4a1e' : C.gold)
      if (sun && b > 0.6) {
        fillCirc(ctx, 0, 0, r * 0.5, '#8d5a28')
        fillCirc(ctx, -2.6, -1.4, 1, C.ink)
        fillCirc(ctx, 2.6, -1.4, 1, C.ink)
        ctx.beginPath()
        ctx.arc(0, grin ? 0.2 : 0.6, grin ? 3.4 : 2.4, 0.25, Math.PI - 0.25)
        ctx.lineWidth = 0.9
        ctx.strokeStyle = C.ink
        ctx.stroke()
      } else if (!sun) {
        fillCirc(ctx, -0.8, -0.8, r * b * 0.3, alpha('#ffffff', 0.4))
      }
      ctx.restore()
    }
  }
  ctx.restore()
}

/** A watering can held by its handle at the origin. `tilt` pours it forward. */
function drawCan(ctx: Ctx, tilt: number, color: string) {
  ctx.save()
  ctx.rotate(tilt)
  // Loop handle over the top, then the body hanging under the hand.
  ctx.beginPath()
  ctx.arc(-0.5, 2, 5.2, Math.PI * 0.95, Math.PI * 2.05)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = shade(color, -0.25)
  ctx.stroke()
  line(ctx, 4, 6, 12, 0.5, 2, shade(color, -0.12))
  fillRR(ctx, -5.5, 2, 10.5, 9.5, 2, color)
  fillRR(ctx, -5.5, 2, 10.5, 2.2, 1, shade(color, 0.25))
  fillRR(ctx, -4.4, 5.5, 1.6, 5, 0.8, alpha('#ffffff', 0.3))
  // The rose on the end of the spout.
  ctx.save()
  ctx.translate(12.4, 0.2)
  ctx.rotate(-0.6)
  fillEll(ctx, 0, 0, 1.4, 2.8, shade(color, 0.2))
  ctx.restore()
  ctx.restore()
}

interface BunnyOpts {
  /** 0..1 through one hop. */
  hop: number
  sit?: boolean
  /** Ear-washing phase in radians; undefined when not washing. */
  wash?: number
  alert?: boolean
  coat: string
  blink?: boolean
}

/** A rabbit about 26 units long. Hops flat out or sits up on its haunches. */
function drawBunny(ctx: Ctx, o: BunnyOpts) {
  const coat = o.coat
  const pale = shade(coat, 0.3)
  const dark = shade(coat, -0.14)
  const ear = (x: number, y: number, rot: number, far: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    fillEll(ctx, 0, -6.5, 2.3, 7, far ? dark : coat)
    if (!far) fillEll(ctx, 0.3, -6.3, 1.1, 5, C.pink)
    ctx.restore()
  }
  if (o.sit) {
    fillCirc(ctx, -8.6, -5, 3.1, '#f8fafc')
    fillEll(ctx, -2.5, -5.2, 7.4, 5.4, dark)
    fillEll(ctx, 2.5, -1.2, 6.2, 1.9, pale)
    fillEll(ctx, -0.5, -11, 7, 10, coat, 0.1)
    fillEll(ctx, 2.6, -9, 3.8, 6.4, pale, 0.1)
    const w = o.wash
    const pull = w === undefined ? 0 : (Math.sin(w) + 1) / 2
    // Far ear stands; the near one gets hauled down over the face and scrubbed.
    ear(1.6, -27, o.alert ? -0.05 : -0.22, true)
    fillCirc(ctx, 3.4, -23, 5.8, coat)
    fillEll(ctx, 6.4, -21.4, 2.6, 2.2, pale)
    if (w === undefined) ear(4.4, -27.4, o.alert ? 0.08 : -0.02, false)
    else ear(5.2, -27, 0.5 + pull * 1.5, false)
    if (o.blink || (w !== undefined && pull > 0.5)) line(ctx, 4.4, -24, 6.4, -24, 0.8, C.ink)
    else {
      fillCirc(ctx, 5.4, -24.2, o.alert ? 1.5 : 1.2, C.ink)
      fillCirc(ctx, 5.8, -24.6, 0.4, '#ffffff')
    }
    fillCirc(ctx, 8.9, -21.8, 0.9, C.rose)
    if (w === undefined) {
      fillEll(ctx, 5.4, -12.6, 1.5, 3, pale, -0.3)
      fillEll(ctx, 6.6, -12, 1.5, 3, coat, -0.2)
    } else {
      // Both paws work down the ear in little strokes.
      const px = 8.4 + pull * 3.4
      const py = -25.5 + pull * 5.5
      line(ctx, 3, -15, px - 0.5, py + 1.5, 2.2, coat)
      fillCirc(ctx, px, py, 1.8, pale)
      fillCirc(ctx, px - 1.8, py + 2, 1.6, pale)
    }
    return
  }
  const air = Math.sin(o.hop * Math.PI)
  ctx.save()
  ctx.translate(0, -air * 9)
  ctx.rotate(-Math.cos(o.hop * Math.PI) * 0.28)
  fillCirc(ctx, -11, -9.5, 3.1, '#f8fafc')
  // Long hind foot kicks out behind in the air and tucks under on landing.
  fillEll(ctx, -6 - air * 6, -2.4 + air * 0.5, 6.4, 2, pale, -air * 0.5)
  fillEll(ctx, -4.6, -6, 6.2, 5.2, dark)
  fillEll(ctx, 0, -9.2, 10.4, 6.6, coat)
  fillEll(ctx, 1.5, -6.4, 7, 3, pale)
  line(ctx, 6.5, -6.5, 8.5 + air * 4.5, -1.4 - air * 1.5, 2.2, coat)
  line(ctx, 5, -6, 6.5 + air * 4, -1 - air * 1, 2.2, dark)
  ear(7.4, -19, -0.75 - air * 0.5, true)
  fillCirc(ctx, 9.4, -15, 5.7, coat)
  fillEll(ctx, 12.2, -13.4, 2.8, 2.3, pale)
  ear(8.8, -19.4, -0.5 - air * 0.55, false)
  if (o.blink) line(ctx, 10.2, -16, 12.2, -16, 0.8, C.ink)
  else {
    fillCirc(ctx, 11.2, -16.1, 1.2, C.ink)
    fillCirc(ctx, 11.6, -16.5, 0.4, '#ffffff')
  }
  fillCirc(ctx, 14.9, -14, 0.9, C.rose)
  ctx.restore()
}

/** A bumblebee about 12 units long, centred on the origin. */
function drawBee(ctx: Ctx, flap: number, dizzy = false) {
  const w = Math.sin(flap)
  ctx.globalAlpha = 0.75
  fillEll(ctx, -1.5, -5 - w * 1.2, 3, 4.6, '#e0f2fe', -0.5 + w * 0.5)
  fillEll(ctx, 1.6, -5 + w * 1.2, 2.6, 4.2, '#f1f5f9', 0.2 - w * 0.5)
  ctx.globalAlpha = 1
  fillPoly(ctx, [-6, -0.8, -8.6, 0.4, -6, 1], '#3b2a1a')
  fillEll(ctx, 0, 0, 6.4, 4.8, '#facc15')
  fillEll(ctx, -0.5, 1.8, 5, 2.2, shade('#facc15', -0.14))
  // Two fuzzy brown bands, clipped to the body by keeping them short.
  fillEll(ctx, -2.6, 0, 1.3, 4.5, '#4a3421')
  fillEll(ctx, 1, 0, 1.3, 4.7, '#4a3421')
  fillCirc(ctx, 5.4, -0.4, 3.2, '#4a3421')
  fillCirc(ctx, 6.6, -1, 1.25, '#ffffff')
  if (dizzy) {
    line(ctx, 5.9, -1.7, 7.3, -0.3, 0.6, C.ink)
    line(ctx, 7.3, -1.7, 5.9, -0.3, 0.6, C.ink)
  } else fillCirc(ctx, 6.9, -0.9, 0.6, C.ink)
  line(ctx, 6, -3, 8, -6, 0.6, '#4a3421')
  line(ctx, 5, -3.2, 5.6, -6.4, 0.6, '#4a3421')
  line(ctx, -1, 4.2, -1.6, 6, 0.6, '#4a3421')
  line(ctx, 2, 4.2, 2.4, 6, 0.6, '#4a3421')
}

// ─── The lawnmower ───────────────────────────────────────────────────────────
// First cut of the year. The mower hoovers the blossom off the floor and spits
// clippings out of the side. A third of the time it bolts and tows him along
// on his stomach; a third of the time it dies and wants three pulls of the
// cord. Otherwise it behaves, and a robin rides on the engine.

const mower: ActDef = {
  id: 'spring.mower',
  weight: 3,
  clears: true,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 75)
    const r = rng()
    const gag = r < 0.36 ? 'runaway' : r < 0.72 ? 'stall' : 'plain'
    const look: Look = chance(rng, 0.5) ? { ...CAST.dad, hat: 'cap', hatColor: C.forest, shorts: true } : { ...CAST.grandad }
    const gagAt = stage.w * range(rng, 0.3, 0.48)
    const MX = 33 // mower centre, units ahead of his feet
    const PULL0 = 1.5
    let x = from
    let walk = 0
    let spin = 0
    let mode: 'mow' | 'rev' | 'bolt' | 'stall' = 'mow'
    let mt = 0
    let done = gag === 'plain'
    const clippings = (s: typeof stage, n: number, power: number) => {
      for (let i = 0; i < n; i++) {
        s.particles.emit({
          kind: 'confetti',
          x: x + dir * (MX - 3) * s.u,
          y: s.ground - 8 * s.u,
          vx: -dir * range(rng, 30, 110) * power * s.u,
          vy: -range(rng, 60, 150) * power * s.u,
          g: 330 * s.u,
          sway: 4,
          vr: range(rng, -9, 9),
          size: range(rng, 2.6, 4.2) * s.u,
          color: pick(rng, GRASS),
          life: 1.3,
        })
      }
    }
    const smoke = (s: typeof stage, n: number) => burst(s, 'dust', x + dir * (MX - 9) * s.u, s.ground - 18 * s.u, n, ['#cbd5e1', '#94a3b8'], 45, [4, 8])
    return makeAct({
      update(s, dt, t) {
        mt += dt
        const travelled = dir === 1 ? x : s.w - x
        if (!done && travelled > gagAt) {
          done = true
          mode = gag === 'runaway' ? 'rev' : 'stall'
          mt = 0
          if (mode === 'stall') smoke(s, 5)
        }
        let v = 0
        if (mode === 'mow') v = 50
        else if (mode === 'rev') {
          if (tick(mt, dt, 9)) smoke(s, 1)
          if (mt > 0.8) {
            mode = 'bolt'
            mt = 0
          }
        } else if (mode === 'bolt') v = 60 + 165 * easeOut(seg(mt, 0, 0.5))
        else {
          // Three pulls. The first two get a cough; the third catches.
          for (let k = 0; k < 3; k++) if (hit(mt, dt, PULL0 + k * 0.9 + 0.42)) smoke(s, k === 2 ? 9 : 3)
          if (mt > 5) {
            mode = 'mow'
            mt = 0
          }
        }
        if (v > 0) {
          const before = x
          x += dir * v * s.u * dt
          walk += dt * (v / 6.2)
          spin += (dt * v) / 5
          const got = s.particles.sweep(before + dir * (MX - 6) * s.u, x + dir * (MX + 16) * s.u)
          // Some of what goes in comes straight back out of the chute.
          if (got > 0 && tick(t, dt, 9)) {
            s.particles.emit({
              kind: 'petal',
              x: x + dir * (MX - 3) * s.u,
              y: s.ground - 8 * s.u,
              vx: -dir * range(rng, 60, 130) * s.u,
              vy: -range(rng, 70, 170) * s.u,
              g: 150 * s.u,
              drag: 0.5,
              vr: range(rng, -8, 8),
              size: range(rng, 3, 5) * s.u,
              color: pick(rng, SPRING_PETALS),
              life: 1.8,
            })
          }
          if (tick(t, dt, mode === 'bolt' ? 34 : 18)) clippings(s, 1, mode === 'bolt' ? 1.5 : 1)
        } else spin += mode === 'rev' ? dt * 3 : 0
        return dir === 1 ? x < to : x > to
      },
      draw(s, t) {
        const { ctx } = s
        const stall = mode === 'stall'
        const caught = stall && mt > PULL0 + 2 * 0.9 + 0.42
        const running = !stall || caught
        const shake = !running ? 0 : Math.sin(t * 55) * (mode === 'rev' ? 1.1 : caught ? 0.9 : 0.35)
        if (mode === 'bolt') {
          // Towed flat out behind it, legs going, hanging on to the handle.
          const th = 1.3 + Math.sin(t * 17) * 0.06
          const ox = -52
          const oy = -6 - Math.abs(Math.sin(t * 9)) * 3
          const pose: Pose = { walk: t * 22, stride: 0.5, armF: 3.05, armB: 2.85, elbowF: 0.08, elbowB: 0.12, mouth: 'o', eyes: 'wide' }
          const a = personAnchors(pose)
          const hx = ox + a.handF.x * Math.cos(th) - a.handF.y * Math.sin(th)
          const hy = oy + a.handF.x * Math.sin(th) + a.handF.y * Math.cos(th)
          at(ctx, x, s.ground, s.u, dir, () => {
            groundShadow(ctx, -24, 22, 0.2)
            speedLines(ctx, -58, -12, 16, t)
            drawMower(ctx, MX, spin, shake, hx, hy, true)
          })
          at(ctx, x + dir * ox * s.u, s.ground + oy * s.u, s.u, dir, () => drawPerson(ctx, look, pose), dir * th)
          at(ctx, x, s.ground, s.u, dir, () => fillCirc(ctx, hx, hy, 2.8, look.skin))
          return
        }
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          let pose: Pose = { walk, stride: 0.75, armF: 0.95, elbowF: 0.35, armB: 0.75, elbowB: 0.45, lean: 0.14, mouth: 'smile', blink: blinking(s.time, 2) }
          let yank = 0
          let pulling = false
          if (mode === 'rev') pose = { ...pose, stride: 0, lean: -0.1, mouth: 'o', eyes: 'wide' }
          if (stall) {
            if (mt < 0.7) pose = { ...pose, stride: 0, lean: 0, mouth: 'o', eyes: 'wide' }
            else if (mt < PULL0) pose = { stride: 0, armF: 2.5, elbowF: 1.7, armB: 0.2, lean: 0.1, mouth: 'flat', headTilt: 0.12 }
            else if (mt < PULL0 + 2.7) {
              const q = (mt - PULL0) % 0.9
              yank = easeOut(seg(q, 0.3, 0.42)) * (1 - seg(q, 0.72, 0.88))
              pulling = true
              pose = {
                stride: 0,
                crouch: 0.25 - yank * 0.2,
                lean: 0.46 - yank * 0.66,
                armF: lerp(1.62, 0.5, yank),
                elbowF: lerp(0.08, 1.5, yank),
                armB: 0.9,
                elbowB: 0.5,
                mouth: yank > 0.3 ? 'puff' : 'flat',
                eyes: yank > 0.3 ? 'closed' : 'normal',
              }
            } else pose = { stride: 0, armF: 2.9, armB: -2.9, elbowF: -0.2, elbowB: 0.2, mouth: 'grin', lift: Math.abs(Math.sin((mt - PULL0 - 2.7) * 9)) * 3 }
          }
          const a = personAnchors(pose)
          const gripped = mode === 'mow' || mode === 'rev' || (stall && mt < 0.7)
          // Parked, the handle stays where he left it.
          const hx = gripped ? a.handF.x : 13.4
          const hy = gripped ? a.handF.y : -27
          drawMower(ctx, MX, spin, shake, hx, hy, running)
          if (gag === 'plain') {
            ctx.save()
            ctx.translate(MX + 0.5 + shake, -24.6 - Math.abs(Math.sin(t * 6)) * 1.2)
            ctx.scale(0.8, 0.8)
            drawBird(ctx)
            ctx.restore()
          }
          drawPerson(ctx, look, pose)
          if (pulling) {
            // Starter cord, with its little T handle.
            line(ctx, MX + 0.5, -21.5, a.handF.x, a.handF.y, 1.1, '#e2e8f0')
            line(ctx, a.handF.x - 0.5, a.handF.y - 2.4, a.handF.x + 0.5, a.handF.y + 2.4, 2, '#1f2937')
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, look.skin)
            if (mt > PULL0 + 0.9) sweat(ctx, a.head.x, a.head.y - 8, t)
          }
          if (mode === 'rev') bubble(ctx, a.head.x, a.head.y - 18, '!', { color: C.crimson })
          if (stall && mt >= 0.7 && mt < PULL0) bubble(ctx, a.head.x, a.head.y - 18, '?')
        })
      },
    })
  },
}

// ─── The ducks ───────────────────────────────────────────────────────────────
// Mother duck and four ducklings in a line. Either the last one stops to chase
// a butterfly and has to sprint to catch up, or the line is in the wrong
// order of size and she waits while they sort themselves out.

const ducks: ActDef = {
  id: 'spring.ducks',
  weight: 2,
  create(stage, rng) {
    const { dir, from } = crossing(stage, rng, 20)
    const shuffle = chance(rng, 0.45)
    const sizes = shuffle ? [0.5, 0.66, 0.42, 0.58] : [0.54, 0.54, 0.54, 0.44]
    // Where each one belongs once sorted, biggest at the front.
    const rank = [2, 0, 3, 1]
    const slot = (i: number) => 19 + i * 12.5
    const yellows = ['#fde047', '#fcd34d', '#fef08a', '#fde047']
    const flutterColor = pick(rng, ['#93c5fd', '#fda4af', '#c4b5fd'])
    const stopAt = stage.w * range(rng, 0.38, 0.5)
    const speed = 50
    let x = from
    let step = 0
    let phase: 'walk' | 'sort' | 'on' = 'walk'
    let pt = 0
    // The dawdler keeps its own position once it peels off.
    let lag: 'in-line' | 'gawp' | 'sprint' | 'back' = 'in-line'
    let lagX = 0
    let lt = 0
    let bump = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        lt += dt
        bump = Math.max(0, bump - dt * 2.5)
        const travelled = dir === 1 ? x : s.w - x
        if (phase === 'walk' && shuffle && travelled > stopAt) {
          phase = 'sort'
          pt = 0
        }
        if (phase === 'sort') {
          if (pt > 3.6) phase = 'on'
        } else {
          x += dir * speed * s.u * dt
          step += dt * 11
        }
        const home = x - dir * slot(3) * s.u
        if (!shuffle) {
          if (lag === 'in-line' && travelled - slot(3) * s.u > stopAt * 0.4) {
            lag = 'gawp'
            lagX = home
            lt = 0
          } else if (lag === 'gawp' && lt > 3.1) {
            lag = 'sprint'
            lt = 0
          } else if (lag === 'sprint') {
            lagX += dir * 205 * s.u * dt
            if (tick(lt, dt, 12)) burst(s, 'dust', lagX - dir * 5 * s.u, s.ground - 2, 1, ['#cbd5e1'], 30, [2, 4])
            if (passed(dir, lagX, home - dir * 2 * s.u)) {
              lag = 'back'
              bump = 1
              burst(s, 'dust', home, s.ground - 2, 4, ['#cbd5e1'], 40, [3, 5])
            }
          }
        }
        const tail = lag === 'gawp' || lag === 'sprint' ? lagX : home
        const exit = dir === 1 ? s.w + 20 * s.u : -20 * s.u
        return !passed(dir, tail, exit)
      },
      draw(s, t) {
        const { ctx } = s
        const sorting = phase === 'sort'
        // Ducklings first, back to front, so the mother overlaps the nearest.
        for (let i = 3; i >= 0; i--) {
          let off = slot(shuffle && phase === 'on' ? rank[i] : i)
          let hop = 0
          let dx = x - dir * off * s.u
          let face: 1 | -1 = dir
          let still = sorting
          let quick = 1
          if (sorting) {
            const p = easeInOut(seg(pt, 0.9 + i * 0.18, 2.1 + i * 0.18))
            off = lerp(slot(i), slot(rank[i]), p)
            hop = Math.sin(p * Math.PI) * (5 + 3.5 * Math.abs(rank[i] - i))
            still = p <= 0 || p >= 1
            dx = x - dir * off * s.u
          }
          if (i === 3 && !shuffle) {
            if (lag === 'gawp') {
              dx = lagX
              still = true
              // Two hopeful jumps at the butterfly.
              hop = lt > 1 && lt < 2.6 ? Math.abs(Math.sin((lt - 1) * 3.9)) * 7 : 0
              face = Math.sin(lt * 2.3) > 0 ? ((-dir) as 1 | -1) : dir
            } else if (lag === 'sprint') {
              dx = lagX
              quick = 2.6
            }
            // Runs into the back of the one in front.
            if (lag === 'back') hop = bump * 3
          }
          if (i === 2 && lag === 'back') hop = Math.sin(bump * Math.PI) * 5
          at(ctx, dx, s.ground - hop * s.u, s.u * sizes[i], face, () => {
            if (hop < 1) groundShadow(ctx, 0, 9)
            drawDuck(ctx, { step: step * quick * 1.25 + i * 1.7, body: yellows[i], wing: '#facc15', fluff: true, still, open: i === 3 && lag === 'sprint' })
          })
          if (i === 3 && lag === 'sprint' && lt < 0.5) at(ctx, dx, s.ground, s.u, 1, () => bubble(ctx, 0, -18, '!', { size: 8, color: C.crimson }))
        }
        if (lag === 'gawp') {
          // The butterfly, looping just out of reach, then away.
          const away = easeIn(seg(lt, 2.5, 3.1))
          ctx.globalAlpha = 1 - away
          at(ctx, lagX + (Math.cos(lt * 2.3) * 9 - dir * away * 30) * s.u, s.ground - (21 + Math.sin(lt * 4.1) * 4 + away * 40) * s.u, s.u * 0.8, 1, () => drawFlutter(ctx, t * 16, flutterColor))
          ctx.globalAlpha = 1
        }
        const looking = sorting && pt > 0.25 && pt < 3.25
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          drawDuck(ctx, { step, body: '#f8fafc', wing: '#e2e8f0', back: looking, still: sorting, open: sorting && pt > 0.4 && pt < 0.9 })
          if (sorting && pt > 2.9) {
            const p = seg(pt, 2.9, 3.6)
            ctx.globalAlpha = 1 - p * p
            heart(ctx, 9, -31 - p * 7, 2.6, C.rose)
            ctx.globalAlpha = 1
          }
        })
        if (sorting && pt > 0.4 && pt < 1.4) at(ctx, x + dir * 8 * s.u, s.ground, s.u, 1, () => bubble(ctx, 0, -30, '?', { size: 9 }))
      },
    })
  },
}

// ─── The mole ────────────────────────────────────────────────────────────────
// A molehill comes up through the floor, then a mole in tiny glasses. He looks
// both ways, goes down, tunnels along and comes up somewhere else: either for
// a wave, or holding somebody's lost golf ball, which he lobs out of the garden.

const mole: ActDef = {
  id: 'spring.mole',
  weight: 2,
  create(stage, rng) {
    const golf = chance(rng, 0.5)
    const x1 = stage.w * range(rng, 0.25, 0.75)
    const hopDir: 1 | -1 = x1 > stage.w / 2 ? -1 : 1
    const x2 = x1 + hopDir * Math.min(range(rng, 85, 130) * stage.u, stage.w * 0.34)
    // Throw towards the nearer edge, so the ball is gone quickly.
    const throwDir: 1 | -1 = x2 > stage.w / 2 ? 1 : -1
    const END = golf ? 10 : 9.6
    const THROW = 6.95
    const MS = 1.35 // the mole is drawn a little over life size so the glasses read
    const ball = { x: 0, y: 0, vx: 0, vy: 0, live: false, gone: !golf }
    const dust = (s: typeof stage, x: number) => burst(s, 'dust', x + range(rng, -9, 9) * s.u, s.ground - 3 * s.u, 1, SOIL_DUST, 40, [2, 4])
    return makeAct({
      update(s, dt, t) {
        if (t < 0.9 && tick(t, dt, 12)) dust(s, x1)
        if (t > 3.4 && t < 4.4 && tick(t, dt, 14)) dust(s, lerp(x1, x2, seg(t, 3.4, 4.4)))
        if (t > 4.3 && t < 5.1 && tick(t, dt, 12)) dust(s, x2)
        if (hit(t, dt, 1.0)) burst(s, 'dust', x1, s.ground - 12 * s.u, 5, SOIL_DUST, 70, [2, 4])
        if (hit(t, dt, 5.2)) burst(s, 'dust', x2, s.ground - 9 * s.u, 5, SOIL_DUST, 70, [2, 4])
        if (golf && hit(t, dt, THROW)) {
          ball.live = true
          ball.x = x2 + throwDir * 8 * MS * s.u
          ball.y = s.ground - 38 * MS * s.u
          ball.vx = throwDir * 250 * s.u
          ball.vy = -255 * s.u
        }
        if (ball.live) {
          ball.vy += 430 * s.u * dt
          ball.x += ball.vx * dt
          ball.y += ball.vy * dt
          if (ball.y > s.ground - 3.2 * s.u && ball.vy > 0) {
            ball.y = s.ground - 3.2 * s.u
            ball.vy *= -0.55
            burst(s, 'dust', ball.x, s.ground - 2, 2, ['#cbd5e1'], 30, [2, 4])
          }
          if (ball.x < -20 || ball.x > s.w + 20) {
            ball.live = false
            ball.gone = true
          }
        }
        return t < END || !ball.gone
      },
      draw(s, t) {
        const { ctx } = s
        const g1 = easeOut(seg(t, 0, 0.9)) * (1 - easeIn(seg(t, 3.5, 4.2)))
        const up1 = easeBack(seg(t, 1.0, 1.35)) * (1 - easeIn(seg(t, 3.1, 3.4)))
        const g2 = easeOut(seg(t, 4.3, 5.1)) * (1 - easeIn(seg(t, END - 0.9, END - 0.2)))
        const up2 = easeBack(seg(t, 5.2, 5.55)) * (1 - easeIn(seg(t, END - 1.4, END - 1.1)))
        const glance = (a: number) => -easeInOut(seg(t, a, a + 0.2)) + 2 * easeInOut(seg(t, a + 0.75, a + 1)) - easeInOut(seg(t, a + 1.5, a + 1.7))
        const pop = (x: number, grow: number, up: number, o: MoleOpts, extra?: () => void) => {
          at(ctx, x, s.ground, s.u * MS, 1, () => {
            if (up > 0.01) {
              ctx.save()
              ctx.beginPath()
              ctx.rect(-40, -90, 80, 90 - 5)
              ctx.clip()
              ctx.translate(0, -5 + (1 - up) * 34)
              drawMole(ctx, o)
              extra?.()
              ctx.restore()
            }
            drawHill(ctx, grow)
          })
        }
        const blink = blinking(s.time, 4)
        pop(x1, g1, up1, { look: glance(1.55), blink })
        // The tunnel: a ripple in the floor heading for the second spot.
        if (t > 3.4 && t < 4.4) {
          const p = seg(t, 3.4, 4.4)
          at(ctx, lerp(x1, x2, p), s.ground, s.u, 1, () => fillEll(ctx, 0, 0, 8, 2.6 * Math.sin(p * Math.PI) + 0.6, SOIL))
        }
        if (!golf) {
          const wave = seg(t, 7.3, 7.6) * (1 - seg(t, 8.3, 8.5))
          pop(x2, g2, up2, {
            look: glance(5.75),
            blink,
            pawR: [lerp(10.5, 14, wave), lerp(-2.5, -20 + Math.sin(t * 14) * 2.4, wave)],
          })
        } else {
          // Ball held overhead, a puzzled look, a wind-up, and away it goes.
          const wind = easeInOut(seg(t, 6.5, 6.85))
          const fling = easeOut(seg(t, THROW - 0.1, THROW + 0.1))
          const held = t < THROW
          const reach = (wind - fling * 2) * -throwDir
          const shade2 = seg(t, 7.3, 7.6) * (1 - seg(t, 8.3, 8.5))
          const bx = reach * 7
          const by = -33 + Math.abs(reach) * 3
          pop(
            x2,
            g2,
            up2,
            {
              look: held ? reach * 0.4 : throwDir * seg(t, THROW, THROW + 0.2) * (1 - seg(t, 8.4, 8.6)),
              blink,
              mouth: held && t > 5.8 ? 'o' : 'smile',
              pawL: held || fling < 1 ? [bx - 5, by + 5.5] : throwDir === -1 ? [lerp(-10.5, -6, shade2), lerp(-2.5, -23.5, shade2)] : undefined,
              pawR: held || fling < 1 ? [bx + 5, by + 5.5] : throwDir === 1 ? [lerp(10.5, 6, shade2), lerp(-2.5, -23.5, shade2)] : undefined,
            },
            () => {
              if (held) drawGolfBall(ctx, bx, by)
            },
          )
          if (up2 > 0.9 && t > 5.8 && t < 6.5) at(ctx, x2, s.ground, s.u, 1, () => bubble(ctx, 16, -56, '?', { size: 9 }))
          if (ball.live) {
            at(ctx, ball.x, ball.y, s.u, 1, () => drawGolfBall(ctx, 0, 0, ball.x * 0.05))
          }
        }
      },
    })
  },
}

// ─── The gardener ────────────────────────────────────────────────────────────
// Dig, seed, water, wait. Nothing in this garden grows at a sensible speed.
// The flower is up and open before the can is empty and gets carried home; or
// it is a sunflower, which keeps going, leans over, and bops her on the head.

const planting: ActDef = {
  id: 'spring.planting',
  weight: 2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 45)
    const sunny = chance(rng, 0.5)
    const kind: Bloom = sunny ? 'sunflower' : pick(rng, ['tulip', 'daisy'] as const)
    const color = sunny ? '#fde047' : kind === 'tulip' ? pick(rng, ['#fb7185', '#f472b6', '#fb923c', '#c084fc']) : '#f8fafc'
    const look: Look = chance(rng, 0.5)
      ? { ...CAST.mum, hat: 'sunhat', hatColor: '#fde9c9', hatTrim: C.rose, apron: '#4ea85a', gloves: '#facc15' }
      : { ...CAST.grandad, apron: '#4ea85a', gloves: '#facc15' }
    const canColor = pick(rng, ['#5eead4', '#7dd3fc', '#fda4af'])
    const FX = 26 // the flower is this far in front of her feet
    const spot = clamp(stage.w * range(rng, 0.35, 0.65), 60 * stage.u, stage.w - 60 * stage.u)
    const standX = spot - dir * FX * stage.u
    const H = 44
    const TALL = 90
    let x = from
    let walk = 0
    let phase: 'in' | 'dig' | 'seed' | 'water' | 'grow' | 'tower' | 'bop' | 'dazed' | 'admire' | 'pick' | 'leave' = 'in'
    let pt = 0
    let h = 0
    let bloom = 0
    let bend = 0
    let mound = 0
    let picked = false
    const next = (p: typeof phase) => {
      phase = p
      pt = 0
    }
    return makeAct({
      update(s, dt) {
        pt += dt
        const go = (speed: number) => {
          x += dir * speed * s.u * dt
          walk += dt * (speed / 6.2)
        }
        if (phase === 'in') {
          go(58)
          if (passed(dir, x, standX)) {
            x = standX
            next('dig')
          }
        } else if (phase === 'dig') {
          mound = seg(pt, 0.2, 1.5)
          if (tick(pt, dt, 4.5)) burst(s, 'dust', spot, s.ground - 3 * s.u, 2, SOIL_DUST, 60, [2, 4])
          if (pt > 1.7) next('seed')
        } else if (phase === 'seed') {
          if (pt > 1) next('water')
        } else if (phase === 'water') {
          if (pt > 0.35 && pt < 1.7 && tick(pt, dt, 16)) {
            s.particles.emit({
              kind: 'drop',
              x: spot - dir * range(rng, 0, 4) * s.u,
              y: s.ground - 19 * s.u,
              vx: dir * range(rng, 0, 16) * s.u,
              vy: range(rng, 10, 40) * s.u,
              g: 300 * s.u,
              size: range(rng, 1.6, 2.4) * s.u,
              color: C.sky,
            })
          }
          // It cannot even wait for her to finish.
          h = easeOut(seg(pt, 1.2, 1.9)) * 5
          if (pt > 1.9) next('grow')
        } else if (phase === 'grow') {
          h = 5 + easeBack(seg(pt, 0.5, 1.15)) * (H - 5)
          bloom = easeBack(seg(pt, 1.25, 1.7))
          if (hit(pt, dt, 1.4)) burst(s, 'spark', spot, s.ground - (H + 5) * s.u, 9, [color, '#ffffff', C.gold], 70, [1.5, 3])
          if (pt > 2.1) next(sunny ? 'tower' : 'admire')
        } else if (phase === 'tower') {
          // Up in three lurches, then a slow lean over the top of her.
          const lurch = (easeBack(seg(pt, 0, 0.4)) + easeBack(seg(pt, 0.7, 1.1)) + easeBack(seg(pt, 1.4, 1.8))) / 3
          h = H + (TALL - H) * lurch
          bend = -easeInOut(seg(pt, 2.3, 3.2)) * 0.82
          if (pt > 3.4) next('bop')
        } else if (phase === 'bop') {
          bend = -0.82 - easeIn(seg(pt, 0, 0.16)) * 0.18
          if (pt > 0.16) {
            burst(s, 'star', x - dir * 1 * s.u, s.ground - 62 * s.u, 7, [C.yellow, C.gold, '#ffffff'], 80, [2.5, 4])
            next('dazed')
          }
        } else if (phase === 'dazed') {
          // Springs upright again, wobbling, looking pleased with itself.
          bend = -(1 - easeOut(seg(pt, 0, 0.5))) + Math.sin(pt * 9) * 0.12 * (1 - seg(pt, 0.3, 1.6))
          if (pt > 2) next('leave')
        } else if (phase === 'admire') {
          if (pt > 1.3) next('pick')
        } else if (phase === 'pick') {
          if (hit(pt, dt, 0.45)) {
            picked = true
            burst(s, 'dust', spot, s.ground - 2 * s.u, 4, SOIL_DUST, 50, [2, 4])
          }
          if (pt > 0.8) next('leave')
        } else {
          go(sunny ? 44 : 58)
          mound = Math.max(0, mound - dt * 1.2)
          const far = Math.abs(x - spot) > Math.min(150 * s.u, s.w * 0.3) || passed(dir, x, to)
          if (sunny) {
            // It watches her go, then slides back into the ground.
            if (h > 0 && far) {
              if (h === TALL) burst(s, 'dust', spot, s.ground - 2 * s.u, 5, SOIL_DUST, 50, [2, 4])
              h = Math.max(0, h - dt * 190)
              bloom = Math.min(1, h / 30)
            } else if (h > 0) bend = clamp((x - spot) / (90 * s.u), -0.5, 0.5) * dir
          }
          return !passed(dir, x, to) || (sunny && h > 0)
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        // Soil and flower sit behind her, at a fixed place on the floor.
        if (!picked) {
          at(ctx, spot, s.ground, s.u, dir, () => {
            if (mound > 0.02) {
              fillEll(ctx, 0, 0, 9 * mound, 3 * mound, SOIL)
              fillEll(ctx, -2, -1, 4 * mound, 1.4 * mound, shade(SOIL, 0.16))
            }
            drawFlower(ctx, kind, h, bloom, color, bend, phase === 'dazed' || phase === 'leave')
          })
        } else if (mound > 0.02) at(ctx, spot, s.ground, s.u, dir, () => fillEll(ctx, 0, 0, 9 * mound, 3 * mound, SOIL))
        at(ctx, x, s.ground, s.u, dir, () => {
          groundShadow(ctx, 0, 11)
          let pose: Pose = { walk, stride: 0.8, armF: 0.5, elbowF: 0.9, armB: 0.15, elbowB: 0.2, mouth: 'smile', blink: blinking(s.time, 6) }
          let can: 'back' | 'pour' | 'none' = 'back'
          let trowel = phase === 'in' || phase === 'dig'
          let tilt = 0
          if (phase === 'dig') {
            const jab = Math.sin(pt * 14)
            pose = { crouch: 0.55, lean: 0.42, armF: 0.95 + jab * 0.22, elbowF: 0.25 - jab * 0.2, armB: 0.2, elbowB: 0.2, mouth: 'flat' }
          } else if (phase === 'seed') {
            pose = { lean: 0.28, crouch: 0.2, armF: 1.35, elbowF: 0.15, armB: 0.15, elbowB: 0.2, mouth: 'smile' }
          } else if (phase === 'water') {
            tilt = easeInOut(seg(pt, 0, 0.35)) * (1 - seg(pt, 1.7, 1.9)) * 0.62
            can = 'pour'
            pose = { lean: 0.12, armF: 1.25, elbowF: 0.55, armB: 0.3, elbowB: 0.3, mouth: pt > 1.3 ? 'o' : 'smile', eyes: pt > 1.3 ? 'wide' : 'normal' }
          } else if (phase === 'grow') {
            const back = seg(pt, 0.5, 0.7)
            pose = { lean: lerp(0.3, -0.2, back), armF: lerp(0.4, 2.3, back), elbowF: 0.4, armB: 0.15, elbowB: 0.2, mouth: back ? 'o' : 'flat', eyes: back ? 'wide' : 'normal' }
            if (pt > 1.5) pose = { armF: 2.8, elbowF: -0.2, armB: 0.15, elbowB: 0.2, mouth: 'grin', lift: Math.abs(Math.sin(pt * 10)) * 2.5 }
          } else if (phase === 'tower') {
            pose = { lean: -0.16, headTilt: -0.3, armF: 0.3, armB: 0.15, elbowB: 0.2, mouth: 'o', eyes: 'wide' }
          } else if (phase === 'bop') {
            pose = { crouch: 0.35, headTilt: 0.1, armF: 0.3, armB: 0.15, elbowB: 0.2, mouth: 'o', eyes: 'closed' }
          } else if (phase === 'dazed') {
            const sq = 1 - easeOut(seg(pt, 0, 0.5))
            pose = { crouch: 0.2 + sq * 0.4, lean: Math.sin(pt * 5) * 0.07, headTilt: Math.sin(pt * 5 + 1) * 0.12, armF: 0.2, armB: 0.15, elbowB: 0.2, mouth: 'puff', eyes: 'closed' }
          } else if (phase === 'admire') {
            pose = { armF: 2.4, armB: 0.15, elbowF: 1.2, elbowB: 0.2, mouth: 'grin', eyes: 'closed', headTilt: 0.08 }
          } else if (phase === 'pick') {
            const r = Math.sin(seg(pt, 0, 0.8) * Math.PI)
            pose = { lean: 0.5 * r, crouch: 0.3 * r, armF: lerp(1, 1.5, r), elbowF: 0.12, armB: 0.15, elbowB: 0.2, mouth: 'smile' }
          } else if (phase === 'leave') {
            pose = sunny
              ? { walk, stride: 0.6, armF: 2.75, elbowF: 1.7, armB: 0.15, elbowB: 0.2, mouth: 'frown', headTilt: 0.1 }
              : { walk, stride: 0.8, armF: 1.3, elbowF: 0.5, armB: 0.15, elbowB: 0.2, mouth: 'grin' }
          }
          const a = drawPerson(ctx, look, pose, (b) => {
            if (can !== 'back') return
            ctx.save()
            ctx.translate(b.handB.x, b.handB.y)
            drawCan(ctx, 0.1 + Math.sin(walk) * 0.06, canColor)
            ctx.restore()
          })
          if (can === 'pour') {
            ctx.save()
            ctx.translate(a.handF.x, a.handF.y)
            drawCan(ctx, tilt, canColor)
            ctx.restore()
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, look.gloves ?? look.skin)
          }
          if (trowel) {
            // Trowel: wooden grip, steel blade pointing at the ground.
            const ang = phase === 'dig' ? 0.75 : 0.2
            ctx.save()
            ctx.translate(a.handF.x, a.handF.y)
            ctx.rotate(ang)
            line(ctx, 0, -2, 0, 3, 2, C.wood)
            fillPoly(ctx, [-2.2, 3, 2.2, 3, 1.4, 9, 0, 10.5, -1.4, 9], '#cbd5e1')
            ctx.restore()
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, look.gloves ?? look.skin)
            trowel = false
          }
          if (phase === 'seed') {
            const p = seg(pt, 0.35, 0.85)
            if (p < 1) fillEll(ctx, lerp(a.handF.x, FX, p), lerp(a.handF.y + 2, -2, p * p), 1.3, 1.8, '#d6b98a', p * 5)
          }
          if (phase === 'grow' && pt < 0.5) bubble(ctx, a.head.x, a.head.y - 18, '...', { size: 9 })
          if (phase === 'admire') heart(ctx, a.head.x + 4, a.head.y - 20 - pt * 4, 3, C.rose)
          if (phase === 'dazed') {
            // Three stars going round her head.
            for (let i = 0; i < 3; i++) {
              const an = t * 5 + (i * TAU) / 3
              star(ctx, a.head.x + Math.cos(an) * 12, a.crown.y - 3 + Math.sin(an) * 3, 2.4, i === 1 ? '#ffffff' : C.yellow, an)
            }
          }
          if (picked) {
            // Carried off like a flag, stem and all.
            ctx.save()
            ctx.translate(a.handF.x, a.handF.y + 14)
            drawFlower(ctx, kind, H * 0.8, 1, color, Math.sin(walk * 2) * 0.12)
            ctx.restore()
            fillCirc(ctx, a.handF.x, a.handF.y, 2.6, look.gloves ?? look.skin)
          }
        })
      },
    })
  },
}

// ─── The bunny ───────────────────────────────────────────────────────────────
// Hops on, sits up, and gives its ears a thorough wash. Or hears something,
// freezes with both ears up, thumps a foot and bolts. Sometimes a kit follows
// and copies everything half a second late.

const bunny: ActDef = {
  id: 'spring.bunny',
  weight: 1.5,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 45)
    const gag = chance(rng, 0.55) ? 'wash' : 'alert'
    const kit = chance(rng, 0.5)
    const coat = pick(rng, ['#d6c3a5', '#cbd5e1', '#c8a06a', '#f1f5f9'])
    const spot = stage.w * range(rng, 0.4, 0.6)
    const GAP = 26
    const SIT = gag === 'wash' ? 4 : 2.6
    let x = from
    let hop = 0
    let phase: 'in' | 'sit' | 'out' = 'in'
    let pt = 0
    return makeAct({
      update(s, dt) {
        pt += dt
        const fast = phase === 'out' && gag === 'alert'
        if (phase === 'in' || phase === 'out') {
          const was = hop
          hop = (hop + dt * (fast ? 4.2 : 2.5)) % 1
          x += dir * (fast ? 190 : 72) * s.u * dt
          if (fast && hop < was) burst(s, 'dust', x - dir * 8 * s.u, s.ground - 2, 2, ['#cbd5e1'], 40, [2, 4])
        }
        if (phase === 'in' && passed(dir, x, spot)) {
          phase = 'sit'
          pt = 0
          hop = 0
        } else if (phase === 'sit') {
          // A warning thump of the back foot before running for it.
          if (gag === 'alert' && (hit(pt, dt, 1.9) || hit(pt, dt, 2.2))) burst(s, 'dust', x - dir * 4 * s.u, s.ground - 2, 3, ['#cbd5e1'], 45, [2, 4])
          if (pt > SIT) {
            phase = 'out'
            pt = 0
          }
        } else if (phase === 'out') return !passed(dir, x - dir * (kit ? GAP : 0) * s.u, to)
        return true
      },
      draw(s, t) {
        const { ctx } = s
        const sitting = phase === 'sit'
        const one = (bx: number, scale: number, delay: number, seed: number) => {
          const st = pt - delay
          const sat = sitting && st > 0
          const washing = sat && gag === 'wash' && st > 0.5 && st < SIT - 0.7 - delay
          const alert = sat && gag === 'alert'
          const face: 1 | -1 = alert && st > 0.7 && st < 1.7 ? ((-dir) as 1 | -1) : dir
          const thump = alert && st > 1.8 && st < 2.4 ? Math.abs(Math.sin((st - 1.8) * 10.5)) * 1.6 : 0
          at(ctx, bx, s.ground - thump * s.u, s.u * scale, face, () => {
            groundShadow(ctx, 0, 11)
            drawBunny(ctx, { hop: sitting && !sat ? 0 : hop, sit: sat, wash: washing ? st * 9 : undefined, alert, coat, blink: blinking(s.time, seed) })
            if (phase === 'out' && gag === 'alert') speedLines(ctx, -16, -10, 12, t)
          })
          if (alert && st > 0.15 && st < 0.9) at(ctx, bx, s.ground, s.u, 1, () => bubble(ctx, 0, -38 * scale, '!', { size: 9, color: C.crimson }))
        }
        if (kit) one(x - dir * GAP * s.u, 0.6, 0.45, 8)
        one(x, 1, 0, 7)
      },
    })
  },
}

// ─── The bumblebee ───────────────────────────────────────────────────────────
// Two daisies come up, and a bee far too heavy for either of them bumbles
// across at head height to visit both. The second one either gives way under
// it or makes it sneeze.

const bee: ActDef = {
  id: 'spring.bee',
  weight: 1.2,
  create(stage, rng) {
    const { dir, from, to } = crossing(stage, rng, 20)
    const gag = chance(rng, 0.5) ? 'sneeze' : 'sag'
    const mid = stage.w * range(rng, 0.42, 0.58)
    const gap = Math.min(70 * stage.u, stage.w * 0.2)
    const fx = [mid - dir * gap, mid + dir * gap]
    const fh = [range(rng, 24, 30), range(rng, 26, 32)]
    const colors = [pick(rng, ['#f8fafc', '#fbcfe8']), pick(rng, ['#f8fafc', '#fde68a'])]
    const CRUISE = 54
    // Waypoints in px and units-above-floor; `sit` seconds spent on a flower.
    const path = [
      { x: fx[0], y: CRUISE, sit: 0, on: -1 },
      { x: fx[0], y: 0, sit: 1.5, on: 0 },
      { x: fx[0] + dir * gap, y: CRUISE - 8, sit: 0, on: -1 },
      { x: fx[1], y: 0, sit: 2.4, on: 1 },
      { x: fx[1] + dir * 30 * stage.u, y: CRUISE, sit: 0, on: -1 },
      { x: to, y: CRUISE - 6, sit: 0, on: -1 },
    ]
    let bx = from
    let by = CRUISE
    let leg = 0
    let sat = -1 // seconds sat on the current flower, -1 when flying
    let gone = [0, 0] // seconds since the bee left each flower, 0 = not yet
    let sag = [0, 0]
    let reel = 0 // seconds left tumbling after the sneeze
    return makeAct({
      update(s, dt, t) {
        for (let i = 0; i < 2; i++) if (gone[i] > 0) gone[i] += dt
        if (reel > 0) {
          reel -= dt
          bx -= dir * 60 * s.u * dt * clamp(reel)
          by += 50 * dt * clamp(reel)
          return true
        }
        const wp = path[leg]
        // Gone, but wait for the second daisy to finish tucking itself away.
        if (!wp) return gone[1] < 1.9
        const on = wp.on
        if (sat >= 0) {
          sat += dt
          const heavy = on === 1 && gag === 'sag'
          sag[on] = heavy ? 0.3 + easeIn(seg(sat, 0.5, 1.7)) * 0.7 : easeOut(seg(sat, 0, 0.3)) * 0.3
          const tip = stemTip(fh[on], dir * sag[on])
          bx = fx[on] + dir * tip.x * s.u * dir
          by = -tip.y + 7
          if (tick(t, dt, 5)) burst(s, 'spark', bx, s.ground - (by - 3) * s.u, 1, [C.yellow, C.gold], 25, [1, 2])
          if (on === 1 && gag === 'sneeze' && hit(sat, dt, 1.5)) {
            // Pollen up the nose.
            burst(s, 'dust', bx + dir * 5 * s.u, s.ground - by * s.u, 9, ['#fde047', '#fef08a'], 80, [2, 5])
            reel = 1.1
            sat = wp.sit
          }
          if (sat >= wp.sit) {
            sat = -1
            gone[on] = 0.001
            leg++
          }
          return true
        }
        const ty = on >= 0 ? -stemTip(fh[on], 0).y + 7 : wp.y
        const dx = wp.x - bx
        const dy = ty * s.u - by * s.u
        const d = Math.hypot(dx, dy)
        const v = (on >= 0 ? 48 : 78) * s.u * dt
        if (d <= v + 1) {
          bx = wp.x
          by = ty
          if (wp.sit > 0) sat = 0
          else leg++
        } else {
          bx += (dx / d) * v
          by += ((dy / d) * v) / s.u
        }
        return true
      },
      draw(s, t) {
        const { ctx } = s
        for (let i = 0; i < 2; i++) {
          // Up as the bee arrives on stage, back down a moment after it leaves.
          const grow = easeBack(seg(t, 0.2 + i * 0.5, 0.9 + i * 0.5)) * (1 - easeIn(seg(gone[i], 1.2, 1.8)))
          // Let go of, the stem springs back and shivers.
          const spring = gone[i] > 0 ? Math.cos(gone[i] * 16) * Math.exp(-gone[i] * 4) * sag[i] : sag[i]
          at(ctx, fx[i], s.ground, s.u, dir, () => drawFlower(ctx, 'daisy', fh[i] * grow, clamp(grow), colors[i], spring))
        }
        const flying = sat < 0
        const wob = flying && reel <= 0 ? 1 : 0
        const spinning = reel > 0.35
        at(
          ctx,
          bx + Math.sin(t * 5.3) * 3 * wob * s.u,
          s.ground - (by + Math.sin(t * 7.1) * 3.5 * wob) * s.u,
          s.u * 0.85,
          dir,
          () => drawBee(ctx, flying ? t * 60 : t * 9, reel > 0),
          spinning ? -dir * (1.1 - reel) * 12 : flying ? Math.sin(t * 5.3) * 0.15 : 0,
        )
      },
    })
  },
}

export const SPRING_ACTS: ActDef[] = [mower, ducks, mole, planting, bunny, bee]
