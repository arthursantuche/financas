# Dados privados do Portal Finanças

Repositório **privado**. Guarda o cofre cifrado da carteira, a lista de acompanhamento e os dados de mercado usados só pelo dono. O código fica no repositório público do portal; aqui há só dados e a rotina `Rotinas` (`.github/workflows/rotinas.yml`) que os atualiza.

| Caminho | O que é | Quem grava |
| --- | --- | --- |
| `cofre/chaves.json` | Usuário e chave do cofre, embrulhada pela senha e pela chave de recuperação | O portal |
| `cofre/dados.json` | Carteira, alertas, relatórios e ajustes, cifrados (AES-GCM de 256 bits) | O portal |
| `monitor.json` | Em claro: códigos acompanhados, CNPJs de fundos e alertas ativos (gatilhos e lembretes). Sem quantidades nem valores da carteira | O portal |
| `mercado/cotacoes.json` | Cotações do pregão | A rotina |
| `mercado/fechamento.json`, `opcoes.json`, `historico/` | Fechamento, opções e históricos da B3 | A rotina |
| `mercado/fundos.json` | Cotas de fundos (CVM) | A rotina |
| `mercado/logos.json` | Logotipos dos códigos acompanhados | A rotina |
| `mercado/alertas-disparados.json` | Avisos e estado dos alertas | A rotina |

## Instalar
1. Copie este arquivo e `.github/workflows/rotinas.yml` de `coleta/privado/` para o repositório privado.
2. No workflow, troque `__REPOSITORIO_DO_PORTAL__` pelo repositório do portal (`usuario/financas`).
3. No portal, em Ajustes, ligue a nuvem com um token de escopo fino só deste repositório (Contents e Actions em leitura e escrita).
4. Para receber avisos, deixe o repositório em Watch → All Activity: cada alerta vira uma Issue.

Nunca torne este repositório público.
