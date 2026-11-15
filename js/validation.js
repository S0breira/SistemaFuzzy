// Testes de validação
const Validation = (function () {
  const F = typeof Fuzzy !== 'undefined' ? Fuzzy : require('./fuzzy.js');

  const TOL_MU = 1e-6;
  const TOL_Z = 0.01;
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const f = F.fmt;
  const tupla = (obj) => `(${Object.values(obj).map((v) => f(v)).join('; ')})`;
  const cfg = (over) => Object.assign({}, F.PADRAO, { consequentes: F.CONSEQUENTES_PADRAO.slice() }, over || {});
  const nomes = { curto: 'curto', medio: 'médio', longo: 'longo' };
  const ativas = (r) => r.regras.filter((x) => x.h > 0);
  const descAtivas = (r) => ativas(r).map((x) => `${x.id} → ${nomes[x.consequente]}, h = ${f(x.h)}`).join('; ') || 'nenhuma';
  const zs = (passo) => { const out = []; for (let z = 0; z <= 30 + 1e-9; z += passo) out.push(Math.round(z * 1e6) / 1e6); return out; };

  function runValidation() {
    const tests = [];
    const add = (t) => tests.push(t);

    // 6.1 Pertinências e extremos
    {
      const fu = F.fuzzificar(35, 30);
      add({
        id: '6.1', title: 'Pertinências de U = 35% e T = 30 °C',
        input: 'U = 35%; T = 30 °C',
        expected: 'umidade (seco; intermediário; úmido) = (0,5; 0,5; 0); temperatura (baixa; média; alta) = (0; 0,5; 0,5)',
        obtained: `umidade ${tupla(fu.umidade)}; temperatura ${tupla(fu.temperatura)}`,
        pass: near(fu.umidade.seco, 0.5, TOL_MU) && near(fu.umidade.intermediario, 0.5, TOL_MU) && near(fu.umidade.umido, 0, TOL_MU) &&
          near(fu.temperatura.baixa, 0, TOL_MU) && near(fu.temperatura.media, 0.5, TOL_MU) && near(fu.temperatura.alta, 0.5, TOL_MU),
      });

      const casos = [
        ['umidade', 0, [1, 0, 0]], ['umidade', 100, [0, 0, 1]],
        ['temperatura', 10, [1, 0, 0]], ['temperatura', 40, [0, 0, 1]],
      ];
      const obt = [];
      let ok = true;
      for (const [v, x, esp] of casos) {
        const g = F.VARIAVEIS[v].conjuntos.map((c) => F.pertinencia(x, c.pontos));
        obt.push(`${F.VARIAVEIS[v].simbolo} = ${F.comUnidade(x, F.VARIAVEIS[v].unidade)}: (${g.map((y) => f(y)).join('; ')})`);
        ok = ok && g.every((y, i) => near(y, esp[i], TOL_MU));
      }
      const t = F.VARIAVEIS.tempo.conjuntos;
      const curto0 = F.pertinencia(0, t[0].pontos), longo30 = F.pertinencia(30, t[2].pontos);
      obt.push(`μcurto(0) = ${f(curto0)}; μlongo(30) = ${f(longo30)}`);
      ok = ok && curto0 === 1 && longo30 === 1;
      add({
        id: '6.1', title: 'Extremos dos domínios',
        input: 'U = 0% e 100%; T = 10 °C e 40 °C; z = 0 e 30 min',
        expected: 'U = 0%: (1; 0; 0); U = 100%: (0; 0; 1); T = 10 °C: (1; 0; 0); T = 40 °C: (0; 0; 1); μcurto(0) = 1; μlongo(30) = 1',
        obtained: obt.join('; '),
        pass: ok,
      });

      // Sem divisão por zero
      let total = 0, ruins = 0;
      for (const v of ['umidade', 'temperatura', 'tempo']) {
        const V = F.VARIAVEIS[v];
        for (let i = 0; i <= 3000; i++) {
          const x = V.min + (V.max - V.min) * i / 3000;
          for (const c of V.conjuntos) {
            const y = F.pertinencia(x, c.pontos); total++;
            if (!Number.isFinite(y) || y < 0 || y > 1) ruins++;
          }
        }
      }
      add({
        id: '6.1', title: 'Sem divisões por zero',
        input: '3.001 pontos uniformes em cada domínio, nos 9 conjuntos',
        expected: 'todos os graus finitos e entre 0 e 1',
        obtained: `${total.toLocaleString('pt-BR')} graus calculados; ${ruins} fora de [0, 1] ou não finitos`,
        pass: ruins === 0,
      });
    }

    // 6.2 Ativação de uma única regra
    {
      const casos = [
        { U: 20, T: 35, regra: 'R3', cons: 'longo', z: 25, aprox: true },
        { U: 50, T: 25, regra: 'R5', cons: 'medio', z: 15, aprox: false },
        { U: 80, T: 25, regra: 'R8', cons: 'curto', z: 5, aprox: true },
      ];
      for (const c of casos) {
        const r = F.inferir(cfg({ umidade: c.U, temperatura: c.T }));
        const at = ativas(r);
        const pts = F.conjunto('tempo', c.cons).pontos;
        const igual = zs(0.01).every((z) => near(r.muAgregada(z), F.pertinencia(z, pts), TOL_MU));
        add({
          id: '6.2', title: `Só ${c.regra} ativa (U = ${c.U}%, T = ${c.T} °C)`,
          input: `U = ${c.U}%; T = ${c.T} °C; base padrão; Δz = 0,1`,
          expected: `somente ${c.regra} com h = 1; agregada = conjunto ${nomes[c.cons]} completo; tempo ${c.aprox ? '≈ ' : ''}${f(c.z, 2)} min`,
          obtained: `ativas: ${descAtivas(r)}; agregada ${igual ? 'igual ao' : 'diferente do'} conjunto ${nomes[c.cons]}; tempo ${f(r.centroide.z, 6)} min (exibido ${f(r.centroide.z, 2)})`,
          pass: at.length === 1 && at[0].id === c.regra && at[0].h === 1 && igual && near(r.centroide.z, c.z, TOL_Z),
        });
      }
    }

    // 6.3 Inferência completa com sobreposição
    {
      const r = F.inferir(cfg());
      const at = ativas(r);
      const esperadas = { R2: 'longo', R3: 'longo', R5: 'medio', R6: 'longo' };
      const regrasOk = at.length === 4 && at.every((x) => esperadas[x.id] === x.consequente && near(x.h, 0.5, TOL_MU));
      add({
        id: '6.3', title: 'Fuzzificação e regras ativadas',
        input: 'U = 35%; T = 30 °C; base padrão; Δz = 0,1',
        expected: 'seco 0,5; intermediário 0,5; úmido 0; baixa 0; média 0,5; alta 0,5. R2 → longo, R3 → longo, R5 → médio, R6 → longo, todas com h = 0,5; demais com h = 0',
        obtained: `umidade ${tupla(r.fuzz.umidade)}; temperatura ${tupla(r.fuzz.temperatura)}; ${descAtivas(r)}`,
        pass: regrasOk,
      });

      const pontos = [[0, 0], [3, 0.2], [7.5, 0.5], [15, 0.5], [30, 0.5]];
      let formaOk = pontos.every(([z, m]) => near(r.muAgregada(z), m, TOL_MU));
      for (const z of zs(0.01)) {
        const esp = z <= 7.5 ? z / 15 : 0.5;
        if (!near(r.muAgregada(z), esp, TOL_MU)) formaOk = false;
      }
      const maxLongo = Math.max(...zs(0.01).map((z) => r.muAgregada(z)));
      add({
        id: '6.3', title: 'Implicação e agregação',
        input: 'recortes de médio e longo em 0,5; máximo entre os recortes',
        expected: 'μ(z) = z/15 em [0; 7,5] e 0,5 em [7,5; 30]; μ(0) = 0; μ(3) = 0,2; μ(7,5) = 0,5; μ(15) = 0,5; μ(30) = 0,5; altura máxima 0,5',
        obtained: pontos.map(([z]) => `μ(${f(z)}) = ${f(r.muAgregada(z))}`).join('; ') + `; altura máxima ${f(maxLongo)}; forma conferida em 3.001 pontos`,
        pass: formaOk && near(maxLongo, 0.5, TOL_MU),
      });

      add({
        id: '6.3', title: 'Centroide',
        input: 'pontos médios, Δz = 0,1 (N = 300)',
        expected: '≈ 16,785683 min (contínuo: 16,785714); exibição 16,79 min',
        obtained: `${f(r.centroide.z, 6)} min; exibição ${f(r.centroide.z, 2)} min`,
        pass: near(r.centroide.z, 16.785683, 1e-5) && f(r.centroide.z, 2) === '16,79',
      });
    }

    // 6.4 Simetria, alteração de regras e precisão
    {
      const r = F.inferir(cfg({ temperatura: 20 }));
      const at = ativas(r);
      const constante = zs(0.01).every((z) => near(r.muAgregada(z), 0.5, TOL_MU));
      add({
        id: '6.4', title: 'Simetria (U = 35%, T = 20 °C)',
        input: 'U = 35%; T = 20 °C; base padrão; Δz = 0,1',
        expected: 'R1, R2, R4 e R5 com h = 0,5; agregada constante em 0,5 de 0 a 30; tempo 15,00 min',
        obtained: `${descAtivas(r)}; agregada ${constante ? 'constante em 0,5' : 'não constante'}; tempo ${f(r.centroide.z, 6)} min`,
        pass: at.map((x) => x.id).join() === 'R1,R2,R4,R5' && at.every((x) => near(x.h, 0.5, TOL_MU)) && constante && near(r.centroide.z, 15, TOL_Z),
      });

      const todasCurto = Array(9).fill('curto');
      const r2 = F.inferir(cfg({ umidade: 50, temperatura: 25, consequentes: todasCurto }));
      add({
        id: '6.4', title: 'Todas as regras com consequente curto',
        input: 'U = 50%; T = 25 °C; R1 a R9 → curto; Δz = 0,1',
        expected: 'tempo ≈ 5,00 min',
        obtained: `${descAtivas(r2)}; tempo ${f(r2.centroide.z, 6)} min (exibido ${f(r2.centroide.z, 2)})`,
        pass: near(r2.centroide.z, 5, TOL_Z),
      });

      const r3 = F.inferir(cfg());
      add({
        id: '6.4', title: 'Configuração padrão após restaurar',
        input: 'U = 35%; T = 30 °C; base padrão; Δz = 0,1',
        expected: `entradas 35% e 30 °C; regras ${F.CONSEQUENTES_PADRAO.map((c) => nomes[c]).join(', ')}; tempo 16,79 min`,
        obtained: `entradas ${f(F.PADRAO.umidade)}% e ${f(F.PADRAO.temperatura)} °C; regras ${F.PADRAO.consequentes.map((c) => nomes[c]).join(', ')}; tempo ${f(r3.centroide.z, 2)} min`,
        pass: F.PADRAO.umidade === 35 && F.PADRAO.temperatura === 30 && F.PADRAO.passo === 0.1 &&
          F.PADRAO.consequentes.join() === F.CONSEQUENTES_PADRAO.join() && f(r3.centroide.z, 2) === '16,79',
      });

      const passos = comparacaoPassos();
      const esp = { 0.1: 16.785683, 0.05: 16.785706, 0.01: 16.785714 };
      add({
        id: '6.4', title: 'Efeito do passo Δz',
        input: 'teste 6.3 com Δz = 0,1; 0,05 e 0,01',
        expected: '≈ 16,785683; 16,785706 e 16,785714 min',
        obtained: passos.linhas.map((l) => `Δz = ${f(l.passo)}: ${f(l.z, 6)} (erro ${l.erro.toExponential(2).replace('.', ',')})`).join('; '),
        pass: passos.linhas.every((l) => near(l.z, esp[l.passo], 1e-5)) &&
          passos.linhas[0].erro > passos.linhas[1].erro && passos.linhas[1].erro > passos.linhas[2].erro,
      });
    }

    // 6.5 Validação da interface e determinismo
    {
      const casos = [
        ['umidade', '-1'], ['umidade', '101'], ['temperatura', '9'], ['temperatura', '41'],
        ['umidade', ''], ['temperatura', '   '], ['umidade', 'abc'], ['temperatura', '30 graus'],
        ['umidade', 'NaN'], ['temperatura', 'Infinity'], ['umidade', Infinity], ['temperatura', NaN],
      ];
      const res = casos.map(([v, x]) => [v, x, F.validarEntrada(v, x)]);
      let bloqueiaInferir = true;
      try { F.inferir(cfg({ umidade: 101 })); bloqueiaInferir = false; } catch (e) { }
      add({
        id: '6.5', title: 'Entradas inválidas bloqueiam o cálculo',
        input: 'U = −1, 101, vazio, “abc”, “NaN”, Infinity; T = 9, 41, espaços, “30 graus”, “Infinity”, NaN',
        expected: 'todas rejeitadas com mensagem, sem correção para o limite',
        obtained: res.map(([v, x, r]) => `${v === 'umidade' ? 'U' : 'T'} = ${JSON.stringify(String(x))}: ${r.ok ? 'aceita' : r.erro}`).join('; ') +
          (bloqueiaInferir ? '; inferência recusada' : '; inferência executada'),
        pass: res.every(([, , r]) => !r.ok) && bloqueiaInferir,
      });

      const validos = [['umidade', '0'], ['umidade', '100'], ['temperatura', '10'], ['temperatura', '40'], ['umidade', '35,5'], ['temperatura', '22.25']];
      const rv = validos.map(([v, x]) => [v, x, F.validarEntrada(v, x)]);
      add({
        id: '6.5', title: 'Limites e decimais aceitos',
        input: 'U = 0, 100, “35,5”; T = 10, 40, “22.25”',
        expected: 'todos aceitos com o valor digitado',
        obtained: rv.map(([v, x, r]) => `${v === 'umidade' ? 'U' : 'T'} = ${x}: ${r.ok ? f(r.valor) : r.erro}`).join('; '),
        pass: rv.every(([, x, r]) => r.ok && r.valor === Number(x.replace(',', '.'))),
      });

      // Determinismo
      const c = cfg({ umidade: 42.7, temperatura: 27.3, passo: 0.05 });
      const a = F.inferir(c), b = F.inferir(c);
      const fz = F.fuzzificar(42.7, 27.3);
      const rg = F.avaliarRegras(fz, c.consequentes);
      const rc = F.implicar(rg);
      const ag = F.agregar(rc);
      const df = F.defuzzificar(ag, 0.05);
      const mesmasRegras = a.regras.every((x, i) => x.h === b.regras[i].h && x.h === rg[i].h);
      const mesmaArea = zs(0.05).every((z) => a.muAgregada(z) === b.muAgregada(z) && a.muAgregada(z) === ag(z));
      add({
        id: '6.5', title: 'Determinismo e cálculo por etapas',
        input: 'U = 42,7%; T = 27,3 °C; Δz = 0,05; inferência completa duas vezes e etapa por etapa',
        expected: 'mesmos graus, ativações, área agregada e tempo final nas três execuções',
        obtained: `tempo ${f(a.centroide.z, 6)} / ${f(b.centroide.z, 6)} / ${f(df.z, 6)} min; ativações ${mesmasRegras ? 'iguais' : 'diferentes'}; área ${mesmaArea ? 'igual' : 'diferente'}`,
        pass: a.centroide.z === b.centroide.z && a.centroide.z === df.z && mesmasRegras && mesmaArea &&
          JSON.stringify(a.fuzz) === JSON.stringify(fz),
      });

      // Saída vazia
      const d = F.defuzzificar(() => 0, 0.1);
      add({
        id: '2.3', title: 'Saída agregada vazia',
        input: 'agregação identicamente nula (situação forçada)',
        expected: 'informar que não há saída válida, sem retornar 0 nem número indefinido',
        obtained: d.valido ? `retornou ${d.z}` : `válido = false; z = ${d.z}`,
        pass: !d.valido && d.z === null,
      });
    }

    return tests;
  }

  function comparacaoPassos() {
    // Centroide exato do teste 6.3
    const continuo = 117.5 / 7;
    const linhas = F.PASSOS.map((passo) => {
      const r = F.inferir(cfg({ passo }));
      return { passo, N: r.centroide.N, z: r.centroide.z, erro: Math.abs(r.centroide.z - continuo) };
    });
    return { continuo, linhas };
  }

  return { runValidation, comparacaoPassos, TOL_MU, TOL_Z };
})();

if (typeof module !== 'undefined') module.exports = Validation;
