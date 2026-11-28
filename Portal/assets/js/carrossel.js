// Carrossel horizontal (Identidade Visual - Apple, "Carrosséis", família A, com o autoplay medido, seção 8).
// - Encaixe e rolagem são nativos (scroll-snap, roda, toque); este módulo só escreve o que a Apple escreve por script.
// - Só a legenda se move em relação ao cartão: translateX de até 162 px (linear) e opacidade cúbica, em função direta
//   de scrollLeft, sem transição. A mídia (o número do cartão) acompanha a rolagem sem deslocamento próprio.
// - Pontos: o atual mede 48 × 8 (32 × 8 em S) e a largura é interpolada linearmente com a rolagem.
// - Autoplay: ao entrar em vista, o ponto atual enche em 6,15 s (linear) e o avanço leva 950 ms; para no último cartão
//   com "Replay"; botão Play/Pause; clique em ponto ou seta pausa; movimento reduzido nunca inicia sozinho.
// - Botões: ponto salta em 950 ms (ease-in-out, qualquer distância); seta anda um cartão em 450 ms; um segundo clique
//   durante a animação não soma. Movimento reduzido: salto direto, legenda parada e visível.
// - Teclado (A5): setas, Home e End no trilho e nos pontos; cartões fora do atual e dos vizinhos ficam inert (A4).
// - Entrada da cápsula: mola por tempo, ligada quando o topo do trilho chega a 60% da altura da tela (só com movimento).
import { el } from './util.js';

const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const DESLOCAMENTO = 162;

// cubic-bezier(x1, y1, x2, y2) como função de 0 a 1 (Newton, como o navegador faz).
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    return Y(Math.min(1, Math.max(0, t)));
  };
}
const EASE_PONTO = bezier(0.42, 0, 0.58, 1); // --ease-in-out
const EASE_SETA = bezier(0.37, 0, 0.63, 1); // --ease-seta
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// cartoes: elementos de cartão; a legenda de cada um é o filho .carrossel__legenda (se existir).
export function carrossel(cartoes, rotulo) {
  const n = cartoes.length;
  const trilho = el('div', { class: 'carrossel__trilho', role: 'region', 'aria-roledescription': 'carrossel', 'aria-label': rotulo, tabindex: '0' }, cartoes);
  const botoes = cartoes.map((_, i) => el('button', { type: 'button', 'aria-label': `Ir para o cartão ${i + 1}`, 'aria-current': String(i === 0), tabindex: i === 0 ? '0' : '-1' }, el('i')));
  const pontos = el('div', { class: 'carrossel__pontos' }, botoes);
  const reproducao = el('button', { class: 'carrossel__reproducao', type: 'button', 'aria-label': `Tocar galeria ${rotulo}` }, el('i'));
  const grupo = el('div', { class: 'carrossel__grupo' }, pontos, reproducao);
  const setas = [
    el('button', { class: 'carrossel__seta', type: 'button', 'aria-label': 'Anterior', dataset: { direcao: '-1' } }, el('i')),
    el('button', { class: 'carrossel__seta carrossel__seta--proxima', type: 'button', 'aria-label': 'Próximo', dataset: { direcao: '1' } }, el('i')),
  ];
  const controles = el('div', { class: 'carrossel__controles' }, grupo, el('div', { class: 'carrossel__setas' }, setas));
  const aviso = el('p', { class: 'carrossel__aviso', 'aria-live': 'polite' });
  const no = el('div', { class: 'carrossel', dataset: { estado: 'parado' } }, trilho, controles, aviso);
  const legendas = cartoes.map((c) => c.querySelector('.carrossel__legenda'));

  const passo = () => (n > 1 ? cartoes[1].offsetLeft - cartoes[0].offsetLeft : trilho.clientWidth) || 1;
  const maximo = () => Math.max(0, trilho.scrollWidth - trilho.clientWidth);
  const posicao = () => limitar(trilho.scrollLeft / passo(), 0, n - 1); // 0 a n-1, contínuo
  const atual = () => Math.round(posicao());

  let indice = -1;
  function marcar(i) {
    if (i === indice) return;
    indice = i;
    botoes.forEach((b, k) => { b.setAttribute('aria-current', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
    cartoes.forEach((c, k) => { const longe = Math.abs(k - i) > 1; c.toggleAttribute('inert', longe); if (longe) c.setAttribute('aria-hidden', 'true'); else c.removeAttribute('aria-hidden'); });
  }
  // Escrito a cada quadro depois de uma rolagem: largura dos pontos e legendas em função de scrollLeft.
  function atualizar() {
    const x = posicao(), pequeno = matchMedia('(max-width: 734px)').matches;
    const [fator, teto] = pequeno ? [24, 32] : [40, 48];
    botoes.forEach((b, k) => b.style.setProperty('--w', `${limitar(8 + fator * (1 - Math.abs(x - k)), 8, teto).toFixed(2)}px`));
    if (!reduzido()) {
      legendas.forEach((l, k) => {
        if (!l) return;
        const d = k - x, a = Math.min(1, Math.abs(d));
        l.style.transform = `translate3d(${(Math.sign(d) * DESLOCAMENTO * a).toFixed(2)}px, 0, 0)`;
        l.style.opacity = ((1 - a) ** 3).toFixed(4);
        l.dataset.fora = a > 0.5 ? 'sim' : 'nao';
      });
    }
    marcar(atual());
    const topo = trilho.scrollLeft, fim = maximo();
    setas[0].disabled = topo <= 1;
    setas[1].disabled = topo >= fim - 1;
  }
  let pedido = 0;
  const agendar = () => { cancelAnimationFrame(pedido); pedido = requestAnimationFrame(atualizar); };
  trilho.addEventListener('scroll', agendar, { passive: true });
  new ResizeObserver(() => { atualizar(); verificarEntrada(); }).observe(trilho);

  // Rolagem por script (o `behavior: smooth` não controla duração nem curva). O encaixe fica desligado durante a
  // animação e volta no fim; qualquer gesto da pessoa cancela a animação.
  let animacao = 0, emAndamento = false;
  const parar = () => { cancelAnimationFrame(animacao); if (emAndamento) { emAndamento = false; trilho.style.scrollSnapType = ''; } };
  ['wheel', 'touchstart', 'pointerdown'].forEach((ev) => trilho.addEventListener(ev, parar, { passive: true }));
  function ir(i, duracao, curva) {
    const alvo = Math.min(Math.max(0, i), n - 1) * passo(), destino = Math.min(alvo, maximo());
    parar();
    if (reduzido() || duracao <= 0) { trilho.scrollTo({ left: destino, behavior: 'auto' }); return; }
    const inicio = trilho.scrollLeft, t0 = performance.now();
    emAndamento = true;
    trilho.style.scrollSnapType = 'none';
    const quadro = (t) => {
      const f = Math.min(1, (t - t0) / duracao);
      trilho.scrollLeft = inicio + (destino - inicio) * curva(f);
      if (f < 1) animacao = requestAnimationFrame(quadro); else { emAndamento = false; trilho.style.scrollSnapType = ''; }
    };
    animacao = requestAnimationFrame(quadro);
  }
  const anunciar = (i) => { aviso.textContent = `Cartão ${i + 1} de ${n}: ${cartoes[i].querySelector('.card__titulo')?.textContent || ''}`; };
  const irPonto = (i) => { ir(i, 950, EASE_PONTO); anunciar(i); };
  const irSeta = (i) => { ir(i, 450, EASE_SETA); anunciar(limitar(i, 0, n - 1)); };

  // Autoplay. Estados: parado (início, ou depois de um clique: preenchimento de 15%), tocando, pausado (a barra congela
  // e continua de onde parou) e fim (último cartão concluído: Replay, sem repetir sozinho).
  const rotuloGaleria = rotulo;
  function definirEstado(e) {
    no.dataset.estado = e;
    reproducao.setAttribute('aria-label', `${e === 'tocando' ? 'Pausar' : e === 'fim' ? 'Repetir' : 'Tocar'} galeria ${rotuloGaleria}`);
  }
  const parar_ = () => { if (no.dataset.estado !== 'parado') definirEstado('parado'); };
  reproducao.addEventListener('click', () => {
    const e = no.dataset.estado;
    if (e === 'tocando') definirEstado('pausado');
    else if (e === 'fim') { irAuto(0); definirEstado('tocando'); }
    else if (e === 'pausado') definirEstado('tocando');
    else if (reduzido()) { definirEstado('tocando'); } else definirEstado('tocando');
  });
  function irAuto(i) { ir(i, 950, EASE_PONTO); }
  pontos.addEventListener('animationend', (ev) => {
    if (ev.animationName !== 'progresso-ponto' || no.dataset.estado !== 'tocando') return;
    const i = atual();
    if (i < n - 1) irAuto(i + 1); else definirEstado('fim');
  });
  botoes.forEach((b, k) => b.addEventListener('click', () => { parar_(); irPonto(k); }));
  setas.forEach((s) => s.addEventListener('click', () => { if (emAndamento) return; parar_(); irSeta(atual() + Number(s.dataset.direcao)); }));
  // Teclado: nos pontos, a seta move o foco e ativa o ponto (como a aba de ativação automática); no trilho, move o cartão.
  const destinoTecla = (tecla, de) => (tecla === 'ArrowRight' ? de + 1 : tecla === 'ArrowLeft' ? de - 1 : tecla === 'Home' ? 0 : tecla === 'End' ? n - 1 : null);
  pontos.addEventListener('keydown', (e) => {
    const k = botoes.indexOf(document.activeElement), d = destinoTecla(e.key, k);
    if (k < 0 || d === null) return;
    e.preventDefault();
    const alvo = limitar(d, 0, n - 1);
    botoes.forEach((b, j) => { b.tabIndex = j === alvo ? 0 : -1; });
    botoes[alvo].focus(); parar_(); irPonto(alvo);
  });
  trilho.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const d = destinoTecla(e.key, atual());
    if (d === null) return;
    e.preventDefault(); parar_(); irSeta(d);
  });

  // Entrada da cápsula: mola subamortecida por tempo (Carrosséis, 6.3). Sem movimento, nasce no estado final.
  let entrou = false;
  function entrar() {
    if (entrou) return;
    entrou = true;
    removeEventListener('scroll', verificarEntrada);
    controles.classList.add('aberto');
    if (reduzido()) return; // sem movimento: nasce no estado final e nunca toca sozinho
    setTimeout(() => { if (no.dataset.estado === 'parado') definirEstado('tocando'); }, 120);
    if (!controles.animate) return;
    const base = { fill: 'backwards' };
    controles.animate([
      { transform: 'translateY(180px)', offset: 0, easing: 'cubic-bezier(.2,.7,.3,1)' }, { transform: 'translateY(-42.5px)', offset: 0.195, easing: 'ease-in-out' },
      { transform: 'translateY(9px)', offset: 0.36, easing: 'ease-in-out' }, { transform: 'translateY(-4px)', offset: 0.52, easing: 'ease-in-out' },
      { transform: 'translateY(1.5px)', offset: 0.72, easing: 'ease-in-out' }, { transform: 'translateY(0)', offset: 1 },
    ], { ...base, duration: 2200 });
    pontos.animate([
      { transform: 'scale(1.3)', offset: 0, easing: 'ease-in-out' }, { transform: 'scale(.81)', offset: 0.325, easing: 'ease-in-out' },
      { transform: 'scale(1.05)', offset: 0.6, easing: 'ease-in-out' }, { transform: 'scale(.99)', offset: 0.82, easing: 'ease-in-out' }, { transform: 'scale(1)', offset: 1 },
    ], { ...base, duration: 1600 });
    botoes.forEach((b) => {
      const ponto = b.firstElementChild;
      ponto.animate([{ opacity: 0 }], { ...base, duration: 100, delay: 740, easing: 'ease-in' });
      ponto.animate([{ transform: 'translateY(36px)' }], { ...base, duration: 300, delay: 740, easing: 'ease-out' });
    });
    setas.forEach((s) => s.animate([{ opacity: 0, transform: 'scale(0)' }], { ...base, duration: 200, delay: 940, easing: 'ease-out' }));
    reproducao.animate([{ opacity: 0, transform: 'scale(0)' }], { ...base, duration: 200, delay: 570, easing: 'ease-out' });
  }
  // Gatilho de posição, relativo ao trilho (nunca scrollY): o topo chega a 60% da altura do trilho acima da base da tela.
  function verificarEntrada() {
    if (entrou) return;
    if (!document.documentElement.classList.contains('movimento')) { entrar(); return; }
    const r = trilho.getBoundingClientRect();
    if (r.height && r.top <= innerHeight - 0.6 * Math.min(r.height, innerHeight * 0.9) && r.bottom > 0) entrar();
  }
  addEventListener('scroll', verificarEntrada, { passive: true });
  // Garantia por tempo: aba em segundo plano ou gatilho perdido não deixam os controles escondidos.
  setTimeout(() => { if (!entrou && trilho.isConnected && trilho.getBoundingClientRect().top < innerHeight) entrar(); }, 2500);
  requestAnimationFrame(() => { atualizar(); verificarEntrada(); });
  return no;
}
