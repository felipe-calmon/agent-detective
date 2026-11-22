(function () {
  "use strict";
  var AD = window.AgentDetective;
  var app = document.getElementById("app");
  var state = { caseFile: null, original: null, prevVerdict: null, qFilter: "open" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function store(k, v) { try { localStorage.setItem("ad-pt:" + k, v); } catch (e) { } }
  function load(k) { try { return localStorage.getItem("ad-pt:" + k); } catch (e) { return null; } }
  function setNav(which) { document.querySelectorAll(".topnav a").forEach(function (a) { if (a.dataset.nav === which) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }
  function ref(n) { return n ? ' <button class="ref" data-ref="' + n + '" title="Mostrar na linha do tempo">passo ' + n + "</button>" : ""; }

  // ---------------- Home ----------------
  function renderHome() {
    setNav("home");
    state.caseFile = null;
    var cards = window.AD_CASES.map(function (c) {
      return '<button class="casecard" data-case="' + c.id + '"><span class="no">Caso ' + esc(c.number) + '</span><h3>' + esc(c.title) + "</h3><p>" + esc(c.teaser) + '</p><span class="basis">' + esc(c.basis) + "</span></button>";
    }).join("");
    app.innerHTML =
      '<section class="hero"><div><div class="eyebrow">O livro de casos</div><h1>Raciocine de trás para a frente: do estrago à cláusula que faltava.</h1>' +
      '<p class="lede">Abra um caso a partir do log de um agente de IA. O Agent Detective reconstrói a história do incidente, põe explicações rivais em julgamento, lista as perguntas que as evidências ainda não respondem e encontra a cláusula da spec que teria impedido o estrago. Depois, reescreva a spec e veja se o veredito se sustenta.</p></div>' +
      '<blockquote>“Há poucas pessoas que, se você lhes contasse um resultado, conseguiriam deduzir da própria consciência quais foram os passos que levaram a ele. É a esse poder que me refiro quando falo em raciocinar de trás para a frente.”<cite>Sherlock Holmes, <i>Um Estudo em Vermelho</i> (1887)</cite></blockquote></section>' +
      '<div class="section-title"><span class="roman">§</span><h2>Abra um caso</h2></div>' +
      '<div class="cases">' + cards + '<button class="casecard byo" data-nav="byo"><span class="no">Seu caso</span><h3>Traga o seu próprio log</h3><p>Cole ou envie o log de um agente em JSON. Ele é analisado aqui, no seu navegador, e não é enviado a lugar nenhum.</p><span class="basis">Há um modelo pronto.</span></button></div>';
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
    if (r.verdict.kind === "prevented") return "evitado no passo " + r.replay.step.n;
    if (r.verdict.kind === "none") return "nenhum ato decisivo";
    var k = contrib(r); return r.verdict.headline + (k ? ", com " + k.cause.toLowerCase() : "");
  }

  function renderCase(first) {
    setNav("");
    var c = state.caseFile, r = AD.analyse(c);
    var o = AD.analyse(state.original);
    var html = '<button class="back" data-nav="home">← Voltar ao livro de casos</button>';
    html += '<section class="casehead"><div><div class="eyebrow">Caso ' + esc(c.number || "") + "</div><h1>" + esc(c.title || "Caso sem título") + "</h1>" +
      (c.basis ? '<p class="muted"><i>' + esc(c.basis) + "</i></p>" : "") +
      (c.sources && c.sources.length ? '<p class="small">Fontes: ' + c.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a>"; }).join(" · ") + "</p>" : "") + "</div>" +
      '<dl class="facts"><dt>Agente</dt><dd>' + esc(c.agent || "—") + "</dd><dt>Tarefa</dt><dd>" + esc(c.task && c.task.description || "—") + "</dd><dt>Escopo</dt><dd>" + esc(c.task && c.task.env || "—") + "</dd>" +
      (c.grants || []).map(function (g) { return "<dt>Credencial</dt><dd><code>" + esc(g.name) + "</code>, " + esc(g.scope) + " (" + esc(g.origin === "found" ? "encontrada pelo agente" : "fornecida") + ")</dd>"; }).join("") +
      '</dl></section>';

    html += '<div id="verdict">' + verdictHtml(r, o) + "</div>";
    html += '<div class="cols"><section aria-labelledby="t-crime"><div class="section-title"><span class="roman">I.</span><h2 id="t-crime">A história do crime</h2></div>' +
      '<p class="section-note">O que aconteceu, na ordem em que aconteceu. O ato decisivo está marcado em vermelho.</p><div id="timeline">' + timelineHtml(r, c) + "</div></section>" +
      '<section aria-labelledby="t-inv"><div class="section-title"><span class="roman">II.</span><h2 id="t-inv">A história da investigação</h2></div>' +
      '<p class="section-note">O incidente lido como um esquema de história: cada lacuna deve ser preenchida por evidências. As lacunas vazias são onde mora a dúvida.</p>' +
      '<div id="scheme">' + schemeHtml(r) + '</div><h3>Suspeitos: quatro explicações para a causa</h3><p class="section-note">Hipóteses por abdução, cada uma pesada contra as evidências a favor e contra.</p><div id="hyps">' + hypsHtml(r) + "</div>" +
      '<h3>Perguntas críticas</h3><p class="section-note">Perguntas às quais a história precisa resistir. As que estão em aberto marcam o que o log ainda não consegue nos dizer.</p>' +
      '<div class="qfilter" role="group" aria-label="Filtrar perguntas"><button class="btn small" data-q="open">Em aberto</button><button class="btn small" data-q="all">Todas</button></div><div id="qs">' + qsHtml(r) + "</div></section></div>";

    html += '<section aria-labelledby="t-spec" style="margin-top:40px"><div class="section-title"><span class="roman">III.</span><h2 id="t-spec">A spec no banco dos réus</h2></div>' +
      '<p class="section-note">Edite a spec como faria com uma constituição do Spec Kit. Marque uma cláusula com <code>[aplicada]</code> quando uma ferramenta, um hook ou uma política a verificar; sem essa marca, ela é um conselho que o agente pode ignorar. O veredito se atualiza enquanto você digita.</p>' +
      '<div class="specgrid"><div><label class="sr" for="speced">Spec</label><textarea id="speced" class="speced" spellcheck="false">' + esc(c.spec || "") + '</textarea>' +
      '<div class="toolbar" style="margin-top:8px"><button class="btn small" data-act="reset">Restaurar a spec</button><button class="btn small" data-act="download">Baixar o caso em JSON</button></div>' +
      '<h3 style="margin-top:18px">Como o detetive lê a sua spec</h3><div id="clauses">' + clausesHtml(r) + "</div></div>" +
      '<div><h3>Cláusulas que teriam impedido o incidente</h3><p class="section-note">Cada uma, aplicada sozinha, encerra a história antes do ato decisivo. Ordenadas pelas hipóteses principais.</p><div id="sugg">' + suggHtml(r) + "</div>" +
      '<div class="lesson"><b>Experimente.</b> Adicione uma sugestão como <i>consultiva</i>: o incidente continua acontecendo, e a nova regra só vira evidência para “A Regra que Era Só Palavras”. Adicione a mesma cláusula como <i>aplicada</i> e o caso se encerra antes de começar. Ou apague a regra de segurança e veja a lacuna na spec tomar o lugar dela. Uma regra no prompt é depoimento; uma regra numa barreira é prova.</div></div></div></section>';

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
    var stamp = prevented ? "Evitado<small>pela spec atual</small>" : v.kind === "none" ? "Evidência<small>insuficiente</small>" : "Causa encontrada<small>" + esc(v.headline) + "</small>";
    var diff = "";
    if (verdictKey(r) !== verdictKey(o)) {
      diff = '<div class="change" role="status">O veredito mudou em relação à spec original: “' + esc(verdictLabel(o)) + "” → “" + esc(verdictLabel(r)) + "”.</div>";
    }
    return '<section class="verdict ' + (prevented ? "prevented" : "") + '" aria-live="polite"><div class="stamp">' + stamp + "</div><div>" +
      '<div class="eyebrow">O veredito</div><h2>' + esc(prevented ? v.headline : "A explicação mais plausível: " + v.headline.toLowerCase()) + "</h2><p>" + esc(v.text) + (prevented ? ref(r.replay.step.n) : (r.fatal ? " Ato decisivo:" + ref(r.fatal.n) : "")) + "</p>" + diff + "</div></section>";
  }

  var TAGLABEL = { destructive: "destrutivo", egress: "dados saem", credential: "credencial", untrusted: "fonte não confiável", injection: "instrução escondida", approval: "aprovação", verification: "checagem", selfreport: "depoimento", production: "produção" };
  var ACTORLABEL = { user: "usuário", agent: "agente", tool: "ferramenta", system: "sistema", external: "externo" };
  var KINDLABEL = { instruction: "instrução", plan: "plano", approval: "aprovação", reasoning: "raciocínio", command: "comando", result: "resultado", read: "leitura", message: "mensagem", event: "evento", tool_call: "chamada de ferramenta" };
  function timelineHtml(r, c) {
    var cut = r.replay.blocked ? r.replay.step.n : null;
    var out = '<ol class="timeline">';
    r.evs.forEach(function (e) {
      var cls = "ev" + (r.fatal && e.n === r.fatal.n ? " fatal" : "") + (cut && e.n >= cut ? " after" : "");
      if (cut && e.n === cut) out += '<li class="cutline" aria-label="Contrafactual">Com a spec atual, a história para aqui: ' + esc(r.replay.reason) + ". Nada do que vem abaixo acontece.</li>";
      var tags = Object.keys(e.tagset).filter(function (t) { return TAGLABEL[t]; }).map(function (t) { return '<span class="tag ' + t + '">' + TAGLABEL[t] + "</span>"; }).join("");
      out += '<li class="' + cls + '" id="ev-' + e.n + '"><span class="dot">' + e.n + '</span><div class="meta"><span>' + esc(e.t || "") + '</span><span class="actor ' + esc(e.actor) + '">' + esc(ACTORLABEL[e.actor] || e.actor) + "</span><span>" + esc(KINDLABEL[e.kind] || e.kind) + (e.source ? " · " + esc(e.source) : "") + "</span>" + tags + "</div>" +
        (e.text ? '<div class="body">' + esc(e.text) + "</div>" : "") + (e.command ? "<pre>$ " + esc(e.command) + "</pre>" : "") +
        (e.target ? '<div class="small muted">alvo: <code>' + esc(e.target.name) + "</code> em " + esc(e.target.env) + "</div>" : "") + "</li>";
    });
    out += "</ol>";
    if (c.outcome && !cut) out += '<div class="outcome"><b>Desfecho.</b> ' + esc(c.outcome.summary) + "</div>";
    return out;
  }

  function schemeHtml(r) {
    return '<div class="scheme">' + r.scheme.map(function (s) {
      return '<div class="slot ' + (s.filled ? "" : "empty") + '"><b>' + esc(s.slot) + '</b><span class="gloss">' + esc(s.gloss) + '</span><span class="val">' + (s.value ? esc(s.value) : "— sem evidência —") + "</span>" + (s.ev ? ref(s.ev.n) : "") + "</div>";
    }).join("") + "</div>";
  }

  function hypsHtml(r) {
    if (!r.hypotheses.length) return '<p class="muted">Sem ato decisivo, sem suspeitos.</p>';
    var max = Math.max.apply(null, r.hypotheses.map(function (h) { return Math.max(h.pro, h.con); }).concat([6]));
    return '<div class="hyps">' + r.hypotheses.map(function (h, i) {
      var items = h.for.map(function (x) { return '<li class="for"><span class="sign" aria-label="a favor">+</span><span>' + esc(x.text) + ref(x.ev) + "</span></li>"; })
        .concat(h.against.map(function (x) { return '<li class="against"><span class="sign" aria-label="contra">−</span><span>' + esc(x.text) + ref(x.ev) + "</span></li>"; })).join("");
      return '<article class="hyp ' + (i === 0 && r.verdict.kind !== "prevented" && h.net > 0 ? "lead" : "") + '"><div class="hyp-head"><h3><span class="rank">' + (i + 1) + "</span>" + esc(h.title) + '</h3><span class="cause">' + esc(h.cause) + "</span></div>" +
        '<p class="claim">' + esc(h.claim) + "</p>" +
        '<div class="meter" role="img" aria-label="Evidências contra: ' + h.con + ', a favor: ' + h.pro + '"><div class="con"><i style="width:' + (h.con / max * 100) + '%"></i></div><div class="pro"><i style="width:' + (h.pro / max * 100) + '%"></i></div></div>' +
        '<div class="meter-legend"><span>contra ' + h.con + "</span><span>saldo " + (h.net > 0 ? "+" : "") + h.net + "</span><span>a favor " + h.pro + "</span></div>" +
        '<ul class="evlist">' + items + "</ul></article>";
    }).join("") + "</div>";
  }

  function qsHtml(r) {
    if (!r.questions.length) return "";
    return '<ul class="qs">' + r.questions.map(function (q) {
      return '<li class="q ' + q.status + '"><div class="qhead"><span class="slotname">' + esc(q.slot) + '</span><span class="status">' + (q.status === "open" ? "em aberto" : "respondida") + '</span></div><div class="qq">' + esc(q.q) + '</div><div class="ans">' + esc(q.answer) + ref(q.ev) + "</div></li>";
    }).join("") + "</ul>";
  }
  function applyQFilter() {
    document.querySelectorAll("[data-q]").forEach(function (b) { b.classList.toggle("primary", b.dataset.q === state.qFilter); b.setAttribute("aria-pressed", b.dataset.q === state.qFilter); });
    document.querySelectorAll(".q").forEach(function (li) { li.hidden = state.qFilter === "open" && !li.classList.contains("open"); });
  }

  function clausesHtml(r) {
    if (!r.clauses.length) return '<p class="muted small">A spec está vazia. Todo ato é permitido, e nada é verificado.</p>';
    return '<ul class="clauses">' + r.clauses.map(function (cl) {
      var badges = cl.classes.length ? cl.classes.map(function (k) { return '<span class="badge cls">' + esc(AD.CLASSES[k].label) + "</span>"; }).join("") + (cl.enforced ? '<span class="badge enf">aplicada</span>' : '<span class="badge adv">consultiva</span>') : '<span class="badge none">nenhuma regra de segurança detectada</span>';
      return '<li><span class="ctext">' + esc(cl.text) + "</span>" + badges + "</li>";
    }).join("") + "</ul>";
  }

  function suggHtml(r) {
    if (!r.suggestions.length) return '<p class="muted small">Nenhuma cláusula do catálogo, sozinha, teria impedido este ato.</p>';
    return '<div class="sugg">' + r.suggestions.map(function (s, i) {
      return '<div class="sug ' + (s.present ? "present" : "") + '"><h3 style="margin:0 0 4px">' + esc(s.label) + (i === 0 && !s.present ? ' <span class="badge enf">recomendada</span>' : "") + (s.present ? ' <span class="badge enf">já está na spec</span>' : "") + "</h3>" +
        '<p class="why">Bloquearia o passo ' + s.step + ": " + esc(s.reason) + '.</p><div class="ctext">' + esc(s.text) + "</div>" +
        (s.present ? "" : '<div class="acts"><button class="btn small primary" data-add="' + s.cls + '" data-mode="enforced">Adicionar como aplicada</button><button class="btn small" data-add="' + s.cls + '" data-mode="advisory">Adicionar como consultiva</button></div>') + "</div>";
    }).join("") + "</div>";
  }

  function addClause(cls, mode) {
    var c = state.caseFile, r = AD.analyse(c);
    var txt = AD.TEMPLATES[cls](c, r.fatal || {});
    if (mode === "advisory") txt = txt.replace(/\s*\[(enforced|aplicad[ao])[^\]]*\]/i, "");
    c.spec = (c.spec || "").replace(/\s*$/, "") + "\n- " + txt + "\n";
    var ed = document.getElementById("speced"); ed.value = c.spec;
    store("spec:" + c.id, c.spec);
    refresh();
    document.getElementById("verdict").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------- Bring your own ----------------
  var TEMPLATE = {
    title: "Meu incidente", number: "BYO", agent: "descreva o agente",
    task: { description: "O que pediram ao agente", env: "staging" },
    grants: [{ id: "cred1", name: "API_TOKEN", scope: "todos os ambientes", scope_level: "global", origin: "found", found_in: "config/old.env", purpose: "outra coisa" }],
    allowlist: ["api.github.com"],
    spec: "# Constituição\n- O agente trabalha somente em staging.",
    outcome: { summary: "Qual foi o estrago." },
    events: [
      { t: "10:00:00", actor: "user", kind: "instruction", text: "Por favor, corrija X." },
      { t: "10:00:10", actor: "agent", kind: "plan", text: "Plano: inspecionar, corrigir, refazer o deploy." },
      { t: "10:00:20", actor: "user", kind: "approval", text: "Aprovado.", covers: ["e2"] },
      { t: "10:01:00", actor: "agent", kind: "reasoning", text: "Por que o agente acha que o ato está certo." },
      { t: "10:01:30", actor: "agent", kind: "command", uses: "cred1", fatal: true, target: { name: "db-main", env: "produção" }, command: "dbctl drop database db-main" },
      { t: "10:01:31", actor: "tool", kind: "result", text: "dropped" }
    ]
  };

  function renderByo() {
    setNav("byo");
    var draft = load("byo") || JSON.stringify(TEMPLATE, null, 2);
    app.innerHTML = '<button class="back" data-nav="home">← Voltar ao livro de casos</button><div class="eyebrow">Seu caso</div><h1>Traga o seu próprio log</h1>' +
      '<p class="lede" style="max-width:62ch;color:var(--ink-2)">Cole o log de um agente em JSON, ou envie um arquivo <code>.json</code>. A análise acontece nesta página; nada é enviado. Só <code>events</code> é obrigatório. Os campos abaixo deixam a análise mais precisa. Os nomes dos campos são os mesmos da versão em inglês.</p>' +
      '<div class="specgrid"><div class="panel"><label for="json" class="sr">JSON do caso</label><textarea id="json" class="jsonbox" spellcheck="false">' + esc(draft) + '</textarea>' +
      '<div class="toolbar" style="margin-top:10px"><button class="btn primary" data-act="analyse">Abrir o caso</button><button class="btn" data-act="template">Voltar ao modelo</button><label class="btn" for="file">Enviar .json</label><input id="file" type="file" accept=".json,application/json" hidden></div><div id="err" class="err" role="alert"></div></div>' +
      '<div class="method small"><h3>Campos</h3><ul>' +
      "<li><code>events[]</code>: <code>t</code> (horário), <code>actor</code> (user, agent, tool, system, external), <code>kind</code> (instruction, plan, approval, reasoning, command, result, read, message, event), <code>text</code> ou <code>command</code>. Os valores de <code>actor</code> e <code>kind</code> ficam em inglês.</li>" +
      "<li>Marque o ato decisivo com <code>\"fatal\": true</code>, o seu <code>target</code> (<code>name</code>, <code>env</code>) e a credencial que ele usa (<code>uses</code>). Sem marcação, vale o último comando destrutivo ou de vazamento de dados.</li>" +
      "<li>Para entradas não confiáveis, use <code>actor: \"external\"</code> ou <code>source</code> (issue, web, email…). Ligue um ato à sua origem com <code>derived_from</code>.</li>" +
      "<li>Nas aprovações, <code>covers</code> lista os ids dos eventos (<code>e1</code>, <code>e2</code>… pela posição) que a pessoa realmente viu.</li>" +
      "<li><code>grants[]</code> descreve as credenciais: <code>scope_level</code> (global ou task), <code>origin</code> (provided, fornecida, ou found, encontrada).</li>" +
      "<li><code>vague_term</code> no ato nomeia uma palavra indefinida em que o agente se apoiou (\"sem uso\", \"quebrado\").</li>" +
      "<li>Marcas como destrutivo, credencial, aprovação e instrução escondida também são detectadas no texto por padrões, em português e em inglês.</li></ul></div></div>";
  }
  function analyseByo() {
    var box = document.getElementById("json"), err = document.getElementById("err");
    store("byo", box.value);
    var c;
    try { c = JSON.parse(box.value); } catch (e) { err.textContent = "Isso não é um JSON válido: " + e.message; return; }
    var problems = [];
    if (!c || typeof c !== "object") problems.push("O nível de cima precisa ser um objeto.");
    else {
      if (!Array.isArray(c.events) || !c.events.length) problems.push("“events” precisa ser uma lista não vazia.");
      else c.events.forEach(function (e, i) { if (!e || (typeof e.text !== "string" && typeof e.command !== "string")) problems.push("O evento " + (i + 1) + " precisa de um texto em “text” ou “command”."); });
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
    app.innerHTML = '<div class="method"><button class="back" data-nav="home">← Voltar ao livro de casos</button><div class="eyebrow">Método</div><h1>Como o detetive raciocina</h1>' +
      "<p>O log de um incidente é uma narrativa epistêmica: uma história movida pelo desejo de saber. O Agent Detective o trata como a ficção policial trata um crime, e como um tribunal raciocina sobre os fatos de um caso. Tudo o que está descrito abaixo roda como regras simples no seu navegador; nenhum modelo de linguagem participa, então o mesmo log sempre produz o mesmo veredito.</p>" +
      "<h2>Duas histórias sobrepostas</h2><p>Todorov observou que um romance policial conta duas histórias: a do crime, que aconteceu no passado, e a da investigação, que o desvenda. A página mantém as duas separadas. A seção I é o crime, reconstruído a partir do log. A seção II é a investigação: o esquema, os suspeitos e as perguntas.</p>" +
      "<h2>Abdução, depois eliminação</h2><p>Peirce chamou isso de abdução: a partir de um resultado observado, postular a causa que o explicaria. O detetive propõe quatro causas rivais (uma lacuna na spec, permissão excessiva, injeção de prompt e uma regra consultiva que foi ignorada) e testa cada uma contra as evidências a favor e contra, como num diagnóstico diferencial. “Quando você elimina o impossível, o que resta, por mais improvável que seja, deve ser a verdade.”</p>" +
      "<h2>Esquemas de história e perguntas críticas</h2><p>Bex e Verheij (2010) modelam histórias de crimes com <i>esquemas de história</i> (story schemes): padrões reutilizáveis como motivo, oportunidade, ato e consequência. Uma história que deixa uma lacuna vazia é mais fraca. Aqui o esquema é Motivo → Crença → Meios → Oportunidade → Ato → Consequência. Cada lacuna pede evidências, e cada uma gera uma pergunta crítica. As perguntas em aberto são mostradas, não escondidas.</p>" +
      "<h2>O narrador não confiável</h2><p>Os agentes costumam se explicar depois do fato. Essa explicação é o depoimento do mesmo modelo que agiu, produzido quando o resultado já era conhecido. O detetive a registra, mas nunca a trata como confirmação de si mesma.</p>" +
      "<h2>A spec como contrafactual</h2><p>No Spec-Driven Development (GitHub Spec Kit, Google Antigravity), a spec e a sua constituição deveriam governar o que o agente faz. O detetive repete o log contra a spec que você escreve. Uma cláusula marcada com <code>[aplicada]</code> (ou <code>[enforced]</code>) funciona como uma barreira: se ela recusaria o passo decisivo, a história termina ali. Uma cláusula sem a marca é um conselho, e conselho não muda o que o log mostra. Isso separa os dois sentidos de “spec” que o caso PocketOS deixou visíveis: a regra que o agente recebeu e a regra que um sistema verifica. Segue o argumento de Zhang et al. (2025) de que agentes confiáveis precisam de restrições formais e verificáveis ao lado do modelo de linguagem.</p>" +
      "<h2>Limites</h2><ul><li>As regras são heurísticas escritas à mão sobre um vocabulário pequeno de atos. Elas vão deixar passar incidentes fora dele.</li><li>As pontuações são pesos de evidência, não probabilidades.</li><li>O caso 1 é uma reconstrução a partir de reportagens, não a transcrição original.</li></ul>" +
      '<h2>Referências</h2><ol class="refs">' +
      "<li>Bex, F. J., &amp; Verheij, B. (2010). Story schemes for argumentation about the facts of a crime. <i>AAAI Fall Symposium on Computational Models of Narrative</i>, FS-10-04, 6–13.</li>" +
      "<li>Furtado, A. L. (2026). <i>Storytelling: Detective stories</i>. Notas de aula, INF2062, PUC-Rio.</li>" +
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
    if (act === "reset") { state.caseFile.spec = state.original.spec; document.getElementById("speced").value = state.caseFile.spec; try { localStorage.removeItem("ad-pt:spec:" + state.caseFile.id); } catch (x) { } refresh(); }
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
