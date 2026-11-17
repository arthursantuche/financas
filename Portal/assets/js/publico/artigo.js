// Página de um artigo: cabeçalho, corpo em Markdown com componentes, sumário, fontes e vizinhos.
import { el, dataBR, linkSeguro } from '../util.js';
import { conteudo, artigo, valoresAtuais } from '../dados.js';
import { separar, renderizar } from '../markdown.js';
import { componente } from './simuladores.js';
import { nivel, cartaoArtigo } from './inicio.js';
import { ilustracao } from '../ilustracoes.js';

export async function pagina(ctx, [slug]) {
  const c = await conteudo();
  const todos = c.trilhas.flatMap((t) => t.artigos.map((a) => ({ ...a, trilha: t })));
  const i = todos.findIndex((a) => a.slug === slug);
  if (i < 0) throw new Error('Artigo não encontrado.');
  const a = todos[i];
  const [texto, atuais] = await Promise.all([artigo(a.arquivo), valoresAtuais().catch(() => ({ valores: {}, referencia: null }))]);
  const { meta, corpo } = separar(texto);
  const { nos, secoes } = renderizar(corpo, { valores: atuais.valores, componente, lide: true });
  const usaValores = /\{\{[a-z0-9-]+\}\}/.test(corpo);
  const fontes = [meta.fonte].flat().filter(Boolean).map((f) => { const [nome, url] = f.split('|').map((s) => s.trim()); return { nome, url: linkSeguro(url) }; });

  const sumario = secoes.length >= 3 ? el('nav', { class: 'sumario', 'aria-label': 'Neste artigo' }, el('p', { class: 'selo' }, 'Neste artigo'), secoes.map((s) => el('a', { href: `#artigo/${slug}`, dataset: { alvo: s.id }, onclick: (e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, s.titulo))) : null;
  const prosa = el('article', { class: 'prosa' }, nos,
    el('footer', { class: 'artigo__fontes' },
      el('p', { class: 'selo' }, [meta.atualizado && `Texto revisado em ${dataBR(meta.atualizado)}`, usaValores && atuais.referencia && `números do dia: Banco Central, ${atuais.referencia}`].filter(Boolean).join(' · ')),
      fontes.length ? el('div', {}, el('p', { class: 'selo' }, 'Fontes'), el('ol', { class: 'legenda' }, fontes.map((f) => el('li', {}, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.nome) : f.nome)))) : null,
      el('p', { class: 'legenda' }, 'Conteúdo educativo. Não considera seus objetivos nem sua situação financeira e não é recomendação de investimento.')));

  // Marca no sumário a seção que está na tela.
  let observador = null;
  if (sumario && 'IntersectionObserver' in window) {
    observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) [...sumario.querySelectorAll('a')].forEach((l) => l.setAttribute('aria-current', String(l.dataset.alvo === e.target.id)));
    }, { rootMargin: '-20% 0px -70% 0px' });
    prosa.querySelectorAll('h2[id]').forEach((h) => observador.observe(h));
  }

  const anterior = todos[i - 1], proximo = todos[i + 1];
  const no = el('div', {},
    el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
      el('header', { class: 'pagina__cabecalho' },
        el('div', { class: 'cabecalho-artigo__ilustracao' }, ilustracao(a.trilha.id, { tracar: true })),
        el('p', { class: 'kicker' }, el('a', { href: `#aprender/${a.trilha.id}` }, a.trilha.nome)),
        el('h1', { class: 'titulo' }, meta.titulo || a.titulo),
        el('p', { class: 'fila' }, nivel(a.nivel), el('span', { class: 'legenda' }, `${a.minutos} min de leitura`))),
      el('div', { class: `artigo ${sumario ? 'artigo--com-sumario' : ''}` }, prosa, sumario))),
    el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' },
      el('h2', { class: 'titulo' }, 'Continue.'),
      el('div', { class: 'vizinhos' }, [anterior, proximo].filter(Boolean).map((v) => cartaoArtigo(v))))));
  return { titulo: a.titulo, no, aoSair: () => observador?.disconnect() };
}
