// Demonstrativos financeiros das companhias abertas, a partir dos dados abertos da CVM.
// Fonte: https://dados.cvm.gov.br (DFP anual, ITR trimestral, FCA cadastral). Licença aberta.
// Saída (R$ mil): Portal/dados/empresas/indice.json, <codigoCVM>.json e setores.json.
// Uso: node coleta/cvm.mjs [--anos 5] [--so 5410,9512]
import { join } from 'node:path';
import { baixar, linhasDoZip, registros, gravarJSON, DADOS, agora, log, mesesEntre } from './util.mjs';
import { historico } from '../Portal/assets/js/calculo/fundamentos.js';

const BASE = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC';
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const ANOS = Number(arg('anos', 5));
const SO = arg('so', '') ? new Set(arg('so', '').split(',').map((c) => c.trim().padStart(6, '0'))) : null;
const anoAtual = new Date().getUTCFullYear();

// Plano de contas fixo da CVM para empresas comerciais e industriais.
const CONTAS_BP = {
  '1': 'ativoTotal', '1.01': 'ativoCirculante', '1.01.01': 'caixa', '1.01.02': 'aplicacoes', '1.01.03': 'contasReceber',
  '1.01.04': 'estoques', '1.02': 'ativoNaoCirculante', '1.02.01': 'realizavelLP', '1.02.02': 'investimentos',
  '1.02.03': 'imobilizado', '1.02.04': 'intangivel',
  '2.01': 'passivoCirculante', '2.01.02': 'fornecedores', '2.01.04': 'dividaCP', '2.02': 'passivoNaoCirculante', '2.02.01': 'dividaLP',
};
const CONTAS_DRE = {
  '3.01': 'receita', '3.02': 'custo', '3.03': 'lucroBruto', '3.04': 'despesasOperacionais', '3.05': 'ebit',
  '3.06': 'resultadoFinanceiro', '3.06.01': 'receitasFinanceiras', '3.06.02': 'despesasFinanceiras',
};
const CONTAS_DFC = { '6.01': 'fco', '6.02': 'fci', '6.03': 'fcf' };
// Contas reconhecidas pela descrição: valem para todos os planos (bancos e seguradoras usam outros códigos).
const POR_DESCRICAO = [
  [/^Resultado Antes dos Tributos sobre o Lucro/i, 'lair'],
  [/^Imposto de Renda e Contribuição Social sobre o Lucro/i, 'impostos'],
  [/^Lucro(\/| ou )Prejuízo (Líquido )?(Consolidado )?do Período/i, 'lucroLiquido'],
  [/^Atribuído a(os)? Sócios da Empresa Controladora/i, 'lucroControladores'],
];
const CAPEX = /imobilizado|intang/i, NAO_CAPEX = /venda|aliena|recebimento|baixa|resultado/i;
const PROVENTOS = /dividendo|juros s(obre|\/) (o )?capital/i;
const DEPRECIACAO = /deprecia|amortiza/i;

// A CVM abrevia o setor das holdings: os dois nomes passam a ser um só.
const SETOR_UNIFICADO = {
  'Máqs., Equip., Veíc. e Peças': 'Máquinas, Equipamentos, Veículos e Peças',
  'Const. Civil, Mat. Const. e Decoração': 'Construção Civil, Mat. Constr. e Decoração',
  'Sem Setor Principal': 'Holdings diversificadas',
};

const empresas = new Map();   // cnpj → { cnpj, cvm, nome, plano }
const periodos = new Map();   // cnpj|fim → registro em construção
const versoes = new Map();    // cnpj|DT_REFER|origem → maior versão entregue

function registro(cnpj, fim) {
  const chave = `${cnpj}|${fim}`;
  let r = periodos.get(chave);
  if (!r) { r = { fim, bp: {}, fluxo: {}, bruto: {}, acoes: null, origem: null, consolidado: null }; periodos.set(chave, r); }
  return r;
}
// Guarda um valor de fluxo com o início do período e a prioridade (ÚLTIMO vale mais que PENÚLTIMO;
// entre iguais, vence o período mais longo, que é o acumulado do exercício).
function definirFluxo(r, chave, valor, ini, pri) {
  const a = r.bruto[chave];
  if (!a || pri > a.pri || (pri === a.pri && ini <= a.ini)) r.bruto[chave] = { valor, ini, pri };
}
function definirBP(r, chave, valor, pri) {
  const a = r.bp[chave];
  if (!a || pri >= a.pri) r.bp[chave] = { valor, pri };
}

async function lerIndice(zip, prefixo, ano, origem) {
  for await (const l of registros(linhasDoZip(zip, `${prefixo}_${ano}.csv`))) {
    const k = `${l.CNPJ_CIA}|${l.DT_REFER}|${origem}`, v = Number(l.VERSAO);
    if (!versoes.has(k) || v > versoes.get(k)) versoes.set(k, v);
    if (!empresas.has(l.CNPJ_CIA)) empresas.set(l.CNPJ_CIA, { cnpj: l.CNPJ_CIA, cvm: l.CD_CVM.padStart(6, '0'), nome: l.DENOM_CIA, plano: null });
  }
}

async function lerDemonstrativo(zip, prefixo, ano, origem, tipo, vistos) {
  for (const escopo of ['con', 'ind']) {
    const docsDoEscopo = new Set();
    for await (const l of registros(linhasDoZip(zip, `${prefixo}_${tipo}_${escopo}_${ano}.csv`), { campoLivre: 'DS_CONTA' })) {
      const cnpj = l.CNPJ_CIA, emp = empresas.get(cnpj);
      if (!emp || (SO && !SO.has(emp.cvm))) continue;
      if (Number(l.VERSAO) !== versoes.get(`${cnpj}|${l.DT_REFER}|${origem}`)) continue;
      const doc = `${cnpj}|${l.DT_REFER}|${tipo}`;
      if (escopo === 'ind' && vistos.has(doc)) continue; // já veio o consolidado
      docsDoEscopo.add(doc);
      const ultimo = l.ORDEM_EXERC.startsWith('Ú'), pri = ultimo ? 2 : 1;
      const escala = l.ESCALA_MOEDA === 'UNIDADE' ? 0.001 : 1;
      const valor = Number(l.VL_CONTA) * escala, cod = l.CD_CONTA, ds = l.DS_CONTA;
      if (!Number.isFinite(valor)) continue;
      const r = registro(cnpj, l.DT_FIM_EXERC);
      if (ultimo) { r.origem = origem; r.consolidado = escopo === 'con'; }
      if (tipo === 'BPA' || tipo === 'BPP') {
        if (cod === '1') definirBP(r, 'ativoTotal', valor, pri);
        if (/^Patrimônio Líquido( Consolidado)?$/i.test(ds) && cod.length === 4) definirBP(r, 'patrimonioLiquido', valor, pri);
        if (/^Participaç(ão|ões) d(os|e) (Acionistas )?Não Controladores/i.test(ds) && cod.startsWith('2.')) definirBP(r, 'minoritarios', valor, pri);
        if (emp.plano === 'comercial' && CONTAS_BP[cod]) definirBP(r, CONTAS_BP[cod], valor, pri);
      } else {
        const ini = l.DT_INI_EXERC;
        if (tipo === 'DRE') {
          if (cod === '3.01' && (ultimo || !emp.plano)) emp.plano = /Receita de Venda/i.test(ds) ? 'comercial' : /Intermediação Financeira/i.test(ds) ? 'banco' : 'outro';
          if (cod === '3.01') definirFluxo(r, 'receita', valor, ini, pri);
          if (cod === '3.03') definirFluxo(r, 'lucroBruto', valor, ini, pri);
          for (const [re, chave] of POR_DESCRICAO) if (re.test(ds)) definirFluxo(r, chave, valor, ini, pri);
          // Lucro básico por ação declarado (R$ por ação, sem escala): serve para descobrir se a
          // companhia informa a quantidade de ações em unidades ou em milhares.
          if (/^3\.99\.01\.\d\d$/.test(cod) && Number(l.VL_CONTA) > 0) definirFluxo(r, `lpa:${cod}`, Number(l.VL_CONTA), ini, pri);
          if (emp.plano === 'comercial' && CONTAS_DRE[cod]) definirFluxo(r, CONTAS_DRE[cod], valor, ini, pri);
        } else if (tipo === 'DFC_MI' || tipo === 'DFC_MD') {
          if (CONTAS_DFC[cod]) definirFluxo(r, CONTAS_DFC[cod], valor, ini, pri);
          if (/^6\.02\.\d\d$/.test(cod) && CAPEX.test(ds) && !NAO_CAPEX.test(ds) && valor < 0) definirFluxo(r, `capex:${cod}`, valor, ini, pri);
          if (/^6\.03\.\d\d$/.test(cod) && PROVENTOS.test(ds) && valor < 0) definirFluxo(r, `prov:${cod}`, -valor, ini, pri);
          if (/^6\.01\.01\.\d\d$/.test(cod) && DEPRECIACAO.test(ds)) definirFluxo(r, `daDFC:${cod}`, Math.abs(valor), ini, pri);
        } else if (tipo === 'DVA') {
          if (cod === '7.04.01') definirFluxo(r, 'da', Math.abs(valor), ini, pri);
        }
      }
    }
    for (const d of docsDoEscopo) vistos.add(d);
  }
}

async function lerCapital(zip, prefixo, ano, origem) {
  for await (const l of registros(linhasDoZip(zip, `${prefixo}_composicao_capital_${ano}.csv`))) {
    if (Number(l.VERSAO) !== versoes.get(`${l.CNPJ_CIA}|${l.DT_REFER}|${origem}`)) continue;
    const r = periodos.get(`${l.CNPJ_CIA}|${l.DT_REFER}`);
    if (r) r.acoes = { total: Number(l.QT_ACAO_TOTAL_CAP_INTEGR) || 0, ordinarias: Number(l.QT_ACAO_ORDIN_CAP_INTEGR) || 0, preferenciais: Number(l.QT_ACAO_PREF_CAP_INTEGR) || 0, tesouraria: Number(l.QT_ACAO_TOTAL_TESOURO) || 0 };
  }
}

async function lerCadastro() {
  // O formulário cadastral do ano corrente pode ainda não trazer todas as companhias: lê dois anos.
  const tickers = new Map(), setores = new Map(), atividades = new Map(), sites = new Map();
  for (const ano of [anoAtual - 1, anoAtual]) {
    let zip;
    try { zip = await baixar(`${BASE}/FCA/DADOS/fca_cia_aberta_${ano}.zip`, `fca_${ano}.zip`); } catch { continue; }
    for await (const l of registros(linhasDoZip(zip, `fca_cia_aberta_valor_mobiliario_${ano}.csv`))) {
      const cod = (l.Codigo_Negociacao || '').trim().toUpperCase();
      if (!/^[A-Z]{4}\d{1,2}$/.test(cod) || l.Mercado !== 'Bolsa' || l.Data_Fim_Negociacao) continue;
      if (!tickers.has(l.CNPJ_Companhia)) tickers.set(l.CNPJ_Companhia, new Set());
      tickers.get(l.CNPJ_Companhia).add(cod);
    }
    for await (const l of registros(linhasDoZip(zip, `fca_cia_aberta_geral_${ano}.csv`), { campoLivre: 'Descricao_Atividade' })) {
      if (l.Setor_Atividade) { const nome = l.Setor_Atividade.replace(/^Emp\. Adm\. Part\. - /, '').replace(/^Emp\. Adm\. Part\.?$/, 'Holdings').trim(); setores.set(l.CNPJ_Companhia, SETOR_UNIFICADO[nome] || nome); }
      if (l.Descricao_Atividade) atividades.set(l.CNPJ_Companhia, l.Descricao_Atividade.trim());
      if (l.Pagina_Web) sites.set(l.CNPJ_Companhia, l.Pagina_Web.trim());
    }
  }
  return { tickers, setores, atividades, sites };
}

function fechar(r) {
  // Início do período: o mais antigo entre as contas de resultado (o acumulado do exercício).
  const inis = Object.entries(r.bruto).filter(([k]) => !k.includes(':')).map(([, v]) => v.ini).filter(Boolean).sort();
  const inicio = inis[0] || null;
  const fluxo = {};
  let capex = null, prov = null, daDFC = null, lpa = null;
  for (const [k, v] of Object.entries(r.bruto)) {
    if (inicio && v.ini && v.ini !== inicio) continue; // valor de um trimestre isolado: descarta
    if (k.startsWith('lpa:')) { lpa = Math.max(lpa || 0, v.valor); continue; }
    if (k.startsWith('capex:')) capex = (capex || 0) + v.valor;
    else if (k.startsWith('prov:')) prov = (prov || 0) + v.valor;
    else if (k.startsWith('daDFC:')) daDFC = (daDFC || 0) + v.valor;
    else fluxo[k] = v.valor;
  }
  if (capex != null) fluxo.capex = capex;
  if (prov != null) fluxo.proventosPagos = prov;
  if (fluxo.da == null && daDFC != null) fluxo.da = daDFC;
  const bp = Object.fromEntries(Object.entries(r.bp).map(([k, v]) => [k, v.valor]));
  return { fim: r.fim, inicio, meses: null, origem: r.origem, consolidado: r.consolidado, bp, fluxo, acoes: r.acoes, lpaInformado: lpa };
}

async function principal() {
  const fontes = [];
  for (let ano = anoAtual - ANOS; ano <= anoAtual; ano++) fontes.push({ ano, origem: 'DFP', prefixo: 'dfp_cia_aberta', url: `${BASE}/DFP/DADOS/dfp_cia_aberta_${ano}.zip` });
  for (const ano of [anoAtual - 2, anoAtual - 1, anoAtual]) fontes.push({ ano, origem: 'ITR', prefixo: 'itr_cia_aberta', url: `${BASE}/ITR/DADOS/itr_cia_aberta_${ano}.zip` });

  for (const f of fontes) {
    try { f.zip = await baixar(f.url, `${f.origem.toLowerCase()}_${f.ano}.zip`); } catch (e) { log(`sem ${f.origem} ${f.ano}: ${e.message}`); continue; }
    await lerIndice(f.zip, f.prefixo, f.ano, f.origem);
  }
  for (const f of fontes.filter((x) => x.zip)) {
    log(`lendo ${f.origem} ${f.ano}`);
    const vistos = new Set();
    // A DRE vem primeiro: é ela que diz se a empresa usa o plano comercial ou o de bancos.
    for (const tipo of ['DRE', 'BPA', 'BPP', 'DFC_MI', 'DFC_MD', 'DVA']) await lerDemonstrativo(f.zip, f.prefixo, f.ano, f.origem, tipo, vistos);
    await lerCapital(f.zip, f.prefixo, f.ano, f.origem);
  }

  const cad = await lerCadastro();
  const porEmpresa = new Map();
  for (const [chave, r] of periodos) {
    const cnpj = chave.split('|')[0];
    if (!r.origem && !Object.keys(r.bruto).length) continue;
    if (!porEmpresa.has(cnpj)) porEmpresa.set(cnpj, []);
    porEmpresa.get(cnpj).push(fechar(r));
  }

  const indice = [], setores = {};
  let gravadas = 0;
  for (const [cnpj, lista] of porEmpresa) {
    const emp = empresas.get(cnpj), tickers = [...(cad.tickers.get(cnpj) || [])].sort();
    if (!tickers.length && !SO) continue; // só companhias com ações negociadas em bolsa
    const ps = lista.filter((p) => p.bp.ativoTotal != null || p.fluxo.lucroLiquido != null).sort((a, b) => (a.fim < b.fim ? -1 : 1));
    // Um período só serve se tiver início conhecido ou for apenas balanço (comparativo de fim de ano).
    for (const p of ps) { if (p.inicio) p.meses = mesesEntre(p.inicio, p.fim) || 12; else { p.meses = null; p.fluxo = {}; } }
    const uteis = ps.filter((p) => p.meses);
    if (!uteis.length) continue;
    // Escala das ações. A CVM não informa se a quantidade está em unidades ou em milhares, e a
    // mesma companhia muda de critério entre entregas. A decisão é por período: o valor patrimonial
    // por ação (VPA) precisa ficar numa faixa plausível. Com a quantidade lida como unidades, VPA
    // acima de R$ 2.000 indica milhares; abaixo de R$ 50, unidades. Entre os dois, decide o lucro
    // por ação declarado no período e, na falta dele, a maioria dos outros períodos.
    const decisao = (p) => {
      const qtd = p.acoes?.total, lucro = p.fluxo.lucroControladores ?? p.fluxo.lucroLiquido;
      if (!qtd) return null;
      const vpa = p.bp.patrimonioLiquido > 0 ? (p.bp.patrimonioLiquido * 1000) / qtd : null;
      if (vpa != null && vpa > 2000) return true;
      if (vpa != null && vpa < 50) return false;
      if (p.lpaInformado > 0 && lucro > 0) { const razao = (lucro * 1000) / p.lpaInformado / qtd; if (razao > 200 && razao < 5000) return true; if (razao > 0.2 && razao < 5) return false; }
      return null;
    };
    const decisoes = uteis.map(decisao);
    const maioria = decisoes.filter((d) => d === true).length > decisoes.filter((d) => d === false).length;
    let emMilhares = false;
    uteis.forEach((p, i) => {
      delete p.lpaInformado;
      if (p.acoes && (decisoes[i] ?? maioria)) { for (const k of Object.keys(p.acoes)) p.acoes[k] *= 1000; emMilhares = true; }
    });
    const empresa = {
      cvm: emp.cvm, cnpj, nome: emp.nome, tickers, setor: cad.setores.get(cnpj) || 'Não classificado',
      atividade: cad.atividades.get(cnpj) || null, site: cad.sites.get(cnpj) || null, plano: emp.plano || 'outro', acoesEmMilharesNaOrigem: emMilhares,
      fonte: 'CVM, dados abertos (DFP, ITR e FCA)', unidade: 'R$ mil', geradoEm: agora(), periodos: uteis,
    };
    if (await gravarJSON(join(DADOS, 'empresas', `${emp.cvm}.json`), empresa)) gravadas++;
    const h = historico(empresa), u = h.ultimo;
    indice.push({ cvm: emp.cvm, nome: emp.nome, tickers, setor: empresa.setor, plano: empresa.plano, ultimo: u?.fim || uteis[uteis.length - 1].fim });
    if (u?.udm) {
      const i = u.udm, r3 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
      (setores[empresa.setor] ||= []).push({
        cvm: emp.cvm, ticker: tickers[0], nome: emp.nome, fim: u.fim, plano: empresa.plano,
        receita: i.receita, ebitda: i.ebitda, ebit: i.ebit, lucro: i.lucroControladores, dividaLiquida: i.dividaLiquida, acoes: i.acoes,
        lpa: r3(i.lpa), vpa: r3(i.vpa), margemEbitda: r3(i.margemEbitda), margemEbit: r3(i.margemEbit), margemLiquida: r3(i.margemLiquida),
        margemBruta: r3(i.margemBruta), roe: r3(i.roe), roic: r3(i.roic), dividaLiquidaEbitda: r3(i.dividaLiquidaEbitda),
        liquidezCorrente: r3(i.liquidezCorrente), fcoSobreLucro: r3(i.fcoSobreLucro), crescimentoReceita: r3(u.anual?.receita), crescimentoLucro: r3(u.anual?.lucroLiquido),
      });
    }
  }
  if (!SO) {
    indice.sort((a, b) => a.nome.localeCompare(b.nome));
    await gravarJSON(join(DADOS, 'empresas', 'indice.json'), { fonte: 'CVM, dados abertos', geradoEm: agora(), empresas: indice });
    await gravarJSON(join(DADOS, 'empresas', 'setores.json'), { fonte: 'CVM, dados abertos; indicadores dos últimos 12 meses calculados pelo portal', geradoEm: agora(), setores });
  }
  log(`${indice.length} companhias com ações em bolsa; ${gravadas} arquivos atualizados`);
  if (!SO && indice.length < 250) throw new Error(`Só ${indice.length} companhias: formato da CVM pode ter mudado`);
}

principal().catch((e) => { console.error(e); process.exit(1); });
