"""Browser regression tests for the source files, with no bundler or build step."""

import io
import os
import tempfile
import threading
import unittest
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from pypdf import PdfReader, PdfWriter

from serve import ROOT, create_server


def pdf(name, widths=(400,), encrypted=False):
    writer = PdfWriter()
    for width in widths:
        writer.add_blank_page(width=width, height=600)
    if encrypted:
        writer.encrypt("synthetic-test-password")
    buffer = io.BytesIO()
    writer.write(buffer)
    return {"name": name, "mimeType": "application/pdf", "buffer": buffer.getvalue()}


class BrowserChecks:
    mobile = False
    viewport = {"width": 1440, "height": 900}

    @classmethod
    def setUpClass(cls):
        cls.server = create_server()
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/CombinePDF/"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel=os.environ.get("PLAYWRIGHT_CHANNEL") or None)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def setUp(self):
        self.context = self.browser.new_context(viewport=self.viewport, is_mobile=self.mobile, has_touch=self.mobile)
        self.page = self.context.new_page()
        self.page.goto(self.url)

    def tearDown(self):
        failures = self._outcome.result.failures + self._outcome.result.errors
        if any(case is self for case, _error in failures):
            target = ROOT / "test-results" / f"{self.id()}.png"
            target.parent.mkdir(exist_ok=True)
            self.page.screenshot(path=str(target), scale="css")
        self.context.close()

    def add(self, files):
        self.page.locator("#file-input").set_input_files(files)
        expect(self.page.locator("#drop-zone")).to_be_enabled()

    def download(self):
        with self.page.expect_download() as event:
            self.page.locator("#combine-button").click()
        return event.value

    def test_assets_and_keyboard(self):
        errors, missing, external = [], [], []
        self.page.on("pageerror", lambda error: errors.append(str(error)))
        self.page.on("response", lambda response: missing.append(response.url) if response.status >= 400 else None)
        self.page.on("request", lambda request: external.append(request.url) if not request.url.startswith(self.url.split("/CombinePDF/")[0]) else None)
        self.page.reload()
        self.page.evaluate("document.fonts.ready")
        self.assertEqual(self.page.locator(".workspace-grid").evaluate("el => getComputedStyle(el).display"), "grid")
        expect(self.page.locator("#combine-button")).to_be_disabled()
        self.page.keyboard.press("Tab")
        expect(self.page.get_by_role("link", name="ข้ามไปพื้นที่รวมไฟล์")).to_be_focused()
        self.page.keyboard.press("Enter")
        self.page.keyboard.press("Tab")
        expect(self.page.locator("#drop-zone")).to_be_focused()
        with self.page.expect_file_chooser() as chooser:
            self.page.keyboard.press("Enter")
        chooser.value.set_files(pdf("keyboard.pdf"))
        expect(self.page.locator("#total-files")).to_have_text("1")
        self.assertEqual((errors, missing, external), ([], [], []))

    def test_merge_order_and_repeat_download(self):
        outgoing = []
        self.page.on("request", lambda request: outgoing.append(request.url) if request.method != "GET" else None)
        self.add([pdf("first.pdf", (410, 420)), pdf("second.pdf", (510,))])
        expect(self.page.locator("#total-pages")).to_have_text("3")
        self.page.get_by_role("button", name="เลื่อนขึ้น second.pdf", exact=True).click()
        expect(self.page.locator(".file-name")).to_have_text(["second.pdf", "first.pdf"])
        self.page.locator("#output-name").fill("รายงานประจำเดือน.pdf")
        download = self.download()
        self.assertEqual(download.suggested_filename, "รายงานประจำเดือน.pdf")
        self.assertEqual([float(page.mediabox.width) for page in PdfReader(download.path()).pages], [510, 410, 420])
        with self.page.expect_download() as repeated:
            self.page.locator("#download-link").click()
        self.assertEqual(repeated.value.suggested_filename, "รายงานประจำเดือน.pdf")
        self.assertEqual(outgoing, [])

    def test_invalid_and_encrypted_pdfs(self):
        self.add([
            pdf("valid.pdf"),
            {"name": "notes.txt", "mimeType": "text/plain", "buffer": b"not a PDF"},
            {"name": "fake.pdf", "mimeType": "application/pdf", "buffer": b"not a PDF"},
            {"name": "broken.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.7\ntruncated"},
            pdf("locked.pdf", encrypted=True),
        ])
        expect(self.page.locator(".file-row")).to_have_count(4)
        expect(self.page.locator(".has-error")).to_have_count(3)
        expect(self.page.locator("#file-list")).to_contain_text("ไฟล์เข้ารหัสหรือติดรหัสผ่าน")
        expect(self.page.locator("#message")).to_contain_text("รองรับเฉพาะไฟล์ PDF")
        expect(self.page.locator("#combine-button")).to_be_disabled()
        for name in ("fake.pdf", "broken.pdf", "locked.pdf"):
            self.page.get_by_role("button", name=f"ลบไฟล์ {name}", exact=True).click()
        self.add(pdf("another.pdf"))
        expect(self.page.locator("#combine-button")).to_be_enabled()

    def test_duplicates_remove_clear_and_reselect(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "same.pdf"
            path.write_bytes(pdf("same.pdf")["buffer"])
            self.add(str(path))
            self.add(str(path))
            expect(self.page.locator(".file-row")).to_have_count(1)
            expect(self.page.locator("#message")).to_contain_text("อยู่ในรายการแล้ว")
            self.page.get_by_role("button", name="ลบไฟล์ same.pdf", exact=True).click()
            expect(self.page.locator("#empty-state")).to_be_visible()
            self.add(str(path))
            self.page.locator("#clear-button").click()
            expect(self.page.locator("#drop-zone")).to_be_focused()
            expect(self.page.locator("#total-pages")).to_have_text("0")
            self.add(str(path))
            expect(self.page.locator(".file-row")).to_have_count(1)

    def test_drop_without_mime_and_safe_long_name(self):
        file = pdf("<img src=x onerror=alert(1)>-รายงานประจำเดือนที่มีชื่อยาวมาก.PDF")
        transfer = self.page.evaluate_handle("""data => {
          const transfer = new DataTransfer();
          transfer.items.add(new File([new Uint8Array(data.bytes)], data.name, {type:''}));
          return transfer;
        }""", {"name": file["name"], "bytes": list(file["buffer"])})
        self.page.locator("#drop-zone").dispatch_event("drop", {"dataTransfer": transfer})
        expect(self.page.locator("#total-files")).to_have_text("1")
        expect(self.page.locator(".file-name")).to_have_text(file["name"])
        expect(self.page.locator("#file-list img")).to_have_count(0)
        self.assertTrue(self.page.locator(".file-row").evaluate("row => row.getBoundingClientRect().right <= row.parentElement.getBoundingClientRect().right + 1"))

    def test_busy_controls_and_merge_error_recovery(self):
        self.page.evaluate("""() => {
          const read = File.prototype.arrayBuffer;
          File.prototype.arrayBuffer = async function() {
            await new Promise(resolve => setTimeout(resolve, 200));
            return read.call(this);
          };
        }""")
        self.page.locator("#file-input").set_input_files([pdf("one.pdf"), pdf("two.pdf")])
        for selector in ("#drop-zone", "#clear-button", "#output-name"):
            expect(self.page.locator(selector)).to_be_disabled()
        expect(self.page.locator("#drop-zone")).to_be_enabled()
        self.page.evaluate("() => { File.prototype.arrayBuffer = async () => {throw new Error('Synthetic read error');}; }")
        self.page.locator("#combine-button").click()
        expect(self.page.locator("#message")).to_contain_text("ไม่สำเร็จ")
        expect(self.page.locator(".has-error")).to_have_count(1)
        expect(self.page.locator("#result-panel")).to_be_hidden()
        self.page.locator("#clear-button").click()
        expect(self.page.locator("#empty-state")).to_be_visible()

    def test_download_name_and_url_cleanup(self):
        self.page.evaluate("""() => {
          const revoke = URL.revokeObjectURL.bind(URL);
          window.revokedUrls = [];
          URL.revokeObjectURL = url => {window.revokedUrls.push(url); revoke(url);};
        }""")
        self.add([pdf("one.pdf"), pdf("two.pdf")])
        self.page.locator("#output-name").fill("bad/name:report.pdf")
        self.assertEqual(self.download().suggested_filename, "bad_name_report.pdf")
        url = self.page.locator("#download-link").get_attribute("href")
        self.page.locator("#clear-button").click()
        expect(self.page.locator("#result-panel")).to_be_hidden()
        self.assertIn(url, self.page.evaluate("window.revokedUrls"))

    def test_size_and_count_limits(self):
        source = pdf("source.pdf")
        self.page.evaluate("""() => {
          const original = Object.getOwnPropertyDescriptor(Blob.prototype, 'size');
          Object.defineProperty(File.prototype, 'size', {get() {
            return this.name.startsWith('large') ? 51*1024*1024 : this.name.startsWith('bulk') ? 50*1024*1024 : original.get.call(this);
          }});
        }""")
        self.add([{**source, "name": "large.pdf"}] + [{**source, "name": f"bulk-{i}.pdf"} for i in range(5)])
        expect(self.page.locator(".file-row")).to_have_count(4)
        expect(self.page.locator("#message")).to_contain_text("ขนาดรวมเกิน 200 MB")
        self.page.locator("#clear-button").click()
        self.add([{**source, "name": f"small-{i}.pdf"} for i in range(51)])
        expect(self.page.locator(".file-row")).to_have_count(50)
        expect(self.page.locator("#message")).to_contain_text("สูงสุด 50 ไฟล์")

    def test_single_screen_and_visible_controls(self):
        source = pdf("source.pdf")
        self.add([{**source, "name": f"รายงานชื่อไฟล์ยาวสำหรับทดสอบ-{i}.pdf"} for i in range(12)])
        sizes = [(1440, 900), (1366, 768), (1280, 600), (768, 1024), (390, 844), (320, 568), (844, 390)]
        for width, height in sizes:
            with self.subTest(width=width, height=height):
                self.page.set_viewport_size({"width": width, "height": height})
                fits = self.page.evaluate("""() => {
                  const controls = ['#drop-zone','#clear-button','#output-name','#combine-button'];
                  return document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth &&
                    controls.every(selector => {
                      const el = document.querySelector(selector), r = el.getBoundingClientRect();
                      const top = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
                      return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && (top === el || el.contains(top));
                    }) && document.querySelector('#file-list').clientHeight >= 50;
                }""")
                self.assertTrue(fits)
        self.download()
        expect(self.page.locator("#download-link")).to_be_in_viewport()
        self.page.set_viewport_size(self.viewport)
        screenshots = ROOT / "test-results"
        screenshots.mkdir(exist_ok=True)
        self.page.screenshot(path=str(screenshots / f"static-{'mobile' if self.mobile else 'desktop'}.png"), scale="css", animations="disabled")

    def test_help_dialog_and_focus(self):
        self.page.locator("#help-button").click()
        expect(self.page.get_by_role("dialog")).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(self.page.get_by_role("dialog")).to_be_hidden()
        expect(self.page.locator("#help-button")).to_be_focused()

    def test_direct_file_open_and_merge(self):
        self.page.goto((ROOT / "index.html").as_uri())
        self.add([pdf("one.pdf", (450,)), pdf("two.pdf", (550,))])
        result = PdfReader(self.download().path())
        self.assertEqual([float(page.mediabox.width) for page in result.pages], [450, 550])
        self.assertEqual(self.page.locator(".workspace-grid").evaluate("el => getComputedStyle(el).display"), "grid")

    def test_library_failure_has_useful_error(self):
        self.page.route("**/pdf-lib-1.17.1.min.js", lambda route: route.abort())
        self.page.reload()
        expect(self.page.locator("#message")).to_contain_text("โหลดเครื่องมือ PDF ไม่สำเร็จ")
        expect(self.page.locator("#drop-zone")).to_be_disabled()
        self.page.locator("#help-button").click()
        expect(self.page.get_by_role("dialog")).to_be_visible()


class DesktopTests(BrowserChecks, unittest.TestCase):
    pass


class MobileTests(BrowserChecks, unittest.TestCase):
    mobile = True
    viewport = {"width": 390, "height": 844}


if __name__ == "__main__":
    unittest.main(verbosity=2)
