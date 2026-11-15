---
titulo: Estratégias com opções
resumo: Venda coberta, put de proteção, travas e colar: o desenho de cada estrutura, o ganho e a perda máximos e quando cada uma faz sentido.
trilha: derivativos
ordem: 2
nivel: 3
temas: [venda coberta|put protetora|trava de alta|trava de baixa|colar|payoff|ponto de equilíbrio]
atualizado: 2026-11-15
fonte: B3, Estratégias com opções | https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/opcoes-sobre-acoes.htm
fonte: CVM, Portal do Investidor: riscos dos derivativos | https://www.gov.br/investidor/pt-br
fonte: Hull, J. Opções, Futuros e Outros Derivativos. Bookman (capítulo de estratégias de negociação)
---
Combinar opções entre si e com a ação permite desenhar o resultado: limitar a perda, gerar renda ou apostar numa direção com risco conhecido. Toda estrutura troca uma coisa por outra. A pergunta certa é sempre: do que estou abrindo mão?

## Monte e veja o gráfico

:::simulador payoff vendaCoberta
:::

O gráfico mostra o resultado **no vencimento**. Antes dele, o valor da estrutura também depende do tempo e da volatilidade.

## As estruturas

### Venda coberta

Você tem a ação e vende uma call com strike acima do preço atual.

- **Recebe** o prêmio, que reduz o custo da posição.
- **Abre mão** da alta acima do strike: se a ação passar dele, você vende pelo strike.
- **Continua exposto** à queda da ação; o prêmio só amortece.
- **Faz sentido** quando você espera a ação parada ou em alta moderada e aceitaria vendê-la no strike.

### Put de proteção

Você tem a ação e compra uma put com strike abaixo do preço atual.

- **Paga** o prêmio, como num seguro.
- **Limita** a perda: abaixo do strike, a put compensa a queda.
- **Mantém** toda a alta, menos o prêmio pago.
- **Faz sentido** antes de eventos de risco, para posições grandes que você não quer vender. Proteger todo mês custa caro.

### Colar

Put comprada e call vendida sobre a ação que você tem. O prêmio da call paga a put, no todo ou em parte.

- **Limita** a perda e a alta ao mesmo tempo: o resultado fica dentro de uma faixa.
- **Faz sentido** para proteger um ganho já acumulado sem desembolso.

### Trava de alta com calls

Compra uma call e vende outra, de strike maior, no mesmo vencimento.

- **Custo** menor que comprar só a call.
- **Perda máxima:** o valor pago. **Ganho máximo:** a diferença entre os strikes menos o valor pago.
- **Faz sentido** para uma alta moderada, com risco definido.

### Trava de baixa com puts

Compra uma put e vende outra, de strike menor. É o espelho da trava de alta, para um cenário de queda moderada.

## Comparando

| Estrutura | Visão de mercado | Perda máxima | Ganho máximo | Desembolso |
| --- | --- | --- | --- | --- |
| Compra de call | Alta forte | Prêmio | Ilimitado | Sim |
| Compra de put | Queda forte | Prêmio | Strike menos prêmio | Sim |
| Venda coberta | Lateral ou alta leve | Queda da ação menos o prêmio | Limitado ao strike | Não: recebe |
| Put de proteção | Alta, com medo de queda | Limitada | Ilimitado | Sim |
| Colar | Proteger ganho | Limitada | Limitado | Perto de zero |
| Trava de alta | Alta moderada | Valor pago | Diferença de strikes menos o pago | Sim |

## Antes de montar

1. **Liquidez:** opções com poucos negócios têm diferença grande entre compra e venda, e a saída fica cara. Prefira strikes próximos do preço e os primeiros vencimentos.
2. **Tamanho:** dimensione pela **perda máxima**, não pelo ganho esperado.
3. **Exercício:** numa venda coberta ou numa trava, saiba o que acontece se for exercido antes ou no vencimento.
4. **Custos e imposto:** corretagem, emolumentos e 15% sobre o ganho líquido (20% em day trade) mudam a conta de estruturas com ganho pequeno.
5. **Probabilidade:** o modelo dá uma chance de exercício. É uma estimativa com base na volatilidade, não uma promessa.

:::atencao
"Renda mensal com opções" tem risco: a venda coberta rende pouco por mês e carrega toda a queda da ação. Meses de prêmio podem ser apagados por uma queda forte. E vender opções sem a ação ou sem a trava expõe a perdas sem limite.
:::

## Um exemplo de leitura

:::exemplo Venda coberta
Ação comprada a R$ 40, call de strike R$ 44 vendida por R$ 1,50, 100 ações.
- Ganho máximo: (44 − 40 + 1,50) × 100 = R$ 550, se a ação terminar em R$ 44 ou mais.
- Ponto de equilíbrio: R$ 38,50. Abaixo disso, há prejuízo.
- Perda máxima teórica: R$ 3.850, se a ação fosse a zero.
A estrutura troca a alta acima de R$ 44 por R$ 150 de prêmio.
:::

## O que guardar

:::destaque
- Toda estrutura é uma troca: olhe o que se ganha, o que se perde e o que se abre mão.
- Dimensione pela perda máxima e confira a liquidez das opções.
- Proteção custa; renda com opções limita a alta e não elimina a queda.
:::
