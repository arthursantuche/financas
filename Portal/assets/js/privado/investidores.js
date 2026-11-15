// Fundos e ações: o que os fundos brasileiros declararam à CVM (CDA). Informação complementar,
// com defasagem de meses; a tela deixa isso explícito e nunca a apresenta como sinal de compra.
import { el, compacto, pct, inteiro, mesAno, classeSinal } from '../util.js';
import { grandes } from '../dados.js';

export async function presenca(codigo) {
  const g = await grandes().catch(() => null);
  const p = g?.acoes.find((a) => a.codigo === codigo);
  return p ? { ...p, referencia: g.referencia, posicao: g.acoes.indexOf(p) + 1 } : null;
}
export function blocoPresenca(p) {
  if (!p) return el('p', { class: 'vazio' }, 'Este papel não aparece entre as 200 maiores posições dos fundos brasileiros.');
  const it = (n, v, c = '') => el('div', {}, el('dt', {}, n), el('dd', { class: c }, v));
  return el('div', { class: 'empilha' }, el('dl', { class: 'estatisticas' },
    it('Fundos com posição', `${inteiro(p.fundos)}${p.fundosAntes != null ? ` (${inteiro(p.fundosAntes)} no mês anterior)` : ''}`), it('Valor em fundos', compacto(p.valor)), it('Posição no ranking', `${p.posicao}ª`),
    it('Compras no mês', compacto(p.compras)), it('Vendas no mês', compacto(p.vendas)), it('Saldo no mês', compacto(p.fluxo), classeSinal(p.fluxo))),
    el('p', { class: 'selo' }, `CVM, carteiras de fundos de ${mesAno(p.referencia + '-01')}. Defasagem de meses e posições sob sigilo de fora: serve de contexto, não de sinal.`));
}

export async function pagina() {
  const g = await grandes();
  const ref = mesAno(g.referencia + '-01');
  return { titulo: 'Fundos e ações', no: el('div', {},
    el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
      el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, el('a', { href: '#analise' }, 'Análise')), el('h1', { class: 'titulo' }, 'O que os fundos carregam.'), el('p', { class: 'copy introducao' }, `Posições em ações de ${inteiro(g.totalFundos)} fundos brasileiros no fim de ${ref}, declaradas à CVM.`)),
      el('div', { class: 'natureza' }, el('strong', {}, 'Como ler'), el('span', { class: 'legenda' }, g.observacao + ' Um papel estar na carteira de muitos fundos mostra consenso passado, não retorno futuro: gestores erram, e quando esta informação chega aqui eles já podem ter mudado de posição.')),
      el('div', { class: 'tabela-rolavel espaco-topo' }, el('table', { class: 'tabela tabela--numeros' },
        el('thead', {}, el('tr', {}, ['Papel', 'Valor em fundos', 'Fundos', 'Mês anterior', 'Saldo de compras no mês'].map((t) => el('th', { scope: 'col' }, t)))),
        el('tbody', {}, g.acoes.slice(0, 60).map((a) => el('tr', {}, el('th', { scope: 'row' }, el('a', { href: `#analise/${a.codigo}` }, a.codigo)), el('td', {}, compacto(a.valor)), el('td', {}, inteiro(a.fundos)), el('td', {}, a.fundosAntes == null ? '—' : inteiro(a.fundosAntes)), el('td', { class: classeSinal(a.fluxo) }, compacto(a.fluxo))))))))),
    el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
      el('h2', { class: 'titulo' }, 'Maiores carteiras de ações.'),
      el('p', { class: 'copy introducao' }, 'Os fundos com mais dinheiro em ações e as posições que mais pesam em cada um. Muitos são veículos de um único investidor ou de um grupo controlador.'),
      el('div', { class: 'grade-2' }, g.maiores.slice(0, 16).map((f) => el('div', { class: 'card card--auto', 'data-subir': true },
        el('h3', { class: 'kicker' }, f.nome), el('p', { class: 'legenda' }, `${compacto(f.valorAcoes)} em ações · CNPJ ${f.cnpj}`),
        el('ul', { class: 'alocacao__lista' }, f.posicoes.slice(0, 6).map((p) => { const i = el('i'); i.style.background = 'var(--cor-texto)'; return el('li', {}, i, el('a', { href: `#analise/${p.codigo}` }, p.codigo), el('span', { class: 'legenda' }, compacto(p.valor)), el('strong', {}, pct(p.peso, 1))); }))))),
      el('p', { class: 'selo espaco-topo' }, `Fonte: ${g.fonte}. Referência: ${ref}. Coleta de ${g.geradoEm.slice(0, 10).split('-').reverse().join('/')}.`)))) };
}
