// Página inicial (pública): abertura, indicadores do dia, trilhas de conhecimento e simuladores.
import { el, numero, dataBR, plural } from '../util.js';
import { conteudo, indicadores } from '../dados.js';
import { carrossel } from '../carrossel.js';
import { SIMULADORES } from './simuladores.js';

export const NIVEIS = { 1: 'Essencial', 2: 'Intermediário', 3: 'Avançado' };
export const nivel = (n) => el('span', { class: 'nivel' }, el('span', { class: 'nivel__pontos', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => el('i', { 'data-cheio': i <= n }))), NIVEIS[n] || '');

function numeroChave(valor, sufixo, legenda) {
  return el('div', { class: 'numeros__item' }, el('dt', { class: 'numeros__legenda' }, legenda), el('dd', { class: 'numeros__valor' }, valor, el('small', {}, sufixo)));
}

export async function pagina() {
  const [c, ind] = await Promise.all([conteudo(), indicadores().catch(() => null)]);
  const totalArtigos = c.trilhas.reduce((s, t) => s + t.artigos.length, 0);

  const hero = el('section', { class: 'secao hero hero--financas' }, el('div', { class: 'conteudo' },
    el('p', { class: 'kicker' }, 'Educação financeira e investimentos'),
    el('h1', { class: 'display' }, 'Entenda antes de investir.'),
    el('p', { class: 'copy introducao' }, 'Como funcionam os investimentos no Brasil, com números oficiais do dia, exemplos resolvidos e simuladores. Sem jargão e sem promessa de retorno.'),
    el('div', { class: 'hero__acoes' }, el('a', { class: 'pill pill--azul', href: '#aprender' }, 'Começar a aprender'), el('a', { class: 'pill', href: '#simuladores' }, 'Abrir os simuladores')),
    ind && el('dl', { class: 'numeros numeros--quatro', 'data-subir': true },
      numeroChave(numero(ind.selicMeta.valor, 2), '%', 'Selic, ao ano'),
      numeroChave(numero(ind.cdiAnual.valor, 2), '%', 'CDI, ao ano'),
      numeroChave(numero(ind.ipca12m.valor, 2), '%', 'IPCA, em 12 meses'),
      numeroChave(numero(ind.juroRealExPost * 100, 2), '%', 'Juro real')),
    ind && el('a', { class: 'selo', href: '#indicadores' }, `Banco Central do Brasil · dados de ${dataBR(ind.geradoEm.slice(0, 10))} · ver todos os indicadores`)));

  const trilhas = el('section', { class: 'secao secao--mist faixa-carrossel destaques', id: 'trilhas' },
    el('div', { class: 'conteudo' }, el('div', { class: 'destaques__cabecalho' }, el('h2', { class: 'titulo' }, 'Trilhas de conhecimento.'), el('a', { href: '#aprender' }, plural(totalArtigos, 'artigo', 'artigos')))),
    carrossel(c.trilhas.map((t, i) => el('a', { class: 'card card--trilha', href: `#aprender/${t.id}` },
      el('p', { class: 'card__numero' }, String(i + 1).padStart(2, '0')),
      el('div', { class: 'carrossel__legenda' },
        el('div', { class: 'empilha' }, el('h3', { class: 'card__titulo' }, t.nome), el('p', { class: 'copy introducao' }, t.resumo)),
        el('div', { class: 'card__rodape' }, el('span', { class: 'legenda' }, plural(t.artigos.length, 'artigo', 'artigos')))))), 'Trilhas de conhecimento'));

  const comecar = c.trilhas.flatMap((t) => t.artigos).filter((a) => a.nivel === 1).slice(0, 6);
  const primeiros = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Por onde começar.'),
    el('div', { class: 'grade-3' }, comecar.map((a) => cartaoArtigo(a)))));

  const sims = el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
    el('div', { class: 'destaques__cabecalho' }, el('h2', { class: 'titulo' }, 'Faça as contas.'), el('a', { href: '#simuladores' }, 'Todos os simuladores')),
    el('div', { class: 'escolhas' }, ['juros-compostos', 'renda-fixa', 'marcacao-mercado', 'payoff'].map((id) => el('a', { class: 'escolha', href: `#simuladores/${id}`, 'data-subir': true }, el('span', { class: 'escolha__nome' }, SIMULADORES[id].titulo), el('span', { class: 'legenda' }, SIMULADORES[id].resumo))))));

  const metodo = el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('h2', { class: 'titulo' }, 'Como este portal trabalha.'),
    el('div', { class: 'grade-2' },
      el('div', { class: 'card card--auto card--info', 'data-subir': true }, el('h3', { class: 'kicker' }, 'Fontes primárias'), el('p', { class: 'copy introducao' }, 'Banco Central, CVM, B3 e Tesouro Nacional. Cada número mostra de onde veio e a data de referência.')),
      el('div', { class: 'card card--auto card--info', 'data-subir': true }, el('h3', { class: 'kicker' }, 'Contas abertas'), el('p', { class: 'copy introducao' }, 'As fórmulas dos simuladores são as mesmas da carteira, estão documentadas e são testadas a cada mudança.')),
      el('div', { class: 'card card--auto card--info', 'data-subir': true }, el('h3', { class: 'kicker' }, 'Educação, não recomendação'), el('p', { class: 'copy introducao' }, 'O conteúdo público explica como os investimentos funcionam. Decidir onde investir depende dos seus objetivos e da sua situação.'))),
    el('p', { class: 'espaco-topo' }, el('a', { class: 'pill', href: '#sobre' }, 'Metodologia e fontes'))));

  return { titulo: '', no: el('div', {}, hero, trilhas, primeiros, sims, metodo) };
}

export function cartaoArtigo(a) {
  return el('a', { class: 'card card--auto card--artigo card--contorno', href: `#artigo/${a.slug}`, 'data-subir': true },
    nivel(a.nivel), el('h3', { class: 'kicker' }, a.titulo), el('p', { class: 'copy introducao' }, a.resumo),
    el('div', { class: 'card__rodape' }, el('span', { class: 'legenda' }, `${a.minutos} min de leitura`)));
}
