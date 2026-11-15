---
titulo: Inflação e juro real
resumo: O que é o IPCA, como a inflação corrói o dinheiro parado e por que só o ganho acima dela conta.
trilha: fundamentos
ordem: 2
nivel: 1
temas: [inflação|IPCA|IGP-M|juro real|poder de compra]
atualizado: 2026-11-14
fonte: IBGE, Índice Nacional de Preços ao Consumidor Amplo (IPCA) | https://www.ibge.gov.br/explica/inflacao.php
fonte: Banco Central do Brasil, Metas para a inflação | https://www.bcb.gov.br/controleinflacao/metainflacao
---
Inflação é o aumento generalizado dos preços. Quando ela existe, a mesma quantia compra menos a cada ano. Investir serve, antes de tudo, para não perder essa corrida.

## Como a inflação é medida

O índice oficial do Brasil é o **IPCA**, calculado todo mês pelo IBGE. Ele acompanha o preço de uma cesta de produtos e serviços consumidos por famílias com renda de 1 a 40 salários mínimos, em várias regiões do país.

- **IPCA em 12 meses hoje:** {{ipca-12m}}. No último mês divulgado, {{ipca-mes}}.
- **Meta de inflação:** 3% ao ano, com tolerância de 1,5 ponto para cima ou para baixo, acompanhada de forma contínua pelo Banco Central.

Outros índices aparecem em contratos:

| Índice | Quem calcula | Onde aparece |
| --- | --- | --- |
| IPCA | IBGE | Meta de inflação, Tesouro IPCA+, debêntures |
| INPC | IBGE | Reajuste de salários e aposentadorias |
| IGP-M | FGV | Aluguéis e alguns contratos |
| INCC | FGV | Imóveis na planta |

## O efeito sobre o dinheiro parado

Com inflação de 5% ao ano, R$ 1.000 guardados na gaveta compram, depois de dez anos, o que hoje se compra com R$ 614. O dinheiro continua lá, mas vale menos.

:::grafico acumulado 10
:::

No gráfico, tudo o que fica abaixo da linha do IPCA perdeu poder de compra no período.

## Juro nominal e juro real

A taxa anunciada de um investimento é a **nominal**. O que importa é a **real**: o quanto sobra depois de descontar a inflação.

A conta certa não é uma subtração:

`juro real = (1 + taxa nominal) ÷ (1 + inflação) − 1`

:::simulador juro-real
:::

Com a Selic em {{selic}} e o IPCA de 12 meses em {{ipca-12m}}, o juro real hoje é de {{juro-real}} ao ano. É um nível alto para padrões internacionais, e explica por que a renda fixa atrai tanto no Brasil.

:::atencao
Um investimento que rende menos que a inflação dá prejuízo real, mesmo com saldo crescente. E o imposto de renda incide sobre o ganho nominal: parte do imposto é cobrada sobre a mera reposição da inflação.
:::

## Como se proteger

Nenhum investimento elimina o risco de inflação, mas alguns o reduzem:

- **Títulos indexados ao IPCA** (Tesouro IPCA+, debêntures, alguns CDBs) pagam a inflação do período mais uma taxa fixa. Garantem o juro real se levados ao vencimento.
- **Pós-fixados** (Tesouro Selic, CDBs atrelados ao CDI) costumam acompanhar a inflação, porque o Banco Central sobe os juros quando ela acelera. A proteção é indireta e pode atrasar.
- **Ações e imóveis** tendem a repassar a inflação aos preços no longo prazo, com muita oscilação no caminho.
- **Prefixados** são os mais expostos: a taxa foi combinada antes, e uma inflação maior que a esperada come o ganho.

## Expectativas importam

Preços de títulos e de ações refletem a inflação **esperada**, não a passada. O Boletim Focus, do Banco Central, reúne as projeções do mercado: para {{ano}}, a mediana está em {{focus-ipca}}; para {{ano-proximo}}, em {{focus-ipca-proximo}}. Quando a inflação surpreende, para cima ou para baixo, os preços se ajustam.

## O que guardar

:::destaque
- Inflação é perda de poder de compra; o IPCA é a medida oficial.
- O ganho que conta é o real: acima da inflação e depois dos impostos.
- Títulos atrelados ao IPCA protegem de forma direta; prefixados são os mais vulneráveis.
:::
