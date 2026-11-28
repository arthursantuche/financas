# DESIGN — Portal Finanças

Fonte da verdade: a pasta `x/Documentação/Identidade Visual - Apple/` do Vault (Arthur's Ideaverse), começando por `Identidade Visual - Apple.md`, que traz a lista fechada de adaptações. A identidade é uma especificação medida: este portal a reproduz com tolerância e só difere nas adaptações A1 a A11 da nota superior. Este arquivo diz como o código aplica cada regra; se ele e o código divergirem, vale o código: corrija o arquivo. Prova automática: `node testes/apple.mjs` (medidas) e `node testes/estados.mjs` (estados).

## Vocabulário
- **Área pública:** Início, Aprender, Artigo, Indicadores, Simuladores, Metodologia e Saúde do sistema. **Área privada:** Carteira, Ativo, Lançar, Análise, Agente, Relatório, Alertas e Ajustes.
- **Cofre:** os dados privados cifrados no aparelho. **Nuvem:** o repositório privado do dono.
- **Selo:** linha de 12 px com fonte e data de um dado. **Natureza:** caixa de contorno que diz o que é aquele conteúdo (educação, análise por regras, recomendação).
- **Faísca:** a linha miúda da lista de cotações. **Selo de variação:** o retângulo preenchido com a variação percentual.
- **Faixas de largura:** **L** a partir de 1069 px, **M** de 735 a 1068 px, **S** até 734 px. O layout e a tipografia dependem só da largura (nenhuma regra de orientação nem de altura, com uma exceção: a barra do celular deitado, abaixo). **Computador:** a partir de 834 px. **Celular:** abaixo disso.

## Tipografia
Tokens em `tokens.css`; os papéis que mudam de degrau são redefinidos nas faixas M e S. **Nunca `clamp()`, `vw`, `text-wrap: balance` nem `text-transform`.** Dois pesos: 400 (corpo) e 600 (todo título e rótulo); `th`, `strong` e títulos usam 600. Famílias: Display a partir de 19 px, Text até 17 px, com `-apple-system`, Inter, Helvetica Neue e Arial de reserva (a SF Pro não é hospedada). `font-synthesis: none`.

Formato: tamanho / entrelinha, tracking em px (um token por tamanho, `--trk-N`).

| Papel | Onde | L | M | S |
| --- | --- | --- | --- | --- |
| Abertura | `.display` | 80/84, −1,2 | 64/68, −0,576 | 48/52, −0,144 |
| Título de seção e de página | `.titulo` | 48/52, −0,144 | 40/44, 0 | 32/36, +0,128 |
| Subtítulo | `.card__titulo`, `.prosa h2`, `.veredito__valor`, `.ordem__codigo`, `.resultados dd` | 28/32, +0,196 | 24/28, +0,216 | 21/25, +0,231 |
| Valor grande | `.patrimonio__valor` | 64/68, −0,576 | 56/60, −0,28 | 40/44, 0 |
| Estatística de abertura | `.numeros__valor`, `.card__numero` | 40/48, 0 | igual | igual |
| Eyebrow | `.kicker` (21/25 quando quebra em mais de uma linha: `h2`–`h4`, cartão de artigo, próximo compromisso, parte do relatório) | 21/21, +0,231 | igual | igual |
| Valor de par | `.estatisticas dd` | 21/21, +0,231 | igual | igual |
| Título curto de bloco | `.escolha__nome`, `.prosa h3` | 21/25, +0,231 | igual | igual |
| Lide | `.hero .copy`, `.prosa .lide` (400, Display) | 21/29, +0,231 | igual | 19/27, +0,228 |
| Apoio sob um título | `.copy`, `.introducao` | 17/21, −0,374 | igual | 14/18, −0,224 |
| Corpo | `body`, `.prosa` | 17/25, −0,374 | igual | igual |
| Legenda | `.legenda`, tabelas, rótulos de campo | 14/18, −0,224 | igual | igual |
| Selo e nota | `.selo`, `.status-pendente`, `.leitura`, rodapé | 12/16, −0,12 | igual | igual |
| Botão | `.pill` | 17/20, −0,374 | 14/18, −0,224 | igual |
| Abas | `.segmento button` | 14/18, −0,224 | igual | igual |
| Nome do portal na barra | `.barra__titulo` (600, Display) | 19/23, +0,228 | igual | igual |
| Itens da barra | `.barra__secoes a` | 12/12, −0,12 | igual | igual |
| Ação da barra | `.barra__acao` | 12/16, −0,12 | igual | igual |

Campos de formulário em 17 px (abaixo de 16 px o iOS dá zoom). Números que se comparam: `font-variant-numeric: tabular-nums`. Títulos de seção terminam em ponto; eyebrows e rótulos não. Títulos que quebram usam a entrelinha da tabela (tamanho + 4), nunca a igual ao tamanho. A primeira letra maiúscula de um texto vem do texto, não do CSS.

## Espaço e grade
- **Escala (px):** 4, 8, 12, 16, 20, 24, 28, 32, 40, 44, 48, 64, 80, 96, 112, 120, 128, 144 (`--spacing-N`); o 2 é só ajuste ótico dentro de componente. Medidas medidas na Apple fora da escala (botão 11 e 21; rodapé 5, 6, 9, 10, 17; 18 entre as setas do carrossel, `--gap-setas`) aparecem só onde a tabela de rodapé, de botão ou de carrossel as pede.
- **Papéis de espaço** (`tokens.css`): `--espaco-junto` (4), `--espaco-par` (8), `--espaco-perto` (12), `--espaco-grupo` (16), `--element-gap` (20, entre cartões na coluna), `--gap-linha` (24, entre cartões na linha), `--espaco-bloco` (32), `--espaco-cabecalho` (40), `--espaco-secao` (o padding da seção). Escolha pelo que os dois elementos são um para o outro; um degrau direto só dentro de componente, com comentário. `--card-padding-compacto` (24) nos cartões densos. `--medida-leitura` (66ch) em textos corridos, legendas e selos.
- **Padding das seções** (topo e base): tela branca (`.secao`) 128 / 96 / 80 em L / M / S; faixa (`.secao--mist`) 144 / 120 / 112. A altura segue o conteúdo. Seções com `id` (âncoras) reservam a altura do menu: `max(padding, --altura-topo + 32)`. **Abertura da página:** a primeira seção de cada rota começa a `--espaco-cabecalho` (40 px) abaixo do menu, porque a seção de abertura segue o conteúdo e o menu já ocupa o topo.
- **Contêiner:** `.conteudo` mede `min(87,5%, 1260 px)`; em S, `min(87,5%, 420 px)`; centrado. A seção ocupa a largura toda e o conteúdo, o contêiner. O trilho do carrossel alinha o primeiro cartão à borda do contêiner. Colunas de leitura (`.conteudo--estreito`, 760 px; `.entrar`, 440 px) estreitam o contêiner. Rodapé: coluna de 980 px com margem de 22 px (16 px em S).
- **Grade:** colunas automáticas (`auto-fit`/`auto-fill`) com 20 px entre colunas e 24 px entre linhas. Sem 12 colunas fixas.

## Cor
Três camadas em `tokens.css`: paleta (`--color-*`), papéis (`--cor-*`) e o bloco escuro, que redefine só papéis. **Fora de `tokens.css` só existem papéis.** Claro e escuro seguem o sistema (A11), sem botão; o esqueleto é o mesmo e só as cores mudam.

| Papel | Claro | Escuro |
| --- | --- | --- |
| `--cor-fundo` | `#ffffff` | `#000000` |
| `--cor-faixa` (seção alternada, rodapé) | `#f5f5f7` | `#1d1d1f` |
| `--cor-cartao` (cartão sobre a faixa) | `#ffffff` | `#000000` |
| `--cor-elevada` (painel aberto) | `#fafafc` | `#161617` |
| `--cor-texto` | `#1d1d1f` | `#f5f5f7` |
| `--cor-texto-2` | `#6e6e73` | `#86868b` |
| `--cor-link` (link, item atual) | `#0066cc` | `#2997ff` |
| `--cor-acao`, `-hover`, `-ativo` (botão azul) | `#0071e3`, `#0076df`, `#006edb` | iguais |
| `--cor-foco` (anel) | `#0071e3` | `#2997ff` (A8) |
| `--cor-divisoria` | `#d2d2d7` | `#333336` |
| `--cor-contorno` (anel de botão de contorno) | `#86868b` | `#6e6e73` |
| `--cor-contorno-suave` (anel da pílula, 1 px) | `#e6e6e8` | `#282828` |
| `--cor-vidro-topo` (barra no topo) | `rgba(245,245,247,.8)` | `rgba(18,18,18,.8)` |
| `--cor-vidro` (pílula flutuante, botão de contorno) | `rgba(255,255,255,.8)` | `rgba(18,18,18,.8)` |
| `--cor-barra-item`, `-hover` | `rgba(0,0,0,.8)`, `#000` | `rgba(255,255,255,.8)`, `#fff` |
| `--cor-botao-contorno-hover` | `#f2f2f2` | `#1d1d1f` |
| `--cor-rodape-texto`, `-link`, `-linha`, `-separador` | preto a 56%, 72%, 16%, 48% | branco a 56%, 72%, 16%, 48% |
| `--cor-alerta` (atenção) | `#b64400` | `#f56300` (A2) |

Uso por função: `--cor-link` marca link no texto, ação em forma de link, item atual do menu e série principal de gráfico; `--cor-acao` é só o fundo do botão azul; `--cor-alerta` é o que pede atenção (erro de campo, ação que apaga, inflação); `--cor-alta` e `--cor-baixa` só significam ganho e perda (ver "Próprio deste portal"). Laranja não é perda; vermelho não é erro de formulário. O azul claro nunca é fundo de botão. Texto secundário nunca em `#86868b` sobre claro.

## Superfícies, raios e sombras
Elevação por cor e translucidez; **nenhuma sombra projetada** (a única sombra é o contorno de 1 px por `box-shadow: 0 0 0 1px`, sem desfoque). A troca de seção é um corte seco de fundo. Imagens sem filtro nem escurecimento no escuro.

Raios: 28 px (cartões, molduras de mídia, `--radius-cards`); 980 px (botão azul e de contorno, campos, `--radius-pill`); 120 px (ação da barra); 999 px (abas, pontos); 36 px (setas e cápsula do carrossel, aviso); 18 px (pílula do menu e caixas de contorno pequenas: natureza, forças, busca); 8 px (selo de variação, blocos de carregamento, código). Vidro: 80% de opacidade e desfoque de 20 px nos dois temas (a barra no topo acrescenta `saturate(1,8)`); com `prefers-reduced-transparency` ou sem `backdrop-filter`, fundo sólido `--cor-fundo`.

## Interação
Implementação: seção "Estados de interação" de `componentes.css`, `base.css` e `navegacao.css`. Prova: `node testes/apple.mjs` e `node testes/estados.mjs`. **No corpo da página tudo é instantâneo** (`transition: none`). Só animam: os itens da barra (cor, 320 ms), o cartão-link (escala, 300 ms), as abas (indicador 320 ms, texto 100 ms), a pílula do menu (230 ms) e, no carrossel, setas e pontos. Cursor só com `@media (hover: hover)`; cursor de mão em todo link e botão.

Termos: *ação* (muda algo ali ou é a chamada principal da tela), *destino* (cartão, escolha ou linha que leva a outra página) e *informação* (não reage).

| Tipo | Parado | Cursor | Toque (`:active`) | Foco (afastamento) |
| --- | --- | --- | --- | --- |
| Link no texto (`a`) | `--cor-link`, sem sublinhado | só sublinha, na hora; cor igual | igual | anel, 1 px |
| Ação em forma de link (`.link-botao`) | `--cor-link` (ou `--cor-alerta` se apaga) | só sublinha | igual | anel, 1 px |
| Botão azul (`.pill--azul`) | `#0071e3` | `#0076df` | `#006edb` | anel, 3 px |
| Botão de contorno (`.pill`) | vidro com anel de 1 px | fundo `#f2f2f2` (escuro `#1d1d1f`) | igual | anel, 3 px |
| Ação da barra (`.barra__acao`) | azul, 12/16, raio 120 | `#0076df` | `#006edb` | anel, 2 px |
| Item da barra e nome do portal | `rgba(0,0,0,.8)` | `#000`, em 320 ms (`cubic-bezier(.4,0,.6,1)`) | igual | anel para dentro, −7 px |
| Item atual da barra | `--cor-link`, `aria-current` | igual | igual | −7 px |
| Link do rodapé | 72% | só sublinha; cor igual | igual | anel, 1 px |
| Destino: cartão (`a.card`), escolha (`a.escolha`) | sem efeito | cresce a 1,015× em 300 ms (`cubic-bezier(0,0,.5,1)`); título e borda não mudam | igual ao cursor (sem recuo) | anel para dentro, −3 px |
| Destino: linha de lista (`.lista > li > a`) | texto normal | só o título sublinha | — | anel, 1 px |
| Aba (`.segmento button`) | texto a 80% | 100%, em 100 ms | indicador cheio quando escolhida | anel para dentro, −2 px |
| Escolha selecionada (`aria-pressed`) | contorno azul de 2 px | — | — | −3 px |
| Informação (`.card--info`, veredito, ordem, caixa, natureza, forças) | fundo `--cor-faixa` ou contorno sutil | nada | nada | — |
| Campo | contorno de 1 px | nada | — | contorno azul de 2 px |
| Desativado | 50% (botão), 40% (seta), cinza (ação em link); sem reação | — | — | — |

O anel é sempre `2px solid --cor-foco`. A seta (chevron) da escolha fica em azul de link e não se move. A pílula `.pill` desativada a 50% e a ação em link desativada em cinza são adaptação de acessibilidade (a Apple não tem estado desativado nesses controles). Onde o anel poderia ser recortado por um ancestral (trilho de carrossel, controle segmentado), ele vem para dentro com afastamento negativo.

Os três níveis nunca se misturam: informação não repete o visual de um destino da mesma página (em Início, os cartões de artigo têm contorno e os de "Como este portal trabalha" são informação, em faixa). Legenda de gráfico: o ponto tem a cor da série e o texto é cinza.

**Interpretações registradas.** O cartão-link da Apple escala a foto; os cartões do portal não têm foto, então escala o cartão inteiro (propriedade `scale`, para não anular a subida de entrada, que usa `translate`). A linha de lista não tem cor própria (como o link de corpo, só sublinha o título).

## Navegação: menu superior (adaptação A1)
Uma só barra, em `navegacao.css`, montada por `index.html` e `app.js`.
- **No topo da página:** ocupa a largura toda, 44 px no computador e 48 px na primeira linha no celular (mais uma linha de seções de 44 px). Fundo `--cor-vidro-topo` com `saturate(1,8) blur(20px)`, sem borda nem sombra no computador (no celular, linha de 1 px embaixo). O conteúdo ocupa `min(1024 px, largura − 20 px)`, com recuo de 20 px (12 px no celular), como a barra global.
- **Ao rolar:** vira a pílula da barra local: altura da barra mais 7,5 px (51,5 px no computador), a 10 px das bordas e do topo, largura `min(1024, largura − 20)`, raio 18, `--cor-vidro` com `blur(20px)`, contorno de 1 px por sombra. A faixa some e a pílula desce de `translateY(−72px)` a 0, só com `transform` e `opacity`, em 230 ms `ease`; o conteúdo desce 13,75 px para ficar no centro dela. Nada anima altura nem largura. Com movimento reduzido, troca direta.
- **Gatilho:** um elemento sentinela (`#sentinela`, no alto do conteúdo) observado por `IntersectionObserver` (`acompanharTopo`, em `app.js`): a barra flutua quando o alto do conteúdo passa 24 px acima da borda da barra. Nunca `scrollY`. A folga do topo é `padding-top` do painel (área segura), nunca margem da barra.
- **Celular:** duas linhas (nome do portal e ação azul; abaixo, as seções numa lista rolável com bordas esmaecidas por `mask-image`). Celular deitado e estreito (até 833 px de largura e 500 px de altura): numa linha só, para não tomar um quarto da tela. Esta é a única regra de altura.
- **Item atual:** `--cor-link` e `aria-current="page"`; a lista rola para mostrá-lo. A ação é sempre visível. Os itens têm 44 px de altura e 44 px de largura mínima; a ação tem 28 px de altura e área de toque de 44 × 44 px.
- **Teclado:** Tab percorre o nome, as seções e a ação; o anel é interno (−7 px). A barra nunca fica escondida, então nunca perde o foco (A10). O portal não tem menus suspensos nem painel "Explore": os itens são links diretos.
- **Troca de página:** só o conteúdo entra por esmaecimento de 240 ms; a barra não participa.

## Rodapé
Fundo `--cor-faixa` (A11), texto 12/16 a 56%, coluna de 980 px com margem de 22 px (16 px em S). Em cima, as notas legais, com linha de 1 px a 16% e padding 17/0/11; embaixo, a identificação do portal e a lista de links (72%, só sublinham com o cursor), com separadores de 1 × 10 px entre os visíveis e área de toque de 44 × 44 px. Ajustes e Bloquear só aparecem com o cofre aberto; Bloquear é ação e continua azul. Uma linha fina (`--cor-divisoria`) separa a última seção cinza do rodapé cinza. O portal tem um só grupo de links, então não há colunas nem acordeão (a Apple tem cinco colunas a partir de 834 px e acordeão abaixo).

## Adaptações aprovadas em uso
A1 menu superior (acima); A2 contraste (laranja `#b64400`/`#f56300`, secundário `#6e6e73`/`#86868b`, verde e vermelho escurecidos no texto); A3 alvos de 44 × 44 px por `::after` (`.barra__titulo`, `.barra__acao`, "Ver…", linhas de lista, voltar, rodapé, fontes, selos com link, tabelas, ações de formulário), nunca em bloco de altura fixa; onde a área invisível se sobreporia ou não cabe, o alvo cresce de verdade: botões de período com 44 px de largura (pílula desenhada 4 px para dentro de cada lado) e links empilhados do aviso da carteira com 44 px de altura só no toque; A8 anel `#2997ff` no escuro; A9 rótulos da barra em texto real; A10 barra nunca escondida; A11 tema pelo sistema. A4 (cartões do carrossel fora da vista `inert`, região rotulada e anúncio do cartão atual), A5 (setas, Home e End no trilho e nos pontos) e A6 (revelação com garantia por tempo e estado final imediato em movimento reduzido) estão em uso; não existe A7.

## Números
- **Qual usar:** vários números independentes sobre o mesmo assunto (preço e múltiplos, diagnóstico, uma ordem) → par rótulo e valor; cada linha com uma explicação embaixo (critério da síntese) ou um antes e depois (tendência) → linha com valor à direita.
- **Par rótulo e valor** (`dl.estatisticas`, em todas as páginas): rótulo em cima, valor embaixo, **sempre**. Valor em 21 px/600, números tabulares; rótulo e valor a 4 px; divisória a 12 px do rótulo. Valores da mesma linha da grade ficam na mesma altura, mesmo quando um rótulo quebra. Colunas de 160 px (120 px dentro de cartões). Nunca `flex-wrap` entre rótulo e valor.
- **Resultados de simulador** (`.resultados`): o mesmo princípio (rótulo em cima, valor embaixo), com o valor em 28 px, porque ali o número é o resultado principal da conta.
- **Linhas com valor à direita** (critérios, tendências, tabelas, barras do balanço com `.fila--valor`): rótulo à esquerda, valor alinhado à direita, números tabulares. Não se mistura com o par acima no mesmo bloco.
- **Cartões lado a lado** com as mesmas partes (ordens sugeridas, estruturas com opções): `.grade-2--alinhada` com as classes `.card--alinhado` e `.card--alinhado-N` juntas, em que N é o número de filhos diretos do cartão (4 na ordem, 8 na estrutura). Cada filho ocupa uma linha da grade comum (`subgrid`), e as linhas de dados de cartões vizinhos ficam na mesma altura. Hoje existem as classes 4 e 8; outro N pede uma linha nova em `financas.css` (o estilo em linha é bloqueado pela política de conteúdo).
- A **mesma altura dos valores** num par rótulo e valor vem da grade: cada item tem duas linhas (rótulo e valor) e o valor se alinha à base do item, que tem a altura da linha mais alta da grade.
- **Introdução de seção:** 12 px do título e 32 px até o conteúdo (`base.css`).
- **Última seção cinza:** uma linha fina separa do rodapé, também cinza.

## Carregamento
É automático: toda rota passa por `rotear()`, em `app.js`; a página nova não faz nada além de devolver o conteúdo. Blocos neutros com o formato de uma página (sobretítulo, título, linhas e um bloco de conteúdo), em `--cor-faixa`, **sem pulsar**; só a barra azul do menu se move. Na primeira abertura, os blocos vêm do `index.html`; na troca de página, entram se a página nova demorar mais de 160 ms (`esqueletoPagina`, em `app.js`). Troca rápida não pisca. A página nova entra por esmaecimento de 240 ms. Sem desfoque animado: desfocar a página inteira pesa no iPhone e a referência não o usa.

## Página nova: roteiro
1. Módulo com `pagina(ctx, partes)` e entrada em `ROTAS` (`app.js`); se for privada, `privada: true`. Destino frequente entra em `MENU_PUBLICO` ou `MENU_PRIVADO`.
2. Componentes só desta lista: pílula, `.link-botao`, `a.card`, `a.escolha`, `.lista`, `dl.estatisticas`, `.card--info`, `.natureza`, controle segmentado, campos de `formularios.js`. Nada de `:hover` próprio: se um componente novo for inevitável, ele entra na seção "Estados de interação" de `componentes.css` e na tabela acima.
3. Todo número com selo de fonte e data; análise ou recomendação com a caixa de natureza.
4. Acrescente a rota em `ROTAS` de `testes/layout.mjs` e de `testes/checar-indicadores.cjs` e, se tiver um componente novo, uma verificação em `testes/estados.mjs`. Rode todos os testes antes de publicar.

## O que é próprio deste portal

### Tokens novos (`tokens.css`) [Derivado]
| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--cor-alta` | `#1c7430` | `#30d158` | Texto de ganho e fundo do selo de variação positivo |
| `--cor-baixa` | `#d70015` | `#ff453a` | Texto de perda e fundo do selo de variação negativo |
| `--cor-alta-traco`, `--cor-baixa-traco` | `#34c759`, `#ff3b30` | `#30d158`, `#ff453a` | Linha dos gráficos e das faíscas |
| `--cor-alta-area`, `--cor-baixa-area`, `--cor-neutro-area` | cor de sistema com 14% a 16% | 20% a 22% | Área sob a linha do gráfico de preço |
| `--cor-sobre-variacao` | `#ffffff` | `#000000` | Texto do selo de variação |
| `--cor-serie-1` a `-8` | neutros e azuis | idem, ajustados | Séries da barra de composição da alocação |

Verde e vermelho vêm das cores de sistema da Apple usadas no app Stocks. No texto entram variantes escurecidas, que passam de 4,5:1 sobre tela, faixa e cartão. São as únicas cores novas, e só significam ganho e perda, favorável e desfavorável.

### Uso de cor por função
| Função | Token |
| --- | --- |
| Ganho, alta, critério favorável, melhora | `--cor-alta` |
| Perda, baixa, critério desfavorável, piora | `--cor-baixa` |
| Atenção, erro de campo, ação que apaga, série de inflação | `--cor-alerta` (laranja) |
| Link, foco, item atual do menu, série principal | `--cor-link` |
| Botão preenchido | `--cor-acao` |

Laranja não é perda: é o que pede atenção. Vermelho não é erro de formulário: é resultado negativo.

### Componentes
| Componente | Classe | Regra |
| --- | --- | --- |
| Patrimônio | `.patrimonio` | Valor grande (64/56/40 px por faixa, tabela de tipografia), variação do dia em 21 px colorida, resumo em legenda |
| Lista de ativos | `.cotacoes`, `.cotacao` | Barra lateral de 330 px no computador (celular: lista e, ao tocar, a ficha). Linha de 61 px: ticker em 17 px/600 sobre o nome cinza, faísca de 62 × 26 px, preço sobre a pílula de variação. Seleção com raio de 10 px, fundo de faixa e contorno de 2 px no azul de destaque (`aria-current`); setas, Home e End movem a seleção e trocam o painel |
| Pílula de variação | `.variacao` | 58 × 20 px, raio de 4 px, fundo sólido de alta ou queda, texto branco com sinal, números tabulares; sem dado mostra "–" |
| Faísca | `.faisca` | SVG de 62 × 26 px, traço de 1,5 px na cor da variação, degradê de 0,35 a 0 e linha pontilhada no fechamento anterior |
| Cabeçalho do ativo | `.ativo-cab` | Ticker em 32/36 e nome cinza na mesma linha de base, mercado e moeda embaixo; à direita preço, variação do período (cor e sinal do período inteiro) e o rótulo do período. No painel ao lado da lista não quebra: o nome encurta com reticências (texto inteiro no `title` e na lista); abaixo de 560 px de painel a variação desce sob o preço e abaixo de 440 px a marca sai |
| Seletor de período | `.periodos` | Texto cinza entre duas linhas finas, pílula no selecionado, `radiogroup` com rótulos completos; o período persiste entre ativos (memória da sessão) e a data lida no gráfico ocupa o lugar da fileira |
| Gráfico de preço | `.grafico-preco` | Linha de 1,5 px e área em degradê na cor do período; eixo de preços à direita (4 rótulos), grades, eixo de tempo e faixa de volume de 10 px quando houver dado; hover (ou foco e setas, ou toque): linha e área em azul de destaque, linha vertical, marcador de 13 px, preço em azul acima e data no lugar do seletor; leitura falada em região `aria-live` e tabela alternativa |
| Tabela de indicadores | `.indicadores` | `dl` de 4 colunas por 3 linhas lidas por coluna, rótulo cinza e valor à direita; "–" para ausente, nunca zero (2 colunas em S). No painel ao lado da lista com até 640 px, o valor fica embaixo do rótulo, nas mesmas 4 colunas |
| Controle segmentado | `.segmento` | Cápsula com o item atual preenchido; alvo de 44 px; rola de lado se não couber |
| Estatísticas | `.estatisticas` | Pares rótulo e valor: rótulo em cima, valor embaixo (ver "Números"), em colunas automáticas de 160 px (120 px em cartões) |
| Alocação | `.alocacao`, `.composicao` | Barra de composição (a pizza não faz parte do Stocks) com a legenda em lista: valor e participação de cada grupo |
| Simulador | `.simulador` | Cartão com campos em grade, resultados em 28 px e gráfico; recalcula ao digitar |
| Artigo | `.prosa`, `.sumario`, `.caixa` | Coluna de leitura; sumário fixo ao lado a partir de 1024 px; caixas de resumo, exemplo e atenção |
| Síntese | `.sintese`, `.veredito` | Três cartões: saúde, tendência e sinal, cada um com o porquê |
| Critério | `.criterio`, `.leitura` | Nome, leitura colorida, valor e a regra aplicada, sempre visível |
| Etapas do agente | `.etapas` | Lista com marcador que enche: pendente, atual (azul), feita, falha (laranja) |
| Ordem | `.ordem` | Cartão com código, estatísticas, tese e notas da triagem |
| Forças de Porter | `.forcas`, `.forca` | Cartões de contorno com barra de intensidade de três níveis |
| Natureza do conteúdo | `.natureza` | Contorno de 1 px, raio de 20 px; presente em toda tela com análise ou recomendação |

### Regras de conteúdo
- Todo número traz **fonte e data** num selo. Preço de bolsa diz se é fechamento ou tem atraso.
- Títulos de seção terminam em ponto. Rótulos em português simples: "Lançar", "Posições", "Sinal pelas regras".
- A camada de cada bloco da análise vai num selo acima do título: "Dados oficiais da CVM", "Cálculos do portal", "Interpretação por regras", "Cálculo determinístico".
- Análise e recomendação nunca aparecem sem a caixa de natureza.

### Navegação
- **Sem cofre aberto:** Aprender, Indicadores, Simuladores e a ação "Entrar".
- **Com o cofre aberto:** Carteira, Análise, Agente, Alertas, Aprender e a ação "Lançar".
- Ajustes, Metodologia, Saúde do sistema e Bloquear ficam no rodapé: são destinos raros.
- O menu é remontado só quando o cofre abre ou fecha; na troca de página, só o item atual muda.

### Movimento
- **Revelação temporal única** (`data-subir`, `app.js`): 850 ms, esmaecimento ease-in-out e subida de 30 px com a curva mais rápida, com `+150 ms` entre os itens do grupo (a seção). O gatilho é do grupo: dispara quando o topo do primeiro bloco cruza 80% da janela (`IntersectionObserver` com `rootMargin` de -20%), uma vez só; voltar à página não repete nem esconde. Garantia por tempo de 2,5 s (aba em segundo plano). A subida usa `translate`, não `transform`. Os blocos são os filhos diretos de `.conteudo`; a abertura (primeira seção) não anima. Sem movimento reduzido nada fica escondido.
- **Carrossel das trilhas (família A, Highlights)**: reproduzido como medido. Ao entrar em vista, o ponto atual enche em 6,15 s (linear) e o avanço leva 950 ms; a cada 6,67 s no total; para no último cartão com o botão em "Repetir"; botão Tocar/Pausar; clicar num ponto ou numa seta pausa; com movimento reduzido nunca inicia sozinho. A legenda é a única camada que se move (162 px, opacidade cúbica, por rolagem). A cápsula entra com mola por tempo.
- **Gráficos de preço**: aparecem inteiros, sem animação de desenho (o Stocks não anima). Só o hover do gráfico reage (linha e área viram azul de destaque, linha vertical, marcador, preço em azul e data no lugar do seletor); troca de ativo e de período é direta. Os gráficos do Chart.js (simuladores, relatório) também não animam.
- **Nada mais se move sozinho:** além do carrossel das trilhas (que o botão pausa) e da barra azul durante carregamentos, nenhum elemento anima sem ação da pessoa. Com `prefers-reduced-motion`, nada anima: o carrossel não toca sozinho, a legenda fica parada e visível, os blocos já nascem visíveis e o indicador de carregamento fica estático.
- **Não se aplicam** (Animação e imagens): vídeo de herói e de produto, scrub, seção presa, parallax, fade preso à rolagem, câmara de vapor e visualizador 3D. O portal não tem vídeo nem mídia de produto, e o conteúdo é financeiro (texto, números e gráficos); animar posição por rolagem prejudicaria a leitura. O portal não usa GSAP.

## Exceções conhecidas
- **Degradê na área do gráfico de preço e na faísca:** únicas superfícies com degradê, por fidelidade ao app Stocks (opacidade 0,35 no topo a 0 na base).
- **Raio de 4 px** nas barras dos gráficos do Chart.js e **dica com raio de 10 px** (o Chart.js não lê variáveis CSS; `graficos.js`). **Texto dos gráficos do Chart.js em 12 px**, escrito em `graficos.js`. Sem animação de desenho.
- **Sombra de 3 px** (sem desfoque) em volta do marcador de leitura do gráfico, na cor do fundo, para destacá-lo da linha.
- **Pesos do Stocks:** o ticker do cabeçalho do ativo (32/700 no Stocks) e o nome (20/500) usam 600 e 400, porque o portal só tem os pesos 400 e 600 (Fundamentos). O nome usa o degrau de 21 px (kicker), dentro dos ±2 pt.
- **Dados que o portal não tem:** faixa de volume diária (o portal só guarda o volume do dia), 1D (sem dado intradiário) e P/E, Mkt Cap, Yield, Beta, EPS na tabela do ativo da carteira (ficam fora; a tabela mostra o que o portal calcula, com "–" onde falta). Marca e fonte do provedor de dados do Stocks não entram.
- **24 px depois do título de parte do artigo** (`.prosa > h2 + *`): proporcional ao título, sem papel próprio.
- **Raio de 22,5%** nos logotipos: proporção dos ícones de app, não um raio da escala.
- **Medidas do rodapé fora da escala de 4 px** (5, 6, 9, 10, 17 px) e do botão (11 e 21 px): medidas da Apple.
- **Número de recuperação em monoespaçada** (`.chave-recuperacao`).

## Validação
- `node testes/apple.mjs`: medidas e estados da identidade (tipografia por degrau, contêiner, padding de seção, cores por papel, barra, pílula, botões, links, cartões, rodapé, foco, alvos, abas), em 1440, 1024, 834 e 390 px e nos dois temas, mais os degraus de 734/735 e 1068/1069 e o movimento reduzido.
- `node testes/estados.mjs` (estados de interação e alinhamento de números, dois temas) deve terminar sem problema.
- `node testes/layout.mjs` (checagem de layout, 18 rotas, 5 tamanhos, 2 temas) e `node testes/checar-indicadores.cjs` (cursor e foco não cortados) devem terminar sem problema.
- `node testes/e2e.mjs` percorre as rotas públicas em 1280 × 800, 834 × 1112, 390 × 844, 844 × 390 e 320 × 640, nos dois temas, e a demonstração em três tamanhos: sem rolagem lateral, um título principal por página e console sem erros.
- Varredura de cor: `grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' Portal/assets/css/*.css` só deve achar `tokens.css` (o `apple.mjs` faz a mesma checagem).
- No iPhone físico ainda é preciso conferir toque, fluidez, área segura e o ícone na tela inicial.

## Ícone
Linha ascendente verde (`#34c759`) sobre fundo Ink (`#1d1d1f`), plana, opaca, sem texto. Arquivos `assets/img/icone-*.png` (16, 32, 48, 180, 192 e 512 px). Ao mudar o desenho, troque o nome dos arquivos.
