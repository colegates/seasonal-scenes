import type { Ctx } from './draw'
import type { ParticleField } from './particles'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type DayPart = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'

export type Holiday =
  | 'newyear'
  | 'valentines'
  | 'pancake'
  | 'easter'
  | 'halloween'
  | 'bonfire'
  | 'christmas'
  | 'newyearseve'

export interface Birthday {
  name: string
  /** 1-12 */
  month: number
  /** 1-31 */
  day: number
}

/** Everything the director knows about "now". Rebuilt once a minute. */
export interface SceneContext {
  /** Calendar date in the home's time zone. */
  year: number
  month: number
  day: number
  /** Minutes since midnight in the home's time zone. */
  minutes: number
  season: Season
  dayPart: DayPart
  holidays: Holiday[]
  /** 1-25 during December up to Christmas Day, else 0. */
  adventDay: number
  /** Names of everyone whose birthday is today. */
  birthdayNames: string[]
  /** Names of everyone whose birthday is tomorrow. */
  birthdayTomorrow: string[]
  /** Live house signals. All optional: a scene must cope with none of them. */
  house: HouseSignals
}

export interface HouseSignals {
  /** HA weather condition: 'rainy', 'snowy', 'sunny', 'cloudy', ... */
  weather?: string
  /** The kiln is hot and climbing or soaking. */
  kilnFiring?: boolean
  /** A bin goes out tonight for tomorrow's collection (or is due today). */
  binDay?: 'domestic' | 'recycling' | 'food'
  /** Theme ids the home has asked to see more of right now (a boost entity is on). */
  boosted?: string[]
}

/**
 * The surface a scene draws on. Positions are CSS pixels; character art is
 * authored in "units" and scaled by `u` (a person is about 64 units tall).
 */
export interface Stage {
  ctx: Ctx
  w: number
  h: number
  /** y of the floor the characters walk on. */
  ground: number
  /** Pixels per art unit. */
  u: number
  /** Seconds since the engine started. Use for idle wobble, not for timelines. */
  time: number
  particles: ParticleField
  context: SceneContext
}

/** One running performance. Created fresh each time it is cast. */
export interface Act {
  /** Advance by dt seconds. Return false once the act has left the stage. */
  update(stage: Stage, dt: number): boolean
  draw(stage: Stage): void
}

export type Rng = () => number

export interface ActDef {
  id: string
  /** Relative odds within its theme. Default 1. */
  weight?: number
  /** Only cast when this passes. */
  when?: (c: SceneContext) => boolean
  /** This act tidies the pile, so the director casts it when the floor is full. */
  clears?: boolean
  create(stage: Stage, rng: Rng): Act
}

export type ParticleKind =
  | 'leaf'
  | 'snow'
  | 'petal'
  | 'confetti'
  | 'bubble'
  | 'note'
  | 'spark'
  | 'seed'
  | 'heart'
  | 'star'
  | 'dust'
  | 'drop'
  | 'ember'

export interface AmbientDef {
  kind: ParticleKind
  colors: string[]
  /** Particles per second per 1000px of width while a flurry is blowing. */
  rate: number
  /** Seconds on, seconds off. The engine sleeps through the off part. */
  flurry: [number, number]
  /** Come to rest on the floor and build up. */
  settle: boolean
  /** 'items' keeps each resting piece; 'drift' draws one smooth mound. */
  pile?: 'items' | 'drift'
  /** Tallest the pile may get, in art units. */
  maxPile?: number
  /** Rise from the floor instead of falling from the top (bubbles). */
  rising?: boolean
  size?: [number, number]
}

export interface ThemeDef {
  id: string
  /** Human name, shown in the card editor's preview picker. */
  label: string
  /** Relative odds of owning a time slot. 0 means never chosen. */
  weight: (c: SceneContext) => number
  ambient?: AmbientDef | ((c: SceneContext) => AmbientDef | undefined)
  acts: ActDef[]
  /** Average seconds between acts. Default 55. */
  actEvery?: number
}
