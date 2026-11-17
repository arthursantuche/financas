// Ficha de um ativo da carteira: preço, gráfico com leitura por arraste, estatísticas, posição e
// lançamentos. Referência: a ficha de um papel no app Stocks.
import { el, brl, brl0, pct, pctSinal, brlSinal, numero, inteiro, classeSinal, dataBR, dataHora, compacto } from '../util.js';
import { graficoPreco } from '../graficos.js';
import { lista } from './cofre.js';
import { quadro, CLASSES, emBolsa } from './mercado.js';
import { marca } from '../marca.js';
import { seletorPeriodo, recortar, variacao } from './carteira.js';
import { resumoSerie } from '../calculo/estatistica.js';
import { acharEmpresa, indicadores } from '../dados.js';

const item = (rotulo, valor, classe = '') => el('div', {}, el('dt', {}, rotulo), el('dd', { class: classe }, valor));

export async function pagina(ctx, [id]) {
  const q = await quadro();
  const a = q.ativos.get(id);
  if (!a) throw new Error('Ativo não encontrado na carteira.');
  const l = q.avaliacao.linhas.find((x) => x.id === id);
  const pos = q.posicoes.find((p) => p.ativo === id);
  const p = q.precos[id], hist = q.historicos[id] || [];
  const rf = a.classe === 'rendafixa';
  const movs = lista('lancamentos').filter((m) => m.ativoId === id).sort((x, y) => (x.data < y.data ? 1 : -1));
  const titulo = a.codigo || a.nome;

  // Gráfico
  let periodo = 365;
  const palco = el('div'), resumoPeriodo = el('p', { class: 'legenda' });
  const desenhar = () => {
    const pontos = recortar(hist, periodo, q.hoje);
    palco.replaceChildren(graficoPreco({ pontos, formato: rf ? (v) => numero(v, 4) : brl, rotuloData: dataBR }));
    if (pontos.length > 1) { const v = pontos[pontos.length - 1].valor / pontos[0].valor - 1; resumoPeriodo.replaceChildren('No período: ', el('strong', { class: classeSinal(v) }, pctSinal(v))); } else resumoPeriodo.replaceChildren();
  };
  desenhar();

  const est = hist.length > 30 && !rf ? resumoSerie(hist.slice(-253).map((x) => x.valor), { taxaLivre: ((await indicadores().catch(() => null))?.cdiAnual?.valor ?? 0) / 100 }) : null;
  const empresa = a.classe === 'acao' && a.codigo ? await acharEmpresa(a.codigo).catch(() => null) : null;

  const topo = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('div', { class: 'patrimonio' },
      marca({ codigo: a.codigo, nome: a.nome, tamanho: 'g' }),
      el('p', { class: 'kicker' }, el('a', { href: '#carteira' }, 'Carteira'), ' · ', CLASSES[a.classe]?.um),
      el('h1', { class: 'titulo' }, titulo), a.codigo && el('p', { class: 'copy introducao' }, a.nome),
      el('p', { class: 'patrimonio__valor' }, p ? (rf ? brl(l?.valor ?? 0) : brl(p.preco)) : 'Sem preço'),
      p && el('p', { class: 'patrimonio__dia' }, rf
        ? el('span', { class: classeSinal(l?.lucro) }, `${brlSinal(l?.lucro)} (${pctSinal(l?.rentabilidade)}) desde a aplicação`)
        : [p.anterior ? el('span', { class: classeSinal(p.preco - p.anterior) }, `${brlSinal(p.preco - p.anterior)} (${pctSinal(p.preco / p.anterior - 1)})`) : null, p.anterior ? el('span', {}, ' no dia') : null]),
      p && el('p', { class: 'selo' }, [p.fonte, p.hora ? dataHora(`${p.data}T${p.hora}`) : p.data && dataBR(p.data.slice(0, 10)), p.atraso && `atraso de ${p.atraso} min`].filter(Boolean).join(' · '))),
    hist.length > 1 ? el('div', { class: 'espaco-topo empilha' }, el('div', { class: 'fila fila--entre' }, seletorPeriodo((d) => { periodo = d; desenhar(); }, 4), resumoPeriodo), palco, rf && el('p', { class: 'selo' }, 'Valor de R$ 1 aplicado, pela curva do título. Não é preço de mercado: numa venda antecipada o valor pode ser outro.')) : el('p', { class: 'vazio espaco-topo' }, emBolsa(a) ? 'O histórico de preços aparece depois que a nuvem for ligada em Ajustes.' : 'Este ativo não tem histórico de preços.'),
    el('div', { class: 'atalhos espaco-topo' }, el('a', { class: 'pill pill--azul', href: `#lancar/mov/${a.id}` }, 'Novo lançamento'), el('a', { class: 'pill', href: `#lancar/ativo/${a.id}` }, 'Editar cadastro'), empresa && el('a', { class: 'pill', href: `#analise/${a.codigo}` }, 'Análise fundamentalista'), emBolsa(a) && a.classe !== 'opcao' && el('a', { class: 'pill', href: `#alertas/novo/${a.codigo}` }, 'Criar alerta'))));

  const posicao = el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Minha posição.'),
    pos && pos.quantidade !== 0 ? el('dl', { class: 'estatisticas' },
      item(rf ? 'Valor aplicado' : 'Quantidade', rf ? brl(l.custo) : numero(pos.quantidade, Number.isInteger(pos.quantidade) ? 0 : 4)),
      !rf && item('Preço médio', brl(pos.precoMedio)),
      item('Valor atual', brl(l?.valor)),
      rf && l?.liquido != null && item(`Líquido estimado (IR ${pct(l.aliquotaIR, 1)})`, brl(l.liquido)),
      item('Resultado', `${brlSinal(l?.lucro)} (${pctSinal(l?.rentabilidade)})`, classeSinal(l?.lucro)),
      item('Participação na carteira', pct(l?.participacao, 1)),
      pos.realizado ? item('Resultado já realizado', brlSinal(pos.realizado), classeSinal(pos.realizado)) : null,
      pos.proventos ? item('Proventos recebidos', brl(pos.proventos)) : null,
      a.instituicao && item('Instituição', a.instituicao),
      a.vencimento && item('Vencimento', dataBR(a.vencimento)),
      a.classe === 'opcao' && item('Strike', brl(a.strike)),
      a.classe === 'tesouro' && p?.taxa != null && item('Taxa de mercado hoje', `${numero(p.taxa, 2)}% a.a.`),
    ) : el('p', { class: 'vazio' }, 'Posição zerada. O histórico de lançamentos continua abaixo.'),
    pos && pos.quantidade < 0 && el('p', { class: 'legenda espaco-topo' }, 'Posição vendida: o valor negativo é o que custaria recomprar hoje.')));

  const mercado = est ? el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Comportamento do preço.'),
    el('dl', { class: 'estatisticas' },
      p?.abertura ? item('Abertura', brl(p.abertura)) : null, p?.maximo ? item('Máxima', brl(p.maximo)) : null, p?.minimo ? item('Mínima', brl(p.minimo)) : null,
      p?.volume ? item('Volume', compacto(p.volume)) : null,
      item('Retorno em 12 meses', pctSinal(est.retornoTotal), classeSinal(est.retornoTotal)),
      item('Volatilidade anual', pct(est.volatilidade, 1)),
      item('Maior queda', pct(est.drawdownMaximo, 1), 'baixa'),
      item('Índice de Sharpe', numero(est.sharpe, 2)),
      item('Perda diária superada em 5% dos dias', pct(est.var95, 2)),
      item('IFR (14 dias)', inteiro(est.ifr14)),
      est.mm50 ? item('Média de 50 dias', brl(est.mm50)) : null, est.mm200 ? item('Média de 200 dias', brl(est.mm200)) : null,
      item('Tendência pelas médias', est.tendencia)),
    el('p', { class: 'selo espaco-topo' }, `Calculado com ${est.pontos} fechamentos. Estatísticas descrevem o passado e não indicam o que o preço fará.`))) : null;

  const descrever = (m) => (m.tipo === 'provento' ? `Provento de ${brl(m.valor)}` : m.tipo === 'desdobramento' ? `Fator ${numero(m.quantidade, 4)}` : rf ? `${m.tipo === 'compra' ? 'Aplicação' : 'Resgate'} de ${brl(m.quantidade)}` : `${m.tipo === 'compra' ? 'Compra' : m.tipo === 'venda' ? 'Venda' : 'Bonificação'} de ${numero(m.quantidade, Number.isInteger(m.quantidade) ? 0 : 4)} a ${brl(m.preco)}${m.custos ? `, custos de ${brl(m.custos)}` : ''}`);
  const lancamentos = el('section', { class: `secao ${est ? 'secao--mist' : ''}` }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Lançamentos.'),
    movs.length ? el('ul', { class: 'lista' }, movs.map((m) => el('li', {}, el('a', { class: 'fila fila--entre', href: `#lancar/mov/${a.id}/${m.id}` }, el('span', { class: 'empilha' }, el('span', {}, descrever(m)), m.observacao && el('span', { class: 'legenda' }, m.observacao)), el('span', { class: 'legenda num' }, dataBR(m.data)))))) : el('p', { class: 'vazio' }, 'Nenhum lançamento.')));

  return { titulo, no: el('div', {}, topo, posicao, mercado, lancamentos) };
}
