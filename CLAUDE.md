# Portal Finanças: instruções para IAs

Antes de alterar qualquer coisa, leia no Vault do Obsidian (`~/Documents/Arthur's Ideaverse`, começando pelo `CLAUDE.md` de lá) a Visão geral - Portal Finanças, em `Efforts/Finanças/Portal/`. Ela diz qual documento ler para cada tarefa: Sistema (código: arquitetura, módulos, rotas; o Motor de análise traz as fórmulas), Dados (modelo de dados e IA; Fontes externas; Armazenamento e privacidade), Interface (decisões visuais), Operação (onde mudar, testes, publicação, diagnóstico, ativação). Regras visuais: `DESIGN.md`. Se documento e código divergirem, vale o código.

**Identidade visual: Apple.** A pasta `x/Documentação/Identidade Visual - Apple/` do Vault é uma especificação medida, não uma inspiração. Comece pela nota `Identidade Visual - Apple` (princípios e lista fechada de adaptações A1 a A11) e use Fundamentos (tipografia, espaço, cor), Interação e navegação (estados, menu, rodapé), Carrosséis, Animação e imagens, Aplicativo Stocks (carteira, cotações, gráficos) e Implementação e validação (parâmetros e critérios testáveis). Reproduza os valores e os comportamentos, com a tolerância dela; só difere nas adaptações da lista. Não invente cor, raio, fonte, duração nem curva: se faltar um valor, crie o token, registre no `DESIGN.md` e só então use. Onde o portal e a especificação divergirem, a especificação vence, salvo se a mudança tirar função correta ou quebrar acessibilidade (adaptação mínima, documentada no `DESIGN.md`).

- **Sem build.** HTML, CSS e módulos ES. Nada de framework, empacotador ou dependência de npm no site.
- **Só tokens de papel** (`--cor-*`) fora de `Portal/assets/css/tokens.css`. Regras de design em `DESIGN.md`. Tipografia por degraus (734/735 e 1068/1069), sem `clamp`, `vw`, `text-wrap: balance`, `text-transform` nem sombra projetada; no corpo da página tudo é instantâneo.
- **Dados externos nunca entram por `innerHTML`.** Tudo é criado com `el()` (`assets/js/util.js`).
- **O cálculo é determinístico e fica em `assets/js/calculo/`.** A IA não calcula. Mudou uma fórmula ou uma regra? Atualize o teste em `testes/calculo.test.mjs` e o Motor de análise no Vault.
- **Recomendações só na área privada.** A área pública é educação.
- **Nenhum segredo e nenhum dado pessoal no repositório, nem no GitHub.** Dados pessoais ficam no cofre cifrado do aparelho e, se a nuvem estiver ligada, no repositório privado do dono (cofre cifrado; só o `monitor.json`, com códigos e gatilhos, vai em claro). Cotações de bolsa ficam só no repositório privado.
- **Não digite senhas, tokens nem chaves reais** em navegador ou arquivo. Os testes usam valores de teste e servidores simulados.
- **Publicação:** só com autorização do Arthur; `VERSAO_SITE` (`Portal/assets/js/app.js`) só muda a pedido dele; antes do `git push`, `git pull --rebase`.
- Texto em português do Brasil, direto, sem jargão técnico para quem usa.

## Testar antes de declarar pronto
```bash
node --test "testes/*.test.mjs"
node testes/e2e.mjs
node testes/estados.mjs
node testes/layout.mjs
node testes/checar-indicadores.cjs
node testes/apple.mjs
```
Os cinco últimos usam o `playwright-cli` e o Chrome (rode um de cada vez). `testes/apple.mjs` confere as medidas da identidade Apple (tipografia, espaço, cor, menu, estados, rodapé). Para ver a interface: configuração `portal-sem-cache` de `.claude/launch.json` e `http://127.0.0.1:4184/?amostra`. O que cada teste prova: Operação - Portal Finanças, seção 5.
