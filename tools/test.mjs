// Smoke tests: the calendar, the programme, and the card's lifecycle in a fake
// DOM with a fake Home Assistant. usage: node tools/test.mjs
import * as esbuild from 'esbuild-wasm'
import { parseHTML } from 'linkedom'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssc-test-'))
const root = path.resolve(new URL('..', import.meta.url).pathname)
const bundle = async (entry, name) => {
  const out = path.join(tmp, name)
  await esbuild.build({ entryPoints: [path.join(root, entry)], bundle: true, format: 'esm', outfile: out, platform: 'neutral', logLevel: 'error', define: { __VERSION__: '"test"' } })
  return out
}

let failed = 0
const test = async (name, fn) => {
  try {
    await fn()
    console.log(`ok   ${name}`)
  } catch (e) {
    failed++
    console.log(`FAIL ${name}\n     ${e.stack.split('\n').slice(0, 3).join('\n     ')}`)
  }
}

// --- calendar and programme -------------------------------------------------
fs.writeFileSync(path.join(tmp, 'pure.ts'), `
export * from '${root}/src/scenes/calendar'
export * from '${root}/src/programme'
`)
const pureOut = path.join(tmp, 'pure.mjs')
await esbuild.build({ entryPoints: [path.join(tmp, 'pure.ts')], bundle: true, format: 'esm', outfile: pureOut, platform: 'neutral', logLevel: 'error' })
const P = await import(pureOut)

await test('season and holidays in the north', () => {
  const c = P.buildContext([], {}, new Date('2026-12-20T12:00:00Z'), { timeZone: 'Europe/London' })
  assert.equal(c.season, 'winter')
  assert.ok(c.holidays.includes('christmas'))
  assert.equal(c.adventDay, 20)
})
await test('southern hemisphere flips the season', () => {
  const c = P.buildContext([], {}, new Date('2026-12-20T02:00:00Z'), { timeZone: 'Australia/Sydney', south: true })
  assert.equal(c.season, 'summer')
  assert.ok(c.holidays.includes('christmas'), 'Christmas is still Christmas')
})
await test('time zone decides the date', () => {
  const at = new Date('2026-10-31T23:30:00Z')
  assert.equal(P.buildContext([], {}, at, { timeZone: 'Europe/London' }).day, 31)
  assert.equal(P.buildContext([], {}, at, { timeZone: 'Asia/Tokyo' }).day, 1)
})
await test('a bad time zone falls back instead of throwing', () => {
  P.buildContext([], {}, new Date(), { timeZone: 'Not/AZone' })
})
await test('holidays can be switched off', () => {
  const c = P.buildContext([], {}, new Date('2026-11-05T19:00:00Z'), { timeZone: 'Europe/London', holidays: ['christmas'] })
  assert.deepEqual(c.holidays, [])
  const d = P.buildContext([], {}, new Date('2026-11-05T19:00:00Z'), { timeZone: 'Europe/London' })
  assert.deepEqual(d.holidays, ['bonfire'])
})
await test('birthdays parse, including leap-day birthdays', () => {
  const b = P.parseBirthdays('Ada:03-14; Ben : 02-29;bad;Cleo=12-01')
  assert.deepEqual(b.map((x) => x.name), ['Ada', 'Ben', 'Cleo'])
  const c = P.buildContext(b, {}, new Date('2027-02-28T12:00:00Z'), { timeZone: 'UTC' })
  assert.deepEqual(c.birthdayNames, ['Ben'])
  assert.equal(P.serialiseBirthdays(b), 'Ada:03-14;Ben:02-29;Cleo:12-01')
})
await test('hobbies filter the programme', () => {
  const all = P.programme().map((t) => t.id)
  const some = P.programme(['golf']).map((t) => t.id)
  for (const h of P.HOBBIES) assert.ok(all.includes(h), h)
  assert.ok(some.includes('golf') && !some.includes('rugby') && some.includes('autumn'))
})
await test('a boost brings a hobby on even out of season', () => {
  const ski = P.programme().find((t) => t.id === 'skiing')
  const july = P.buildContext([], { boosted: [] }, new Date('2026-07-10T11:00:00Z'), { timeZone: 'UTC' })
  assert.equal(ski.weight(july), 0)
  assert.ok(ski.weight({ ...july, house: { boosted: ['skiing'] } }) > 0)
})

// --- the card in a fake page --------------------------------------------------
const { window, document, customElements, HTMLElement } = parseHTML('<!doctype html><html><body></body></html>')
const noop = () => {}
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? {} : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: noop }) : noop), set: () => true })
window.HTMLCanvasElement.prototype.getContext = () => ctx2d
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get: () => 800 })
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get: () => 240 })
let frames = []
Object.assign(globalThis, {
  window, document, customElements, HTMLElement, ShadowRoot: window.ShadowRoot ?? class {}, location: { search: '' },
  requestAnimationFrame: (f) => frames.push(f), cancelAnimationFrame: noop,
  ResizeObserver: class { observe() {} disconnect() {} },
  IntersectionObserver: class { observe() {} disconnect() {} },
  performance: globalThis.performance,
})
window.matchMedia = () => ({ matches: false })
window.devicePixelRatio = 1
window.innerWidth = 1024
window.innerHeight = 600
window.setTimeout = setTimeout
window.clearTimeout = clearTimeout
window.setInterval = () => 0
window.clearInterval = noop
for (const target of [window, document]) {
  try { target.addEventListener = noop; target.removeEventListener = noop } catch {}
}
Object.defineProperty(document, 'hidden', { get: () => false, configurable: true })
console.info = noop

await import(await bundle('src/card.ts', 'card.mjs'))
const Card = customElements.get('seasonal-scenes-card')
const hass = {
  config: { time_zone: 'Europe/London', latitude: 51.5, country: 'GB' },
  states: {
    'weather.home': { entity_id: 'weather.home', state: 'snowy', attributes: {} },
    'input_text.birthdays': { entity_id: 'input_text.birthdays', state: 'Ada:01-01', attributes: {} },
    'sensor.bins': { entity_id: 'sensor.bins', state: '1', attributes: {} },
    'input_boolean.golf': { entity_id: 'input_boolean.golf', state: 'on', attributes: {} },
  },
}
const run = (seconds) => {
  let t = 0
  for (let i = 0; i < seconds * 30 && frames.length; i++) {
    const f = frames
    frames = []
    t += 1000 / 30
    for (const fn of f) fn(performance.now() + t)
  }
}

await test('card renders and plays a preview theme without throwing', () => {
  const el = document.createElement('seasonal-scenes-card')
  el.setConfig({ type: 'custom:seasonal-scenes-card', preview_theme: 'golf', birthdays_entity: 'input_text.birthdays', bins: { recycling: 'sensor.bins' }, boost: { golf: 'input_boolean.golf' } })
  el.hass = hass
  document.body.appendChild(el)
  const card = el.shadowRoot.querySelector('ha-card')
  assert.ok(card, 'ha-card rendered')
  assert.ok(card.querySelector('canvas'), 'canvas rendered')
  assert.match(card.style.background || card.getAttribute('style'), /gradient/)
  assert.equal(el.getCardSize(), 5)
  run(20)
  el.remove()
})
await test('every theme previews for a while without throwing', () => {
  for (const id of ['autumn', 'winter', 'spring', 'summer', 'golf', 'rugby', 'music', 'pottery', 'skiing', 'scuba', 'night', 'halloween', 'bonfire', 'christmas', 'newyear', 'valentines', 'pancake', 'easter', 'birthday']) {
    const el = document.createElement('seasonal-scenes-card')
    el.setConfig({ type: 'custom:seasonal-scenes-card', preview_theme: id })
    el.hass = hass
    document.body.appendChild(el)
    run(8)
    el.remove()
  }
})
await test('overlay mode adds and removes its layer', () => {
  const el = document.createElement('seasonal-scenes-card')
  el.setConfig({ type: 'custom:seasonal-scenes-card', mode: 'overlay' })
  el.hass = hass
  document.body.appendChild(el)
  assert.equal(document.body.querySelectorAll('div[aria-hidden]').length, 1)
  assert.equal(el.getCardSize(), 0)
  el.remove()
  assert.equal(document.body.querySelectorAll('div[aria-hidden]').length, 0)
})
await test('bad config is rejected with a helpful message', () => {
  const el = document.createElement('seasonal-scenes-card')
  assert.throws(() => el.setConfig({ type: 'x', mode: 'banner' }), /mode/)
  assert.throws(() => el.setConfig({ type: 'x', preview_theme: 'cricket' }), /golf/)
})
await test('config form schema is well formed', () => {
  const form = Card.getConfigForm()
  assert.ok(form.schema.length > 5)
  assert.equal(form.computeLabel({ name: 'mode' }), 'Where the scene plays')
})

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
