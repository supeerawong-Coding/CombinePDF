# CombinePDF

เว็บรวม PDF ภาษาไทยที่ใช้ **HTML, CSS และ JavaScript โดยตรง** ไม่ต้องใช้ Node.js, npm หรือขั้นตอน build เปิด `index.html` แล้วใช้งานได้ทันที

[เปิดเว็บไซต์ CombinePDF](https://supeerawong-coding.github.io/CombinePDF/)

## ใช้งาน

1. เลือก PDF อย่างน้อย 2 ไฟล์ หรือลากไฟล์มาวางในพื้นที่เลือกไฟล์
2. ใช้ลูกศรข้างชื่อไฟล์เพื่อเรียงลำดับ ลบไฟล์ที่ไม่ต้องการได้
3. ตั้งชื่อไฟล์ แล้วกด **รวมไฟล์ PDF** เพื่อดาวน์โหลด

ปุ่มเลือกไฟล์ ตั้งชื่อ และรวมไฟล์อยู่ในหน้าจอเดียว รายการที่ยาวจะเลื่อนเฉพาะในกรอบ รองรับมือถือทั้งแนวตั้งและแนวนอน ส่วนวิธีใช้งานและคำถามที่พบบ่อยเปิดได้จากปุ่ม **วิธีใช้งาน**

## เปิดในเครื่อง

ดาวน์โหลดหรือ clone repository แล้วเปิด `index.html` ได้เลย ต้องเก็บโฟลเดอร์ `assets` ไว้ด้วย ไม่ต้องติดตั้ง dependencies สำหรับใช้งานเว็บ

หากต้องการทดสอบผ่าน HTTP และมี Python อยู่แล้ว สามารถใช้เซิร์ฟเวอร์ตัวเลือกนี้:

```sh
python tests/serve.py
```

จากนั้นเปิด [http://127.0.0.1:5173/CombinePDF/](http://127.0.0.1:5173/CombinePDF/) Python ใช้เฉพาะเซิร์ฟเวอร์ทดสอบในเครื่อง ไม่ใช่ส่วนประกอบของเว็บที่เผยแพร่

## Deploy บน GitHub Pages

ใช้ไฟล์ใน repository โดยตรง:

1. นำโค้ดขึ้น branch `main` ผ่าน Pull Request ตาม [AGENTS.md](AGENTS.md)
2. ที่ repository เปิด **Settings → Pages → Build and deployment**
3. เลือก **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)** แล้วบันทึก
4. รอ workflow **pages build and deployment** ของ GitHub สำเร็จ แล้วเปิดเว็บไซต์ด้านบน

Repository นี้ใช้วิธีเผยแพร่จาก branch อยู่แล้ว การแก้ไขบน `main` จึงเผยแพร่อัตโนมัติ ไม่ต้องติดตั้ง Node.js หรือสร้างโฟลเดอร์ `dist` ไฟล์ `.nojekyll` ระบุว่าให้เผยแพร่ไฟล์ static โดยตรง

Workflow **Check static website** ใน [`.github/workflows/check.yml`](.github/workflows/check.yml) ใช้ตรวจไฟล์ต้นฉบับและทดสอบในเบราว์เซอร์ ส่วนการเผยแพร่ใช้ระบบ Pages ของ GitHub ที่ตั้งค่าไว้ ไม่มี workflow อีกตัวส่ง build artifact มาแทนไฟล์ต้นฉบับ

## ตรวจสอบสำหรับผู้พัฒนา

การใช้งานและ deploy ไม่ต้องติดตั้งเครื่องมือเหล่านี้ ขั้นตอนนี้มีไว้สำหรับตรวจโค้ดก่อนเผยแพร่เท่านั้น

ตรวจว่า HTML โหลด CSS โดยตรง ไฟล์ runtime อยู่ครบ ไม่มี package import ที่เบราว์เซอร์อ่านไม่ได้ และไลบรารี PDF ตรงกับ checksum ที่กำหนด:

```sh
python tests/check_static.py
```

ทดสอบการทำงานในเบราว์เซอร์ด้วย Python 3.11 ขึ้นไป:

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python -m unittest discover -s tests -p "test_*.py" -v
```

บน Windows ที่มี Microsoft Edge อยู่แล้ว สามารถใช้แทน Chromium สำหรับทดสอบได้:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
python -m unittest discover -s tests -p "test_*.py" -v
```

ชุดทดสอบใช้ **source code ชุดเดียวกับที่ Pages เผยแพร่** ไม่มี build ก่อนทดสอบ ครอบคลุมการรวมและลำดับหน้าของ PDF ที่ดาวน์โหลดจริง ไฟล์เสีย/เข้ารหัส การลบและเลือกใหม่ ไฟล์ซ้ำ ขนาดและจำนวนไฟล์ ชื่อไฟล์อันตราย การคืน download URL การใช้งานผ่านคีย์บอร์ด การเปิด `file://` การโหลดไลบรารีไม่สำเร็จ และการวางปุ่มหลักให้อยู่ในจอที่หลายขนาด ใช้ PDF จำลองทั้งหมด

หลังเผยแพร่ต้องตรวจ **URL จริง** อีกครั้ง ทั้งไฟล์ CSS/JS/ฟอนต์/favicon การแสดงผล และการดาวน์โหลด PDF การตรวจผ่านเฉพาะในเครื่องยังไม่ยืนยันว่า deploy ถูกต้อง

## โครงสร้าง

```text
index.html                    หน้าเว็บที่เปิดได้โดยตรง
styles.css                    รูปแบบและฟอนต์ local
script.js                     เลือก/เรียง/รวม/ดาวน์โหลด PDF
assets/favicon.svg            ไอคอนเว็บ
assets/fonts/                 Manrope และ Noto Sans Thai
assets/vendor/                pdf-lib browser bundle
THIRD_PARTY_NOTICES.txt        ใบอนุญาตของไลบรารีและฟอนต์
.nojekyll                     ให้ Pages เผยแพร่ไฟล์ static โดยตรง
.github/workflows/check.yml   ตรวจ source assets และ browser tests
tests/                        เครื่องมือตรวจสอบ/preview แบบตัวเลือก
requirements-dev.txt          Python dependencies สำหรับ tests เท่านั้น
AGENTS.md                     แนวทางพัฒนาและข้อกำหนด Git
```

## ความเป็นส่วนตัวและข้อจำกัด

- รวมไฟล์ในหน่วยความจำของเบราว์เซอร์ ไม่อัปโหลดเอกสาร ไม่ใช้ analytics, localStorage หรือ IndexedDB และไม่โหลดไลบรารีหรือฟอนต์จาก CDN
- ใช้ได้ตั้งแต่ 2 ถึง 50 ไฟล์ สูงสุด 50 MiB ต่อไฟล์และ 200 MiB รวมทั้งหมด (ป้ายใน UI ใช้ MB) อุปกรณ์ที่มีหน่วยความจำน้อยอาจต้องใช้ไฟล์น้อยกว่านี้
- ไม่รองรับ PDF ที่เข้ารหัส ต้องปลดล็อกก่อน ไม่มีการข้ามการตรวจ encryption
- รวมทุกหน้าตามลำดับไฟล์ ไม่บีบอัด ไม่ทำ OCR และไม่เลือกช่วงหน้า การรวมไม่รับประกันการคง bookmark, interactive forms หรือลายเซ็นดิจิทัล
- รีเฟรชหรือปิดหน้าแล้วรายการไฟล์จะหายไป ไฟล์ต้นฉบับและไฟล์ที่ดาวน์โหลดอยู่บนอุปกรณ์ของคุณ
- ใช้งานต่อได้หลังโหลดหน้าและ assets ครบ แต่ไม่มี service worker สำหรับเปิดเว็บไซต์ใหม่แบบ offline หากดาวน์โหลด repository ไว้แล้วสามารถเปิด `index.html` แบบ offline ได้
- ทดสอบอัตโนมัติบน Chromium engine พร้อมจำลองหน้าจอมือถือ ไม่ใช่การทดสอบโทรศัพท์จริงทุกระบบ

## ไลบรารีที่รวมไว้

ใช้ `pdf-lib` **1.17.1** และไฟล์ฟอนต์จาก Fontsource **5.3.0** พร้อมใบอนุญาตใน [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)

SHA-256 ของ `assets/vendor/pdf-lib-1.17.1.min.js`:

```text
0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f
```

Repository ยังไม่ได้ระบุใบอนุญาตสำหรับ source code ของเจ้าของโปรเจค
