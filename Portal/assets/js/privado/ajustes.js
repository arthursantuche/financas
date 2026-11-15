// Ajustes: nuvem (sincronização e rotinas), provedor de IA, perfil, acompanhamento e segurança.
import { el, dataHora, novoId } from '../util.js';
import { sessao, configurar, trocarSenha, exportarCopia, apagarDoAparelho, bloquear, lista, gravar, remover, avaliarSenha, pendencias } from './cofre.js';
import { campo, selecao, marcar, formulario } from './formularios.js';
import { PROVEDORES, listarModelos, conversar } from '../agente/llm.js';
import { PERFIS } from '../agente/dossie.js';

const bloco = (titulo, intro, ...corpo) => el('section', { class: 'secao secao--compacta' }, el('div', { class: 'conteudo conteudo--estreito' }, el('h2', { class: 'titulo' }, titulo), intro && el('p', { class: 'copy introducao' }, intro), el('div', { class: 'empilha empilha--folgada' }, corpo)));

export async function pagina(ctx) {
  if (sessao.amostra) return { titulo: 'Ajustes', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' }, el('h1', { class: 'titulo' }, 'Ajustes.'), el('p', { class: 'vazio' }, 'Na demonstração nada é gravado. Para usar de verdade, ', el('a', { href: './#entrar' }, 'crie o seu cofre'), '.'))) };
  const cfg = sessao.dados.config;
  const { conectar, desconectar, sincronizar, ultimaSincronia } = await import('./sincronia.js');

  // ---- Nuvem ----
  const ultima = await ultimaSincronia(), pend = await pendencias();
  let nuvem;
  if (sessao.nuvem) {
    const sinc = el('button', { class: 'pill pill--azul', type: 'button', onclick: async () => { sinc.disabled = true; try { const r = await ctx.comProgresso(sincronizar()); ctx.avisar(r.enviou || r.recebeu ? 'Sincronizado.' : 'Já estava em dia.'); ctx.navegar('ajustes'); } catch (e) { ctx.avisar(e.message); sinc.disabled = false; } } }, 'Sincronizar agora');
    let confirmando = false;
    const sair = el('button', { class: 'link-botao link-botao--alerta', type: 'button', onclick: async () => { if (!confirmando) { confirmando = true; sair.textContent = 'Toque de novo para desligar a nuvem neste aparelho'; return; } await desconectar(); ctx.avisar('Nuvem desligada neste aparelho.'); ctx.navegar('ajustes'); } }, 'Desligar');
    nuvem = [el('p', { class: 'estado-nuvem', dataset: { estado: Object.keys(pend).length ? 'pendente' : 'ok' } }, `Ligada a ${sessao.nuvem.repo}. ${ultima ? `Última sincronização: ${dataHora(ultima)}.` : 'Ainda não sincronizou.'}${Object.keys(pend).length ? ' Há alterações esperando envio.' : ''}`), el('div', { class: 'formulario__acoes' }, sinc, sair)];
  } else {
    const r = campo({ nome: 'repo', rotulo: 'Repositório privado', obrigatorio: true, dica: 'No formato usuario/repositorio.', atributos: { autocapitalize: 'none', spellcheck: 'false', placeholder: 'usuario/financas-dados' } });
    const t = campo({ nome: 'token', rotulo: 'Token de acesso do GitHub', tipo: 'password', obrigatorio: true, atributos: { autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' } });
    nuvem = [
      el('p', { class: 'estado-nuvem', dataset: { estado: 'desligada' } }, 'Desligada: a carteira está só neste aparelho.'),
      el('div', { class: 'natureza' }, el('strong', {}, 'Como criar o token'), el('ol', { class: 'legenda frases' },
        el('li', {}, 'No GitHub, abra Settings, Developer settings, Personal access tokens, Fine-grained tokens e escolha Generate new token.'),
        el('li', {}, 'Em Repository access, marque Only select repositories e escolha só o repositório privado de dados.'),
        el('li', {}, 'Em Permissions, dê Read and write a Contents. Nenhuma outra permissão é necessária.'),
        el('li', {}, 'Gere, copie o token e cole abaixo. Ele fica neste aparelho, cifrado pela sua senha.'))),
      formulario({ campos: [r, t], rotuloBotao: 'Ligar a nuvem', regras: { repo: (v) => (/^[\w.-]+\/[\w.-]+$/.test(v) ? '' : 'Use o formato usuario/repositorio.') }, acao: async (v) => { const info = await ctx.comProgresso(conectar(v)); ctx.avisar(`Nuvem ligada a ${info.nome}.`); ctx.navegar('ajustes'); } }),
    ];
  }

  // ---- IA ----
  const llm = cfg.llm || {};
  const provedor = selecao({ nome: 'provedor', rotulo: 'Provedor', opcoes: [['', 'Nenhum (relatórios por regras)'], ...Object.entries(PROVEDORES).map(([k, p]) => [k, p.nome])], valor: llm.provedor || '' });
  const base = campo({ nome: 'base', rotulo: 'Endereço da API', valor: llm.base || '', dica: 'Preenchido pelo provedor. Mude só para um servidor compatível próprio.', atributos: { autocapitalize: 'none', spellcheck: 'false' } });
  const chave = campo({ nome: 'chave', rotulo: 'Chave da API', tipo: 'password', valor: llm.chave || '', atributos: { autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' } });
  const modelo = campo({ nome: 'modelo', rotulo: 'Modelo', valor: llm.modelo || '', dica: 'Use "Listar modelos" para ver os disponíveis na sua chave.', atributos: { autocapitalize: 'none', spellcheck: 'false', list: 'lista-modelos' } });
  const enviar = marcar({ nome: 'enviar', rotulo: 'Incluir no pedido as posições da carteira em percentuais (sem valores em reais)', valor: !!cfg.enviarCarteiraAoLLM });
  const dicaProvedor = el('p', { class: 'legenda' });
  const modelos = el('datalist', { id: 'lista-modelos' });
  const lerLLM = () => ({ provedor: provedor.ler(), base: base.ler(), chave: chave.ler(), modelo: modelo.ler() });
  const aoMudarProvedor = () => { const p = PROVEDORES[provedor.ler()]; if (p) { base.input.value = p.base; dicaProvedor.replaceChildren(p.dica, ' ', p.ondeCriar ? el('a', { href: p.ondeCriar, target: '_blank', rel: 'noopener' }, 'Criar a chave') : ''); } else dicaProvedor.replaceChildren('Sem provedor, o agente redige por regras: os números e as ordens são os mesmos; faltam as leituras qualitativas.'); };
  provedor.input.addEventListener('change', aoMudarProvedor); aoMudarProvedor();
  if (llm.base) base.input.value = llm.base;
  const estadoIA = el('p', { class: 'legenda', role: 'status' });
  const listar = el('button', { class: 'pill', type: 'button', onclick: async () => { estadoIA.textContent = 'Consultando…'; try { const l = await listarModelos(lerLLM()); modelos.replaceChildren(...l.map((m) => el('option', { value: m }))); estadoIA.textContent = `${l.length} modelos disponíveis. Comece a digitar no campo Modelo para escolher.`; } catch (e) { estadoIA.textContent = e.message; } } }, 'Listar modelos');
  const testar = el('button', { class: 'pill', type: 'button', onclick: async () => { estadoIA.textContent = 'Testando…'; try { const r = await conversar(lerLLM(), [{ role: 'user', content: 'Responda apenas: ok' }], { maxTokens: 20 }); estadoIA.textContent = `Funcionou: o modelo ${r.modelo} respondeu.`; } catch (e) { estadoIA.textContent = e.message; } } }, 'Testar');
  const formIA = formulario({ campos: [provedor, base, chave, modelo, enviar], rotuloBotao: 'Salvar', acao: async (v) => { await configurar({ llm: v.provedor && v.modelo ? { provedor: v.provedor, base: v.base, chave: v.chave, modelo: v.modelo } : null, enviarCarteiraAoLLM: v.enviar }); ctx.avisar(v.provedor && v.modelo ? 'IA configurada.' : 'IA desligada.'); }, extras: [listar, testar] });

  // ---- Perfil ----
  const formPerfil = formulario({ campos: [
    selecao({ nome: 'perfil', rotulo: 'Perfil de risco', opcoes: Object.entries(PERFIS).map(([k, p]) => [k, `${p.nome}: ${Math.round(p.rvMin * 100)}% a ${Math.round(p.rvMax * 100)}% em renda variável`]), valor: cfg.perfil }),
    campo({ nome: 'horizonteAnos', rotulo: 'Horizonte', tipo: 'numero', valor: cfg.horizonteAnos, obrigatorio: true, sufixo: 'anos' }),
    campo({ nome: 'teto', rotulo: 'Teto por ativo', tipo: 'numero', valor: Math.round(cfg.tetoPorAtivo * 100), obrigatorio: true, sufixo: '% da carteira' }),
  ], rotuloBotao: 'Salvar', regras: { horizonteAnos: (x) => (x >= 1 && x <= 40 ? '' : 'Entre 1 e 40 anos.'), teto: (x) => (x >= 3 && x <= 100 ? '' : 'Entre 3% e 100%.') }, acao: async (v) => { await configurar({ perfil: v.perfil, horizonteAnos: v.horizonteAnos, tetoPorAtivo: v.teto / 100 }); ctx.avisar('Perfil salvo.'); } });

  // ---- Acompanhamento ----
  const obs = lista('observados');
  const novoObs = campo({ nome: 'codigo', rotulo: 'Acompanhar um papel fora da carteira', obrigatorio: true, atributos: { autocapitalize: 'characters', spellcheck: 'false', placeholder: 'ABEV3' } });
  const formObs = formulario({ campos: [novoObs], rotuloBotao: 'Acompanhar', regras: { codigo: (v) => (/^[A-Za-z]{4}\d{1,2}$/.test(v.trim()) ? '' : 'Use o código de negociação: quatro letras e um ou dois números.') }, acao: async (v) => { await gravar('observados', { id: novoId('o'), codigo: v.codigo.toUpperCase().trim() }); ctx.navegar('ajustes'); } });

  // ---- Segurança ----
  const sAtual = campo({ nome: 'atual', rotulo: 'Senha atual', tipo: 'password', obrigatorio: true, atributos: { autocomplete: 'current-password' } });
  const sNova = campo({ nome: 'nova', rotulo: 'Nova senha', tipo: 'password', obrigatorio: true, atributos: { autocomplete: 'new-password' } });
  const formSenha = formulario({ campos: [sAtual, sNova], rotuloBotao: 'Trocar a senha', regras: { nova: (v) => { const f = avaliarSenha(v); return f.ok ? '' : f.motivo; } }, acao: async (v) => { await trocarSenha(v); ctx.avisar('Senha trocada. A chave de recuperação continua a mesma.'); sAtual.input.value = sNova.input.value = ''; } });
  const copia = el('button', { class: 'pill', type: 'button', onclick: async () => { const url = URL.createObjectURL(new Blob([await exportarCopia()], { type: 'application/json' })); const a = el('a', { href: url, download: `financas-copia-${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); ctx.avisar('Cópia exportada. Ela só abre com o seu usuário e a sua senha.'); } }, 'Exportar cópia de segurança');
  let confirmando = 0;
  const apagar = el('button', { class: 'link-botao link-botao--alerta', type: 'button', onclick: async () => { confirmando++; if (confirmando === 1) { apagar.textContent = sessao.nuvem ? 'Toque de novo: apaga o cofre deste aparelho (a cópia da nuvem fica)' : 'Toque de novo: apaga o cofre deste aparelho. Sem nuvem nem cópia exportada, os dados se perdem'; return; } await apagarDoAparelho(); ctx.avisar('Cofre apagado deste aparelho.'); ctx.navegar('inicio'); } }, 'Apagar o cofre deste aparelho');

  return { titulo: 'Ajustes', no: el('div', {},
    el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' }, el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Ajustes'), el('h1', { class: 'titulo' }, `Olá, ${sessao.usuario}.`)), el('p', {}, el('button', { class: 'pill', type: 'button', onclick: async () => { await bloquear(); ctx.navegar('inicio'); } }, 'Bloquear o cofre')))),
    bloco('Nuvem.', 'Sincroniza a carteira entre aparelhos e ativa as rotinas automáticas (cotações de bolsa, cotas de fundos e alertas). Os dados sobem cifrados; o repositório guarda em claro só os códigos acompanhados e os gatilhos de alerta.', ...nuvem),
    bloco('Inteligência artificial.', 'Opcional. Com um provedor configurado, o agente redige a parte qualitativa dos relatórios. A chave é sua, fica no cofre cifrado e vai direto do navegador ao provedor.', dicaProvedor, formIA, modelos, estadoIA, el('p', { class: 'selo' }, 'O que vai para o provedor: indicadores das empresas recomendadas, dados econômicos e a composição da carteira em percentuais por classe e setor. Valores em reais e quantidades nunca são enviados. Provedores gratuitos podem usar os pedidos para treinar modelos: consulte os termos do seu.')),
    bloco('Perfil e limites.', 'Premissas usadas pelo agente. A faixa de renda variável e o teto por ativo limitam as ordens sugeridas.', formPerfil),
    bloco('Acompanhamento.', 'Papéis fora da carteira que a rotina de cotações também deve trazer.', obs.length ? el('ul', { class: 'lista' }, obs.map((o) => el('li', {}, el('div', { class: 'fila fila--entre' }, el('a', { href: `#analise/${o.codigo}` }, o.codigo), el('button', { class: 'link-botao link-botao--alerta', type: 'button', onclick: async () => { await remover('observados', o.id); ctx.navegar('ajustes'); } }, 'Remover'))))) : null, formObs),
    bloco('Segurança.', 'A chave de recuperação mostrada na criação do cofre continua valendo depois da troca de senha.', formSenha, el('div', { class: 'formulario__acoes' }, copia, apagar))) };
}
