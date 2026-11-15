// Indicadores econômicos: o quadro do dia, as expectativas do mercado e as séries oficiais.
import { el, numero, pct, dataBR, mesAno } from '../util.js';
import { indicadores } from '../dados.js';
import { componente } from './simuladores.js';

const linha = (nome, valor, apoio, data) => el('div', {}, el('dt', {}, nome), el('dd', {}, valor, el('small', {}, [apoio, data].filter(Boolean).join(' · '))));

export async function pagina() {
  const i = await indicadores();
  const ano = new Date().getFullYear();
  const focus = i.expectativas || {};
  const anos = [ano, ano + 1, ano + 2].map(String);
  const linhaFocus = (nome, chave, formato) => (focus[chave] ? el('tr', {}, el('th', { scope: 'row' }, nome), anos.map((a) => el('td', {}, focus[chave].anos[a] != null ? formato(focus[chave].anos[a]) : '—'))) : null);

  const quadro = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Indicadores'), el('h1', { class: 'titulo' }, 'Os números que movem os investimentos.'), el('p', { class: 'copy introducao' }, 'Juros, inflação e câmbio definem quanto rende a renda fixa e pesam no preço de ações, fundos e títulos. Todos os dados abaixo são oficiais.')),
    el('dl', { class: 'resultados' },
      linha('Selic (meta)', `${numero(i.selicMeta.valor, 2)}% a.a.`, 'definida pelo Copom', `desde ${dataBR(i.selicMeta.data)}`),
      linha('CDI', `${numero(i.cdiAnual.valor, 2)}% a.a.`, `${pct(i.cdiAcumulado12m)} em 12 meses`, dataBR(i.cdiAnual.data)),
      linha('IPCA em 12 meses', `${numero(i.ipca12m.valor, 2)}%`, `${numero(i.ipcaMes.valor, 2)}% no mês`, mesAno(i.ipca12m.data)),
      linha('Juro real', pct(i.juroRealExPost), 'Selic descontada do IPCA de 12 meses'),
      linha('Poupança', `${numero(i.poupancaMes.valor, 2)}% a.m.`, `${pct(i.poupancaAcumulada12m)} em 12 meses`, mesAno(i.poupancaMes.data)),
      linha('Dólar (PTAX)', `R$ ${numero(i.dolar.valor, 4)}`, `${pct(i.dolar12m)} em 12 meses`, dataBR(i.dolar.data)),
      linha('IGP-M', `${numero(i.igpmMes.valor, 2)}% no mês`, 'reajusta aluguéis e alguns títulos', mesAno(i.igpmMes.data))),
    el('p', { class: 'selo espaco-topo' }, `Fonte: Banco Central do Brasil, Sistema Gerenciador de Séries Temporais · coletado em ${dataBR(i.geradoEm.slice(0, 10))}`)));

  const historia = el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Juros e inflação.'),
    el('p', { class: 'copy introducao' }, 'O Banco Central sobe a Selic quando a inflação ameaça passar da meta e a reduz quando ela cede. A distância entre as duas linhas é o juro real.'),
    el('div', { class: 'card card--auto' }, componente('grafico', 'selic-ipca')),
    el('p', { class: 'espaco-topo' }, el('a', { href: '#artigo/selic-cdi-e-politica-monetaria' }, 'Entenda a Selic e o CDI'), ' · ', el('a', { href: '#artigo/inflacao-e-juro-real' }, 'Inflação e juro real'))));

  const acumulado = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Dez anos de CDI, poupança e inflação.'),
    el('p', { class: 'copy introducao' }, 'Quanto viraram R$ 100 em cada referência. O que fica abaixo da linha da inflação perdeu poder de compra.'),
    componente('grafico', 'acumulado', ['10'])));

  const expectativas = Object.keys(focus).length ? el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'O que o mercado espera.'),
    el('p', { class: 'copy introducao' }, 'Mediana das projeções de bancos e consultorias coletadas pelo Banco Central no Boletim Focus. São expectativas: mudam toda semana e erram com frequência.'),
    el('div', { class: 'card card--auto' }, el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Fim de cada ano'), anos.map((a) => el('th', { scope: 'col' }, a)))),
      el('tbody', {}, linhaFocus('IPCA', 'IPCA', (v) => `${numero(v, 2)}%`), linhaFocus('Selic', 'Selic', (v) => `${numero(v, 2)}%`), linhaFocus('PIB', 'PIB Total', (v) => `${numero(v, 2)}%`), linhaFocus('Dólar', 'Câmbio', (v) => `R$ ${numero(v, 2)}`)))),
      el('p', { class: 'selo' }, `Fonte: Banco Central do Brasil, Boletim Focus de ${dataBR(focus.IPCA?.data || focus.Selic?.data)}`)))) : null;

  const tesouro = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Tesouro Direto hoje.'),
    el('p', { class: 'copy introducao' }, 'As taxas que o governo paga em cada título mostram o juro que o mercado exige para cada prazo.'),
    componente('grafico', 'tesouro'),
    el('p', { class: 'espaco-topo' }, el('a', { href: '#artigo/tesouro-direto' }, 'Como funciona o Tesouro Direto'))));

  const cambio = el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Dólar.'),
    el('div', { class: 'card card--auto' }, componente('grafico', 'dolar'))));

  return { titulo: 'Indicadores', no: el('div', {}, quadro, historia, acumulado, expectativas, tesouro, cambio) };
}
