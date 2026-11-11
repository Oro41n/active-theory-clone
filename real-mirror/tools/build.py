#!/usr/bin/env python3
"""Rebuild a byte-exact local mirror of activetheory.net for personal study.

Downloads the ORIGINAL engine bundle, scene data, geometry (.bin/.json),
textures (+ .ktx2 variants), the Basis/Draco decoders, worker and CMS JSON,
then writes an index.html with a tiny compatibility shim. The engine itself is
never modified. On a machine with a real GPU the result is indistinguishable
from the live site; on a software/headless renderer the heavy PBR scenes cannot
finish decoding (documented in ../README.md).

Usage:  python tools/build.py            # builds into ../site/
Requires: Python 3, Pillow (optional, for the software-preview variant only).
"""
import os, sys, json, re, urllib.request, urllib.parse, concurrent.futures, time, shutil

ORIGIN = 'https://activetheory.net'
GCS = 'https://storage.googleapis.com/activetheory-v6.appspot.com'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'}
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                 # .../real-mirror
SITE = os.path.join(ROOT, 'site')
CACHE = '1780406240914'


def q(u):
    return urllib.parse.quote(u, safe=':/?&=+%#')


def is_html(data):
    return len(data) < 8000 and data.lstrip()[:15].lower().startswith(b'<!doctype html')


def get(url, dst, retries=4):
    if os.path.exists(dst) and os.path.getsize(dst) > 300:
        return 'skip'
    last = None
    for a in range(retries):
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            data = urllib.request.urlopen(urllib.request.Request(q(url), headers=UA), timeout=60).read()
            if is_html(data):
                return '404'
            with open(dst, 'wb') as f:
                f.write(data)
            return 'ok'
        except Exception as e:
            last = e
            time.sleep(0.6 * (a + 1))
    print('  FAIL', dst, type(last).__name__, str(last)[:70])
    return 'fail'


def balanced_array(s, start):
    depth = 0; instr = False; esc = False
    for j in range(start, len(s)):
        c = s[j]
        if instr:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': instr = False
            continue
        if c == '"': instr = True
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                return s[start:j + 1]
    return ''


def main():
    os.makedirs(SITE, exist_ok=True)
    print('[1/6] core bundle + data')
    core = {
        f'assets/js/app.{CACHE}.js': f'{ORIGIN}/assets/js/app.{CACHE}.js',
        f'assets/js/modules.{CACHE}.js': f'{ORIGIN}/assets/js/modules.{CACHE}.js',
        f'assets/data/uil.{CACHE}.json': f'{ORIGIN}/assets/data/uil.{CACHE}.json',
        'assets/shaders/compiled.vs': f'{ORIGIN}/assets/shaders/compiled.vs',
        'assets/js/hydra/hydra-thread.js': f'{ORIGIN}/assets/js/hydra/hydra-thread.js',
        'assets/js/lib/basis_transcoder.js': f'{ORIGIN}/assets/js/lib/basis_transcoder.js',
        'assets/js/lib/basis_transcoder.wasm': f'{ORIGIN}/assets/js/lib/basis_transcoder.wasm',
        'assets/js/lib/_draco/draco_wasm_wrapper.js': f'{ORIGIN}/assets/js/lib/_draco/draco_wasm_wrapper.js',
        'assets/js/lib/_draco/draco_decoder.wasm': f'{ORIGIN}/assets/js/lib/_draco/draco_decoder.wasm',
        'assets/js/lib/_draco/draco_decoder.js': f'{ORIGIN}/assets/js/lib/_draco/draco_decoder.js',
        'assets/js/lib/qrious.js': f'{ORIGIN}/assets/js/lib/qrious.js',
        'assets/data/projects-dev.json': f'{GCS}/cms/projects-dev.json',
        'assets/data/metadata-dev.json': f'{GCS}/cms/metadata-dev.json',
        'assets/data/contact-dev.json': f'{GCS}/cms/contact-dev.json',
    }
    # Web fonts AND Hydra's BMFont data (JSON metrics + PNG glyph atlas) — the
    # engine draws text in WebGL using these, not only the woff2 files.
    for weight in ('Regular', 'Light', 'Bold'):
        stem = 'NBArchitektStd-' + weight
        core['assets/fonts/' + stem + '.woff2'] = ORIGIN + '/assets/fonts/' + stem + '-export/' + stem + '.woff2'
        core['assets/fonts/' + stem + '.json'] = ORIGIN + '/assets/fonts/' + stem + '.json'
        core['assets/fonts/' + stem + '.png'] = ORIGIN + '/assets/fonts/' + stem + '.png'
    for f in ['apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png', 'manifest.json']:
        core['assets/meta/' + f] = ORIGIN + '/assets/meta/' + f
    for rel, url in core.items():
        get(url, os.path.join(SITE, rel))

    print('[2/6] parse embedded asset manifests')
    bundle = open(os.path.join(SITE, f'assets/js/app.{CACHE}.js'), encoding='utf-8').read()
    geo = tex = []
    for name in ['window.UIL_ASSETS_GEOMETRIES', 'window.UIL_ASSETS_TEXTURES']:
        i = bundle.find(name + '=[')
        if i < 0:
            continue
        arr = balanced_array(bundle, bundle.find('[', i))
        pairs = re.findall(r'filename:"([^"]+)",bytes:(\d+)', arr)
        if 'GEOMETRIES' in name:
            geo = pairs
        else:
            tex = pairs
    print(f'       {len(geo)} geometry, {len(tex)} textures')

    print('[3/6] geometry + textures (this is the bulk, ~175 MB)')
    tasks = [(f'{ORIGIN}/assets/geometry/{f}', os.path.join(SITE, 'assets/geometry', f)) for f, _ in geo]
    tasks += [(f'{ORIGIN}/assets/images/{f}', os.path.join(SITE, 'assets/images', f)) for f, _ in tex]
    tasks += [(f'{ORIGIN}/assets/images/{f.rsplit(".", 1)[0]}.ktx2',
               os.path.join(SITE, 'assets/images', f.rsplit('.', 1)[0] + '.ktx2')) for f, _ in tex]
    counts = {'ok': 0, 'skip': 0, '404': 0, 'fail': 0}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(get, u, d) for u, d in tasks]
        for i, fut in enumerate(concurrent.futures.as_completed(futs)):
            counts[fut.result()] = counts.get(fut.result(), 0) + 1
            if (i + 1) % 50 == 0:
                print('       ', i + 1, '/', len(tasks), counts)
            time.sleep(0.05)
    print('       ', counts, '(404 = optional .ktx2 variants the origin does not ship)')

    print('[4/6] mirror assets into the worker directory (Hydra resolves relative paths there)')
    ensure_worker_paths()

    print('[5/6] write index.html with compatibility shim + GPU self-check page')
    write_index(os.path.join(ROOT, 'index.src.html'), os.path.join(SITE, 'index.html'))
    for extra in ('check-gpu.html',):
        src = os.path.join(ROOT, extra)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(SITE, extra))

    print('[6/6] apply the 41n content layer (edit tools/apply-41n.py to customise)')
    content = os.path.join(HERE, 'apply-41n.py')
    if os.path.exists(content):
        import subprocess as _sp
        _sp.run([sys.executable, content], check=False)
    else:
        print('       (apply-41n.py missing — mirror keeps original content)')

    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(SITE) for f in fs)
    print(f'       done. {total/1024/1024:.1f} MB in {SITE}')
    print('       run:  python tools/serve.py   then open http://127.0.0.1:8080')


def ensure_worker_paths():
    """Hydra's decode worker resolves `assets/images/...` relative to its own
    script directory (assets/js/hydra/), not the page root. On the origin this
    is masked by absolutePath(); with the software shim (or if absolutePath is
    ever bypassed) the worker 404s with 'Image not found'. Mirror the same tree
    under the worker dir. Use hard links when possible so it costs ~0 extra
    disk, and skip re-linking on repeated builds.
    """
    src_root = os.path.join(SITE, 'assets')
    dst_root = os.path.join(src_root, 'js', 'hydra', 'assets')
    linked = 0
    for sub in ('images', 'geometry'):
        sdir = os.path.join(src_root, sub)
        if not os.path.isdir(sdir):
            continue
        for dp, _, fs in os.walk(sdir):
            rel = os.path.relpath(dp, sdir)
            out = os.path.join(dst_root, sub, rel)
            os.makedirs(out, exist_ok=True)
            for f in fs:
                s = os.path.join(dp, f)
                d = os.path.join(out, f)
                if os.path.exists(d):
                    continue
                try:
                    os.link(s, d)          # hard link: no extra bytes on disk
                except OSError:
                    shutil.copy2(s, d)      # fallback if linking unsupported
                linked += 1
    print(f'       worker asset paths mirrored ({linked} new links; ~0 extra MB)')


def write_index(src, dst):
    """Inject the software-only shim into the original bootstrap HTML."""
    if os.path.exists(src):
        html = open(src, encoding='utf-8').read()
    else:
        html = urllib.request.urlopen(urllib.request.Request(ORIGIN + '/', headers=UA), timeout=30).read().decode('utf-8')
    shim = '''<script>
/* Personal-study mirror shim. On a REAL GPU every branch is a no-op and the
   original Hydra engine runs byte-for-byte like activetheory.net. On a SOFTWARE
   renderer it (a) spoofs the unmasked GPU string to pass the WebGL gate, (b)
   injects a fake compressed-texture extension so absolutePath() stays enabled,
   (c) keeps worker asset paths resolvable, and (d) redirects remote CMS to the
   mirrored copies. The engine bundle itself is NEVER modified. */
(function(){
  try { if (navigator.serviceWorker) navigator.serviceWorker.register=function(){return Promise.resolve({});}; } catch(e){}
  var spoofed=false;
  try {
    var gl=document.createElement('canvas').getContext('webgl2')||document.createElement('canvas').getContext('webgl');
    if(gl){var dbg=gl.getExtension('WEBGL_debug_renderer_info');var r=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'';
      if(/swiftshader|llvmpipe|software|microsoft basic/i.test(r)){
        spoofed=true;var U=dbg?dbg.UNMASKED_RENDERER_WEBGL:0x9246;
        function patchGet(proto,base){if(!proto)return;proto.getParameter=function(p){return p===U?'NVIDIA GeForce RTX 3080':base.apply(this,arguments);};}
        patchGet(WebGLRenderingContext.prototype,WebGLRenderingContext.prototype.getParameter);
        if(window.WebGL2RenderingContext)patchGet(WebGL2RenderingContext.prototype,WebGL2RenderingContext.prototype.getParameter);
        function patchExt(proto,base){if(!proto)return;proto.getSupportedExtensions=function(){var e=base.apply(this,arguments)||[];return e.indexOf('AT_instance_ext')<0?e.concat(['AT_instance_ext']):e;};}
        patchExt(WebGLRenderingContext.prototype,WebGLRenderingContext.prototype.getSupportedExtensions);
        if(window.WebGL2RenderingContext)patchExt(WebGL2RenderingContext.prototype,WebGL2RenderingContext.prototype.getSupportedExtensions);
      }
    }
  } catch(e){}
  window.__AT_MIRROR_SPOOF__=spoofed;
  var of=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==='string'){
      var m=u.match(/storage\\.googleapis\\.com\\/activetheory-v6\\.appspot\\.com\\/cms\\/(projects|metadata|contact)-[^?]+\\.json/);
      if(m)return of.call(this,'assets/data/'+m[1]+'-dev.json',o);
      if(u.indexOf('us-central1-at-services.cloudfunctions.net/geo')>=0)
        return Promise.resolve(new Response(JSON.stringify({location:{countryCode:'US'}}),{status:200,headers:{'Content-Type':'application/json'}}));
    }
    return of.apply(this,arguments);
  };
  try{window.localStorage.setItem('cookies_accepted','1');}catch(e){}
  // Headless/software VMs have no audio device; a rejected audio decode can
  // abort the intro-ready chain. Swallow it so the scene can still advance.
  if(spoofed)window.addEventListener('unhandledrejection',function(e){
    var r=e.reason||{};var m=String(r.message||r.name||r||'');
    if(/decode audio|EncodingError|AudioContext|audio data/i.test(m))e.preventDefault();
  });
})();
</script>
'''
    html = html.replace("<script>!function(){window._ENV_='production'", shim + "<script>!function(){window._ENV_='production'")
    open(dst, 'w', encoding='utf-8').write(html)


if __name__ == '__main__':
    main()
