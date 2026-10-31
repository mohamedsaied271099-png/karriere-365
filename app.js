import { PHASES, SUGGESTED, BERUFE, LINKS, MILESTONES, WEEKDAY_PLAN, JOB_SOURCES, JOB_STATUS } from "./catalog.js";
import { icon } from "./icons.js";
import { putFile, getFile, delFile, exportFiles, importFiles } from "./files.js";
import { PROMPTS, PROJECT_INSTRUCTIONS, openIn, parseJSONList } from "./ai.js";

// ---------- الحالة (محفوظة على الجهاز) ----------
const KEY = "karriere365";
const today = () => new Date().toISOString().slice(0, 10);
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const S = Object.assign(
  { start: today(), courses: [], log: {}, milestones: {}, glossary: [], beruf: BERUFE[1].name, xp: 0, streak: 0, lastStudy: null,
    profile: { name: "", birth: "", birthplace: "", nationality: "ägyptisch", address: "", phone: "", email: "", photo: "", exp: [], edu: [],
      langs: [{ lang: "Arabisch", level: "Muttersprache" }, { lang: "Deutsch", level: "A1" }, { lang: "Englisch", level: "" }], skills: "", hobbies: "" },
    certs: [], achievements: [], cvVersion: 1, cvSyncedCount: 0, jobs: [], jobCity: "" },
  load(),
);
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn("save failed", e); }
};

const $view = document.getElementById("view");
const $side = document.getElementById("side");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const fmt = (d) => new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 9);

const dayNum = () => Math.min(365, Math.max(1, daysBetween(S.start, today()) + 1));
const weekNum = () => Math.min(52, Math.ceil(dayNum() / 7));
const phaseOf = (w) => PHASES.find((p) => w >= p.from && w <= p.to) || PHASES[PHASES.length - 1];
const ctxP = () => ({ week: weekNum(), phase: phaseOf(weekNum()).name });
const targetDate = () => addDays(S.start, 365);

const sorted = () => [...S.courses].sort((a, b) => a.order - b.order);
const current = () => sorted().find((c) => c.status === "doing") || sorted().find((c) => c.status === "todo");
const STATUS = { todo: "⏳ لسه", doing: "▶️ شغال فيه", done: "✅ خلصته", skip: "🚫 مش محتاجه" };
const CATS = ["سلاسل إمداد", "مخازن", "شحن وجمارك", "أدوات وبرامج", "إدارة", "لغة", "تاني"];

function platformOf(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    const known = { "coursera.org": "Coursera", "edx.org": "edX", "udemy.com": "Udemy", "youtube.com": "YouTube", "youtu.be": "YouTube",
      "linkedin.com": "LinkedIn Learning", "learning.sap.com": "SAP Learning", "learn.microsoft.com": "Microsoft Learn", "alison.com": "Alison",
      "futurelearn.com": "FutureLearn", "edraak.org": "إدراك", "rwaq.org": "رواق", "maharatech.gov.eg": "مهارة تك", "skillshare.com": "Skillshare" };
    return Object.entries(known).find(([k]) => h.endsWith(k))?.[1] || h;
  } catch { return ""; }
}

function addCourse(c) {
  if (c.url && S.courses.some((x) => x.url && x.url === c.url)) return false;
  S.courses.push({ id: uid(), title: c.title || c.url || "كورس", provider: c.provider || platformOf(c.url), url: c.url || "",
    hours: +c.hours || 0, category: CATS.includes(c.category) ? c.category : "تاني", status: c.keep === false ? "skip" : "todo",
    order: S.courses.length ? Math.max(...S.courses.map((x) => x.order)) + 1 : 1, progress: 0, where: "", notes: [],
    why: c.why || "", cv: c.cv || "", src: c.src || "mine" });
  return true;
}

// كل إنجاز بيطلّع نسخة جديدة من السي في
function achieve(t) {
  S.achievements.push({ id: uid(), date: today(), t });
  S.cvVersion++;
  save();
}
function checkDone(c) {
  if (c.status === "done" && !c.doneAt) { c.doneAt = today(); achieve(`خلصت كورس: ${c.title}`); }
}

function addXP(n) {
  S.xp += n;
  const t = today();
  if (S.lastStudy !== t) {
    S.streak = S.lastStudy && daysBetween(S.lastStudy, t) === 1 ? S.streak + 1 : 1;
    S.lastStudy = t;
  }
  save(); refreshStats();
}
function refreshStats() {
  document.getElementById("xp").textContent = S.xp;
  document.getElementById("streak").textContent = S.streak;
}

// ---------- المراجعة المتباعدة للملاحظات ----------
const BOX_DAYS = [0, 1, 3, 7, 16, 35, 90];
const allNotes = () => S.courses.flatMap((c) => c.notes.map((n) => ({ ...n, course: c })));
const dueNotes = () => allNotes().filter((n) => n.due <= today());
function gradeNote(courseId, noteId, ok) {
  const n = S.courses.find((c) => c.id === courseId).notes.find((x) => x.id === noteId);
  n.box = ok ? Math.min(n.box + 1, 6) : 0;
  n.due = addDays(today(), BOX_DAYS[n.box] || 1);
  addXP(ok ? 2 : 1);
}

// ---------- التطبيقات ----------
const APPS = {
  today: {
    icon: "📅", name: "النهارده", color: "#d97706",
    badge: () => WEEKDAY_PLAN[new Date().getDay()].name,
    defaultSection: () => "now",
    side: () => [
      { head: `الأسبوع ${weekNum()} من 52` },
      { id: "now", label: "🎯 جلسة النهارده", mark: S.log[today()] ? "✅" : "" },
      { id: "week", label: "📊 أسبوعي" },
      { head: "نظام الأسبوع (ساعة في اليوم)" },
      ...[6, 0, 1, 2, 3, 4, 5].map((d) => ({ head: `${["الحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"][d]}: ${WEEKDAY_PLAN[d].icon} ${WEEKDAY_PLAN[d].name}` })),
    ],
    view: (s) => s === "week" ? weekView() : todayView(),
  },
  courses: {
    icon: "📚", name: "كورساتي", color: "#0284c7",
    badge: () => `${S.courses.filter((c) => c.status === "done").length}/${S.courses.filter((c) => c.status !== "skip").length} خلصوا`,
    defaultSection: () => (S.courses.length ? "all" : "add"),
    side: () => [
      { head: "الكورسات" },
      { id: "all", label: "📋 بالترتيب", mark: String(S.courses.length) },
      ...Object.entries(STATUS).map(([k, v]) => ({ id: "st-" + k, label: v, mark: String(S.courses.filter((c) => c.status === k).length) })),
      { head: "إضافة وتنظيم" },
      { id: "add", label: "➕ ضيف لينكات" },
      { id: "organize", label: "🤖 رتبهم مع Claude" },
      ...(sorted().filter((c) => c.status === "doing").length ? [{ head: "شغال فيهم" }] : []),
      ...sorted().filter((c) => c.status === "doing").map((c) => ({ id: c.id, label: c.title, mark: `${c.progress}%` })),
    ],
    view: (s) => s === "add" ? addView() : s === "organize" ? organizeView() : s.startsWith("st-") ? listView(s.slice(3)) : S.courses.find((c) => c.id === s) ? courseView(s) : listView(),
  },
  suggest: {
    icon: "💡", name: "مقترحات", color: "#059669",
    badge: () => `${SUGGESTED.length} للسي في`,
    defaultSection: () => phaseOf(weekNum()).id,
    side: () => [
      { head: "حسب مرحلة الخطة" },
      ...PHASES.map((p) => ({ id: p.id, label: `${p.name} · أسابيع ${p.from}–${p.to}`, color: p.color, mark: String(SUGGESTED.filter((x) => x.phase === p.id).length) })),
    ],
    view: (s) => suggestView(PHASES.find((p) => p.id === s) || PHASES[0]),
  },
  review: {
    icon: "🧠", name: "المراجعة", color: "#db2777",
    badge: () => `${dueNotes().length} مستحقة`,
    defaultSection: () => "due",
    side: () => [
      { head: "المراجعة" },
      { id: "due", label: "🔁 ملاحظات مستحقة", mark: String(dueNotes().length) },
      { id: "quiz", label: "📝 امتحن نفسك مع Claude" },
      { id: "glossary", label: "🇩🇪 مصطلحات لوجستيك", mark: String(S.glossary.length) },
    ],
    view: (s) => s === "quiz" ? quizView() : s === "glossary" ? glossaryView() : reviewView(),
  },
  road: {
    icon: "🗺️", name: "طريق ألمانيا", color: "#dc2626",
    badge: () => `${daysBetween(today(), targetDate())} يوم`,
    defaultSection: () => "steps",
    side: () => [
      { head: "Ausbildung في اللوجستيك" },
      { id: "steps", label: "✅ الخطوات بالمواعيد", mark: `${Object.keys(S.milestones).length}/${MILESTONES.length}` },
      { id: "phases", label: "🧭 مراحل السنة" },
      { id: "berufe", label: "🏭 المهن المناسبة ليك" },
      { id: "links", label: "🔗 مواقع رسمية" },
    ],
    view: (s) => ({ phases: phasesView, berufe: berufeView, links: linksView }[s] || stepsView)(),
  },
  jobs: {
    icon: "💼", name: "الوظايف", color: "#ea580c",
    badge: () => `${S.jobs.filter((j) => j.status === "new").length} جديدة · ${S.jobs.filter((j) => j.status === "sent").length} قدمت`,
    defaultSection: () => (S.jobs.length ? "all" : "search"),
    side: () => [
      { head: "دوّر" },
      { id: "search", label: "🤖 Claude يدورلي في كل المصادر" },
      { id: "sources", label: "🔎 دوّر بنفسك (كل المواقع)" },
      { head: "الفرص بتاعتي" },
      { id: "all", label: "📋 كل الفرص", mark: String(S.jobs.length) },
      ...Object.entries(JOB_STATUS).map(([k, v]) => ({ id: "st-" + k, label: v.t, mark: String(S.jobs.filter((j) => j.status === k).length) })),
      { id: "add", label: "➕ ضيف فرصة بلينك" },
    ],
    view: (s) => s === "search" ? jobSearchView() : s === "sources" ? sourcesView() : s === "add" ? jobAddView()
      : s.startsWith("st-") ? jobsView(s.slice(3)) : S.jobs.find((j) => j.id === s) ? jobView(s) : jobsView(),
  },
  profile: {
    icon: "👤", name: "بروفايلي", color: "#7c3aed",
    badge: () => `السي في نسخة ${S.cvVersion}`,
    defaultSection: () => (S.profile.name ? "cv" : "data"),
    side: () => [
      { head: "البروفايل" },
      { id: "data", label: "🪪 بياناتي وخبرتي" },
      { id: "import", label: "📥 استورد السي في القديم" },
      { id: "certs", label: "🏅 شهاداتي", mark: String(S.certs.length) },
      { id: "wins", label: "🏆 إنجازاتي", mark: String(S.achievements.length) },
      { head: "السي في" },
      { id: "cv", label: `📄 Lebenslauf (نسخة ${S.cvVersion})`, mark: newsSinceSync().length ? `${newsSinceSync().length} جديد` : "" },
      { id: "interview", label: "🎤 تدريب المقابلة" },
    ],
    view: (s) => ({ data: profileDataView, import: importCVView, certs: certsView, wins: winsView, interview: interviewView }[s] || cvView)(),
  },
  settings: {
    icon: "⚙️", name: "الإعدادات", color: "#475569",
    badge: () => "",
    defaultSection: () => "link",
    side: () => [
      { head: "الإعدادات" },
      { id: "link", label: "🔗 ربط Claude و ChatGPT" },
      { id: "general", label: "📆 تاريخ البداية" },
      { id: "backup", label: "💾 نسخة احتياطية" },
    ],
    view: (s) => ({ general: generalView, backup: backupView }[s] || projectView)(),
  },
};

// ---------- الشاشة الرئيسية ----------
// الشاشة الرئيسية متقسمة لمجموعات، والإعدادات في الهيدر
const GROUPS = [
  { t: "كل يوم", apps: ["today", "review"] },
  { t: "التعلّم", apps: ["courses", "suggest"] },
  { t: "ألمانيا والشغل", apps: ["jobs", "profile", "road"] },
];
const appTitle = (id) => `<span class="title-ic" style="--c:${APPS[id].color}">${icon(id, 18)}</span>${APPS[id].name}`;

function homeView() {
  const p = phaseOf(weekNum());
  const c = current();
  const left = daysBetween(today(), targetDate());
  $view.innerHTML = `
    <div class="hero2">
      <div class="hero-top">
        <span class="chip">${esc(p.name)}</span>
        <span class="hero-week">الأسبوع ${weekNum()} من 52</span>
      </div>
      <div class="hero-main">
        <div><div class="hero-num">${dayNum()}<small> / 365</small></div><div class="hero-sub">يوم في الخطة</div></div>
        <div class="hero-trip">${icon("plane", 22)}<div><b>${left}</b> يوم<br><small>${fmt(targetDate())}</small></div></div>
      </div>
      <div class="hero-bar"><i style="width:${(dayNum() / 365) * 100}%"></i></div>
      <a class="hero-next" href="${c ? "#/today" : "#/courses/add"}">${c ? `${icon("courses", 18)}<span>${esc(c.title)}</span><b>${c.progress}%</b>` : `${icon("courses", 18)}<span>ابدأ: ضيف لينكات كورساتك</span>`}${icon("chevron", 18)}</a>
    </div>
    ${GROUPS.map((g) => `
      <div class="group-title">${g.t}</div>
      <div class="apps">${g.apps.map((id) => { const a = APPS[id]; return `
        <a class="app" href="#/${id}" style="--c:${a.color}">
          <span class="app-icon">${icon(id, 26)}</span>
          <span class="app-name">${a.name}</span>
          <span class="app-badge">${esc(a.badge()) || "&nbsp;"}</span>
        </a>`; }).join("")}
      </div>`).join("")}`;
}

// الإيموجي اللي في أول العناوين بتتشال عشان الشكل يبقى موحد مع الأيقونات
const stripEmoji = (t) => String(t).replace(/^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}←-⇿⬅-⬇]️?\s*)+/u, "");
function cleanHeadings() {
  $view.querySelectorAll("h2, h3").forEach((h) => { const n = h.firstChild; if (n?.nodeType === 3) n.textContent = stripEmoji(n.textContent); });
}

function renderSide(app, section) {
  $side.style.setProperty("--c", app.color);
  $side.innerHTML = `<div class="side-title">${appTitle(route.app)}</div>` + app.side().map((it) => it.head
    ? `<div class="side-head">${esc(it.head)}</div>`
    : `<a class="side-item ${it.id === section ? "on" : ""}" href="#/${route.app}/${it.id}">
        ${it.color ? `<i class="dot" style="background:${it.color}"></i>` : ""}<span>${esc(stripEmoji(it.label))}</span>${it.mark ? `<small>${esc(it.mark)}</small>` : ""}</a>`).join("");
}

const handoffBtns = (key) => `<button class="btn" data-ai="claude" data-k="${key}">🟠 افتح في Claude</button><button class="btn alt" data-ai="chatgpt" data-k="${key}">🟢 ChatGPT</button>`;
function bindAI(prompts) {
  $view.querySelectorAll("[data-ai]").forEach((b) => b.onclick = () => { openIn(b.dataset.ai, prompts[b.dataset.k]()); addXP(3); });
}

// ---------- النهارده ----------
function todayView() {
  const plan = WEEKDAY_PLAN[new Date().getDay()];
  const c = current();
  const done = S.log[today()];
  const isStudy = plan.name === "درس جديد" || plan.name === "تطبيق عملي";
  $view.innerHTML = `
    <div class="card">
      <h2>${plan.icon} ${plan.name} <small class="muted">(${plan.min} دقيقة)</small></h2>
      <p>${plan.t}</p>
      ${done ? `<p class="pill" style="background:var(--ok)">✅ خلصت جلسة النهارده</p>` : ""}
    </div>
    ${plan.name === "مراجعة واختبار" ? `<div class="card"><h3>🔁 عندك ${dueNotes().length} ملاحظة مستحقة</h3>
      <a class="btn" href="#/review/due">ابدأ المراجعة</a><a class="btn alt" href="#/review/quiz">📝 Claude يمتحني</a></div>` : ""}
    ${plan.name === "لوجستيك بالألماني" ? `<div class="card"><h3>🇩🇪 مصطلحات الأسبوع</h3><a class="btn" href="#/review/glossary">هات 15 مصطلح</a></div>` : ""}
    ${c ? `<div class="card">
      <h3>📘 ${esc(c.title)}</h3>
      <p class="muted">${esc(c.provider)} · ${STATUS[c.status]} · ${c.progress}%</p>
      ${c.url ? `<a class="btn acc" href="${esc(c.url)}" target="_blank" rel="noopener">▶️ افتح الكورس</a>` : ""}
      <a class="btn alt" href="#/courses/${c.id}">✏️ تفاصيل الكورس</a>
      ${isStudy ? `
      <label>وصلت لفين؟ (اسم الدرس/الأسبوع)</label>
      <input id="where" value="${esc(c.where)}" placeholder="مثلاً: Week 2 – Inventory" />
      <label>نسبة اللي خلصته: <b id="pv">${c.progress}%</b></label>
      <input id="prog" type="range" min="0" max="100" step="5" value="${c.progress}" />
      <label>إيه اللي اتعلمته النهارده؟ (كل فكرة في سطر — هترجعلك في المراجعة)</label>
      <textarea id="notes" class="box-text" style="min-height:90px" placeholder="مثلاً: FIFO يعني اللي يدخل الأول يطلع الأول"></textarea>
      <p class="muted">🤖 مش فاهم حاجة؟ ${handoffBtns("explain")}</p>` : ""}
      <button class="btn ok" id="finish">✔️ خلصت جلسة النهارده (+20 ⭐)</button>
    </div>` : `<div class="card"><h3>لسه مفيش كورسات</h3><p class="muted">ابدأ بإضافة لينكات كورساتك، أو خد كورس من المقترحات.</p>
      <a class="btn" href="#/courses/add">➕ ضيف لينكات</a><a class="btn alt" href="#/suggest">💡 المقترحات</a></div>`}`;
  if (!c) return;
  bindAI({ explain: () => { saveForm(c); return PROMPTS.explain(ctxP(), c); } });
  const prog = document.getElementById("prog");
  if (prog) prog.oninput = () => { document.getElementById("pv").textContent = prog.value + "%"; };
  on("#finish", () => {
    if (isStudy) saveForm(c);
    S.log[today()] = { min: plan.min, course: c.id };
    addXP(20);
    alert(c.status === "done" ? `🎉 مبروك! خلصت "${c.title}" واتضاف للسي في. ارفع شهادته من 👤 بروفايلي` : "عاش! ✅ +20 ⭐");
    render();
  });
}
function saveForm(c) {
  const where = document.getElementById("where"), prog = document.getElementById("prog"), notes = document.getElementById("notes");
  if (where) c.where = where.value.trim();
  if (prog) {
    c.progress = +prog.value;
    if (c.progress >= 100) c.status = "done";
    else if (c.status === "todo" && c.progress > 0) c.status = "doing";
    checkDone(c);
  }
  if (notes) {
    notes.value.split("\n").map((t) => t.trim()).filter(Boolean)
      .forEach((t) => c.notes.push({ id: uid(), t, date: today(), box: 0, due: addDays(today(), 1) }));
    notes.value = "";
  }
  save();
}

function weekSummary() {
  const days = [...Array(7)].map((_, i) => addDays(today(), -i)).filter((d) => S.log[d]);
  const mins = days.reduce((s, d) => s + S.log[d].min, 0);
  const notes = allNotes().filter((n) => daysBetween(n.date, today()) < 7);
  return { days, mins, notes };
}
function weekView() {
  const w = weekSummary();
  const text = `- ذاكرت ${w.days.length} أيام من 7 (${w.mins} دقيقة)\n- الكورس الحالي: ${current()?.title || "مفيش"} (${current()?.progress || 0}%)\n- اللي اتعلمته:\n${w.notes.map((n) => `  • ${n.t}`).join("\n") || "  (مفيش ملاحظات)"}`;
  $view.innerHTML = `
    <div class="card">
      <h2>📊 آخر 7 أيام</h2>
      <div class="row"><div><div class="big">${w.days.length}/7</div><div class="muted">أيام مذاكرة</div></div>
        <div><div class="big">${Math.round(w.mins / 60 * 10) / 10}</div><div class="muted">ساعات</div></div>
        <div><div class="big">${w.notes.length}</div><div class="muted">ملاحظات جديدة</div></div></div>
      <p class="muted">🤖 خلي الكوتش يقيّم أسبوعك ويقولك تعدّل إيه:</p>
      ${handoffBtns("weekly")}
    </div>`;
  bindAI({ weekly: () => PROMPTS.weekly(ctxP(), text) });
}

// ---------- الكورسات ----------
function listView(status) {
  const list = sorted().filter((c) => !status || c.status === status);
  $view.innerHTML = `
    <div class="card">
      <h2>${status ? STATUS[status] : "📋 كورساتي بالترتيب"} <small class="muted">(${list.length})</small></h2>
      ${status ? "" : `<p class="muted">ده ترتيب المذاكرة من الصفر: التطبيق بيديك كل يوم أول كورس مخلصتوش. حرّك بالأسهم.</p>`}
      ${list.length ? `<table class="words">${list.map((c) => `<tr>
        <td><a href="#/courses/${c.id}"><b>${esc(c.title)}</b></a><br><small class="muted">${esc(c.provider)} · ${esc(c.category)}${c.hours ? ` · ${c.hours} ساعة` : ""} · ${STATUS[c.status]}${c.status === "doing" ? ` ${c.progress}%` : ""}</small></td>
        <td style="white-space:nowrap">${status ? "" : `<button class="icon-btn" data-up="${c.id}" title="لفوق">⬆️</button><button class="icon-btn" data-down="${c.id}" title="لتحت">⬇️</button>`}
        ${c.url ? `<a class="icon-btn" href="${esc(c.url)}" target="_blank" rel="noopener" title="افتح">🔗</a>` : ""}</td></tr>`).join("")}</table>`
      : `<p class="muted">مفيش هنا حاجة.</p><a class="btn" href="#/courses/add">➕ ضيف لينكات</a>`}
    </div>`;
  const move = (id, dir) => {
    const L = sorted(), i = L.findIndex((c) => c.id === id), j = i + dir;
    if (j < 0 || j >= L.length) return;
    [L[i].order, L[j].order] = [L[j].order, L[i].order];
    save(); render();
  };
  $view.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => move(b.dataset.up, -1));
  $view.querySelectorAll("[data-down]").forEach((b) => b.onclick = () => move(b.dataset.down, 1));
}

function addView() {
  $view.innerHTML = `
    <div class="card">
      <h2>➕ ضيف لينكات كورساتك</h2>
      <p class="muted">الصق كل اللينكات مرة واحدة، كل لينك في سطر (ممكن تكتب اسم الكورس قبل اللينك في نفس السطر). التطبيق هيعرف المنصة لوحده.</p>
      <textarea id="raw" class="box-text" placeholder="Supply Chain Basics https://www.udemy.com/course/...&#10;https://www.coursera.org/learn/..."></textarea>
      <button class="btn ok" id="addRaw">➕ ضيفهم</button>
      <p class="muted">💡 عايزهم متنضفين ومترتبين؟ استخدم <a href="#/courses/organize">🤖 رتبهم مع Claude</a> بدل كده.</p>
    </div>
    <div class="card">
      <h3>أو ضيف كورس واحد بالتفصيل</h3>
      <label>اسم الكورس</label><input id="t" />
      <label>اللينك</label><input id="u" dir="ltr" placeholder="https://..." />
      <div class="row"><div><label>التصنيف</label><select id="cat">${CATS.map((c) => `<option>${c}</option>`).join("")}</select></div>
        <div><label>عدد الساعات (تقريباً)</label><input id="h" type="number" min="0" /></div></div>
      <button class="btn" id="addOne">➕ ضيف</button>
    </div>`;
  on("#addRaw", () => {
    let n = 0;
    document.getElementById("raw").value.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const m = line.match(/https?:\/\/\S+/);
      const url = m ? m[0] : "";
      const title = line.replace(url, "").replace(/[-–:|]+\s*$/, "").trim();
      if (addCourse({ url, title: title || (url ? `كورس على ${platformOf(url)}` : line) })) n++;
    });
    save(); alert(`اتضاف ${n} كورس ✅`); location.hash = "#/courses/all";
  });
  on("#addOne", () => {
    const t = document.getElementById("t").value.trim(), u = document.getElementById("u").value.trim();
    if (!t && !u) return alert("اكتب الاسم أو اللينك");
    addCourse({ title: t, url: u, category: document.getElementById("cat").value, hours: document.getElementById("h").value });
    save(); location.hash = "#/courses/all";
  });
}

function organizeView() {
  const existing = sorted().map((c) => `${c.title} ${c.url}`).join("\n");
  $view.innerHTML = `
    <div class="card">
      <h2>🤖 رتب كورساتك مع Claude</h2>
      <ol class="tasks">
        <li>الصق هنا كل كورساتك ولينكاتها بأي شكل (أو سيبها فاضية لو ضفتهم قبل كده).</li>
        <li>دوس "افتح في Claude": هينضفهم ويرتبهم من الصفر ويقولك أي واحد ملوش لازمة لهدفك.</li>
        <li>انسخ رده كله والصقه في الخانة التانية ودوس "استورد".</li>
      </ol>
      <textarea id="raw" class="box-text" placeholder="الصق لينكاتك هنا">${esc(existing)}</textarea>
      ${handoffBtns("organize")}
    </div>
    <div class="card">
      <h3>📥 الصق رد Claude هنا</h3>
      <textarea id="reply" class="box-text" placeholder='[{"title": "...", ...}]'></textarea>
      <label><input type="checkbox" id="replace" style="width:auto" ${S.courses.length ? "checked" : ""}/> استبدل الترتيب القديم بترتيب Claude (تقدمك وملاحظاتك بتفضل)</label>
      <button class="btn ok" id="imp">📥 استورد</button>
    </div>`;
  bindAI({ organize: () => PROMPTS.organize(document.getElementById("raw").value.trim()) });
  on("#imp", () => {
    let list;
    try { list = parseJSONList(document.getElementById("reply").value); } catch { return alert("مش لاقي JSON في الرد. انسخ رد Claude كله."); }
    const replace = document.getElementById("replace").checked;
    const old = S.courses;
    if (replace) S.courses = [];
    list.forEach((x) => {
      const prev = old.find((c) => (x.url && c.url === x.url) || c.title === x.title);
      if (replace && prev) {
        S.courses.push({ ...prev, title: x.title || prev.title, provider: x.provider || prev.provider, hours: +x.hours || prev.hours,
          category: CATS.includes(x.category) ? x.category : prev.category, why: x.why || prev.why,
          status: x.keep === false && prev.status === "todo" ? "skip" : prev.status, order: S.courses.length + 1 });
      } else addCourse(x);
    });
    if (replace) old.filter((c) => !S.courses.some((n) => n.id === c.id)).forEach((c) => S.courses.push({ ...c, order: S.courses.length + 1 }));
    save(); alert(`تمام ✅ ${list.length} كورس مترتبين`); location.hash = "#/courses/all";
  });
}

function courseView(id) {
  const c = S.courses.find((x) => x.id === id);
  $view.innerHTML = `
    <div class="card">
      <h2>📘 ${esc(c.title)}</h2>
      ${c.why ? `<p class="muted">💡 ${esc(c.why)}</p>` : ""}
      ${c.url ? `<a class="btn acc" href="${esc(c.url)}" target="_blank" rel="noopener">▶️ افتح الكورس</a>` : ""}
      ${handoffBtns("explain")}
      <label>الاسم</label><input id="t" value="${esc(c.title)}" />
      <label>اللينك</label><input id="u" dir="ltr" value="${esc(c.url)}" />
      <div class="row">
        <div><label>المنصة</label><input id="p" value="${esc(c.provider)}" /></div>
        <div><label>التصنيف</label><select id="cat">${CATS.map((k) => `<option ${k === c.category ? "selected" : ""}>${k}</option>`).join("")}</select></div>
      </div>
      <div class="row">
        <div><label>الحالة</label><select id="st">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === c.status ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label>الساعات</label><input id="h" type="number" value="${c.hours}" /></div>
      </div>
      <label>التقدم: <b id="pv">${c.progress}%</b></label>
      <input id="prog" type="range" min="0" max="100" step="5" value="${c.progress}" />
      <label>وصلت لفين</label><input id="where" value="${esc(c.where)}" />
      <label>السطر اللي هيظهر في السي في (Weiterbildungen)</label><input id="cv" dir="ltr" value="${esc(c.cv || `${c.title} – ${c.provider}`)}" />
      <button class="btn ok" id="saveC">💾 حفظ</button>
      <button class="btn bad" id="del">🗑️ امسح الكورس</button>
    </div>
    <div class="card">
      <h3>📝 ملاحظاتي (${c.notes.length})</h3>
      ${c.notes.length ? `<ul class="tasks">${c.notes.map((n) => `<li>${esc(n.t)} <small class="muted">${n.date}</small> <button class="icon-btn" data-dn="${n.id}">✖</button></li>`).join("")}</ul>` : `<p class="muted">الملاحظات بتتكتب من شاشة 📅 النهارده بعد كل جلسة.</p>`}
      ${handoffBtns("quiz")}
    </div>`;
  bindAI({ explain: () => PROMPTS.explain(ctxP(), c), quiz: () => PROMPTS.quiz(ctxP(), c, c.notes.map((n) => n.t)) });
  const prog = document.getElementById("prog");
  prog.oninput = () => { document.getElementById("pv").textContent = prog.value + "%"; };
  on("#saveC", () => {
    const v = (i) => document.getElementById(i).value.trim();
    Object.assign(c, { title: v("t"), url: v("u"), provider: v("p"), category: v("cat"), status: v("st"), hours: +v("h") || 0, progress: +prog.value, where: v("where"), cv: v("cv") });
    if (c.progress >= 100) c.status = "done";
    checkDone(c);
    save(); alert(c.doneAt === today() ? "🎉 اتحفظ، والكورس اتضاف للسي في. ارفع شهادته من 👤 بروفايلي ← الشهادات" : "اتحفظ ✅"); render();
  });
  on("#del", () => { if (confirm(`تمسح "${c.title}" وملاحظاته؟`)) { S.courses = S.courses.filter((x) => x.id !== id); save(); location.hash = "#/courses/all"; } });
  $view.querySelectorAll("[data-dn]").forEach((b) => b.onclick = () => { c.notes = c.notes.filter((n) => n.id !== b.dataset.dn); save(); render(); });
}

// ---------- المقترحات ----------
function suggestView(p) {
  const list = SUGGESTED.filter((x) => x.phase === p.id);
  $view.innerHTML = `
    <div class="card">
      <h2><span class="pill" style="background:${p.color}">أسابيع ${p.from}–${p.to}</span> ${esc(p.name)}</h2>
      <p class="muted">${esc(p.goal)}</p>
      <p class="muted">💰 نصيحة: على Coursera دوس "Audit" عشان تذاكر ببلاش، ولو عايز الشهادة اطلب <b>Financial Aid</b> (غالباً بتتقبل).</p>
    </div>
    ${list.map((x) => {
      const added = S.courses.some((c) => c.sid === x.id);
      return `<div class="card">
        <h3>${x.type === "ai" ? "🤖" : "🎓"} ${esc(x.title)}</h3>
        <p class="muted">${esc(x.provider)} · ~${x.hours} ساعة · ${esc(x.cost)}</p>
        <p>${esc(x.why)}</p>
        ${x.cv ? `<p class="muted" dir="ltr">📄 ${esc(x.cv)}</p>` : ""}
        ${x.url ? `<a class="btn alt" href="${x.url}" target="_blank" rel="noopener">🔗 افتح</a>` : ""}
        ${x.type === "ai" ? `<a class="btn alt" href="${x.id === "s-glossary" ? "#/review/glossary" : "#/cv/interview"}">ابدأ</a>` : ""}
        <button class="btn ${added ? "alt" : "ok"}" data-sid="${x.id}" ${added ? "disabled" : ""}>${added ? "✔️ في كورساتي" : "➕ ضيفه لكورساتي"}</button>
      </div>`;
    }).join("")}`;
  $view.querySelectorAll("[data-sid]").forEach((b) => b.onclick = () => {
    const x = SUGGESTED.find((s) => s.id === b.dataset.sid);
    addCourse({ title: x.title, provider: x.provider, url: x.url, hours: x.hours, cv: x.cv, why: x.why, src: "suggested",
      category: { p1: "سلاسل إمداد", p2: "شحن وجمارك", p3: "أدوات وبرامج", p4: "لغة" }[x.phase] });
    S.courses[S.courses.length - 1].sid = x.id;
    save(); render();
  });
}

// ---------- المراجعة ----------
function reviewView() {
  const due = dueNotes();
  if (!due.length) {
    $view.innerHTML = `<div class="card flash"><div class="big">🎉</div><div>مفيش ملاحظات مستحقة النهارده.</div>
      <div class="muted">كل ما تكتب "اتعلمت إيه" بعد الجلسة، بترجعلك هنا بكرة وبعد 3 أيام وأسبوع وشهر...</div></div>`;
    return;
  }
  const n = due[0];
  $view.innerHTML = `
    <div class="card"><p class="muted">باقي ${due.length} · ${esc(n.course.title)}</p>
      <div class="flash"><div style="font-size:20px;font-weight:700">${esc(n.t)}</div>
      <div class="muted">فاكر الفكرة دي؟ اشرحها لنفسك بصوت عالي بمثال من شغلك.</div></div>
      <button class="btn ok" id="yes">👍 فاكرها</button><button class="btn bad" id="no">👎 نسيتها</button>
    </div>`;
  on("#yes", () => { gradeNote(n.course.id, n.id, true); render(); });
  on("#no", () => { gradeNote(n.course.id, n.id, false); render(); });
}

function quizView() {
  const list = sorted().filter((c) => c.status === "doing" || c.status === "done");
  $view.innerHTML = `
    <div class="card"><h2>📝 Claude يمتحنك</h2>
      <p class="muted">اختار كورس: Claude هياخد ملاحظاتك ويسألك 5 أسئلة واحد واحد.</p></div>
    ${list.length ? list.map((c) => `<div class="card"><h3>${esc(c.title)}</h3><p class="muted">${c.notes.length} ملاحظة · ${STATUS[c.status]}</p>
      <button class="btn" data-q="${c.id}" data-app="claude">🟠 امتحني في Claude</button><button class="btn alt" data-q="${c.id}" data-app="chatgpt">🟢 ChatGPT</button></div>`).join("")
      : `<div class="card"><p class="muted">ابدأ كورس الأول من 📚 كورساتي.</p></div>`}`;
  $view.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => {
    const c = S.courses.find((x) => x.id === b.dataset.q);
    openIn(b.dataset.app, PROMPTS.quiz(ctxP(), c, c.notes.map((n) => n.t))); addXP(5);
  });
}

// المصطلحات بتتحفظ هنا، وكمان بتتضاف لبطاقات Deutsch 365 لو التطبيقين على نفس الموقع
function pushToDeutsch(words) {
  try {
    const d = JSON.parse(localStorage.getItem("deutsch365"));
    if (!d) return -1;
    d.cards = d.cards || {};
    let n = 0;
    for (const w of words) if (!d.cards[w.de]) { d.cards[w.de] = { ar: w.ar, ex: w.ex || "", tip: w.tip || "", box: 0, due: today() }; n++; }
    localStorage.setItem("deutsch365", JSON.stringify(d));
    return n;
  } catch { return -1; }
}
function glossaryView() {
  $view.innerHTML = `
    <div class="card">
      <h2>🇩🇪 مصطلحات اللوجستيك بالألماني</h2>
      <p class="muted">كل جمعة: Claude يديك 15 مصطلح جديد ← انسخ رده والصقه تحت ← بيتحفظوا هنا ويروحوا لبطاقات Deutsch 365 تراجعهم مع الألماني.</p>
      ${handoffBtns("glossary")}
      <textarea id="reply" class="box-text" placeholder="الصق رد Claude هنا"></textarea>
      <button class="btn ok" id="imp">📥 احفظ المصطلحات</button>
    </div>
    <div class="card"><h3>كل المصطلحات (${S.glossary.length})</h3>
      ${S.glossary.length ? `<table class="words">${[...S.glossary].reverse().map((w) => `<tr><td dir="ltr"><b>${esc(w.de)}</b></td><td>${esc(w.ar)}</td></tr>`).join("")}</table>` : `<p class="muted">لسه.</p>`}
    </div>`;
  bindAI({ glossary: () => PROMPTS.glossary(ctxP(), S.glossary.map((w) => w.de)) });
  on("#imp", () => {
    let list;
    try { list = parseJSONList(document.getElementById("reply").value).filter((w) => w.de && w.ar); } catch { return alert("مش لاقي JSON في الرد. انسخ رد Claude كله."); }
    const fresh = list.filter((w) => !S.glossary.some((g) => g.de === w.de));
    S.glossary.push(...fresh.map((w) => ({ de: w.de, ar: w.ar, ex: w.ex || "", tip: w.tip || "" })));
    save(); addXP(10);
    const n = pushToDeutsch(fresh);
    alert(`اتحفظ ${fresh.length} مصطلح ✅${n >= 0 ? `\nواتضاف ${n} لبطاقات Deutsch 365 🧠` : ""}`);
    render();
  });
}

// ---------- طريق ألمانيا ----------
function stepsView() {
  const w = weekNum();
  $view.innerHTML = `
    <div class="card">
      <h2>✅ خطوات الـ Ausbildung</h2>
      <p class="muted">⚠️ المواعيد دي تقريبية. شروط الفيزا ومستوى اللغة المطلوب بيتغيروا، فاتأكد دايماً من موقع السفارة و Make it in Germany.</p>
      <table class="words">${MILESTONES.map((m) => {
        const date = addDays(S.start, (m.week - 1) * 7);
        const late = !S.milestones[m.id] && m.week < w;
        return `<tr><td><input type="checkbox" data-m="${m.id}" style="width:auto" ${S.milestones[m.id] ? "checked" : ""}/></td>
          <td>${m.week === w ? "👈 " : ""}${esc(m.t)}<br><small class="muted" style="${late ? "color:var(--bad)" : ""}">الأسبوع ${m.week} · ${fmt(date)}${late ? " · متأخرة" : ""}</small></td></tr>`;
      }).join("")}</table>
    </div>`;
  $view.querySelectorAll("[data-m]").forEach((b) => b.onchange = () => {
    if (b.checked) { S.milestones[b.dataset.m] = today(); addXP(30); achieve(`خطوة Ausbildung: ${MILESTONES.find((m) => m.id === b.dataset.m).t}`); } else delete S.milestones[b.dataset.m];
    save(); renderSide(APPS.road, route.section);
  });
}
function phasesView() {
  const w = weekNum();
  $view.innerHTML = PHASES.map((p) => `<div class="card" style="${w >= p.from && w <= p.to ? "outline:3px solid var(--accent)" : ""}">
    <h3><span class="pill" style="background:${p.color}">أسابيع ${p.from}–${p.to}</span> ${esc(p.name)}</h3>
    <p class="muted">${fmt(addDays(S.start, (p.from - 1) * 7))} ← ${fmt(addDays(S.start, p.to * 7 - 1))}</p>
    <p>${esc(p.goal)}</p>
    <ul class="tasks">${SUGGESTED.filter((x) => x.phase === p.id).map((x) => `<li>${esc(x.title)}</li>`).join("")}</ul>
    <a href="#/suggest/${p.id}">شوف المقترحات ←</a></div>`).join("");
}
function berufeView() {
  $view.innerHTML = `
    <div class="card"><h2>🏭 مهن Ausbildung تناسب خبرتك</h2>
      <p class="muted">اختار واحدة تركز عليها في السي في والمقابلات. 💡 بما إنك شغال في المجال، اسأل الشركة عن <b>Verkürzung</b> (تقصير مدة التدريب).</p>
      ${BERUFE.map((b) => `<label class="card" style="display:block;cursor:pointer;margin:8px 0">
        <input type="radio" name="beruf" value="${esc(b.name)}" style="width:auto" ${S.beruf === b.name ? "checked" : ""}/>
        <b dir="ltr">${esc(b.name)}</b><br><span class="muted">${esc(b.ar)} · ${b.years} سنين</span></label>`).join("")}
      <a class="btn alt" href="https://web.arbeitsagentur.de/berufenet/" target="_blank" rel="noopener">🔎 اقرا وصف المهن في BERUFENET</a>
    </div>`;
  $view.querySelectorAll("[name=beruf]").forEach((r) => r.onchange = () => { S.beruf = r.value; save(); });
}
function linksView() {
  $view.innerHTML = `<div class="card"><h2>🔗 مواقع رسمية ومفيدة</h2>
    <ul class="tasks">${LINKS.map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener">${esc(l.name)}</a></li>`).join("")}</ul></div>`;
}

// ---------- الوظايف ----------
function profileSummary() {
  const p = S.profile;
  const done = S.courses.filter((c) => c.status === "done").map((c) => c.title);
  return [
    `- الخبرة: ${p.exp.map((e) => `${e.title} في ${e.company} (${e.from}–${e.to})`).join("، ") || "شغال في اللوجستيك في مصر"}`,
    `- التعليم: ${p.edu.map((e) => `${e.title} (${e.to})`).join("، ") || "—"}`,
    `- اللغات: ${p.langs.map((l) => `${l.lang} ${l.level}`).join("، ")}`,
    `- كورسات خلصتها: ${done.join("، ") || "لسه"}`,
    `- شهادات: ${S.certs.map((c) => c.title).join("، ") || "لسه"}`,
    `- المهارات: ${p.skills || "—"}`,
  ].join("\n");
}
function addJob(j) {
  if (j.url && S.jobs.some((x) => x.url === j.url)) return false;
  S.jobs.unshift({ id: uid(), title: j.title || "Ausbildung", company: j.company || "", city: j.city || "", start: j.start || "", deadline: j.deadline || "",
    url: j.url || "", source: j.source || "", fit: +j.fit || 0, why: j.why || "", req: j.req || "", status: "new", added: today(), notes: "" });
  return true;
}
const berufSelect = () => `<label>المهنة</label><select id="beruf">${BERUFE.map((b) => `<option ${b.name === S.beruf ? "selected" : ""}>${b.name}</option>`).join("")}</select>
  <label>المدينة (اختياري)</label><input id="city" value="${esc(S.jobCity)}" placeholder="مثلاً: Hamburg — سيبها فاضية لكل ألمانيا" />`;
const readBeruf = () => { S.beruf = document.getElementById("beruf").value; S.jobCity = document.getElementById("city").value.trim(); save(); };

function jobSearchView() {
  $view.innerHTML = `
    <div class="card">
      <h2>🤖 Claude يدورلك في كل المصادر</h2>
      <ol class="tasks">
        <li>اختار المهنة والمدينة ودوس "افتح في Claude" (اتأكد إن <b>Web search</b> شغال في Claude).</li>
        <li>Claude بيدور في المواقع الرسمية وغير الرسمية ومواقع الشركات، ويرجعلك العروض ومدى مناسبتها لخبرتك.</li>
        <li>انسخ رده كله والصقه تحت، والعروض هتتحفظ في 📋 الفرص.</li>
      </ol>
      ${berufSelect()}
      ${handoffBtns("jobs")}
      <p class="muted">💡 كرر البحث كل أسبوع، والعروض المكررة مش هتتضاف تاني.</p>
    </div>
    <div class="card">
      <h3>📥 الصق رد Claude هنا</h3>
      <textarea id="reply" class="box-text"></textarea>
      <button class="btn ok" id="imp">📥 احفظ العروض</button>
    </div>`;
  bindAI({ jobs: () => { readBeruf(); return PROMPTS.jobs(ctxP(), profileSummary(), S.beruf, S.jobCity); } });
  on("#imp", () => {
    let list;
    try { list = parseJSONList(document.getElementById("reply").value); } catch { return alert("مش لاقي JSON في الرد. انسخ رد Claude كله."); }
    const n = list.filter(addJob).length;
    save(); alert(`اتضاف ${n} فرصة جديدة ✅ (افتح لينك كل واحدة واتأكد إنها لسه مفتوحة)`); location.hash = "#/jobs/all";
  });
}

function sourcesView() {
  const groups = [...new Set(JOB_SOURCES.map((x) => x.group))];
  const q = S.beruf.replace(/\/-?\w+/g, "").replace(/\s+/g, " ").trim();
  $view.innerHTML = `
    <div class="card">
      <h2>🔎 دوّر بنفسك في كل المواقع</h2>
      <p class="muted">اللينكات دي بتفتح البحث جاهز على المهنة والمدينة اللي اخترتهم. لقيت فرصة؟ انسخ لينكها وضيفها من <a href="#/jobs/add">➕ ضيف فرصة</a>.</p>
      ${berufSelect()}
      <button class="btn alt" id="upd">🔄 حدّث اللينكات</button>
    </div>
    ${groups.map((gname) => `<div class="card"><h3>${gname}</h3><ul class="tasks">${JOB_SOURCES.filter((x) => x.group === gname).map((x) =>
      `<li><a href="${esc(x.url(q, S.jobCity))}" target="_blank" rel="noopener">${esc(x.name)}</a>${x.note ? ` <span class="muted">— ${esc(x.note)}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}
    <div class="card"><p class="muted">⚠️ عمر ما شركة Ausbildung حقيقية بتطلب منك فلوس عشان تقبلك. أي "مكتب" أو "سمسار" يطلب فلوس مقابل عقد = نصب.</p></div>`;
  on("#upd", () => { readBeruf(); render(); });
}

function jobsView(status) {
  const list = S.jobs.filter((j) => !status || j.status === status).sort((a, b) => (b.fit || 0) - (a.fit || 0));
  $view.innerHTML = `
    <div class="card">
      <h2>${status ? JOB_STATUS[status].t : "📋 كل الفرص"} <small class="muted">(${list.length})</small></h2>
      ${list.length ? "" : `<p class="muted">مفيش فرص هنا لسه.</p><a class="btn" href="#/jobs/search">🤖 Claude يدورلي</a><a class="btn alt" href="#/jobs/sources">🔎 دوّر بنفسك</a>`}
    </div>
    ${list.map((j) => `<div class="card">
      <h3><a href="#/jobs/${j.id}">${esc(j.title)}</a></h3>
      <p class="muted">🏢 ${esc(j.company)} · 📍 ${esc(j.city)}${j.start ? ` · 🗓️ ${esc(j.start)}` : ""}${j.deadline ? ` · ⏰ آخر ميعاد ${esc(j.deadline)}` : ""}</p>
      ${j.fit ? `<p><b>مناسبة ليك: ${j.fit}/10</b> ${j.why ? `<span class="muted">— ${esc(j.why)}</span>` : ""}</p>` : ""}
      <span class="pill" style="background:${JOB_STATUS[j.status].c}">${JOB_STATUS[j.status].t}</span>
      ${j.url ? `<a class="btn alt" href="${esc(j.url)}" target="_blank" rel="noopener">🔗 العرض</a>` : ""}
      <a class="btn alt" href="#/jobs/${j.id}">✏️ تفاصيل وتقديم</a>
    </div>`).join("")}`;
}

function jobAddView() {
  $view.innerHTML = `
    <div class="card">
      <h2>➕ ضيف فرصة لقيتها</h2>
      <label>اللينك</label><input id="u" dir="ltr" placeholder="https://..." />
      <label>المسمى</label><input id="t" dir="ltr" placeholder="Ausbildung Fachkraft für Lagerlogistik" />
      <div class="row"><div><label>الشركة</label><input id="co" dir="ltr" /></div><div><label>المدينة</label><input id="ci" dir="ltr" /></div></div>
      <div class="row"><div><label>البداية</label><input id="st" dir="ltr" placeholder="08/2027" /></div><div><label>آخر ميعاد للتقديم</label><input id="dl" type="date" /></div></div>
      <button class="btn ok" id="add">➕ ضيف</button>
    </div>`;
  on("#add", () => {
    const v = (i) => document.getElementById(i).value.trim();
    if (!v("u") && !v("t")) return alert("حط اللينك أو المسمى");
    if (!addJob({ url: v("u"), title: v("t"), company: v("co"), city: v("ci"), start: v("st"), deadline: v("dl"), source: v("u") ? platformOf(v("u")) : "" })) return alert("الفرصة دي موجودة قبل كده");
    save(); location.hash = `#/jobs/${S.jobs[0].id}`;
  });
}

function jobView(id) {
  const j = S.jobs.find((x) => x.id === id);
  $view.innerHTML = `
    <div class="card">
      <h2>💼 ${esc(j.title)}</h2>
      <p class="muted">🏢 ${esc(j.company)} · 📍 ${esc(j.city)} ${j.source ? `· المصدر: ${esc(j.source)}` : ""} · اتضافت ${j.added}</p>
      ${j.why ? `<p>💡 ${esc(j.why)}</p>` : ""}${j.req ? `<p class="muted">📋 ${esc(j.req)}</p>` : ""}
      ${j.url ? `<a class="btn acc" href="${esc(j.url)}" target="_blank" rel="noopener">🔗 افتح العرض</a>` : ""}
      <label>الحالة</label>
      <div class="modes">${Object.entries(JOB_STATUS).map(([k, v]) => `<button data-js="${k}" class="${j.status === k ? "on" : ""}">${v.t}</button>`).join("")}</div>
      <label>ملاحظات (مين كلمك، اتبعت إيه، ميعاد المقابلة...)</label>
      <textarea id="notes" class="box-text" style="min-height:80px">${esc(j.notes)}</textarea>
      <button class="btn ok" id="saveJ">💾 حفظ</button><button class="btn bad" id="del">🗑️ امسح</button>
    </div>
    <div class="card">
      <h3>✉️ قدّم على الفرصة دي</h3>
      <ol class="tasks">
        <li>Claude يكتبلك Anschreiben مخصوص للشركة دي من بروفايلك: ${handoffBtns("ansch")}</li>
        <li>نزّل الـ Lebenslauf من <a href="#/profile/cv">📄 السي في</a> (اطبعه PDF).</li>
        <li>ارفق شهاداتك من <a href="#/profile/certs">🏅 شهاداتي</a>، وبعد ما تبعت غيّر الحالة لـ "📤 قدمت".</li>
      </ol>
    </div>`;
  bindAI({ ansch: () => PROMPTS.anschreiben(ctxP(), j, profileSummary()) });
  $view.querySelectorAll("[data-js]").forEach((b) => b.onclick = () => {
    const old = j.status; j.status = b.dataset.js; j.notes = document.getElementById("notes").value;
    if (old !== j.status && j.status === "sent") { addXP(25); achieve(`قدمت على ${j.title} — ${j.company}`); }
    if (old !== j.status && j.status === "interview") achieve(`اتعزمت على مقابلة: ${j.title} — ${j.company}`);
    if (old !== j.status && j.status === "offer") achieve(`🎉 عرض Ausbildung من ${j.company}`);
    save(); render();
  });
  on("#saveJ", () => { j.notes = document.getElementById("notes").value; save(); alert("اتحفظ ✅"); });
  on("#del", () => { if (confirm("تمسح الفرصة دي؟")) { S.jobs = S.jobs.filter((x) => x.id !== id); save(); location.hash = "#/jobs/all"; } });
}

// ---------- البروفايل ----------
const LIST_FIELDS = {
  exp: { t: "💼 الخبرة (Berufserfahrung)", f: [["from", "من MM/JJJJ"], ["to", "لـ MM/JJJJ أو heute"], ["title", "المسمى (بالألماني لو تعرف)"], ["company", "الشركة"], ["city", "المدينة"], ["tasks", "المهام (افصل بـ ;)"]] },
  edu: { t: "🎓 التعليم (Schulbildung / Studium)", f: [["from", "من"], ["to", "لـ"], ["title", "الشهادة"], ["school", "المدرسة/الجامعة"], ["city", "المدينة"]] },
  langs: { t: "🗣️ اللغات (Sprachkenntnisse)", f: [["lang", "اللغة"], ["level", "المستوى"]] },
};
function profileDataView() {
  const p = S.profile;
  const listHTML = (key) => `<div class="card"><h3>${LIST_FIELDS[key].t}</h3>
    ${p[key].map((row, i) => `<div class="card" style="background:var(--bg)">${LIST_FIELDS[key].f.map(([f, ph]) =>
      `<input data-l="${key}" data-i="${i}" data-f="${f}" value="${esc(row[f])}" placeholder="${ph}" dir="auto" />`).join("")}
      <button class="btn bad" data-rm="${key}" data-i="${i}">🗑️</button></div>`).join("")}
    <button class="btn alt" data-addrow="${key}">➕ ضيف</button></div>`;
  $view.innerHTML = `
    <div class="card">
      <h2>🪪 بياناتي</h2>
      <p class="muted">عندك سي في قديم؟ أسهل: <a href="#/profile/import">📥 استورده مع Claude</a> وهو يملا كل ده بالألماني.</p>
      <div style="display:flex;gap:12px;align-items:center"><img id="ph" style="width:80px;height:100px;object-fit:cover;border-radius:8px;background:var(--line)" alt="" />
        <label class="btn alt">📷 صورة السي في<input id="photo" type="file" accept="image/*" hidden /></label></div>
      <div class="row"><div><label>الاسم</label><input id="name" dir="ltr" value="${esc(p.name)}" /></div><div><label>تاريخ الميلاد</label><input id="birth" dir="ltr" value="${esc(p.birth)}" placeholder="TT.MM.JJJJ" /></div></div>
      <div class="row"><div><label>مكان الميلاد</label><input id="birthplace" dir="ltr" value="${esc(p.birthplace)}" /></div><div><label>الجنسية</label><input id="nationality" dir="ltr" value="${esc(p.nationality)}" /></div></div>
      <label>العنوان</label><input id="address" dir="ltr" value="${esc(p.address)}" />
      <div class="row"><div><label>الموبايل</label><input id="phone" dir="ltr" value="${esc(p.phone)}" /></div><div><label>الإيميل</label><input id="email" dir="ltr" value="${esc(p.email)}" /></div></div>
      <label>المهارات والبرامج (EDV-Kenntnisse)</label><input id="skills" dir="ltr" value="${esc(p.skills)}" placeholder="MS Excel, SAP, WMS, Staplerschein..." />
      <label>الهوايات</label><input id="hobbies" dir="ltr" value="${esc(p.hobbies)}" />
    </div>
    ${listHTML("exp")}${listHTML("edu")}${listHTML("langs")}
    <button class="btn ok" id="saveP">💾 حفظ البروفايل</button>`;
  if (p.photo) getFile(p.photo).then((f) => { if (f) document.getElementById("ph").src = URL.createObjectURL(f.blob); });
  const collect = () => {
    for (const k of ["name", "birth", "birthplace", "nationality", "address", "phone", "email", "skills", "hobbies"]) p[k] = document.getElementById(k).value.trim();
    $view.querySelectorAll("[data-l]").forEach((el) => { p[el.dataset.l][+el.dataset.i][el.dataset.f] = el.value.trim(); });
  };
  const oldLangs = JSON.stringify(p.langs);
  $view.querySelectorAll("[data-addrow]").forEach((b) => b.onclick = () => { collect(); p[b.dataset.addrow].push({}); save(); render(); });
  $view.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { collect(); p[b.dataset.rm].splice(+b.dataset.i, 1); save(); render(); });
  document.getElementById("photo").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    collect(); p.photo = "photo"; await putFile(p.photo, f); save(); render();
  };
  on("#saveP", () => {
    collect();
    const de = p.langs.find((l) => /deutsch/i.test(l.lang || ""));
    if (de && JSON.stringify(p.langs) !== oldLangs) achieve(`مستوى اللغات اتحدث (Deutsch: ${de.level})`);
    else S.cvVersion++;
    save(); alert("اتحفظ ✅ السي في اتحدث"); location.hash = "#/profile/cv";
  });
}

function importCVView() {
  $view.innerHTML = `
    <div class="card">
      <h2>📥 استورد السي في القديم</h2>
      <ol class="tasks">
        <li>الصق نص السي في هنا (أو سيبها فاضية وارفع الملف نفسه في محادثة Claude).</li>
        <li>دوس "افتح في Claude": هيترجمه لـ Lebenslauf ألماني ويسألك عن الناقص.</li>
        <li>انسخ آخر رد فيه الـ JSON والصقه تحت.</li>
      </ol>
      <textarea id="raw" class="box-text" placeholder="الصق السي في هنا"></textarea>
      ${handoffBtns("imp")}
    </div>
    <div class="card">
      <h3>📥 الصق رد Claude</h3>
      <textarea id="reply" class="box-text"></textarea>
      <button class="btn ok" id="doImp">📥 املا البروفايل</button>
    </div>`;
  bindAI({ imp: () => PROMPTS.importCV(document.getElementById("raw").value.trim()) });
  on("#doImp", () => {
    const t = document.getElementById("reply").value;
    let data;
    try { data = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch { return alert("مش لاقي JSON في الرد. انسخ رد Claude كله."); }
    const p = S.profile;
    for (const k of Object.keys(p)) if (k !== "photo" && data[k] !== undefined && data[k] !== "") p[k] = data[k];
    achieve("عملت البروفايل من السي في القديم");
    save(); alert("تمام ✅ راجع بياناتك وصلّح أي حاجة"); location.hash = "#/profile/data";
  });
}

const CERT_KINDS = { course: "🎓 كورس", lang: "🗣️ لغة", edu: "🏫 دراسة", work: "💼 خبرة / شهادة شغل", other: "📎 تاني" };
function certsView() {
  $view.innerHTML = `
    <div class="card">
      <h2>🏅 ارفع شهادة</h2>
      <p class="muted">🔒 الملفات بتتحفظ على جهازك بس، مش بتترفع على النت. كل شهادة بتضيفها بتدخل السي في لوحدها.</p>
      <label>اسم الشهادة</label><input id="t" dir="auto" placeholder="Goethe-Zertifikat A2 / Supply Chain Logistics..." />
      <div class="row"><div><label>الجهة</label><input id="iss" dir="auto" placeholder="Goethe-Institut / Coursera..." /></div><div><label>التاريخ</label><input id="d" type="month" /></div></div>
      <div class="row"><div><label>النوع</label><select id="k">${Object.entries(CERT_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <div><label>من كورس عندك؟</label><select id="c"><option value="">—</option>${sorted().map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select></div></div>
      <label>الملف (PDF أو صورة)</label><input id="f" type="file" accept=".pdf,image/*" />
      <button class="btn ok" id="up">⬆️ ارفع</button>
    </div>
    <div class="card"><h3>شهاداتي (${S.certs.length})</h3>
      ${S.certs.length ? `<table class="words">${[...S.certs].reverse().map((c) => `<tr><td><b dir="auto">${esc(c.title)}</b><br><small class="muted">${CERT_KINDS[c.kind]} · ${esc(c.issuer)} · ${esc(c.date)}</small></td>
        <td style="white-space:nowrap">${c.fileId ? `<button class="icon-btn" data-open="${c.fileId}" title="افتح">👁️</button>` : ""}<button class="icon-btn" data-rmc="${c.id}" title="امسح">🗑️</button></td></tr>`).join("")}</table>` : `<p class="muted">لسه.</p>`}
    </div>`;
  document.getElementById("c").onchange = (e) => {
    const c = S.courses.find((x) => x.id === e.target.value); if (!c) return;
    document.getElementById("t").value = c.title; document.getElementById("iss").value = c.provider; document.getElementById("k").value = "course";
  };
  on("#up", async () => {
    const v = (i) => document.getElementById(i).value.trim();
    if (!v("t")) return alert("اكتب اسم الشهادة");
    const file = document.getElementById("f").files[0];
    const cert = { id: uid(), title: v("t"), issuer: v("iss"), date: v("d"), kind: v("k"), course: v("c"), fileId: "" };
    if (file) { cert.fileId = "cert-" + cert.id; await putFile(cert.fileId, file); }
    S.certs.push(cert);
    const c = S.courses.find((x) => x.id === cert.course);
    if (c && c.status !== "done") { c.status = "done"; c.progress = 100; c.doneAt = today(); }
    achieve(`شهادة جديدة: ${cert.title}${cert.issuer ? ` (${cert.issuer})` : ""}`); addXP(30);
    alert("🎉 اترفعت واتضافت للسي في"); render();
  });
  $view.querySelectorAll("[data-open]").forEach((b) => b.onclick = async () => {
    const f = await getFile(b.dataset.open); if (f) window.open(URL.createObjectURL(f.blob), "_blank");
  });
  $view.querySelectorAll("[data-rmc]").forEach((b) => b.onclick = async () => {
    const c = S.certs.find((x) => x.id === b.dataset.rmc);
    if (!confirm(`تمسح "${c.title}"؟`)) return;
    if (c.fileId) await delFile(c.fileId);
    S.certs = S.certs.filter((x) => x.id !== c.id); S.cvVersion++; save(); render();
  });
}

function winsView() {
  $view.innerHTML = `
    <div class="card">
      <h2>🏆 إنجازاتي</h2>
      <p class="muted">كل كورس تخلصه، شهادة ترفعها، خطوة Ausbildung، أو تقديم على شغل بيتسجل هنا لوحده ويطلّع نسخة جديدة من السي في. وتقدر تضيف إنجاز من شغلك كمان.</p>
      <input id="t" placeholder="مثلاً: بقيت مسئول عن جرد المخزن الشهري" />
      <button class="btn ok" id="add">➕ ضيف إنجاز</button>
    </div>
    <div class="card">${S.achievements.length ? `<table class="words">${[...S.achievements].reverse().map((a) => `<tr><td>${esc(a.t)}</td><td class="muted" style="white-space:nowrap">${a.date}</td></tr>`).join("")}</table>` : `<p class="muted">لسه.</p>`}</div>`;
  on("#add", () => { const t = document.getElementById("t").value.trim(); if (t) { achieve(t); addXP(10); render(); } });
}

// ---------- الـ Lebenslauf (بيتبني لوحده من البروفايل والكورسات والشهادات) ----------
// الجديد = الإنجازات اللي بعد آخر مرة حدثت فيها السي في مع Claude
const newsSinceSync = () => S.achievements.slice(S.cvSyncedCount || 0);
const mmYYYY = (d) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
function cvData() {
  const p = S.profile;
  const certTitles = new Set(S.certs.map((c) => c.title));
  const courses = sorted().filter((c) => c.status === "done" && !certTitles.has(c.title))
    .map((c) => ({ key: c.doneAt || "", date: mmYYYY(c.doneAt), t: c.cv || `${c.title} – ${c.provider}` }));
  const certs = S.certs.filter((c) => c.kind !== "edu")
    .map((c) => ({ key: c.date || "", date: mmYYYY(c.date), t: `${c.title}${c.issuer ? ` – ${c.issuer}` : ""}` }));
  return { p, weiter: [...certs, ...courses].sort((a, b) => b.key.localeCompare(a.key)) };
}
function cvText() {
  const { p, weiter } = cvData();
  const sec = (h, rows) => rows.length ? `\n${h}\n${rows.join("\n")}\n` : "";
  return `LEBENSLAUF — ${p.name}
Geburtsdatum: ${p.birth}${p.birthplace ? ` in ${p.birthplace}` : ""} | Staatsangehörigkeit: ${p.nationality}
${[p.address, p.phone, p.email].filter(Boolean).join(" | ")}
${sec("BERUFSERFAHRUNG", p.exp.map((e) => `${e.from} – ${e.to}  ${e.title}, ${e.company}${e.city ? `, ${e.city}` : ""}${e.tasks ? `\n   • ${e.tasks.split(";").map((x) => x.trim()).filter(Boolean).join("\n   • ")}` : ""}`))}${sec("SCHULBILDUNG / STUDIUM", p.edu.map((e) => `${e.from} – ${e.to}  ${e.title}, ${e.school}${e.city ? `, ${e.city}` : ""}`))}${sec("WEITERBILDUNGEN & ZERTIFIKATE", weiter.map((w) => `${w.date}  ${w.t}`))}${sec("SPRACHKENNTNISSE", p.langs.filter((l) => l.lang).map((l) => `${l.lang}: ${l.level}`))}${p.skills ? sec("EDV-KENNTNISSE", [p.skills]) : ""}${p.hobbies ? sec("INTERESSEN", [p.hobbies]) : ""}`;
}
function cvView() {
  const { p, weiter } = cvData();
  const news = newsSinceSync();
  const row = (d, body) => `<tr><td style="width:120px;vertical-align:top;color:#555;padding:4px 8px 4px 0">${esc(d)}</td><td style="padding:4px 0">${body}</td></tr>`;
  const sec = (h, rows) => rows.length ? `<h3 style="border-bottom:2px solid #0891b2;margin:16px 0 6px;color:#0891b2">${h}</h3><table style="width:100%;border-collapse:collapse">${rows.join("")}</table>` : "";
  $view.innerHTML = `
    <div class="card noprint">
      <h2>📄 Lebenslauf — نسخة ${S.cvVersion}</h2>
      <p class="muted">بيتحدث لوحده مع كل كورس تخلصه أو شهادة ترفعها أو بيانات تغيرها. المهنة المستهدفة: <b dir="ltr">${esc(S.beruf)}</b> (<a href="#/road/berufe">غيّرها</a>)</p>
      ${p.name ? "" : `<p>⚠️ البروفايل فاضي. ابدأ من <a href="#/profile/import">📥 استورد السي في القديم</a> أو <a href="#/profile/data">🪪 بياناتي</a>.</p>`}
      <button class="btn" id="print">🖨️ نزّله PDF</button><button class="btn alt" id="copy">📋 انسخه كنص</button>
    </div>
    <div class="card noprint" style="${news.length ? "outline:3px solid var(--accent)" : ""}">
      <h3>🤖 Claude يحدّث ويحسّن السي في ${news.length ? `(${news.length} إنجاز جديد)` : ""}</h3>
      ${news.length ? `<ul class="tasks">${news.map((n) => `<li>${esc(n.t)}</li>`).join("")}</ul>` : `<p class="muted">مفيش جديد من آخر تحديث مع Claude.</p>`}
      <p class="muted">Claude بياخد السي في الحالي والجديد، ويرجعلك نسخة محسّنة ونصايح. وبعدها دوس "اتحدث".</p>
      ${handoffBtns("upd")}<button class="btn ok" id="synced">✔️ اتحدث مع Claude</button>
      <p class="muted">✉️ Anschreiben لشركة معينة؟ من 💼 الوظايف افتح الفرصة ودوس "قدّم".</p>
    </div>
    <div class="card cv" dir="ltr" style="background:#fff;color:#111;font-family:Arial,sans-serif;text-align:left">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
        <div><h1 style="margin:0 0 4px;font-size:26px">${esc(p.name || "Ihr Name")}</h1><div style="color:#0891b2;font-weight:700">Bewerbung um einen Ausbildungsplatz als ${esc(S.beruf)}</div>
          <div style="margin-top:8px;font-size:14px;line-height:1.6">${[p.address, p.phone, p.email].filter(Boolean).map(esc).join("<br>")}</div></div>
        <img id="cvph" style="width:110px;height:140px;object-fit:cover;border-radius:4px;display:none" alt="" />
      </div>
      ${sec("Persönliche Daten", [row("Geburtsdatum", esc(`${p.birth}${p.birthplace ? ` in ${p.birthplace}` : ""}`)), row("Nationalität", esc(p.nationality))])}
      ${sec("Berufserfahrung", p.exp.map((e) => row(`${e.from || ""} – ${e.to || ""}`, `<b>${esc(e.title)}</b><br>${esc(e.company)}${e.city ? `, ${esc(e.city)}` : ""}${e.tasks ? `<ul style="margin:4px 0;padding-left:18px">${e.tasks.split(";").map((x) => x.trim()).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`)))}
      ${sec("Schulbildung / Studium", p.edu.map((e) => row(`${e.from || ""} – ${e.to || ""}`, `<b>${esc(e.title)}</b><br>${esc(e.school)}${e.city ? `, ${esc(e.city)}` : ""}`)))}
      ${sec("Weiterbildungen &amp; Zertifikate", weiter.map((w) => row(w.date, esc(w.t))))}
      ${sec("Sprachkenntnisse", p.langs.filter((l) => l.lang).map((l) => row(l.lang, esc(l.level))))}
      ${p.skills ? sec("EDV-Kenntnisse", [row("", esc(p.skills))]) : ""}
      ${p.hobbies ? sec("Interessen", [row("", esc(p.hobbies))]) : ""}
      <p style="margin-top:24px">${esc((p.address || "").split(",").pop().trim())}${p.address ? ", " : ""}${new Date().toLocaleDateString("de-DE")}</p>
    </div>`;
  if (p.photo) getFile(p.photo).then((f) => { if (f) { const im = document.getElementById("cvph"); im.src = URL.createObjectURL(f.blob); im.style.display = "block"; } });
  bindAI({ upd: () => PROMPTS.cvUpdate(ctxP(), cvText(), news.map((n) => n.t), S.beruf) });
  on("#print", () => window.print());
  on("#copy", () => { navigator.clipboard?.writeText(cvText()); alert("اتنسخ ✅"); });
  on("#synced", () => { S.cvSyncedCount = S.achievements.length; save(); render(); });
}

function interviewView() {
  $view.innerHTML = `
    <div class="card">
      <h2>🎤 تدريب مقابلة الـ Ausbildung</h2>
      <p class="muted">Claude بيعمل دور مدير التدريب في شركة لوجستيك ألمانية ويسألك بالألماني على قد مستواك ويصححلك. ابدأ من حوالي الأسبوع 20 (A2).</p>
      <p>المهنة: <b dir="ltr">${esc(S.beruf)}</b></p>
      ${handoffBtns("interview")}
    </div>`;
  bindAI({ interview: () => PROMPTS.interview(ctxP(), S.beruf) });
}

// ---------- الإعدادات ----------
function projectView() {
  $view.innerHTML = `
    <div class="card">
      <h2>🔗 ربط اشتراكك في Claude و ChatGPT</h2>
      <p class="muted">مرة واحدة بس: اعمل <b>Project</b> اسمه "Karriere 365" في Claude (وفي ChatGPT لو حابب) والصق التعليمات دي في Instructions. كده الكوتش هيفتكرك وبيعرف هدفك طول السنة.</p>
      <textarea readonly class="box-text">${esc(PROJECT_INSTRUCTIONS)}</textarea>
      <button class="btn" id="copyInst">📋 انسخ التعليمات</button>
      <a class="btn alt" href="https://claude.ai/projects" target="_blank" rel="noopener">Claude Projects</a>
      <a class="btn alt" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
    </div>`;
  on("#copyInst", () => { navigator.clipboard?.writeText(PROJECT_INSTRUCTIONS); alert("اتنسخت ✅"); });
}
function generalView() {
  $view.innerHTML = `
    <div class="card">
      <h2>📆 تاريخ البداية</h2>
      <p class="muted">خليه نفس تاريخ بداية Deutsch 365 عشان الخطتين يمشوا مع بعض. هدف السفر = البداية + 365 يوم.</p>
      <input id="start" type="date" value="${S.start}" />
      <button class="btn ok" id="saveS">حفظ</button>
    </div>`;
  on("#saveS", () => { S.start = document.getElementById("start").value || S.start; save(); alert(`اتحفظ ✅ هدف السفر: ${fmt(targetDate())}`); render(); });
}
function backupView() {
  $view.innerHTML = `
    <div class="card">
      <h2>💾 نسخة احتياطية</h2>
      <p class="muted">كورساتك وبروفايلك وشهاداتك محفوظين في المتصفح ده بس (مش بيترفعوا على أي سيرفر). خد نسخة كل أسبوع، وبيها تنقل من الكمبيوتر للموبايل.</p>
      <button class="btn" id="exp">⬇️ تنزيل نسخة</button>
      <label class="btn alt">⬆️ استرجاع نسخة<input id="imp" type="file" accept=".json" hidden /></label>
    </div>`;
  on("#exp", async () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...S, files: await exportFiles() })], { type: "application/json" }));
    a.download = `karriere365-${today()}.json`; a.click();
  });
  document.getElementById("imp").onchange = async (e) => {
    try { const { files, ...data } = JSON.parse(await e.target.files[0].text()); await importFiles(files); Object.assign(S, data); save(); alert("اترجعت ✅"); refreshStats(); render(); }
    catch { alert("الملف ده مش صالح"); }
  };
}

// ---------- التنقل: #/app/section ----------
let route = { app: null, section: null };
function parseRoute() {
  const [, app, section] = location.hash.replace(/^#/, "").split("/");
  return APPS[app] ? { app, section: section || APPS[app].defaultSection() } : { app: null, section: null };
}
function render() {
  route = parseRoute();
  const app = APPS[route.app];
  document.body.classList.toggle("in-app", !!app);
  document.body.classList.remove("side-open");
  document.getElementById("title").innerHTML = app ? appTitle(route.app) : `<img class="brand-logo" src="icon.svg" alt="" />Karriere 365`;
  if (!app) { $side.innerHTML = ""; homeView(); }
  else { app.view(route.section); cleanHeadings(); renderSide(app, route.section); }
  window.scrollTo(0, 0);
}
function on(sel, fn) { const el = $view.querySelector(sel); if (el) el.onclick = fn; }
document.getElementById("menu").innerHTML = icon("menu", 20);
document.getElementById("home").innerHTML = icon("home", 20);
document.getElementById("gear").innerHTML = icon("settings", 20);
document.getElementById("streakBox").insertAdjacentHTML("afterbegin", icon("flame", 16));
document.getElementById("xpBox").insertAdjacentHTML("afterbegin", icon("star", 16));
document.getElementById("home").onclick = () => { location.hash = "#/"; };
document.getElementById("menu").onclick = () => document.body.classList.toggle("side-open");
document.getElementById("scrim").onclick = () => document.body.classList.remove("side-open");
window.addEventListener("hashchange", render);

if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
refreshStats();
render();
