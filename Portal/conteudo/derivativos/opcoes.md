---
titulo: Opções: como funcionam
resumo: Calls e puts, strike, prêmio e vencimento. O que determina o preço de uma opção e por que ela pode valer zero na data final.
trilha: derivativos
ordem: 1
nivel: 2
temas: [opções|call|put|strike|prêmio|vencimento|gregas|volatilidade implícita|Black-Scholes]
atualizado: 2026-11-15
fonte: B3, Opções sobre ações | https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/opcoes-sobre-acoes.htm
fonte: CVM, Portal do Investidor: derivativos | https://www.gov.br/investidor/pt-br
fonte: Hull, J. Opções, Futuros e Outros Derivativos. Bookman (referência do modelo de Black-Scholes)
---
Uma opção é um contrato que dá a quem compra o **direito**, sem a obrigação, de comprar ou vender um ativo por um preço combinado, até uma data. Quem vende a opção assume a obrigação correspondente e recebe um valor por isso.

## Os termos

| Termo | Significado |
| --- | --- |
| Call (opção de compra) | Direito de **comprar** o ativo pelo strike |
| Put (opção de venda) | Direito de **vender** o ativo pelo strike |
| Strike | Preço de exercício combinado |
| Prêmio | Preço da opção, pago pelo comprador ao vendedor |
| Vencimento | Data final. Nas opções mensais de ações da B3, a terceira sexta-feira do mês |
| Titular | Quem comprou: tem o direito |
| Lançador | Quem vendeu: tem a obrigação |

Cada opção se refere a uma ação, e a negociação costuma ser em lotes de 100. O código tem as quatro letras do ativo, uma letra para o mês e o tipo (A a L para calls, M a X para puts) e um número ligado ao strike.

## Dentro, no e fora do dinheiro

Para uma **call** com strike de R$ 40:

- ação a R$ 45: está **dentro do dinheiro** (vale exercer; valor intrínseco de R$ 5);
- ação a R$ 40: **no dinheiro**;
- ação a R$ 35: **fora do dinheiro** (não vale exercer; valor intrínseco zero).

Para uma put, é o inverso.

## O que forma o prêmio

`prêmio = valor intrínseco + valor do tempo`

O valor do tempo é o que se paga pela chance de a opção ficar mais valiosa até o vencimento. Ele depende de:

| Fator | Efeito sobre a call | Efeito sobre a put |
| --- | --- | --- |
| Preço da ação sobe | Sobe | Cai |
| Volatilidade sobe | Sobe | Sobe |
| Tempo passa | Cai | Cai |
| Juros sobem | Sobe um pouco | Cai um pouco |

:::simulador black-scholes
:::

## As gregas

- **Delta:** quanto o prêmio muda quando a ação muda R$ 1. Também serve de aproximação para a chance de exercício.
- **Gama:** quanto o delta muda. É alto perto do strike e do vencimento.
- **Theta:** quanto a opção perde por dia que passa, com tudo o mais constante. Trabalha contra quem compra e a favor de quem vende.
- **Vega:** quanto o prêmio muda quando a volatilidade esperada muda 1 ponto.

A **volatilidade implícita** é a volatilidade que, colocada no modelo, explica o prêmio de mercado. Ela sobe antes de resultados e em crises: nesses momentos as opções ficam caras.

## O que acontece no vencimento

A opção vale o valor intrínseco, e nada mais. Se terminar fora do dinheiro, **vira pó**: o comprador perde todo o prêmio. A maior parte das opções fora do dinheiro termina assim.

| Posição | Ganho máximo | Perda máxima |
| --- | --- | --- |
| Comprar call | Ilimitado | O prêmio pago |
| Comprar put | Strike menos o prêmio | O prêmio pago |
| Vender call sem ter a ação | O prêmio recebido | **Ilimitada** |
| Vender put | O prêmio recebido | Strike menos o prêmio |

:::atencao
Vender opções a descoberto expõe a perdas muito maiores que o valor recebido, e a corretora exige garantias que podem ser executadas. Comprar opções limita a perda ao prêmio, mas a perda total é o resultado mais frequente. Opções exigem acompanhamento até o vencimento.
:::

## Para que servem

1. **Proteção:** comprar puts funciona como um seguro contra a queda de ações que você tem.
2. **Renda:** vender calls sobre ações da carteira gera prêmio, em troca de limitar a alta.
3. **Alavancagem:** com pouco dinheiro, participar de um movimento grande, com alta chance de perder tudo.

O artigo seguinte mostra as estruturas mais usadas, com os gráficos de resultado.

## Imposto

Ganhos com opções pagam 15% em operações comuns e 20% em day trade, sem a isenção de R$ 20 mil das ações. O imposto é recolhido por DARF no mês seguinte, e prejuízos podem ser compensados.

## O que guardar

:::destaque
- Opção é direito para quem compra e obrigação para quem vende.
- O prêmio depende do preço da ação, do tempo e, muito, da volatilidade.
- O tempo corrói a opção todo dia. No vencimento, fora do dinheiro vale zero.
:::
