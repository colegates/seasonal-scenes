// Render one act as a contact sheet of frames, so you can see it without a
// browser. usage:
//   node tools/preview.mjs <act id> [--times 1,3,5,8] [--every 2 --count 8]
//     [--w 1024] [--h 240] [--strip 200] [--seed 1] [--scale 1]
//     [--bg sky|navy|#rrggbb] [--daypart afternoon] [--season autumn]
//     [--ambient AUTUMN_AMBIENT --fill 0.8] [--names Ada,Ben] [--out act.png]
// List every act id with: node tools/preview.mjs --list
import CanvasKitInit from 'canvaskit-wasm'
import * as esbuild from 'esbuild-wasm'
import fs from 'fs'
import os from 'os'
import path from 'path'

const argv = process.argv.slice(2)
const opt = (k, d) => {
  const i = argv.indexOf('--' + k)
  return i >= 0 ? argv[i + 1] : d
}
const root = path.resolve(new URL('..', import.meta.url).pathname)
const SRC = path.join(root, 'src/scenes')
const files = fs.readdirSync(path.join(SRC, 'acts')).filter((f) => f.endsWith('.ts'))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssc-preview-'))
const entry = path.join(tmp, 'entry.ts')
fs.writeFileSync(
  entry,
  files.map((f, i) => `export * as F${i} from '${SRC}/acts/${f}'`).join('\n') +
    `\nexport { ParticleField } from '${SRC}/particles'\nexport { mulberry32 } from '${SRC}/rng'\nexport { backdropColors, GROUND_PX } from '${root}/src/sky'\n`,
)
const outJs = path.join(tmp, 'bundle.mjs')
await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: outJs, platform: 'neutral', logLevel: 'warning' })
const B = await import(outJs)
const mods = files.map((_, i) => B[`F${i}`])
const acts = mods.flatMap((m) => Object.entries(m).filter(([k]) => k.endsWith('_ACTS')).flatMap(([, v]) => v))
if (argv[0] === '--list' || !argv[0]) {
  console.log(acts.map((a) => a.id).join('\n'))
  process.exit(0)
}
const actId = argv[0]
const def = acts.find((a) => a.id === actId)
if (!def) {
  console.error(`No act '${actId}'. Run with --list to see them all.`)
  process.exit(1)
}

const W = +opt('w', 1024)
const H = +opt('h', 240)
const strip = Math.min(H, +opt('strip', H))
const seed = +opt('seed', 1)
const daypart = opt('daypart', 'afternoon')
const season = opt('season', 'autumn')
const bg = opt('bg', 'sky')
const sky = bg === 'sky'
const inset = sky ? B.GROUND_PX : 0
const u = (W >= 1100 && H >= 700 ? 1.2 : 1) * +opt('scale', 1)
const rng = B.mulberry32(seed)
Math.random = B.mulberry32(seed + 99)
let times = opt('times', null)
times = times ? times.split(',').map(Number) : Array.from({ length: +opt('count', 6) }, (_, i) => (i + 0.5) * +opt('every', 2.5))

const CK = await CanvasKitInit()
const canvas = CK.MakeCanvas(W, strip * times.length)
const ctx = canvas.getContext('2d')
const field = new B.ParticleField()
const ground = H - inset
field.resize(W, ground, u)
const ambientName = opt('ambient', null)
if (ambientName) {
  const amb = mods.map((m) => m[ambientName]).find(Boolean)
  if (!amb) throw new Error(`No ambient export '${ambientName}'`)
  field.configure(amb)
  field.prefill(+opt('fill', 0.7), amb, rng)
}
const names = (opt('names', '') || '').split(',').filter(Boolean)
const context = {
  year: 2026, month: +opt('month', 11), day: +opt('day', 23), minutes: +opt('minutes', 600), season, dayPart: daypart,
  holidays: (opt('holidays', '') || '').split(',').filter(Boolean), adventDay: +opt('advent', 0),
  birthdayNames: names, birthdayTomorrow: [], house: { weather: opt('weather', undefined), binDay: opt('bin', undefined), kilnFiring: true },
}
let time = 0
const stage = () => ({ ctx, w: W, h: H, ground, u, time, particles: field, context })
const act = def.create(stage(), rng)
const dt = 1 / 30
let alive = true
let ended = null
let fi = 0
const last = Math.max(...times)

function backdrop(y0) {
  if (sky) {
    const [top, bottom, earth] = B.backdropColors(daypart, season, actId.split('.')[0])
    const g = ctx.createLinearGradient(0, y0, 0, y0 + H)
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    ctx.fillStyle = g
    ctx.fillRect(0, y0, W, H)
    ctx.fillStyle = earth
    ctx.fillRect(0, y0 + ground, W, inset + 1)
  } else {
    ctx.fillStyle = bg === 'navy' ? '#0a1929' : bg
    ctx.fillRect(0, y0, W, H)
  }
}

for (let t = 0; t <= last + 1e-6 && fi < times.length; t += dt) {
  time = t
  if (alive) {
    alive = act.update(stage(), dt)
    if (!alive) ended = t
  }
  field.update(dt)
  if (t + dt > times[fi]) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, fi * strip, W, strip)
    ctx.clip()
    // Paint the backdrop before translating: CanvasKit gradients ignore the transform.
    backdrop(fi * strip - (H - strip))
    ctx.translate(0, fi * strip - (H - strip))
    field.drawPile(ctx)
    if (alive) {
      ctx.save()
      act.draw(stage())
      ctx.restore()
      ctx.globalAlpha = 1
    }
    field.draw(ctx)
    ctx.restore()
    fi++
  }
}
for (let t = last; alive && t < 180; t += dt) {
  time = t
  alive = act.update(stage(), dt)
  field.update(dt)
  if (!alive) ended = t
}
const out = path.resolve(opt('out', actId.replace(/[^a-z0-9]+/gi, '_') + '.png'))
fs.writeFileSync(out, Buffer.from(canvas.toDataURL().split(',')[1], 'base64'))
console.log(`wrote ${out}  frames at t=${times.join(',')}s  act ${ended === null ? 'still running after 180s (bug?)' : 'ended at ' + ended.toFixed(1) + 's'}`)
