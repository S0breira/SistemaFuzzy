// Executa os testes de validação no Node: node tests/run-tests.js
const F = require('../js/fuzzy.js');
const V = require('../js/validation.js');

const tests = V.runValidation();
let ok = 0;
for (const t of tests) {
  if (t.pass) ok++;
  console.log(`[${t.pass ? 'OK' : 'FALHOU'}] ${t.id} ${t.title}`);
  console.log(`   entrada:  ${t.input}`);
  console.log(`   esperado: ${t.expected}`);
  console.log(`   obtido:   ${t.obtained}`);
}
console.log(`\n${ok}/${tests.length} testes aprovados\n`);

const cmp = V.comparacaoPassos();
console.log(`Centroide contínuo (exato): ${cmp.continuo.toFixed(6)} min`);
for (const l of cmp.linhas) {
  console.log(`Δz = ${l.passo}: N = ${l.N}; z* = ${l.z.toFixed(6)} min; erro = ${l.erro.toExponential(3)}; exibido ${F.fmt(l.z, 2)}`);
}
process.exit(ok === tests.length ? 0 : 1);
