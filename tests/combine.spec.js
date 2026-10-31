import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

async function pdf(name, widths = [400], encrypted = false) {
  const document = await PDFDocument.create();
  widths.forEach((width, index) => {
    const page = document.addPage([width, 600]);
    page.drawText(`Synthetic test page ${index + 1}`, { x: 25, y: 550 });
  });
  if (encrypted) {
    // A synthetic encrypted trailer exercises pdf-lib's default rejection path.
    document.context.trailerInfo.Encrypt = document.context.register(document.context.obj({ Filter: 'Standard', V: 1, R: 2 }));
  }
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await document.save()) };
}

async function add(page, files) {
  await page.locator('#file-input').setInputFiles(files);
  await expect(page.locator('#drop-zone')).toBeEnabled();
}

test.beforeEach(async ({ page }) => { await page.goto('./'); });

test('loads all production assets at the repository path, with keyboard access and no overflow', async ({ page }) => {
  const failures = [];
  const external = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()); });
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveTitle(/CombinePDF/);
  await expect(page.locator('#combine-button')).toBeDisabled();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'ข้ามไปพื้นที่รวมไฟล์' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'เลือกไฟล์ PDF', exact: true })).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles(await pdf('keyboard.pdf'));
  await expect(page.locator('#total-files')).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(failures).toEqual([]);
  expect(external).toEqual([]);
});

test('merges actual PDF pages in the chosen order and supports another download', async ({ page }) => {
  const outgoing = [];
  page.on('request', (request) => { if (request.method() !== 'GET') outgoing.push(request.url()); });
  await add(page, [await pdf('first.pdf', [410, 420]), await pdf('second.pdf', [510])]);
  await expect(page.locator('#total-pages')).toHaveText('3');
  await page.getByRole('button', { name: 'เลื่อนขึ้น second.pdf', exact: true }).click();
  await expect(page.locator('.file-name')).toHaveText(['second.pdf', 'first.pdf']);
  await expect(page.getByRole('button', { name: 'เลื่อนลง second.pdf', exact: true })).toBeFocused();
  await page.locator('#output-name').fill('รายงานประจำเดือน.pdf');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#combine-button').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('รายงานประจำเดือน.pdf');
  const result = await PDFDocument.load(await readFile(await download.path()));
  expect(result.getPages().map((item) => item.getWidth())).toEqual([510, 410, 420]);
  await expect(page.locator('#result-panel')).toBeVisible();
  const secondEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'ดาวน์โหลดอีกครั้ง' }).click();
  expect((await secondEvent).suggestedFilename()).toBe('รายงานประจำเดือน.pdf');
  expect(outgoing).toEqual([]);
});

test('rejects invalid selections and blocks corrupt or encrypted documents until removed', async ({ page }) => {
  await add(page, [
    await pdf('valid.pdf'),
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a PDF') },
    { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
    { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\ntruncated') },
    await pdf('locked.pdf', [400], true),
  ]);
  await expect(page.locator('.file-row')).toHaveCount(4);
  await expect(page.locator('.has-error')).toHaveCount(3);
  await expect(page.locator('#file-list')).toContainText('ไฟล์เข้ารหัสหรือติดรหัสผ่าน');
  await expect(page.locator('#message')).toContainText('รองรับเฉพาะไฟล์ PDF');
  await expect(page.locator('#combine-button')).toBeDisabled();
  for (const name of ['fake.pdf', 'broken.pdf', 'locked.pdf']) {
    await page.getByRole('button', { name: `ลบไฟล์ ${name}`, exact: true }).click();
  }
  await add(page, await pdf('valid-2.pdf'));
  await expect(page.locator('#combine-button')).toBeEnabled();
});

test('detects duplicate files, removes individually and permits reselecting after clear', async ({ page }, testInfo) => {
  const file = await pdf('same.pdf');
  const path = testInfo.outputPath('same.pdf');
  await writeFile(path, file.buffer);
  await add(page, path);
  await add(page, path);
  await expect(page.locator('.file-row')).toHaveCount(1);
  await expect(page.locator('#message')).toContainText('อยู่ในรายการแล้ว');
  await page.getByRole('button', { name: 'ลบไฟล์ same.pdf', exact: true }).click();
  await expect(page.locator('#empty-state')).toBeVisible();
  await add(page, path);
  await page.locator('#clear-button').click();
  await expect(page.locator('#total-pages')).toHaveText('0');
  await expect(page.locator('#total-size')).toHaveText('0 KB');
  await expect(page.locator('#drop-zone')).toBeFocused();
  await add(page, path);
  await expect(page.locator('.file-row')).toHaveCount(1);
});

test('accepts dropped PDFs without MIME metadata and treats filenames as text', async ({ page }) => {
  const file = await pdf('<img src=x onerror=alert(1)>-รายงานประจำเดือนที่มีชื่อเอกสารยาวมาก.PDF');
  const transfer = await page.evaluateHandle(({ name, bytes }) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], name, { type: '' }));
    return data;
  }, { name: file.name, bytes: Array.from(file.buffer) });
  await page.locator('#drop-zone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.locator('#total-files')).toHaveText('1');
  await expect(page.locator('.file-name')).toHaveText(file.name);
  await expect(page.locator('#file-list img')).toHaveCount(0);
  expect(await page.locator('.file-row').evaluate((row) => row.getBoundingClientRect().right <= row.parentElement.getBoundingClientRect().right + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('keeps controls locked during validation and recovers from read errors during merge', async ({ page }) => {
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return read.call(this);
    };
  });
  await page.locator('#file-input').setInputFiles([await pdf('one.pdf'), await pdf('two.pdf')]);
  await expect(page.locator('#drop-zone')).toBeDisabled();
  await expect(page.locator('#clear-button')).toBeDisabled();
  await expect(page.locator('#output-name')).toBeDisabled();
  await expect(page.locator('#drop-zone')).toBeEnabled();
  await page.evaluate(() => { File.prototype.arrayBuffer = async () => { throw new Error('Simulated read error'); }; });
  await page.locator('#combine-button').click();
  await expect(page.locator('#message')).toContainText('ไม่สำเร็จ');
  await expect(page.locator('.has-error')).toHaveCount(1);
  await expect(page.locator('#result-panel')).toBeHidden();
  await expect(page.locator('#clear-button')).toBeEnabled();
  await page.locator('#clear-button').click();
  await expect(page.locator('#empty-state')).toBeVisible();
});

test('sanitizes download names and releases obsolete download URLs', async ({ page }) => {
  await page.evaluate(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    window.revokedUrls = [];
    URL.revokeObjectURL = (url) => { window.revokedUrls.push(url); revoke(url); };
  });
  await add(page, [await pdf('one.pdf'), await pdf('two.pdf')]);
  await page.locator('#output-name').fill('bad/name:report.pdf');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#combine-button').click();
  expect((await downloadEvent).suggestedFilename()).toBe('bad_name_report.pdf');
  const previous = await page.locator('#download-link').getAttribute('href');
  await page.locator('#clear-button').click();
  await expect(page.locator('#result-panel')).toBeHidden();
  expect(await page.evaluate(() => window.revokedUrls)).toContain(previous);
});

test('enforces the per-file, total-size and file-count limits before parsing', async ({ page }) => {
  const file = await pdf('source.pdf');
  // Override browser File sizes to test boundaries without allocating 250 MB.
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(Blob.prototype, 'size');
    Object.defineProperty(File.prototype, 'size', {
      get() { return this.name.startsWith('large') ? 51 * 1024 * 1024 : this.name.startsWith('bulk') ? 50 * 1024 * 1024 : descriptor.get.call(this); },
    });
  });
  await add(page, [
    { ...file, name: 'large.pdf' },
    ...Array.from({ length: 5 }, (_, index) => ({ ...file, name: `bulk-${index}.pdf` })),
  ]);
  await expect(page.locator('.file-row')).toHaveCount(4);
  await expect(page.locator('#message')).toContainText('ขนาดเกิน 50 MB');
  await expect(page.locator('#message')).toContainText('ขนาดรวมเกิน 200 MB');
  await page.locator('#clear-button').click();
  await add(page, Array.from({ length: 51 }, (_, index) => ({ ...file, name: `small-${index}.pdf` })));
  await expect(page.locator('.file-row')).toHaveCount(50);
  await expect(page.locator('#message')).toContainText('สูงสุด 50 ไฟล์');
});

test('keeps the workspace and main actions in one screen with a long file list', async ({ page }) => {
  const file = await pdf('source.pdf');
  await add(page, Array.from({ length: 12 }, (_, index) => ({ ...file, name: `รายงานที่มีชื่อเอกสารยาวมากสำหรับทดสอบ-${index}.pdf` })));
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 600], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const bounds = await page.evaluate(() => {
      const selectors = ['#drop-zone', '#clear-button', '#output-name', '#combine-button'];
      return {
        pageFits: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
        controlsFit: selectors.every((selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth;
        }),
        rowsFit: [...document.querySelectorAll('.file-row')].every((row) => row.getBoundingClientRect().right <= row.parentElement.getBoundingClientRect().right + 1),
        listHasRoom: document.querySelector('#file-list').clientHeight >= 50,
      };
    });
    expect(bounds, `${width}x${height}`).toEqual({ pageFits: true, controlsFit: true, rowsFit: true, listHasRoom: true });
  }
  const viewport = page.viewportSize();
  const downloading = page.waitForEvent('download');
  await page.locator('#combine-button').click();
  await downloading;
  await expect(page.locator('#download-link')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), `${viewport.width}x${viewport.height} result`).toBe(true);
});

test('opens help without leaving the workspace and restores keyboard focus on close', async ({ page }) => {
  await page.getByRole('button', { name: 'วิธีใช้งาน', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'สามขั้นตอน ก็เรียบร้อย' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'วิธีใช้งาน', exact: true })).toBeFocused();
});
