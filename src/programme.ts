import { THEMES } from './scenes/themes'
import type { ThemeDef } from './scenes/types'

/** The hobby themes a home can switch on or off. Seasons, night and holidays always run. */
export const HOBBIES = ['golf', 'rugby', 'music', 'pottery', 'skiing', 'scuba'] as const
export type Hobby = (typeof HOBBIES)[number]

export const HOBBY_LABELS: Record<Hobby, string> = {
  golf: 'Golf',
  rugby: 'Rugby',
  music: 'French horn and bassoon',
  pottery: 'Pottery',
  skiing: 'Skiing',
  scuba: 'Scuba diving',
}

const isHobby = (id: string): id is Hobby => (HOBBIES as readonly string[]).includes(id)

/** How much more often a boosted theme gets the stage. */
const BOOST = 6

/**
 * The themes this card plays. Hobbies not in `hobbies` are dropped. A hobby
 * whose boost entity is on (listed in `house.boosted`) gets the stage far more
 * often, and does so even out of its usual season (skiing in July, if the
 * family is on a ski trip), though never at night.
 */
export function programme(hobbies?: readonly string[]): ThemeDef[] {
  return THEMES.filter((t) => !isHobby(t.id) || !hobbies || hobbies.includes(t.id)).map((t) => ({
    ...t,
    weight: (c) => {
      const w = t.weight(c)
      if (!c.house.boosted?.includes(t.id)) return w
      if (!isHobby(t.id)) return w * BOOST
      return c.dayPart === 'night' ? 0 : Math.max(w, 1) * BOOST
    },
  }))
}

export const THEME_LABELS: { id: string; label: string }[] = THEMES.map((t) => ({ id: t.id, label: t.label }))
