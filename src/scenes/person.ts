import { C, TAU, fillCirc, fillEll, fillRR, line, poly, shade, type Ctx } from './draw'

// The little person every human character is built from. Authored facing
// right, feet at (0, 0), y negative up, about 64 units tall. Mirror and scale
// with `at()` from draw.ts.
//
// Big head, small body: the proportions that still read at 60px on a wall
// panel across a kitchen.

export type Hat =
  | 'none'
  | 'flatcap'
  | 'bobble'
  | 'santa'
  | 'witch'
  | 'helmet'
  | 'scrumcap'
  | 'beret'
  | 'tophat'
  | 'party'
  | 'cap'
  | 'elf'
  | 'crown'
  | 'chef'
  | 'earmuffs'
  | 'sunhat'

export interface Look {
  skin: string
  top: string
  bottom: string
  shoe?: string
  hair?: string
  hairStyle?: 'short' | 'long' | 'bald' | 'bun' | 'curly'
  hat?: Hat
  hatColor?: string
  /** Second hat colour: bobble, band, stripe. */
  hatTrim?: string
  scarf?: string
  beard?: string
  moustache?: string
  glasses?: boolean
  goggles?: string
  /** Horizontal hoops across the top, rugby-shirt style. */
  hoops?: string
  apron?: string
  /** A pack worn on the back. */
  pack?: string
  /** Short sleeves and shorts show skin on the limbs. */
  shorts?: boolean
  gloves?: string
}

export interface Pose {
  /** Walk cycle phase in radians. Advance by about 9 per second at a stroll. */
  walk?: number
  /** 0 standing still, 1 full stride. */
  stride?: number
  /** Absolute arm angles: 0 hangs straight down, +PI/2 points forward, PI straight up. */
  armF?: number
  armB?: number
  /** Elbow bend, positive folds the forearm forward/up. */
  elbowF?: number
  elbowB?: number
  /** Body tilt, positive leans forward. */
  lean?: number
  /** 0..1 bends the knees. */
  crouch?: number
  headTilt?: number
  mouth?: 'smile' | 'o' | 'grin' | 'flat' | 'puff' | 'frown'
  blink?: boolean
  /** Raise the whole figure off the floor (jumping). Units. */
  lift?: number
  /** Eyes: 'wide' for surprise, 'closed' for bliss or sleep. */
  eyes?: 'normal' | 'wide' | 'closed'
}

export interface Pt {
  x: number
  y: number
}

export interface Anchors {
  handF: Pt
  handB: Pt
  elbowF: Pt
  elbowB: Pt
  shoulder: Pt
  hip: Pt
  head: Pt
  /** Top of the skull, for things balanced on the head. */
  crown: Pt
  mouth: Pt
  footF: Pt
  footB: Pt
  /** Middle of the back, for packs and capes. */
  back: Pt
  lean: number
}

const THIGH = 9
const SHIN = 9.5
const TORSO = 17
const UPPER = 7.5
const FORE = 7.5
const HEAD_R = 11

function legPoints(hipX: number, phase: number, stride: number, crouch: number) {
  const swing = Math.sin(phase) * 0.62 * stride + crouch * 0.55
  const bend = Math.max(0, -Math.cos(phase)) * 0.95 * stride + crouch * 1.25
  const kx = hipX + Math.sin(swing) * THIGH
  const ky = Math.cos(swing) * THIGH
  const fx = kx + Math.sin(swing - bend) * SHIN
  const fy = ky + Math.cos(swing - bend) * SHIN
  return { kx, ky, fx, fy }
}

/** Where the joints are for a pose, without drawing anything. */
export function personAnchors(pose: Pose = {}): Anchors {
  const walk = pose.walk ?? 0
  const stride = pose.stride ?? 0
  const crouch = pose.crouch ?? 0
  const lean = pose.lean ?? 0
  const lf = legPoints(1.5, walk, stride, crouch)
  const lb = legPoints(-1.5, walk + Math.PI, stride, crouch)
  const hipY = -Math.max(lf.fy, lb.fy) - 1.6 - (pose.lift ?? 0)
  const hip = { x: 0, y: hipY }
  const up = (d: number, side = 0): Pt => ({
    x: hip.x + Math.sin(lean) * d + Math.cos(lean) * side,
    y: hip.y - Math.cos(lean) * d + Math.sin(lean) * side,
  })
  const shoulder = up(TORSO - 2)
  const head = up(TORSO + HEAD_R - 1.5, 1)
  const armSwing = Math.sin(walk) * 0.65 * stride
  const aF = pose.armF ?? -armSwing + lean * 0.4
  const aB = pose.armB ?? armSwing + lean * 0.4
  const eF = pose.elbowF ?? 0.25 + stride * 0.35
  const eB = pose.elbowB ?? 0.25 + stride * 0.35
  const arm = (a: number, e: number) => {
    const ex = shoulder.x + Math.sin(a) * UPPER
    const ey = shoulder.y + Math.cos(a) * UPPER
    return {
      elbow: { x: ex, y: ey },
      hand: { x: ex + Math.sin(a + e) * FORE, y: ey + Math.cos(a + e) * FORE },
    }
  }
  const f = arm(aF, eF)
  const b = arm(aB, eB)
  const tilt = lean * 0.5 + (pose.headTilt ?? 0)
  return {
    handF: f.hand,
    handB: b.hand,
    elbowF: f.elbow,
    elbowB: b.elbow,
    shoulder,
    hip,
    head,
    crown: { x: head.x + Math.sin(tilt) * HEAD_R, y: head.y - Math.cos(tilt) * HEAD_R },
    mouth: {
      x: head.x + Math.cos(tilt) * 9 - Math.sin(tilt) * 5,
      y: head.y + Math.sin(tilt) * 9 + Math.cos(tilt) * 5,
    },
    footF: { x: lf.fx, y: hipY + lf.fy },
    footB: { x: lb.fx, y: hipY + lb.fy },
    back: up(TORSO * 0.55, -8),
    lean,
  }
}

function drawLeg(ctx: Ctx, look: Look, hip: Pt, hipX: number, phase: number, stride: number, crouch: number, far: boolean) {
  const l = legPoints(hipX, phase, stride, crouch)
  const base = look.shorts ? look.skin : look.bottom
  const col = far ? shade(base, -0.22) : base
  poly(ctx, [hip.x + hipX, hip.y, l.kx, hip.y + l.ky, l.fx, hip.y + l.fy], 5.2, col)
  if (look.shorts) {
    // Shorts cover the top of the thigh.
    line(ctx, hip.x + hipX, hip.y, hip.x + hipX + (l.kx - hipX) * 0.6, hip.y + l.ky * 0.6, 6.4, far ? shade(look.bottom, -0.22) : look.bottom)
  }
  const shoe = look.shoe ?? C.ink
  fillEll(ctx, l.fx + 2, hip.y + l.fy + 0.2, 4.6, 2.5, far ? shade(shoe, -0.2) : shoe)
}

function drawArm(ctx: Ctx, look: Look, shoulder: Pt, elbow: Pt, hand: Pt, far: boolean) {
  const sleeve = far ? shade(look.top, -0.24) : shade(look.top, -0.08)
  const skin = far ? shade(look.skin, -0.18) : look.skin
  if (look.shorts) {
    poly(ctx, [shoulder.x, shoulder.y, elbow.x, elbow.y, hand.x, hand.y], 4.2, skin)
    line(ctx, shoulder.x, shoulder.y, (shoulder.x + elbow.x) / 2, (shoulder.y + elbow.y) / 2, 5, sleeve)
  } else {
    poly(ctx, [shoulder.x, shoulder.y, elbow.x, elbow.y, hand.x, hand.y], 4.6, sleeve)
  }
  fillCirc(ctx, hand.x, hand.y, 2.7, look.gloves ? (far ? shade(look.gloves, -0.2) : look.gloves) : skin)
}

function drawHat(ctx: Ctx, look: Look) {
  const hat = look.hat ?? 'none'
  const col = look.hatColor ?? C.red
  const trim = look.hatTrim ?? C.white
  const R = HEAD_R
  switch (hat) {
    case 'none':
      return
    case 'flatcap': {
      ctx.beginPath()
      ctx.moveTo(-R - 0.5, -3)
      ctx.quadraticCurveTo(-R, -R - 5, 2, -R - 3)
      ctx.quadraticCurveTo(R + 2, -R - 1, R + 6.5, -4.5)
      ctx.quadraticCurveTo(R, -5.5, -R - 0.5, -3)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      line(ctx, R - 2, -5, R + 6, -4.6, 1.6, shade(col, -0.3))
      return
    }
    case 'bobble': {
      ctx.beginPath()
      ctx.arc(0, -2, R + 0.8, Math.PI, TAU)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      fillRR(ctx, -R - 1.2, -5.5, R * 2 + 2.4, 4.6, 2.2, trim)
      fillCirc(ctx, -1, -R - 4.2, 3.6, trim)
      return
    }
    case 'santa': {
      ctx.beginPath()
      ctx.moveTo(-R - 0.5, -4)
      ctx.quadraticCurveTo(-R + 2, -R - 9, 3, -R - 5)
      ctx.quadraticCurveTo(-R - 4, -R - 6, -R - 9, -R + 5)
      ctx.quadraticCurveTo(-R - 2, -R - 1, -R + 1, -4)
      ctx.lineTo(R + 0.5, -4)
      ctx.quadraticCurveTo(R, -R - 2, 3, -R - 5)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      fillRR(ctx, -R - 1.4, -6.2, R * 2 + 2.8, 5, 2.5, C.white)
      fillCirc(ctx, -R - 9, -R + 6, 3.2, C.white)
      return
    }
    case 'witch': {
      fillEll(ctx, 0, -6.5, R + 9, 3.4, shade(col, -0.15), -0.06)
      ctx.beginPath()
      ctx.moveTo(-R + 1.5, -7)
      ctx.quadraticCurveTo(-3, -R - 12, 5, -R - 20)
      ctx.quadraticCurveTo(-2, -R - 21, -7, -R - 16)
      ctx.quadraticCurveTo(1, -R - 14, R - 2, -7)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      fillRR(ctx, -R + 1.6, -10.5, R * 2 - 3.5, 3.2, 1, trim)
      fillRR(ctx, 1, -10.9, 4, 4, 0.8, C.gold)
      return
    }
    case 'helmet': {
      ctx.beginPath()
      ctx.arc(-0.5, -1.5, R + 1.6, Math.PI * 0.98, Math.PI * 2.02)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      ctx.beginPath()
      ctx.arc(-0.5, -1.5, R + 1.6, Math.PI * 1.25, Math.PI * 1.55)
      ctx.lineWidth = 1.6
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'
      ctx.lineCap = 'round'
      ctx.stroke()
      fillRR(ctx, -R - 1.5, -3, 5, 6, 2, shade(col, -0.25))
      return
    }
    case 'scrumcap': {
      ctx.beginPath()
      ctx.arc(-0.5, -0.5, R + 1, Math.PI * 0.85, Math.PI * 1.98)
      ctx.lineTo(R - 4, -4)
      ctx.lineTo(-3, -3)
      ctx.lineTo(-4, 6)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      for (let i = -1; i <= 1; i++) fillCirc(ctx, i * 5 - 1, -R + 3 + Math.abs(i) * 1.2, 1.1, shade(col, -0.35))
      line(ctx, -5, 6, 2, 10.5, 1.3, shade(col, -0.2))
      return
    }
    case 'beret': {
      fillEll(ctx, -2.5, -R + 1, R + 2.5, 5.2, col, -0.22)
      fillRR(ctx, -R + 1, -R + 3.4, R * 2 - 3, 2.6, 1.3, shade(col, -0.25))
      line(ctx, -3, -R - 4, -2, -R - 6.5, 1.5, col)
      return
    }
    case 'tophat': {
      fillRR(ctx, -R - 2.5, -R + 1.5, R * 2 + 5, 3.2, 1.6, col)
      fillRR(ctx, -R + 2.5, -R - 14, R * 2 - 5, 16, 1.5, col)
      fillRR(ctx, -R + 2.5, -R - 2.5, R * 2 - 5, 3.4, 0.5, trim)
      return
    }
    case 'party': {
      ctx.beginPath()
      ctx.moveTo(-7.5, -R + 3.5)
      ctx.lineTo(1.5, -R - 17)
      ctx.lineTo(8.5, -R + 2)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      line(ctx, -4.4, -R - 3.5, 6.2, -R - 4.6, 2, trim)
      line(ctx, -1.6, -R - 10, 3.8, -R - 10.6, 2, trim)
      fillCirc(ctx, 1.5, -R - 17.5, 2.6, trim)
      return
    }
    case 'cap': {
      ctx.beginPath()
      ctx.arc(-0.5, -3, R + 0.6, Math.PI, TAU)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      fillRR(ctx, R - 3, -5.4, 10.5, 2.8, 1.4, shade(col, -0.2))
      fillCirc(ctx, -0.5, -R - 3.8, 1.2, trim)
      return
    }
    case 'elf': {
      ctx.beginPath()
      ctx.moveTo(-R, -4)
      ctx.quadraticCurveTo(-R + 3, -R - 8, -R - 7, -R - 12)
      ctx.quadraticCurveTo(R - 2, -R - 9, R, -4)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      for (let i = 0; i < 4; i++) {
        const x = -R + 1 + i * 6.8
        ctx.beginPath()
        ctx.moveTo(x - 3.5, -6)
        ctx.lineTo(x, -1.5)
        ctx.lineTo(x + 3.5, -6)
        ctx.closePath()
        ctx.fillStyle = trim
        ctx.fill()
      }
      fillCirc(ctx, -R - 7.5, -R - 12, 2.2, C.gold)
      return
    }
    case 'crown': {
      ctx.beginPath()
      ctx.moveTo(-8, -R + 3)
      ctx.lineTo(-9.5, -R - 7)
      ctx.lineTo(-4.5, -R - 2.5)
      ctx.lineTo(0, -R - 9)
      ctx.lineTo(4.5, -R - 2.5)
      ctx.lineTo(9.5, -R - 7)
      ctx.lineTo(8, -R + 3)
      ctx.closePath()
      ctx.fillStyle = col
      ctx.fill()
      fillCirc(ctx, 0, -R, 1.5, trim)
      return
    }
    case 'chef': {
      fillCirc(ctx, -5, -R - 8, 5.6, C.white)
      fillCirc(ctx, 1, -R - 10, 6.2, C.white)
      fillCirc(ctx, 6, -R - 7.5, 5.2, C.white)
      fillRR(ctx, -7.5, -R - 6, 15, 9.5, 1.5, C.white)
      fillRR(ctx, -7.5, -R + 1, 15, 2.6, 1, shade(C.white, -0.14))
      return
    }
    case 'earmuffs': {
      ctx.beginPath()
      ctx.arc(-1, -1, R + 1.8, Math.PI * 1.08, Math.PI * 1.82)
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.strokeStyle = shade(col, -0.3)
      ctx.stroke()
      fillEll(ctx, -3.5, 1, 4.2, 5.2, col)
      fillEll(ctx, -3.5, 1, 2.2, 3, shade(col, 0.25))
      return
    }
    case 'sunhat': {
      fillEll(ctx, 0, -6, R + 8, 3.2, col, -0.05)
      ctx.beginPath()
      ctx.arc(0, -6, R - 1.5, Math.PI, TAU)
      ctx.closePath()
      ctx.fillStyle = shade(col, 0.12)
      ctx.fill()
      fillRR(ctx, -R + 1.5, -9.2, R * 2 - 3, 2.6, 1, trim)
      return
    }
  }
}

function drawHead(ctx: Ctx, look: Look, pose: Pose) {
  const R = HEAD_R
  const hair = look.hair ?? C.brown
  const style = look.hairStyle ?? 'short'
  // Hair that falls behind the head.
  if (style === 'long') fillRR(ctx, -R - 1.5, -6, 9, R + 12, 4.5, hair)
  if (style === 'bun') fillCirc(ctx, -R - 0.5, -R + 3, 4.6, hair)
  // Ear, then skull.
  fillCirc(ctx, 0, 0, R, look.skin)
  // Soft shading down the back of the head gives it some roundness.
  ctx.beginPath()
  ctx.arc(0, 0, R, Math.PI * 0.55, Math.PI * 1.25)
  ctx.quadraticCurveTo(-R * 0.45, 0, Math.cos(Math.PI * 0.55) * R, Math.sin(Math.PI * 0.55) * R)
  ctx.closePath()
  ctx.fillStyle = shade(look.skin, -0.12)
  ctx.fill()
  fillEll(ctx, -3.2, 1.2, 2.3, 3, shade(look.skin, -0.16))
  // Nose and cheek.
  fillEll(ctx, R + 0.4, 2, 2.5, 2.1, shade(look.skin, -0.08))
  fillEll(ctx, 4, 4.6, 2.8, 1.9, 'rgba(244,114,128,0.32)')
  // Hair on top.
  if (style !== 'bald') {
    ctx.beginPath()
    ctx.arc(0, 0, R + 0.5, Math.PI * 0.92, Math.PI * 1.86)
    ctx.quadraticCurveTo(4, -R + 4.5, -1, -R + 4)
    ctx.quadraticCurveTo(-6.5, -R + 4.5, -6.5, 0.5)
    ctx.closePath()
    ctx.fillStyle = hair
    ctx.fill()
    if (style === 'curly') {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (1.0 + i * 0.16)
        fillCirc(ctx, Math.cos(a) * (R + 0.5), Math.sin(a) * (R + 0.5), 3.4, hair)
      }
    }
  }
  // Eyes.
  const eyes = pose.blink ? 'closed' : (pose.eyes ?? 'normal')
  if (eyes === 'closed') {
    for (const ex of [4.6, 9]) {
      ctx.beginPath()
      ctx.arc(ex, -1.6, 1.6, Math.PI * 0.1, Math.PI * 0.9)
      ctx.lineWidth = 1.1
      ctx.lineCap = 'round'
      ctx.strokeStyle = C.ink
      ctx.stroke()
    }
  } else {
    const r = eyes === 'wide' ? 2.5 : 1.75
    if (eyes === 'wide') {
      fillCirc(ctx, 4.6, -2, r + 0.9, C.white)
      fillCirc(ctx, 9, -2, r + 0.4, C.white)
    }
    fillCirc(ctx, 4.9, -1.8, r * 0.9, C.ink)
    fillCirc(ctx, 9.1, -1.8, r * 0.75, C.ink)
    fillCirc(ctx, 5.5, -2.5, 0.6, C.white)
    fillCirc(ctx, 9.5, -2.4, 0.5, C.white)
  }
  // Mouth.
  const m = pose.mouth ?? 'smile'
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.strokeStyle = shade(look.skin, -0.55)
  if (m === 'o') fillEll(ctx, 7.6, 5.6, 1.7, 2.1, shade(look.skin, -0.6))
  else if (m === 'puff') {
    fillCirc(ctx, 6.2, 5, 3.6, look.skin)
    fillEll(ctx, 10, 5.4, 1.2, 1.5, shade(look.skin, -0.6))
  } else if (m === 'grin') {
    ctx.beginPath()
    ctx.arc(7, 3.6, 3.4, Math.PI * 0.08, Math.PI * 0.92)
    ctx.closePath()
    ctx.fillStyle = C.white
    ctx.fill()
    ctx.stroke()
  } else if (m === 'flat') {
    ctx.beginPath()
    ctx.moveTo(5, 5.6)
    ctx.lineTo(9.4, 5.4)
    ctx.stroke()
  } else if (m === 'frown') {
    ctx.beginPath()
    ctx.arc(7.2, 8, 2.8, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(7, 3.4, 3, Math.PI * 0.12, Math.PI * 0.8)
    ctx.stroke()
  }
  if (look.moustache) {
    fillEll(ctx, 8.6, 4.2, 3.6, 1.5, look.moustache, 0.25)
  }
  if (look.beard) {
    ctx.beginPath()
    ctx.moveTo(-3, 4)
    ctx.quadraticCurveTo(-1, R + 6, 6, R + 3)
    ctx.quadraticCurveTo(R + 2, R, R - 0.5, 5.5)
    ctx.quadraticCurveTo(6, 9, 3, 4.5)
    ctx.closePath()
    ctx.fillStyle = look.beard
    ctx.fill()
  }
  drawHat(ctx, look)
  if (look.goggles) {
    fillRR(ctx, -R, -5.2, R * 2 + 0.5, 2.4, 1, shade(look.goggles, -0.35))
    fillRR(ctx, 1.6, -6.4, 10.6, 7.2, 3, look.goggles)
    fillRR(ctx, 3, -5.2, 5, 2, 1, 'rgba(255,255,255,0.55)')
  } else if (look.glasses) {
    ctx.lineWidth = 1
    ctx.strokeStyle = C.ink
    ctx.beginPath()
    ctx.arc(4.8, -1.8, 3, 0, TAU)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(9.6, -1.8, 2.5, 0, TAU)
    ctx.stroke()
    line(ctx, 1.8, -2.2, -4, -2.6, 1, C.ink)
  }
}

/**
 * Draw the figure and return where its joints ended up, so the caller can put
 * a prop in a hand or a bubble at the mouth. To draw something behind the
 * figure (a pack, a cape, a tool carried on the far side) pass `behind`: it
 * runs after the far arm and far leg, before the body.
 */
export function drawPerson(ctx: Ctx, look: Look, pose: Pose = {}, behind?: (a: Anchors) => void): Anchors {
  const a = personAnchors(pose)
  const walk = pose.walk ?? 0
  const stride = pose.stride ?? 0
  const crouch = pose.crouch ?? 0
  drawArm(ctx, look, a.shoulder, a.elbowB, a.handB, true)
  drawLeg(ctx, look, a.hip, -1.5, walk + Math.PI, stride, crouch, true)
  if (look.pack) {
    ctx.save()
    ctx.translate(a.hip.x, a.hip.y)
    ctx.rotate(a.lean)
    fillRR(ctx, -14.5, -TORSO + 1, 8, 14, 3, look.pack)
    fillRR(ctx, -13.5, -TORSO + 3, 6, 3, 1.5, shade(look.pack, 0.2))
    ctx.restore()
  }
  behind?.(a)
  drawLeg(ctx, look, a.hip, 1.5, walk, stride, crouch, false)
  // Torso, drawn in a frame hinged at the hip.
  ctx.save()
  ctx.translate(a.hip.x, a.hip.y)
  ctx.rotate(a.lean)
  fillRR(ctx, -8, -TORSO - 1.5, 16, TORSO + 4.5, 7, look.top)
  if (look.hoops) {
    for (let i = 0; i < 3; i++) fillRR(ctx, -8, -TORSO + 2.5 + i * 5.2, 16, 2.4, 0.5, look.hoops)
  }
  // Shade the back edge so the body turns.
  fillRR(ctx, -8, -TORSO + 2, 3.6, TORSO - 2, 1.8, shade(look.top, -0.14))
  fillRR(ctx, -8, -2.5, 16, 5.5, 2.6, look.bottom)
  if (look.apron) {
    fillRR(ctx, 0.5, -TORSO + 3, 8, TORSO + 1, 2, look.apron)
    line(ctx, 2, -TORSO + 3, -2, -TORSO - 1, 1.2, look.apron)
  }
  if (look.scarf) {
    fillRR(ctx, -7.5, -TORSO - 3.2, 15.5, 4.6, 2.3, look.scarf)
    const flap = Math.sin(walk * 1.3) * 2 * (0.3 + stride)
    poly(ctx, [-6, -TORSO - 1, -11, -TORSO + 4 + flap, -13, -TORSO + 9 - flap], 3.6, look.scarf)
  }
  ctx.restore()
  // Head.
  ctx.save()
  ctx.translate(a.head.x, a.head.y)
  ctx.rotate(a.lean * 0.5 + (pose.headTilt ?? 0))
  drawHead(ctx, look, pose)
  ctx.restore()
  drawArm(ctx, look, a.shoulder, a.elbowF, a.handF, false)
  return a
}

// ─── A small cast, so the same faces turn up in different scenes ─────────────

export const CAST = {
  grandad: {
    skin: C.skinA, top: '#5b7a4a', bottom: '#5a4632', shoe: '#2a2018', hair: C.grey,
    hat: 'flatcap', hatColor: '#7a6a52', moustache: C.grey,
  },
  mum: {
    skin: C.skinA, top: '#e0607e', bottom: '#33507a', shoe: '#22344f', hair: '#7a3f1d', hairStyle: 'long',
  },
  dad: {
    skin: C.skinA, top: '#2f80c2', bottom: '#3d4a5c', shoe: '#1f2937', hair: '#4a3421', beard: '#4a3421',
  },
  kid: {
    skin: C.skinA, top: C.yellow, bottom: '#2b6cb0', shoe: C.red, hair: '#b8742a', hairStyle: 'curly',
  },
  girl: {
    skin: C.skinB, top: C.purple, bottom: '#334155', shoe: C.pink, hair: '#2a1a10', hairStyle: 'bun',
  },
  gardener: {
    skin: C.skinB, top: '#d97706', bottom: '#44536a', shoe: '#3b2a1a', hair: '#3b2a1a',
    hat: 'earmuffs', hatColor: C.red,
  },
} satisfies Record<string, Look>
