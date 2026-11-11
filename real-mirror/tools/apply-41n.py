#!/usr/bin/env python3
"""Apply the '41n Design Collection' content layer to the byte-exact mirror.

CONTENT ONLY. The Hydra engine bundle, geometry, textures, shaders, models,
UIL scene graph, transitions and every effect are left byte-for-byte intact.
Only the CMS JSON text/media fields, a handful of UIL text3d strings and the
HTML <title>/meta copy are rewritten.

Idempotent & self-contained: every run starts from the pristine baseline in
../content/original/ (tracked in git), so it can be applied to any freshly
built mirror. It also regenerates the local 41n media from the six AI covers
in ../../assets/img/ (tracked) — no third-party images are shipped.

Usage:
  python tools/apply-41n.py              # apply the 41n content layer
  python tools/apply-41n.py --restore    # put the original site content back
  python tools/apply-41n.py --report     # print the content mapping table
"""
import json, os, re, shutil, sys, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # .../real-mirror
SITE = os.path.join(ROOT, 'site')
DATA = os.path.join(SITE, 'assets', 'data')
ORIG = os.path.join(ROOT, 'content', 'original')  # tracked pristine baseline
MEDIA = os.path.join(SITE, 'assets', '41n')
COVERS = os.path.join(os.path.dirname(ROOT), 'assets', 'img')  # repo covers

# --- 41n Design Collection: 65 works -----------------------------------------
# A coherent fictional design portfolio. slug stays untouched per item so the
# engine's work/{slug} detail routes keep working.
WORKS = [
    ("Aurora Identity",      "41n Studio",        "Branding, Identity",      "2026"),
    ("Monolith Type",        "Self-initiated",    "Typography, Editorial",   "2026"),
    ("Drift Poster Series",  "41n Studio",        "Poster, Print",           "2025"),
    ("Signal / Noise",       "Independent",       "Motion, Sound",           "2025"),
    ("Terrain Grid",         "Atlas Editions",    "Data, Editorial",         "2025"),
    ("Echo Chamber",         "Self-initiated",    "Installation, Type",      "2025"),
    ("Prism Marks",          "Lumen Co.",         "Identity, Symbol",        "2025"),
    ("Fold / Unfold",        "41n Studio",        "Editorial, Print",        "2024"),
    ("Halo Specimens",       "Foundry Type",      "Typography, Digital",     "2024"),
    ("Nocturne Packaging",   "Nord Atelier",      "Packaging, Print",        "2024"),
    ("Vector Fields",        "Self-initiated",    "Generative, Poster",      "2024"),
    ("Quiet Systems",        "Studio Meridian",   "Design System, Web",      "2024"),
    ("Chroma Studies",       "41n Studio",        "Color, Print",            "2024"),
    ("Orbit Guidelines",     "Orbital Labs",      "Branding, Guidelines",     "2023"),
    ("Paper Mechanics",      "Fold Press",        "Print, Binding",           "2023"),
    ("Gradient Atlas",       "Self-initiated",    "Editorial, Web",           "2023"),
    ("Modular Marks",        "North Brand",       "Identity, Grid",           "2023"),
    ("Still / Motion",       "Framehouse",        "Motion, Identity",         "2023"),
    ("Offset Impressions",   "Ink & Co.",         "Print, Poster",            "2023"),
    ("Lattice Covers",       "Volume Magazine",   "Editorial, Cover",         "2023"),
    ("Soft Geometry",        "41n Studio",        "3D, Poster",               "2022"),
    ("Counterforms",         "Foundry Type",      "Typography, Specimen",     "2022"),
    ("Night Edition",        "Nocturne Press",    "Editorial, Print",         "2022"),
    ("Wayfinding 01",        "Civic Lab",         "Signage, System",          "2022"),
    ("Emblem Set",           "Union Works",       "Identity, Icon",           "2022"),
    ("Rhythm Studies",       "Self-initiated",    "Motion, Grid",             "2022"),
    ("Index / Append",       "Atlas Editions",    "Editorial, Index",         "2022"),
    ("Blue Hour",            "41n Studio",        "Photography, Print",       "2021"),
    ("Signal Fragments",     "Independent",       "Generative, Type",         "2021"),
    ("Grain & Grid",         "Ink & Co.",         "Print, Texture",           "2021"),
    ("Axis Posters",         "Studio Meridian",   "Poster, Grid",             "2021"),
    ("Silent Marks",         "North Brand",       "Identity, Symbol",         "2021"),
    ("Folio 09",             "Fold Press",        "Editorial, Portfolio",     "2021"),
    ("Kinetic Letters",      "Foundry Type",      "Typography, Motion",       "2021"),
    ("Surface Tension",      "Lumen Co.",         "3D, Material",             "2020"),
    ("Monochrome set",       "Self-initiated",    "Print, Series",            "2020"),
    ("Open Grid",            "Civic Lab",         "Design System, Web",       "2020"),
    ("Refraction",           "Orbital Labs",      "Identity, 3D",             "2020"),
    ("Marginalia",           "Volume Magazine",   "Editorial, Type",          "2020"),
    ("Counterprint",         "Ink & Co.",         "Print, Experiment",        "2020"),
    ("Phase Shift",          "41n Studio",        "Motion, Poster",           "2020"),
    ("Field Notes",          "Atlas Editions",    "Editorial, Field",         "2019"),
    ("Baseline",             "Foundry Type",      "Typography, Grid",         "2019"),
    ("Negative Space",       "Self-initiated",    "Poster, Minimal",          "2019"),
    ("Two Weights",          "North Brand",       "Identity, Type",           "2019"),
    ("Overlay",              "Framehouse",        "Motion, Layer",            "2019"),
    ("Edition One",          "Nocturne Press",    "Print, First",             "2019"),
    ("Diagram Set",          "Civic Lab",         "Information, System",      "2019"),
    ("Raw Format",           "Independent",       "Editorial, Raw",           "2018"),
    ("Letter / Form",        "Foundry Type",      "Typography, Specimen",     "2018"),
    ("Interval",             "Studio Meridian",   "Identity, Rhythm",         "2018"),
    ("Slow Motion",          "Framehouse",        "Motion, Study",            "2018"),
    ("Paper Weight",         "Fold Press",        "Print, Material",          "2018"),
    ("Corner Marks",         "41n Studio",        "Branding, Detail",         "2018"),
    ("Blank Series",         "Self-initiated",    "Minimal, Series",          "2017"),
    ("Grid Dissolve",        "Orbital Labs",      "Generative, Grid",         "2017"),
    ("Type Specimen 01",     "Foundry Type",      "Typography, Specimen",     "2017"),
    ("Small Press",          "Ink & Co.",         "Print, Independent",       "2017"),
    ("Frame Study",          "Framehouse",        "Layout, Study",            "2017"),
    ("First Principles",     "41n Studio",        "Identity, Foundation",     "2016"),
    ("Studio Index",         "Self-initiated",    "Archive, Index",           "2016"),
    ("Colour Register",      "Ink & Co.",         "Print, Colour",            "2016"),
    ("Weight & Counter",     "Foundry Type",      "Typography, Weight",       "2015"),
    ("Open Archive",         "41n Studio",        "Archive, Web",             "2015"),
    ("First Mark",           "Self-initiated",    "Identity, Origin",         "2015"),
]

DESC = [
    "An identity system built from light, contrast and a single continuous line. Type, motion and print share one grammar.",
    "A type-led visual language exploring how much can be removed before a brand stops speaking. Specimen, grid and application.",
    "A series of large-format posters where drifting particle fields become typographic texture. Printed in three offset passes.",
    "Sound translated into moving form. Each frequency band drives a different layer of the composition, so no two loops repeat.",
    "A data-driven editorial system turning abstract terrain measurements into a readable landscape of contours and grids.",
    "An installation where letterforms fold into themselves. Viewers walk through layers of reflection, repetition and memory.",
    "A family of prismatic marks that shift hue with angle and scale, carried across stationery, signage and screen.",
    "A book about the act of folding. The binding, the sequence and the type all follow the same crease pattern.",
    "A variable type specimen presented as luminous ring forms, drifting slowly across a dark field.",
    "Packaging for a fragrance line, built around one quiet gesture: a single foil line crossing a matte surface.",
    "Generative vector fields plotted as a poster series. Each print is a unique seed from the same rule set.",
    "A design system for a small studio: restrained components, generous space, and a grid that stays invisible.",
    "A study in colour as structure rather than decoration. Six palettes, six editorial objects.",
    "Brand guidelines for a research lab, expressed as orbital diagrams rather than a rulebook.",
    "A print experiment in paper mechanics — folds, die-cuts and reveals that change the reading order.",
    "An online atlas of gradients, documented with the same care normally reserved for type specimens.",
    "A modular identity assembled from a small set of marks. Every application is a different configuration.",
    "One mark, two states. The identity exists only in the transition between stillness and motion.",
    "Offset printing pushed until registration becomes the subject. Misalignment is the design.",
    "Twelve covers built on the same lattice, each resolving a different visual problem.",
    "Soft 3D forms rendered as if they were printed matter. A poster series about weight and light.",
    "A specimen focused on the space inside and around letters — the counterforms as the real subject.",
    "A night-themed editorial object using only black, one warm grey and a single fluorescent ink.",
    "A wayfinding system for a public building, reduced to arrows, numbers and one very clear typeface.",
    "A set of emblems for a makers' union. Drawn on a 12-unit grid, legible at 8mm.",
    "Short motion studies where rhythm is carried by spacing, not by easing or speed.",
    "An index that became a book. Structure, cross-reference and the poetry of lists.",
    "Photographs taken in the blue hour, sequenced as a wordless printed narrative.",
    "Fragments of a signal rearranged into typographic compositions. Type as interference.",
    "A print series about the collision of halftone grain and hard geometric grids.",
    "Posters built from one axis. Rotation, repetition and scale do all the work.",
    "An identity that speaks quietly: small marks, wide margins, no raised voices.",
    "A portfolio object where every spread is a different folio experiment.",
    "Letterforms that assemble themselves. A kinetic specimen for a display typeface.",
    "Material studies in glass, chrome and light, rendered as flat printed surfaces.",
    "A monochrome series where value, not hue, carries the entire composition.",
    "An open design system published as a website — the grid itself is the interface.",
    "An identity refracted through a prism. The same mark, split into its spectral parts.",
    "Marginal notes promoted to the main column. An editorial experiment in hierarchy.",
    "Printing against the grain: overprints, reversals and deliberate errors as a system.",
    "A poster that changes as you move past it. Phase, not animation, does the work.",
    "Field notes typeset as an editorial object. Observation, annotation, sequence.",
    "A type specimen reduced to the baseline. Everything above it is negotiable.",
    "A minimal poster series where the empty area is the argument.",
    "An identity built from exactly two weights, used with unusual discipline.",
    "Layered motion studies where transparency carries the composition.",
    "The first object from a small press. One ink, one fold, one idea.",
    "An information system of diagrams and captions for a civic archive.",
    "An intentionally raw editorial format: visible defaults, no polish, honest structure.",
    "A specimen pairing one letter with one form, repeated across a grid of variations.",
    "An identity where the interval between elements is the recognisable part.",
    "Slow motion studies for a film studio, built from long holds and single cuts.",
    "A print object about paper itself: weight, grain, opacity and edge.",
    "The small details of a brand — corners, joins, endpoints — collected as a system.",
    "A series of nearly blank compositions. Presence defined by what is withheld.",
    "Generative grids dissolving at their edges, plotted as large-format prints.",
    "The first specimen from an independent type foundry, drawn over one winter.",
    "A tiny publication about independent publishing, printed and bound by hand.",
    "Layout studies in a single frame. Same elements, different order, new meaning.",
    "The founding identity: a mark, a grid and a sentence about first principles.",
    "An index of the studio's own output — the archive as the first project.",
    "A colour register printed as a standalone object: every separation on its own sheet.",
    "A type study in optical weight, where the counterform sets the rhythm of the page.",
    "The archive opened as a website — everything findable, nothing over-explained.",
    "The first mark the studio ever drew, kept as the starting point of the collection.",
]

PALETTE = ['3aa0ff','8a8bcf','e08a5a','5ad0c0','7a9e6e','c96a8a','6f8fd6',
           'd4a24c','9b7fd4','4fb0b8','c47b8e','7fa65c','5a8fd8','c98f6b','8f8fd0','a8b45c','d07a9a','5f9ea0']
MEDIA_COUNT = 18   # assets/41n/work-00..17.jpg


def rel(path):  # URL relative to the site root
    return 'assets/41n/' + path


def build_media():
    """Regenerate the 41n media from the six tracked AI covers (18 variants)
    plus a tiny local placeholder mp4. Nothing is downloaded; fully offline."""
    global MEDIA_COUNT
    os.makedirs(MEDIA, exist_ok=True)
    covers = [os.path.join(COVERS, x + '.jpg') for x in
              ('aurora-lab','monolith','drift','signal-noise','terrain','echo-chamber')]
    covers = [c for c in covers if os.path.exists(c)]
    if not covers:
        raise SystemExit('41n covers not found in %s — cannot build media' % COVERS)
    try:
        from PIL import Image, ImageEnhance
        n = 0
        for f in covers:
            im = Image.open(f).convert('RGB')
            w, h = im.size
            for v in (im,
                      ImageEnhance.Color(im).enhance(0.55),
                      im.crop((int(w*.12), int(h*.08), int(w*.88), int(h*.92))).resize((w, h))):
                v.save(os.path.join(MEDIA, 'work-%02d.jpg' % n), quality=84, optimize=True)
                n += 1
    except ImportError:
        # Pillow missing: fall back to plain copies of the six covers
        for i, f in enumerate(covers):
            shutil.copy(f, os.path.join(MEDIA, 'work-%02d.jpg' % i))
        n = len(covers)
    MEDIA_COUNT = n
    # placeholder video (optional — the site still works with a missing file,
    # but generating it keeps every referenced URL resolvable)
    mp4 = os.path.join(MEDIA, 'preview.mp4')
    if not os.path.exists(mp4):
        try:
            subprocess.run(['ffmpeg','-y','-loglevel','error','-loop','1','-i',
                os.path.join(MEDIA,'work-00.jpg'),'-t','4','-vf',
                'scale=960:600:force_original_aspect_ratio=increase,crop=960:600,'
                "zoompan=z='min(zoom+0.0008,1.06)':d=1:s=960x600:fps=24",
                '-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-r','24',mp4],
                check=True, capture_output=True, timeout=120)
        except Exception as e:
            print('  (ffmpeg unavailable, preview.mp4 skipped:', str(e)[:60], ')')
    return len([f for f in os.listdir(MEDIA) if f.endswith('.jpg')])


def rewrite_media(obj, idx, seen):
    """Replace every remote media URL with a local 41n asset, recursively."""
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if isinstance(v, str) and v.startswith('https://storage.googleapis.com/'):
                low = v.lower()
                if low.endswith(('.mp4', '.webm', '.mov')):
                    obj[k] = rel('preview.mp4')
                else:
                    obj[k] = rel('work-%02d.jpg' % (idx % MEDIA_COUNT))
                seen[0] += 1
            else:
                rewrite_media(v, idx, seen)
    elif isinstance(obj, list):
        for v in obj:
            rewrite_media(v, idx, seen)


def swap_html_copy(to41n=True):
    """Swap only the visible page copy in index.html, leaving the compatibility
    shim (injected by build.py) and every script tag exactly where it is.
    Idempotent in both directions."""
    hp = os.path.join(SITE, 'index.html')
    if not os.path.exists(hp):
        return
    html = open(hp, encoding='utf-8').read()
    TITLE_41 = '41n — Design Collection'
    TITLE_ORIG = 'Active Theory · Creative Digital Experiences'
    DESC_41 = 'A personal design collection by 41n. Identity, typography, editorial, motion and generative work.'
    DESC_ORIG = ('Founded in 2012. We blend story, art & technology as an in-house team of '
                 'passionate makers. Our industry-leading web toolset consistently delivers '
                 'award-winning work through quality & performance. ')
    SOCIAL_41 = 'assets/41n/work-00.jpg'
    SOCIAL_ORIG = 'https://storage.googleapis.com/activetheory-v6.appspot.com/media/social.jpg'
    if to41n:
        pairs = [(TITLE_ORIG, TITLE_41), (SOCIAL_ORIG, SOCIAL_41)]
        new_title, new_desc = TITLE_41, DESC_41
    else:
        pairs = [(TITLE_41, TITLE_ORIG), (SOCIAL_41, SOCIAL_ORIG)]
        new_title, new_desc = TITLE_ORIG, DESC_ORIG
    for a, b in pairs:
        html = html.replace(a, b)
    html = re.sub(r'<title>[^<]*</title>', '<title>' + new_title + '</title>', html)
    html = re.sub(r'(<meta name="description" content=")[^"]*(")',
                  lambda m: m.group(1) + new_desc + m.group(2), html)
    html = re.sub(r'(<meta property="og:title" content=")[^"]*(")',
                  lambda m: m.group(1) + new_title + m.group(2), html)
    html = re.sub(r'(<meta property="twitter:title" content=")[^"]*(")',
                  lambda m: m.group(1) + new_title + m.group(2), html)
    open(hp, 'w', encoding='utf-8').write(html)


def baseline():
    """Start from the pristine, tracked copy so repeated runs are idempotent."""
    os.makedirs(DATA, exist_ok=True)
    # Restore the four data files from the pristine tracked baseline.
    # index.html is NOT overwritten: build.py injects the compatibility shim
    # into it, so we only swap its text in-place (see swap_html_copy).
    for f in ('projects-dev.json','metadata-dev.json','contact-dev.json',
              'uil.1780406240914.json'):
        src = os.path.join(ORIG, f)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(DATA, f))


def apply():
    baseline()
    nmedia = build_media()
    # --- projects ---
    pp = os.path.join(DATA, 'projects-dev.json')
    projects = json.load(open(pp, encoding='utf-8'))
    assert len(WORKS) == len(DESC) == len(projects), (
        'content list / project count mismatch: %d works, %d descs, %d projects'
        % (len(WORKS), len(DESC), len(projects)))
    seen = [0]
    for i, p in enumerate(projects):
        name, client, tags, year = WORKS[i]
        p['name'] = name
        p['clientName'] = client
        p['description'] = DESC[i]
        p['tags'] = tags
        p['completionDate'] = year + '-06-01T12:00:00.000Z'
        p['uiColor'] = PALETTE[i % len(PALETTE)]
        # external case-study / project links → internal work detail routes
        for k in ('projectURL', 'caseStudyURL'):
            if p.get(k):
                p[k] = '#/work/' + p['slug']
        # recurse over the WHOLE project: projectLogo, video, stats, image
        # and any other nested media field the CMS happens to carry
        for k in list(p.keys()):
            if k in ('name', 'clientName', 'description', 'tags', 'slug'):
                continue
            rewrite_media(p[k], i, seen)
        if isinstance(p.get('video'), dict):
            p['video']['thumbnail'] = rel('work-%02d.jpg' % (i % MEDIA_COUNT))
    json.dump(projects, open(pp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # --- metadata ---
    mp = os.path.join(DATA, 'metadata-dev.json')
    meta = json.load(open(mp, encoding='utf-8'))
    meta['title'] = '41n — Design Collection'
    meta['description'] = 'A personal design collection by 41n. Identity, typography, editorial, motion and generative work — assembled as one continuous space.'
    rewrite_media(meta, 0, seen)
    json.dump(meta, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # --- contact ---
    cp = os.path.join(DATA, 'contact-dev.json')
    contact = json.load(open(cp, encoding='utf-8'))
    contact['links'] = [
        {'title': 'Email', 'url': 'mailto:hello@41n.design', 'id': '41n-c1'},
        {'title': 'GitHub', 'url': 'https://github.com/Oro41n', 'id': '41n-c2'},
        {'title': 'Instagram', 'url': 'https://instagram.com/', 'id': '41n-c3'},
        {'title': 'Behance', 'url': 'https://behance.net/', 'id': '41n-c4'},
        {'title': 'Are.na', 'url': 'https://are.na/', 'id': '41n-c5'},
    ]
    json.dump(contact, open(cp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # --- UIL text3d (the big 3D headline / about / lab / detail copy) ---
    up = os.path.join(DATA, 'uil.1780406240914.json')
    uil = json.load(open(up, encoding='utf-8'))
    TEXT = {
        'INPUT_Element_3_About_text3d_text': '41n\nDesign\nCollection',
        'INPUT_Element_4_About_text3d_text':
            'A personal design collection\n\nIdentity, typography, editorial, motion and generative work\n\nAssembled as one continuous space to move through',
        'INPUT_Element_4_Home_text3d_text': 'Scroll to explore',
        'INPUT_Element_15_CleanRoom_text3d_text': '// THE\n41N LAB ->',
        'INPUT_Element_20_CleanRoom_text3d_text':
            'a working archive of experiments, where sketches turn into finished pieces',
        'INPUT_Element_5_WorkDetailContent_text3d_text': '41N DESIGN COLLECTION',
        'INPUT_Element_7_WorkDetailContent_text3d_text': 'Scroll to close',
        'INPUT_Element_8_WorkDetailContent_text3d_text': '41N | DESIGN | COLLECTION',
    }
    applied = []
    for k, v in TEXT.items():
        if k in uil:
            uil[k] = v
            applied.append(k)
    json.dump(uil, open(up, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # --- index.html title / meta (in-place, shim preserved) ---
    swap_html_copy(to41n=True)

    print('41n content applied:')
    print('  works rewritten      :', len(projects))
    print('  remote media -> local:', seen[0])
    print('  UIL text3d fields    :', len(applied))
    print('  local 41n media      :', nmedia, 'images + preview.mp4')
    print('  HTML title/meta      : done')
    print('  engine bytes touched : 0')


def restore():
    baseline()
    swap_html_copy(to41n=False)
    print('original site content restored (baseline from ../content/original/)')


def report():
    """Human-readable content mapping — what changed and where to edit it."""
    print('41n Design Collection — content mapping')
    print('=' * 66)
    print('FILE                                  FIELD / LOCATION        CONTENT')
    print('-' * 66)
    print('assets/data/projects-dev.json         name (65)               41n work titles')
    print('                                      description (65)        41n blurbs')
    print('                                      clientName / tags       41n clients & categories')
    print('                                      completionDate          2015-2026')
    print('                                      uiColor                 18-color 41n palette')
    print('                                      slug                    UNCHANGED (keeps work/{slug} routes)')
    print('                                      projectLogo/video/stats  -> local assets/41n/*')
    print('assets/data/metadata-dev.json         title / description     "41n — Design Collection"')
    print('assets/data/contact-dev.json          links                   41n email & socials')
    print('assets/data/uil.1780406240914.json    text3d_text (8)         3D scene headlines')
    print('index.html                            <title> / meta          41n branding')
    print('-' * 66)
    print('UNTOUCHED: app.js (SHA 085d3e6a...), geometry, textures, shaders,')
    print('models, UIL scene graph, transitions, all effects & interactions.')
    print()
    print('To edit content: change WORKS / DESC in tools/apply-41n.py, then re-run it.')
    print('To switch back : python tools/apply-41n.py --restore')
    print()
    print('Sample works:')
    for i in (0, 1, 2, 3, 4, 5, 20, 40, 64):
        print('  %2d. %-24s %-18s %s' % (i+1, *WORKS[i][:3]))


if __name__ == '__main__':
    if '--restore' in sys.argv:
        restore()
    elif '--report' in sys.argv:
        report()
    else:
        apply()
