# PIXELFORGE STUDIO

محرر صور احترافي لسطح مكتب macOS مبني بـ Electron + React + TypeScript + Vite + Tailwind.
يستخدم محرك Canvas 2D خاصاً (بدون Fabric/Konva) مع طبقات وسجل تراجع/إعادة ومعالجة بكسلات حقيقية.

> **حالة المشروع (v0.1.0):** الكود مكتوب لكنه **لم يُبنَ ولم يُشغَّل بعد** على macOS ولم يُختبر على Big Sur.
> أول تشغيل لـ GitHub Actions هو أول اختبار حقيقي للبناء؛ قد يحتاج إصلاحات صغيرة (راجع «الخطوات»).

## المتطلبات المستهدفة
- macOS Big Sur 11.7 أو أحدث، معالج Intel x86_64 (حزمة `x64` فقط).
- Electron مثبت على `37.2.4` (آخر سلسلة تدعم macOS 11 حسب متطلباتك؛ لا تستخدم 38+).
  تحقق من أحدث إصدار 37.x قبل النشر.
- اسم الملف الناتج: `PIXELFORGE-STUDIO-macOS-Intel.dmg`.

## البناء من المتصفح فقط (بدون تثبيت شيء على جهازك)
1. أنشئ مستودعاً جديداً على github.com باسم `PIXELFORGE-STUDIO`.
2. ارفع محتويات هذا المجلد (Add file → Upload files)، وتأكد أن المجلد المخفي `.github/workflows` ارتفع أيضاً.
   (البديل الأسهل: ارفع ملف ZIP إلى Codespaces أو افتح المستودع على github.dev وأنشئ الملفات.)
3. افتح تبويب **Actions** ← **Build macOS Intel DMG** ← **Run workflow**.
4. بعد النجاح: افتح التشغيل ونزّل الملف من **Artifacts**.
5. للنشر في Releases: أنشئ Tag بالشكل `v0.1.0` (Releases ← Draft a new release ← Create new tag). سيرفع الـ workflow الـ DMG تلقائياً.
6. إن فشل البناء، انسخ سجل الخطوة الفاشلة وسأصلحه.

يقوم الـ workflow بـ: تثبيت المكتبات ← فحص TypeScript ← الاختبارات ← بناء الواجهة و Electron ← إنشاء DMG (x64) ←
التحقق (وجود الملف، الحجم > 0، `hdiutil verify`، `lipo -archs` يحتوي x86_64، قراءة `LSMinimumSystemVersion`) ← رفع Artifact.

> إن لم يتوفر `macos-15-intel` لحسابك، بدّل `runs-on` في `build-macos.yml` إلى مشغّل Intel آخر متاح.
> لا يوجد `package-lock.json` بعد؛ بعد أول بناء ناجح أضف القفل للمستودع وبدّل `npm install` إلى `npm ci`.

## فتح التطبيق غير الموقّع (Gatekeeper)
البناء غير موقّع (لا توجد شهادة Apple Developer). عند أول فتح: انقر بزر الفأرة الأيمن على التطبيق ← **Open** ← **Open**.
أو: System Preferences ← Security & Privacy ← General ← **Open Anyway**.

## ما هو منفّذ فعلياً
- مساحة العمل: تكبير/تصغير (Cmd+عجلة/مقياس)، تحريك (Space/عجلة)، مساطر، Checkerboard، ملاءمة الشاشة، خطوط محاذاة وسحب مغناطيسي.
- استيراد JPG/PNG/WEBP/BMP بالسحب والإفلات أو نافذة الملفات (تحقق من توقيع الملف وحجمه؛ تصغير تلقائي فوق 4096px).
- طبقات: صورة/نص/شكل/رسم، إعادة ترتيب بالسحب، إعادة تسمية، نسخ، حذف، إخفاء، قفل، Opacity، 16 وضع دمج.
- تحويل: تحريك، تغيير حجم (زوايا أو أرقام)، تدوير، قلب، محاذاة، قفل النسبة.
- قص: نسب جاهزة وقيم يدوية، تدوير اللوحة 90°، تدوير الطبقة لتقويم الصورة.
- التعديلات (15 شريطاً) والفلاتر (13) مع قوة الفلتر، تُطبّق مباشرة.
- مؤثرات: Blur, Vignette, Film Grain, Chromatic Aberration, Glow, Shadow, Color Overlay.
- تحسين: تنعيم بشرة (يحافظ على الحواف)، إزالة تشويش (Median)، حدة، Clarity.
- رسم: فرشاة/قلم/ممحاة؛ أشكال (مستطيل، دائرة، مثلث، سداسي، نجمة، خط)؛ إطارات؛ ملصقات Emoji واستيراد PNG.
- نص: عربي وإنجليزي (RTL تلقائي)، خطوط النظام + استيراد خط، حجم/سماكة/تباعد/محاذاة/حد/خلفية.
- History: Undo/Redo، لوحة الحالات والقفز لأي حالة، Cmd+Z / Shift+Cmd+Z / S / O / E.
- حفظ/فتح مشاريع `.pfs`، حفظ تلقائي في IndexedDB واسترجاع بعد إغلاق غير سليم.
- تصدير PNG/JPG/JPEG/WEBP مع الجودة والأبعاد؛ نافذة حفظ macOS الأصلية (تسأل قبل الاستبدال).
- واجهة عربية/إنجليزية مع تبديل RTL/LTR محفوظ.
- أمان Electron: `contextIsolation`, `sandbox`, بدون `nodeIntegration`, CSP، التحقق من مرسل IPC والمدخلات، منع التنقل.
- أدوات «AI Tools» الكلاسيكية (بدون نموذج): Image Enhancer (مستويات تلقائية من الهستوغرام) و Denoiser.

## غير منفّذ بعد (لا توجد أزرار وهمية)
- **كل أدوات الذكاء الاصطناعي المعتمدة على نماذج**: Background Remover، Object Remover، Upscaler، Generator،
  Generative Fill، Background Generator، Face Enhancer، Image Expansion. تظهر معطّلة مع شرح السبب
  (`src/ai/registry.ts`). تحتاج دمج ONNX Runtime/NCNN وتنزيل نماذج اختيارياً بعد مراجعة تراخيصها.
  توليد الصور بـ Stable Diffusion غير عملي غالباً على Mac Intel بذاكرة 16GB.
- Motion Blur, Background Blur, Glitch, Light Leak، إزالة العيوب/البقع، تصحيح العين الحمراء، تصحيح المنظور، النص المنحني،
  تجميع الطبقات، توزيع العناصر، تحديد متعدد، TIFF (Chromium لا يفك ترميزه)، Web Workers (المعالجة حالياً على الخيط الرئيسي).
- لم تُجرَ أي اختبارات أداء على Intel Mac.

## التطوير
```
npm install
npm run typecheck && npm test
npm run dist        # ينتج release/PIXELFORGE-STUDIO-macOS-Intel.dmg (على macOS فقط)
```
