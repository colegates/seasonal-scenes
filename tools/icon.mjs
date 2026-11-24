// Draw the project icon and social preview from a real act, so the artwork is
// the card's own. usage: node tools/icon.mjs <out dir> [--t 7.5] [--seed 3]
import CanvasKitInit from 'canvaskit-wasm'
import * as esbuild from 'esbuild-wasm'
import fs from 'fs'
import os from 'os'
import path from 'path'

const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const outDir = path.resolve(argv[0] || 'docs/images')
const root = path.resolve(new URL('..', import.meta.url).pathname)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssc-icon-'))
const entry = path.join(tmp, 'e.ts')
fs.writeFileSync(entry, `export { AUTUMN_ACTS, AUTUMN_AMBIENT } from '${root}/src/scenes/acts/autumn'
export { ParticleField } from '${root}/src/scenes/particles'
export { mulberry32 } from '${root}/src/scenes/rng'\n`)
await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: path.join(tmp, 'b.mjs'), platform: 'neutral', logLevel: 'error' })
const B = await import(path.join(tmp, 'b.mjs'))
const CK = await CanvasKitInit()

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Run the leaf blower on a stage of the given size and draw the frame at time `at`. */
function scene(ctx, W, H, u, at, seed, ground, tile, dx = 0) {
  const field = new B.ParticleField()
  field.resize(W, ground, u)
  field.configure(B.AUTUMN_AMBIENT)
  field.prefill(0.95, B.AUTUMN_AMBIENT, B.mulberry32(seed + 5))
  const rng = B.mulberry32(seed)
  Math.random = B.mulberry32(seed + 99)
  const def = B.AUTUMN_ACTS.find((a) => a.id === 'autumn.leaf-blower')
  const context = { year: 2026, month: 10, day: 20, minutes: 900, season: 'autumn', dayPart: 'afternoon', holidays: [], adventDay: 0, birthdayNames: [], birthdayTomorrow: [], house: {} }
  let time = 0
  const stage = () => ({ ctx, w: W, h: H, ground, u, time, particles: field, context })
  const act = def.create(stage(), rng)
  for (let t = 0; t < at; t += 1 / 30) {
    time = t
    act.update(stage(), 1 / 30)
    field.update(1 / 30)
  }
  tile()
  ctx.save()
  ctx.translate(dx, 0)
  field.drawPile(ctx)
  ctx.save()
  act.draw(stage())
  ctx.restore()
  ctx.globalAlpha = 1
  field.draw(ctx)
  ctx.restore()
}

function backdrop(ctx, W, H, ground) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#173b6b')
  g.addColorStop(0.55, '#3f78b0')
  g.addColorStop(1, '#e9a77a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // A low autumn sun.
  const sx = W * 0.8, sy = ground - H * 0.5, sr = H * 0.075
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.6)
  glow.addColorStop(0, 'rgba(253,230,138,0.55)')
  glow.addColorStop(1, 'rgba(253,230,138,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  const disc = ctx.createRadialGradient(sx, sy - sr * 0.3, sr * 0.1, sx, sy, sr)
  disc.addColorStop(0, '#fff3c4')
  disc.addColorStop(1, '#fbbf24')
  ctx.fillStyle = disc
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
  // Rolling hill behind, ground in front.
  ctx.fillStyle = '#5b6b38'
  ctx.beginPath(); ctx.moveTo(0, ground - H * 0.06)
  ctx.quadraticCurveTo(W * 0.3, ground - H * 0.16, W * 0.62, ground - H * 0.07)
  ctx.quadraticCurveTo(W * 0.85, ground - H * 0.02, W, ground - H * 0.08)
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#6b5a33'
  ctx.fillRect(0, ground, W, H - ground)
}

const save = (canvas, name) => {
  fs.mkdirSync(outDir, { recursive: true })
  const file = path.join(outDir, name)
  fs.writeFileSync(file, Buffer.from(canvas.toDataURL().split(',')[1], 'base64'))
  console.log('wrote', file)
}

// The icon: a rounded tile, the blower mid-blast, leaves in the air.
{
  const S = 512
  const canvas = CK.MakeCanvas(S, S)
  const ctx = canvas.getContext('2d')
  const ground = S * 0.8
  ctx.save()
  roundRect(ctx, 0, 0, S, S, S * 0.2)
  ctx.clip()
  scene(ctx, S, S, 3.1, +opt('t', 4), +opt('seed', 4), ground, () => backdrop(ctx, S, S, ground), +opt('dx', 60))
  ctx.restore()
  save(canvas, opt('name', 'icon.png'))
}

// The social preview GitHub shows when the repo link is shared: 1280x640.
if (!argv.includes('--icon-only')) {
  const W = 1280, H = 640
  const canvas = CK.MakeCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const ground = H * 0.82
  const font = opt('font', null)
  // The acts' speech bubbles ask for Inter; any font will do.
  if (font) canvas.loadFont(fs.readFileSync(font), { family: 'Inter', style: 'normal', weight: '700' })
  scene(ctx, W, H, 3.2, +opt('social-t', 4.6), +opt('seed', 4), ground, () => backdrop(ctx, W, H, ground), +opt('social-dx', 330))
  // Title, if a font was given (canvas text needs one loaded explicitly).
  if (font) {
    canvas.loadFont(fs.readFileSync(font), { family: 'Title', style: 'normal', weight: '600' })
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(8,19,37,0.35)'
    ctx.font = '600 92px Title'
    ctx.fillText('Seasonal Scenes', 76, 196)
    ctx.fillStyle = '#fff7e0'
    ctx.strokeStyle = '#fff7e0'
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.strokeText('Seasonal Scenes', 72, 190)
    ctx.fillText('Seasonal Scenes', 72, 190)
    ctx.font = '400 36px Title'
    ctx.fillStyle = '#dbeafe'
    ctx.strokeStyle = '#dbeafe'
    ctx.lineWidth = 1.2
    ctx.strokeText('Little animated characters for', 76, 252)
    ctx.strokeText('your Home Assistant dashboard', 76, 296)
    ctx.fillText('Little animated characters for', 76, 252)
    ctx.fillText('your Home Assistant dashboard', 76, 296)
  }
  save(canvas, 'social-preview.png')
}
