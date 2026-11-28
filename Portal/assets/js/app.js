// Orquestração: menu, rotas, troca de página, barra de carregamento, aviso e movimento.
// Cada rota é um módulo carregado sob demanda que exporta `pagina(ctx, partes)` e devolve
// { titulo, no, secao }. As rotas privadas só abrem com o cofre aberto.
import { $, el, reduzido } from './util.js';
import { sessao, aoMudar, retomar, bloquear, abrirAmostra } from './privado/cofre.js';

export const VERSAO_SITE = '1.0';

const ROTAS = {
  inicio: { modulo: () => import('./publico/inicio.js') },
  aprender: { modulo: () => import('./publico/aprender.js'), secao: 'aprender' },
  artigo: { modulo: () => import('./publico/artigo.js'), secao: 'aprender' },
  indicadores: { modulo: () => import('./publico/indicadores.js'), secao: 'indicadores' },
  simuladores: { modulo: () => import('./publico/simuladores.js'), secao: 'simuladores' },
  sobre: { modulo: () => import('./publico/sobre.js') },
  saude: { modulo: () => import('./publico/saude.js') },
  entrar: { modulo: () => import('./privado/acesso.js') },
  carteira: { modulo: () => import('./privado/carteira.js'), privada: true, secao: 'carteira' },
  ativo: { modulo: () => import('./privado/ativo.js'), privada: true, secao: 'carteira' },
  lancar: { modulo: () => import('./privado/lancar.js'), privada: true, secao: 'carteira' },
  analise: { modulo: () => import('./privado/analise.js'), privada: true, secao: 'analise' },
  agente: { modulo: () => import('./privado/agente.js'), privada: true, secao: 'agente' },
  relatorio: { modulo: () => import('./privado/relatorio.js'), privada: true, secao: 'agente' },
  alertas: { modulo: () => import('./privado/alertas.js'), privada: true, secao: 'alertas' },
  ajustes: { modulo: () => import('./privado/ajustes.js'), privada: true },
};
const MENU_PUBLICO = [['aprender', 'Aprender'], ['indicadores', 'Indicadores'], ['simuladores', 'Simuladores']];
const MENU_PRIVADO = [['carteira', 'Carteira'], ['analise', 'Análise'], ['agente', 'Agente'], ['alertas', 'Alertas'], ['aprender', 'Aprender']];

const pagina = $('pagina'), secoes = $('secoes'), acao = $('acao');
let atual = null, pedido = 0;

// ---- Aviso flutuante e barra de carregamento ----
let tempoAviso;
export function avisar(texto) {
  const a = $('aviso');
  a.textContent = texto; a.hidden = false;
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(() => { a.hidden = true; }, 3500);
}
let emCurso = 0;
export async function comProgresso(promessa) {
  const barra = $('carregamento');
  emCurso++; barra.dataset.ativo = ''; barra.setAttribute('aria-hidden', 'false');
  const minimo = new Promise((ok) => setTimeout(ok, 300));
  try { return await promessa; } finally {
    await minimo;
    if (--emCurso === 0) { delete barra.dataset.ativo; barra.setAttribute('aria-hidden', 'true'); }
  }
}

// ---- Menu ----
function montarMenu() {
  const itens = sessao.aberta ? MENU_PRIVADO : MENU_PUBLICO;
  secoes.replaceChildren(...itens.map(([rota, nome]) => el('a', { href: `#${rota}`, dataset: { secao: rota } }, nome)));
  acao.textContent = sessao.aberta ? 'Lançar' : 'Entrar';
  acao.href = sessao.aberta ? '#lancar' : '#entrar';
  $('rodape-sair').hidden = !sessao.aberta;
  $('rodape-ajustes').hidden = !sessao.aberta;
  marcarSecao(atual?.secao);
  acompanharBarra();
}
function marcarSecao(secao) {
  for (const a of secoes.children) {
    if (a.dataset.secao === secao) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' }); } else a.removeAttribute('aria-current');
  }
}
// Esmaecimento nas bordas da lista de seções quando ela rola (celular).
function acompanharBarra() {
  const fim = secoes.scrollLeft + secoes.clientWidth >= secoes.scrollWidth - 2;
  secoes.dataset.inicio = secoes.scrollLeft <= 2 ? 'sim' : 'nao';
  secoes.dataset.fim = fim ? 'sim' : 'nao';
}
secoes.addEventListener('scroll', acompanharBarra, { passive: true });

// Menu superior (adaptação A1): faixa no alto da página, pílula flutuante ao rolar. O gatilho é um
// elemento sentinela no alto do conteúdo (#sentinela), observado por IntersectionObserver, e não o
// scrollY: a barra flutua quando a sentinela passa 24 px acima da borda de baixo da barra. A folga
// de 24 px e a pílula vêm de navegacao.css. Sem IntersectionObserver, a barra fica em faixa.
let observadorTopo = null;
function acompanharTopo() {
  const topo = $('topo'), sentinela = $('sentinela');
  if (!('IntersectionObserver' in window) || !sentinela) return;
  observadorTopo?.disconnect();
  const limite = Math.max(0, Math.round(topo.offsetHeight - 24));
  observadorTopo = new IntersectionObserver(([e]) => topo.classList.toggle('topo--flutuante', !e.isIntersecting && e.boundingClientRect.top < limite),
    { rootMargin: `-${limite}px 0px 0px 0px`, threshold: 0 });
  observadorTopo.observe(sentinela);
}
const medirTopo = () => { document.documentElement.style.setProperty('--altura-topo', `${$('topo').offsetHeight}px`); acompanharTopo(); };

// ---- Movimento: revelação temporal única (Animação e imagens, 3.1) ----
// O gatilho é do grupo (a seção): quando o topo do primeiro bloco cruza 80% da altura da janela, todos os blocos
// do grupo entram, um a cada 150 ms, em 850 ms (esmaecimento ease-in-out; subida de 30 px mais rápida). Acontece
// uma vez: voltar à página não repete nem esconde. Só com .movimento (sem preferência por movimento reduzido).
const LINHA_REVELACAO = 0.8;
const grupoDe = (n) => n.closest('section') || n.parentElement;
function revelarGrupo(grupo) {
  const blocos = [...grupo.querySelectorAll('[data-subir]:not(.visivel)')];
  blocos.forEach((n, i) => {
    const atraso = Math.min(i, 6) * 150;
    n.style.setProperty('--atraso', `${atraso}ms`);
    n.classList.add('visivel');
    observador?.unobserve(n);
    setTimeout(() => n.classList.add('pronta'), atraso + 900); // tira o will-change depois de animar
  });
}
const observador = 'IntersectionObserver' in window ? new IntersectionObserver((entradas) => {
  for (const e of entradas) if (e.isIntersecting || e.boundingClientRect.top < innerHeight * LINHA_REVELACAO) revelarGrupo(grupoDe(e.target));
}, { rootMargin: `0px 0px -${(1 - LINHA_REVELACAO) * 100}% 0px`, threshold: 0 }) : null;
export function animar(raiz = pagina) {
  if (!observador || !document.documentElement.classList.contains('movimento')) return;
  // Blocos de conteúdo: o que está direto na coluna de cada seção. A primeira seção (abertura) não anima o título.
  raiz.querySelectorAll('section.secao').forEach((sec, i) => {
    if (i === 0) return;
    sec.querySelectorAll(':scope > .conteudo > *').forEach((n) => { if (!n.hidden && !n.hasAttribute('data-subir') && !n.querySelector('[data-subir]')) n.setAttribute('data-subir', ''); });
  });
  raiz.querySelectorAll('[data-subir]').forEach((n) => observador.observe(n));
  // Garantia por tempo: com a aba em segundo plano o observador não dispara; nada fica invisível.
  setTimeout(() => raiz.querySelectorAll('[data-subir]:not(.visivel)').forEach((n) => { const r = n.getBoundingClientRect(); if (r.top < innerHeight) revelarGrupo(grupoDe(n)); }), 2500);
}

// ---- Rotas ----
export const navegar = (rota) => { if (location.hash === `#${rota}`) rotear(); else location.hash = rota; };
const ctx = { avisar, comProgresso, navegar, animar, sessao, versao: VERSAO_SITE };

// Blocos de espera com as medidas de uma página: sobretítulo, título, duas linhas de texto e um bloco
// de conteúdo. Mesmos blocos da primeira abertura (index.html).
function esqueletoPagina() {
  return el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('span', { class: 'esqueleto esqueleto--kicker' }), el('span', { class: 'esqueleto esqueleto--titulo' }),
    el('span', { class: 'esqueleto esqueleto--linha' }), el('span', { class: 'esqueleto esqueleto--linha esqueleto--curta' }),
    el('span', { class: 'esqueleto esqueleto--bloco' })));
}

async function rotear() {
  const meu = ++pedido;
  const [nome, ...partes] = decodeURIComponent(location.hash.slice(1) || 'inicio').split('/');
  const rota = ROTAS[nome] || ROTAS.inicio;
  if (rota.privada && !sessao.aberta) { sessionStorage.setItem('financas:voltar', location.hash.slice(1)); return navegar('entrar'); }
  atual?.aoSair?.();
  // Página que demora (dados da CVM, quadro da carteira, relatório): depois de 160 ms, blocos neutros
  // com o formato de uma página entram no lugar da anterior, como no Escócia 2027. Antes disso, nada
  // muda: troca rápida não pisca. Os blocos não pulsam; só a barra azul do menu se move.
  const espera = setTimeout(() => { if (meu === pedido) { pagina.replaceChildren(esqueletoPagina()); pagina.setAttribute('aria-busy', 'true'); } }, 160);
  let resultado;
  try {
    const modulo = await comProgresso(rota.modulo());
    resultado = await comProgresso(modulo.pagina(ctx, partes));
  } catch (e) {
    console.error(e);
    resultado = { titulo: 'Algo deu errado', no: el('section', { class: 'secao' }, el('div', { class: 'conteudo' }, el('h1', { class: 'titulo' }, 'Não foi possível abrir esta página.'), el('p', { class: 'copy introducao' }, e.message || 'Tente de novo em instantes.'), el('p', { class: 'espaco-topo' }, el('a', { class: 'pill', href: '#inicio' }, 'Voltar ao início')))) };
  }
  clearTimeout(espera);
  if (meu !== pedido || !resultado) return; // outra navegação começou enquanto esta carregava
  pagina.removeAttribute('aria-busy');
  atual = { ...resultado, secao: resultado.secao ?? rota.secao };
  document.title = resultado.titulo ? `${resultado.titulo} · Finanças` : 'Finanças';
  pagina.replaceChildren(resultado.no);
  pagina.dataset.rota = location.hash.slice(1) || 'inicio'; // marca a rota já desenhada (usada pelos testes)
  marcarSecao(atual.secao);
  // Só o conteúdo entra por esmaecimento; o menu não participa da troca.
  if (!reduzido()) { pagina.classList.remove('entrando'); void pagina.offsetWidth; pagina.classList.add('entrando'); }
  scrollTo({ top: 0, behavior: 'auto' });
  animar();
}

// Rodapé: data dos dados abertos do dia e a identificação do portal com a versão.
async function preencherRodape() {
  $('rodape-versao').textContent = `Portal Finanças · versão ${VERSAO_SITE}`;
  try {
    const { indicadores } = await import('./dados.js');
    const { geradoEm } = await indicadores();
    if (!geradoEm) return;
    const d = new Date(geradoEm);
    $('rodape-dados').textContent = `Dados abertos (Banco Central, Tesouro Nacional e CVM) atualizados em ${d.toLocaleDateString('pt-BR')}, às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
    $('rodape-dados').hidden = false;
  } catch { /* sem os dados, o rodapé fica só com o aviso */ }
}

async function iniciar() {
  if (!reduzido()) document.documentElement.classList.add('movimento');
  medirTopo();
  new ResizeObserver(medirTopo).observe($('topo'));
  addEventListener('hashchange', rotear);
  $('rodape-sair').addEventListener('click', async () => { await bloquear(); avisar('Cofre bloqueado.'); navegar('inicio'); });
  aoMudar((motivo) => { if (motivo === 'abriu' || motivo === 'bloqueou') montarMenu(); });

  // Demonstração com dados fictícios: só em endereço local ou com ?amostra explícito.
  if (new URLSearchParams(location.search).has('amostra')) {
    try { abrirAmostra(await (await fetch('dados/amostra/carteira.json')).json()); } catch (e) { console.error(e); }
  } else {
    try { await retomar(); } catch (e) { console.error(e); }
  }
  montarMenu();
  await rotear();
  preencherRodape();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // Sincroniza em segundo plano ao abrir e ao voltar à aba, se a nuvem estiver ligada.
  const sincronizarQuieto = async () => {
    if (!sessao.aberta || !sessao.nuvem) return;
    try { const { sincronizar } = await import('./privado/sincronia.js'); const r = await comProgresso(sincronizar()); if (r.recebeu) rotear(); } catch (e) { console.warn(e.message); }
  };
  sincronizarQuieto();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizarQuieto(); });
  aoMudar((motivo) => { if (motivo === 'salvou') setTimeout(sincronizarQuieto, 1500); });
}

iniciar();
