#!/usr/bin/env python3
"""Serve the rebuilt mirror with the MIME types Hydra expects."""
import http.server, socketserver, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
if not os.path.isdir(SITE):
    sys.exit('site/ not found — run `python tools/build.py` first')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SITE, **kw)
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript', '.wasm': 'application/wasm',
        '.json': 'application/json', '.vs': 'text/plain', '.glsl': 'text/plain',
        '.ktx2': 'image/ktx2', '.ktx': 'image/ktx', '.bin': 'application/octet-stream',
        '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml'}
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)

class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

print(f'serving {SITE} at http://127.0.0.1:{PORT}')
with S(('127.0.0.1', PORT), H) as httpd:
    httpd.serve_forever()
