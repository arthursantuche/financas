// Utilitários de interface: criação de elementos, formatação e pequenos auxiliares.
// Dados externos nunca entram por innerHTML: tudo é criado com el().

export const $ = (id) => document.getElementById(id);

// A política de segurança do site (style-src 'self') bloqueia o atributo style escrito como texto; pela API de
// estilos (CSSOM) é permitido. Por isso `style: 'a:b;c:d'` é aplicado propriedade por propriedade.
function aplicarEstilo(e, texto) {
  String(texto).split(';').forEach((par) => { const i = par.indexOf(':'); if (i > 0) e.style.setProperty(par.slice(0, i).trim(), par.slice(i + 1).trim()); });
}
export function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === 'class') e.className = v;
    else if (k === 'style') aplicarEstilo(e, v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  });
  filhos.flat(Infinity).forEach((f) => { if (f != null && f !== false) e.append(f instanceof Node ? f : String(f)); });
  return e;
}
const SVG = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...filhos) {
  const e = document.createElementNS(SVG, tag);
  Object.entries(attrs).forEach(([k, v]) => { if (v == null || v === false) return; if (k === 'style') aplicarEstilo(e, v); else e.setAttribute(k, v); });
  filhos.flat().forEach((f) => f && e.append(f));
  return e;
}

// ---- Números (padrão brasileiro) ----
const nf = (opcoes) => new Intl.NumberFormat('pt-BR', opcoes);
const fBRL = nf({ style: 'currency', currency: 'BRL' });
const fBRL0 = nf({ style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const vazio = (v) => v == null || !Number.isFinite(Number(v));
export const brl = (v) => (vazio(v) ? '—' : fBRL.format(v));
export const brl0 = (v) => (vazio(v) ? '—' : fBRL0.format(v));
export const numero = (v, casas = 2) => (vazio(v) ? '—' : nf({ minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v));
export const inteiro = (v) => (vazio(v) ? '—' : nf({ maximumFractionDigits: 0 }).format(v));
// Fração → percentual: 0,1234 → "12,34%".
export const pct = (v, casas = 2) => (vazio(v) ? '—' : `${numero(v * 100, casas)}%`);
export const pctSinal = (v, casas = 2) => (vazio(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${numero(Math.abs(v) * 100, casas)}%`);
export const brlSinal = (v) => (vazio(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fBRL.format(Math.abs(v))}`);
export const vezes = (v, casas = 2) => (vazio(v) ? '—' : `${numero(v, casas)}×`);
// Valores grandes: "R$ 1,2 bi", "R$ 345 mi".
export function compacto(v, prefixo = 'R$ ') {
  if (vazio(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e12) return `${s}${prefixo}${numero(a / 1e12, 2)} tri`;
  if (a >= 1e9) return `${s}${prefixo}${numero(a / 1e9, 2)} bi`;
  if (a >= 1e6) return `${s}${prefixo}${numero(a / 1e6, 1)} mi`;
  if (a >= 1e3) return `${s}${prefixo}${numero(a / 1e3, 1)} mil`;
  return `${s}${prefixo}${numero(a, 2)}`;
}
export const classeSinal = (v) => (v > 0 ? 'alta' : v < 0 ? 'baixa' : '');
// Lê um número digitado no padrão brasileiro ("1.234,56") ou com ponto decimal.
export function lerNumero(texto) {
  const t = String(texto ?? '').trim().replace(/\s|R\$|%/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

// ---- Datas (sempre em UTC, para o dia não mudar com o fuso) ----
export const data = (iso) => new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
const fData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const fCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const fMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const fHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const dataBR = (iso) => (iso ? fData.format(data(iso)) : '—');
export const dataCurta = (iso) => (iso ? fCurta.format(data(iso)) : '—');
export const mesAno = (iso) => (iso ? fMes.format(data(iso)).replace('. de ', '/').replace('.', '') : '—');
export const dataHora = (iso) => (iso ? fHora.format(new Date(iso)) : '—');
export const hojeISO = () => { const h = new Date(); return new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())).toISOString().slice(0, 10); };
export const somarDias = (iso, dias) => new Date(data(iso).getTime() + dias * 864e5).toISOString().slice(0, 10);
export const trimestre = (iso) => `${Math.ceil(Number(iso.slice(5, 7)) / 3)}T${iso.slice(2, 4)}`;

// ---- Texto e identificadores ----
export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const novoId = (prefixo = 'r') => `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const linkSeguro = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : null);
export const plural = (n, um, varios) => `${inteiro(n)} ${Number(n) === 1 ? um : varios}`;

// Lê uma cor (token de papel) do CSS no momento de desenhar: os gráficos acompanham o tema.
export const token = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
export const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Espera o usuário parar de digitar antes de recalcular.
export function adiar(fn, ms = 180) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Selo de fonte e data: todo dado mostrado no portal diz de onde veio e de quando é.
export const selo = (fonte, quando, extra = '') => el('p', { class: 'selo' }, [fonte, quando && `referência ${quando}`, extra].filter(Boolean).join(' · '));
