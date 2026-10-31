"""Optional local preview and test server; never needed by the deployed website."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class StaticHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/CombinePDF/"):
            self.path = self.path[len("/CombinePDF"):]
        super().do_GET()

    def log_message(self, *_args):
        pass


def create_server(port=0):
    return ThreadingHTTPServer(("127.0.0.1", port), partial(StaticHandler, directory=str(ROOT)))


if __name__ == "__main__":
    with create_server(5173) as server:
        print("Preview: http://127.0.0.1:5173/CombinePDF/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
