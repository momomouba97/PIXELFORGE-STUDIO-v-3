export type Lang = 'en' | 'ar';
export type DirPref = 'auto' | 'ltr' | 'rtl';

// English strings are the keys. Missing Arabic entries fall back to English.
const ar: Record<string, string> = {
  File: 'ملف', 'New project': 'مشروع جديد', 'Open image': 'فتح صورة', 'Open project': 'فتح مشروع',
  'Save project': 'حفظ المشروع', 'Export image': 'تصدير الصورة', Undo: 'تراجع', Redo: 'إعادة',
  'Zoom in': 'تكبير', 'Zoom out': 'تصغير', 'Fit to screen': 'ملاءمة الشاشة', Fullscreen: 'ملء الشاشة', Settings: 'الإعدادات',
  Arrange: 'ترتيب', Crop: 'قص', Adjust: 'تعديل', Filters: 'فلاتر', Effects: 'مؤثرات', Retouch: 'تحسين',
  'AI Tools': 'أدوات الذكاء الاصطناعي', Text: 'نص', Draw: 'رسم', Shapes: 'أشكال', Stickers: 'ملصقات', Frames: 'إطارات', Templates: 'قوالب',
  Layers: 'الطبقات', History: 'السجل', Tool: 'الأداة', Cancel: 'إلغاء', Apply: 'تطبيق', Create: 'إنشاء', Export: 'تصدير', Reset: 'إعادة ضبط',
  Language: 'اللغة', Direction: 'الاتجاه', Auto: 'تلقائي', 'Select a layer first': 'حدد طبقة أولاً', Strength: 'القوة',
  Brightness: 'السطوع', Contrast: 'التباين', Exposure: 'التعريض', Saturation: 'التشبع', Vibrance: 'الحيوية',
  Temperature: 'الحرارة', Tint: 'الصبغة', Highlights: 'الإضاءات', Shadows: 'الظلال', Whites: 'البيض', Blacks: 'السود',
  Gamma: 'غاما', Sharpness: 'الحدة', Clarity: 'الوضوح', Hue: 'تدرج اللون',
  vintage: 'عتيق', cinematic: 'سينمائي', bw: 'أبيض وأسود', sepia: 'سيبيا', hdr: 'HDR', warm: 'دافئ', cool: 'بارد',
  retro: 'ريترو', dramatic: 'درامي', film: 'فيلم', fade: 'باهت', matte: 'مطفي', duotone: 'ثنائي اللون', None: 'بدون',
  Blur: 'ضبابية', Vignette: 'تعتيم الحواف', 'Film grain': 'حبيبات الفيلم', 'Chromatic aberration': 'انحراف لوني',
  Glow: 'توهج', Shadow: 'ظل', 'Color overlay': 'طبقة لون', Amount: 'الكمية',
  'Skin smoothing': 'تنعيم البشرة', Denoise: 'إزالة التشويش', 'Auto enhance': 'تحسين تلقائي',
  'Add text': 'إضافة نص', Font: 'الخط', Size: 'الحجم', Weight: 'السماكة', Color: 'اللون', Align: 'المحاذاة',
  'Letter spacing': 'تباعد الحروف', 'Line height': 'ارتفاع السطر', Outline: 'حد', 'Outline width': 'سمك الحد', Background: 'الخلفية',
  'Import font': 'استيراد خط', Brush: 'فرشاة', Pen: 'قلم', Eraser: 'ممحاة', Opacity: 'الشفافية', Blend: 'الدمج',
  Fill: 'التعبئة', Stroke: 'الحد', 'Stroke width': 'سمك الحد', Rectangle: 'مستطيل', Circle: 'دائرة', Triangle: 'مثلث',
  Hexagon: 'مضلع', Star: 'نجمة', Line: 'خط', 'Import PNG': 'استيراد PNG', Width: 'العرض', Height: 'الارتفاع',
  Rotation: 'التدوير', 'Flip horizontal': 'قلب أفقي', 'Flip vertical': 'قلب عمودي', 'Lock aspect ratio': 'قفل النسبة',
  Left: 'يسار', Center: 'وسط', Right: 'يمين', Top: 'أعلى', Middle: 'منتصف', Bottom: 'أسفل',
  'Rotate canvas 90°': 'تدوير اللوحة 90°', 'Apply crop': 'تطبيق القص', Free: 'حر', 'Canvas size': 'حجم اللوحة',
  Format: 'الصيغة', Quality: 'الجودة', 'File name': 'اسم الملف', Transparent: 'شفاف', White: 'أبيض', Black: 'أسود',
  'Keep ratio': 'حفظ النسبة', Custom: 'مخصص', Name: 'الاسم', Visible: 'ظاهر', Locked: 'مقفل', Duplicate: 'نسخ', Delete: 'حذف',
  'Drop images here': 'أسقط الصور هنا', 'Restore the unsaved project from the last session?': 'استعادة المشروع غير المحفوظ من الجلسة السابقة؟',
  'Not implemented yet': 'غير مُنفّذ بعد', 'Needs an AI model download (not bundled)': 'يحتاج تنزيل نموذج ذكاء اصطناعي (غير مضمّن)',
  'Classical algorithm, no AI model': 'خوارزمية كلاسيكية بدون نموذج ذكاء اصطناعي',
  'Background Remover': 'إزالة الخلفية', 'Object Remover': 'إزالة العناصر', 'Image Upscaler': 'رفع الدقة',
  'Image Generator': 'توليد الصور', 'Generative Fill': 'التعبئة التوليدية', 'Background Generator': 'توليد الخلفيات',
  'Face Enhancer': 'تحسين الوجوه', 'Image Expansion': 'توسيع الصورة', 'Image Enhancer': 'محسّن الصور',
  'Add frame': 'إضافة إطار', 'Thin white': 'أبيض رفيع', 'Thick white': 'أبيض سميك', 'Black frame': 'إطار أسود', 'Accent frame': 'إطار ملوّن',
  'Start a project with a size and background': 'ابدأ مشروعاً بحجم وخلفية',
};

export function makeT(lang: Lang): (s: string) => string {
  return (s) => (lang === 'ar' ? ar[s] ?? s : s);
}

export function resolveDir(lang: Lang, pref: DirPref): 'ltr' | 'rtl' {
  return pref === 'auto' ? (lang === 'ar' ? 'rtl' : 'ltr') : pref;
}

export function loadPrefs(): { lang: Lang; dir: DirPref } {
  try {
    const l = localStorage.getItem('pf.lang');
    const d = localStorage.getItem('pf.dir');
    return { lang: l === 'ar' ? 'ar' : 'en', dir: d === 'ltr' || d === 'rtl' ? d : 'auto' };
  } catch {
    return { lang: 'en', dir: 'auto' };
  }
}

export function savePrefs(lang: Lang, dir: DirPref): void {
  try {
    localStorage.setItem('pf.lang', lang);
    localStorage.setItem('pf.dir', dir);
  } catch { /* ignore */ }
}
