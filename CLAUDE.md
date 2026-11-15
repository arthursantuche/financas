# Portal Finanças: instruções para IAs

Antes de alterar qualquer coisa, leia no Vault do Obsidian (`~/Documents/Arthur's Ideaverse`, começando pelo `CLAUDE.md` de lá) o Diretório - Portal Finanças, em `Efforts/Finanças/Portal/`. Ele aponta o Guia do Projeto, a Referência técnica, a Metodologia e o Guia de Manutenção. Aqui ficam só as regras que não podem ser esquecidas.

- **Sem build.** HTML, CSS e módulos ES. Nada de framework, empacotador ou dependência de npm no site.
- **Só tokens de papel** (`--cor-*`) fora de `Portal/assets/css/tokens.css`. Regras de design em `DESIGN.md`.
- **Dados externos nunca entram por `innerHTML`.** Tudo é criado com `el()` (`assets/js/util.js`).
- **O cálculo é determinístico e fica em `assets/js/calculo/`.** A IA não calcula. Mudou uma fórmula ou uma regra? Atualize o teste em `testes/calculo.test.mjs` e a Metodologia no Vault.
- **Recomendações só na área privada.** A área pública é educação.
- **Nenhum segredo e nenhum dado pessoal no repositório.** Cotações de bolsa também não: ficam no repositório privado.
- **Teste antes de declarar pronto:** `node --test "testes/*.test.mjs"` e `node testes/e2e.mjs`. Para ver a interface, `?amostra`.
- **Não digite senhas, tokens nem chaves reais** em navegador ou arquivo. Os testes usam valores de teste e servidores simulados.
- Texto em português do Brasil, direto, sem jargão técnico para quem usa.
