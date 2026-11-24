# Making acts

Thank you for wanting to add to the cast. New acts, themes, holidays from your
part of the world and new hobbies are all welcome.

## Getting set up

```sh
npm install
npm run build        # dist/seasonal-scenes.js
npm run watch        # rebuild on save
npm test             # calendar, programme and card smoke tests
npm run typecheck
```

To try a build in Home Assistant, copy `dist/seasonal-scenes.js` to
`config/www/` and add it as a dashboard resource (see the README), then set
`preview_theme` on the card to play your theme's acts back to back.

## How it fits together

| File | What it is |
|---|---|
| `src/card.ts` | The Lovelace card: config, Home Assistant state, card and overlay modes. |
| `src/programme.ts` | Which themes play, hobby filtering, boosts. |
| `src/sky.ts` | The card's backdrop. |
| `src/scenes/engine.ts` | The canvas, the clock, the casting of acts, sleeping when idle. |
| `src/scenes/themes.ts` | Every theme, its weather and how often it gets the stage. |
| `src/scenes/director.ts` | Picks the theme for each 20-minute slot and the next act. |
| `src/scenes/calendar.ts` | Season, time of day, holidays, birthdays. |
| `src/scenes/types.ts` | `Stage`, `Act`, `ActDef`, `AmbientDef`, `SceneContext`. |
| `src/scenes/draw.ts` | Drawing primitives, easings and the palette `C`. |
| `src/scenes/person.ts` | The little-person rig: `drawPerson(ctx, look, pose)` and the `CAST`. |
| `src/scenes/creatures.ts` | Dog, squirrel, bird. |
| `src/scenes/kit.ts` | `makeAct`, `crossing`, speech bubbles, banners, sweat drops, bursts. |
| `src/scenes/particles.ts` | Falling and settling weather, the pile, `blast` and `sweep`. |
| `src/scenes/acts/*.ts` | The acts, one file per theme. **`autumn.ts` is the reference.** |

## The rules every act follows

- **Characters face right with their feet at (0, 0), y up is negative,** in art
  units (a person is about 64 units tall). Always draw through
  `at(ctx, xPx, stage.ground, stage.u, dir, () => { ... })`. Things moving
  across the screen move in CSS pixels per second multiplied by `stage.u`,
  never in fractions of `stage.w`, or the act will rush across wide screens.
- **Screens run from 360 to 1920 pixels wide.** Never hard-code x positions;
  use fractions of `stage.w`. Keep a cast within about 300 px so it fits a
  phone.
- **Stay low.** Keep the action in the bottom 130 px or so. Small, quick things
  may fly higher (a golf ball, a firework, a balloon), but nothing big should
  hang over the middle of a dashboard.
- **End properly.** Return `false` from `update` once everyone has left. Aim
  for 8 to 25 seconds. Leave nothing behind but particles and the pile.
- **A beginning, a gag and an exit,** and at least two random variants decided
  in `create` with the `rng` argument. The surprise is the point: the hat that
  blows off, the dog that steals the ball, the leaves that blow back.
- **Old browsers.** No `ctx.roundRect`, no `ctx.filter`, no `shadowBlur`, no
  `Path2D` strings, no images. Paths, fills, strokes, `globalAlpha` and
  (sparingly) gradients only. Restore `globalAlpha` to 1 and balance every
  `save()` with a `restore()`.
- **Text** only through `bubble()`, `banner()` and `zzz()`, a word or two at most.
- **Performance:** at most about 120 particles of your own at once, no big
  allocations per frame, no timers, no DOM.
- **Colour:** bright, slightly soft colours that read on a dark navy page and
  on the mid-blue daytime sky.

## Checking your act without a browser

Render it as a contact sheet and look at it:

```sh
node tools/preview.mjs --list
node tools/preview.mjs autumn.leaf-blower --times 1,4,8,12 --ambient AUTUMN_AMBIENT --fill 0.8
node tools/preview.mjs golf.tee-shot --w 390 --daypart morning --season summer --seed 2
```

Then run the simulator over it at wall-panel, phone and desktop sizes:

```sh
SEEDS=1,2,3 node tools/lint.mjs golf.
```

It reports how long the act runs, whether it ends, whether it throws, how high
and how wide it goes, and whether a tidy-up act really clears the pile. CI runs
it over every act on each pull request.

## Releasing

Bump `version` in `package.json`, add a line to `CHANGELOG.md`, commit, and push
a matching tag (`git tag v1.1.0 && git push --tags`). The release workflow
builds the card and publishes the release that HACS installs.
