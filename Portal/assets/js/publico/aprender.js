// Catálogo da área de conhecimento: trilhas, artigos por nível e busca.
import { el, semAcento, plural, adiar } from '../util.js';
import { conteudo } from '../dados.js';
import { cartaoArtigo, NIVEIS } from './inicio.js';
import { ilustracao } from '../ilustracoes.js';

export async function pagina(ctx, [trilhaId]) {
  const c = await conteudo();
  const trilha = c.trilhas.find((t) => t.id === trilhaId);
  if (trilha) {
    return { titulo: trilha.nome, no: el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
      el('header', { class: 'pagina__cabecalho' }, el('div', { class: 'cabecalho-artigo__ilustracao' }, ilustracao(trilha.id, { tracar: true })), el('p', { class: 'kicker' }, el('a', { href: '#aprender' }, 'Aprender')), el('h1', { class: 'titulo' }, `${trilha.nome}.`), el('p', { class: 'copy introducao' }, trilha.descricao || trilha.resumo)),
      el('ol', { class: 'lista' }, trilha.artigos.map((a, i) => el('li', {}, el('a', { class: 'fila fila--entre', href: `#artigo/${a.slug}` },
        el('span', { class: 'empilha' }, el('span', { class: 'kicker' }, `${i + 1}. ${a.titulo}`), el('span', { class: 'copy introducao' }, a.resumo)),
        el('span', { class: 'legenda' }, `${NIVEIS[a.nivel]} · ${a.minutos} min`))))))) };
  }

  const todos = c.trilhas.flatMap((t) => t.artigos.map((a) => ({ ...a, trilha: t.nome })));
  let filtroNivel = 0, termo = '';
  const lista = el('div', { class: 'empilha empilha--folgada' });
  const desenhar = () => {
    const t = semAcento(termo.trim());
    const passa = (a) => (!filtroNivel || a.nivel === filtroNivel) && (!t || semAcento(`${a.titulo} ${a.resumo} ${(a.temas || []).join(' ')}`).includes(t));
    const grupos = c.trilhas.map((tr) => ({ tr, artigos: tr.artigos.filter(passa) })).filter((g) => g.artigos.length);
    lista.replaceChildren(...(grupos.length ? grupos.map(({ tr, artigos }) => el('section', { class: 'empilha', 'aria-label': tr.nome },
      el('div', { class: 'destaques__cabecalho' }, el('h2', { class: 'kicker' }, tr.nome), el('a', { href: `#aprender/${tr.id}` }, 'Ver a trilha')),
      el('div', { class: 'grade-3' }, artigos.map(cartaoArtigo)))) : [el('p', { class: 'vazio' }, 'Nenhum artigo com esse filtro.')]));
    ctx.animar(lista);
  };
  const busca = el('input', { class: 'campo', type: 'search', placeholder: 'Buscar: CDB, Selic, opções…', 'aria-label': 'Buscar artigos', autocomplete: 'off' });
  busca.addEventListener('input', adiar(() => { termo = busca.value; desenhar(); }));
  const niveis = el('div', { class: 'segmento', role: 'group', 'aria-label': 'Nível' }, [[0, 'Todos'], [1, 'Essencial'], [2, 'Intermediário'], [3, 'Avançado']].map(([n, nome]) => el('button', { type: 'button', 'aria-pressed': String(n === 0), onclick: (e) => { filtroNivel = n; [...niveis.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); desenhar(); } }, nome)));
  desenhar();
  return { titulo: 'Aprender', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Aprender'), el('h1', { class: 'titulo' }, 'Conhecimento, do essencial ao avançado.'), el('p', { class: 'copy introducao' }, `${plural(todos.length, 'artigo', 'artigos')} em ${c.trilhas.length} trilhas. Cada um traz o conceito, exemplos com números, vantagens, riscos e as fontes oficiais.`)),
    el('div', { class: 'fila', style: null }, el('div', { class: 'busca' }, busca), niveis),
    el('div', { class: 'espaco-topo' }, lista))) };
}
