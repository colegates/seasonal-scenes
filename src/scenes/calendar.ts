import type { Birthday, DayPart, Holiday, HouseSignals, SceneContext, Season } from './types'

// Works out what kind of day it is: season, time of day, holidays, birthdays.
// Always in the home's time zone (Home Assistant's), whatever the device
// thinks, so a phone abroad and the wall panel agree on what to show.

interface ZonedNow {
  year: number
  month: number
  day: number
  minutes: number
}

const formats = new Map<string, Intl.DateTimeFormat>()

function formatFor(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? ''
  let fmt = formats.get(key)
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      })
    } catch {
      // An unknown zone name: use the device's own clock rather than fail.
      fmt = formatFor(undefined)
    }
    formats.set(key, fmt)
  }
  return fmt
}

/** Calendar date and minutes since midnight in `timeZone` (default: the device's). */
export function zonedNow(at: Date = new Date(), timeZone?: string): ZonedNow {
  const parts = formatFor(timeZone).formatToParts(at)
  const n = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
  return { year: n('year'), month: n('month'), day: n('day'), minutes: (n('hour') % 24) * 60 + n('minute') }
}

/** Easter Sunday for a year (Gregorian), as [month, day]. */
export function easterSunday(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}

const dayNumber = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 86_400_000)

/** The month as the northern hemisphere would feel it. */
const feltMonth = (month: number, south: boolean) => (south ? ((month + 5) % 12) + 1 : month)

function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

/**
 * Day part from the clock, nudged by the season so "evening" starts when it
 * is actually getting dark: about 16:30 in midwinter, 20:30 in midsummer.
 */
function dayPartOf(minutes: number, month: number): DayPart {
  const h = minutes / 60
  const midsummer = 1 - Math.abs(month - 6.5) / 5.5 // 0 in deep winter, 1 in midsummer
  const dusk = 16.5 + midsummer * 4
  const dawn = 7.5 - midsummer * 2.5
  if (h < dawn - 1 || h >= 22) return 'night'
  if (h < dawn + 0.75) return 'dawn'
  if (h < 12) return 'morning'
  if (h < dusk) return 'afternoon'
  return 'evening'
}

export const ALL_HOLIDAYS: Holiday[] = [
  'newyear',
  'valentines',
  'pancake',
  'easter',
  'halloween',
  'bonfire',
  'christmas',
  'newyearseve',
]

function holidaysOf(y: number, m: number, d: number): Holiday[] {
  const out: Holiday[] = []
  if (m === 1 && d === 1) out.push('newyear')
  if (m === 12 && d === 31) out.push('newyearseve')
  if (m === 2 && d === 14) out.push('valentines')
  if (m === 10 && d >= 25) out.push('halloween')
  if (m === 11 && d >= 4 && d <= 5) out.push('bonfire')
  if (m === 12 && d <= 26) out.push('christmas')
  const [em, ed] = easterSunday(y)
  const easter = dayNumber(y, em, ed)
  const today = dayNumber(y, m, d)
  if (today >= easter - 2 && today <= easter + 1) out.push('easter')
  if (today === easter - 47) out.push('pancake')
  return out
}

/**
 * Birthdays as one terse string, so they fit in a Home Assistant text helper
 * (255 characters at most) and every screen in the house agrees.
 * Format: `Name:MM-DD;Name:MM-DD`.
 */
export function parseBirthdays(raw: string | undefined | null): Birthday[] {
  if (!raw) return []
  const out: Birthday[] = []
  for (const chunk of raw.split(/[;,\n]/)) {
    const m = chunk.trim().match(/^(.+?)\s*[:=]\s*(\d{1,2})-(\d{1,2})$/)
    if (!m) continue
    const month = parseInt(m[2], 10)
    const day = parseInt(m[3], 10)
    const name = m[1].trim()
    if (!name || month < 1 || month > 12 || day < 1 || day > 31) continue
    out.push({ name, month, day })
  }
  return out
}

export function serialiseBirthdays(list: Birthday[]): string {
  return list
    .filter((b) => b.name.trim())
    .map((b) => `${b.name.trim().replace(/[;:,]/g, ' ')}:${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`)
    .join(';')
}

export interface CalendarOptions {
  /** IANA zone, e.g. "Europe/London". Default: the device's. */
  timeZone?: string
  /** Flip the seasons for the southern hemisphere. */
  south?: boolean
  /** Holidays to celebrate. Default: all of them. */
  holidays?: readonly Holiday[]
}

export function buildContext(
  birthdays: Birthday[],
  house: HouseSignals,
  at: Date = new Date(),
  opts: CalendarOptions = {},
): SceneContext {
  const now = zonedNow(at, opts.timeZone)
  const tomorrow = zonedNow(new Date(at.getTime() + 86_400_000), opts.timeZone)
  const felt = feltMonth(now.month, !!opts.south)
  // Someone born on 29 February gets their day on the 28th in other years.
  const leap = new Date(Date.UTC(now.year, 1, 29)).getUTCMonth() === 1
  const matches = (b: Birthday, m: number, d: number) =>
    (b.month === m && b.day === d) || (!leap && b.month === 2 && b.day === 29 && m === 2 && d === 28)
  const allowed = opts.holidays
  return {
    year: now.year,
    month: now.month,
    day: now.day,
    minutes: now.minutes,
    season: seasonOf(felt),
    dayPart: dayPartOf(now.minutes, felt),
    holidays: holidaysOf(now.year, now.month, now.day).filter((h) => !allowed || allowed.includes(h)),
    adventDay: now.month === 12 && now.day <= 25 && (!allowed || allowed.includes('christmas')) ? now.day : 0,
    birthdayNames: birthdays.filter((b) => matches(b, now.month, now.day)).map((b) => b.name),
    birthdayTomorrow: birthdays.filter((b) => matches(b, tomorrow.month, tomorrow.day)).map((b) => b.name),
    house,
  }
}
