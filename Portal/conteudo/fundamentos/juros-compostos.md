---
titulo: Juros compostos e o valor do dinheiro no tempo
resumo: Por que R$ 100 hoje valem mais que R$ 100 daqui a um ano, e como o tempo trabalha a favor de quem investe.
trilha: fundamentos
ordem: 1
nivel: 1
temas: [juros|capitalização|taxa equivalente|valor presente]
atualizado: 2026-11-14
fonte: Banco Central do Brasil, Calculadora do Cidadão | https://www3.bcb.gov.br/CALCIDADAO/
fonte: CVM, Portal do Investidor | https://www.gov.br/investidor/pt-br
---
Juro é o preço do dinheiro no tempo. Quem empresta abre mão de usar o dinheiro agora e cobra por isso; quem toma emprestado paga para antecipar o consumo. Todo investimento, de um CDB a uma ação, é uma variação dessa troca.

## Juros simples e juros compostos

Nos **juros simples**, a taxa incide sempre sobre o valor inicial. Nos **juros compostos**, incide sobre o valor inicial mais os juros já acumulados: são juros sobre juros. No Brasil, investimentos e dívidas usam juros compostos.

:::exemplo R$ 1.000 a 10% ao ano
| Ano | Juros simples | Juros compostos |
| --- | --- | --- |
| 1 | R$ 1.100 | R$ 1.100 |
| 5 | R$ 1.500 | R$ 1.611 |
| 10 | R$ 2.000 | R$ 2.594 |
| 20 | R$ 3.000 | R$ 6.727 |
| 30 | R$ 4.000 | R$ 17.449 |
:::

No primeiro ano os dois empatam. A diferença aparece com o tempo, e cresce cada vez mais rápido. Por isso o prazo pesa tanto quanto a taxa: dobrar o tempo faz muito mais que dobrar o resultado.

A fórmula é `valor final = valor inicial × (1 + taxa)^períodos`. Taxa e período precisam estar na mesma unidade: taxa mensal com meses, taxa anual com anos.

## Simule com os seus números

:::simulador juros-compostos
:::

Repare na parte do saldo que vem dos juros. Em prazos curtos, quase tudo é o que você depositou. Em prazos longos, os juros passam a ser a maior parte.

## Taxas equivalentes

Uma taxa de 12% ao ano **não** é 1% ao mês. Em juros compostos, 1% ao mês acumula 12,68% em um ano. Para converter, usa-se a potência, não a divisão:

- de anual para mensal: `(1 + taxa anual)^(1/12) − 1`. Com 12% ao ano, dá 0,949% ao mês;
- de mensal para anual: `(1 + taxa mensal)^12 − 1`.

No mercado brasileiro, as taxas anuais de renda fixa consideram **252 dias úteis** por ano. O CDI de hoje, {{cdi}} ao ano, equivale a uma pequena taxa aplicada em cada dia útil.

:::atencao
Compare sempre taxas na mesma base. Um empréstimo de "só 3% ao mês" custa 42,6% ao ano. Um investimento de "1% ao mês" rende 12,68% ao ano, antes de impostos.
:::

## Valor presente: o caminho de volta

Se juros levam um valor de hoje para o futuro, o **desconto** traz um valor futuro para hoje. Receber R$ 1.000 daqui a um ano, com juros de 10%, equivale a ter R$ 909 hoje (1.000 ÷ 1,10).

Esse raciocínio está por trás de quase tudo em finanças:

- o preço de um título prefixado é o valor de resgate descontado pela taxa de mercado;
- o valor de uma empresa pode ser estimado pelos lucros futuros trazidos a valor presente;
- quando os juros sobem, o valor presente de recebimentos futuros cai. É por isso que ações e títulos longos sofrem com alta de juros.

## A regra do 72

Para estimar em quanto tempo um valor dobra, divida 72 pela taxa anual. A 6% ao ano, dobra em cerca de 12 anos; a 12%, em cerca de 6. É uma aproximação, boa para taxas entre 4% e 15%.

## O que guardar

:::destaque
- Juros compostos crescem de forma exponencial: o tempo é o ingrediente mais barato de um investimento.
- Taxas só se comparam na mesma base de tempo, e a conversão é por potência.
- Trazer valores futuros para hoje é o que permite comparar alternativas diferentes.
- Juros compostos também trabalham contra: é assim que uma dívida de cartão cresce.
:::
