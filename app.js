import { PHASES, SUGGESTED, BERUFE, LINKS, MILESTONES, WEEKDAY_PLAN } from "./catalog.js";
import { PROMPTS, PROJECT_INSTRUCTIONS, openIn, parseJSONList } from "./ai.js";

// ---------- الحالة (محفوظة على الجهاز) ----------
const KEY = "karriere365";
const today = () => new Date().toISOString().slice(0, 10);
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const S = Object.assign(
  { start: today(), courses: [], log: {}, milestones: {}, glossary: [], beruf: BERUFE[1].name, xp: 0, streak: 0, lastStudy: null },
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
    icon: "📅", name: "النهارده", color: "#f59e0b",
    badge: () => `${WEEKDAY_PLAN[new Date().getDay()].icon} ${WEEKDAY_PLAN[new Date().getDay()].name}`,
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
    icon: "📚", name: "كورساتي", color: "#0891b2",
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
    icon: "💡", name: "مقترحات", color: "#16a34a",
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
  cv: {
    icon: "📄", name: "السي في", color: "#7c3aed",
    badge: () => `${S.courses.filter((c) => c.status === "done").length} شهادة`,
    defaultSection: () => "cv",
    side: () => [
      { head: "Lebenslauf و Anschreiben" },
      { id: "cv", label: "📄 الكورسات في السي في" },
      { id: "interview", label: "🎤 تدريب المقابلة" },
    ],
    view: (s) => s === "interview" ? interviewView() : cvView(),
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
function homeView() {
  const p = phaseOf(weekNum());
  const c = current();
  $view.innerHTML = `
    <div class="hero">
      <div><span class="pill" style="background:${p.color}">${esc(p.name)}</span> اليوم <b>${dayNum()}</b> من 365 · الأسبوع ${weekNum()}</div>
      <div class="bar"><i style="width:${(dayNum() / 365) * 100}%"></i></div>
      <div class="muted">🛫 هدف السفر: ${fmt(targetDate())} (فاضل ${daysBetween(today(), targetDate())} يوم)</div>
      <div class="muted">${c ? `📘 الكورس الحالي: ${esc(c.title)} (${c.progress}%)` : `👋 ابدأ من <a href="#/courses/add">➕ ضيف لينكات كورساتك</a>`}</div>
    </div>
    <div class="apps">${Object.entries(APPS).map(([id, a]) => `
      <a class="app" href="#/${id}">
        <span class="app-icon" style="background:${a.color}">${a.icon}</span>
        <span class="app-name">${a.name}</span>
        ${a.badge() ? `<span class="app-badge">${esc(a.badge())}</span>` : ""}
      </a>`).join("")}
    </div>`;
}

function renderSide(app, section) {
  $side.innerHTML = `<div class="side-title">${app.icon} ${app.name}</div>` + app.side().map((it) => it.head
    ? `<div class="side-head">${esc(it.head)}</div>`
    : `<a class="side-item ${it.id === section ? "on" : ""}" href="#/${route.app}/${it.id}">
        ${it.color ? `<i class="dot" style="background:${it.color}"></i>` : ""}<span>${esc(it.label)}</span>${it.mark ? `<small>${esc(it.mark)}</small>` : ""}</a>`).join("");
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
    alert(c.status === "done" ? `🎉 مبروك! خلصت "${c.title}". ضيفه في السي في من 📄` : "عاش! ✅ +20 ⭐");
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
    save(); alert("اتحفظ ✅"); render();
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
    if (b.checked) { S.milestones[b.dataset.m] = today(); addXP(30); } else delete S.milestones[b.dataset.m];
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

// ---------- السي في ----------
function cvView() {
  const done = sorted().filter((c) => c.status === "done");
  const lines = done.map((c) => c.cv || `${c.title} – ${c.provider}`);
  const text = lines.length ? `Weiterbildungen\n${lines.map((l) => `• ${l}`).join("\n")}` : "";
  $view.innerHTML = `
    <div class="card">
      <h2>📄 قسم Weiterbildungen في السي في</h2>
      <p class="muted">أي كورس تخلصه بيظهر هنا تلقائي بالصيغة اللي تتحط في Lebenslauf. المهنة المستهدفة: <b dir="ltr">${esc(S.beruf)}</b> (<a href="#/road/berufe">غيّرها</a>)</p>
      ${text ? `<textarea readonly class="box-text" dir="ltr">${esc(text)}</textarea><button class="btn" id="copy">📋 انسخ</button>` : `<p class="muted">لسه مخلصتش كورسات. أول ما تخلص واحد هيظهر هنا.</p>`}
    </div>
    <div class="card">
      <h3>🤖 اكتب Lebenslauf و Anschreiben مع Claude</h3>
      <p class="muted">Claude هيسألك عن خبرتك وبعدين يكتبلك النسختين بالألماني بالشكل اللي الشركات الألمانية متعودة عليه.</p>
      ${handoffBtns("cv")}
    </div>`;
  bindAI({ cv: () => PROMPTS.cv(ctxP(), lines, S.beruf) });
  on("#copy", () => { navigator.clipboard?.writeText(text); alert("اتنسخ ✅"); });
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
      <p class="muted">كورساتك وملاحظاتك محفوظة في المتصفح ده بس. خد نسخة كل أسبوع، وبيها تنقل من الكمبيوتر للموبايل.</p>
      <button class="btn" id="exp">⬇️ تنزيل نسخة</button>
      <label class="btn alt">⬆️ استرجاع نسخة<input id="imp" type="file" accept=".json" hidden /></label>
    </div>`;
  on("#exp", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" }));
    a.download = `karriere365-${today()}.json`; a.click();
  });
  document.getElementById("imp").onchange = async (e) => {
    try { Object.assign(S, JSON.parse(await e.target.files[0].text())); save(); alert("اترجعت ✅"); refreshStats(); render(); }
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
  document.getElementById("title").textContent = app ? `${app.icon} ${app.name}` : "🚚 Karriere 365";
  if (!app) { $side.innerHTML = ""; homeView(); }
  else { app.view(route.section); renderSide(app, route.section); }
  window.scrollTo(0, 0);
}
function on(sel, fn) { const el = $view.querySelector(sel); if (el) el.onclick = fn; }
document.getElementById("home").onclick = () => { location.hash = "#/"; };
document.getElementById("menu").onclick = () => document.body.classList.toggle("side-open");
document.getElementById("scrim").onclick = () => document.body.classList.remove("side-open");
window.addEventListener("hashchange", render);

if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
refreshStats();
render();
