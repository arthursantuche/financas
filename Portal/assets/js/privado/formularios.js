// Peças de formulário da área privada: campo com rótulo e erro, lista de seleção e envio com
// validação própria (mensagem abaixo do campo, em laranja, sem balões do navegador).
import { el, lerNumero } from '../util.js';

export function campo({ nome, rotulo, tipo = 'text', valor = '', obrigatorio = false, dica = null, sufixo = null, atributos = {} }) {
  const numerico = tipo === 'numero';
  const input = el(tipo === 'textarea' ? 'textarea' : 'input', {
    class: 'campo', name: nome, id: `c-${nome}`, type: tipo === 'textarea' ? null : numerico ? 'text' : tipo,
    inputmode: numerico ? 'decimal' : null, value: tipo === 'textarea' ? null : numerico && valor !== '' && valor != null ? String(valor).replace('.', ',') : valor ?? '',
    autocomplete: 'off', 'aria-describedby': `e-${nome}`, ...atributos,
  }, tipo === 'textarea' ? valor : null);
  const erro = el('span', { class: 'status-pendente erro', id: `e-${nome}`, role: 'alert' });
  const no = el('label', { class: 'rotulo', for: `c-${nome}` },
    el('span', {}, rotulo, obrigatorio ? el('span', { class: 'rotulo__obrigatorio' }, ' · obrigatório') : el('span', { class: 'rotulo__opcional' }, ' · opcional')),
    sufixo ? el('span', { class: 'campo--sufixo' }, input, el('span', {}, sufixo)) : input,
    dica && el('span', { class: 'legenda' }, dica), erro);
  return { nome, no, input, erro, obrigatorio, ler: () => (numerico ? lerNumero(input.value) : input.value.trim()), numerico, rotulo };
}

export function selecao({ nome, rotulo, opcoes, valor = '', dica = null }) {
  const input = el('select', { class: 'campo', name: nome, id: `c-${nome}` }, opcoes.map(([v, t]) => el('option', { value: v, selected: String(v) === String(valor) }, t)));
  const erro = el('span', { class: 'status-pendente erro', id: `e-${nome}`, role: 'alert' });
  const no = el('label', { class: 'rotulo', for: `c-${nome}` }, el('span', {}, rotulo), el('span', { class: 'seletor' }, input), dica && el('span', { class: 'legenda' }, dica), erro);
  return { nome, no, input, erro, obrigatorio: true, ler: () => input.value, rotulo };
}

export function marcar({ nome, rotulo, valor = false }) {
  const input = el('input', { type: 'checkbox', name: nome, id: `c-${nome}`, checked: valor });
  const no = el('div', { class: 'tarefa lista-item' }, input, el('label', { for: `c-${nome}` }, el('span', {}, rotulo)));
  return { nome, no, input, erro: el('span'), obrigatorio: false, ler: () => input.checked, rotulo };
}

export const mostrarErro = (c, texto) => { c.erro.textContent = texto || ''; c.input.setAttribute('aria-invalid', texto ? 'true' : 'false'); };

// Lê e valida os campos. Devolve os valores ou null (com os erros já na tela e o foco no primeiro).
export function lerCampos(campos, regras = {}) {
  const valores = {};
  let primeiro = null;
  for (const c of campos) {
    const v = c.ler();
    let erro = '';
    if (c.obrigatorio && (v === '' || v == null)) erro = c.numerico && c.input.value.trim() ? 'Use só números, com vírgula nos decimais.' : 'Preencha este campo.';
    else if (c.numerico && c.input.value.trim() && v == null) erro = 'Use só números, com vírgula nos decimais.';
    else if (regras[c.nome] && v !== '' && v != null) erro = regras[c.nome](v, valores) || '';
    mostrarErro(c, erro);
    if (erro && !primeiro) primeiro = c;
    valores[c.nome] = v;
  }
  if (primeiro) { primeiro.input.focus(); return null; }
  return valores;
}

// Formulário com botão de envio que mostra "aguarde" enquanto a ação roda e exibe a falha no fim.
export function formulario({ campos, acao, rotuloBotao, regras = {}, extras = [], classe = '' }) {
  const geral = el('p', { class: 'status-pendente', role: 'alert' });
  const botao = el('button', { class: 'pill pill--azul', type: 'submit' }, rotuloBotao);
  const form = el('form', { class: `formulario ${classe}`, novalidate: true }, campos.map((c) => c.no), geral, el('div', { class: 'formulario__acoes' }, botao, extras));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    geral.textContent = '';
    const valores = lerCampos(campos, regras);
    if (!valores) return;
    botao.disabled = true; const texto = botao.textContent; botao.textContent = 'Aguarde…';
    try { await acao(valores); } catch (erro) { geral.textContent = erro.message || 'Não foi possível concluir.'; if (!/^Erro[A-Z]/.test(erro.constructor?.name || '')) console.error(erro); } finally { botao.disabled = false; botao.textContent = texto; }
  });
  return form;
}
