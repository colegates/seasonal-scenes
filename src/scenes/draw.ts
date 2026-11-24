// Drawing primitives shared by every scene. Plain canvas 2D only: no
// roundRect, no ctx.filter, no shadowBlur. Wall panels often run an old
// Android WebView and all three are either missing or slow there.

export type Ctx = CanvasRenderingContext2D

export const TAU = Math.PI * 2

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Progress 0..1 of `t` through the window [a, b]. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeIn = (t: number) => t * t * t
/** Overshoots past 1 then settles. For things that pop into place. */
export const easeBack = (t: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}
/** A single bounce landing, 0..1. */
export const bounce = (t: number) => {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

// ─── Palette ─────────────────────────────────────────────────────────────────
// Tuned to sit on the app's deep navy: bright enough to read, never neon.

export const C = {
  white: '#f1f5f9',
  cream: '#fde9c9',
  ink: '#16233a',
  navy: '#1e3a5f',
  cyan: '#22d3ee',
  mint: '#5eead4',
  sky: '#7dd3fc',
  blue: '#3b82f6',
  green: '#4ade80',
  leaf: '#65a30d',
  forest: '#2f7d4f',
  yellow: '#fde047',
  gold: '#f5c542',
  amber: '#f59e0b',
  orange: '#fb923c',
  rust: '#c2571d',
  red: '#ef4444',
  crimson: '#be123c',
  pink: '#f9a8d4',
  rose: '#fb7185',
  purple: '#a78bfa',
  plum: '#7c3aed',
  brown: '#8b5a2b',
  tan: '#c8a06a',
  wood: '#a16207',
  grey: '#94a3b8',
  steel: '#64748b',
  slate: '#475569',
  brass: '#e3b341',
  maple: '#8a4b2a',
  skinA: '#f6c9a0',
  skinB: '#e0a376',
  skinC: '#b9774a',
  skinD: '#8a5a3a',
} as const

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mix a hex colour toward black (amt < 0) or white (amt > 0). amt in -1..1. */
export function shade(hex: string, amt: number): string {
  if (!hex.startsWith('#')) return hex
  const [r, g, b] = hexToRgb(hex)
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  const m = (v: number) => Math.round(v + (t - v) * p)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

export function alpha(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

// ─── Shapes ──────────────────────────────────────────────────────────────────

/** Rounded-rectangle path. Call fill()/stroke() afterwards. */
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + q, y)
  ctx.lineTo(x + w - q, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + q)
  ctx.lineTo(x + w, y + h - q)
  ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h)
  ctx.lineTo(x + q, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - q)
  ctx.lineTo(x, y + q)
  ctx.quadraticCurveTo(x, y, x + q, y)
  ctx.closePath()
}

export function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string) {
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

export function fillEll(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, rot = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU)
  ctx.fillStyle = color
  ctx.fill()
}

export function fillCirc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU)
  ctx.fillStyle = color
  ctx.fill()
}

/** Round-capped straight stroke. */
export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.strokeStyle = color
  ctx.stroke()
}

/** Round-capped polyline through the given points. */
export function poly(ctx: Ctx, pts: number[], width: number, color: string) {
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.stroke()
}

/** Filled closed polygon. */
export function fillPoly(ctx: Ctx, pts: number[], color: string) {
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

/** Soft contact shadow on the floor. Draw with the origin at ground level. */
export function groundShadow(ctx: Ctx, x: number, halfWidth: number, strength = 0.28) {
  fillEll(ctx, x, 1.5, halfWidth, Math.max(1.2, halfWidth * 0.16), `rgba(2,8,20,${strength})`)
}

/** A five-point star path centred on (x, y). */
export function star(ctx: Ctx, x: number, y: number, r: number, color: string, rot = 0, inner = 0.45) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 === 0 ? r : r * inner
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

/** A heart centred on (x, y), roughly 2r wide. */
export function heart(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.9)
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.8, y - r * 1.2, x, y - r * 0.4)
  ctx.bezierCurveTo(x + r * 0.8, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

/**
 * Run `fn` with the origin moved to (x, y) on the floor, scaled to character
 * units and optionally mirrored. Every character and prop is drawn through
 * this, so art is authored once, facing right, feet at y = 0, y negative up.
 */
export function at(ctx: Ctx, x: number, y: number, scale: number, facing: 1 | -1, fn: () => void, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  if (rot) ctx.rotate(rot)
  ctx.scale(scale * facing, scale)
  fn()
  ctx.restore()
}
