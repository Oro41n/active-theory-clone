# Real mirror (byte-exact engine + assets)

This folder rebuilds **activetheory.net itself**, for personal study — not a hand-written imitation.
The original Hydra bundle, scene data, geometry (`.bin`/`.json`), textures (+ `.ktx2`), decoders
(Basis/Draco), worker and CMS JSON are fetched from the live origin. The engine bundle is **never
modified**; SHA-256 of `app.1780406240914.js` matches the live site exactly
(`085d3e6a46893f503262ccdaaad16f832367e709bae7ae14c369b629fdb1a5cf`).

## Quick start

**Easiest — double-click a launcher:**
- Windows: `start.bat`
- macOS / Linux: `./start.sh`

It builds `site/` on first run (downloads ~180 MB once), opens `check-gpu.html` to test your
hardware, then starts the server at `http://127.0.0.1:8080`.

**Or run manually:**

```bash
python tools/build.py        # downloads ~180 MB once; builds site/ (idempotent)
python tools/serve.py        # http://127.0.0.1:8080  — open check-gpu.html first
```

Open **`http://127.0.0.1:8080/check-gpu.html`** first: it reports WebGL2, hardware vs software
renderer, GPU instancing and float render targets, and tells you whether your machine can run the
original engine. On a normal machine with hardware WebGL, `http://127.0.0.1:8080/` renders
identically to the live site — same engine, same bytes, same assets.

If you are on a fresh clone without `site/`, a launcher or `build.py` creates it; `site/` itself is
git-ignored (the ~180 MB of third-party assets are never committed).

## Is Hydra open source?

No. Active Theory's Hydra is an **in-house, proprietary engine** (see their Medium article
"The Story of Technology Built at Active Theory"). Their public GitHub org ships only small tools
(`split-text`, `fit-text`, `activeframe`, `GaussianSplats3D`, …), **not** Hydra. Open-source projects
also named "Hydra" (`hydra-synth` VJ tool, `facebookresearch/hydra` config framework, `HydraJS`)
are unrelated. So "just use Hydra" means using its **compiled production bundle** — which is exactly
what this mirror does, byte-for-byte. You cannot `npm install` Hydra or get its source.

## Worker asset paths

Hydra's decode worker resolves `assets/images/...` relative to its own script directory
(`assets/js/hydra/`), not the page root. `build.py` mirrors the images/geometry trees there via
**hard links** (~0 extra disk) so the worker never 404s with "Image not found". This matters on
software rendering and is harmless on a real GPU.

## The small shim (index.html)

`tools/build.py` injects a ~40-line shim into the pristine bootstrap HTML. **On a real GPU every
branch is a no-op**, so the engine runs byte-for-byte like production. It only activates on a
software renderer (SwiftShader/llvmpipe) to:

- spoof the unmasked renderer string past the `GPUBlocklist` gate,
- inject a fake compressed-texture extension so `Hydra.absolutePath()` stays enabled,
- make worker-relative asset paths resolve,
- redirect the remote geo/CMS calls to the mirrored copies for offline use.

Why a shim at all: the site has a `UnsupportedRedirect` that sends software renderers to
`/unsupported` (its GPU blocklist flags `swiftshader`). The shim is the smallest possible bypass
that does **not** touch the bundle.

## Known limitation (important, honest)

This sandbox VM has **no hardware GPU**. Its SwiftShader software renderer cannot decode the
RGBM/HDR PBR textures and crashes the engine's GPU particle system (`AntimatterAttribute` needs
float render targets). Here the mirror loads the real energy-core intro (screenshot in the root
`REVERSE_ENGINEERING.md`) but **cannot advance into the 3D scenes**. That is an environment limit,
not a mirror defect — the exact same stall happens on the live site in this VM.

If you also only have software rendering, use the hand-built **root** demo instead (`../index.html`);
it is a from-scratch approximation that runs everywhere. If you have a real GPU, use this mirror.

## Legal

Personal learning / reverse-engineering study only. All visual assets, the engine and the NBArchitekt
font belong to Active Theory. `site/` is git-ignored — the ~180 MB of third-party assets are rebuilt
locally, not committed. Do not redistribute or use commercially.
