# CombinePDF

เว็บรวม PDF ภาษาไทยที่ทำงานในเบราว์เซอร์ เลือกไฟล์ จัดลำดับ ตั้งชื่อ แล้วดาวน์โหลดเป็น PDF เดียว โดยไม่อัปโหลดเอกสารขึ้นเซิร์ฟเวอร์

## ความสามารถ

- เลือกหลายไฟล์หรือลาก PDF มาวาง รองรับไฟล์ที่เบราว์เซอร์ไม่ระบุ MIME type
- ตรวจสอบ PDF จริง พร้อมแสดงจำนวนหน้า ขนาด และข้อผิดพลาดรายไฟล์
- เรียงลำดับด้วยปุ่มขึ้น/ลง ลบรายไฟล์ หรือล้างทั้งหมด
- ตั้งชื่อไฟล์ภาษาไทยได้ พร้อมปรับอักขระที่ใช้เป็นชื่อไฟล์ไม่ได้
- พื้นที่ทำงานอยู่ภายในหน้าจอเดียว ปุ่มเลือกไฟล์ ตั้งชื่อ และรวมไฟล์มองเห็นตลอด รายการที่ยาวเลื่อนเฉพาะภายในกรอบ และเปิดวิธีใช้งานในกล่องช่วยเหลือได้
- มีสถานะระหว่างตรวจสอบและรวมไฟล์ ป้องกันการกดซ้ำ และดาวน์โหลดซ้ำได้
- รองรับมือถือ คีย์บอร์ด การแจ้งสถานะแก่โปรแกรมอ่านหน้าจอ และ reduced motion
- ไลบรารี ไอคอน และฟอนต์อยู่ในชุดเว็บ ไม่มี CDN, analytics หรือบริการอัปโหลดไฟล์

## เริ่มต้นพัฒนา

ติดตั้ง **Node.js 24 LTS** และ npm จากนั้นเปิด terminal ในโฟลเดอร์โปรเจค:

```sh
npm ci
npm run dev
```

เปิด [http://localhost:5173/CombinePDF/](http://localhost:5173/CombinePDF/) ไม่ควรเปิด `index.html` ด้วย `file://` เพราะโปรเจคใช้ JavaScript modules และต้องผ่าน Vite

## คำสั่ง

| คำสั่ง | การทำงาน |
| --- | --- |
| `npm run dev` | เปิดเซิร์ฟเวอร์สำหรับพัฒนา |
| `npm run check` | ตรวจ syntax ของ JavaScript และ config |
| `npm run build` | สร้างเว็บไซต์สำหรับเผยแพร่ใน `dist/` |
| `npm run preview` | ดู production build ที่ `http://localhost:4173/CombinePDF/` |
| `npm test` | ทดสอบบนเบราว์เซอร์ ทั้ง desktop และ mobile viewport |
| `npm run test:ui` | เปิด Playwright Test UI |

## ตรวจสอบก่อนเผยแพร่

ติดตั้ง Chromium สำหรับทดสอบครั้งแรก:

```sh
npx playwright install chromium
npm run check
npm test
```

`npm test` จะ build และเปิด preview server ให้อัตโนมัติ หากไม่มีเซิร์ฟเวอร์ที่พอร์ต 4173 อยู่แล้ว หากเปิด preview ค้างไว้หลังแก้โค้ด ให้หยุดเซิร์ฟเวอร์นั้นก่อนเพื่อให้ทดสอบ build ล่าสุด

บน Windows สามารถใช้ Microsoft Edge ที่ติดตั้งอยู่แล้วแทนการดาวน์โหลด Chromium ได้:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm test
```

ชุดทดสอบสร้าง PDF จำลอง ตรวจจำนวนและลำดับหน้าจากไฟล์ที่ดาวน์โหลดจริง การดาวน์โหลดซ้ำ ไฟล์เสีย/เข้ารหัส ไฟล์ซ้ำ การลากวาง การลบ/เลือกใหม่ ขีดจำกัดขนาด/จำนวนไฟล์ ชื่อไฟล์ที่มี HTML การคืนหน่วยความจำของ download URL คีย์บอร์ด กล่องช่วยเหลือ และการใช้งานในหน้าจอเดียวที่หลายขนาดรวมถึงมือถือแนวนอน ไม่ใช้เอกสารจริงของผู้ใช้

## Deploy บน GitHub Pages

เตรียม workflow ไว้ที่ [`.github/workflows/pages.yml`](.github/workflows/pages.yml) แล้ว โดยอ้างอิง [คู่มือ GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

1. นำ source code และ `package-lock.json` ขึ้น repository [supeerawong-Coding/CombinePDF](https://github.com/supeerawong-Coding/CombinePDF) ใน branch `main`
2. เปิด **Settings → Pages → Build and deployment → Source → GitHub Actions** ใน repository ต้องมีสิทธิ์จัดการ Pages และแผน GitHub ต้องรองรับ Pages สำหรับ visibility ที่เลือก
3. เปิดแท็บ **Actions** แล้วรอ workflow **Validate and deploy GitHub Pages** หาก push ไปแล้วก่อนเปิด Pages ให้เลือก **Run workflow** บน branch `main` หรือ re-run งานที่ไม่ผ่าน
4. เมื่อ job `deploy` สำเร็จ ให้เปิด URL ที่แสดงใน environment `github-pages`

URL ที่คาดไว้สำหรับ repository ปัจจุบันคือ [https://supeerawong-Coding.github.io/CombinePDF/](https://supeerawong-Coding.github.io/CombinePDF/) URL นี้จะใช้งานได้หลังเปิด Pages และ deploy สำเร็จเท่านั้น การสร้างไฟล์ workflow ในเครื่องยังไม่ได้เผยแพร่เว็บ

Workflow จะติดตั้งด้วย `npm ci` ตรวจ syntax สร้าง production build และทดสอบก่อนอัปโหลด **เฉพาะ `dist/`** ขึ้น Pages โดย PR จะรันตรวจสอบและไม่ deploy ส่วนการ push หรือสั่งรันบน `main` จะ deploy หลังตรวจผ่าน ใช้ `GITHUB_TOKEN` ของ Actions ไม่ต้องสร้าง Personal Access Token

### การ push ครั้งแรก เมื่อ repository ยังว่าง

ตรวจ branch, remote และไฟล์ให้เรียบร้อยก่อน คำสั่งด้านล่างเป็นขั้นตอนที่เจ้าของโปรเจคเลือกดำเนินการเอง ไม่ใช่การ push ที่ทำไปแล้ว:

```sh
git status --short
git branch --show-current
git remote -v
git ls-remote --heads origin
```

หาก remote ยังไม่มี branch จริง ให้ตรวจสอบไฟล์ทั้งหมด แล้ว stage เฉพาะ source/config/docs:

```sh
git add index.html styles.css script.js public tests .github package.json package-lock.json vite.config.js playwright.config.js .gitignore .gitattributes .nvmrc AGENTS.md README.md
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "feat: create private PDF merger with GitHub Pages deployment"
git push -u origin HEAD:main
```

คำสั่ง `HEAD:main` ใช้สำหรับ bootstrap remote ว่างเท่านั้น หาก remote มี `main` แล้ว ให้ทำงานบน `codex/<description>` push branch นั้นและเปิด Pull Request ห้ามใช้ force-push เพื่อทับประวัติเดิม หลังเผยแพร่ครั้งแรกให้อ่านและปฏิบัติตาม [AGENTS.md](AGENTS.md) สำหรับงานถัดไป

### เปลี่ยนชื่อ repository หรือใช้ custom domain

`vite.config.js` ตั้ง `base: '/CombinePDF/'` ให้ตรงกับ project Pages ปัจจุบัน ชื่อตัวพิมพ์เล็ก/ใหญ่ต้องตรงกัน หากเปลี่ยนชื่อ repository ให้แก้ `base` และ `baseURL`/`webServer.url` ใน `playwright.config.js` รวมถึงลิงก์ใน README และ GitHub link ใน `index.html` แล้วทดสอบใหม่ สำหรับเว็บที่อยู่ที่รากโดเมนให้ใช้ `base: '/'` และปรับ URL ทดสอบตามนั้น

## โครงสร้าง

```text
index.html                 หน้าเว็บภาษาไทยและ SVG icons
styles.css                 รูปแบบ สี และ responsive layout
script.js                  จัดการไฟล์ ตรวจสอบ PDF รวมและดาวน์โหลด
public/                    favicon และประกาศสิทธิ์ของ dependencies
tests/combine.spec.js       Browser tests ด้วย PDF จำลอง
vite.config.js             Build และ path สำหรับ GitHub Pages
playwright.config.js       ทดสอบ production build บน desktop/mobile
.github/workflows/pages.yml CI และ deployment
AGENTS.md                  แนวทางพัฒนาและข้อกำหนด Git
```

## ข้อจำกัดและความเป็นส่วนตัว

- อย่างน้อย 2 ไฟล์ สูงสุด 50 ไฟล์ ขนาดไม่เกิน 50 MiB ต่อไฟล์ และรวมไม่เกิน 200 MiB (UI ใช้ป้าย MB) อุปกรณ์ที่มีหน่วยความจำน้อยอาจต้องใช้ไฟล์น้อยกว่านี้
- ไม่รองรับ PDF ที่เข้ารหัสหรือติดรหัสผ่าน ต้องปลดล็อกด้วยเครื่องมือที่เหมาะสมก่อน ไม่มีการข้ามการตรวจ encryption
- รวมทุกหน้าตามลำดับไฟล์ ไม่มีการบีบอัด OCR แก้ไขเนื้อหา หรือเลือกช่วงหน้า
- การคัดลอกหน้าด้วย `pdf-lib` ไม่ได้รับประกันการคง bookmark, PDF portfolio, interactive forms หรือลายเซ็นดิจิทัล โปรดตรวจผลลัพธ์ก่อนใช้จริง
- เก็บรายการไฟล์ในหน่วยความจำของหน้าเว็บเท่านั้น ไม่ใช้ localStorage/IndexedDB และไม่ส่งเอกสารไปยังเครือข่าย เมื่อ refresh/ปิดหน้า รายการจะหายไป ไฟล์ต้นฉบับและไฟล์ที่ดาวน์โหลดยังคงอยู่บนอุปกรณ์
- ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดเว็บไซต์ครั้งแรก ไม่มี service worker สำหรับเปิดใหม่แบบ offline
- ใช้เบราว์เซอร์รุ่นปัจจุบันที่รองรับ ES2022 และ File/Blob APIs ชุดทดสอบอัตโนมัติใช้ Chromium engine พร้อมจำลองขนาดจอมือถือ ไม่ใช่การทดสอบบนโทรศัพท์จริงทุกระบบ

## เทคโนโลยีและสิทธิ์

ใช้ vanilla JavaScript, Vite, [pdf-lib](https://pdf-lib.js.org/), Playwright, Manrope และ Noto Sans Thai จาก Fontsource ดูสิทธิ์ของ dependencies ได้ที่ `public/THIRD_PARTY_NOTICES.txt` โปรเจคยังไม่ได้ระบุใบอนุญาตสำหรับ source code ของเจ้าของ repository
