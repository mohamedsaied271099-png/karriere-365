// الـ Agent: برومبتات بتتفتح في Claude أو ChatGPT على اشتراكك (من غير API)

export const PROJECT_INSTRUCTIONS = `إنت "كوتش كارير"، مدرب مصري متخصص في اللوجستيك وسلاسل الإمداد وفي التقديم على Ausbildung في ألمانيا.
طالبك مصري شغال في مجال اللوجستيك، بيذاكر ساعة في اليوم، وبيتعلم ألماني (هدفه B1/B2)، وهدفه يسافر ألمانيا بـ Ausbildung في اللوجستيك بعد سنة.
- اتكلم بالعامية المصرية وخلي الردود قصيرة وعملية، والمصطلحات بالإنجليزي وجنبها الألماني (مثال: Goods receipt = der Wareneingang).
- اربط أي شرح بشغله الحقيقي في مصر وبالشغل في شركة لوجستيك ألمانية.
- لما يطلب امتحان: سؤال واحد كل مرة، استنى إجابته، صحح، وقيّم من 10.
- لما يطلب JSON: رد بالـ JSON بس جوه code block من غير أي كلام قبله أو بعده.
- افتكر نقط ضعفه وارجعله بيها.`;

export function openIn(app, text) {
  navigator.clipboard?.writeText(text).catch(() => {});
  const q = encodeURIComponent(text);
  window.open(app === "claude" ? `https://claude.ai/new?q=${q}` : `https://chatgpt.com/?q=${q}`, "_blank", "noopener");
}

// بيطلع أول JSON array من رد Claude حتى لو جوه ```json
export function parseJSONList(text) {
  const s = text.indexOf("["), e = text.lastIndexOf("]");
  if (s < 0 || e < s) throw new Error("no json");
  const list = JSON.parse(text.slice(s, e + 1));
  if (!Array.isArray(list)) throw new Error("not a list");
  return list;
}

const ctx = (P) => `[سياق: أنا في الأسبوع ${P.week} من 52 في خطتي، مرحلة "${P.phase}". هدفي Ausbildung لوجستيك في ألمانيا.]`;

export const PROMPTS = {
  organize: (raw) => `${PROJECT_INSTRUCTIONS}

---
دي كل الكورسات اللي معايا ولينكاتها (ممكن تكون متلخبطة):

${raw || "(الصق اللينكات والأسماء هنا)"}

المطلوب:
1. نضّفها: شيل المكرر، واعرف اسم كل كورس والمنصة من اللينك.
2. رتبها بالترتيب اللي أذاكرها بيه من الصفر (الأساسيات الأول)، وقولي أي كورس ملوش لازمة لهدفي (Ausbildung لوجستيك في ألمانيا) ونحطه في الآخر.
3. قدّر عدد الساعات لكل كورس.
4. اكتبلي في سطرين سبب ترتيبك، وبعدين JSON array بالشكل ده بالظبط:
[{"title":"...","provider":"...","url":"...","hours":10,"category":"سلاسل إمداد|مخازن|شحن وجمارك|أدوات وبرامج|إدارة|لغة|تاني","keep":true,"why":"سبب قصير"}]`,

  explain: (P, c) => `${PROJECT_INSTRUCTIONS}

---
${ctx(P)}
بذاكر كورس "${c.title}" (${c.provider || ""}) ${c.url ? `— ${c.url}` : ""}.
الدرس اللي وصلتله: ${c.where || "(هكتبلك اسم الدرس)"}.
اشرحلي الفكرة الأساسية بمثال من مخزن أو شركة شحن، واديني المصطلحات المهمة بالإنجليزي والألماني.`,

  quiz: (P, c, notes) => `${PROJECT_INSTRUCTIONS}

---
${ctx(P)}
امتحني في كورس "${c.title}". دي ملاحظاتي اللي كتبتها:
${notes.length ? notes.map((n) => `- ${n}`).join("\n") : "(لسه مكتبتش ملاحظات — اسألني في أساسيات الكورس)"}

اسألني 5 أسئلة واحد واحد (اختيار من متعدد + سؤال موقف عملي)، وفي الآخر قولي نقط ضعفي.`,

  glossary: (P, known) => `${PROJECT_INSTRUCTIONS}

---
${ctx(P)}
اديني 15 مصطلح لوجستيك بالألماني على مستوى A2/B1 بيتقالوا فعلاً في شغل المخازن والشحن في ألمانيا${known.length ? `، غير دول: ${known.slice(-60).join(", ")}` : ""}.
رد بـ JSON بس:
[{"de":"der Wareneingang","ar":"استلام البضاعة","ex":"Der Wareneingang ist um 7 Uhr.","tip":"حيلة حفظ قصيرة بالعامية"}]
الأسماء لازم يكون قبلها der/die/das.`,

  interview: (P, beruf) => `${PROJECT_INSTRUCTIONS}

---
${ctx(P)}
اعمل دور مدير التدريب (Ausbilder) في شركة لوجستيك ألمانية، وأنا متقدم لـ Ausbildung "${beruf}".
اعمل معايا مقابلة بالألماني على قد مستواي: سؤال واحد كل مرة، وبعد كل رد مني سطر "💡" فيه تصحيح غلطاتي بالعربي وإجابة أحسن.
ابدأ بـ "Erzählen Sie etwas über sich."`,

  cv: (P, done, beruf) => `${PROJECT_INSTRUCTIONS}

---
${ctx(P)}
ساعدني أعمل Lebenslauf بالألماني (الشكل الألماني: جدول، تواريخ بالشكل MM/JJJJ، من الأحدث للأقدم) و Anschreiben لـ Ausbildung "${beruf}".
الكورسات اللي خلصتها (حطها في قسم Weiterbildungen):
${done.length ? done.map((d) => `- ${d}`).join("\n") : "- (لسه)"}

اسألني الأول عن: خبرتي في الشغل (الشركة، المسمى، المهام بالظبط)، تعليمي، ومستوى الألماني والإنجليزي. وبعدين اكتب النسختين.`,

  weekly: (P, summary) => `${PROJECT_INSTRUCTIONS}

---
${ctx(P)}
ده ملخص أسبوعي:
${summary}

قيّم الأسبوع بصراحة، وقولي أعدّل إيه في الأسبوع الجاي، وفكرني بخطوة الـ Ausbildung الجاية.`,
};
