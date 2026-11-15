// Variáveis e conjuntos
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

// Regras
const ANTECEDENTES = [
  ['seco', 'baixa'], ['seco', 'media'], ['seco', 'alta'],
  ['intermediario', 'baixa'], ['intermediario', 'media'], ['intermediario', 'alta'],
  ['umido', 'baixa'], ['umido', 'media'], ['umido', 'alta'],
];
const CONSEQUENTES_PADRAO = ['medio', 'longo', 'longo', 'curto', 'medio', 'longo', 'curto', 'curto', 'curto'];
const PASSOS = [0.1, 0.05, 0.01];
const PADRAO = { umidade: 35, temperatura: 30, consequentes: CONSEQUENTES_PADRAO.slice(), passo: 0.1 };

function conjunto(variavel, id) {
  return VARIAVEIS[variavel].conjuntos.find((c) => c.id === id);
}

function nomeConjunto(variavel, id) {
  return conjunto(variavel, id).nome;
}

// Função de pertinência
function pertinencia(x, pontos) {
  const [a, b, c, d] = pontos;
  if (x >= b && x <= c) return 1;
  if (x < a || x > d) return 0;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

// Fuzzificação
function fuzzificar(U, T) {
  const graus = { umidade: {}, temperatura: {} };
  for (const c of VARIAVEIS.umidade.conjuntos) graus.umidade[c.id] = pertinencia(U, c.pontos);
  for (const c of VARIAVEIS.temperatura.conjuntos) graus.temperatura[c.id] = pertinencia(T, c.pontos);
  return graus;
}

// Avaliação das regras
function avaliarRegras(fuzz, consequentes) {
  const regras = [];
  for (let i = 0; i < 9; i++) {
    const [u, t] = ANTECEDENTES[i];
    const muU = fuzz.umidade[u];
    const muT = fuzz.temperatura[t];
    regras.push({
      indice: i, id: 'R' + (i + 1), umidade: u, temperatura: t,
      muU, muT, h: Math.min(muU, muT), consequente: consequentes[i],
    });
  }
  return regras;
}

// Implicação
function implicar(regras) {
  const recortes = [];
  for (const r of regras) {
    if (r.h === 0) continue;
    const pontos = conjunto('tempo', r.consequente).pontos;
    recortes.push({ regra: r, altura: r.h, consequente: r.consequente, mu: (z) => Math.min(r.h, pertinencia(z, pontos)) });
  }
  return recortes;
}

// Agregação
function agregar(recortes) {
  return (z) => {
    let maior = 0;
    for (const r of recortes) maior = Math.max(maior, r.mu(z));
    return maior;
  };
}

// Defuzzificação
function defuzzificar(muAgregada, passo) {
  const N = Math.round(30 / passo);
  let numerador = 0;
  let denominador = 0;
  for (let k = 0; k < N; k++) {
    const z = (k + 0.5) * passo;
    const mu = muAgregada(z);
    numerador += z * mu;
    denominador += mu;
  }
  if (denominador === 0) return { valido: false, N, numerador, denominador, z: null };
  return { valido: true, N, numerador, denominador, z: numerador / denominador };
}

// Validação das entradas
function validarEntrada(variavel, valor) {
  const v = VARIAVEIS[variavel];
  const texto = String(valor).trim().replace(',', '.');
  if (texto === '') return { ok: false, erro: 'Campo vazio: informe um valor.' };
  const n = Number(texto);
  if (Number.isNaN(n)) return { ok: false, erro: 'Valor não numérico.' };
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

  const opcoes = ['curto', 'medio', 'longo'];
  const regrasOk = cfg.consequentes.length === 9 && cfg.consequentes.every((c) => opcoes.includes(c));
  if (!regrasOk) erros.consequentes = 'Todas as nove regras precisam de um consequente.';

  const passo = Number(cfg.passo);
  if (!PASSOS.includes(passo)) erros.passo = 'Escolha Δz = 0,1; 0,05 ou 0,01.';

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true, erros,
    valores: { umidade: u.valor, temperatura: t.valor, consequentes: cfg.consequentes.slice(), passo },
  };
}

// Inferência completa
function inferir(cfg) {
  const v = validarConfig(cfg);
  if (!v.ok) throw new Error('Configuração inválida.');
  const { umidade: U, temperatura: T, consequentes, passo } = v.valores;

  const fuzz = fuzzificar(U, T);
  const regras = avaliarRegras(fuzz, consequentes);
  const recortes = implicar(regras);
  const muAgregada = agregar(recortes);
  const centroide = defuzzificar(muAgregada, passo);

  return { entrada: { U, T, consequentes, passo }, fuzz, regras, recortes, muAgregada, centroide };
}

// Formatação
function fmt(x, casas) {
  if (x === null || !Number.isFinite(x)) return '—';
  if (casas !== undefined) return x.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return x.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function comUnidade(x, unidade) {
  return unidade === '%' ? fmt(x) + '%' : fmt(x) + ' ' + unidade;
}

const Fuzzy = {
  VARIAVEIS, ANTECEDENTES, CONSEQUENTES_PADRAO, PASSOS, PADRAO,
  conjunto, nomeConjunto, pertinencia, fuzzificar, avaliarRegras, implicar, agregar, defuzzificar,
  validarEntrada, validarConfig, inferir, fmt, comUnidade,
};

if (typeof module !== 'undefined') module.exports = Fuzzy;
