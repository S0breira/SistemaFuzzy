# Simulador de Sistema Fuzzy

## 1. Sobre o projeto

Este projeto foi desenvolvido para a disciplina de Inteligência Artificial e consiste na implementação de um sistema fuzzy do tipo Mamdani que recomenda o tempo de irrigação de um jardim.

As entradas são a umidade do solo (U, de 0% a 100%) e a temperatura do ambiente (T, de 10 °C a 40 °C). A saída é o tempo de irrigação (z, de 0 a 30 minutos).

## 2. Como funciona

O sistema executa as cinco etapas da inferência Mamdani:

- Fuzzificação: calcula o grau de pertinência de U e de T em cada conjunto.
- Avaliação das regras: o operador E usa o mínimo, h(r) = min(μU, μT).
- Implicação: o conjunto de saída de cada regra é recortado na altura h(r).
- Agregação: os recortes são combinados pelo máximo, sem somar áreas.
- Defuzzificação: o tempo final é o centroide da área agregada, calculado por pontos médios com passo Δz.

## 3. Conjuntos e regras

Os conjuntos usam funções lineares por partes com quatro pontos (a, b, c, d):

- Umidade (%): seco (0, 0, 20, 50); intermediário (20, 50, 50, 80); úmido (50, 80, 100, 100).
- Temperatura (°C): baixa (10, 10, 15, 25); média (15, 25, 25, 35); alta (25, 35, 40, 40).
- Tempo (min): curto (0, 0, 0, 15); médio (0, 15, 15, 30); longo (15, 30, 30, 30).

Regras padrão:

- R1: SE o solo é seco E a temperatura é baixa, ENTÃO o tempo é médio.
- R2: SE o solo é seco E a temperatura é média, ENTÃO o tempo é longo.
- R3: SE o solo é seco E a temperatura é alta, ENTÃO o tempo é longo.
- R4: SE o solo é intermediário E a temperatura é baixa, ENTÃO o tempo é curto.
- R5: SE o solo é intermediário E a temperatura é média, ENTÃO o tempo é médio.
- R6: SE o solo é intermediário E a temperatura é alta, ENTÃO o tempo é longo.
- R7: SE o solo é úmido E a temperatura é baixa, ENTÃO o tempo é curto.
- R8: SE o solo é úmido E a temperatura é média, ENTÃO o tempo é curto.
- R9: SE o solo é úmido E a temperatura é alta, ENTÃO o tempo é curto.

## 4. Parâmetros do simulador

- Umidade do solo: de 0% a 100% (inicial: 35%).
- Temperatura: de 10 °C a 40 °C (inicial: 30 °C).
- Consequente das regras: curto, médio ou longo para cada uma das 9 regras.
- Passo Δz: 0,1; 0,05 ou 0,01 minuto (inicial: 0,1).

## 5. Funcionalidades

- Calcular: executa toda a inferência de uma vez.
- Avançar etapa: mostra as cinco etapas, uma por clique.
- Restaurar padrão: volta às entradas, regras e passo iniciais.
- Gráficos: conjuntos de entrada com o valor marcado, recorte da regra selecionada e saída com a área agregada e o centroide.
- Tabela de regras: destaca as regras ativadas, com os graus, o mínimo e h(r).
- Registro: mostra os cálculos de cada etapa.
- Testes: executa os testes de validação do enunciado na própria página.

Entradas vazias, não numéricas ou fora dos limites bloqueiam o cálculo e mostram uma mensagem. Qualquer alteração apaga o resultado anterior.

## 6. Resultados dos testes

Os testes usam a base padrão e Δz = 0,1, salvo indicação:

- Pertinências com U = 35% e T = 30 °C: seco 0,5, intermediário 0,5, úmido 0; baixa 0, média 0,5, alta 0,5. Passou.
- Extremos: U = 0% e U = 100% geram (1, 0, 0) e (0, 0, 1); T = 10 °C e T = 40 °C também. Não há divisão por zero. Passou.
- Só R3 ativa (U = 20%, T = 35 °C): esperado ≈ 25,00 min, obtido 25,00 min. Passou.
- Só R5 ativa (U = 50%, T = 25 °C): esperado 15,00 min, obtido 15,00 min. Passou.
- Só R8 ativa (U = 80%, T = 25 °C): esperado ≈ 5,00 min, obtido 5,00 min. Passou.
- Sobreposição (U = 35%, T = 30 °C): R2, R3, R5 e R6 com h = 0,5; esperado 16,79 min, obtido 16,785683 min (exibido 16,79). Passou.
- Simetria (U = 35%, T = 20 °C): agregada constante em 0,5; esperado 15,00 min, obtido 15,00 min. Passou.
- Todas as regras com consequente curto (U = 50%, T = 25 °C): esperado ≈ 5,00 min, obtido 5,00 min. Passou.
- Restaurar padrão: entradas e regras voltam ao início e o novo cálculo dá 16,79 min. Passou.
- Entradas inválidas (U = −1 e 101, T = 9 e 41, campo vazio, texto): o cálculo é bloqueado com mensagem. Passou.
- Determinismo: a mesma entrada, calculada de uma vez ou por etapas, dá sempre o mesmo resultado. Passou.

Efeito do passo Δz no teste de sobreposição, cujo centroide exato é 16,785714 min:

- Δz = 0,1: 16,785683 min (erro de 0,000032).
- Δz = 0,05: 16,785706 min (erro de 0,000008).
- Δz = 0,01: 16,785714 min (erro de 0,0000003).

Quanto menor o passo, mais próximo do valor exato, pois o erro cai com o quadrado de Δz. Como o erro já é muito pequeno com Δz = 0,1, a tela mostra 16,79 min nos três casos.

Todos os 17 testes passaram. Eles podem ser repetidos no botão "Executar testes" da página.

## 7. Tecnologias utilizadas

- HTML5
- CSS3
- JavaScript

A aplicação funciona diretamente no navegador. Nenhuma biblioteca foi usada: a inferência fuzzy e os gráficos (canvas) foram feitos pelo grupo.

## 8. Como executar

Para executar localmente, basta baixar ou clonar o repositório e abrir o arquivo index.html em um navegador.

O projeto também está disponível online pelo GitHub Pages:

[Acessar simulador](https://s0breira.github.io/SistemaFuzzy/)

## 9. Estrutura dos arquivos

- index.html: estrutura da página.
- css/style.css: estilização da interface.
- js/fuzzy.js: implementação do sistema fuzzy Mamdani.
- js/app.js: interface, gráficos e etapas.
- js/validation.js: testes de validação.
- tests/run-tests.js: executa os testes pelo terminal (Node.js).
- README.md: documentação do projeto.

## 10. Autores

Trabalho desenvolvido para a disciplina de Inteligência Artificial.

- Arthur Sobreira Alexandrino
- João Gabriel Nunes Oliveira Lima
- Mayra Gabriela Sousa da Silva

Universidade Federal do Piauí (UFPI) — Ciência da Computação.
