// Simulate every act at wall-panel, phone and desktop sizes over a few seeds
// and report anything suspicious: never ends, throws, draws nothing, left
// something behind, flies too high for too long, too wide for a phone...
// usage: SEEDS=1,2,3 node tools/lint.mjs [id filter]
// Exits 1 on hard failures (throws, never ends, draws nothing); the rest are
// warnings to look at with tools/preview.mjs.
import CanvasKitInit from 'canvaskit-wasm'
import * as esbuild from 'esbuild-wasm'
import fs from 'fs'
import path from 'path'
import os from 'os'
const filter = process.argv[2] || ''
const SRC = path.resolve(new URL('../src/scenes', import.meta.url).pathname)
const files = fs.readdirSync(SRC + '/acts').filter(f => f.endsWith('.ts'))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-'))
const entry = path.join(tmp, 'entry.ts')
fs.writeFileSync(entry, files.map((f, i) => `export * as F${i} from '${SRC}/acts/${f}'`).join('\n') + `\nexport { ParticleField } from '${SRC}/particles'\nexport { mulberry32 } from '${SRC}/rng'\n`)
const out = path.join(tmp, 'b.mjs')
await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: out, platform: 'neutral', logLevel: 'error' })
const B = await import(out)
const CK = await CanvasKitInit()
const SIZES = [[1024, 532, 'kiosk'], [390, 764, 'phone'], [1600, 900, 'wide']]
const SEEDS = (process.env.SEEDS || "1,2,3").split(",").map(Number)
const SCALE = 0.25
const SMW = Math.ceil(1600 * SCALE), SMH = Math.ceil(900 * SCALE)
const small = CK.MakeCanvas(SMW, SMH)
const sctx = small.getContext('2d')
let autumnAmb
for (let i = 0; i < files.length; i++) if (B[`F${i}`].AUTUMN_AMBIENT) autumnAmb = B[`F${i}`].AUTUMN_AMBIENT
const rows = []
for (let i = 0; i < files.length; i++) {
  const mod = B[`F${i}`]
  const amb = Object.entries(mod).find(([k, v]) => k.endsWith('_AMBIENT') && v && v.settle)?.[1] ?? autumnAmb
  for (const [ex, arr] of Object.entries(mod)) {
    if (!ex.endsWith('_ACTS')) continue
    for (const def of arr) {
      if (filter && !def.id.includes(filter)) continue
      const res = { id: def.id, file: files[i], issues: [], dur: {}, maxH: 0, highS: 0, phoneSpan: 0, peakP: 0, firstSeen: 0, clear: '' }
      for (const [W, H, label] of SIZES) for (const seed of SEEDS) {
        const u = W >= 1100 && H >= 700 ? 1.2 : 1
        const field = new B.ParticleField()
        field.resize(W, H, u)
        const rng = B.mulberry32(seed); Math.random = B.mulberry32(seed + 7)
        let before = 0
        if (def.clears && label === 'kiosk') { field.configure(amb); field.prefill(0.9, amb, B.mulberry32(5)); before = field.fullness() }
        const context = { year: 2026, month: 12, day: 20, minutes: 900, season: 'winter', dayPart: 'afternoon', holidays: ['christmas'], adventDay: 20, birthdayNames: ['Ada'], birthdayTomorrow: ['Ben'], house: { weather: 'rainy', binDay: 'recycling', kilnFiring: true } }
        let time = 0
        const stage = (ctx) => ({ ctx, w: W, h: H, ground: H, u, time, particles: field, context })
        let act
        try { act = def.create(stage(sctx), rng) } catch (e) { res.issues.push(`create throws (${label}): ${e.message}`); continue }
        const dt = 1 / 30
        let t = 0, ended = null, lastBox = null, seenAt = null, high = 0, everDrawn = false
        try {
          for (; t < 180; t += dt) {
            time = t
            if (!act.update(stage(sctx), dt)) { ended = t; break }
            field.update(dt)
            res.peakP = Math.max(res.peakP, field.list.length)
            const sample = Math.floor(t * 4) !== Math.floor((t - dt) * 4)
            if (sample) {
              sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, SMW, SMH)
              sctx.save(); sctx.scale(SCALE, SCALE); act.draw(stage(sctx)); sctx.restore(); sctx.globalAlpha = 1
              const sw = Math.ceil(W * SCALE), sh = Math.ceil(H * SCALE)
              const d = sctx.getImageData(0, 0, sw, sh).data
              let x0 = 1e9, x1 = -1, y0 = 1e9
              for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (d[(y * sw + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y }
              if (x1 >= 0) {
                everDrawn = true
                if (seenAt === null) seenAt = t
                const hAbove = (sh - y0) / SCALE / u
                res.maxH = Math.max(res.maxH, Math.round(hAbove))
                if (hAbove > 175) high += 0.25
                if (label === 'phone') res.phoneSpan = Math.max(res.phoneSpan, Math.round((x1 - x0) / SCALE))
                lastBox = [x0, x1]
              } else lastBox = null
            }
          }
        } catch (e) { res.issues.push(`throws at ${t.toFixed(1)}s (${label} s${seed}): ${e.message}`); continue }
        if (ended === null) res.issues.push(`never ends (${label} s${seed})`)
        else {
          (res.dur[label] ??= []).push(+ended.toFixed(1))
          // what is still drawn on the very last frame?
          sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, SMW, SMH)
          try { sctx.save(); sctx.scale(SCALE, SCALE); act.draw(stage(sctx)); sctx.restore() } catch {}
          const sw = Math.ceil(W * SCALE), sh = Math.ceil(H * SCALE)
          const d = sctx.getImageData(0, 0, sw, sh).data
          let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 24) n++
          if (n > 6) { res.issues.push(`still visible when it ends (${label} s${seed}, ${n} px)`); }
        }
        if (!everDrawn) res.issues.push(`draws nothing (${label} s${seed})`)
        res.highS = Math.max(res.highS, high)
        res.firstSeen = Math.max(res.firstSeen, seenAt ?? 0)
        if (def.clears && label === 'kiosk') res.clear = `${before.toFixed(2)}->${field.fullness().toFixed(2)}`
      }
      rows.push(res)
    }
  }
}
const avg = a => a ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : NaN
console.log('id | kiosk s | phone s | wide s | maxH | >175 s | phone span | peak parts | 1st seen | clears | issues')
for (const r of rows) {
  const k = avg(r.dur.kiosk), p = avg(r.dur.phone), w = avg(r.dur.wide)
  if (k && w && w < k * 0.75) r.issues.push(`faster on wide screens (${k}s vs ${w}s)`)
  if (k && k < 6) r.issues.push('very short')
  if (k > 50) r.issues.push('long')
  if (r.highS > 4) r.issues.push(`high up for ${r.highS}s`)
  if (r.phoneSpan > 360) r.issues.push(`wide on phone ${r.phoneSpan}px`)
  if (r.peakP > 140) r.issues.push(`peak particles ${r.peakP}`)
  if (r.firstSeen > 5) r.issues.push(`empty for first ${r.firstSeen.toFixed(1)}s`)
  if (r.clear && +r.clear.split('->')[1] > 0.35) r.issues.push(`does not clear the pile (${r.clear})`)
  console.log([r.id, k, p, w, r.maxH, r.highS, r.phoneSpan, r.peakP, r.firstSeen.toFixed(1), r.clear, r.issues.join('; ') || 'ok'].join(' | '))
}
const hard = rows.filter((r) => r.issues.some((i) => /throws|never ends|draws nothing/.test(i)))
console.log(`\n${rows.length} acts, ${hard.length} with hard failures`)
process.exit(hard.length ? 1 : 0)
