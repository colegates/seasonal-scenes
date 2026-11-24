import { ALL_HOLIDAYS, buildContext, parseBirthdays } from './scenes/calendar'
import { SceneEngine } from './scenes/engine'
import type { Birthday, Holiday, HouseSignals, SceneContext } from './scenes/types'
import { HOBBIES, HOBBY_LABELS, programme, THEME_LABELS } from './programme'
import { GROUND_PX, skyBackground } from './sky'

declare const __VERSION__: string

// ---------------------------------------------------------------------------
// Home Assistant types: only the bits this card reads.

interface HassEntity {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
}

interface Hass {
  states: Record<string, HassEntity>
  config: { time_zone?: string; latitude?: number; country?: string | null }
}

type BinKind = NonNullable<HouseSignals['binDay']>

export interface SeasonalScenesConfig {
  type: string
  /** `card`: a scene in its own card. `overlay`: along the bottom of the whole dashboard. */
  mode?: 'card' | 'overlay'
  /** Card height in px (card mode). */
  height?: number
  /** `sky` (default), `card` (the theme's card colour), `none`, or any CSS background. */
  background?: string
  /** Draw a strip of ground under the cast in sky mode. Default true. */
  ground?: boolean
  /** Character size multiplier. Default 1. */
  scale?: number
  /** Fewer acts and lighter weather. */
  calm?: boolean
  /** Hobby themes to include. Default: all of them. */
  hobbies?: string[]
  /** Holidays to celebrate. Default: all, with Bonfire Night only in GB/NZ. */
  holidays?: string[]
  /** `Name:MM-DD;Name:MM-DD`, or a list of { name, date: 'MM-DD' }. */
  birthdays?: string | { name: string; date: string }[]
  /** A text entity holding birthdays in the `Name:MM-DD;...` format. */
  birthdays_entity?: string
  /** Weather entity for rain and real snow. Default: the first weather entity. `false` for none. */
  weather_entity?: string | false
  /** Bin collection entities by kind: on/off, days until collection, or a date. */
  bins?: Partial<Record<BinKind, string>>
  /** Theme id -> entity. While the entity is on, that theme takes the stage far more often. */
  boost?: Record<string, string>
  /** `north` or `south`. Default: from Home Assistant's latitude. */
  hemisphere?: 'north' | 'south'
  /** IANA time zone. Default: Home Assistant's. */
  time_zone?: string
  /** Force one theme and play its acts back to back. For trying things out. */
  preview_theme?: string
  /** Tapping the card brings the next act on. Default true. */
  tap_to_play?: boolean
  /** Hide the scene for people who ask their device for reduced motion. Default true. */
  respect_reduced_motion?: boolean
  /** Overlay: px to leave clear at the bottom (a bottom nav bar). */
  overlay_offset?: number
  /** Overlay: CSS z-index. Default 3: above cards, below the header and dialogs. */
  overlay_z_index?: number
}

const TRUTHY = new Set(['on', 'true', 'yes', 'home', 'open', 'active', 'playing', 'heat', 'heating'])
const DAY_MS = 86_400_000

const isAvailable = (e?: HassEntity) => !!e && e.state !== 'unavailable' && e.state !== 'unknown'

/** Days until a bin is collected, from whatever shape the entity has. */
function daysUntil(e: HassEntity | undefined, now: Date): number | undefined {
  if (!isAvailable(e)) return undefined
  const s = e!.state.trim().toLowerCase()
  if (TRUTHY.has(s)) return 1
  if (s === 'off' || s === 'false') return undefined
  const asNumber = Number(s)
  if (s !== '' && Number.isFinite(asNumber)) return asNumber
  const attr = e!.attributes.daysTo ?? e!.attributes.days_to ?? e!.attributes.days
  if (typeof attr === 'number') return attr
  const when = Date.parse(e!.state)
  if (Number.isFinite(when)) {
    const a = new Date(when)
    const day = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
    return day(a) - day(now)
  }
  return undefined
}

function configBirthdays(b: SeasonalScenesConfig['birthdays']): Birthday[] {
  if (!b) return []
  if (typeof b === 'string') return parseBirthdays(b)
  return parseBirthdays(b.map((x) => `${x.name}:${x.date}`).join(';'))
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Walk out through shadow roots to the Lovelace panel this card lives in. */
function findPanel(from: Element): HTMLElement | null {
  let node: Node | null = from
  while (node) {
    if (node instanceof HTMLElement && (node.tagName === 'HUI-ROOT' || node.tagName === 'HA-PANEL-LOVELACE')) return node
    node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null)
  }
  return null
}

const STYLE = `
  :host { display: block; }
  ha-card { position: relative; overflow: hidden; }
  ha-card.bare { background: transparent; border: none; box-shadow: none; }
  canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  .hint { padding: 12px 16px; color: var(--secondary-text-color); font-size: 14px; }
`

export class SeasonalScenesCard extends HTMLElement {
  private config: SeasonalScenesConfig = { type: 'custom:seasonal-scenes-card' }
  private _hass: Hass | null = null
  private engine = new SceneEngine()
  private root: ShadowRoot
  private card: HTMLElement | null = null
  private overlay: HTMLDivElement | null = null
  private panel: HTMLElement | null = null
  private resizeObs: ResizeObserver | null = null
  private interObs: IntersectionObserver | null = null
  private lastBackground = ''
  private themeId: string | null = null
  private _editMode = false
  private _preview = false
  private placeTimer = 0

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })
  }

  // -- Lovelace API ---------------------------------------------------------

  setConfig(config: SeasonalScenesConfig) {
    if (!config) throw new Error('Invalid configuration')
    if (config.mode && config.mode !== 'card' && config.mode !== 'overlay') {
      throw new Error("mode must be 'card' or 'overlay'")
    }
    if (config.preview_theme && !THEME_LABELS.some((t) => t.id === config.preview_theme)) {
      throw new Error(`Unknown preview_theme '${config.preview_theme}'. Try one of: ${THEME_LABELS.map((t) => t.id).join(', ')}`)
    }
    this.config = { ...config }
    if (this.isConnected) this.mount()
  }

  set hass(hass: Hass) {
    const first = !this._hass
    this._hass = hass
    // The context is read on the engine's own clock; the first update only
    // matters because the time zone and hemisphere come from it.
    if (first && this.isConnected) this.mount()
  }

  get hass(): Hass {
    return this._hass as Hass
  }

  set editMode(v: boolean) {
    if (v === this._editMode) return
    this._editMode = v
    if (this.isConnected) this.mount()
  }

  set preview(v: boolean) {
    if (v === this._preview) return
    this._preview = v
    if (this.isConnected) this.mount()
  }

  getCardSize(): number {
    if (this.isOverlay()) return this.showsHint() ? 1 : 0
    return Math.max(1, Math.round(this.height() / 50))
  }

  getGridOptions() {
    if (this.isOverlay()) return { columns: 'full', rows: this.showsHint() ? 1 : 'auto' }
    return { columns: 'full', rows: 'auto', min_rows: 2 }
  }

  static getStubConfig(): Partial<SeasonalScenesConfig> {
    return { mode: 'card', height: 240 }
  }

  static getConfigForm() {
    const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }))
    return {
      schema: [
        {
          name: 'mode',
          selector: {
            select: {
              mode: 'dropdown',
              options: opts([
                ['card', 'In a card'],
                ['overlay', 'Along the bottom of the dashboard'],
              ]),
            },
          },
        },
        {
          type: 'grid',
          name: '',
          schema: [
            { name: 'height', selector: { number: { min: 120, max: 800, step: 10, mode: 'box', unit_of_measurement: 'px' } } },
            { name: 'scale', selector: { number: { min: 0.6, max: 2, step: 0.1, mode: 'box' } } },
          ],
        },
        {
          name: 'background',
          selector: {
            select: {
              mode: 'dropdown',
              custom_value: true,
              options: opts([
                ['sky', 'Sky that follows the time of day'],
                ['card', 'Card colour'],
                ['none', 'Transparent'],
              ]),
            },
          },
        },
        { name: 'calm', selector: { boolean: {} } },
        {
          name: 'hobbies',
          selector: { select: { multiple: true, options: HOBBIES.map((h) => ({ value: h, label: HOBBY_LABELS[h] })) } },
        },
        {
          name: 'holidays',
          selector: { select: { multiple: true, options: ALL_HOLIDAYS.map((h) => ({ value: h, label: HOLIDAY_LABELS[h] })) } },
        },
        { name: 'birthdays', selector: { text: {} } },
        { name: 'birthdays_entity', selector: { entity: { domain: ['input_text', 'text', 'sensor'] } } },
        { name: 'weather_entity', selector: { entity: { domain: 'weather' } } },
        {
          name: 'preview_theme',
          selector: { select: { mode: 'dropdown', options: THEME_LABELS.map((t) => ({ value: t.id, label: t.label })) } },
        },
      ],
      computeLabel: (s: { name: string }) => FORM_LABELS[s.name] ?? s.name,
      computeHelper: (s: { name: string }) => FORM_HELPERS[s.name],
    }
  }

  // -- Lifecycle ------------------------------------------------------------

  connectedCallback() {
    this.mount()
  }

  disconnectedCallback() {
    this.unmount()
  }

  private isOverlay() {
    // The card editor shows overlays as a card, so there is something to see.
    return this.config.mode === 'overlay' && !this._preview
  }

  private inEditMode() {
    return this._editMode || /[?&]edit=1/.test(location.search)
  }

  private showsHint() {
    return this.isOverlay() && this.inEditMode()
  }

  private height() {
    const h = Number(this.config.height)
    return Number.isFinite(h) && h > 0 ? h : 240
  }

  private unmount() {
    this.engine.detach()
    this.resizeObs?.disconnect()
    this.interObs?.disconnect()
    this.resizeObs = null
    this.interObs = null
    window.removeEventListener('resize', this.placeOverlay)
    window.clearInterval(this.placeTimer)
    this.placeTimer = 0
    this.overlay?.remove()
    this.overlay = null
    this.panel = null
    this.card = null
  }

  private mount() {
    this.unmount()
    if (!this._hass) {
      this.root.innerHTML = ''
      return
    }
    const still = this.config.respect_reduced_motion !== false && reducedMotion()
    this.root.innerHTML = `<style>${STYLE}</style>`

    if (this.isOverlay()) {
      if (this.showsHint()) {
        const card = document.createElement('ha-card')
        card.innerHTML = `<div class="hint">Seasonal scenes overlay${still ? ' (paused: this device asks for reduced motion)' : ''}. Hidden outside edit mode.</div>`
        this.root.appendChild(card)
      }
      if (still) return
      this.mountOverlay()
      return
    }

    const card = document.createElement('ha-card')
    card.style.height = `${this.height()}px`
    const bg = this.config.background ?? 'sky'
    if (bg === 'none') card.classList.add('bare')
    else if (bg !== 'sky' && bg !== 'card') card.style.background = bg
    this.root.appendChild(card)
    this.card = card
    this.lastBackground = ''
    if (bg === 'sky') this.paintSky(this.context())
    if (still) return

    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    card.appendChild(canvas)
    if (this.config.tap_to_play !== false) card.addEventListener('click', () => this.engine.poke())
    this.attachEngine(canvas, this.skyGround() ? GROUND_PX : 0)

    this.resizeObs = new ResizeObserver(() => this.engine.setOptions({}))
    this.resizeObs.observe(card)
    this.interObs = new IntersectionObserver((entries) => {
      for (const e of entries) this.engine.setVisible(e.isIntersecting)
    })
    this.interObs.observe(card)
  }

  private skyGround() {
    return (this.config.background ?? 'sky') === 'sky' && this.config.ground !== false
  }

  private mountOverlay() {
    const wrap = document.createElement('div')
    wrap.setAttribute('aria-hidden', 'true')
    Object.assign(wrap.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: String(this.config.overlay_z_index ?? 3),
    })
    const canvas = document.createElement('canvas')
    Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%' })
    wrap.appendChild(canvas)
    document.body.appendChild(wrap)
    this.overlay = wrap
    // The panel may not be in the tree yet on first connect; look again shortly.
    this.panel = findPanel(this)
    this.placeOverlay()
    window.addEventListener('resize', this.placeOverlay)
    this.placeTimer = window.setInterval(this.placeOverlay, 2000)
    this.resizeObs = new ResizeObserver(this.placeOverlay)
    if (this.panel) this.resizeObs.observe(this.panel)
    this.attachEngine(canvas, 0)
  }

  /** Cover the dashboard area only: not the sidebar, and clear of any bottom bar. */
  private placeOverlay = () => {
    const wrap = this.overlay
    if (!wrap) return
    if (!this.panel) {
      this.panel = findPanel(this)
      if (this.panel) this.resizeObs?.observe(this.panel)
    }
    const r = this.panel?.getBoundingClientRect()
    const offset = Math.max(0, Number(this.config.overlay_offset) || 0)
    const left = r && r.width > 0 ? Math.max(0, r.left) : 0
    const width = r && r.width > 0 ? r.width : window.innerWidth
    const top = r && r.height > 0 ? Math.max(0, r.top) : 0
    const height = Math.max(0, window.innerHeight - top - offset)
    const next = { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }
    let changed = false
    for (const [k, v] of Object.entries(next)) {
      if (wrap.style.getPropertyValue(k) !== v) {
        wrap.style.setProperty(k, v)
        changed = true
      }
    }
    if (changed) this.engine.setOptions({})
  }

  private attachEngine(canvas: HTMLCanvasElement, groundInset: number) {
    const c = this.config
    this.engine.attach(canvas, {
      groundInset,
      themes: programme(c.hobbies),
      getContext: () => {
        const ctx = this.context()
        if (this.card && (c.background ?? 'sky') === 'sky') this.paintSky(ctx)
        return ctx
      },
      onTheme: (id, ctx) => {
        this.themeId = id
        if (this.card && (c.background ?? 'sky') === 'sky') this.paintSky(ctx)
      },
      previewTheme: c.preview_theme ?? null,
      calm: !!c.calm,
      scale: Number(c.scale) > 0 ? Number(c.scale) : 1,
    })
  }

  private paintSky(ctx: SceneContext) {
    if (!this.card) return
    const bg = skyBackground(ctx.dayPart, ctx.season, this.skyGround(), this.themeId)
    if (bg === this.lastBackground) return
    this.lastBackground = bg
    this.card.style.background = bg
  }

  // -- What the house is up to ----------------------------------------------

  private context(): SceneContext {
    const hass = this._hass
    const c = this.config
    const states = hass?.states ?? {}
    const now = new Date()

    const birthdays = [...configBirthdays(c.birthdays)]
    const bEnt = c.birthdays_entity ? states[c.birthdays_entity] : undefined
    if (isAvailable(bEnt)) birthdays.push(...parseBirthdays(bEnt!.state))

    let weather: string | undefined
    if (c.weather_entity !== false) {
      const id = c.weather_entity || Object.keys(states).find((k) => k.startsWith('weather.'))
      const w = id ? states[id] : undefined
      if (isAvailable(w)) weather = w!.state
    }

    // A bin matters from the afternoon before until the lorry has been.
    const timeZone = c.time_zone || hass?.config.time_zone || undefined
    let binDay: BinKind | undefined
    if (c.bins) {
      const probe = buildContext([], {}, now, { timeZone })
      for (const [kind, id] of Object.entries(c.bins) as [BinKind, string][]) {
        const d = daysUntil(states[id], now)
        if ((d === 1 && probe.minutes >= 15 * 60) || (d === 0 && probe.minutes < 9 * 60)) {
          binDay = kind
          break
        }
      }
    }

    const boosted: string[] = []
    for (const [theme, id] of Object.entries(c.boost ?? {})) {
      const e = states[id]
      if (isAvailable(e) && TRUTHY.has(e.state.toLowerCase())) boosted.push(theme)
    }

    const house: HouseSignals = { weather, binDay, boosted, kilnFiring: boosted.includes('pottery') }
    const south = c.hemisphere ? c.hemisphere === 'south' : (hass?.config.latitude ?? 0) < 0
    return buildContext(birthdays, house, now, { timeZone, south, holidays: this.holidays() })
  }

  private holidays(): Holiday[] {
    const listed = this.config.holidays
    if (listed && listed.length) return ALL_HOLIDAYS.filter((h) => listed.includes(h))
    // Bonfire Night is a British (and New Zealand) thing; elsewhere 5 November
    // is just a Wednesday, so leave it out unless asked for.
    const country = (this._hass?.config.country ?? '').toUpperCase()
    return ALL_HOLIDAYS.filter((h) => h !== 'bonfire' || country === 'GB' || country === 'NZ')
  }
}

const HOLIDAY_LABELS: Record<Holiday, string> = {
  newyear: "New Year's Day",
  valentines: "Valentine's Day",
  pancake: 'Pancake Day',
  easter: 'Easter',
  halloween: 'Halloween (last week of October)',
  bonfire: 'Bonfire Night (4-5 November)',
  christmas: 'Christmas (all of Advent)',
  newyearseve: "New Year's Eve",
}

const FORM_LABELS: Record<string, string> = {
  mode: 'Where the scene plays',
  height: 'Height',
  scale: 'Character size',
  background: 'Background',
  calm: 'Calm (fewer acts, lighter weather)',
  hobbies: 'Hobby themes',
  holidays: 'Holidays',
  birthdays: 'Birthdays',
  birthdays_entity: 'Birthdays from an entity',
  weather_entity: 'Weather',
  preview_theme: 'Preview a theme',
}

const FORM_HELPERS: Record<string, string> = {
  hobbies: 'Leave empty for all of them.',
  holidays: 'Leave empty for all (Bonfire Night only in the UK and New Zealand).',
  birthdays: 'Name:MM-DD separated by semicolons, e.g. Ada:03-14;Ben:11-02',
  birthdays_entity: 'A text helper in the same Name:MM-DD;... format, so it can be edited from a dashboard.',
  weather_entity: 'Rain brings out umbrellas; real snow turns any theme wintry. Default: your first weather entity.',
  preview_theme: 'Plays every act of one theme back to back. Clear it when you are done.',
  height: 'Card mode only.',
}

if (!customElements.get('seasonal-scenes-card')) {
  customElements.define('seasonal-scenes-card', SeasonalScenesCard)
}

const w = window as unknown as { customCards?: unknown[] }
w.customCards = w.customCards || []
w.customCards.push({
  type: 'seasonal-scenes-card',
  name: 'Seasonal Scenes',
  description: 'Little animated characters that act out the season, the time of day, holidays and birthdays.',
  preview: true,
  documentationURL: 'https://github.com/colegates/seasonal-scenes',
})

console.info(`%c SEASONAL-SCENES-CARD %c ${typeof __VERSION__ === 'string' ? __VERSION__ : 'dev'} `, 'color:#fde68a;background:#1c4a80;font-weight:700', 'color:#1c4a80;background:#fde68a')
