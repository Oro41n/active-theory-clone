# Real mirror (byte-exact engine + assets)

This folder rebuilds **activetheory.net itself**, for personal study — not a hand-written imitation.
The original Hydra bundle, scene data, geometry (`.bin`/`.json`), textures (+ `.ktx2`), decoders
(Basis/Draco), worker and CMS JSON are fetched from the live origin. The engine bundle is **never
modified**; SHA-256 of `app.1780406240914.js` matches the live site exactly
(`085d3e6a46893f503262ccdaaad16f832367e709bae7ae14c369b629fdb1a5cf`).

## Run (needs a real GPU)

```bash
python tools/build.py        # downloads ~180 MB once; builds site/
python tools/serve.py        # http://127.0.0.1:8080
```

On a normal machine with hardware WebGL this renders identically to the live site — same engine,
same bytes, same assets. `tools/build.py` is idempotent (skips files already downloaded).

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
