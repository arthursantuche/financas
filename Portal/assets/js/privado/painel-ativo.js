// Painel de um ativo da carteira, no modelo do Stocks (Identidade Visual - Apple, "Aplicativo Stocks"): cabeçalho
// (ticker, nome, mercado e moeda, preço, variação do período e rótulo do período), fileira de períodos, gráfico de
// área com leitura e tabela de indicadores. Usado ao lado da lista da carteira (computador) e no alto da ficha.
import { el, brl, pct, numero, compacto, dataBR, dataHora, classeSinal, brlSinal, pctSinal } from '../util.js';
import { graficoPreco } from '../graficos.js';
import { marca } from '../marca.js';
import { CLASSES, emBolsa } from './mercado.js';
import { retornos, volatilidade, drawdownMaximo } from '../calculo/estatistica.js';
import { cabecalhoAtivo, controlePeriodo, escolherPeriodo, periodoEscolhido, memoriaPeriodo, periodosDisponiveis, recortar, tabelaIndicadores, textoVariacao, variacaoDoPeriodo } from './stocks.js';

const media = (v, n) => (v.length >= n ? v.slice(-n).reduce((s, x) => s + x, 0) / n : null);

// Células da tabela, lidas por coluna: dia (abertura, máxima, mínima), mercado (fechamento anterior, volume, peso),
// 52 semanas e médias, risco. O que o portal não tem para o ativo fica ausente ("–").
export function indicadoresDoAtivo({ p, l, hist, rf }) {
  const valores = hist.map((x) => x.valor), ano = valores.slice(-252);
  const mercado = !rf && valores.length > 30;
  const dd = mercado ? drawdownMaximo(valores.slice(-253)).valor : null;
  return [
    ['Abertura', p?.abertura ? brl(p.abertura) : null], ['Máxima', p?.maximo ? brl(p.maximo) : null], ['Mínima', p?.minimo ? brl(p.minimo) : null],
    ['Fech. anterior', !rf && p?.anterior ? brl(p.anterior) : null], ['Volume', p?.volume ? compacto(p.volume, '') : null], ['Na carteira', l?.participacao != null ? pct(l.participacao, 1) : null],
    ['Máx. 52 sem.', mercado && ano.length > 20 ? brl(Math.max(...ano)) : null], ['Mín. 52 sem.', mercado && ano.length > 20 ? brl(Math.min(...ano)) : null], ['Média 50 dias', mercado && media(valores, 50) ? brl(media(valores, 50)) : null],
    ['Média 200 dias', mercado && media(valores, 200) ? brl(media(valores, 200)) : null], ['Volatilidade', mercado ? pct(volatilidade(retornos(valores.slice(-253))), 1) : null], ['Maior queda 12 m', dd != null ? pct(dd, 1) : null],
  ];
}

export function painelAtivo(q, id, { nivel = 2, comFicha = false } = {}) {
  const a = q.ativos.get(id), l = q.avaliacao.linhas.find((x) => x.id === id), pos = q.posicoes.find((x) => x.ativo === id);
  const p = q.precos[id], hist = q.historicos[id] || [], rf = a.classe === 'rendafixa';
  const nome = a.codigo ? a.nome : '';
  const mercado = [CLASSES[a.classe]?.um || 'Ativo', emBolsa(a) ? 'B3' : null, 'BRL', rf ? 'valor da posição' : null].filter(Boolean).join(' · ');
  const cab = cabecalhoAtivo({ nivel, logo: marca({ codigo: a.codigo, nome: a.nome, tamanho: 'm' }), ticker: a.codigo || a.nome, nome, mercado, preco: p ? (rf ? brl(l?.valor ?? 0) : brl(p.preco)) : 'Sem preço', contexto: 'Sem histórico' });
  const no = el('div', { class: 'painel-ativo', dataset: { ativo: id } }, cab.no);
  const slot = el('div', { class: 'painel-ativo__grafico' });

  if (hist.length > 1) {
    const disponiveis = periodosDisponiveis(hist, q.hoje);
    let atual = escolherPeriodo(periodoEscolhido(), disponiveis);
    const controle = controlePeriodo({ disponiveis, atual: atual.id, aoEscolher: (pid) => { atual = disponiveis.find((x) => x.id === pid); memoriaPeriodo(pid); desenhar(); } });
    const desenhar = () => {
      const rec = recortar(hist, atual.dias, q.hoje);
      cab.definir({ variacao: textoVariacao(variacaoDoPeriodo(rec), !rf), contexto: atual.contexto });
      controle.mostrarData(null);
      slot.replaceChildren(graficoPreco({ pontos: rec, formato: rf ? (v) => numero(v, 4) : brl, formatoEixo: (v) => numero(v, rf ? 3 : 2), rotuloData: dataBR, aoLer: (ponto) => controle.mostrarData(ponto ? dataBR(ponto.data) : null) }));
    };
    no.append(controle.no, slot);
    desenhar();
  } else {
    no.append(slot);
    slot.append(el('p', { class: 'vazio' }, emBolsa(a) ? 'O histórico de preços aparece depois que a nuvem for ligada em Ajustes.' : 'Este ativo não tem histórico de preços.'));
  }
  if (rf && hist.length > 1) no.append(el('p', { class: 'selo' }, 'Valor de R$ 1 aplicado, pela curva do título. Não é preço de mercado: numa venda antecipada o valor pode ser outro.'));
  no.append(tabelaIndicadores(indicadoresDoAtivo({ p, l, hist, rf }), `Indicadores de ${a.codigo || a.nome}`));
  if (p) no.append(el('p', { class: 'selo' }, [p.fonte, p.hora ? dataHora(`${p.data}T${p.hora}`) : p.data && dataBR(p.data.slice(0, 10)), p.atraso && `atraso de ${p.atraso} min`].filter(Boolean).join(' · ')));
  if (comFicha) {
    const dado = (nomeCampo, valor, classe = '') => el('div', {}, el('dt', {}, nomeCampo), el('dd', { class: classe }, valor));
    if (pos && pos.quantidade !== 0) no.append(el('dl', { class: 'estatisticas painel-ativo__posicao' },
      dado(rf ? 'Valor aplicado' : 'Quantidade', rf ? brl(l?.custo) : numero(pos.quantidade, Number.isInteger(pos.quantidade) ? 0 : 4)),
      dado('Valor atual', brl(l?.valor)),
      dado('Resultado', `${brlSinal(l?.lucro)} (${pctSinal(l?.rentabilidade)})`, classeSinal(l?.lucro))));
    no.append(el('p', { class: 'painel-ativo__ficha' }, el('a', { class: 'pill', href: `#ativo/${id}` }, 'Abrir a ficha completa')));
  }
  return no;
}
