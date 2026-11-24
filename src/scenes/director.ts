import { hashString, mulberry32, weighted } from './rng'
import type { ActDef, AmbientDef, SceneContext, ThemeDef } from './types'

/** A theme owns the screen for this many minutes before the next is chosen. */
export const SLOT_MINUTES = 20

/**
 * Choose the theme for the current slot. Seeded by the date and the slot, so
 * a wall panel and every phone land on the same theme at the same time,
 * and the answer does not flicker between refreshes.
 */
export function pickTheme(c: SceneContext, themes: ThemeDef[]): ThemeDef | undefined {
  const slot = Math.floor(c.minutes / SLOT_MINUTES)
  const rng = mulberry32(hashString(`${c.year}-${c.month}-${c.day}-${slot}`))
  rng()
  return weighted(rng, themes, (t) => t.weight(c))
}

export function ambientOf(theme: ThemeDef, c: SceneContext): AmbientDef | undefined {
  return typeof theme.ambient === 'function' ? theme.ambient(c) : theme.ambient
}

/**
 * Choose the next act. A full floor calls the tidy-up crew; otherwise it is a
 * weighted draw that avoids repeating the last two acts, so a child watching
 * for five minutes sees five different things.
 */
export function pickAct(theme: ThemeDef, c: SceneContext, recent: string[], fullness: number): ActDef | undefined {
  const eligible = theme.acts.filter((a) => !a.when || a.when(c))
  if (eligible.length === 0) return undefined
  const clearers = eligible.filter((a) => a.clears)
  if (clearers.length > 0 && fullness > 0.8) {
    return weighted(Math.random, clearers, (a) => a.weight ?? 1)
  }
  const fresh = eligible.filter((a) => !recent.includes(a.id) && !(a.clears && fullness < 0.3))
  const pool = fresh.length > 0 ? fresh : eligible
  return weighted(Math.random, pool, (a) => a.weight ?? 1)
}
