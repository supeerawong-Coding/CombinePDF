"""Check the exact source files GitHub Pages serves, without a build tool."""

import hashlib
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
VENDOR_SHA256 = "0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f"


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.stylesheets = 0
        self.scripts = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "link" and attrs.get("rel") in {"stylesheet", "icon"}:
            self.references.append(attrs["href"])
            self.stylesheets += attrs.get("rel") == "stylesheet"
        if tag == "script" and "src" in attrs:
            assert attrs.get("type") != "module", "Production scripts must run directly in a browser"
            assert "defer" in attrs, "Scripts must preserve ordered execution after HTML parsing"
            self.references.append(attrs["src"])
            self.scripts.append(attrs["src"])


def local_asset(reference):
    url = urlsplit(reference)
    assert not url.scheme and not url.netloc, f"External runtime asset: {reference}"
    assert not url.path.startswith("/"), f"Asset must use a relative URL: {reference}"
    path = (ROOT / unquote(url.path)).resolve()
    assert path.is_relative_to(ROOT) and path.is_file(), f"Missing local asset: {reference}"
    return path


def check():
    assets = Assets()
    assets.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    assert assets.stylesheets, "index.html must load its stylesheet directly"
    for reference in assets.references:
        local_asset(reference)
    assert "pdf-lib-1.17.1.min.js" in assets.scripts[0], "Load the PDF library before application code"
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    assert "@import" not in css, "CSS must not depend on package resolution"
    for reference in re.findall(r"url\(['\"]?([^)'\"]+)", css):
        local_asset(reference)
    javascript = (ROOT / "script.js").read_text(encoding="utf-8")
    assert not re.search(r"^\s*(?:import|export)\s", javascript, re.MULTILINE), "Unbuilt module import/export in script.js"
    assert (ROOT / ".nojekyll").is_file()
    assert (ROOT / "THIRD_PARTY_NOTICES.txt").is_file()
    vendor = ROOT / "assets/vendor/pdf-lib-1.17.1.min.js"
    assert hashlib.sha256(vendor.read_bytes()).hexdigest() == VENDOR_SHA256, "Unexpected PDF library contents"
    print("PASS: source HTML, styles, scripts, fonts, favicon and pinned PDF library are ready for direct static hosting")


if __name__ == "__main__":
    check()
