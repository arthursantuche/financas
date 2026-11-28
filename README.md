# Portal Finanças

Portal de finanças e investimentos, de custo zero: https://arthursantuche.github.io/financas/

- **Área pública:** educação financeira em seis trilhas (22 artigos), indicadores oficiais e dez simuladores.
- **Área privada** (usuário e senha): carteira no modelo do app Stocks, análise fundamentalista por código ou por demonstrativo enviado, agente que sugere ordens, relatórios por empresa e alertas.

Site estático em HTML, CSS e módulos ES, sem build e sem servidor. Os dados abertos são coletados pelo GitHub Actions. Os dados pessoais ficam cifrados no aparelho e, opcionalmente, num repositório privado do dono (`coleta/privado/`).

| Pasta | Conteúdo |
| --- | --- |
| `Portal/` | O site; `assets/js/calculo/` é o motor, `assets/js/agente/` o agente, `conteudo/` os artigos, `dados/` os dados abertos |
| `coleta/` | Coleta e publicação em Node |
| `testes/` | Testes do motor e do navegador |

## Rodar
Use a configuração `portal-sem-cache` de `.claude/launch.json` ou:
```bash
python3 -m http.server 4184 --directory Portal --bind 127.0.0.1
```
Abra http://127.0.0.1:4184/. Em http://127.0.0.1:4184/?amostra#carteira há uma carteira fictícia, sem gravar nada.

## Testar
Precisa de Node 20 ou mais; os cinco últimos usam Chrome e `playwright-cli` (rode um de cada vez).
```bash
node --test "testes/*.test.mjs"
node testes/e2e.mjs
node testes/estados.mjs
node testes/apple.mjs
node testes/layout.mjs
node testes/checar-indicadores.cjs
```

## Dados e publicação
Depois de editar um artigo, rode `node coleta/conteudo.mjs`. Cada envio para a `main` testa e publica; o workflow também coleta os dados abertos duas vezes por dia.

## Créditos
Dados: Banco Central do Brasil (SGS e Focus), CVM, Tesouro Nacional (Tesouro Transparente) e B3 (só no repositório privado). Bibliotecas em `Portal/assets/vendor/`: Chart.js (MIT) e pdf.js (Apache-2.0). Logotipos: brapi; as marcas pertencem aos titulares. Os preços da demonstração são fictícios.

Nenhuma credencial, chave ou dado financeiro pessoal fica neste repositório.
