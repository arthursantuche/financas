// Lançar: cadastro de ativos, lançamentos (compra, venda, proventos, eventos), histórico e
// importação por CSV. Rotas:
//   #lancar                       escolher: novo ativo por classe, ou lançar num ativo existente
//   #lancar/novo/<classe>         novo ativo com o primeiro lançamento
//   #lancar/ativo/<id>            editar o cadastro do ativo
//   #lancar/mov/<ativoId>[/<id>]  novo lançamento, ou edição de um existente
//   #lancar/historico             todos os lançamentos
//   #lancar/importar              importação de CSV
import { el, brl, numero, dataBR, hojeISO, novoId, lerNumero, semAcento } from '../util.js';
import { lista, achar, gravar, remover } from './cofre.js';
import { campo, selecao, formulario } from './formularios.js';
import { CLASSES, emBolsa } from './mercado.js';
import { indiceEmpresas, tesouro } from '../dados.js';
import { decodificarTicker } from '../calculo/opcoes.js';

const TIPOS_RF = ['CDB', 'LCI', 'LCA', 'LC', 'Debênture', 'Debênture incentivada', 'CRI', 'CRA', 'Outro'];
const ISENTOS = new Set(['LCI', 'LCA', 'CRI', 'CRA', 'Debênture incentivada']);
const TIPOS_MOV = { compra: 'Compra ou aplicação', venda: 'Venda ou resgate', provento: 'Provento recebido', desdobramento: 'Desdobramento ou grupamento', bonificacao: 'Bonificação' };
const DESCRICAO = {
  acao: 'Ações negociadas na B3.', etf: 'Fundos de índice negociados em bolsa.', fii: 'Fundos imobiliários.', bdr: 'Recibos de ações estrangeiras.',
  opcao: 'Calls e puts, compradas ou lançadas.', fundo: 'Fundos abertos, pela cota.', tesouro: 'Títulos públicos do Tesouro Direto.',
  rendafixa: 'CDB, LCI, LCA, debêntures, CRI e CRA.', outro: 'Qualquer outro bem, com valor informado à mão.',
};
const cab = (kicker, titulo, texto) => el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, el('a', { href: '#lancar' }, kicker)), el('h1', { class: 'titulo' }, titulo), texto && el('p', { class: 'copy introducao' }, texto));
const envolver = (...filhos) => el('section', { class: 'secao' }, el('div', { class: 'conteudo conteudo--estreito' }, filhos));
const dataValida = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= hojeISO() ? '' : 'Informe uma data que não esteja no futuro.');
const positivo = (v) => (v > 0 ? '' : 'Informe um valor maior que zero.');

// ---- Campos do cadastro, por classe ----
async function camposAtivo(classe, a = {}) {
  const c = [];
  if (emBolsa({ classe })) {
    c.push(campo({ nome: 'codigo', rotulo: 'Código de negociação', valor: a.codigo || '', obrigatorio: true, dica: classe === 'opcao' ? 'Como aparece na nota: PETRL452, por exemplo.' : 'O ticker: PETR4, BOVA11, HGLG11.', atributos: { autocapitalize: 'characters', spellcheck: 'false', list: classe === 'acao' ? 'lista-tickers' : null } }));
    c.push(campo({ nome: 'nome', rotulo: 'Nome', valor: a.nome || '', dica: 'Preenchido sozinho quando o código é de uma companhia conhecida.' }));
    if (classe === 'opcao') {
      c.push(selecao({ nome: 'tipoOpcao', rotulo: 'Tipo', opcoes: [['call', 'Call (opção de compra)'], ['put', 'Put (opção de venda)']], valor: a.tipoOpcao || 'call' }));
      c.push(campo({ nome: 'ativoBase', rotulo: 'Ação de referência', valor: a.ativoBase || '', obrigatorio: true, dica: 'Ticker da ação: PETR4.', atributos: { autocapitalize: 'characters' } }));
      c.push(campo({ nome: 'strike', rotulo: 'Preço de exercício (strike)', tipo: 'numero', valor: a.strike ?? '', obrigatorio: true, sufixo: 'R$' }));
      c.push(campo({ nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: a.vencimento || '', obrigatorio: true }));
    }
  } else if (classe === 'fundo') {
    c.push(campo({ nome: 'nome', rotulo: 'Nome do fundo', valor: a.nome || '', obrigatorio: true }));
    c.push(campo({ nome: 'cnpj', rotulo: 'CNPJ do fundo', valor: a.cnpj || '', dica: 'Com o CNPJ e a nuvem ligada, a cota é atualizada pela CVM.', atributos: { inputmode: 'numeric' } }));
  } else if (classe === 'tesouro') {
    const t = await tesouro().catch(() => ({ titulos: [] }));
    c.push(selecao({ nome: 'titulo', rotulo: 'Título', opcoes: t.titulos.map((x) => [x.id, x.nome]), valor: a.titulo || t.titulos[0]?.id, dica: 'Títulos com preço divulgado hoje pelo Tesouro Nacional.' }));
  } else if (classe === 'rendafixa') {
    c.push(selecao({ nome: 'tipoTitulo', rotulo: 'Tipo', opcoes: TIPOS_RF.map((t) => [t, t]), valor: a.tipo || 'CDB' }));
    c.push(campo({ nome: 'nome', rotulo: 'Emissor', valor: a.emissor || '', obrigatorio: true, dica: 'O banco ou a empresa que emitiu o título.' }));
    c.push(selecao({ nome: 'indexador', rotulo: 'Remuneração', opcoes: [['cdi', 'Pós-fixada: percentual do CDI'], ['pre', 'Prefixada: taxa fixa ao ano'], ['ipca', 'IPCA mais taxa fixa']], valor: a.indexador || 'cdi' }));
    c.push(campo({ nome: 'percentual', rotulo: 'Percentual do CDI', tipo: 'numero', valor: a.percentual != null ? a.percentual * 100 : 100, sufixo: '%', dica: 'Só para pós-fixados. 105 para 105% do CDI.' }));
    c.push(campo({ nome: 'taxa', rotulo: 'Taxa fixa', tipo: 'numero', valor: a.taxa != null ? a.taxa * 100 : '', sufixo: '% a.a.', dica: 'Para prefixados e IPCA+. Em "CDI + 2%", informe 2.' }));
    c.push(campo({ nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: a.vencimento || '' }));
  } else {
    c.push(campo({ nome: 'nome', rotulo: 'Nome', valor: a.nome || '', obrigatorio: true }));
  }
  c.push(campo({ nome: 'instituicao', rotulo: 'Instituição', valor: a.instituicao || '', dica: 'Corretora ou banco onde o investimento está.', atributos: { list: 'lista-instituicoes' } }));
  if (classe !== 'rendafixa' && classe !== 'tesouro') c.push(campo({ nome: 'precoManual', rotulo: classe === 'fundo' ? 'Valor atual da cota' : 'Preço atual', tipo: 'numero', valor: a.precoManual ?? '', sufixo: 'R$', dica: 'Usado só quando não houver preço automático.' }));
  return c;
}

function montarAtivo(classe, v, anterior = {}) {
  const a = { ...anterior, id: anterior.id || novoId('a'), classe, instituicao: v.instituicao || '' };
  if (v.precoManual != null) { a.precoManual = v.precoManual; a.precoManualEm = hojeISO(); } else if ('precoManual' in v) { delete a.precoManual; delete a.precoManualEm; }
  if (emBolsa({ classe })) {
    a.codigo = v.codigo.toUpperCase().replace(/\s/g, ''); a.nome = v.nome || a.codigo;
    if (classe === 'opcao') Object.assign(a, { tipoOpcao: v.tipoOpcao, ativoBase: v.ativoBase.toUpperCase(), strike: v.strike, vencimento: v.vencimento });
  } else if (classe === 'fundo') Object.assign(a, { nome: v.nome, cnpj: (v.cnpj || '').replace(/\D/g, '') });
  else if (classe === 'tesouro') Object.assign(a, { titulo: v.titulo, nome: v.titulo.replace(/-/g, ' ').replace(/\bmais\b/g, '+').replace(/^./, (x) => x.toUpperCase()) });
  else if (classe === 'rendafixa') {
    Object.assign(a, { tipo: v.tipoTitulo, emissor: v.nome, indexador: v.indexador, percentual: v.indexador === 'cdi' ? (v.percentual ?? 100) / 100 : 1, taxa: (v.taxa ?? 0) / 100, vencimento: v.vencimento || null, isento: ISENTOS.has(v.tipoTitulo) });
    const taxa = a.indexador === 'cdi' ? `${numero(a.percentual * 100, 0)}% do CDI${a.taxa ? ` + ${numero(a.taxa * 100, 2)}%` : ''}` : a.indexador === 'pre' ? `${numero(a.taxa * 100, 2)}% a.a.` : `IPCA + ${numero(a.taxa * 100, 2)}%`;
    a.nome = `${v.tipoTitulo} ${v.nome} ${taxa}`;
  } else a.nome = v.nome;
  return a;
}

// ---- Campos do lançamento ----
function camposMov(ativo, m = {}) {
  const rf = ativo.classe === 'rendafixa';
  const tipos = Object.entries(TIPOS_MOV).filter(([t]) => (rf ? ['compra', 'venda'].includes(t) : ['fundo', 'tesouro', 'outro', 'opcao'].includes(ativo.classe) ? !['desdobramento', 'bonificacao'].includes(t) || ativo.classe === 'outro' : true));
  const tipo = selecao({ nome: 'tipo', rotulo: 'Operação', opcoes: tipos, valor: m.tipo || 'compra' });
  const data = campo({ nome: 'data', rotulo: 'Data', tipo: 'date', valor: m.data || hojeISO(), obrigatorio: true, atributos: { max: hojeISO() } });
  const qtd = campo({ nome: 'quantidade', rotulo: rf ? 'Valor' : ativo.classe === 'fundo' ? 'Quantidade de cotas' : 'Quantidade', tipo: 'numero', valor: m.tipo === 'provento' ? '' : (rf ? (m.quantidade ?? '') : m.quantidade ?? ''), sufixo: rf ? 'R$' : null, dica: rf ? 'Valor aplicado ou resgatado.' : null });
  const preco = campo({ nome: 'preco', rotulo: ativo.classe === 'fundo' ? 'Valor da cota' : ativo.classe === 'tesouro' ? 'Preço unitário pago' : 'Preço por unidade', tipo: 'numero', valor: m.preco ?? '', sufixo: 'R$' });
  const custos = campo({ nome: 'custos', rotulo: 'Custos', tipo: 'numero', valor: m.custos ?? '', sufixo: 'R$', dica: 'Corretagem, emolumentos e taxas da operação.' });
  const valor = campo({ nome: 'valor', rotulo: 'Valor recebido', tipo: 'numero', valor: m.valor ?? '', sufixo: 'R$', dica: 'Dividendos, juros sobre capital, rendimentos ou cupons, já líquidos.' });
  const obs = campo({ nome: 'observacao', rotulo: 'Observação', valor: m.observacao || '' });
  const todos = [tipo, data, qtd, preco, custos, valor, obs];
  const ajustar = () => {
    const t = tipo.ler();
    const mostra = { quantidade: t !== 'provento', preco: !rf && ['compra', 'venda', 'bonificacao'].includes(t), custos: !rf && ['compra', 'venda'].includes(t), valor: t === 'provento' };
    for (const c of [qtd, preco, custos, valor]) { c.no.hidden = !mostra[c.nome]; c.obrigatorio = mostra[c.nome] && c.nome !== 'custos'; }
    qtd.no.querySelector('span').firstChild.textContent = t === 'desdobramento' ? 'Fator' : rf ? 'Valor' : ativo.classe === 'fundo' ? 'Quantidade de cotas' : 'Quantidade';
  };
  tipo.input.addEventListener('change', ajustar); ajustar();
  return { todos, tipo };
}
function montarMov(ativo, v, anterior = {}) {
  const m = { ...anterior, id: anterior.id || novoId('l'), ativoId: ativo.id, tipo: v.tipo, data: v.data, observacao: v.observacao || '' };
  for (const k of ['quantidade', 'preco', 'custos', 'valor']) delete m[k];
  if (v.tipo === 'provento') m.valor = v.valor;
  else if (ativo.classe === 'rendafixa') Object.assign(m, { quantidade: v.quantidade, preco: 1 });
  else if (v.tipo === 'desdobramento') m.quantidade = v.quantidade;
  else Object.assign(m, { quantidade: v.quantidade, preco: v.preco ?? 0, custos: v.custos ?? 0 });
  return m;
}
const regrasMov = { data: dataValida, quantidade: positivo, preco: (v) => (v >= 0 ? '' : 'O preço não pode ser negativo.'), valor: positivo };

const descreverMov = (m, a) => (m.tipo === 'provento' ? `Provento de ${brl(m.valor)}` : m.tipo === 'desdobramento' ? `Fator ${numero(m.quantidade, 4)}` : a?.classe === 'rendafixa' ? `${TIPOS_MOV[m.tipo].split(' ')[0]} de ${brl(m.quantidade)}` : `${m.tipo === 'compra' ? 'Compra' : m.tipo === 'venda' ? 'Venda' : 'Bonificação'} de ${numero(m.quantidade, Number.isInteger(m.quantidade) ? 0 : 4)} a ${brl(m.preco)}`);

async function listasDeApoio() {
  const emp = await indiceEmpresas().catch(() => ({ empresas: [] }));
  const insts = [...new Set(lista('ativos').map((a) => a.instituicao).filter(Boolean))];
  return { emp, no: el('div', { hidden: true }, el('datalist', { id: 'lista-tickers' }, emp.empresas.flatMap((e) => e.tickers.map((t) => el('option', { value: t }, e.nome)))), el('datalist', { id: 'lista-instituicoes' }, insts.map((i) => el('option', { value: i })))) };
}

export async function pagina(ctx, [acao, p1, p2]) {
  // ---- Novo ativo + primeiro lançamento ----
  if (acao === 'novo' && CLASSES[p1]) {
    const classe = p1, apoio = await listasDeApoio();
    const ca = await camposAtivo(classe), mov = camposMov({ classe });
    const cod = ca.find((c) => c.nome === 'codigo'), nome = ca.find((c) => c.nome === 'nome');
    if (cod) cod.input.addEventListener('change', () => {
      const v = cod.input.value.toUpperCase().trim(); cod.input.value = v;
      const e = apoio.emp.empresas.find((x) => x.tickers.includes(v));
      if (e && !nome.input.value) nome.input.value = e.nome;
      if (classe === 'opcao') { const d = decodificarTicker(v); if (d) { ca.find((c) => c.nome === 'tipoOpcao').input.value = d.tipo; const b = ca.find((c) => c.nome === 'ativoBase'); if (!b.input.value) b.input.value = d.ativoBase; } }
    });
    const form = formulario({
      classe: 'formulario--largo', campos: [...ca, ...mov.todos], rotuloBotao: 'Salvar', regras: { ...regrasMov, strike: positivo },
      acao: async (v) => {
        const repetido = emBolsa({ classe }) && lista('ativos').find((a) => a.codigo === v.codigo.toUpperCase().replace(/\s/g, '') && (a.instituicao || '') === (v.instituicao || ''));
        const ativo = repetido || await gravar('ativos', montarAtivo(classe, v));
        await gravar('lancamentos', montarMov(ativo, v));
        ctx.avisar(repetido ? 'Lançamento somado ao ativo que já existia.' : 'Investimento cadastrado.'); ctx.navegar(`ativo/${ativo.id}`);
      }, extras: [el('a', { href: '#lancar' }, 'Cancelar')],
    });
    return { titulo: `Novo: ${CLASSES[classe].um}`, no: envolver(cab('Lançar', `${CLASSES[classe].um}.`, DESCRICAO[classe]), apoio.no, form) };
  }

  // ---- Editar cadastro ----
  if (acao === 'ativo') {
    const a = achar('ativos', p1);
    if (!a) throw new Error('Ativo não encontrado.');
    const apoio = await listasDeApoio(), ca = await camposAtivo(a.classe, { ...a, nome: a.classe === 'rendafixa' ? a.emissor : a.nome });
    const form = formulario({ classe: 'formulario--largo', campos: ca, rotuloBotao: 'Salvar', regras: { strike: positivo }, acao: async (v) => { await gravar('ativos', montarAtivo(a.classe, v, a)); ctx.avisar('Cadastro atualizado.'); ctx.navegar(`ativo/${a.id}`); }, extras: [el('a', { href: `#ativo/${a.id}` }, 'Cancelar')] });
    let confirmando = false;
    const apagar = el('button', { class: 'link-botao link-botao--alerta', type: 'button', onclick: async () => {
      if (!confirmando) { confirmando = true; apagar.textContent = 'Toque de novo para remover o ativo e todos os lançamentos dele'; return; }
      for (const l of lista('lancamentos').filter((x) => x.ativoId === a.id)) await remover('lancamentos', l.id);
      await remover('ativos', a.id); ctx.avisar('Ativo removido.'); ctx.navegar('carteira');
    } }, 'Remover este ativo');
    return { titulo: `Editar ${a.codigo || a.nome}`, no: envolver(cab('Lançar', `Editar ${a.codigo || a.nome}.`), apoio.no, form, el('p', { class: 'espaco-topo' }, apagar)) };
  }

  // ---- Lançamento em ativo existente ----
  if (acao === 'mov') {
    const a = achar('ativos', p1);
    if (!a) throw new Error('Ativo não encontrado.');
    const m = p2 ? achar('lancamentos', p2) : null, mov = camposMov(a, m || {});
    const form = formulario({ classe: 'formulario--largo', campos: mov.todos, rotuloBotao: 'Salvar', regras: regrasMov, acao: async (v) => { await gravar('lancamentos', montarMov(a, v, m || {})); ctx.avisar('Lançamento salvo.'); ctx.navegar(`ativo/${a.id}`); }, extras: [el('a', { href: `#ativo/${a.id}` }, 'Cancelar')] });
    let confirmando = false;
    const apagar = m && el('button', { class: 'link-botao link-botao--alerta', type: 'button', onclick: async () => { if (!confirmando) { confirmando = true; apagar.textContent = 'Toque de novo para remover'; return; } await remover('lancamentos', m.id); ctx.avisar('Lançamento removido.'); ctx.navegar(`ativo/${a.id}`); } }, 'Remover este lançamento');
    return { titulo: `Lançamento em ${a.codigo || a.nome}`, no: envolver(cab('Lançar', m ? 'Editar lançamento.' : 'Novo lançamento.', a.codigo ? `${a.codigo} · ${a.nome}` : a.nome), form, apagar && el('p', { class: 'espaco-topo' }, apagar)) };
  }

  // ---- Histórico ----
  if (acao === 'historico') {
    const ativos = new Map(lista('ativos').map((a) => [a.id, a]));
    const movs = lista('lancamentos').sort((x, y) => (x.data < y.data ? 1 : -1));
    return { titulo: 'Lançamentos', no: envolver(cab('Lançar', 'Lançamentos.', `${movs.length} registros, do mais recente ao mais antigo.`),
      movs.length ? el('ul', { class: 'lista' }, movs.map((m) => { const a = ativos.get(m.ativoId); return el('li', {}, el('a', { class: 'fila fila--entre', href: `#lancar/mov/${m.ativoId}/${m.id}` }, el('span', { class: 'empilha' }, el('strong', {}, a?.codigo || a?.nome || 'Ativo removido'), el('span', { class: 'legenda' }, descreverMov(m, a))), el('span', { class: 'legenda num' }, dataBR(m.data)))); })) : el('p', { class: 'vazio' }, 'Nenhum lançamento ainda.')) };
  }

  if (acao === 'importar') return importar(ctx);

  // ---- Escolha ----
  const meus = lista('ativos').sort((x, y) => (x.codigo || x.nome).localeCompare(y.codigo || y.nome));
  const busca = el('input', { class: 'campo', type: 'search', placeholder: 'Buscar na carteira', 'aria-label': 'Buscar ativo da carteira' });
  const resultados = el('ul', { class: 'busca__lista' });
  const filtrar = () => { const t = semAcento(busca.value); resultados.replaceChildren(...meus.filter((a) => !t || semAcento(`${a.codigo || ''} ${a.nome}`).includes(t)).slice(0, 30).map((a) => el('li', {}, el('a', { href: `#lancar/mov/${a.id}` }, el('strong', {}, a.codigo || a.nome), el('span', { class: 'legenda' }, a.codigo ? a.nome : CLASSES[a.classe].um))))); };
  busca.addEventListener('input', filtrar); filtrar();
  return { titulo: 'Lançar', no: el('div', {},
    el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
      el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, 'Lançar'), el('h1', { class: 'titulo' }, 'O que você quer registrar?')),
      meus.length ? el('div', { class: 'empilha espaco-fundo' }, el('h2', { class: 'kicker' }, 'Em um ativo que já está na carteira'), el('div', { class: 'busca' }, busca, resultados)) : null,
      el('h2', { class: 'kicker' }, 'Um investimento novo'),
      el('div', { class: 'escolhas' }, Object.entries(CLASSES).map(([id, c]) => el('a', { class: 'escolha', href: `#lancar/novo/${id}` }, el('span', { class: 'escolha__nome' }, c.um), el('span', { class: 'legenda' }, DESCRICAO[id])))),
      el('div', { class: 'atalhos espaco-topo' }, el('a', { class: 'pill', href: '#lancar/importar' }, 'Importar de uma planilha'), el('a', { class: 'pill', href: '#lancar/historico' }, 'Ver todos os lançamentos'))))) };
}

// ---- Importação de CSV ----
// Colunas (com cabeçalho, separadas por ponto e vírgula ou vírgula):
//   data; operacao; classe; codigo; quantidade; preco; custos; instituicao; nome
export const MODELO_CSV = 'data;operacao;classe;codigo;quantidade;preco;custos;instituicao;nome\n15/03/2024;compra;acao;PETR4;100;36,50;4,90;Minha corretora;Petrobras PN\n20/05/2025;compra;fii;HGLG11;10;158,20;0;Minha corretora;CSHG Logística\n';
export function lerCSV(texto) {
  const linhas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (linhas.length < 2) throw new Error('O arquivo precisa ter o cabeçalho e ao menos uma linha.');
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';
  const cabecalho = linhas[0].split(sep).map((c) => semAcento(c.trim()));
  const col = (nomes) => cabecalho.findIndex((c) => nomes.includes(c));
  const idx = { data: col(['data']), tipo: col(['operacao', 'tipo']), classe: col(['classe']), codigo: col(['codigo', 'ticker', 'ativo']), quantidade: col(['quantidade', 'qtd']), preco: col(['preco', 'preco unitario']), custos: col(['custos', 'taxas']), instituicao: col(['instituicao', 'corretora']), nome: col(['nome']) };
  for (const k of ['data', 'codigo', 'quantidade', 'preco']) if (idx[k] < 0) throw new Error(`Falta a coluna "${k}" no cabeçalho.`);
  const erros = [], registros = [];
  linhas.slice(1).forEach((l, n) => {
    const c = l.split(sep).map((x) => x.trim());
    const dataTxt = c[idx.data], m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataTxt);
    const data = m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(dataTxt) ? dataTxt : null;
    const quantidade = lerNumero(c[idx.quantidade]), preco = lerNumero(c[idx.preco]);
    const tipo = idx.tipo >= 0 ? semAcento(c[idx.tipo] || 'compra') : 'compra';
    const classe = idx.classe >= 0 ? semAcento(c[idx.classe] || 'acao') : 'acao';
    const problema = !data ? 'data inválida' : !(quantidade > 0) ? 'quantidade inválida' : !(preco >= 0) ? 'preço inválido' : !['compra', 'venda'].includes(tipo) ? 'operação deve ser compra ou venda' : !['acao', 'etf', 'fii', 'bdr'].includes(classe) ? 'classe deve ser acao, etf, fii ou bdr' : !c[idx.codigo] ? 'sem código' : null;
    if (problema) erros.push(`Linha ${n + 2}: ${problema}`);
    else registros.push({ data, tipo, classe, codigo: c[idx.codigo].toUpperCase(), quantidade, preco, custos: idx.custos >= 0 ? lerNumero(c[idx.custos]) || 0 : 0, instituicao: idx.instituicao >= 0 ? c[idx.instituicao] || '' : '', nome: idx.nome >= 0 ? c[idx.nome] || '' : '' });
  });
  return { registros, erros };
}
function importar(ctx) {
  const area = el('textarea', { class: 'campo', rows: '8', 'aria-label': 'Conteúdo da planilha', placeholder: MODELO_CSV });
  const arq = el('input', { class: 'campo', type: 'file', accept: '.csv,text/csv,text/plain' });
  arq.addEventListener('change', async () => { if (arq.files[0]) area.value = await arq.files[0].text(); });
  const saida = el('div', { class: 'empilha', 'aria-live': 'polite' });
  const conferir = el('button', { class: 'pill pill--azul', type: 'button', onclick: () => {
    let r;
    try { r = lerCSV(area.value); } catch (e) { saida.replaceChildren(el('p', { class: 'status-pendente' }, e.message)); return; }
    const gravarTudo = el('button', { class: 'pill pill--azul', type: 'button', disabled: !r.registros.length, onclick: async () => {
      gravarTudo.disabled = true;
      for (const x of r.registros) {
        let a = lista('ativos').find((y) => y.codigo === x.codigo && (y.instituicao || '') === x.instituicao);
        if (!a) a = await gravar('ativos', { id: novoId('a'), classe: x.classe, codigo: x.codigo, nome: x.nome || x.codigo, instituicao: x.instituicao });
        await gravar('lancamentos', { id: novoId('l'), ativoId: a.id, tipo: x.tipo, data: x.data, quantidade: x.quantidade, preco: x.preco, custos: x.custos, observacao: 'Importado de planilha' });
      }
      ctx.avisar(`${r.registros.length} lançamentos importados.`); ctx.navegar('carteira');
    } }, `Importar ${r.registros.length} lançamentos`);
    saida.replaceChildren(
      r.erros.length ? el('div', { class: 'natureza' }, el('strong', { class: 'selo--atencao' }, `${r.erros.length} linhas com problema, que ficarão de fora`), r.erros.slice(0, 12).map((e) => el('span', { class: 'legenda' }, e))) : null,
      r.registros.length ? el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela tabela--numeros' }, el('thead', {}, el('tr', {}, ['Data', 'Operação', 'Código', 'Quantidade', 'Preço'].map((t) => el('th', { scope: 'col' }, t)))), el('tbody', {}, r.registros.slice(0, 50).map((x) => el('tr', {}, el('th', { scope: 'row' }, dataBR(x.data)), el('td', {}, x.tipo), el('td', {}, x.codigo), el('td', {}, numero(x.quantidade, 0)), el('td', {}, brl(x.preco))))))) : null,
      gravarTudo);
  } }, 'Conferir');
  const baixarModelo = el('a', { class: 'pill', href: URL.createObjectURL(new Blob([MODELO_CSV], { type: 'text/csv' })), download: 'modelo-lancamentos.csv' }, 'Baixar o modelo');
  return { titulo: 'Importar', no: envolver(cab('Lançar', 'Importar de uma planilha.', 'Para trazer de uma vez o histórico de compras e vendas em bolsa. Salve a planilha como CSV com as colunas do modelo.'),
    el('div', { class: 'formulario formulario--largo' }, el('label', { class: 'rotulo' }, el('span', {}, 'Arquivo CSV'), arq), el('label', { class: 'rotulo' }, el('span', {}, 'Ou cole o conteúdo aqui'), area), el('div', { class: 'formulario__acoes' }, conferir, baixarModelo), saida)) };
}
