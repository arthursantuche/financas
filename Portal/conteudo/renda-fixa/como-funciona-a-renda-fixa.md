---
titulo: Como funciona a renda fixa
resumo: Pré, pós ou atrelada à inflação: o que é fixo, o que varia e por que um título seguro pode perder valor antes do vencimento.
trilha: renda-fixa
ordem: 1
nivel: 1
temas: [renda fixa|prefixado|pós-fixado|IPCA+|marcação a mercado|duration]
atualizado: 2026-11-15
fonte: Tesouro Direto, Entenda cada título | https://www.tesourodireto.com.br/
fonte: ANBIMA, Como investir: renda fixa | https://comoinvestir.anbima.com.br/
fonte: CVM, Portal do Investidor | https://www.gov.br/investidor/pt-br
---
Em renda fixa você empresta dinheiro a um emissor (o governo, um banco ou uma empresa) e recebe de volta com juros. O que é fixo é a **regra** de remuneração, combinada na compra. O preço do título no meio do caminho pode variar.

## Três formas de remuneração

| Tipo | Como rende | Exemplo | Quando costuma ir bem |
| --- | --- | --- | --- |
| Pós-fixado | Acompanha um indexador, dia a dia | Tesouro Selic, CDB a 105% do CDI | Juros altos ou em alta |
| Prefixado | Taxa definida na compra | Tesouro Prefixado, CDB a 13% ao ano | Juros em queda depois da compra |
| Híbrido (inflação) | Inflação do período mais uma taxa fixa | Tesouro IPCA+, debênture IPCA + 6% | Prazos longos; proteção do poder de compra |

No pós-fixado você não sabe quanto vai receber em reais, mas sabe que acompanhará os juros. No prefixado você sabe exatamente quanto receberá no vencimento, e corre o risco de os juros ou a inflação subirem depois. No híbrido, o **juro real** fica garantido se você levar o título até o fim.

Hoje a Selic está em {{selic}} ao ano e o CDI em {{cdi}}; a inflação de 12 meses, em {{ipca-12m}}.

## Quem emite e qual é o risco

- **Governo federal** (Tesouro Direto): o menor risco de crédito do país.
- **Bancos** (CDB, LCI, LCA, LC): risco do banco, com a garantia do Fundo Garantidor de Créditos até o limite.
- **Empresas** (debêntures, CRI, CRA): risco da empresa ou do lastro, sem garantia do fundo. Pagam mais por isso.

## Marcação a mercado: o preço muda todo dia

Um título prefixado promete um valor no vencimento. O preço de hoje é esse valor **descontado pela taxa que o mercado exige agora**. Se os juros sobem, o desconto aumenta e o preço cai. Se caem, o preço sobe.

:::simulador marcacao-mercado
:::

Três conclusões saem do simulador:

1. Quem leva o título até o vencimento recebe a taxa contratada, não importa o caminho do preço.
2. Quem vende antes pode ganhar ou perder, e isso vale também para o Tesouro IPCA+.
3. Quanto mais longo o prazo, maior o efeito. A sensibilidade se mede pela **duration**: um título com duration de 5 anos perde cerca de 5% quando a taxa sobe 1 ponto percentual.

:::atencao
Renda fixa não é sinônimo de "nunca perde". Em 2021 e em 2024, títulos longos do Tesouro tiveram quedas de dois dígitos no preço. O risco não era de calote: era de vender antes da hora.
:::

Pós-fixados quase não sofrem esse efeito, porque a taxa deles se ajusta junto com o mercado. Por isso servem para reserva de emergência.

## Imposto de renda

A maior parte dos títulos paga imposto só sobre o rendimento, retido na fonte no resgate, pela tabela regressiva:

| Prazo da aplicação | Alíquota sobre o rendimento |
| --- | --- |
| Até 180 dias | 22,5% |
| De 181 a 360 dias | 20% |
| De 361 a 720 dias | 17,5% |
| Acima de 720 dias | 15% |

Resgates com menos de 30 dias pagam também IOF, que começa em 96% do rendimento e cai a zero no 30º dia. LCI, LCA, CRI, CRA e debêntures incentivadas são isentos de imposto de renda para pessoa física.

## Compare antes de escolher

:::simulador renda-fixa
:::

O que comparar, nesta ordem: quem emite e se há garantia; se o prazo e a liquidez servem ao seu objetivo; e só então a taxa, sempre **líquida de imposto**.

## O que guardar

:::destaque
- Fixa é a regra de remuneração, não o preço.
- Pós-fixado acompanha os juros; prefixado trava a taxa; IPCA+ trava o juro real.
- Antes do vencimento, prefixados e IPCA+ oscilam com os juros, e mais quanto mais longos.
- A comparação justa é pela taxa líquida, entre títulos de risco e prazo parecidos.
:::
