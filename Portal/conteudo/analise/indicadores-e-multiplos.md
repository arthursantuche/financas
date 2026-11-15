---
titulo: Indicadores e múltiplos
resumo: Margens, ROE, ROIC, endividamento, liquidez e os múltiplos de preço: o que cada um mede, como calcular e os erros mais comuns de leitura.
trilha: analise
ordem: 2
nivel: 2
temas: [ROE|ROIC|margem EBITDA|dívida líquida|P/L|P/VP|EV/EBITDA|valuation|dividend yield]
atualizado: 2026-11-15
fonte: CVM, Dados abertos das companhias | https://dados.cvm.gov.br/
fonte: Damodaran, A. Investment Valuation. Wiley (definições de múltiplos e de retorno sobre capital) | https://pages.stern.nyu.edu/~adamodar/
fonte: B3, Empresas listadas | https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/empresas-listadas.htm
---
Indicadores resumem as demonstrações financeiras em poucos números comparáveis. Nenhum deles decide sozinho: cada um responde a uma pergunta, e a análise vem do conjunto.

## Rentabilidade: o negócio é bom?

| Indicador | Fórmula | O que mostra |
| --- | --- | --- |
| Margem bruta | Lucro bruto ÷ receita | Poder de preço e eficiência de produção |
| Margem EBITDA | EBITDA ÷ receita | Eficiência operacional, antes de depreciação |
| Margem líquida | Lucro líquido ÷ receita | Quanto de cada real vendido vira lucro |
| ROE | Lucro líquido ÷ patrimônio líquido | Retorno sobre o dinheiro dos sócios |
| ROIC | Lucro operacional depois de impostos ÷ capital investido | Retorno do negócio, independente de como é financiado |
| Giro do ativo | Receita ÷ ativo total | Quanto de venda cada real de ativo gera |

O ROE pode ser inflado por dívida. O **ROIC** não: compara o resultado da operação com todo o capital empregado (patrimônio mais dívida líquida). Um ROIC acima do custo do capital, por muitos anos, é a marca de uma vantagem competitiva. Com a Selic em {{selic}}, esse custo é alto.

## Endividamento: a empresa aguenta?

| Indicador | Fórmula | Leitura geral |
| --- | --- | --- |
| Dívida líquida / EBITDA | (Empréstimos − caixa e aplicações) ÷ EBITDA de 12 meses | Até 2× é confortável; acima de 3,5×, alerta |
| Cobertura de juros | EBIT ÷ despesas financeiras | Abaixo de 1,5×, o lucro mal paga os juros |
| Dívida de curto prazo | Dívida que vence em 12 meses ÷ dívida total | Quanto mais curta, maior o risco de rolagem |
| Liquidez corrente | Ativo circulante ÷ passivo circulante | Abaixo de 1, as obrigações do ano superam os recursos do ano |

As faixas mudam com o setor. Empresas de energia e saneamento, com receita previsível, carregam mais dívida que varejistas.

## Caixa: o lucro é de verdade?

- **Caixa operacional ÷ lucro líquido:** perto de 1 ou acima indica lucro que vira dinheiro.
- **Fluxo de caixa livre:** caixa operacional menos investimentos. Positivo e recorrente é o que paga dívida e dividendos.
- **Capex ÷ depreciação:** acima de 1, a empresa investe mais do que o desgaste dos ativos: está crescendo ou repondo com atraso.

## Múltiplos: o preço é razoável?

| Múltiplo | Fórmula | Leitura |
| --- | --- | --- |
| P/L | Preço ÷ lucro por ação | Em quantos anos de lucro atual se paga o preço |
| P/VP | Preço ÷ valor patrimonial por ação | Quanto se paga por real de patrimônio contábil |
| EV/EBITDA | (Valor de mercado + dívida líquida) ÷ EBITDA | Preço da empresa inteira, com a dívida, sobre a geração operacional |
| Dividend yield | Proventos de 12 meses ÷ preço | Renda passada sobre o preço de hoje |
| Lucro sobre preço | Lucro por ação ÷ preço (inverso do P/L) | Comparável com a taxa de juros |

:::atencao Armadilhas dos múltiplos
- **P/L baixo** pode ser lucro inflado por um ganho que não se repete, ou lucro prestes a cair.
- **P/L alto** pode ser empresa em crescimento, ou só cara.
- **P/VP abaixo de 1** não é desconto garantido: o mercado pode esperar retorno baixo ou perdas.
- Múltiplos só se comparam entre empresas parecidas, do mesmo setor, e com a própria história.
:::

## Juntando as peças

Uma leitura completa combina os quatro grupos:

| Situação | Rentabilidade | Dívida | Caixa | Preço |
| --- | --- | --- | --- | --- |
| Negócio bom e caro | Alta | Baixa | Forte | Múltiplos acima do setor |
| Negócio bom e barato | Alta | Baixa | Forte | Múltiplos abaixo do setor |
| Armadilha de valor | Baixa ou em queda | Alta | Fraco | Parece barato |
| Em recuperação | Melhorando | Caindo | Melhorando | Depende do quanto já foi antecipado |

E a tendência importa tanto quanto o nível: margem que melhora, dívida que cai e lucro que acompanha a receita valem mais que um número isolado.

:::destaque Como a área de análise do portal usa isto
Cada indicador recebe uma leitura (favorável, neutro ou desfavorável) por faixas visíveis na tela e pela comparação com a mediana do setor. A síntese só indica saúde, tendência e sinal quando vários critérios concordam, nunca por um indicador só.
:::

## O que guardar

:::destaque
- Rentabilidade, dívida, caixa e preço: quatro perguntas, respondidas em conjunto.
- ROIC acima do custo do capital é o que separa negócios bons de médios.
- Múltiplo baixo não é pechincha, e múltiplo alto não é bolha: compare com o setor e com a qualidade.
:::
