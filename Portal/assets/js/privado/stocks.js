// Componentes de tela de cotação (Identidade Visual - Apple, "Aplicativo Stocks"), adaptados à web e aos dados do
// portal: nada é inventado e o dado ausente aparece como "–". Marca e fonte de dados do provedor externo não entram.
// - Seletor de período em texto, com pílula no selecionado; a escolha persiste ao trocar de ativo (só em memória).
// - Cabeçalho do ativo: ticker grande, nome em cinza, mercado e moeda; à direita preço, variação do período e o
//   rótulo do período. A variação usa o período inteiro (cor e sinal), não o dia.
// - Tabela de indicadores em 4 colunas por 3 linhas; estado de carregamento do gráfico.
import { el, brlSinal, pctSinal, classeSinal, somarDias, data as dataDe } from '../util.js';

// Sem dado intradiário, o 1D do Stocks não existe aqui; o resto da fileira segue o que o histórico diário cobre.
export const PERIODOS = [
  { id: '1S', nome: '1S', rotulo: '1 semana', contexto: 'Última semana', dias: 7 },
  { id: '1M', nome: '1M', rotulo: '1 mês', contexto: 'Último mês', dias: 30 },
  { id: '3M', nome: '3M', rotulo: '3 meses', contexto: 'Últimos 3 meses', dias: 91 },
  { id: '6M', nome: '6M', rotulo: '6 meses', contexto: 'Últimos 6 meses', dias: 182 },
  { id: 'ano', nome: 'No ano', rotulo: 'no ano', contexto: 'No ano', dias: 'ano' },
  { id: '1A', nome: '1A', rotulo: '1 ano', contexto: 'Último ano', dias: 365 },
  { id: '2A', nome: '2A', rotulo: '2 anos', contexto: 'Últimos 2 anos', dias: 730 },
  { id: '5A', nome: '5A', rotulo: '5 anos', contexto: 'Últimos 5 anos', dias: 1826 },
  { id: 'tudo', nome: 'Tudo', rotulo: 'todo o período', contexto: 'Todo o período', dias: null },
];
const memoria = { periodo: '1A', ativo: null };
export const periodoEscolhido = () => memoria.periodo;
export const memoriaPeriodo = (id) => { memoria.periodo = id; };
export const ativoSelecionado = () => memoria.ativo;
export const selecionarAtivo = (id) => { memoria.ativo = id; };

// Corta a série pelo período, incluindo o último ponto anterior ao corte para a variação partir do fechamento certo.
export function recortar(serie, periodo, hoje) {
  if (periodo == null) return serie;
  const desde = periodo === 'ano' ? `${hoje.slice(0, 4)}-01-01` : somarDias(hoje, -periodo);
  const i = serie.findIndex((p) => p.data >= desde);
  return i <= 0 ? serie : serie.slice(i - 1);
}
// Períodos que o histórico do ativo cobre (o mais longo, "Tudo", sempre existe).
export function periodosDisponiveis(serie, hoje) {
  if (serie.length < 2) return PERIODOS.filter((p) => p.id === 'tudo');
  const dias = (dataDe(hoje) - dataDe(serie[0].data)) / 864e5;
  const noAno = (dataDe(hoje) - dataDe(`${hoje.slice(0, 4)}-01-01`)) / 864e5;
  return PERIODOS.filter((p) => p.dias == null || (p.dias === 'ano' ? dias >= noAno : dias >= p.dias * 0.9));
}
export const escolherPeriodo = (id, disponiveis) => disponiveis.find((p) => p.id === id) || disponiveis[disponiveis.length - 1];

// Fileira de períodos: texto cinza, pílula no selecionado, entre duas linhas finas. Na leitura do gráfico a data
// ocupa o lugar da fileira (mostrarData). Grupo de opções com setas (radiogroup) e rótulos completos.
export function controlePeriodo({ disponiveis, atual, aoEscolher }) {
  const botoes = disponiveis.map((p) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(p.id === atual), 'aria-label': p.rotulo, tabindex: p.id === atual ? '0' : '-1', dataset: { periodo: p.id } }, p.nome));
  const grupo = el('div', { class: 'periodos', role: 'radiogroup', 'aria-label': 'Período do gráfico' }, botoes);
  const dataLida = el('p', { class: 'periodos-linha__data', 'aria-hidden': 'true' });
  const no = el('div', { class: 'periodos-linha' }, grupo, dataLida);
  const marcar = (id) => botoes.forEach((b) => { const ligado = b.dataset.periodo === id; b.setAttribute('aria-checked', String(ligado)); b.tabIndex = ligado ? 0 : -1; });
  // Em tela estreita a fileira rola de lado: o período escolhido aparece ao desenhar, sem mover a página.
  new ResizeObserver(() => {
    const b = grupo.querySelector('[aria-checked="true"]');
    if (!b) return;
    const g = grupo.getBoundingClientRect(), r = b.getBoundingClientRect();
    if (r.right > g.right) grupo.scrollLeft += r.right - g.right; else if (r.left < g.left) grupo.scrollLeft -= g.left - r.left;
  }).observe(grupo);
  botoes.forEach((b, i) => {
    b.addEventListener('click', () => { marcar(b.dataset.periodo); aoEscolher(b.dataset.periodo); });
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0;
      if (!d) return;
      e.preventDefault();
      const alvo = botoes[Math.min(botoes.length - 1, Math.max(0, d === Infinity ? botoes.length - 1 : d === -Infinity ? 0 : i + d))];
      alvo.focus(); alvo.click();
    });
  });
  return {
    no,
    mostrarData(texto) { dataLida.textContent = texto || ''; if (texto) no.dataset.lendo = ''; else delete no.dataset.lendo; },
  };
}

// Variação de um recorte da série: { v: fração, abs: diferença } ou null.
export function variacaoDoPeriodo(pontos) {
  if (pontos.length < 2 || !(pontos[0].valor > 0)) return null;
  const a = pontos[0].valor, b = pontos[pontos.length - 1].valor;
  return { v: b / a - 1, abs: b - a };
}

// Cabeçalho do ativo. `variacao`: { texto, sinal } (o sinal dá a cor; o texto já traz + ou −).
export function cabecalhoAtivo({ nivel = 2, logo = null, ticker, nome = '', mercado = '', preco = '–', variacao = null, contexto = '' }) {
  const titulo = el(`h${nivel}`, { class: 'ativo-cab__linha' }, el('span', { class: 'ativo-cab__ticker' }, ticker), nome ? [' ', el('span', { class: 'ativo-cab__nome', title: nome }, nome)] : null);
  const refs = {
    preco: el('span', { class: 'ativo-cab__valor num' }, preco),
    variacao: el('span', { class: `ativo-cab__variacao num ${classeSinal(variacao?.sinal)}` }, variacao?.texto || '–'),
    contexto: el('p', { class: 'ativo-cab__contexto' }, contexto),
  };
  const no = el('header', { class: 'ativo-cab' },
    el('div', { class: 'ativo-cab__id' }, logo, el('div', { class: 'ativo-cab__textos' }, titulo, mercado && el('p', { class: 'ativo-cab__mercado' }, mercado))),
    el('div', { class: 'ativo-cab__cotacao' }, el('p', { class: 'ativo-cab__linha-preco' }, refs.preco, ' ', refs.variacao), refs.contexto));
  return {
    no,
    definir({ preco: p, variacao: v, contexto: c }) {
      if (p !== undefined) refs.preco.textContent = p;
      if (v !== undefined) { refs.variacao.textContent = v?.texto || '–'; refs.variacao.className = `ativo-cab__variacao num ${classeSinal(v?.sinal)}`; }
      if (c !== undefined) refs.contexto.textContent = c;
    },
  };
}
export const textoVariacao = (v, comValor = true) => (v ? { texto: comValor ? `${brlSinal(v.abs)} (${pctSinal(v.v)})` : pctSinal(v.v), sinal: v.v } : null);

// Tabela de indicadores: 12 células [rótulo, valor] em 4 colunas por 3 linhas, lidas por coluna (como o Stocks).
// Valor ausente mostra "–", nunca um zero inventado.
export function tabelaIndicadores(itens, rotulo = 'Indicadores') {
  const vazio = (v) => v == null || v === '' || v === '—' || v === '-';
  return el('dl', { class: 'indicadores', 'aria-label': rotulo }, itens.map(([nome, valor, classe]) => el('div', {}, el('dt', {}, nome), el('dd', { class: vazio(valor) ? 'indicadores__ausente' : classe || '' }, vazio(valor) ? '–' : valor))));
}

// Indicador de carregamento do gráfico: círculo ao centro da área; estático em movimento reduzido (CSS).
export const carregandoGrafico = () => el('div', { class: 'grafico-preco__carregando', role: 'status', 'aria-label': 'Carregando o gráfico' }, el('i'));
