import type { DayPart, Season } from './scenes/types'

// The backdrop behind the cast in card mode: a sky that follows the time of
// day and a strip of ground that follows the season. Plain CSS gradients, so
// it costs nothing to draw and never needs the canvas to repaint.
//
// The art was drawn for a dark navy page, so even the daytime skies stay
// mid-toned: pale paper and snow must still read against them.

const SKY: Record<DayPart, [string, string]> = {
  night: ['#081325', '#14284a'],
  dawn: ['#243a6b', '#b9787a'],
  morning: ['#1f4f86', '#4f86b8'],
  afternoon: ['#1c4a80', '#4a80b4'],
  evening: ['#1a2650', '#8a4f6a'],
}

const GROUND: Record<Season, string> = {
  spring: '#3f7a45',
  summer: '#4a7f3a',
  autumn: '#6b5a33',
  winter: '#9fb3c8',
}

const NIGHT_GROUND: Record<Season, string> = {
  spring: '#1f3a2a',
  summer: '#22402a',
  autumn: '#33301f',
  winter: '#4a5a70',
}

/** Underwater, for the scuba theme: deep water above, a sandy bottom below. */
const SEA: [string, string] = ['#062a45', '#0f5f80']
const SAND = '#b89a5e'

export const GROUND_PX = 14

export function skyColors(part: DayPart): [string, string] {
  return SKY[part]
}

export function groundColor(season: Season, part: DayPart): string {
  return part === 'night' || part === 'evening' ? NIGHT_GROUND[season] : GROUND[season]
}

/** The backdrop colours for a theme at a time of day: [top, bottom, ground]. */
export function backdropColors(part: DayPart, season: Season, themeId?: string | null): [string, string, string] {
  if (themeId === 'scuba') return [SEA[0], SEA[1], SAND]
  const [top, bottom] = SKY[part]
  return [top, bottom, groundColor(season, part)]
}

/** CSS `background` for the card: sky above, a band of ground below. */
export function skyBackground(part: DayPart, season: Season, ground: boolean, themeId?: string | null): string {
  const [top, bottom, g] = backdropColors(part, season, themeId)
  const sky = `linear-gradient(to bottom, ${top} 0%, ${bottom} 100%)`
  if (!ground) return sky
  return `linear-gradient(to bottom, transparent calc(100% - ${GROUND_PX}px), ${g} calc(100% - ${GROUND_PX}px)), ${sky}`
}
