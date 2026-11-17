# Portal Finanças

Portal de finanças e investimentos, de custo zero. Versão 1.0, publicada em https://arthursantuche.github.io/financas/.

- **Área pública:** educação financeira em seis trilhas (22 artigos), indicadores oficiais do dia e dez simuladores.
- **Área privada** (usuário e senha): carteira no estilo do app Stocks, análise fundamentalista por código ou por demonstrativo enviado, agente que analisa a carteira e sugere ordens, relatórios por empresa e alertas.

Site estático em HTML, CSS e JavaScript, sem build. Não há servidor próprio: os dados abertos são coletados pelo GitHub Actions e publicados com o site; os dados privados ficam cifrados no aparelho e, opcionalmente, num repositório privado do dono.

A documentação completa (arquitetura, modelo de dados, metodologia, segurança, ativação e manutenção) fica no Vault do Obsidian do autor, em `Efforts/Finanças/Portal/`.

## Estrutura
| Pasta | Conteúdo |
| --- | --- |
| `Portal/` | O site. É o que vai para o ar |
| `Portal/assets/js/calculo/` | Motor de cálculo determinístico (estatística, renda fixa, opções, carteira, fundamentos, alertas). Usado pelo navegador e pelos scripts |
| `Portal/assets/js/agente/` | Núcleo do agente: dossiê por regras, chamada ao modelo de linguagem e redação com validador |
| `Portal/assets/js/publico/` e `privado/` | Páginas das duas áreas |
| `Portal/conteudo/` | Artigos em Markdown e o índice gerado |
| `Portal/dados/` | Dados abertos coletados (Banco Central, Tesouro, CVM) e a demonstração fictícia |
| `coleta/` | Scripts Node da coleta e da publicação. `coleta/privado/` é a semente do repositório privado |
| `testes/` | Testes do motor (`node --test`) e de ponta a ponta (Playwright) |
| `.github/workflows/portal.yml` | Testa, coleta e publica |

## Rodar localmente
Use a configuração `portal-sem-cache` de `.claude/launch.json` (porta 4184, sem cache) ou:
```bash
python3 -m http.server 4184 --directory Portal --bind 127.0.0.1
```
Abra http://127.0.0.1:4184/. Com `?amostra` (por exemplo http://127.0.0.1:4184/?amostra#carteira) entra uma carteira fictícia, sem gravar nada.

## Testar
```bash
node --test "testes/*.test.mjs"
```
```bash
node testes/e2e.mjs
```
O segundo abre o Chrome sem interface pelo Playwright do `playwright-cli` e sobe, sozinho, o site, um GitHub simulado e uma IA simulada. `--so publico|amostra|cofre|ia` roda uma parte; `--capturas <pasta>` salva imagens.
```bash
node testes/layout.mjs
```
```bash
node testes/checar-indicadores.cjs
```
Checagens da identidade visual, vindas do portal Escócia 2027: layout (rolagem lateral, espaços, linhas longas, alvos de toque, contraste) em 18 rotas, 5 tamanhos e 2 temas; e cursor e foco não cortados (`TEMA=dark` para o escuro).

## Atualizar dados e conteúdo
```bash
node coleta/bcb.mjs && node coleta/tesouro.mjs && node coleta/cvm.mjs && node coleta/investidores.mjs
```
```bash
node coleta/conteudo.mjs
```
O primeiro refaz os dados abertos (o workflow faz isso duas vezes por dia). O segundo refaz o índice depois de criar ou editar um artigo em `Portal/conteudo/`.
```bash
node coleta/logos.mjs
```
Confere os logotipos das companhias (o workflow faz isso toda vez que coleta; só busca o que é novo ou tem mais de 90 dias).

## Publicar
Cada envio para a `main` testa e publica. A versão do cache dos aparelhos é o identificador do commit, preenchido na publicação por `coleta/publicar.mjs`: não há número para lembrar de mudar.

## Fontes e licenças
Dados: Banco Central do Brasil (SGS e Focus), CVM (dados abertos), Tesouro Nacional (Tesouro Transparente) e B3 (fechamento oficial, só no repositório privado). Bibliotecas em `Portal/assets/vendor/`: Chart.js e pdf.js. Os preços da demonstração são fictícios.

Nenhuma credencial, chave ou dado financeiro pessoal fica neste repositório.
