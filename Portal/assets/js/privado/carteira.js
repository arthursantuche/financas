// Carteira: patrimônio, desempenho, posições por classe, alocação e risco.
// Referência visual: app Stocks da Apple (lista com faísca e selo de variação, gráfico com leitura
// por arraste, ficha de estatísticas), sobre os tokens do portal.
import { el, brl, brl0, pct, pctSinal, brlSinal, numero, classeSinal, dataBR, dataCurta, somarDias, selo, plural } from '../util.js';
import { faisca, graficoPreco, moldura, graficoRosca, CORES_SERIE } from '../graficos.js';
import { sessao } from './cofre.js';
import { marca } from '../marca.js';
import { quadro, CLASSES } from './mercado.js';
import { alocacao, concentracao, estatisticasConjuntas, riscoCarteira } from '../calculo/carteira.js';
import { alinhar, retornos, volatilidade, drawdownMaximo, retornoTotal } from '../calculo/estatistica.js';

export const variacao = (v) => el('span', { class: `variacao ${v > 0 ? 'variacao--alta' : v < 0 ? 'variacao--baixa' : ''}` }, v == null ? '—' : pctSinal(v));
const PERIODOS = [['1M', 30], ['3M', 91], ['6M', 182], ['No ano', 'ano'], ['1A', 365], ['Tudo', null]];
export function recortar(serie, periodo, hoje) {
  if (periodo == null) return serie;
  const desde = periodo === 'ano' ? `${hoje.slice(0, 4)}-01-01` : somarDias(hoje, -periodo);
  // Inclui o último ponto anterior ao corte, para a variação do período partir do fechamento certo.
  const i = serie.findIndex((p) => p.data >= desde);
  return i <= 0 ? serie : serie.slice(i - 1);
}

export function seletorPeriodo(aoEscolher, inicial = 3) {
  const no = el('div', { class: 'segmento', role: 'group', 'aria-label': 'Período' }, PERIODOS.map(([nome, dias], i) => el('button', { type: 'button', 'aria-pressed': String(i === inicial), onclick: (e) => { [...no.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); aoEscolher(dias); } }, nome)));
  return no;
}

function linhaPosicao(l, q) {
  const h = (q.historicos[l.id] || []).slice(-30).map((p) => p.valor);
  const ref = l.variacaoDia != null && l.preco ? l.preco / (1 + l.variacaoDia) : h[0];
  const rotulo = l.codigo || l.nome;
  return el('li', { class: 'cotacao' }, el('a', { href: `#ativo/${l.id}`, 'aria-label': `${rotulo}, ${l.semPreco ? 'sem preço' : brl(l.preco)}, posição de ${brl(l.valor)}` },
    el('span', { class: 'cotacao__nome' }, marca({ codigo: l.codigo, nome: l.nome, tamanho: 'm' }), el('span', { class: 'cotacao__textos' }, el('span', { class: 'cotacao__codigo' }, rotulo), el('span', { class: 'legenda' }, l.codigo ? l.nome : (CLASSES[l.classe]?.um || '')))),
    h.length > 1 ? faisca(h, ref) : el('span'),
    el('span', { class: 'cotacao__posicao' }, el('span', { class: 'cotacao__preco' }, brl(l.valor)), el('span', { class: `legenda ${classeSinal(l.lucro)}` }, `${brlSinal(l.lucro)} (${pctSinal(l.rentabilidade)})`)),
    el('span', { class: 'cotacao__valores' }, el('span', { class: 'cotacao__preco' }, l.semPreco ? 'sem preço' : l.classe === 'rendafixa' ? brl(l.valor) : brl(l.preco)), variacao(l.classe === 'rendafixa' || l.variacaoDia == null ? l.rentabilidade : l.variacaoDia))));
}

export async function pagina(ctx) {
  const q = await quadro();
  const a = q.avaliacao;
  if (!a.linhas.length) {
    return { titulo: 'Carteira', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
      el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Carteira'), el('h1', { class: 'titulo' }, 'Sua carteira começa aqui.'), el('p', { class: 'copy introducao' }, 'Cadastre ações, fundos, títulos do Tesouro, CDBs e opções. O portal calcula preço médio, rentabilidade e alocação, e atualiza os preços que tiverem fonte pública.')),
      el('p', {}, el('a', { class: 'pill pill--azul', href: '#lancar' }, 'Cadastrar o primeiro investimento')))) };
  }

  // ---- Topo: patrimônio e desempenho ----
  const legendaTopo = el('p', { class: 'patrimonio__dia' });
  const resumoDia = () => legendaTopo.replaceChildren(el('span', { class: classeSinal(a.variacaoDiaValor) }, `${brlSinal(a.variacaoDiaValor)} (${pctSinal(a.variacaoDia)})`), el('span', {}, ' hoje'));
  resumoDia();
  const palcoGrafico = el('div');
  let modo = 'cota', periodo = 365;
  const desenharGrafico = () => {
    const serie = recortar(q.serie, periodo, q.hoje);
    const pontos = serie.map((p) => ({ data: p.data, valor: modo === 'cota' ? p.cota : p.valor }));
    const base = pontos[0]?.valor;
    palcoGrafico.replaceChildren(graficoPreco({
      pontos, neutro: modo === 'valor',
      formato: modo === 'cota' ? (v) => pctSinal(base ? v / base - 1 : 0) : brl0,
      rotuloData: dataBR,
    }));
    if (modo === 'cota' && pontos.length > 1) palcoGrafico.prepend(el('p', { class: 'legenda' }, 'Rentabilidade no período: ', el('strong', { class: classeSinal(retornoTotal(pontos.map((p) => p.valor))) }, pctSinal(retornoTotal(pontos.map((p) => p.valor))))));
  };
  const alternar = el('div', { class: 'segmento', role: 'group', 'aria-label': 'O que o gráfico mostra' }, [['cota', 'Rentabilidade'], ['valor', 'Patrimônio']].map(([m, nome]) => el('button', { type: 'button', 'aria-pressed': String(m === modo), onclick: (e) => { modo = m; [...alternar.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); desenharGrafico(); } }, nome)));
  desenharGrafico();

  const topo = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    sessao.amostra && el('div', { class: 'natureza espaco-fundo' }, el('strong', {}, 'Demonstração'), el('span', { class: 'legenda' }, 'Carteira e preços fictícios, só para mostrar o funcionamento. Nada é gravado.')),
    el('div', { class: 'patrimonio' }, el('p', { class: 'kicker' }, 'Carteira'), el('h1', { class: 'patrimonio__valor' }, brl(a.total)), legendaTopo,
      el('p', { class: 'legenda' }, `Investido ${brl(a.custo)} · resultado `, el('span', { class: classeSinal(a.lucro) }, `${brlSinal(a.lucro)} (${pctSinal(a.rentabilidade)})`), a.realizado ? ` · realizado ${brlSinal(a.realizado)}` : '', a.proventos ? ` · proventos ${brl(a.proventos)}` : '')),
    el('div', { class: 'espaco-topo empilha' }, el('div', { class: 'fila fila--entre' }, seletorPeriodo((d) => { periodo = d; desenharGrafico(); }, 4), alternar), palcoGrafico),
    el('p', { class: 'selo' }, 'Rentabilidade pelo método de cotas: aportes e resgates não distorcem o desempenho.')));

  // ---- Posições por classe ----
  const grupos = Object.keys(CLASSES).map((c) => ({ c, linhas: a.linhas.filter((l) => l.classe === c) })).filter((g) => g.linhas.length);
  const posicoes = el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
    el('div', { class: 'destaques__cabecalho' }, el('h2', { class: 'titulo' }, 'Posições.'), el('a', { href: '#lancar/historico' }, 'Lançamentos')),
    q.avisos.length ? el('div', { class: 'natureza' }, el('strong', { class: 'selo--atencao' }, plural(q.avisos.length, 'ponto de atenção', 'pontos de atenção')), q.avisos.map((v) => el('a', { class: 'legenda', href: `#lancar/ativo/${v.id}` }, v.texto))) : null,
    el('div', { class: q.avisos.length ? 'espaco-topo' : '' }, grupos.map((g) => {
      const total = g.linhas.reduce((s, l) => s + l.valor, 0);
      return el('div', { class: 'grupo-cotacoes' },
        el('div', { class: 'grupo-cotacoes__titulo' }, el('h3', { class: 'kicker' }, CLASSES[g.c].nome), el('span', { class: 'legenda num' }, `${brl0(total)} · ${pct(total / a.total, 1)}`)),
        el('ul', { class: 'cotacoes' }, g.linhas.map((l) => linhaPosicao(l, q))));
    })),
    fontes(q)));

  // ---- Alocação ----
  let por = 'classe';
  const palcoAloc = el('div');
  const desenharAloc = () => {
    // Posições vendidas (valor negativo) não entram na rosca: ela mostra onde o dinheiro está.
    const grupos2 = alocacao(a.linhas.filter((l) => l.valor > 0), q.info, por);
    const g = moldura(`Alocação por ${por}`, 'alocacao__rosca');
    g.no.classList.remove('grafico');
    graficoRosca(g.canvas, { rotulos: grupos2.map((x) => x.nome), valores: grupos2.map((x) => x.valor), formato: brl0 });
    palcoAloc.replaceChildren(el('div', { class: 'alocacao' }, g.no, el('ul', { class: 'alocacao__lista' }, grupos2.map((x, i) => {
      const marca = el('i'); marca.style.background = `var(${CORES_SERIE[i % CORES_SERIE.length]})`;
      return el('li', {}, marca, el('span', {}, x.nome), el('span', { class: 'legenda' }, brl0(x.valor)), el('strong', {}, pct(x.participacao, 1)));
    }))));
  };
  const seletorAloc = el('div', { class: 'segmento', role: 'group', 'aria-label': 'Agrupar por' }, [['classe', 'Classe'], ['setor', 'Setor'], ['instituicao', 'Instituição']].map(([k, nome]) => el('button', { type: 'button', 'aria-pressed': String(k === por), onclick: (e) => { por = k; [...seletorAloc.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); desenharAloc(); } }, nome)));
  desenharAloc();
  const secAloc = el('section', { class: 'secao' }, el('div', { class: 'conteudo' }, el('div', { class: 'destaques__cabecalho' }, el('h2', { class: 'titulo' }, 'Alocação.'), seletorAloc), palcoAloc));

  // ---- Risco ----
  const conc = concentracao(a.linhas.map((l) => l.participacao));
  const cotas = q.serie.map((p) => p.cota);
  const dd = drawdownMaximo(cotas);
  const volCarteira = cotas.length > 30 ? volatilidade(retornos(cotas.slice(-253))) : null;
  // Risco por ativo: usa os ativos com histórico diário em comum (bolsa); renda fixa pela curva quase não oscila.
  const comHist = a.linhas.filter((l) => (q.historicos[l.id] || []).length > 60 && ['acao', 'etf', 'fii', 'bdr'].includes(l.classe));
  let contribuicao = null;
  if (comHist.length >= 2) {
    const al = alinhar(comHist.map((l) => q.historicos[l.id].slice(-253)));
    if (al.datas.length > 40) {
      const est = estatisticasConjuntas(al.valores), soma = comHist.reduce((s, l) => s + l.valor, 0);
      const r = riscoCarteira(comHist.map((l) => l.valor / soma), est.cov);
      contribuicao = comHist.map((l, i) => ({ l, peso: l.valor / soma, risco: r.contribuicao[i], vol: est.volatilidades[i] })).sort((x, y) => y.risco - x.risco);
    }
  }
  const secRisco = el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
    el('div', { class: 'destaques__cabecalho' }, el('h2', { class: 'titulo' }, 'Risco e concentração.'), el('a', { href: '#agente' }, 'Analisar com o agente')),
    el('dl', { class: 'estatisticas' },
      el('div', {}, el('dt', {}, 'Maior posição'), el('dd', {}, pct(conc.maior, 1))),
      el('div', {}, el('dt', {}, 'Três maiores'), el('dd', {}, pct(conc.tresMaiores, 1))),
      el('div', {}, el('dt', {}, 'Posições efetivas'), el('dd', {}, numero(conc.efetivo, 1))),
      el('div', {}, el('dt', {}, 'Volatilidade (12 meses)'), el('dd', {}, volCarteira == null ? '—' : pct(volCarteira, 1))),
      el('div', {}, el('dt', {}, 'Maior queda da cota'), el('dd', { class: dd.valor < 0 ? 'baixa' : '' }, pct(dd.valor, 1)))),
    el('p', { class: 'legenda espaco-topo' }, `Posições efetivas: ${numero(conc.efetivo, 1)} de ${a.linhas.length}. Quanto mais perto do número de ativos, mais bem distribuída a carteira.`),
    contribuicao && el('div', { class: 'espaco-topo' }, el('h3', { class: 'kicker' }, 'Quem carrega o risco da parte em bolsa'),
      el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' },
        el('thead', {}, el('tr', {}, ['Ativo', 'Peso', 'Parcela do risco', 'Volatilidade'].map((t) => el('th', { scope: 'col' }, t)))),
        el('tbody', {}, contribuicao.map((c) => el('tr', {}, el('th', { scope: 'row' }, c.l.codigo || c.l.nome), el('td', {}, pct(c.peso, 1)), el('td', {}, el('strong', {}, pct(c.risco, 1))), el('td', {}, pct(c.vol, 1))))))),
      el('p', { class: 'selo' }, 'Calculado com os retornos diários dos últimos 12 meses. O passado não garante que as relações se mantenham.'))));

  return { titulo: 'Carteira', no: el('div', {}, topo, posicoes, secAloc, secRisco) };
}

// Linha de fontes e datas dos preços mostrados.
function fontes(q) {
  const porFonte = new Map();
  for (const l of q.avaliacao.linhas) { if (!l.fonte) continue; const d = l.dataPreco?.slice(0, 10) || ''; const atual = porFonte.get(l.fonte); if (!atual || d > atual) porFonte.set(l.fonte, d); }
  return el('div', { class: 'espaco-topo empilha' }, [...porFonte].map(([fonte, d]) => selo(fonte, d && dataCurta(d))), el('p', { class: 'selo' }, 'Preços de bolsa não são em tempo real: fechamento oficial ou atraso de 15 a 30 minutos no pregão.'));
}
