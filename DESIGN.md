# DESIGN — Portal Finanças

Fonte da verdade da identidade: `x/Documentação/Identidade Visual - Apple/Identidade Visual - Apple.md` (vault Arthur's Ideaverse), aplicada pelo método do Diretório - Identidade Visual - Apple. Este portal parte do CSS do Portal Escócia 2027 (tokens, base, navegação, componentes e páginas) e acrescenta o que é próprio de uma plataforma financeira, em `assets/css/financas.css`. Se este arquivo e o código divergirem, vale o código: corrija o arquivo.

## Vocabulário
- **Área pública:** Início, Aprender, Artigo, Indicadores, Simuladores, Metodologia e Saúde do sistema. **Área privada:** Carteira, Ativo, Lançar, Análise, Agente, Relatório, Alertas e Ajustes.
- **Cofre:** os dados privados cifrados no aparelho. **Nuvem:** o repositório privado do dono.
- **Selo:** linha de 12 px com fonte e data de um dado. **Natureza:** caixa de contorno que diz o que é aquele conteúdo (educação, análise por regras, recomendação).
- **Faísca:** a linha miúda da lista de cotações. **Selo de variação:** o retângulo preenchido com a variação percentual.
- **Computador:** a partir de 834 px. **Celular:** abaixo disso.

## O que foi herdado sem mudança
Paleta e papéis (`--cor-*`), tipografia, espaçamentos, raios, curvas e durações; menu em faixa que vira cápsula ao rolar; barra azul de carregamento; pílulas; cartões; carrosséis com a gota; campos, listas e tabelas; aviso flutuante; blocos de carregamento; entrada de página só do conteúdo, em 240 ms; tema claro ou escuro pelo sistema, sem botão.

## Atualização de 16/11/2026 (versão 1.2)
O CSS herdado foi alinhado ao Escócia 2027 versão 2.5 (o portal tinha partido da versão de 14/11). Registro completo no Vault, Linguagem visual - Portal Finanças, seção 1.

### Espaçamento
Papéis do Diretório - Identidade Visual - Apple, seção 7.1, em `tokens.css`: `--espaco-junto` (4), `--espaco-par` (8), `--espaco-perto` (12), `--espaco-grupo` (16), `--element-gap` (20), `--espaco-bloco` (32), `--espaco-cabecalho` (40), `--espaco-secao` (64 no celular, 90 a partir de 834 px, 64 no celular deitado). `--card-padding-compacto` (24) nos cartões densos (escolha, veredito, ordem, caixa, aviso vazio). `--medida-leitura` (66ch) em introduções, legendas, selos, natureza, frases e no texto dos artigos. Escolha pelo que os dois elementos são um para o outro; um degrau direto só dentro de componente, com comentário.

### Toque e cursor
Área invisível de 44 × 44 px (`::after`) no título da barra, links "Ver…", links de lista, voltar, rodapé, fontes do artigo, selos com link, links de tabela e links nas ações de formulário. Itens do menu com 44 px de altura. Setas do carrossel: fundo `--cor-controle-hover` com o cursor e `--cor-controle-ativo` ao tocar; pontos com `--cor-glifo-hover`. Anel de foco para dentro no controle segmentado (ele rola e corta a borda).

### Logotipos (`marca.js`, `.marca`)
Ícone de app: quadrado com cantos de 22,5% (30% com `corner-shape: squircle`), contorno de 1 px (`--contorno-sutil`), fundo `--cor-faixa` (ou `--cor-cartao` sobre faixa). 32 px na busca, 40 px nas linhas da carteira e nas ordens, 64 px nos cabeçalhos de empresa e de ativo. Sem logotipo: monograma em `--cor-texto-2`, peso 600. A imagem só entra depois de decodificada. Fonte, cache e segurança: Vault, Linguagem visual, seção 3.

### Ilustrações (`ilustracoes.js`, `.ilustracao`)
Traço de mão em tinta (`currentColor`) e cinza (`--cor-texto-2`); pesos 2,4, 1,8 e 1,4; sem cor de destaque; preenchimento só com `--ilustracao-fundo` (a cor da superfície). Cartão de trilha: cena parada, 132 px de altura. Abertura de artigo e de trilha: até 420 × 150 px, com o traço principal desenhado pela rolagem (`animation-timeline: view()`, só sem movimento reduzido). Gerar com `node coleta/ilustracoes.mjs`; padrão no Vault, Linguagem visual, seção 5.

## O que é próprio deste portal

### Tokens novos (`tokens.css`) [Derivado]
| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--cor-alta` | `#1c7430` | `#30d158` | Texto de ganho e fundo do selo de variação positivo |
| `--cor-baixa` | `#d70015` | `#ff453a` | Texto de perda e fundo do selo de variação negativo |
| `--cor-alta-traco`, `--cor-baixa-traco` | `#34c759`, `#ff3b30` | `#30d158`, `#ff453a` | Linha dos gráficos e das faíscas |
| `--cor-alta-area`, `--cor-baixa-area`, `--cor-neutro-area` | cor de sistema com 14% a 16% | 20% a 22% | Área sob a linha do gráfico de preço |
| `--cor-sobre-variacao` | `#ffffff` | `#000000` | Texto do selo de variação |
| `--cor-serie-1` a `-8` | neutros e azuis | idem, ajustados | Séries de composição (rosca de alocação) |

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
| Patrimônio | `.patrimonio` | Valor em `clamp(40px, 9vw, 64px)`, variação do dia em 21 px colorida, resumo em legenda |
| Lista de cotações | `.cotacoes`, `.cotacao` | Código em 19 px/600, nome em legenda, faísca, preço e selo de variação; linha inteira é o alvo de toque (68 px de altura mínima). No computador entra a coluna da posição |
| Selo de variação | `.variacao` | Retângulo de raio 8 px, largura mínima de 76 px, números tabulares alinhados à direita |
| Faísca | `.faisca` | SVG de 72 × 32 px (120 px no computador), traço de 1,5 px, linha pontilhada na referência |
| Gráfico de preço | `.grafico-preco` | Linha de 2 px na cor do desempenho do período; área esmaecida até a base; leitura por arraste (dedo, cursor ou setas do teclado) com valor e data; ao soltar, volta ao resumo |
| Controle segmentado | `.segmento` | Cápsula com o item atual preenchido; alvo de 44 px; rola de lado se não couber |
| Estatísticas | `.estatisticas` | Pares rótulo e valor com divisória, em colunas automáticas de 150 px ou mais |
| Alocação | `.alocacao` | Rosca (Chart.js) com legenda em lista ao lado; embaixo, no celular |
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
- Entrada de blocos (`data-subir`): 30 px e esmaecimento em 0,5 s, por `IntersectionObserver`, uma vez. Há uma garantia por tempo: nada fica invisível se o observador não disparar.
- Gráfico de preço: a linha é traçada em 900 ms e a área surge depois; só com `.movimento`.
- Gráficos do Chart.js: 900 ms, `easeOutQuart`, ao ficarem visíveis.
- Gota dos carrosséis: herdada.
- Nada se move sozinho além da barra azul durante carregamentos. Com `prefers-reduced-motion`, nada anima.
- Este portal não usa GSAP: não há palco preso nem paralaxe.

## Exceções conhecidas
- **Degradê na área do gráfico de preço:** única superfície com degradê, por fidelidade ao app Stocks. Vai da cor da área até transparente.
- **Tamanhos sem token:** 28 px (títulos de cartão, resultados e títulos de artigo, valor já usado no portal anterior) e 64 px (teto do valor do patrimônio e dos números de quatro colunas).
- **Raio de 8 px** no selo de variação e **4 px** nas barras dos gráficos (o Chart.js não lê variáveis CSS).
- **Sombra de 3 px** em volta do ponto de leitura do gráfico, na cor do fundo, para destacá-lo da linha.
- **Texto dos gráficos em 12 px** e dica com raio de 10 px, escritos em `graficos.js`.
- **Barra superior:** `saturate(180%)` junto do desfoque, herdado.
- **2 px entre código e nome** nas linhas da carteira (`.cotacao__textos`): densidade do app Stocks, abaixo do papel "junto".
- **24 px depois do título de parte do artigo** (`.prosa > h2 + *`): proporcional ao título de 28 px (Diretório, 7.1, relação com a tipografia), sem papel próprio.
- **Raio de 22,5%** nos logotipos: proporção dos ícones de app, não um raio da escala.

## Validação
- `node testes/layout.mjs` (checagem de layout da identidade, 18 rotas, 5 tamanhos, 2 temas) e `node testes/checar-indicadores.cjs` (cursor e foco não cortados) devem terminar sem problema.
- `node testes/e2e.mjs` percorre as rotas públicas em 1280 × 800, 834 × 1112, 390 × 844, 844 × 390 e 320 × 640, nos dois temas, e a demonstração em três tamanhos: sem rolagem lateral, um título principal por página e console sem erros.
- Varredura de cor: `grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' Portal/assets/css/*.css` só deve achar `tokens.css`.
- No iPhone físico ainda é preciso conferir toque, fluidez, área segura e o ícone na tela inicial.

## Ícone
Linha ascendente verde (`#34c759`) sobre fundo Ink (`#1d1d1f`), plana, opaca, sem texto. Arquivos `assets/img/icone-*.png` (16, 32, 48, 180, 192 e 512 px). Ao mudar o desenho, troque o nome dos arquivos.
