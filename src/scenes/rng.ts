import type { Rng } from './types'

/** Small, fast, seedable PRNG. Same seed, same sequence, on every device. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length) % items.length]
export const range = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo)
export const chance = (rng: Rng, p: number) => rng() < p

export function weighted<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T | undefined {
  let total = 0
  for (const it of items) total += Math.max(0, weightOf(it))
  if (total <= 0) return undefined
  let r = rng() * total
  for (const it of items) {
    r -= Math.max(0, weightOf(it))
    if (r <= 0) return it
  }
  return items[items.length - 1]
}
