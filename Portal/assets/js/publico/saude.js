// Saúde do sistema: a data de cada fonte de dados, para ver de relance se alguma coleta parou.
import { el, dataBR, dataHora, hojeISO } from '../util.js';
import { indicadores, tesouro, indiceEmpresas, conteudo } from '../dados.js';
import { sessao } from '../privado/cofre.js';

const idade = (iso) => Math.round((Date.parse(hojeISO()) - Date.parse(String(iso).slice(0, 10))) / 864e5);

export async function pagina(ctx) {
  const linhas = [];
  const add = (nome, quando, limiteDias, detalhe = '') => {
    const dias = quando ? idade(quando) : null;
    const ok = dias != null && dias <= limiteDias;
    linhas.push(el('tr', {}, el('th', { scope: 'row' }, nome), el('td', {}, quando ? dataBR(String(quando).slice(0, 10)) : 'sem dados'), el('td', {}, el('span', { class: `leitura ${ok ? 'leitura--favoravel' : 'leitura--desfavoravel'}` }, ok ? 'em dia' : dias == null ? 'indisponível' : `há ${dias} dias`)), el('td', { class: 'legenda' }, detalhe)));
  };
  const tentar = async (f) => { try { return await f(); } catch { return null; } };
  const [i, t, e, c] = await Promise.all([tentar(indicadores), tentar(tesouro), tentar(indiceEmpresas), tentar(conteudo)]);
  add('Banco Central (indicadores)', i?.geradoEm, 4, i ? `Selic de ${dataBR(i.selicMeta.data)}, CDI de ${dataBR(i.cdiAnual.data)}` : '');
  add('Tesouro Direto', t?.dataBase, 5, t ? `${t.titulos.length} títulos` : '');
  add('CVM (demonstrativos)', e?.geradoEm, 10, e ? `${e.empresas.length} companhias` : '');
  add('Conteúdo editorial', c?.geradoEm, 3650, c ? `${c.trilhas.reduce((s, x) => s + x.artigos.length, 0)} artigos` : '');
  if (sessao.aberta && !sessao.amostra) {
    const { ultimaSincronia } = await import('../privado/sincronia.js');
    const { cotacoes } = await import('../privado/mercado.js');
    const u = await ultimaSincronia(), m = await tentar(cotacoes);
    add('Sincronização do cofre', u, 7, sessao.nuvem ? (u ? dataHora(u) : 'ainda não sincronizado') : 'nuvem desligada: os dados estão só neste aparelho');
    add('Cotações de bolsa (repositório privado)', m?.geradoEm, 4, m ? `${Object.keys(m.ativos || {}).length} ativos, fonte ${m.fonte || '—'}` : 'disponível depois de ligar a nuvem');
  }
  return { titulo: 'Saúde do sistema', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Sistema'), el('h1', { class: 'titulo' }, 'Saúde do sistema.'), el('p', { class: 'copy introducao' }, 'As coletas rodam sozinhas no GitHub. Se uma fonte aparecer atrasada por vários dias, a rotina correspondente falhou ou a fonte mudou de formato.')),
    el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela' }, el('thead', {}, el('tr', {}, ['Fonte', 'Referência', 'Situação', 'Detalhe'].map((x) => el('th', { scope: 'col' }, x)))), el('tbody', {}, linhas))),
    el('p', { class: 'selo espaco-topo' }, `Versão do portal: ${ctx.versao}`))) };
}
