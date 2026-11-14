/*
 * Núcleo do sistema fuzzy Mamdani: funções de pertinência, regras, inferência e centroide.
 * Não depende do navegador: é usado pela página (window.Fuzzy) e pelos testes no Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fuzzy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Variáveis e conjuntos (seção 2.1) ---------- */

  const VARIAVEIS = {
    umidade: {
      nome: 'Umidade do solo', simbolo: 'U', unidade: '%', min: 0, max: 100,
      conjuntos: [
        { id: 'seco', nome: 'seco', pontos: [0, 0, 20, 50] },
        { id: 'intermediario', nome: 'intermediário', pontos: [20, 50, 50, 80] },
        { id: 'umido', nome: 'úmido', pontos: [50, 80, 100, 100] },
      ],
    },
    temperatura: {
      nome: 'Temperatura', simbolo: 'T', unidade: '°C', min: 10, max: 40,
      conjuntos: [
        { id: 'baixa', nome: 'baixa', pontos: [10, 10, 15, 25] },
        { id: 'media', nome: 'média', pontos: [15, 25, 25, 35] },
        { id: 'alta', nome: 'alta', pontos: [25, 35, 40, 40] },
      ],
    },
    tempo: {
      nome: 'Tempo de irrigação', simbolo: 'z', unidade: 'min', min: 0, max: 30,
      conjuntos: [
        { id: 'curto', nome: 'curto', pontos: [0, 0, 0, 15] },
        { id: 'medio', nome: 'médio', pontos: [0, 15, 15, 30] },
        { id: 'longo', nome: 'longo', pontos: [15, 30, 30, 30] },
      ],
    },
  };

  /* ---------- Base de regras padrão (seção 2.2) ---------- */
  // Os antecedentes são fixos; só o consequente de cada regra pode ser alterado.
  const ANTECEDENTES = [
    ['seco', 'baixa'], ['seco', 'media'], ['seco', 'alta'],
    ['intermediario', 'baixa'], ['intermediario', 'media'], ['intermediario', 'alta'],
    ['umido', 'baixa'], ['umido', 'media'], ['umido', 'alta'],
  ];
  const CONSEQUENTES_PADRAO = ['medio', 'longo', 'longo', 'curto', 'medio', 'longo', 'curto', 'curto', 'curto'];
  const PASSOS = [0.1, 0.05, 0.01];
  const PADRAO = { umidade: 35, temperatura: 30, consequentes: CONSEQUENTES_PADRAO.slice(), passo: 0.1 };

  function conjunto(variavel, id) {
    const c = VARIAVEIS[variavel].conjuntos.find((s) => s.id === id);
    if (!c) throw new Error(`Conjunto desconhecido: ${variavel}.${id}`);
    return c;
  }
  const nomeConjunto = (variavel, id) => conjunto(variavel, id).nome;

  /* ---------- Função de pertinência linear por partes (a, b, c, d) ---------- */
  // Ordem exigida: primeiro o trecho igual a 1, depois fora do suporte, depois as rampas.
  // Uma rampa com a = b (ou c = d) tem intervalo vazio e nunca chega a dividir por zero.
  function pertinencia(x, pontos) {
    const [a, b, c, d] = pontos;
    if (x >= b && x <= c) return 1;
    if (x < a || x > d) return 0;
    if (x >= a && x < b) return (x - a) / (b - a); // aqui a < b, pois x ∈ [a, b)
    if (x > c && x <= d) return (d - x) / (d - c); // aqui c < d, pois x ∈ (c, d]
    return 0;
  }

  /* ---------- Etapa 1: fuzzificação ---------- */
  function fuzzificar(U, T) {
    const graus = (variavel, x) => {
      const out = {};
      for (const c of VARIAVEIS[variavel].conjuntos) out[c.id] = pertinencia(x, c.pontos);
      return out;
    };
    return { umidade: graus('umidade', U), temperatura: graus('temperatura', T) };
  }

  /* ---------- Etapa 2: avaliação das regras (E = mínimo) ---------- */
  function avaliarRegras(fuzz, consequentes) {
    return ANTECEDENTES.map(([u, t], i) => {
      const muU = fuzz.umidade[u];
      const muT = fuzz.temperatura[t];
      return {
        indice: i, id: `R${i + 1}`, umidade: u, temperatura: t,
        muU, muT, h: Math.min(muU, muT), consequente: consequentes[i],
      };
    });
  }

  /* ---------- Etapa 3: implicação (recorte pelo mínimo) ---------- */
  function recorte(regra, z) {
    return Math.min(regra.h, pertinencia(z, conjunto('tempo', regra.consequente).pontos));
  }
  function implicar(regras) {
    // Regras com ativação zero não contribuem para a saída.
    return regras.filter((r) => r.h > 0).map((r) => ({
      regra: r, altura: r.h, consequente: r.consequente,
      mu: (z) => recorte(r, z),
    }));
  }

  /* ---------- Etapa 4: agregação (máximo) ---------- */
  function agregar(recortes) {
    return (z) => {
      let m = 0;
      for (const r of recortes) { const v = r.mu(z); if (v > m) m = v; }
      return m;
    };
  }

  /* ---------- Etapa 5: defuzzificação pelo centroide (pontos médios) ---------- */
  function defuzzificar(muAgregada, passo) {
    const { min, max } = VARIAVEIS.tempo;
    const N = Math.round((max - min) / passo);
    let num = 0, den = 0;
    for (let k = 0; k < N; k++) {
      const z = min + (k + 0.5) * passo;
      const mu = muAgregada(z);
      num += z * mu;
      den += mu;
    }
    if (den === 0) return { valido: false, N, numerador: num, denominador: den, z: null };
    return { valido: true, N, numerador: num, denominador: den, z: num / den };
  }

  /* ---------- Validação das entradas ---------- */
  // Aceita número (ou texto com vírgula/ponto). Não corrige para o limite mais próximo.
  function lerNumero(valor) {
    if (typeof valor === 'number') return valor;
    const s = String(valor == null ? '' : valor).trim();
    if (s === '') return { erro: 'Campo vazio: informe um valor.' };
    if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return { erro: 'Valor não numérico.' };
    return Number(s.replace(',', '.'));
  }
  function validarEntrada(variavel, valor) {
    const v = VARIAVEIS[variavel];
    const n = lerNumero(valor);
    if (typeof n === 'object') return { ok: false, erro: n.erro };
    if (!Number.isFinite(n)) return { ok: false, erro: 'Valor não finito.' };
    if (n < v.min || n > v.max) {
      return { ok: false, erro: `Fora do intervalo: use de ${comUnidade(v.min, v.unidade)} a ${comUnidade(v.max, v.unidade)}.` };
    }
    return { ok: true, valor: n };
  }
  function validarConfig(cfg) {
    const erros = {};
    const u = validarEntrada('umidade', cfg.umidade);
    const t = validarEntrada('temperatura', cfg.temperatura);
    if (!u.ok) erros.umidade = u.erro;
    if (!t.ok) erros.temperatura = t.erro;
    const ids = VARIAVEIS.tempo.conjuntos.map((c) => c.id);
    if (!Array.isArray(cfg.consequentes) || cfg.consequentes.length !== 9 || !cfg.consequentes.every((c) => ids.includes(c))) {
      erros.consequentes = 'Todas as nove regras precisam de um consequente (curto, médio ou longo).';
    }
    if (!PASSOS.includes(Number(cfg.passo))) erros.passo = 'Escolha Δz = 0,1; 0,05 ou 0,01 minuto.';
    const ok = Object.keys(erros).length === 0;
    return ok
      ? { ok, erros, valores: { umidade: u.valor, temperatura: t.valor, consequentes: cfg.consequentes.slice(), passo: Number(cfg.passo) } }
      : { ok, erros };
  }

  /* ---------- Inferência completa ---------- */
  // Calcula as cinco etapas de uma vez. "Calcular" e "Avançar etapa" mostram o mesmo resultado.
  function inferir(cfg) {
    const v = validarConfig(cfg);
    if (!v.ok) throw new Error('Configuração inválida: ' + Object.values(v.erros).join(' '));
    const { umidade: U, temperatura: T, consequentes, passo } = v.valores;
    const fuzz = fuzzificar(U, T);
    const regras = avaliarRegras(fuzz, consequentes);
    const recortes = implicar(regras);
    const muAgregada = agregar(recortes);
    const centroide = defuzzificar(muAgregada, passo);
    return { entrada: { U, T, consequentes, passo }, fuzz, regras, recortes, muAgregada, centroide };
  }

  // Centroide contínuo exato da agregação (integração analítica em cada trecho linear),
  // usado apenas como referência para comparar com o método numérico.
  function centroideContinuo(muAgregada) {
    const { min, max } = VARIAVEIS.tempo;
    // A agregação é linear por partes; com subdivisão fina e regra de Simpson o erro é desprezível.
    const n = 300000, h = (max - min) / n;
    let num = 0, den = 0;
    for (let i = 0; i <= n; i++) {
      const z = min + i * h;
      const w = i === 0 || i === n ? 1 : (i % 2 ? 4 : 2);
      const mu = muAgregada(z);
      num += w * z * mu; den += w * mu;
    }
    return den === 0 ? null : num / den;
  }

  /* ---------- Formatação pt-BR ---------- */
  function fmt(x, casas) {
    if (x == null || !Number.isFinite(x)) return '—';
    if (casas != null) return x.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    return x.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  }
  // "35%" sem espaço; "30 °C" e "15 min" com espaço.
  const comUnidade = (x, unidade) => (unidade === '%' ? `${fmt(x)}%` : `${fmt(x)} ${unidade}`);

  return {
    VARIAVEIS, ANTECEDENTES, CONSEQUENTES_PADRAO, PASSOS, PADRAO,
    conjunto, nomeConjunto, pertinencia, fuzzificar, avaliarRegras, implicar, agregar, defuzzificar,
    lerNumero, validarEntrada, validarConfig, inferir, centroideContinuo, fmt, comUnidade,
  };
});
