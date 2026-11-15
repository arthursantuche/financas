// Análise de um demonstrativo enviado. O PDF é lido no próprio navegador (pdf.js, cópia local):
// o arquivo não sai do aparelho. A leitura automática reconhece o formato padronizado da CVM
// (linhas "código da conta, descrição, valores"); em qualquer caso, os valores vão para um
// formulário de conferência antes do cálculo. Os indicadores e as regras são os mesmos da análise
// por código (calculo/fundamentos.js).
import { el, lerNumero, hojeISO, dataBR } from '../util.js';
import { historico, sintetizar, leituraPatrimonial } from '../calculo/fundamentos.js';
import { blocoSintese, blocoCriterios, blocoTendencias, blocoBalanco } from './analise.js';
import { indicadores as lerIndicadores } from '../dados.js';

// Conta padronizada → campo. As mesmas contas usadas na coleta da CVM (coleta/cvm.mjs).
export const CONTAS = {
  '1': 'ativoTotal', '1.01': 'ativoCirculante', '1.01.01': 'caixa', '1.01.02': 'aplicacoes', '1.01.03': 'contasReceber', '1.01.04': 'estoques',
  '1.02.03': 'imobilizado', '1.02.04': 'intangivel', '2.01': 'passivoCirculante', '2.01.04': 'dividaCP', '2.02': 'passivoNaoCirculante', '2.02.01': 'dividaLP', '2.03': 'patrimonioLiquido',
  '3.01': 'receita', '3.03': 'lucroBruto', '3.05': 'ebit', '3.06.02': 'despesasFinanceiras', '3.11': 'lucroLiquido', '6.01': 'fco',
};
const CAMPOS = [
  ['Resultado', [['receita', 'Receita líquida'], ['lucroBruto', 'Lucro bruto'], ['ebit', 'Resultado antes do financeiro e dos tributos (EBIT)'], ['da', 'Depreciação e amortização'], ['despesasFinanceiras', 'Despesas financeiras'], ['lucroLiquido', 'Lucro líquido']]],
  ['Caixa', [['fco', 'Caixa das atividades operacionais'], ['capex', 'Investimentos em imobilizado e intangível']]],
  ['Ativo', [['ativoTotal', 'Ativo total'], ['ativoCirculante', 'Ativo circulante'], ['caixa', 'Caixa e equivalentes'], ['aplicacoes', 'Aplicações financeiras'], ['contasReceber', 'Contas a receber'], ['estoques', 'Estoques'], ['imobilizado', 'Imobilizado'], ['intangivel', 'Intangível']]],
  ['Passivo e patrimônio', [['passivoCirculante', 'Passivo circulante'], ['dividaCP', 'Empréstimos e financiamentos de curto prazo'], ['passivoNaoCirculante', 'Passivo não circulante'], ['dividaLP', 'Empréstimos e financiamentos de longo prazo'], ['patrimonioLiquido', 'Patrimônio líquido']]],
];
const FLUXOS = new Set(['receita', 'lucroBruto', 'ebit', 'da', 'despesasFinanceiras', 'lucroLiquido', 'fco', 'capex']);

// Texto de um PDF, linha a linha (itens na mesma altura da página formam uma linha).
export async function textoDoPDF(arquivo) {
  const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const linhas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const itens = (await (await doc.getPage(n)).getTextContent()).items.filter((i) => i.str.trim());
    const porAltura = new Map();
    for (const i of itens) { const y = Math.round(i.transform[5] / 3); if (!porAltura.has(y)) porAltura.set(y, []); porAltura.get(y).push(i); }
    for (const y of [...porAltura.keys()].sort((a, b) => b - a)) linhas.push(porAltura.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str.trim()).join(' '));
  }
  return linhas;
}

// Reconhece linhas "1.01.03 Contas a Receber 8.567.522 7.837.018". Devolve { atual, anterior }.
// Na DRE dos trimestrais há quatro valores (trimestre, acumulado, e os dois do ano anterior): valem
// os acumulados. Valores entre parênteses são negativos.
export function extrairContas(linhas) {
  const atual = {}, anterior = {};
  const num = (t) => { const neg = /^\(.*\)$/.test(t) || t.startsWith('-'); const v = lerNumero(t.replace(/[()\-]/g, '')); return v == null ? null : neg ? -v : v; };
  let secao = '';
  for (const linha of linhas) {
    if (/Balanço Patrimonial Ativo/i.test(linha)) secao = 'bpa'; else if (/Balanço Patrimonial Passivo/i.test(linha)) secao = 'bpp';
    else if (/Demonstração do Resultado(?! Abrangente)/i.test(linha)) secao = 'dre'; else if (/Demonstração do Resultado Abrangente/i.test(linha)) secao = 'dra';
    else if (/Fluxo de Caixa/i.test(linha)) secao = 'dfc'; else if (/Mutações do Patrimônio|Valor Adicionado/i.test(linha)) secao = 'outra';
    const m = /^(\d(?:\.\d{2}){0,3})\s+(.+?)\s+((?:\(?-?[\d.]+(?:,\d+)?\)?\s*){1,4})$/.exec(linha.trim());
    if (!m) continue;
    const cod = m[1], campo = CONTAS[cod], valores = m[3].trim().split(/\s+/).map(num).filter((v) => v != null);
    if (!valores.length) continue;
    const esperada = { 1: 'bpa', 2: 'bpp', 3: 'dre', 6: 'dfc' }[cod[0]];
    if (secao && esperada && secao !== esperada) continue; // mesma numeração aparece em outras tabelas (DRA, DMPL)
    let chave = campo;
    if (!chave && /^6\.02\.\d\d$/.test(cod) && /imobilizado|intang/i.test(m[2]) && !/venda|aliena|recebimento/i.test(m[2])) chave = 'capex+';
    if (!chave && /^6\.01\.01\.\d\d$/.test(cod) && /deprecia|amortiza/i.test(m[2])) chave = 'da';
    if (!chave && /^Lucro\/Prejuízo (Consolidado )?do Período/i.test(m[2])) chave = 'lucroLiquido';
    if (!chave) continue;
    const [va, vp] = valores.length >= 4 ? [valores[1], valores[3]] : [valores[0], valores[1]];
    const por = (alvo, v) => { if (v == null) return; if (chave === 'capex+') alvo.capex = (alvo.capex || 0) + v; else if (alvo[chave] == null) alvo[chave] = chave === 'da' ? Math.abs(v) : v; };
    por(atual, va); por(anterior, vp);
  }
  return { atual, anterior, achadas: Object.keys(atual).length };
}

// Monta a "empresa" no formato do motor a partir dos valores conferidos.
export function montarEmpresa({ nome, fim, meses, atual, anterior, acoes }) {
  const anual = (v) => (v == null ? null : (v * 12) / meses);
  const periodo = (dados, dataFim) => {
    const bp = {}, fluxo = {};
    for (const [k, v] of Object.entries(dados)) { if (v == null) continue; if (FLUXOS.has(k)) fluxo[k] = anual(v); else bp[k] = v; }
    if (fluxo.capex > 0) fluxo.capex = -fluxo.capex; // investimento é saída de caixa
    fluxo.lucroControladores = fluxo.lucroLiquido;
    return { fim: dataFim, inicio: `${Number(dataFim.slice(0, 4)) - 1}${dataFim.slice(4)}`, meses: 12, origem: 'Enviado', consolidado: true, bp, fluxo, acoes: acoes ? { total: acoes, tesouraria: 0 } : null };
  };
  const periodos = [];
  if (anterior && Object.values(anterior).some((v) => v != null)) periodos.push(periodo(anterior, `${Number(fim.slice(0, 4)) - 1}${fim.slice(4)}`));
  periodos.push(periodo(atual, fim));
  return { cvm: null, nome, tickers: [], setor: 'Não informado', plano: 'comercial', fonte: 'Demonstrativo enviado pelo usuário', unidade: 'R$ mil', geradoEm: new Date().toISOString(), periodos, anualizado: meses !== 12 };
}

export async function pagina(ctx) {
  const entradas = {};
  const celula = (k, coluna) => { const i = el('input', { class: 'campo', type: 'text', inputmode: 'decimal', 'aria-label': `${k}, período ${coluna}`, autocomplete: 'off' }); (entradas[k] ||= {})[coluna] = i; return i; };
  const nome = el('input', { class: 'campo', type: 'text', value: '', placeholder: 'Nome da empresa', 'aria-label': 'Nome da empresa' });
  const fim = el('input', { class: 'campo', type: 'date', value: `${Number(hojeISO().slice(0, 4)) - 1}-12-31`, 'aria-label': 'Data de encerramento do período' });
  const meses = el('select', { class: 'campo', 'aria-label': 'Duração do período' }, [[12, 'Exercício completo (12 meses)'], [9, 'Acumulado de 9 meses'], [6, 'Acumulado de 6 meses'], [3, 'Um trimestre (3 meses)']].map(([v, t]) => el('option', { value: v }, t)));
  const acoes = el('input', { class: 'campo', type: 'text', inputmode: 'numeric', placeholder: 'Opcional', 'aria-label': 'Quantidade de ações' });
  const preco = el('input', { class: 'campo', type: 'text', inputmode: 'decimal', placeholder: 'Opcional', 'aria-label': 'Preço da ação' });
  const estado = el('p', { class: 'legenda', role: 'status' });
  const saida = el('div', {});

  const arquivo = el('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'oculto-leitura', id: 'pdf-demonstrativo' });
  const solta = el('label', { class: 'solta', for: 'pdf-demonstrativo' }, el('strong', {}, 'Escolher o PDF do demonstrativo'), el('span', { class: 'legenda' }, 'ou arraste o arquivo para cá. Ele é lido neste aparelho e não é enviado a lugar nenhum.'), arquivo);
  const lerArquivo = async (f) => {
    if (!f) return;
    estado.textContent = 'Lendo o PDF…';
    try {
      const r = extrairContas(await ctx.comProgresso(textoDoPDF(f)));
      if (!r.achadas) { estado.textContent = 'Não reconheci as contas neste PDF. A leitura automática funciona com o formulário padronizado da CVM (ITR ou DFP); para outros formatos, digite os valores abaixo.'; return; }
      for (const [col, dados] of [['atual', r.atual], ['anterior', r.anterior]]) for (const [k, v] of Object.entries(dados)) if (entradas[k]?.[col]) entradas[k][col].value = String(v).replace('.', ',');
      if (!nome.value) nome.value = f.name.replace(/\.pdf$/i, '');
      estado.textContent = `${r.achadas} contas reconhecidas. Confira os valores, complete o que faltar e escolha a data e a duração do período.`;
    } catch (e) { console.error(e); estado.textContent = 'Não foi possível ler este PDF. Se ele for uma imagem escaneada, digite os valores abaixo.'; }
  };
  arquivo.addEventListener('change', () => lerArquivo(arquivo.files[0]));
  solta.addEventListener('dragover', (e) => { e.preventDefault(); solta.dataset.sobre = ''; });
  solta.addEventListener('dragleave', () => { delete solta.dataset.sobre; });
  solta.addEventListener('drop', (e) => { e.preventDefault(); delete solta.dataset.sobre; lerArquivo(e.dataTransfer.files[0]); });

  const analisar = async () => {
    const ler = (col) => Object.fromEntries(Object.entries(entradas).map(([k, c]) => [k, lerNumero(c[col].value)]));
    const atual = ler('atual'), anterior = ler('anterior');
    const faltam = ['receita', 'lucroLiquido', 'ativoTotal', 'patrimonioLiquido'].filter((k) => atual[k] == null);
    if (faltam.length) { estado.textContent = 'Para analisar, informe ao menos receita, lucro líquido, ativo total e patrimônio líquido do período atual.'; entradas[faltam[0]].atual.focus(); return; }
    const emp = montarEmpresa({ nome: nome.value.trim() || 'Empresa enviada', fim: fim.value, meses: Number(meses.value), atual, anterior, acoes: lerNumero(acoes.value) });
    const ind = await lerIndicadores().catch(() => null);
    const h = historico(emp, { preco: lerNumero(preco.value) });
    const d = { empresa: emp, historico: h, sintese: sintetizar(h, { selic: ind ? ind.selicMeta.valor / 100 : null }), frases: leituraPatrimonial(h), preco: lerNumero(preco.value) };
    saida.replaceChildren(
      el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' }, el('p', { class: 'selo' }, `Interpretação por regras · período encerrado em ${dataBR(fim.value)}`), el('h2', { class: 'titulo' }, `${emp.nome}.`), emp.anualizado && el('p', { class: 'legenda' }, `Resultado e caixa de ${meses.value} meses foram anualizados para o cálculo de margens e rentabilidade. Em negócios sazonais, isso distorce.`), blocoSintese(d))),
      el('section', { class: 'secao' }, el('div', { class: 'conteudo' }, el('h2', { class: 'titulo' }, 'O que os números dizem.'), el('ul', { class: 'frases copy' }, d.frases.map((f) => el('li', {}, f))))),
      el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' }, el('h2', { class: 'titulo' }, 'Critérios da síntese.'), el('p', { class: 'copy introducao' }, 'Sem os pares do setor, os critérios usam só as faixas gerais.'), blocoCriterios(d))),
      el('section', { class: 'secao' }, el('div', { class: 'conteudo' }, el('h2', { class: 'titulo' }, 'O que mudou.'), blocoTendencias(d))),
      el('section', { class: 'secao secao--mist' }, el('div', { class: 'conteudo' }, el('h2', { class: 'titulo' }, 'Estrutura do balanço.'), blocoBalanco(d))));
    ctx.animar(saida); estado.textContent = '';
    saida.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const tabela = el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Conta (em R$ mil)'), el('th', { scope: 'col' }, 'Período atual'), el('th', { scope: 'col' }, 'Mesmo período do ano anterior'))),
    CAMPOS.map(([grupo, campos]) => el('tbody', {}, el('tr', {}, el('th', { colspan: '3', scope: 'colgroup', class: 'kicker' }, grupo)), campos.map(([k, rotulo]) => el('tr', {}, el('th', { scope: 'row' }, rotulo), el('td', {}, celula(k, 'atual')), el('td', {}, celula(k, 'anterior'))))))));

  return { titulo: 'Enviar demonstrativo', no: el('div', {}, el('section', { class: 'secao' }, el('div', { class: 'conteudo' },
    el('header', { class: 'pagina__cabecalho' }, el('p', { class: 'kicker' }, el('a', { href: '#analise' }, 'Análise')), el('h1', { class: 'titulo' }, 'Analisar um demonstrativo.'), el('p', { class: 'copy introducao' }, 'Envie o PDF ou digite os valores do balanço, do resultado e do fluxo de caixa. O portal calcula os indicadores e aplica as mesmas regras da análise por código.')),
    solta, estado,
    el('div', { class: 'formulario formulario--largo espaco-topo' },
      el('div', { class: 'linha-campos linha-campos--iguais' }, el('label', { class: 'rotulo' }, el('span', {}, 'Empresa'), nome), el('label', { class: 'rotulo' }, el('span', {}, 'Encerramento do período'), fim)),
      el('label', { class: 'rotulo' }, el('span', {}, 'Duração do período'), el('span', { class: 'seletor' }, meses)),
      el('div', { class: 'linha-campos linha-campos--iguais' }, el('label', { class: 'rotulo' }, el('span', {}, 'Quantidade de ações'), acoes), el('label', { class: 'rotulo' }, el('span', {}, 'Preço da ação (R$)'), preco))),
    el('div', { class: 'espaco-topo' }, tabela),
    el('p', { class: 'espaco-topo' }, el('button', { class: 'pill pill--azul', type: 'button', onclick: analisar }, 'Analisar')))), saida) };
}
