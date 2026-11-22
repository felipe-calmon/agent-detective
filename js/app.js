(function () {
  "use strict";
  var AD = window.AgentDetective;
  var app = document.getElementById("app");
  var state = { caseFile: null, original: null, prevVerdict: null, qFilter: "open" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function store(k, v) { try { localStorage.setItem("ad:" + k, v); } catch (e) { } }
  function load(k) { try { return localStorage.getItem("ad:" + k); } catch (e) { return null; } }
  function setNav(which) { document.querySelectorAll(".topnav a").forEach(function (a) { if (a.dataset.nav === which) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }
  function ref(n) { return n ? ' <button class="ref" data-ref="' + n + '" title="Show in timeline">step ' + n + "</button>" : ""; }

  // ---------------- Home ----------------
  function renderHome() {
    setNav("home");
    state.caseFile = null;
    var cards = window.AD_CASES.map(function (c) {
      return '<button class="casecard" data-case="' + c.id + '"><span class="no">Case ' + esc(c.number) + '</span><h3>' + esc(c.title) + "</h3><p>" + esc(c.teaser) + '</p><span class="basis">' + esc(c.basis) + "</span></button>";
    }).join("");
    app.innerHTML =
      '<section class="hero"><div><div class="eyebrow">The casebook</div><h1>Reason backwards from the damage to the missing clause.</h1>' +
      '<p class="lede">Open a case file from an AI agent\'s log. Agent Detective rebuilds the story of the incident, puts rival explanations on trial, lists the questions the evidence still cannot answer, and finds the spec clause that would have stopped it. Then rewrite the spec and see whether the verdict holds.</p></div>' +
      '<blockquote>“There are few people who, if you told them a result, would be able to evolve from their own inner consciousness what the steps were which led up to that result. This power is what I mean when I talk of reasoning backwards.”<cite>Sherlock Holmes, <i>A Study in Scarlet</i> (1887)</cite></blockquote></section>' +
      '<div class="section-title"><span class="roman">§</span><h2>Open a case file</h2></div>' +
      '<div class="cases">' + cards + '<button class="casecard byo" data-nav="byo"><span class="no">Your case</span><h3>Bring your own log</h3><p>Paste or upload an agent log as JSON. It is analysed here, in your browser, and sent nowhere.</p><span class="basis">A template is provided.</span></button></div>';
  }

  // ---------------- Case ----------------
  function openCase(c, keepSpec) {
    state.original = clone(c);
    state.caseFile = clone(c);
    var saved = keepSpec ? null : load("spec:" + c.id);
    if (saved) state.caseFile.spec = saved;
    state.prevVerdict = null;
    renderCase(true);
    window.scrollTo(0, 0);
  }

  function contrib(r) { var h = r.hypotheses[1]; return r.verdict.kind === "incident" && h && h.net > 0 ? h : null; }
  function verdictKey(r) { var k = contrib(r); return r.verdict.kind + ":" + (r.verdict.cause || "") + ":" + (k ? k.id : "") + ":" + (r.replay.blocked ? r.replay.step.n : ""); }
  function verdictLabel(r) {
    if (r.verdict.kind === "prevented") return "prevented at step " + r.replay.step.n;
    if (r.verdict.kind === "none") return "no decisive act";
    var k = contrib(r); return r.verdict.headline + (k ? ", with " + k.cause.toLowerCase() : "");
  }

  function renderCase(first) {
    setNav("");
    var c = state.caseFile, r = AD.analyse(c);
    var o = AD.analyse(state.original);
    var html = '<button class="back" data-nav="home">← Back to the casebook</button>';
    html += '<section class="casehead"><div><div class="eyebrow">Case ' + esc(c.number || "") + "</div><h1>" + esc(c.title || "Untitled case") + "</h1>" +
      (c.basis ? '<p class="muted"><i>' + esc(c.basis) + "</i></p>" : "") +
      (c.sources && c.sources.length ? '<p class="small">Sources: ' + c.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a>"; }).join(" · ") + "</p>" : "") + "</div>" +
      '<dl class="facts"><dt>Agent</dt><dd>' + esc(c.agent || "—") + "</dd><dt>Task</dt><dd>" + esc(c.task && c.task.description || "—") + "</dd><dt>Scope</dt><dd>" + esc(c.task && c.task.env || "—") + "</dd>" +
      (c.grants || []).map(function (g) { return "<dt>Credential</dt><dd><code>" + esc(g.name) + "</code>, " + esc(g.scope) + " (" + esc(g.origin === "found" ? "found by the agent" : "provided") + ")</dd>"; }).join("") +
      '</dl></section>';

    html += '<div id="verdict">' + verdictHtml(r, o) + "</div>";
    html += '<div class="cols"><section aria-labelledby="t-crime"><div class="section-title"><span class="roman">I.</span><h2 id="t-crime">The story of the crime</h2></div>' +
      '<p class="section-note">What happened, in the order it happened. The decisive act is marked in red.</p><div id="timeline">' + timelineHtml(r, c) + "</div></section>" +
      '<section aria-labelledby="t-inv"><div class="section-title"><span class="roman">II.</span><h2 id="t-inv">The story of the investigation</h2></div>' +
      '<p class="section-note">The incident read as a story scheme: each slot should be filled by evidence. Empty slots are where doubt lives.</p>' +
      '<div id="scheme">' + schemeHtml(r) + '</div><h3>Suspects: four accounts of the cause</h3><p class="section-note">Hypotheses by abduction, each weighed against the evidence for and against it.</p><div id="hyps">' + hypsHtml(r) + "</div>" +
      '<h3>Critical questions</h3><p class="section-note">Questions the story must survive. Open ones mark what the log cannot yet tell us.</p>' +
      '<div class="qfilter" role="group" aria-label="Filter questions"><button class="btn small" data-q="open">Still open</button><button class="btn small" data-q="all">All</button></div><div id="qs">' + qsHtml(r) + "</div></section></div>";

    html += '<section aria-labelledby="t-spec" style="margin-top:40px"><div class="section-title"><span class="roman">III.</span><h2 id="t-spec">The spec on trial</h2></div>' +
      '<p class="section-note">Edit the spec as you would a Spec Kit constitution. Mark a clause <code>[enforced]</code> when a tool, hook or policy checks it; without the tag it is advice the agent may ignore. The verdict updates as you type.</p>' +
      '<div class="specgrid"><div><label class="sr" for="speced">Spec</label><textarea id="speced" class="speced" spellcheck="false">' + esc(c.spec || "") + '</textarea>' +
      '<div class="toolbar" style="margin-top:8px"><button class="btn small" data-act="reset">Reset spec</button><button class="btn small" data-act="download">Download case as JSON</button></div>' +
      '<h3 style="margin-top:18px">How the detective reads your spec</h3><div id="clauses">' + clausesHtml(r) + "</div></div>" +
      '<div><h3>Clauses that would have stopped it</h3><p class="section-note">Each one, enforced on its own, ends the story before the decisive act. Ordered by the leading hypotheses.</p><div id="sugg">' + suggHtml(r) + "</div>" +
      '<div class="lesson"><b>Try this.</b> Add a suggestion as <i>advisory</i>: the incident still happens, and the new rule only becomes evidence for “The Rule That Was Only Words”. Add the same clause as <i>enforced</i> and the case closes before it opens. Or delete the safety rule and watch the spec gap take its place. A rule in a prompt is testimony; a rule in a gate is evidence.</div></div></div></section>';

    app.innerHTML = html;
    state.prevVerdict = verdictKey(r);
    applyQFilter();
  }

  function refresh() {
    var c = state.caseFile, r = AD.analyse(c), o = AD.analyse(state.original);
    var key = verdictKey(r), changed = state.prevVerdict && key !== state.prevVerdict;
    document.getElementById("verdict").innerHTML = verdictHtml(r, o);
    document.getElementById("timeline").innerHTML = timelineHtml(r, c);
    document.getElementById("scheme").innerHTML = schemeHtml(r);
    document.getElementById("hyps").innerHTML = hypsHtml(r);
    document.getElementById("qs").innerHTML = qsHtml(r);
    document.getElementById("clauses").innerHTML = clausesHtml(r);
    document.getElementById("sugg").innerHTML = suggHtml(r);
    applyQFilter();
    if (changed) { var v = document.querySelector(".verdict"); if (v) { v.classList.remove("flash"); void v.offsetWidth; v.classList.add("flash"); } }
    state.prevVerdict = key;
  }

  function verdictHtml(r, o) {
    var v = r.verdict, prevented = v.kind === "prevented";
    var stamp = prevented ? "Prevented<small>by the current spec</small>" : v.kind === "none" ? "Insufficient<small>evidence</small>" : "Cause found<small>" + esc(v.headline) + "</small>";
    var diff = "";
    if (verdictKey(r) !== verdictKey(o)) {
      diff = '<div class="change" role="status">Verdict changed from the original spec: “' + esc(verdictLabel(o)) + "” → “" + esc(verdictLabel(r)) + "”.</div>";
    }
    return '<section class="verdict ' + (prevented ? "prevented" : "") + '" aria-live="polite"><div class="stamp">' + stamp + "</div><div>" +
      '<div class="eyebrow">The verdict</div><h2>' + esc(prevented ? v.headline : "The most plausible account: " + v.headline.toLowerCase()) + "</h2><p>" + esc(v.text) + (prevented ? ref(r.replay.step.n) : (r.fatal ? " Decisive act:" + ref(r.fatal.n) : "")) + "</p>" + diff + "</div></section>";
  }

  var TAGLABEL = { destructive: "destructive", egress: "data leaves", credential: "credential", untrusted: "untrusted source", injection: "hidden instruction", approval: "approval", verification: "check", selfreport: "testimony", production: "production" };
  function timelineHtml(r, c) {
    var cut = r.replay.blocked ? r.replay.step.n : null;
    var out = '<ol class="timeline">';
    r.evs.forEach(function (e) {
      var cls = "ev" + (r.fatal && e.n === r.fatal.n ? " fatal" : "") + (cut && e.n >= cut ? " after" : "");
      if (cut && e.n === cut) out += '<li class="cutline" aria-label="Counterfactual">Under the current spec the story stops here: ' + esc(r.replay.reason) + ". Everything below never happens.</li>";
      var tags = Object.keys(e.tagset).filter(function (t) { return TAGLABEL[t]; }).map(function (t) { return '<span class="tag ' + t + '">' + TAGLABEL[t] + "</span>"; }).join("");
      out += '<li class="' + cls + '" id="ev-' + e.n + '"><span class="dot">' + e.n + '</span><div class="meta"><span>' + esc(e.t || "") + '</span><span class="actor ' + esc(e.actor) + '">' + esc(e.actor) + "</span><span>" + esc(e.kind) + (e.source ? " · " + esc(e.source) : "") + "</span>" + tags + "</div>" +
        (e.text ? '<div class="body">' + esc(e.text) + "</div>" : "") + (e.command ? "<pre>$ " + esc(e.command) + "</pre>" : "") +
        (e.target ? '<div class="small muted">target: <code>' + esc(e.target.name) + "</code> in " + esc(e.target.env) + "</div>" : "") + "</li>";
    });
    out += "</ol>";
    if (c.outcome && !cut) out += '<div class="outcome"><b>Aftermath.</b> ' + esc(c.outcome.summary) + "</div>";
    return out;
  }

  function schemeHtml(r) {
    return '<div class="scheme">' + r.scheme.map(function (s) {
      return '<div class="slot ' + (s.filled ? "" : "empty") + '"><b>' + esc(s.slot) + '</b><span class="gloss">' + esc(s.gloss) + '</span><span class="val">' + (s.value ? esc(s.value) : "— no evidence —") + "</span>" + (s.ev ? ref(s.ev.n) : "") + "</div>";
    }).join("") + "</div>";
  }

  function hypsHtml(r) {
    if (!r.hypotheses.length) return '<p class="muted">No decisive act, no suspects.</p>';
    var max = Math.max.apply(null, r.hypotheses.map(function (h) { return Math.max(h.pro, h.con); }).concat([6]));
    return '<div class="hyps">' + r.hypotheses.map(function (h, i) {
      var items = h.for.map(function (x) { return '<li class="for"><span class="sign" aria-label="for">+</span><span>' + esc(x.text) + ref(x.ev) + "</span></li>"; })
        .concat(h.against.map(function (x) { return '<li class="against"><span class="sign" aria-label="against">−</span><span>' + esc(x.text) + ref(x.ev) + "</span></li>"; })).join("");
      return '<article class="hyp ' + (i === 0 && r.verdict.kind !== "prevented" && h.net > 0 ? "lead" : "") + '"><div class="hyp-head"><h3><span class="rank">' + (i + 1) + "</span>" + esc(h.title) + '</h3><span class="cause">' + esc(h.cause) + "</span></div>" +
        '<p class="claim">' + esc(h.claim) + "</p>" +
        '<div class="meter" role="img" aria-label="Evidence against ' + h.con + ', for ' + h.pro + '"><div class="con"><i style="width:' + (h.con / max * 100) + '%"></i></div><div class="pro"><i style="width:' + (h.pro / max * 100) + '%"></i></div></div>' +
        '<div class="meter-legend"><span>against ' + h.con + "</span><span>net " + (h.net > 0 ? "+" : "") + h.net + "</span><span>for " + h.pro + "</span></div>" +
        '<ul class="evlist">' + items + "</ul></article>";
    }).join("") + "</div>";
  }

  function qsHtml(r) {
    if (!r.questions.length) return "";
    return '<ul class="qs">' + r.questions.map(function (q) {
      return '<li class="q ' + q.status + '"><div class="qhead"><span class="slotname">' + esc(q.slot) + '</span><span class="status">' + (q.status === "open" ? "open" : "answered") + '</span></div><div class="qq">' + esc(q.q) + '</div><div class="ans">' + esc(q.answer) + ref(q.ev) + "</div></li>";
    }).join("") + "</ul>";
  }
  function applyQFilter() {
    document.querySelectorAll("[data-q]").forEach(function (b) { b.classList.toggle("primary", b.dataset.q === state.qFilter); b.setAttribute("aria-pressed", b.dataset.q === state.qFilter); });
    document.querySelectorAll(".q").forEach(function (li) { li.hidden = state.qFilter === "open" && !li.classList.contains("open"); });
  }

  function clausesHtml(r) {
    if (!r.clauses.length) return '<p class="muted small">The spec is empty. Every act is permitted, and nothing is checked.</p>';
    return '<ul class="clauses">' + r.clauses.map(function (cl) {
      var badges = cl.classes.length ? cl.classes.map(function (k) { return '<span class="badge cls">' + esc(AD.CLASSES[k].label) + "</span>"; }).join("") + (cl.enforced ? '<span class="badge enf">enforced</span>' : '<span class="badge adv">advisory</span>') : '<span class="badge none">no safety rule detected</span>';
      return '<li><span class="ctext">' + esc(cl.text) + "</span>" + badges + "</li>";
    }).join("") + "</ul>";
  }

  function suggHtml(r) {
    if (!r.suggestions.length) return '<p class="muted small">No single clause in the catalogue would have stopped this act.</p>';
    return '<div class="sugg">' + r.suggestions.map(function (s, i) {
      return '<div class="sug ' + (s.present ? "present" : "") + '"><h3 style="margin:0 0 4px">' + esc(s.label) + (i === 0 && !s.present ? ' <span class="badge enf">recommended</span>' : "") + (s.present ? ' <span class="badge enf">already in the spec</span>' : "") + "</h3>" +
        '<p class="why">Would block step ' + s.step + ": " + esc(s.reason) + '.</p><div class="ctext">' + esc(s.text) + "</div>" +
        (s.present ? "" : '<div class="acts"><button class="btn small primary" data-add="' + s.cls + '" data-mode="enforced">Add as enforced</button><button class="btn small" data-add="' + s.cls + '" data-mode="advisory">Add as advisory</button></div>') + "</div>";
    }).join("") + "</div>";
  }

  function addClause(cls, mode) {
    var c = state.caseFile, r = AD.analyse(c);
    var txt = AD.TEMPLATES[cls](c, r.fatal || {});
    if (mode === "advisory") txt = txt.replace(/\s*\[enforced[^\]]*\]/i, "");
    c.spec = (c.spec || "").replace(/\s*$/, "") + "\n- " + txt + "\n";
    var ed = document.getElementById("speced"); ed.value = c.spec;
    store("spec:" + c.id, c.spec);
    refresh();
    document.getElementById("verdict").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------- Bring your own ----------------
  var TEMPLATE = {
    title: "My incident", number: "BYO", agent: "describe the agent",
    task: { description: "What the agent was asked to do", env: "staging" },
    grants: [{ id: "cred1", name: "API_TOKEN", scope: "all environments", scope_level: "global", origin: "found", found_in: "config/old.env", purpose: "something else" }],
    allowlist: ["api.github.com"],
    spec: "# Constitution\n- The agent works only on staging.",
    outcome: { summary: "What the damage was." },
    events: [
      { t: "10:00:00", actor: "user", kind: "instruction", text: "Please fix X." },
      { t: "10:00:10", actor: "agent", kind: "plan", text: "Plan: inspect, fix, redeploy." },
      { t: "10:00:20", actor: "user", kind: "approval", text: "Approved.", covers: ["e2"] },
      { t: "10:01:00", actor: "agent", kind: "reasoning", text: "Why the agent thinks the act is right." },
      { t: "10:01:30", actor: "agent", kind: "command", uses: "cred1", fatal: true, target: { name: "db-main", env: "production" }, command: "dbctl drop database db-main" },
      { t: "10:01:31", actor: "tool", kind: "result", text: "dropped" }
    ]
  };

  function renderByo() {
    setNav("byo");
    var draft = load("byo") || JSON.stringify(TEMPLATE, null, 2);
    app.innerHTML = '<button class="back" data-nav="home">← Back to the casebook</button><div class="eyebrow">Your case</div><h1>Bring your own log</h1>' +
      '<p class="lede" style="max-width:62ch;color:var(--ink-2)">Paste an agent log as JSON, or upload a <code>.json</code> file. Analysis happens in this page; nothing is uploaded. Only <code>events</code> is required. The fields below sharpen the analysis.</p>' +
      '<div class="specgrid"><div class="panel"><label for="json" class="sr">Case JSON</label><textarea id="json" class="jsonbox" spellcheck="false">' + esc(draft) + '</textarea>' +
      '<div class="toolbar" style="margin-top:10px"><button class="btn primary" data-act="analyse">Open the case</button><button class="btn" data-act="template">Reset to template</button><label class="btn" for="file">Upload .json</label><input id="file" type="file" accept=".json,application/json" hidden></div><div id="err" class="err" role="alert"></div></div>' +
      '<div class="method small"><h3>Fields</h3><ul>' +
      "<li><code>events[]</code>: <code>t</code> (time), <code>actor</code> (user, agent, tool, system, external), <code>kind</code> (instruction, plan, approval, reasoning, command, result, read, message, event), <code>text</code> or <code>command</code>.</li>" +
      "<li>Mark the decisive act with <code>\"fatal\": true</code>, its <code>target</code> (<code>name</code>, <code>env</code>) and the credential it <code>uses</code>. Without a mark, the last destructive or exfiltrating command is taken.</li>" +
      "<li>For untrusted inputs, set <code>actor: \"external\"</code> or <code>source</code> (issue, web, email…). Link an act to its source with <code>derived_from</code>.</li>" +
      "<li>On approvals, <code>covers</code> lists the event ids (<code>e1</code>, <code>e2</code>… by position) that the human actually saw.</li>" +
      "<li><code>grants[]</code> describe credentials: <code>scope_level</code> (global or task), <code>origin</code> (provided or found).</li>" +
      "<li><code>vague_term</code> on the act names an undefined word the agent relied on (\"unused\", \"broken\").</li>" +
      "<li>Tags such as destructive, credential, approval and hidden instructions are also detected from the text by pattern.</li></ul></div></div>";
  }
  function analyseByo() {
    var box = document.getElementById("json"), err = document.getElementById("err");
    store("byo", box.value);
    var c;
    try { c = JSON.parse(box.value); } catch (e) { err.textContent = "That is not valid JSON: " + e.message; return; }
    var problems = [];
    if (!c || typeof c !== "object") problems.push("The top level must be an object.");
    else {
      if (!Array.isArray(c.events) || !c.events.length) problems.push("“events” must be a non-empty array.");
      else c.events.forEach(function (e, i) { if (!e || (typeof e.text !== "string" && typeof e.command !== "string")) problems.push("Event " + (i + 1) + " needs a “text” or “command” string."); });
    }
    if (problems.length) { err.textContent = problems.slice(0, 6).join("\n"); return; }
    c.id = c.id || "byo"; c.task = c.task || { description: "", env: "" }; c.grants = c.grants || []; c.spec = c.spec || "";
    c.number = c.number || "BYO";
    state.byoCase = c;
    history.pushState(null, "", "#case/byo");
    openCase(c, true);
  }

  // ---------------- Method ----------------
  function renderMethod() {
    setNav("method");
    app.innerHTML = '<div class="method"><button class="back" data-nav="home">← Back to the casebook</button><div class="eyebrow">Method</div><h1>How the detective reasons</h1>' +
      "<p>An incident log is an epistemic narrative: a story driven by the desire to know. Agent Detective treats it the way detective fiction does, and the way a court reasons about the facts of a case. Everything below runs as plain rules in your browser; no language model is involved, so the same log always yields the same verdict.</p>" +
      "<h2>Two stories, superposed</h2><p>Todorov observed that a detective novel tells two stories: the crime, which happened in the past, and the investigation, which uncovers it. The page keeps them apart. Section I is the crime, rebuilt from the log. Section II is the investigation: the scheme, the suspects and the questions.</p>" +
      "<h2>Abduction, then elimination</h2><p>Peirce called it abduction: from an observed result, postulate the cause that would explain it. The detective proposes four rival causes (a gap in the spec, excessive permission, prompt injection, and an advisory rule that was ignored) and tests each against evidence for and against, as in a differential diagnosis. “When you have eliminated the impossible, whatever remains, however improbable, must be the truth.”</p>" +
      "<h2>Story schemes and critical questions</h2><p>Bex and Verheij (2010) model crime stories with <i>story schemes</i>: reusable patterns such as motive, opportunity, act and consequence. A story that leaves a slot empty is weaker. Here the scheme is Motive → Belief → Means → Opportunity → Act → Consequence. Each slot asks for evidence, and each yields a critical question. Open questions are reported, not hidden.</p>" +
      "<h2>The unreliable narrator</h2><p>Agents often explain themselves after the fact. That explanation is testimony from the same model that acted, produced after the outcome was known. The detective records it, but never treats it as corroboration of itself.</p>" +
      "<h2>The spec as counterfactual</h2><p>In Spec-Driven Development (GitHub Spec Kit, Google Antigravity) the spec and its constitution are meant to govern what the agent does. The detective replays the log against the spec you write. A clause tagged <code>[enforced]</code> acts as a gate: if it would refuse the decisive step, the story ends there. An untagged clause is advice, and advice does not change what the log shows. This separates the two senses of “spec” that the PocketOS case made visible: the rule the agent was told, and the rule a system checks. It follows the argument of Zhang et al. (2025) that trustworthy agents need formal, checkable constraints alongside the language model.</p>" +
      "<h2>Limits</h2><ul><li>The rules are hand-written heuristics over a small vocabulary of acts. They will miss incidents outside it.</li><li>Scores are evidence weights, not probabilities.</li><li>Case 1 is a reconstruction from press reports, not the original transcript.</li></ul>" +
      '<h2>References</h2><ol class="refs">' +
      "<li>Bex, F. J., &amp; Verheij, B. (2010). Story schemes for argumentation about the facts of a crime. <i>AAAI Fall Symposium on Computational Models of Narrative</i>, FS-10-04, 6–13.</li>" +
      "<li>Furtado, A. L. (2026). <i>Storytelling: Detective stories</i>. Lecture notes, INF2062, PUC-Rio.</li>" +
      "<li>Lima, E. S. de, Neggers, M. M. E., Casanova, M. A., Feijó, B., &amp; Furtado, A. L. (2025). A pattern-oriented AI-powered approach to story composition. <i>ICEC 2024</i>, LNCS 15192, 135–150.</li>" +
      "<li>Todorov, T. (1977). The typology of detective fiction. In <i>The Poetics of Prose</i>. Cornell University Press.</li>" +
      "<li>Peirce, C. S. (1931–1958). <i>Collected Papers</i>. Harvard University Press.</li>" +
      "<li>Zhang, Y., Cai, Y., Zuo, X., et al. (2025). Position: Trustworthy AI agents require the integration of large language models and formal methods. <i>ICML 2025</i>, PMLR 267.</li>" +
      "<li>Lukyanenko, R., Samuel, B., Tegarden, D. P., et al. (2025). Manifesto for software development and modeling in the age of artificial intelligence. SSRN, doi:10.2139/ssrn.5881104.</li>" +
      "<li>Zhang, S., Yin, M., Zhang, J., et al. (2025). Which agent causes task failures and when? On automated failure attribution of LLM multi-agent systems. <i>ICML 2025</i>.</li>" +
      "<li>GitHub (2025). <i>Spec Kit</i>. github.com/github/spec-kit.</li></ol></div>";
  }

  // ---------------- Events ----------------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-case],[data-nav],[data-ref],[data-add],[data-act],[data-q]");
    if (!t) return;
    if (t.dataset.case) { e.preventDefault(); location.hash = "case/" + t.dataset.case; return; }
    if (t.dataset.nav) {
      e.preventDefault();
      var want = t.dataset.nav === "home" ? "" : t.dataset.nav;
      if (location.hash.replace(/^#/, "") === want) { route(); window.scrollTo(0, 0); } else location.hash = want;
      return;
    }
    if (t.dataset.ref) {
      var el = document.getElementById("ev-" + t.dataset.ref);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("hl"); void el.offsetWidth; el.classList.add("hl"); }
      return;
    }
    if (t.dataset.add) { addClause(t.dataset.add, t.dataset.mode); return; }
    if (t.dataset.q) { state.qFilter = t.dataset.q; applyQFilter(); return; }
    var act = t.dataset.act;
    if (act === "reset") { state.caseFile.spec = state.original.spec; document.getElementById("speced").value = state.caseFile.spec; try { localStorage.removeItem("ad:spec:" + state.caseFile.id); } catch (x) { } refresh(); }
    if (act === "download") {
      var blob = new Blob([JSON.stringify(stripCase(state.caseFile), null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (state.caseFile.id || "case") + ".json"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    if (act === "analyse") analyseByo();
    if (act === "template") { document.getElementById("json").value = JSON.stringify(TEMPLATE, null, 2); store("byo", document.getElementById("json").value); }
  });
  function stripCase(c) { var o = clone(c); return o; }

  var timer;
  document.addEventListener("input", function (e) {
    if (e.target.id === "speced") {
      state.caseFile.spec = e.target.value;
      store("spec:" + state.caseFile.id, e.target.value);
      clearTimeout(timer); timer = setTimeout(refresh, 250);
    }
    if (e.target.id === "json") store("byo", e.target.value);
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "file" && e.target.files[0]) {
      var rd = new FileReader();
      rd.onload = function () { document.getElementById("json").value = rd.result; analyseByo(); };
      rd.readAsText(e.target.files[0]);
    }
  });

  function route() {
    var h = location.hash.replace(/^#/, "");
    if (h.indexOf("case/") === 0) {
      var c = window.AD_CASES.filter(function (x) { return x.id === h.slice(5); })[0];
      if (!c && h === "case/byo" && state.byoCase) c = state.byoCase;
      if (c) return openCase(c, c === state.byoCase);
    }
    if (h === "byo") return renderByo();
    if (h === "method") return renderMethod();
    renderHome();
  }
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  window.addEventListener("popstate", function () { route(); });
  route();
})();
