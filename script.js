import { PDFDocument, EncryptedPDFError } from 'pdf-lib';
import './styles.css';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 50;
const $ = (id) => document.getElementById(id);
const state = { files: [], busy: null, resultUrl: null };
const fileInput = $('file-input');
const dropZone = $('drop-zone');
const fileList = $('file-list');
const combineButton = $('combine-button');
const outputName = $('output-name');

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.classList.add('icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showMessage(text = '', tone = 'info') {
  const message = $('message');
  message.textContent = text;
  message.dataset.tone = tone;
  message.hidden = !text;
}

function resetResult() {
  if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
  state.resultUrl = null;
  $('result-panel').hidden = true;
  $('download-link').removeAttribute('href');
  $('download-link').removeAttribute('download');
}

function downloadName() {
  // Keep Thai names; remove filesystem separators, controls and reserved device names.
  let name = outputName.value.trim().replace(/(?:\.pdf)+$/i, '');
  name = name.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100);
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = 'combined';
  return `${name}.pdf`;
}

function actionButton(entry, action, label, iconName, disabled) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button ${action === 'remove' ? 'remove-button' : ''}`;
  button.dataset.action = action;
  button.dataset.id = entry.id;
  button.setAttribute('aria-label', `${label} ${entry.file.name}`);
  button.title = label;
  button.disabled = Boolean(state.busy || disabled);
  button.append(icon(iconName));
  return button;
}

function render() {
  const ready = state.files.filter((entry) => entry.status === 'ready');
  const hasError = state.files.some((entry) => entry.status === 'error');
  const canMerge = ready.length >= 2 && !hasError && !state.busy;
  $('file-count').textContent = state.files.length;
  $('total-files').textContent = ready.length;
  $('total-pages').textContent = ready.reduce((sum, entry) => sum + entry.pages, 0).toLocaleString('en-US');
  $('total-size').textContent = formatSize(state.files.reduce((sum, entry) => sum + entry.file.size, 0));
  $('empty-state').hidden = state.files.length > 0;
  fileList.hidden = state.files.length === 0;
  $('reorder-hint').hidden = state.files.length < 2;
  $('clear-button').disabled = Boolean(state.busy || !state.files.length);
  $('files-panel').setAttribute('aria-busy', String(Boolean(state.busy)));
  dropZone.disabled = Boolean(state.busy);
  fileInput.disabled = Boolean(state.busy);
  outputName.disabled = Boolean(state.busy);
  combineButton.disabled = !canMerge;
  $('combine-label').textContent = state.busy === 'merge' ? 'กำลังรวมไฟล์…' : state.busy === 'validate' ? 'กำลังตรวจสอบ…' : 'รวมไฟล์ PDF';
  $('combine-hint').textContent = state.busy ? 'โปรดเปิดหน้านี้ไว้จนกว่าจะเสร็จ' : hasError ? 'ลบไฟล์ที่มีปัญหาก่อนเริ่มรวม' : ready.length < 2 ? 'เลือกอย่างน้อย 2 ไฟล์เพื่อเริ่มรวม' : 'พร้อมแล้ว รวมและดาวน์โหลดได้เลย';
  fileList.replaceChildren();
  state.files.forEach((entry, index) => {
    const row = document.createElement('li');
    row.className = `file-row${entry.status === 'error' ? ' has-error' : ''}`;
    row.dataset.id = entry.id;
    const order = document.createElement('span');
    order.className = 'file-order';
    order.textContent = String(index + 1).padStart(2, '0');
    order.setAttribute('aria-hidden', 'true');
    const type = document.createElement('span');
    type.className = 'file-type';
    type.textContent = 'PDF';
    type.setAttribute('aria-hidden', 'true');
    const info = document.createElement('div');
    info.className = 'file-info';
    const name = document.createElement('p');
    name.className = 'file-name';
    name.textContent = entry.file.name;
    name.title = entry.file.name;
    const meta = document.createElement('p');
    meta.className = 'file-meta';
    meta.textContent = entry.status === 'ready' ? `${entry.pages.toLocaleString('en-US')} หน้า · ${formatSize(entry.file.size)}` : entry.status === 'error' ? entry.error : 'กำลังตรวจสอบไฟล์…';
    info.append(name, meta);
    const actions = document.createElement('div');
    actions.className = 'file-actions';
    actions.append(
      actionButton(entry, 'up', 'เลื่อนขึ้น', 'up', index === 0),
      actionButton(entry, 'down', 'เลื่อนลง', 'down', index === state.files.length - 1),
      actionButton(entry, 'remove', 'ลบไฟล์', 'trash', false),
    );
    row.append(order, type, info, actions);
    fileList.append(row);
  });
}

function progress(value, label) {
  $('progress-wrap').hidden = false;
  $('merge-progress').value = value;
  $('progress-label').textContent = label;
}

// Yield between documents so the browser can paint progress and disabled controls.
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

async function readPdf(file) {
  const header = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer());
  if (!header.includes('%PDF-')) throw new Error('ไฟล์นี้ไม่มีข้อมูล PDF ที่ถูกต้อง');
  try {
    const document = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    if (document.getPageCount() === 0) throw new Error('PDF นี้ไม่มีหน้าเอกสาร');
    return document;
  } catch (error) {
    // pdf-lib 1.17's compiled Error subclasses can lose their prototype/name.
    if (error instanceof EncryptedPDFError || error.name === 'EncryptedPDFError' || error.message.startsWith('Input document to `PDFDocument.load` is encrypted.')) {
      throw new Error('ไฟล์เข้ารหัสหรือติดรหัสผ่าน กรุณาปลดล็อกก่อน');
    }
    if (error.message === 'PDF นี้ไม่มีหน้าเอกสาร') throw error;
    throw new Error('เปิด PDF ไม่ได้ ไฟล์อาจเสียหรือไม่รองรับ');
  }
}

async function addFiles(files) {
  if (state.busy || !files.length) return;
  const rejected = [];
  const pending = [];
  const keys = new Set(state.files.map((entry) => entry.key));
  let totalBytes = state.files.reduce((sum, entry) => sum + entry.file.size, 0);
  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    let reason = '';
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') reason = 'รองรับเฉพาะไฟล์ PDF';
    else if (!file.size) reason = 'ไฟล์ว่างเปล่า';
    else if (file.size > MAX_FILE_BYTES) reason = 'ขนาดเกิน 50 MB ต่อไฟล์';
    else if (keys.has(key)) reason = 'ไฟล์นี้อยู่ในรายการแล้ว';
    else if (state.files.length + pending.length >= MAX_FILES) reason = 'เลือกได้สูงสุด 50 ไฟล์';
    else if (totalBytes + file.size > MAX_TOTAL_BYTES) reason = 'ขนาดรวมเกิน 200 MB';
    if (reason) {
      rejected.push(`${file.name}: ${reason}`);
      continue;
    }
    keys.add(key);
    totalBytes += file.size;
    pending.push({ id: crypto.randomUUID(), key, file, status: 'loading', pages: 0, error: '' });
  }
  if (!pending.length) {
    showMessage(rejected.join(' · '), 'error');
    return;
  }
  resetResult();
  showMessage();
  state.files.push(...pending);
  state.busy = 'validate';
  render();
  try {
    for (const [index, entry] of pending.entries()) {
      progress((index / pending.length) * 100, `ตรวจสอบไฟล์ ${index + 1} / ${pending.length}`);
      await nextFrame();
      try {
        const document = await readPdf(entry.file);
        entry.pages = document.getPageCount();
        entry.status = 'ready';
      } catch (error) {
        entry.status = 'error';
        entry.error = error.message;
      }
      render();
    }
    const errors = state.files.filter((entry) => entry.status === 'error').length;
    const notes = [...rejected];
    if (errors) notes.push(`มี PDF ที่เปิดไม่ได้ ${errors} ไฟล์ กรุณาลบไฟล์ที่มีปัญหาก่อนรวม`);
    showMessage(notes.length ? notes.join(' · ') : `เพิ่ม PDF ${pending.length} ไฟล์แล้ว พร้อมให้จัดลำดับ`, errors ? 'error' : notes.length ? 'info' : 'success');
  } finally {
    state.busy = null;
    $('progress-wrap').hidden = true;
    render();
  }
}

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  fileInput.value = ''; // Permit choosing the same file again after removal.
  void addFiles(files);
});
dropZone.addEventListener('click', () => fileInput.click());
let dragDepth = 0;
dropZone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  if (!state.busy) { dragDepth += 1; dropZone.classList.add('dragover'); }
});
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = state.busy ? 'none' : 'copy';
});
dropZone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove('dragover');
  void addFiles(Array.from(event.dataTransfer?.files ?? []));
});
// Prevent accidentally opening a dropped document and losing the workspace.
for (const type of ['dragover', 'drop']) {
  window.addEventListener(type, (event) => {
    if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) event.preventDefault();
  });
}

fileList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || state.busy) return;
  const index = state.files.findIndex((entry) => entry.id === button.dataset.id);
  if (index < 0) return;
  const entry = state.files[index];
  const action = button.dataset.action;
  if (action === 'remove') {
    state.files.splice(index, 1);
  } else {
    const nextIndex = index + (action === 'up' ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= state.files.length) return;
    [state.files[index], state.files[nextIndex]] = [state.files[nextIndex], state.files[index]];
  }
  resetResult();
  render();
  const hasErrors = state.files.some((file) => file.status === 'error');
  showMessage(hasErrors ? 'ลบไฟล์ที่มีปัญหาก่อนเริ่มรวม' : action === 'remove' ? `ลบ ${entry.file.name} แล้ว` : `${entry.file.name} อยู่ลำดับที่ ${state.files.indexOf(entry) + 1} แล้ว`, hasErrors ? 'error' : 'info');
  // Keep keyboard focus in the list after a row is rebuilt or removed.
  const focusId = action === 'remove' ? state.files[Math.min(index, state.files.length - 1)]?.id : entry.id;
  const row = focusId ? fileList.querySelector(`[data-id="${focusId}"]`) : null;
  const preferred = row?.querySelector(`button[data-action="${action}"]:not(:disabled)`);
  (preferred ?? row?.querySelector('button:not(:disabled)') ?? dropZone).focus();
});

$('clear-button').addEventListener('click', () => {
  if (state.busy) return;
  state.files = [];
  fileInput.value = '';
  resetResult();
  render();
  showMessage('ล้างรายการไฟล์แล้ว');
  dropZone.focus();
});
outputName.addEventListener('input', () => {
  if (state.resultUrl) {
    $('download-link').download = downloadName();
    $('result-details').textContent = `${downloadName()} · ${$('total-pages').textContent} หน้า`;
  }
});

combineButton.addEventListener('click', async () => {
  if (state.busy || state.files.length < 2 || state.files.some((entry) => entry.status !== 'ready')) return;
  resetResult();
  showMessage();
  state.busy = 'merge';
  render();
  let currentEntry = null;
  try {
    const merged = await PDFDocument.create();
    // Sequential reads avoid retaining every parsed input document at once.
    for (const [index, entry] of state.files.entries()) {
      currentEntry = entry;
      progress((index / state.files.length) * 90, `กำลังรวมไฟล์ ${index + 1} / ${state.files.length}`);
      await nextFrame();
      const source = await readPdf(entry.file);
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    }
    currentEntry = null;
    progress(95, 'กำลังเตรียมไฟล์สำหรับดาวน์โหลด…');
    await nextFrame();
    merged.setTitle(downloadName().slice(0, -4));
    merged.setCreator('CombinePDF');
    const bytes = await merged.save();
    state.resultUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = $('download-link');
    link.href = state.resultUrl;
    link.download = downloadName();
    $('result-details').textContent = `${downloadName()} · ${merged.getPageCount().toLocaleString('en-US')} หน้า · ${formatSize(bytes.length)}`;
    $('result-panel').hidden = false;
    showMessage('รวมไฟล์สำเร็จ หากยังไม่ได้รับไฟล์ ให้กดดาวน์โหลดอีกครั้ง', 'success');
    link.click();
    link.focus({ preventScroll: true });
  } catch (error) {
    if (currentEntry) {
      currentEntry.status = 'error';
      currentEntry.error = 'รวมไฟล์นี้ไม่ได้ กรุณาตรวจสอบหรือนำออก';
    }
    resetResult();
    showMessage(currentEntry ? `รวม ${currentEntry.file.name} ไม่สำเร็จ: ${error.message} กรุณาลบหรือเปลี่ยนไฟล์นี้แล้วลองอีกครั้ง` : 'รวมไฟล์ไม่สำเร็จ อุปกรณ์อาจมีหน่วยความจำไม่เพียงพอ ลองลดจำนวนหรือขนาดไฟล์แล้วเริ่มใหม่', 'error');
  } finally {
    state.busy = null;
    $('progress-wrap').hidden = true;
    render();
  }
});

window.addEventListener('pagehide', (event) => {
  // A back/forward-cache entry still needs its download URL when restored.
  if (!event.persisted && state.resultUrl) URL.revokeObjectURL(state.resultUrl);
});
render();

$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('help-close').addEventListener('click', () => $('help-dialog').close());
