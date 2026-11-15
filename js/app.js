(function () {
  const F = Fuzzy;
  const V = Validation;
  const $ = (s, r = document) => r.querySelector(s);
  const f = F.fmt;

  const NOME_ETAPA = ['nenhuma executada', 'fuzzificação', 'avaliação das regras', 'implicação', 'agregação', 'defuzzificação'];
  const COR_CONJ = ['--s1', '--s2', '--s3'];
  const NOME_CONS = { curto: 'curto', medio: 'médio', longo: 'longo' };
  const corDe = (variavel, id) => COR_CONJ[F.VARIAVEIS[variavel].conjuntos.findIndex((c) => c.id === id)];

  let resultado = null;
  let etapa = 0;
  let regraSel = 0;

  function lerConfig() {
    return {
      umidade: $('#f-u').value,
      temperatura: $('#f-t').value,
      consequentes: Array.from({ length: 9 }, (_, i) => $('#rule-' + i).value),
      passo: $('#f-step').value,
    };
  }

  function validar() {
    const v = F.validarConfig(lerConfig());
    const marca = (id, erro) => {
      const inp = $('#' + id);
      inp.setAttribute('aria-invalid', erro ? 'true' : 'false');
      $(`.err[data-for="${id}"]`).textContent = erro || '';
    };
    marca('f-u', v.erros.umidade);
    marca('f-t', v.erros.temperatura);
    $('#e-rules').textContent = v.erros.consequentes || '';
    $('#btn-calc').disabled = !v.ok;
    $('#btn-step').disabled = !v.ok;
    return v;
  }

  function status(msg, tipo) {
    const el = $('#run-status');
    el.textContent = msg;
    el.className = 'status' + (tipo ? ' ' + tipo : '');
  }

  function aoAlterar() {
    const tinha = resultado !== null;
    resultado = null;
    etapa = 0;
    const v = validar();
    if (!v.ok) status('Corrija os campos destacados para calcular.', 'warn');
    else if (tinha) status('Configuração alterada: os resultados anteriores foram apagados e as etapas recomeçam do início.');
    else status('Clique em Calcular para executar a inferência, ou em Avançar etapa para acompanhá-la passo a passo.');
    renderTudo();
  }

  function preencher(cfg) {
    $('#f-u').value = f(cfg.umidade);
    $('#r-u').value = cfg.umidade;
    $('#f-t').value = f(cfg.temperatura);
    $('#r-t').value = cfg.temperatura;
    cfg.consequentes.forEach((c, i) => { $('#rule-' + i).value = c; });
    $('#f-step').value = String(cfg.passo);
    marcarRegrasAlteradas();
  }

  function marcarRegrasAlteradas() {
    for (let i = 0; i < 9; i++) {
      $('#rule-' + i).closest('li').classList.toggle('changed', $('#rule-' + i).value !== F.CONSEQUENTES_PADRAO[i]);
    }
  }

  function montarEditorRegras() {
    const ol = $('#rule-editor');
    F.ANTECEDENTES.forEach(([u, t], i) => {
      const li = document.createElement('li');
      li.innerHTML =
        `<span class="rid">R${i + 1}</span>` +
        `<label class="ante" for="rule-${i}">SE <b>${F.nomeConjunto('umidade', u)}</b> E <b>${F.nomeConjunto('temperatura', t)}</b> ENTÃO</label>` +
        `<select id="rule-${i}" aria-label="Consequente da regra R${i + 1}">` +
        F.VARIAVEIS.tempo.conjuntos.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('') +
        `</select>`;
      ol.appendChild(li);
      li.querySelector('select').addEventListener('change', () => { marcarRegrasAlteradas(); aoAlterar(); });
    });
  }

  function calcularResultado() {
    const v = validar();
    if (!v.ok) { status('Não foi possível calcular: corrija os campos destacados.', 'warn'); return false; }
    resultado = F.inferir(v.valores);
    const primeira = resultado.regras.find((r) => r.h > 0);
    regraSel = primeira ? primeira.indice : 0;
    return true;
  }

  function calcular() {
    if (!calcularResultado()) return renderTudo();
    etapa = 5;
    status(resultado.centroide.valido
      ? `Inferência completa: ${f(resultado.centroide.z, 2)} min.`
      : 'Inferência completa, mas não há saída agregada válida (nenhuma regra ativada).', resultado.centroide.valido ? 'ok' : 'warn');
    renderTudo();
  }

  function avancar() {
    if (!resultado) {
      if (!calcularResultado()) return renderTudo();
      etapa = 1;
    } else {
      etapa = etapa >= 5 ? 1 : etapa + 1;
    }
    status(`Etapa ${etapa} de 5: ${NOME_ETAPA[etapa]}.`);
    renderTudo();
    const alvo = etapa === 1 ? '[data-stage="1"]' : etapa <= 3 ? '[data-stage="2"]' : '[data-stage="3"]';
    const el = $(alvo);
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function restaurar() {
    preencher(F.PADRAO);
    resultado = null;
    etapa = 0;
    regraSel = 0;
    validar();
    status('Padrão restaurado: U = 35%, T = 30 °C, base de regras da seção 2.2 e Δz = 0,1. Resultados apagados.');
    renderTudo();
  }

  const cor = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const alfa = (hex, a) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  function prepararCanvas(c) {
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function plotar(canvas, o) {
    const V0 = F.VARIAVEIS[o.variavel];
    const { ctx, w, h } = prepararCanvas(canvas);
    if (w === 0) return;
    const pad = { l: 58, r: 16, t: 24, b: 42 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const X = (x) => pad.l + (x - V0.min) / (V0.max - V0.min) * pw;
    const Y = (y) => pad.t + (1 - y) * ph;
    const mono = cor('--mono') || 'monospace';
    const cMuted = cor('--muted'), cLine = cor('--line');

    ctx.font = `11px ${mono}`;
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (const y of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.strokeStyle = y === 0 ? cor('--line-strong') : cLine;
      ctx.beginPath(); ctx.moveTo(pad.l, Y(y) + 0.5); ctx.lineTo(w - pad.r, Y(y) + 0.5); ctx.stroke();
      ctx.fillStyle = cMuted;
      ctx.fillText(f(y), pad.l - 8, Y(y));
    }
    const passo = V0.max - V0.min > 50 ? 10 : 5;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let x = V0.min; x <= V0.max + 1e-9; x += passo) {
      ctx.strokeStyle = cor('--line-strong');
      ctx.beginPath(); ctx.moveTo(X(x) + 0.5, Y(0)); ctx.lineTo(X(x) + 0.5, Y(0) + 4); ctx.stroke();
      ctx.fillStyle = cMuted;
      ctx.fillText(f(x), X(x), Y(0) + 7);
    }
    ctx.fillStyle = cMuted;
    ctx.fillText(`${V0.nome} ${V0.simbolo} (${V0.unidade})`, pad.l + pw / 2, h - 15);
    ctx.save();
    ctx.translate(12, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText('grau de pertinência μ', 0, 0);
    ctx.restore();

    const xs = [];
    const n = Math.max(300, Math.round(pw * 2));
    for (let i = 0; i <= n; i++) xs.push(V0.min + (V0.max - V0.min) * i / n);
    for (const c of V0.conjuntos) xs.push(...c.pontos);
    for (const x of (o.extrasX || [])) xs.push(x);
    xs.sort((a, b) => a - b);

    const caminho = (fn) => {
      ctx.beginPath();
      xs.forEach((x, i) => { const px = X(x), py = Y(fn(x)); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
    };
    for (const c of o.curvas.filter((c) => c.preenchimento)) {
      caminho(c.f);
      ctx.lineTo(X(V0.max), Y(0)); ctx.lineTo(X(V0.min), Y(0)); ctx.closePath();
      ctx.fillStyle = c.preenchimento; ctx.fill();
    }
    for (const c of o.curvas.filter((c) => c.largura)) {
      caminho(c.f);
      ctx.setLineDash(c.tracejado ? [5, 4] : []);
      ctx.strokeStyle = c.cor; ctx.lineWidth = c.largura; ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (o.rotulos !== false) {
      ctx.textBaseline = 'bottom'; ctx.font = `500 12px ${cor('--font') || 'sans-serif'}`;
      V0.conjuntos.forEach((c, i) => {
        if (o.somente && !o.somente.includes(c.id)) return;
        const xm = (c.pontos[1] + c.pontos[2]) / 2;
        const px = Math.min(Math.max(X(xm), pad.l + 26), w - pad.r - 26);
        ctx.textAlign = 'center';
        ctx.fillStyle = cor(COR_CONJ[i]);
        ctx.fillText(c.nome, px, Y(1) - 5);
      });
    }

    for (const l of o.linhas || []) {
      const px = Math.round(X(l.x)) + 0.5;
      ctx.strokeStyle = l.cor; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, Y(0)); ctx.lineTo(px, Y(1) - 2); ctx.stroke();
      ctx.font = `600 12px ${mono}`;
      const tw = ctx.measureText(l.rotulo).width;
      let tx = px + 6; ctx.textAlign = 'left';
      if (tx + tw > w - pad.r) { tx = px - 6; ctx.textAlign = 'right'; }
      ctx.textBaseline = 'top';
      ctx.fillStyle = cor('--surface');
      const bx = ctx.textAlign === 'left' ? tx - 3 : tx - tw - 3;
      ctx.fillRect(bx, Y(0.94) - 2, tw + 6, 18);
      ctx.fillStyle = l.cor;
      ctx.fillText(l.rotulo, tx, Y(0.94));
    }
    ctx.textAlign = 'start';
  }

  const legenda = (itens) => itens.map((i) =>
    `<span><i class="${i.tipo || 'ln'}${i.tracejado ? ' dash' : ''}" style="${i.tracejado ? 'color' : 'background'}:${i.cor}"></i>${i.texto}</span>`).join('');

  function curvasConjuntos(variavel, largura) {
    return F.VARIAVEIS[variavel].conjuntos.map((c, i) => ({
      f: (x) => F.pertinencia(x, c.pontos), cor: cor(COR_CONJ[i]), largura: largura || 2,
    }));
  }

  function renderEntrada(variavel, canvasId, legId, tabId) {
    const V0 = F.VARIAVEIS[variavel];
    const mostra = resultado && etapa >= 1;
    const x = mostra ? (variavel === 'umidade' ? resultado.entrada.U : resultado.entrada.T) : null;
    plotar($(canvasId), {
      variavel,
      curvas: curvasConjuntos(variavel),
      linhas: mostra ? [{ x, cor: cor('--ink'), rotulo: `${V0.simbolo} = ${F.comUnidade(x, V0.unidade)}` }] : [],
    });
    $(legId).innerHTML = legenda(V0.conjuntos.map((c, i) => ({ cor: cor(COR_CONJ[i]), texto: `${c.nome} (${c.pontos.map((p) => f(p)).join('; ')})` })))
      + (mostra ? legenda([{ cor: cor('--ink'), texto: 'valor informado' }]) : '');
    const linhas = V0.conjuntos.map((c, i) => {
      const g = mostra ? resultado.fuzz[variavel][c.id] : null;
      return `<tr><td><i class="sw" style="background:${cor(COR_CONJ[i])}"></i>μ<sub>${c.nome}</sub>(${mostra ? f(x) : V0.simbolo})</td>` +
        `<td class="v${g === 0 ? ' zero' : ''}">${mostra ? f(g) : '—'}</td></tr>`;
    }).join('');
    $(tabId).innerHTML = `<thead><tr><th scope="col">Conjunto</th><th scope="col">Grau</th></tr></thead><tbody>${linhas}</tbody>`;
  }

  function renderRegras() {
    const tb = $('#rules-body');
    const mostra = resultado && etapa >= 2;
    const cfg = lerConfig();
    tb.innerHTML = '';
    F.ANTECEDENTES.forEach(([u, t], i) => {
      const r = mostra ? resultado.regras[i] : null;
      const cons = mostra ? r.consequente : cfg.consequentes[i];
      const tr = document.createElement('tr');
      if (mostra) tr.className = r.h > 0 ? 'on' : 'off';
      if (i === regraSel) tr.classList.add('sel');
      tr.innerHTML =
        `<td><button type="button" aria-pressed="${i === regraSel}">R${i + 1}</button></td>` +
        `<td>${F.nomeConjunto('umidade', u)}<span class="mu">${mostra ? '(' + f(r.muU) + ')' : ''}</span></td>` +
        `<td>${F.nomeConjunto('temperatura', t)}<span class="mu">${mostra ? '(' + f(r.muT) + ')' : ''}</span></td>` +
        `<td><span class="tag c-${cons}">${NOME_CONS[cons]}</span></td>` +
        `<td class="mono">${mostra ? `min(${f(r.muU)}; ${f(r.muT)})` : '—'}</td>` +
        `<td class="h">${mostra ? f(r.h) : '—'}</td>`;
      tr.querySelector('button').addEventListener('click', () => { regraSel = i; renderRegras(); renderDetalheRegra(); });
      tb.appendChild(tr);
    });
  }

  function renderDetalheRegra() {
    const i = regraSel;
    const [u, t] = F.ANTECEDENTES[i];
    const cfg = lerConfig();
    const r = resultado && etapa >= 2 ? resultado.regras[i] : null;
    const cons = r ? r.consequente : cfg.consequentes[i];
    const pts = F.conjunto('tempo', cons).pontos;
    const c = cor(corDe('tempo', cons));
    const recortado = resultado && etapa >= 3;
    const curvas = [{ f: (z) => F.pertinencia(z, pts), cor: c, largura: 2, tracejado: true }];
    if (recortado && r.h > 0) {
      curvas.push({ f: (z) => Math.min(r.h, F.pertinencia(z, pts)), cor: c, largura: 2.5, preenchimento: alfa(c, 0.28) });
    }
    plotar($('#c-rule'), { variavel: 'tempo', curvas, somente: [cons] });
    $('#lg-rule').innerHTML = legenda([{ cor: c, tracejado: true, texto: `consequente original: ${NOME_CONS[cons]}` }]) +
      (recortado && r.h > 0 ? legenda([{ tipo: 'blk', cor: alfa(c, 0.5), texto: `recorte em h = ${f(r.h)}` }]) : '');

    const ante = `SE a umidade é <b>${F.nomeConjunto('umidade', u)}</b> E a temperatura é <b>${F.nomeConjunto('temperatura', t)}</b>, ENTÃO o tempo é <b>${NOME_CONS[cons]}</b>.`;
    let html = `<h3>R${i + 1}</h3><p>${ante}</p>`;
    if (!r) {
      html += '<p class="muted">Os graus dos antecedentes e o recorte aparecem a partir das etapas 2 e 3.</p>';
    } else {
      html += `<p>Ativação: <code>h(R${i + 1}) = min(μ<sub>${F.nomeConjunto('umidade', u)}</sub>(${f(resultado.entrada.U)}); μ<sub>${F.nomeConjunto('temperatura', t)}</sub>(${f(resultado.entrada.T)})) = min(${f(r.muU)}; ${f(r.muT)}) = ${f(r.h)}</code></p>`;
      if (!recortado) html += '<p class="muted">O recorte do consequente aparece na etapa 3 (implicação).</p>';
      else if (r.h === 0) html += '<p>Ativação zero: a regra não contribui para a saída.</p>';
      else html += `<p>Implicação: <code>μ<sub>R${i + 1}</sub>(z) = min(${f(r.h)}; μ<sub>${NOME_CONS[cons]}</sub>(z))</code>. O conjunto ${NOME_CONS[cons]} é cortado na altura ${f(r.h)}.</p>`;
    }
    $('#rule-text').innerHTML = html;
  }

  function renderSaida() {
    const curvas = curvasConjuntos('tempo', 1.5).map((c) => Object.assign(c, { tracejado: true }));
    const leg = F.VARIAVEIS.tempo.conjuntos.map((c, i) => ({ cor: cor(COR_CONJ[i]), tracejado: true, texto: `${c.nome} (${c.pontos.map((p) => f(p)).join('; ')})` }));
    const linhas = [];
    if (resultado && etapa >= 3) {
      for (const rc of resultado.recortes) {
        const c = cor(corDe('tempo', rc.consequente));
        curvas.push({ f: rc.mu, cor: c, largura: etapa >= 4 ? 0 : 1.5, preenchimento: alfa(c, etapa >= 4 ? 0.10 : 0.18) });
      }
      leg.push({ tipo: 'blk', cor: alfa(cor('--s3'), 0.4), texto: 'recortes das regras ativadas' });
    }
    if (resultado && etapa >= 4) {
      const a = cor('--agg');
      curvas.push({ f: resultado.muAgregada, cor: a, largura: 2.5, preenchimento: alfa(a, 0.30) });
      leg.push({ tipo: 'blk', cor: alfa(a, 0.6), texto: 'agregada = máximo dos recortes' });
    }
    if (resultado && etapa >= 5 && resultado.centroide.valido) {
      linhas.push({ x: resultado.centroide.z, cor: cor('--cent'), rotulo: `z* = ${f(resultado.centroide.z, 2)} min` });
      leg.push({ cor: cor('--cent'), texto: 'centroide' });
    }
    plotar($('#c-out'), { variavel: 'tempo', curvas, linhas });
    $('#lg-out').innerHTML = legenda(leg);

    const box = $('#result');
    if (!resultado || etapa < 5) {
      box.className = 'result empty';
      box.textContent = !resultado ? 'Sem resultado. Clique em Calcular ou em Avançar etapa.'
        : etapa < 3 ? 'Os recortes aparecem na etapa 3, a área agregada na etapa 4 e o centroide na etapa 5.'
          : etapa < 4 ? 'Recortes desenhados. Avance para agregá-los pelo máximo.'
            : 'Área agregada desenhada. Avance para calcular o centroide.';
      return;
    }
    const c = resultado.centroide;
    box.className = 'result';
    if (!c.valido) {
      box.innerHTML = '<p class="big">—</p><div class="calc"><p><b>Não há saída agregada válida:</b> nenhuma regra foi ativada, e o centroide não está definido (Σμ = 0).</p></div>';
      return;
    }
    box.innerHTML =
      `<p class="big">${f(c.z, 2)}<small>min</small></p>` +
      `<div class="calc">` +
      `<p>Tempo de irrigação recomendado pelo centroide da área agregada.</p>` +
      `<p><code>z* = Σ z(k)·μ(z(k)) / Σ μ(z(k)) = ${f(c.numerador, 6)} / ${f(c.denominador, 6)} = ${f(c.z, 6)} min</code></p>` +
      `<p class="muted">N = ${c.N.toLocaleString('pt-BR')} pontos médios com Δz = ${f(resultado.entrada.passo)}; o fator Δz se cancela no quociente.</p>` +
      `</div>`;
  }

  function renderRegistro() {
    const log = $('#log');
    if (!resultado || etapa === 0) {
      log.innerHTML = '<p class="empty muted">As etapas executadas aparecem aqui, com os valores intermediários.</p>';
      $('#log-sub').textContent = '';
      return;
    }
    const R = resultado;
    const { U, T, passo } = R.entrada;
    const blocos = [];
    const bloco = (n, titulo, itens) => blocos.push(
      `<div class="entry on"><h3><span class="eyebrow">Etapa ${n}</span> ${titulo}</h3><ul>${itens.map((x) => `<li>${x}</li>`).join('')}</ul></div>`);

    if (etapa >= 1) {
      bloco(1, 'Fuzzificação', [
        `U = ${f(U)}%: ` + F.VARIAVEIS.umidade.conjuntos.map((c) => `<code>μ<sub>${c.nome}</sub> = ${f(R.fuzz.umidade[c.id])}</code>`).join('; '),
        `T = ${f(T)} °C: ` + F.VARIAVEIS.temperatura.conjuntos.map((c) => `<code>μ<sub>${c.nome}</sub> = ${f(R.fuzz.temperatura[c.id])}</code>`).join('; '),
      ]);
    }
    if (etapa >= 2) {
      bloco(2, 'Avaliação das regras (E = mínimo)', R.regras.map((r) =>
        `${r.id}: SE ${F.nomeConjunto('umidade', r.umidade)} (${f(r.muU)}) E ${F.nomeConjunto('temperatura', r.temperatura)} (${f(r.muT)}) → <code>min(${f(r.muU)}; ${f(r.muT)}) = ${f(r.h)}</code>${r.h > 0 ? ' <b>ativada</b>' : ''}`));
    }
    if (etapa >= 3) {
      const ativas = R.regras.filter((r) => r.h > 0);
      const zero = R.regras.filter((r) => r.h === 0).map((r) => r.id);
      const itens = ativas.map((r) =>
        `${r.id}: consequente ${NOME_CONS[r.consequente]} recortado em ${f(r.h)} → <code>μ<sub>${r.id}</sub>(z) = min(${f(r.h)}; μ<sub>${NOME_CONS[r.consequente]}</sub>(z))</code>`);
      if (zero.length) itens.push(`${zero.join(', ')}: ativação zero; não contribuem para a saída.`);
      bloco(3, 'Implicação (recorte pelo mínimo)', itens);
    }
    if (etapa >= 4) {
      const ativas = R.regras.filter((r) => r.h > 0);
      const porCons = {};
      for (const r of ativas) (porCons[r.consequente] = porCons[r.consequente] || []).push(r);
      const itens = [];
      if (ativas.length) {
        itens.push(`<code>μ<sub>agregada</sub>(z) = max(${ativas.map((r) => `μ<sub>${r.id}</sub>(z)`).join(', ')})</code>`);
        for (const [cons, rs] of Object.entries(porCons)) {
          const alt = Math.max(...rs.map((r) => r.h));
          itens.push(`${NOME_CONS[cons]}: ${rs.map((r) => r.id).join(', ')} → altura ${f(alt)}${rs.length > 1 ? ' (máximo, sem somar as regras)' : ''}`);
        }
        const amostras = [0, 3, 7.5, 15, 22.5, 30];
        itens.push('Valores: ' + amostras.map((z) => `<code>μ(${f(z)}) = ${f(R.muAgregada(z), 4)}</code>`).join('; '));
      } else {
        itens.push('Nenhuma regra ativada: a área agregada é vazia.');
      }
      bloco(4, 'Agregação (máximo)', itens);
    }
    if (etapa >= 5) {
      const c = R.centroide;
      bloco(5, 'Defuzzificação (centroide por pontos médios)', c.valido ? [
        `N = 30 / ${f(passo)} = ${c.N.toLocaleString('pt-BR')}; <code>z(k) = (k + 0,5) × ${f(passo)}</code>, k = 0 … ${c.N - 1}`,
        `<code>Σ z(k)·μ(z(k)) = ${f(c.numerador, 6)}</code>; <code>Σ μ(z(k)) = ${f(c.denominador, 6)}</code>`,
        `<code>z* = ${f(c.numerador, 6)} / ${f(c.denominador, 6)} = ${f(c.z, 6)}</code> → <b>${f(c.z, 2)} min</b>`,
      ] : ['Σ μ(z(k)) = 0: não há saída agregada válida, e nenhum tempo é recomendado.']);
    }
    log.innerHTML = blocos.join('');
    $('#log-sub').textContent = `U = ${f(U)}%; T = ${f(T)} °C; Δz = ${f(passo)}`;
  }

  function renderMetricas() {
    $('#m-stage').textContent = `${etapa}/5`;
    $('#m-stage-sub').textContent = NOME_ETAPA[etapa];
    if (resultado && etapa >= 2) {
      const at = resultado.regras.filter((r) => r.h > 0);
      $('#m-rules').textContent = `${at.length} de 9`;
      $('#m-rules-sub').textContent = at.map((r) => r.id).join(', ') || 'nenhuma';
    } else { $('#m-rules').textContent = '—'; $('#m-rules-sub').textContent = ''; }
    const p = Number($('#f-step').value);
    $('#m-step').textContent = f(p);
    $('#m-step-sub').textContent = `N = ${Math.round(30 / p).toLocaleString('pt-BR')} pontos médios`;
    if (resultado && etapa >= 5) {
      const c = resultado.centroide;
      $('#m-z').textContent = c.valido ? `${f(c.z, 2)} min` : 'sem saída';
      $('#m-z-sub').textContent = c.valido ? `z* = ${f(c.z, 6)}` : 'nenhuma regra ativada';
    } else { $('#m-z').textContent = '—'; $('#m-z-sub').textContent = ''; }

    document.querySelectorAll('#stepper li').forEach((li) => {
      const s = Number(li.dataset.s);
      li.classList.toggle('done', s < etapa || (s === etapa && etapa === 5));
      li.classList.toggle('current', s === etapa && etapa < 5);
      if (s === etapa) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('#btn-step').textContent = resultado && etapa >= 5 ? 'Recomeçar etapas' : 'Avançar etapa';
  }

  function renderTudo() {
    renderMetricas();
    renderEntrada('umidade', '#c-u', '#lg-u', '#d-u');
    renderEntrada('temperatura', '#c-t', '#lg-t', '#d-t');
    renderRegras();
    renderDetalheRegra();
    renderSaida();
    renderRegistro();
  }

  function executarTestes() {
    const tests = V.runValidation();
    const ok = tests.filter((t) => t.pass).length;
    const cards = tests.map((t) => `
      <article class="test">
        <h3><span class="verdict ${t.pass ? 'ok' : 'bad'}">${t.pass ? 'passou' : 'falhou'}</span> ${t.id} · ${t.title}</h3>
        <dl><dt>entrada</dt><dd>${t.input}</dd><dt>esperado</dt><dd>${t.expected}</dd><dt>obtido</dt><dd>${t.obtained}</dd></dl>
      </article>`).join('');
    const cmp = V.comparacaoPassos();
    const linhas = cmp.linhas.map((l) => `<tr><td>${f(l.passo)}</td><td>${l.N.toLocaleString('pt-BR')}</td><td>${f(l.z, 6)}</td><td>${l.erro.toExponential(2).replace('.', ',')}</td><td>${f(l.z, 2)}</td></tr>`).join('');
    $('#tests-out').innerHTML =
      `<p class="tests-sum">${ok} de ${tests.length} testes passaram.</p><div class="tests">${cards}</div>` +
      `<h3 class="sub">Efeito do passo Δz (teste 6.3)</h3>` +
      `<div class="exp-wrap"><table class="exp"><thead><tr><th>Δz (min)</th><th>N</th><th>z* (min)</th><th>|z* − contínuo|</th><th>exibido</th></tr></thead><tbody>${linhas}</tbody></table></div>` +
      `<p>Centroide contínuo exato: ${f(cmp.continuo, 6)} min. Quanto menor o passo, mais pontos médios e menor o erro da soma em relação à integral; os três passos exibem 16,79 min porque o erro já é menor que 0,0001 min com Δz = 0,1.</p>`;
  }

  function ligarCampo(variavel, numId, rangeId) {
    const num = $(numId), rng = $(rangeId);
    num.addEventListener('input', () => {
      const v = F.validarEntrada(variavel, num.value);
      if (v.ok) rng.value = v.valor;
      aoAlterar();
    });
    rng.addEventListener('input', () => { num.value = f(Number(rng.value)); aoAlterar(); });
  }

  function init() {
    montarEditorRegras();
    preencher(F.PADRAO);
    ligarCampo('umidade', '#f-u', '#r-u');
    ligarCampo('temperatura', '#f-t', '#r-t');
    $('#f-step').addEventListener('change', aoAlterar);
    $('#btn-calc').addEventListener('click', calcular);
    $('#btn-step').addEventListener('click', avancar);
    $('#btn-reset').addEventListener('click', restaurar);
    $('#btn-tests').addEventListener('click', executarTestes);
    for (const id of ['#f-u', '#f-t']) {
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') calcular(); });
    }
    validar();
    status('Clique em Calcular para executar a inferência, ou em Avançar etapa para acompanhá-la passo a passo.');
    renderTudo();
    let raf = 0;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderTudo); }).observe($('#simulacao'));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderTudo);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderTudo);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
