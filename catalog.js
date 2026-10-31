// الكورسات المقترحة + خارطة الطريق للـ Ausbildung في اللوجستيك
// الهدف: سي في يقنع شركة ألمانية تديك عقد Ausbildung، وتسافر بعد 365 يوم.

// كل مرحلة = أسابيع من تاريخ البداية
export const PHASES = [
  { id: "p1", name: "الأساس من جديد", from: 1, to: 12, color: "#16a34a",
    goal: "نظّم كورساتك القديمة وراجع الأساسيات (سلاسل الإمداد + إكسيل) من الصفر." },
  { id: "p2", name: "التجارة الدولية والجمارك", from: 13, to: 24, color: "#0891b2",
    goal: "Incoterms والجمارك الأوروبية: أكتر حاجة بيسألوا عنها في شركات الشحن الألمانية." },
  { id: "p3", name: "الأدوات اللي في السي في", from: 25, to: 38, color: "#7c3aed",
    goal: "SAP و Power BI و Lean: شهادات مجانية بتبان قوية في Lebenslauf." },
  { id: "p4", name: "لوجستيك بالألماني والتقديم", from: 39, to: 52, color: "#dc2626",
    goal: "مصطلحات اللوجستيك بالألماني، تحضير المقابلات، ومراجعة نهائية لكل حاجة." },
];

// type: course (كورس بشهادة) / ai (كورس بتعمله مع Claude) / guide (مرجع مش كورس)
export const SUGGESTED = [
  { id: "s-scm", phase: "p1", type: "course", title: "Supply Chain Management Specialization", provider: "Rutgers · Coursera",
    url: "https://www.coursera.org/specializations/supply-chain-management", hours: 60, cost: "مجاني بالـ Audit · الشهادة بفلوس أو Financial Aid",
    cv: "Supply Chain Management Specialization – Rutgers University (Coursera)",
    why: "أشهر تخصص في المجال وبيغطي اللوجستيك والمشتريات والتخطيط. ابدأ بكورس Supply Chain Logistics جواه." },
  { id: "s-excel", phase: "p1", type: "course", title: "Excel Skills for Business: Essentials", provider: "Macquarie · Coursera",
    url: "https://www.coursera.org/learn/excel-essentials", hours: 25, cost: "مجاني بالـ Audit · Financial Aid متاح",
    cv: "Excel Skills for Business: Essentials – Macquarie University (Coursera)",
    why: "كل وظيفة لوجستيك في ألمانيا بتطلب \"sichere MS-Office-Kenntnisse\"، وده الإثبات." },
  { id: "s-customs", phase: "p2", type: "course", title: "EU Customs e-learning (الجمارك الأوروبية)", provider: "European Commission",
    url: "https://customs-taxation.learning.europa.eu/", hours: 15, cost: "مجاني بالكامل بشهادة",
    cv: "EU Customs e-Learning Programme – European Commission (Zollverfahren, Ursprung, Zolltarif)",
    why: "من الاتحاد الأوروبي نفسه ومجاني. شركات الـ Spedition بتحب جداً حد فاهم Zoll." },
  { id: "s-incoterms", phase: "p2", type: "course", title: "Incoterms® 2020", provider: "ICC Academy",
    url: "https://academy.iccwbo.org/", hours: 6, cost: "الشرح المجاني كفاية · الشهادة اختيارية بفلوس",
    cv: "Incoterms® 2020 – ICC Academy",
    why: "لغة التجارة الدولية (EXW, FOB, DAP, DDP...). أكيد هيتسألوا في مقابلة Spedition." },
  { id: "s-sap", phase: "p3", type: "course", title: "SAP Learning Journeys (S/4HANA Supply Chain)", provider: "SAP Learning",
    url: "https://learning.sap.com/", hours: 20, cost: "مجاني (اعمل حساب SAP مجاني)",
    cv: "SAP Learning Journey: Supply Chain in SAP S/4HANA (SAP Learning)",
    why: "أغلب شركات اللوجستيك الألمانية شغالة SAP. حتى الأساسيات بتفرق في السي في." },
  { id: "s-pbi", phase: "p3", type: "course", title: "Power BI (Microsoft Learn)", provider: "Microsoft Learn",
    url: "https://learn.microsoft.com/training/powerplatform/power-bi", hours: 15, cost: "مجاني",
    cv: "Microsoft Learn: Datenanalyse mit Power BI",
    why: "تقارير وأرقام المخزن والشحن. ميزة إضافية تخليك أحسن من باقي المتقدمين." },
  { id: "s-lean", phase: "p3", type: "course", title: "Lean / Six Sigma Yellow Belt", provider: "Coursera (ابحث واختار كورس جامعة)",
    url: "https://www.coursera.org/search?query=six%20sigma%20yellow%20belt", hours: 15, cost: "مجاني بالـ Audit",
    cv: "Six Sigma Yellow Belt (Coursera)",
    why: "تحسين العمليات في المخازن، وكلمة \"Prozessoptimierung\" بتبان كويسة في Anschreiben." },
  { id: "s-glossar", phase: "p4", type: "ai", title: "Logistik-Fachwortschatz (مصطلحات اللوجستيك بالألماني)", provider: "مع Claude + بطاقات Deutsch 365",
    url: "", hours: 20, cost: "مجاني باشتراكك",
    cv: "",
    why: "كل أسبوع 15 مصطلح (Lieferschein, Kommissionierung, Wareneingang...) بيروحوا على بطاقات Deutsch 365." },
  { id: "s-interview", phase: "p4", type: "ai", title: "تحضير مقابلة Ausbildung بالألماني", provider: "مع Claude",
    url: "", hours: 12, cost: "مجاني باشتراكك",
    cv: "",
    why: "Claude يعمل دور مدير التدريب في شركة لوجستيك ويسألك الأسئلة المعتادة ويصحح ردودك." },
];

// المهن اللي تناسبك كـ Ausbildung (خبرتك في المجال ممكن تقصّر المدة)
export const BERUFE = [
  { name: "Fachkraft für Lagerlogistik", years: 3, ar: "متخصص لوجستيك مخازن", url: "https://web.arbeitsagentur.de/berufenet/" },
  { name: "Kaufmann/-frau für Spedition und Logistikdienstleistung", years: 3, ar: "موظف شحن وخدمات لوجستية (مكتبي)", url: "https://web.arbeitsagentur.de/berufenet/" },
  { name: "Kaufmann/-frau für Groß- und Außenhandelsmanagement", years: 3, ar: "تجارة الجملة والتجارة الخارجية", url: "https://web.arbeitsagentur.de/berufenet/" },
  { name: "Fachlagerist/-in", years: 2, ar: "عامل مخازن متخصص (أقصر وأسهل في القبول)", url: "https://web.arbeitsagentur.de/berufenet/" },
];

export const LINKS = [
  { name: "Make it in Germany (الموقع الرسمي للهجرة للشغل والتدريب)", url: "https://www.make-it-in-germany.com/en/" },
  { name: "Jobbörse — البحث عن Ausbildung (وكالة العمل الألمانية)", url: "https://www.arbeitsagentur.de/jobsuche/" },
  { name: "ausbildung.de", url: "https://www.ausbildung.de/" },
  { name: "AZUBIYO", url: "https://www.azubiyo.de/" },
  { name: "Anerkennung in Deutschland (معادلة شهاداتك)", url: "https://www.anerkennung-in-deutschland.de/" },
  { name: "السفارة الألمانية في القاهرة (الفيزا والمواعيد)", url: "https://kairo.diplo.de/" },
];

// خطوات الـ Ausbildung بالأسبوع (المواعيد الرسمية بتتغير — اتأكد دايماً من السفارة و Make it in Germany)
export const MILESTONES = [
  { id: "m1", week: 1, t: "حط كل كورساتك ولينكاتها في التطبيق ورتبها مع Claude" },
  { id: "m2", week: 4, t: "اختار مهنة الـ Ausbildung المستهدفة (اقرا وصفها في BERUFENET)" },
  { id: "m3", week: 8, t: "جهّز شهاداتك (الثانوية/الدبلوم + شهادات الخبرة) وابدأ ترجمتها ترجمة معتمدة" },
  { id: "m4", week: 12, t: "أول نسخة من Lebenslauf بالألماني (شكل جدول، بصورة) مع Claude" },
  { id: "m5", week: 16, t: "اعمل قايمة بـ 40 شركة لوجستيك عارضة Ausbildung (Jobbörse / ausbildung.de)" },
  { id: "m6", week: 18, t: "اعرف مواعيد حجز فيزا التدريب المهني في السفارة واحجز بدري (الانتظار ممكن يكون طويل)" },
  { id: "m7", week: 20, t: "ابدأ التقديم: Anschreiben مخصص لكل شركة + Lebenslauf + الشهادات" },
  { id: "m8", week: 26, t: "تحضير مقابلات أونلاين بالألماني (وضع المقابلة في Claude)" },
  { id: "m9", week: 32, t: "امتحان B1 معتمد (Goethe / telc / ÖSD) — أغلب الشركات والسفارة بيطلبوه" },
  { id: "m10", week: 36, t: "توقيع Ausbildungsvertrag والموافقات المطلوبة من صاحب الشغل" },
  { id: "m11", week: 40, t: "تقديم الفيزا بالأوراق الكاملة" },
  { id: "m12", week: 48, t: "سكن، تأمين صحي، وتجهيز السفر" },
  { id: "m13", week: 52, t: "🛫 السفر لألمانيا" },
];

// نظام اليوم (ساعة واحدة). الأسبوع المصري: الجمعة أجازة
export const WEEKDAY_PLAN = {
  6: { icon: "📘", name: "درس جديد", min: 60, t: "45 دقيقة من الكورس الحالي + 15 دقيقة تكتب 3 حاجات اتعلمتها" },
  0: { icon: "📘", name: "درس جديد", min: 60, t: "45 دقيقة من الكورس الحالي + 15 دقيقة تكتب 3 حاجات اتعلمتها" },
  1: { icon: "📘", name: "درس جديد", min: 60, t: "45 دقيقة من الكورس الحالي + 15 دقيقة تكتب 3 حاجات اتعلمتها" },
  2: { icon: "📘", name: "درس جديد", min: 60, t: "45 دقيقة من الكورس الحالي + 15 دقيقة تكتب 3 حاجات اتعلمتها" },
  3: { icon: "🛠️", name: "تطبيق عملي", min: 60, t: "طبّق اللي اتعلمته على شغلك الحالي (شيت إكسيل، مثال حقيقي) واكتبه" },
  4: { icon: "🔁", name: "مراجعة واختبار", min: 60, t: "راجع ملاحظاتك المستحقة + Claude يمتحنك في كورس الأسبوع" },
  5: { icon: "🇩🇪", name: "لوجستيك بالألماني", min: 30, t: "15 مصطلح لوجستيك بالألماني يروحوا لبطاقات Deutsch 365 (نص ساعة بس، وارتاح)" },
};

// مصادر البحث عن Ausbildung. q = اسم المهنة، city = مدينة (اختياري)
const enc = encodeURIComponent;
const g = (site, q) => `https://www.google.com/search?q=${enc(`site:${site} ${q}`)}`;
export const JOB_SOURCES = [
  { group: "رسمي", name: "Jobbörse (وكالة العمل الألمانية)", note: "أكبر قاعدة رسمية لعروض Ausbildung",
    url: (q, city) => `https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4&was=${enc(q)}${city ? `&wo=${enc(city)}` : ""}` },
  { group: "رسمي", name: "IHK-Lehrstellenbörse", note: "عروض الشركات المسجلة في الغرف التجارية",
    url: (q, city) => g("ihk-lehrstellenboerse.de", `${q} ${city}`) },
  { group: "رسمي", name: "Make it in Germany", note: "بوابة الحكومة للأجانب",
    url: (q) => g("make-it-in-germany.com", `Ausbildung ${q}`) },
  { group: "مواقع Ausbildung", name: "ausbildung.de", note: "",
    url: (q, city) => g("ausbildung.de", `${q} ${city} 2027`) },
  { group: "مواقع Ausbildung", name: "AZUBIYO", note: "",
    url: (q, city) => g("azubiyo.de", `${q} ${city}`) },
  { group: "مواقع Ausbildung", name: "aubi-plus", note: "",
    url: (q, city) => g("aubi-plus.de", `${q} ${city}`) },
  { group: "مواقع Ausbildung", name: "azubi.de", note: "",
    url: (q, city) => g("azubi.de", `${q} ${city}`) },
  { group: "مواقع وظايف عامة", name: "Indeed Deutschland", note: "",
    url: (q, city) => `https://de.indeed.com/jobs?q=${enc(`Ausbildung ${q}`)}${city ? `&l=${enc(city)}` : ""}` },
  { group: "مواقع وظايف عامة", name: "LinkedIn Jobs", note: "اعمل Job Alert من هناك",
    url: (q, city) => `https://www.linkedin.com/jobs/search/?keywords=${enc(`Ausbildung ${q}`)}&location=${enc(city || "Germany")}` },
  { group: "مواقع وظايف عامة", name: "StepStone", note: "",
    url: (q, city) => g("stepstone.de", `Ausbildung ${q} ${city}`) },
  { group: "شركات لوجستيك كبيرة", name: "DHL / DB Schenker / DACHSER / Kühne+Nagel / Rhenus", note: "بيفتحوا Ausbildung كل سنة",
    url: (q) => `https://www.google.com/search?q=${enc(`Ausbildung ${q} 2027 (DHL OR Schenker OR DACHSER OR "Kühne+Nagel" OR Rhenus OR Hellmann)`)}` },
  { group: "شركات لوجستيك كبيرة", name: "شركات بتقبل متقدمين من بره", note: "عروض مكتوب فيها إنها بتقبل أجانب",
    url: (q) => `https://www.google.com/search?q=${enc(`Ausbildung ${q} "internationale Bewerber" OR "aus dem Ausland" 2027`)}` },
  { group: "غير رسمي (اتأكد دايماً)", name: "جروبات فيسبوك للمصريين", note: "تجارب وفرص — احذر من أي حد يطلب فلوس",
    url: () => `https://www.facebook.com/search/groups/?q=${enc("Ausbildung في ألمانيا للمصريين")}` },
  { group: "غير رسمي (اتأكد دايماً)", name: "Reddit r/germany", note: "أسئلة وتجارب حقيقية",
    url: (q) => `https://www.reddit.com/r/germany/search/?q=${enc(`Ausbildung ${q}`)}` },
  { group: "غير رسمي (اتأكد دايماً)", name: "يوتيوب: تجارب Ausbildung لوجستيك", note: "",
    url: (q) => `https://www.youtube.com/results?search_query=${enc(`Ausbildung ${q} Erfahrung`)}` },
];

export const JOB_STATUS = {
  new: { t: "🆕 جديدة", c: "#64748b" },
  plan: { t: "📝 هقدم", c: "#0891b2" },
  sent: { t: "📤 قدمت", c: "#7c3aed" },
  interview: { t: "🎤 مقابلة", c: "#f59e0b" },
  offer: { t: "🎉 عرض", c: "#16a34a" },
  no: { t: "❌ رفض", c: "#dc2626" },
};
