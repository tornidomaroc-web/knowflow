#!/usr/bin/env python3
"""
A deliberately slow HTTP endpoint for ios-smoke.yml's background-request
measurement. It reads the whole request body, logs when and how much arrived,
waits `delay` seconds (the stand-in for the ingestion service's 80 s on a 4 MB
text), then answers 200 with CORS for https://tryknowflow.com, and logs whether
the answer could be written. It stores nothing and runs only on the CI runner,
behind a throwaway quick tunnel that dies with the job.

Usage: python3 .github/scripts/slow-endpoint.py <log file> [port]
"""
import http.server
import json
import sys
import time
from urllib.parse import parse_qs, urlparse

LOG = open(sys.argv[1], 'a', buffering=1)
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8787


def now():
    return int(time.time() * 1000)


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        pass

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', 'https://tryknowflow.com')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        rid = q.get('id', ['?'])[0]
        delay = min(float(q.get('delay', ['60'])[0]), 90.0)
        t0 = time.time()
        LOG.write(f'{now()} req {rid} started\n')
        size = int(self.headers.get('Content-Length', '0'))
        got = 0
        while got < size:
            chunk = self.rfile.read(min(65536, size - got))
            if not chunk:
                break
            got += len(chunk)
        LOG.write(f'{now()} req {rid} body {got}/{size} bytes in {time.time() - t0:.1f} s; holding {delay:.0f} s\n')
        time.sleep(delay)
        body = json.dumps({'ok': True, 'id': rid, 'bytes': got}).encode()
        try:
            self.send_response(200)
            self.cors()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
            LOG.write(f'{now()} res {rid} written\n')
        except Exception as e:  # the client went away
            LOG.write(f'{now()} res {rid} write failed: {type(e).__name__}\n')


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
