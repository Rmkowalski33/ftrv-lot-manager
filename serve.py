"""Simple HTTP server for testing the PWA locally."""
import http.server
import socketserver
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"  {args[0]}")


print(f"Serving PWA at http://localhost:{PORT}")
print("Press Ctrl+C to stop.\n")

with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
