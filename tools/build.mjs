// Bundle the card into one file for Home Assistant.
// usage: node tools/build.mjs [--watch]
import * as esbuild from 'esbuild-wasm'
import fs from 'fs'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const options = {
  entryPoints: ['src/card.ts'],
  bundle: true,
  format: 'esm',
  // Wall panels often run an old Android WebView: keep the syntax modest.
  target: 'es2019',
  minify: true,
  legalComments: 'none',
  outfile: 'dist/seasonal-scenes.js',
  define: { __VERSION__: JSON.stringify(pkg.version) },
  banner: { js: `/*! seasonal-scenes ${pkg.version} | GPL-3.0 | https://github.com/colegates/seasonal-scenes */` },
  logLevel: 'info',
}

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
} else {
  await esbuild.build(options)
  const size = fs.statSync(options.outfile).size
  console.log(`${options.outfile}: ${(size / 1024).toFixed(0)} KiB`)
}
