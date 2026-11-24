import { AUTUMN_ACTS, AUTUMN_AMBIENT } from './acts/autumn'
import { BIRTHDAY_ACTS, BIRTHDAY_AMBIENT } from './acts/birthday'
import { CHRISTMAS_ACTS } from './acts/christmas'
import { EASTER_ACTS, PANCAKE_ACTS, VALENTINE_ACTS } from './acts/festive'
import { BONFIRE_ACTS, NEWYEAR_ACTS } from './acts/fireworks'
import { GOLF_ACTS } from './acts/golf'
import { HALLOWEEN_ACTS, HALLOWEEN_AMBIENT } from './acts/halloween'
import { HOUSE_ACTS } from './acts/house'
import { MUSIC_ACTS } from './acts/music'
import { NIGHT_ACTS } from './acts/night'
import { POTTERY_ACTS } from './acts/pottery'
import { RUGBY_ACTS } from './acts/rugby'
import { SCUBA_ACTS, SCUBA_AMBIENT } from './acts/scuba'
import { SPRING_ACTS, SPRING_AMBIENT } from './acts/spring'
import { SUMMER_ACTS, SUMMER_AMBIENT } from './acts/summer'
import { SKIING_ACTS, WINTER_ACTS, WINTER_AMBIENT } from './acts/winter'
import type { ActDef, AmbientDef, SceneContext, Season, ThemeDef } from './types'

// The programme. Each theme owns the screen for a 20-minute slot; the weights
// below decide how often each one gets a turn given the date and the hour.
//
// The shape of a normal day: the season takes roughly four slots in ten, the
// family's hobbies share the rest, and after dark a slow night-time cast takes
// over. Holidays and birthdays push their way to the front on their own days.

const has = (c: SceneContext, h: SceneContext['holidays'][number]) => c.holidays.includes(h)
const isNight = (c: SceneContext) => c.dayPart === 'night'
const dark = (c: SceneContext) => c.dayPart === 'night' || c.dayPart === 'evening'

/** Real snow outside beats the calendar. */
function feelsLike(c: SceneContext): Season {
  return /snow/.test(c.house.weather ?? '') ? 'winter' : c.season
}

const SEASON_AMBIENT: Record<Season, AmbientDef | undefined> = {
  spring: SPRING_AMBIENT,
  summer: SUMMER_AMBIENT,
  autumn: AUTUMN_AMBIENT,
  winter: WINTER_AMBIENT,
}

/** The weather that falls behind a hobby scene: the season's, but lighter. */
function lightSeasonal(c: SceneContext): AmbientDef | undefined {
  const a = SEASON_AMBIENT[feelsLike(c)]
  return a ? { ...a, rate: a.rate * 0.55 } : undefined
}

/** Add a condition to every act in a list without touching the originals. */
function gated(acts: ActDef[], pred: (c: SceneContext) => boolean, weightScale = 1): ActDef[] {
  return acts.map((a) => ({
    ...a,
    weight: (a.weight ?? 1) * weightScale,
    when: (c: SceneContext) => pred(c) && (a.when ? a.when(c) : true),
  }))
}

/**
 * The tidy-up crew for whatever is lying on the floor. Hobby themes borrow
 * these so leaves do not pile up for twenty minutes just because it is golf's
 * turn.
 */
const CLEARERS: ActDef[] = [
  ...gated(AUTUMN_ACTS.filter((a) => a.clears), (c) => feelsLike(c) === 'autumn'),
  ...gated(WINTER_ACTS.filter((a) => a.clears), (c) => feelsLike(c) === 'winter'),
  ...gated(SPRING_ACTS.filter((a) => a.clears), (c) => feelsLike(c) === 'spring'),
]

/** House acts turn up everywhere in the daytime, a little less often than the theme's own. */
const HOUSE = gated(HOUSE_ACTS, () => true, 0.35)

const seasonTheme = (id: Season, label: string, acts: ActDef[]): ThemeDef => ({
  id,
  label,
  weight: (c) => (isNight(c) ? 0 : feelsLike(c) === id ? 4 : 0),
  ambient: () => SEASON_AMBIENT[id],
  acts: [...acts, ...HOUSE],
})

const hobby = (id: string, label: string, acts: ActDef[], weight: (c: SceneContext) => number): ThemeDef => ({
  id,
  label,
  weight: (c) => (isNight(c) ? 0 : weight(c)),
  ambient: lightSeasonal,
  acts: [...acts, ...CLEARERS, ...HOUSE],
})

export const THEMES: ThemeDef[] = [
  seasonTheme('autumn', 'Autumn leaves', AUTUMN_ACTS),
  seasonTheme('winter', 'Winter snow', WINTER_ACTS),
  seasonTheme('spring', 'Spring blossom', SPRING_ACTS),
  seasonTheme('summer', 'Summer', SUMMER_ACTS),

  hobby('golf', 'Golf', GOLF_ACTS, (c) => (c.season === 'winter' ? 0.7 : 1.3)),
  // Six Nations in February and March, autumn internationals in November.
  hobby('rugby', 'Rugby', RUGBY_ACTS, (c) => (c.month === 2 || c.month === 3 || c.month === 11 ? 2 : 1.1)),
  hobby('music', 'French horn and bassoon', MUSIC_ACTS, () => 1.3),
  hobby('pottery', 'Pottery', POTTERY_ACTS, (c) => (c.house.kilnFiring ? 5 : 1)),
  hobby('skiing', 'Skiing', SKIING_ACTS, (c) => (c.month === 1 || c.month === 2 ? 2.2 : c.month === 12 || c.month === 3 ? 1.4 : 0)),
  {
    id: 'scuba',
    label: 'Scuba diving',
    weight: (c) => (isNight(c) ? 0 : c.season === 'summer' ? 1.6 : 1),
    ambient: () => SCUBA_AMBIENT,
    acts: SCUBA_ACTS,
  },

  {
    id: 'night',
    label: 'Night time',
    weight: (c) => (isNight(c) ? 100 : 0),
    ambient: (c) => {
      const a = SEASON_AMBIENT[feelsLike(c)]
      return a ? { ...a, rate: a.rate * 0.3 } : undefined
    },
    acts: [...NIGHT_ACTS, ...CLEARERS],
    actEvery: 70,
  },

  {
    id: 'halloween',
    label: 'Halloween',
    weight: (c) => (has(c, 'halloween') ? (isNight(c) ? 400 : dark(c) ? 26 : 12) : 0),
    ambient: () => HALLOWEEN_AMBIENT ?? AUTUMN_AMBIENT,
    acts: [...HALLOWEEN_ACTS, ...gated(HOUSE_ACTS, () => true, 0.3)],
    actEvery: 45,
  },
  {
    id: 'bonfire',
    label: 'Bonfire Night',
    // Fireworks are an after-dark thing. They take over the evening outright.
    weight: (c) => (has(c, 'bonfire') && dark(c) ? 3000 : 0),
    ambient: lightSeasonal,
    acts: [...BONFIRE_ACTS, ...CLEARERS],
    actEvery: 40,
  },
  {
    id: 'christmas',
    label: 'Christmas',
    // Builds through Advent: about a quarter of slots on the 1st, most of
    // them by Christmas Eve.
    weight: (c) => {
      if (!has(c, 'christmas')) return 0
      const w = c.adventDay >= 24 || c.adventDay === 0 ? 30 : 2.5 + c.adventDay * 0.55
      return isNight(c) ? w * 12 : w
    },
    ambient: () => WINTER_AMBIENT,
    acts: [...CHRISTMAS_ACTS, ...gated(WINTER_ACTS.filter((a) => a.clears), () => true), ...gated(HOUSE_ACTS, () => true, 0.3)],
    actEvery: 45,
  },
  {
    id: 'newyear',
    label: 'New Year',
    weight: (c) => (has(c, 'newyearseve') ? (dark(c) ? 3000 : 5) : has(c, 'newyear') ? (isNight(c) ? 0 : 12) : 0),
    ambient: () => ({ ...BIRTHDAY_AMBIENT, colors: ['#fde68a', '#f1f5f9', '#fbbf24', '#cbd5e1'], rate: 2 }),
    acts: [...NEWYEAR_ACTS, ...gated(BIRTHDAY_ACTS.filter((a) => a.clears), () => true)],
    actEvery: 40,
  },
  {
    id: 'valentines',
    label: "Valentine's Day",
    weight: (c) => (has(c, 'valentines') && !isNight(c) ? 10 : 0),
    ambient: lightSeasonal,
    acts: [...VALENTINE_ACTS, ...CLEARERS, ...gated(HOUSE_ACTS, () => true, 0.3)],
  },
  {
    id: 'pancake',
    label: 'Pancake Day',
    weight: (c) => (has(c, 'pancake') && !isNight(c) ? 10 : 0),
    ambient: lightSeasonal,
    acts: [...PANCAKE_ACTS, ...CLEARERS, ...gated(HOUSE_ACTS, () => true, 0.3)],
  },
  {
    id: 'easter',
    label: 'Easter',
    weight: (c) => (has(c, 'easter') && !isNight(c) ? 14 : 0),
    ambient: () => SPRING_AMBIENT,
    acts: [...EASTER_ACTS, ...gated(SPRING_ACTS.filter((a) => a.clears), () => true), ...gated(HOUSE_ACTS, () => true, 0.3)],
  },
  {
    id: 'birthday',
    label: 'Birthday',
    // On someone's birthday this takes about two slots in three, all day.
    weight: (c) => (c.birthdayNames.length > 0 && !isNight(c) ? 18 : 0),
    ambient: () => BIRTHDAY_AMBIENT,
    acts: BIRTHDAY_ACTS,
    actEvery: 40,
  },
]

/** Themes offered in the Settings preview, in programme order. */
export const PREVIEW_THEMES = THEMES.map((t) => ({ id: t.id, label: t.label }))
