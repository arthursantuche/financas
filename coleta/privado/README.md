# Dados privados do Portal Finanças

Repositório **privado**. Guarda o cofre cifrado da carteira e os dados de mercado usados só pelo dono. O código fica no repositório público do portal; aqui não há programa, só dados e a rotina que os atualiza.

| Caminho | O que é | Quem grava |
| --- | --- | --- |
| `cofre/chaves.json` | Chaves do cofre, embrulhadas pela senha e pela chave de recuperação. Inúteis sem uma delas | O portal |
| `cofre/dados.json` | Carteira, alertas, relatórios e ajustes, cifrados (AES-GCM de 256 bits) | O portal |
| `monitor.json` | Em claro: códigos acompanhados, CNPJs de fundos e gatilhos de alerta. Sem quantidades nem valores | O portal |
| `mercado/` | Cotações, fechamento oficial da B3, opções, históricos, cotas de fundos e alertas disparados | A rotina `Rotinas` |

Nunca torne este repositório público. Os alertas chegam como Issues deste repositório.
