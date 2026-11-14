# Tempo de irrigação por sistema fuzzy Mamdani

Simulador de um sistema fuzzy Mamdani que recomenda o tempo de irrigação de um jardim a partir da umidade do solo e da temperatura do ambiente. Atividade prática da disciplina de Inteligência Artificial, UFPI, período 2026.2.

- **Aplicação:** https://s0breira.github.io/SistemaFuzzy/
- **Repositório:** https://github.com/S0breira/SistemaFuzzy

## Autores

- João Gabriel Nunes Oliveira Lima
- Mayra Gabriela Sousa da Silva
- Arthur Sobreira Alexandrino

## Como usar

Abra o link da aplicação; não há login nem instalação. Para rodar no computador, abra o `index.html` no navegador ou, dentro da pasta do projeto, rode `python -m http.server 8000` e acesse `http://localhost:8000`.

1. A tela abre com a configuração padrão: U = 35%, T = 30 °C, a base de regras da seção 2.2 e Δz = 0,1 minuto.
2. Ajuste a umidade e a temperatura pelo campo numérico ou pelo controle deslizante, troque o consequente de qualquer regra (curto, médio ou longo) e escolha o passo Δz.
3. **Calcular** executa as cinco etapas de uma vez e mostra o tempo recomendado.
4. **Avançar etapa** mostra uma etapa por clique, na ordem: fuzzificação, avaliação das regras, implicação, agregação e defuzzificação. Os gráficos, a tabela de regras, as métricas e o registro mostram só o que já foi executado. Depois da quinta etapa, o botão passa a **Recomeçar etapas**.
5. **Restaurar padrão** repõe entradas, regras e passo iniciais e apaga os resultados.
6. Qualquer alteração (entrada, regra ou passo) apaga o resultado anterior e reinicia a sequência de etapas. Campos vazios, valores não numéricos, não finitos ou fora do intervalo ficam destacados com a mensagem do problema, e os botões de cálculo ficam bloqueados. O valor nunca é corrigido sozinho para o limite mais próximo.
7. Na tabela de regras, clique numa regra para ver o consequente original (tracejado) e o recorte produzido pela implicação.
8. **Executar testes**, no fim da página, roda os testes de validação da seção 6.

Para rodar os testes no terminal (precisa do Node.js): `node tests/run-tests.js`.

## O modelo

### Variáveis e conjuntos

Todas as funções de pertinência são lineares por partes, descritas por quatro pontos (a, b, c, d).

| Variável | Domínio | Conjuntos (a, b, c, d) |
|---|---|---|
| Umidade do solo U | 0% a 100% | seco = (0, 0, 20, 50); intermediário = (20, 50, 50, 80); úmido = (50, 80, 100, 100) |
| Temperatura T | 10 °C a 40 °C | baixa = (10, 10, 15, 25); média = (15, 25, 25, 35); alta = (25, 35, 40, 40) |
| Tempo de irrigação z | 0 a 30 min | curto = (0, 0, 0, 15); médio = (0, 15, 15, 30); longo = (15, 30, 30, 30) |

A função `pertinencia(x, [a, b, c, d])` (em `js/fuzzy.js`) avalia, nesta ordem:

1. se b ≤ x ≤ c, μ(x) = 1;
2. se x < a ou x > d, μ(x) = 0;
3. na subida (a ≤ x < b), μ(x) = (x − a)/(b − a);
4. na descida (c < x ≤ d), μ(x) = (d − x)/(d − c).

Como o trecho igual a 1 é testado primeiro, os extremos ficam corretos (μseco(0) = 1, μlongo(30) = 1) e uma rampa vazia (a = b ou c = d) nunca chega a ser calculada, então não há divisão por zero.

### Base de regras padrão

Os antecedentes são fixos; na tela, só o consequente de cada regra pode ser trocado.

| Regra | SE umidade | E temperatura | ENTÃO tempo |
|---|---|---|---|
| R1 | seco | baixa | médio |
| R2 | seco | média | longo |
| R3 | seco | alta | longo |
| R4 | intermediário | baixa | curto |
| R5 | intermediário | média | médio |
| R6 | intermediário | alta | longo |
| R7 | úmido | baixa | curto |
| R8 | úmido | média | curto |
| R9 | úmido | alta | curto |

### As cinco etapas

1. **Fuzzificação.** Calcula os três graus de pertinência de U e os três de T. Um grau indica a compatibilidade do valor com o termo linguístico; não é uma probabilidade, e os graus não precisam somar 1.
2. **Avaliação das regras.** O operador E é o mínimo: h(r) = min(μumidade(U), μtemperatura(T)), com os conjuntos citados nos antecedentes da regra.
3. **Implicação.** O consequente de cada regra é recortado na altura h(r): μr(z) = min(h(r), μconsequente(z)). Regras com h(r) = 0 não contribuem.
4. **Agregação.** Para cada z, μagregada(z) = max(μ1(z), …, μ9(z)). As áreas não são somadas: se três regras concluem "longo" com h = 0,5, a altura de "longo" continua 0,5.
5. **Defuzzificação.** Centroide numérico por pontos médios: N = 30/Δz, z(k) = (k + 0,5)·Δz para k = 0 … N − 1, e z* = Σ z(k)·μagregada(z(k)) / Σ μagregada(z(k)). O fator Δz se cancela no quociente. Se o denominador for zero, a tela informa que não há saída agregada válida, sem mostrar 0 nem um número indefinido. A precisão interna é mantida, e o arredondamento para duas casas é feito só na exibição.

"Calcular" e "Avançar etapa" usam a mesma função `inferir`, que calcula as cinco etapas de uma vez; o avanço por etapas só controla o que é mostrado. Por isso os dois caminhos dão exatamente o mesmo resultado, e mudanças na apresentação não alteram os cálculos.

### Visualização

- **Entradas:** gráficos dos três conjuntos de umidade e dos três de temperatura, com eixo horizontal na unidade da variável, eixo vertical de 0 a 1, linha vertical no valor informado e tabela com os seis graus, inclusive os iguais a zero.
- **Regras:** tabela com a base completa; as regras ativadas ficam destacadas, com os graus dos antecedentes, a operação mínimo e h(r). Para a regra selecionada, um gráfico mostra o consequente original (tracejado) e o recorte da implicação (preenchido).
- **Saída:** conjuntos curto, médio e longo; os recortes das regras ativadas (etapa 3); a área agregada preenchida (etapa 4); a linha vertical do centroide e o tempo recomendado com duas casas decimais (etapa 5).
- **Registro das etapas:** os valores intermediários de cada etapa em texto, por exemplo “R2: min(0,5; 0,5) = 0,5; consequente longo recortado em 0,5”.

### Estrutura dos arquivos

```
index.html            interface
css/style.css         estilos (tema claro e escuro)
js/fuzzy.js           núcleo: pertinência, fuzzificação, regras, implicação, agregação, centroide e validação das entradas
js/validation.js      testes de validação, usados pela página e pelo Node
js/app.js             campos, etapas, gráficos (canvas), registro e testes na tela
tests/run-tests.js    executa os testes no terminal
```

### Tecnologias e bibliotecas

HTML, CSS e JavaScript puros, executados no navegador, sem servidor de aplicação. **Nenhuma biblioteca foi usada:** a inferência Mamdani, os gráficos (desenhados em `<canvas>`) e a interface foram escritos para este trabalho. A página carrega apenas as fontes Geist e Geist Mono do Google Fonts; sem conexão, o navegador usa fontes do sistema.

O visual segue o mesmo sistema usado no trabalho de algoritmo genético do grupo ([AlgoritmoGenetico](https://github.com/joaognx/AlgoritmoGenetico)), baseado no sistema de design da Vercel publicado no repositório [awesome-design-md](https://github.com/voltagent/awesome-design-md). Nenhum código de terceiros faz parte do projeto.

## Resultados dos testes

Os testes foram executados no navegador (botão “Executar testes”) e podem ser repetidos com `node tests/run-tests.js`. Salvo indicação contrária, usam a base padrão e Δz = 0,1 minuto. Tolerâncias do enunciado: 0,000001 para pertinências e ativações e 0,01 minuto para os tempos de referência.

| Seção | Teste | Entrada | Esperado | Obtido | Resultado |
|---|---|---|---|---|---|
| 6.1 | Pertinências de U = 35% e T = 30 °C | U = 35%; T = 30 °C | umidade (seco; intermediário; úmido) = (0,5; 0,5; 0); temperatura (baixa; média; alta) = (0; 0,5; 0,5) | umidade (0,5; 0,5; 0); temperatura (0; 0,5; 0,5) | ✅ passou |
| 6.1 | Extremos dos domínios | U = 0% e 100%; T = 10 °C e 40 °C; z = 0 e 30 min | U = 0%: (1; 0; 0); U = 100%: (0; 0; 1); T = 10 °C: (1; 0; 0); T = 40 °C: (0; 0; 1); μcurto(0) = 1; μlongo(30) = 1 | U = 0%: (1; 0; 0); U = 100%: (0; 0; 1); T = 10 °C: (1; 0; 0); T = 40 °C: (0; 0; 1); μcurto(0) = 1; μlongo(30) = 1 | ✅ passou |
| 6.1 | Sem divisões por zero | 3.001 pontos uniformes em cada domínio, nos 9 conjuntos | todos os graus finitos e entre 0 e 1 | 27.009 graus calculados; 0 fora de [0, 1] ou não finitos | ✅ passou |
| 6.2 | Só R3 ativa | U = 20%; T = 35 °C | somente R3 com h = 1; agregada = conjunto longo completo; tempo ≈ 25,00 min | R3 → longo, h = 1; agregada igual ao conjunto longo; 24,999889 min (exibido 25,00) | ✅ passou |
| 6.2 | Só R5 ativa | U = 50%; T = 25 °C | somente R5 com h = 1; agregada = conjunto médio completo; tempo 15,00 min | R5 → médio, h = 1; agregada igual ao conjunto médio; 15,000000 min (exibido 15,00) | ✅ passou |
| 6.2 | Só R8 ativa | U = 80%; T = 25 °C | somente R8 com h = 1; agregada = conjunto curto completo; tempo ≈ 5,00 min | R8 → curto, h = 1; agregada igual ao conjunto curto; 5,000111 min (exibido 5,00) | ✅ passou |
| 6.3 | Fuzzificação e regras ativadas | U = 35%; T = 30 °C | seco 0,5; intermediário 0,5; úmido 0; baixa 0; média 0,5; alta 0,5. R2 → longo, R3 → longo, R5 → médio, R6 → longo, com h = 0,5; demais com h = 0 | umidade (0,5; 0,5; 0); temperatura (0; 0,5; 0,5); R2 → longo, h = 0,5; R3 → longo, h = 0,5; R5 → médio, h = 0,5; R6 → longo, h = 0,5 | ✅ passou |
| 6.3 | Implicação e agregação | recortes de médio e longo em 0,5; máximo entre os recortes | μ(z) = z/15 em [0; 7,5] e 0,5 em [7,5; 30]; μ(0) = 0; μ(3) = 0,2; μ(7,5) = 0,5; μ(15) = 0,5; μ(30) = 0,5 | μ(0) = 0; μ(3) = 0,2; μ(7,5) = 0,5; μ(15) = 0,5; μ(30) = 0,5; altura máxima 0,5; forma conferida em 3.001 pontos | ✅ passou |
| 6.3 | Centroide | pontos médios, Δz = 0,1 (N = 300) | ≈ 16,785683 min; exibição 16,79 min | Σ z·μ = 2.203,120833; Σ μ = 131,25; z* = 16,785683 min; exibição 16,79 min | ✅ passou |
| 6.4 | Simetria | U = 35%; T = 20 °C | R1, R2, R4 e R5 com h = 0,5; agregada constante em 0,5; tempo 15,00 min | R1 → médio, R2 → longo, R4 → curto, R5 → médio, todas com h = 0,5; agregada constante em 0,5; 15,000000 min | ✅ passou |
| 6.4 | Todas as regras com consequente curto | U = 50%; T = 25 °C; R1 a R9 → curto | tempo ≈ 5,00 min | R5 → curto, h = 1; 5,000111 min (exibido 5,00) | ✅ passou |
| 6.4 | Restaurar padrão | botão Restaurar padrão e novo cálculo | entradas 35% e 30 °C; base da seção 2.2; Δz = 0,1; tempo 16,79 min | entradas 35% e 30 °C; regras médio, longo, longo, curto, médio, longo, curto, curto, curto; Δz = 0,1; 16,79 min | ✅ passou |
| 6.4 | Efeito do passo Δz | teste 6.3 com Δz = 0,1; 0,05 e 0,01 | ≈ 16,785683; 16,785706 e 16,785714 min | 16,785683; 16,785706 e 16,785714 min | ✅ passou |
| 6.5 | Entradas inválidas bloqueiam o cálculo | U = −1, 101, vazio, “abc”, “NaN”, Infinity; T = 9, 41, espaços, “30 graus”, “Infinity”, NaN | todas rejeitadas com mensagem, sem correção para o limite | todas rejeitadas (“Fora do intervalo”, “Campo vazio”, “Valor não numérico” ou “Valor não finito”); a inferência é recusada e o campo mantém o valor digitado | ✅ passou |
| 6.5 | Limites e decimais aceitos | U = 0, 100, “35,5”; T = 10, 40, “22.25” | todos aceitos com o valor digitado | 0; 100; 35,5; 10; 40; 22,25 | ✅ passou |
| 6.5 | Determinismo e cálculo por etapas | U = 42,7%; T = 27,3 °C; Δz = 0,05; inferência completa duas vezes e etapa por etapa | mesmos graus, ativações, área agregada e tempo | 15,420509 min nas três execuções; ativações e área agregada idênticas | ✅ passou |
| 2.3 | Saída agregada vazia | agregação nula (situação forçada) | informar que não há saída válida, sem retornar 0 nem número indefinido | válido = falso; z = null; a tela mostra “não há saída agregada válida” | ✅ passou |

Os testes de interface também foram feitos na própria página: alterar U depois de calcular apaga o resultado e volta à etapa 0; Avançar etapa mostra 1/5 a 5/5 e termina em 16,79 min, o mesmo valor de Calcular; os valores inválidos da seção 6.5 desativam Calcular e Avançar etapa e mostram a mensagem abaixo do campo; com as nove regras em curto, U = 50% e T = 25 °C, a tela mostra 5,00 min; Restaurar padrão volta para 35%, 30 °C, a base padrão e Δz = 0,1, e o novo cálculo dá 16,79 min.

**Conclusão.** Os 17 testes passaram, e todos os valores de referência do enunciado foram reproduzidos dentro das tolerâncias.

### Efeito do passo Δz (teste 6.3)

A agregação do teste 6.3 é μ(z) = z/15 até 7,5 min e 0,5 depois. O centroide contínuo exato é

∫ z·μ dz = 9,375 + 210,9375 = 220,3125 e ∫ μ dz = 1,875 + 11,25 = 13,125, logo z* = 220,3125 / 13,125 = 117,5/7 ≈ 16,785714 min.

| Δz (min) | N | z* numérico (min) | Erro em relação ao contínuo | Exibido |
|---|---|---|---|---|
| 0,1 | 300 | 16,785683 | 3,17 × 10⁻⁵ | 16,79 |
| 0,05 | 600 | 16,785706 | 7,94 × 10⁻⁶ | 16,79 |
| 0,01 | 3.000 | 16,785714 | 3,17 × 10⁻⁷ | 16,79 |

**Análise.** O método dos pontos médios troca a integral por uma soma de retângulos. Nos trechos onde μ é constante (de 7,5 a 30), a soma é exata; o erro vem da rampa z/15 e do canto em 7,5 min. O erro cai com o quadrado do passo: dividir Δz por 2 divide o erro por cerca de 4 (3,17 × 10⁻⁵ → 7,94 × 10⁻⁶), e dividir por 10 divide por 100 (3,17 × 10⁻⁵ → 3,17 × 10⁻⁷). Mesmo com Δz = 0,1 o erro é menor que 0,0001 min, muito abaixo do arredondamento para duas casas, por isso a tela mostra 16,79 min nos três casos. Um passo menor só custa mais pontos (3.000 em vez de 300), o que nesta aplicação é instantâneo.

O mesmo efeito aparece nos testes de regra única: os centroides contínuos dos triângulos curto e longo são exatamente 5 e 25 min, e com Δz = 0,1 o método dá 5,000111 e 24,999889. Para o conjunto médio, simétrico em torno de 15, os erros dos dois lados se cancelam e o resultado é exatamente 15.

### Alteração de regras e simetria

- **Todas as regras em curto (U = 50%, T = 25 °C).** Só R5 é ativada (h = 1). Com o consequente trocado de médio para curto, a área agregada passa a ser o triângulo curto inteiro e o tempo cai de 15,00 para 5,00 min. Os antecedentes e a ativação não mudam; muda só o conjunto que é recortado. O resultado não é zero porque o centroide do triângulo (0, 0, 0, 15) fica em 15/3 = 5 min, e não no pico em 0: neste modelo didático, solo úmido não significa automaticamente tempo zero.
- **Simetria (U = 35%, T = 20 °C).** R1 (médio), R2 (longo), R4 (curto) e R5 (médio) têm h = 0,5. Os três conjuntos de saída são recortados em 0,5 e, como curto, médio e longo cobrem todo o intervalo com graus que somam 1, o máximo dos recortes fica constante em 0,5 de 0 a 30. O centroide de uma faixa constante é o centro do domínio: 15,00 min.
- **Sobreposição (teste 6.3).** Três regras concluem longo com h = 0,5 (R2, R3 e R6). Como a agregação usa o máximo, a altura de longo continua 0,5; se as áreas fossem somadas, longo ficaria com altura 1,5 e o centroide seria deslocado para a direita.
