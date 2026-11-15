// Renderizador do conteúdo editorial (Portal/conteudo/*.md). Um subconjunto de Markdown, convertido
// direto em elementos (sem innerHTML), mais as extensões do portal:
//   {{selic}}                 valor atual de um indicador (lista em VALORES, abaixo)
//   :::destaque Título        caixa com a ideia central      (também :::exemplo e :::atencao)
//   :::simulador nome         componente interativo (assets/js/publico/simuladores.js)
//   :::grafico nome           gráfico de uma série oficial
// Formato do arquivo: cabeçalho entre linhas "---" (chave: valor) e o corpo em Markdown.
import { el, slug, linkSeguro } from './util.js';

export function separar(texto) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto.replace(/\r\n/g, '\n'));
  if (!m) return { meta: {}, corpo: texto };
  const meta = {};
  for (const linha of m[1].split('\n')) {
    const i = linha.indexOf(':');
    if (i < 0) continue;
    const chave = linha.slice(0, i).trim(), valor = linha.slice(i + 1).trim();
    const lido = /^\[.*\]$/.test(valor) ? valor.slice(1, -1).split('|').map((s) => s.trim()).filter(Boolean) : valor;
    // Chave repetida (várias linhas "fonte:") vira lista.
    meta[chave] = chave in meta ? [meta[chave]].flat().concat(lido) : lido;
  }
  return { meta, corpo: m[2] };
}

// Texto corrido: **negrito**, *itálico*, `código`, [texto](url) e {{valor}}.
function corrido(texto, ctx) {
  const nos = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\{\{([a-z0-9-]+)\}\})/g;
  let ultimo = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) nos.push(texto.slice(ultimo, m.index));
    if (m[1]) nos.push(el('strong', {}, corrido(m[2], ctx)));
    else if (m[3]) nos.push(el('em', {}, corrido(m[4], ctx)));
    else if (m[5]) nos.push(el('code', {}, m[6]));
    else if (m[7]) {
      const destino = m[9];
      if (destino.startsWith('#')) nos.push(el('a', { href: destino }, m[8]));
      else if (linkSeguro(destino)) nos.push(el('a', { href: destino, target: '_blank', rel: 'noopener' }, m[8]));
      else nos.push(m[8]);
    } else if (m[10]) nos.push(el('span', { class: 'num', dataset: { valor: m[11] } }, ctx.valores?.[m[11]] ?? '…'));
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) nos.push(texto.slice(ultimo));
  return nos;
}

function tabela(linhas, ctx) {
  const celulas = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const cab = celulas(linhas[0]), corpo = linhas.slice(2).map(celulas);
  return el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {}, cab.map((c) => el('th', { scope: 'col' }, corrido(c, ctx))))),
    el('tbody', {}, corpo.map((l) => el('tr', {}, l.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, corrido(c, ctx)) : el('td', {}, corrido(c, ctx)))))))));
}

const ROTULOS = { destaque: 'Em resumo', exemplo: 'Exemplo', atencao: 'Atenção' };

// Devolve { nos, secoes: [{ id, titulo }] }. ctx: { valores, componente(tipo, nome, args) }.
export function renderizar(corpo, ctx = {}) {
  const linhas = corpo.replace(/\r\n/g, '\n').split('\n');
  const nos = [], secoes = [];
  let i = 0, primeiro = true;
  const bloco = (parar) => { const b = []; while (i < linhas.length && !parar(linhas[i])) b.push(linhas[i++]); return b; };
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^(#{2,3})\s+(.*)$/.exec(l))) {
      const id = slug(m[2]);
      if (m[1].length === 2) secoes.push({ id, titulo: m[2] });
      nos.push(el(m[1].length === 2 ? 'h2' : 'h3', { id }, corrido(m[2], ctx)));
      i++;
    } else if ((m = /^:::(\w+)\s*(.*)$/.exec(l))) {
      i++;
      const dentro = bloco((x) => x.trim() === ':::'); i++;
      const tipo = m[1], arg = m[2].trim();
      if (tipo === 'simulador' || tipo === 'grafico') {
        const no = ctx.componente?.(tipo, arg.split(/\s+/)[0], arg.split(/\s+/).slice(1));
        if (no) nos.push(no);
      } else {
        const interno = renderizar(dentro.join('\n'), ctx).nos;
        nos.push(el('aside', { class: `caixa caixa--${tipo}` }, el('p', { class: 'caixa__rotulo' }, arg || ROTULOS[tipo] || ''), interno));
      }
    } else if (/^\|.*\|\s*$/.test(l) && /^\|[\s:|-]+\|\s*$/.test(linhas[i + 1] || '')) {
      nos.push(tabela(bloco((x) => !/^\|.*\|\s*$/.test(x)), ctx));
    } else if (/^\s*[-*]\s+/.test(l)) {
      const itens = bloco((x) => !/^\s*[-*]\s+/.test(x) && !/^\s{2,}\S/.test(x));
      const lista = []; for (const x of itens) { if (/^\s*[-*]\s+/.test(x)) lista.push(x.replace(/^\s*[-*]\s+/, '')); else lista[lista.length - 1] += ' ' + x.trim(); }
      nos.push(el('ul', {}, lista.map((t) => el('li', {}, corrido(t, ctx)))));
    } else if (/^\s*\d+\.\s+/.test(l)) {
      const itens = bloco((x) => !/^\s*\d+\.\s+/.test(x) && !/^\s{2,}\S/.test(x));
      const lista = []; for (const x of itens) { if (/^\s*\d+\.\s+/.test(x)) lista.push(x.replace(/^\s*\d+\.\s+/, '')); else lista[lista.length - 1] += ' ' + x.trim(); }
      nos.push(el('ol', {}, lista.map((t) => el('li', {}, corrido(t, ctx)))));
    } else {
      const texto = bloco((x) => !x.trim() || /^(#{2,3}\s|:::|\||\s*[-*]\s+|\s*\d+\.\s+)/.test(x)).join(' ');
      nos.push(el('p', { class: primeiro && ctx.lide ? 'lide' : null }, corrido(texto, ctx)));
      primeiro = false;
    }
  }
  return { nos, secoes };
}
