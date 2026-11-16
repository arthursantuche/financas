// Núcleo determinístico do agente: recebe dados já coletados e devolve o dossiê, um JSON com tudo
// o que a recomendação precisa (diagnóstico da carteira, candidatos pontuados, ordens com
// quantidades, vendas para financiar, estruturas com opções, cenários, premissas e limites).
// Não há IA aqui: as mesmas entradas dão sempre o mesmo dossiê. O LLM, quando configurado, só
// escreve sobre estes números (narrativa.js). Funções puras: rodam no navegador e no Node.
// Critérios e pesos: Vault, Metodologia - Portal Finanças, seção 7.
import { concentracao, dimensionar, estatisticasConjuntas, riscoCarteira } from '../calculo/carteira.js';
import { alinhar, retornos, volatilidade, simularCenarios, drawdownMaximo } from '../calculo/estatistica.js';
import { analisarEstrutura, ESTRUTURAS, gregas, volatilidadeImplicita } from '../calculo/opcoes.js';
import { impostoRendaVariavel } from '../calculo/rendafixa.js';

// Faixa de renda variável (ações, ETFs de ações, FIIs, BDRs) por perfil e limites de concentração.
// São premissas do portal, editáveis em Ajustes; não são normas.
export const PERFIS = {
  conservador: { nome: 'Conservador', rvMin: 0, rvMax: 0.15, setorMax: 0.25, revisao: 0.15, pesos: { saude: 0.35, qualidade: 0.30, valor: 0.25, crescimento: 0.10 } },
  moderado: { nome: 'Moderado', rvMin: 0.15, rvMax: 0.40, setorMax: 0.30, revisao: 0.20, pesos: { saude: 0.25, qualidade: 0.30, valor: 0.25, crescimento: 0.20 } },
  arrojado: { nome: 'Arrojado', rvMin: 0.40, rvMax: 0.70, setorMax: 0.35, revisao: 0.25, pesos: { saude: 0.15, qualidade: 0.30, valor: 0.25, crescimento: 0.30 } },
};
const RV = new Set(['acao', 'etf', 'fii', 'bdr']);
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const arred = (v, c = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** c) / 10 ** c);

// ---- 1. Diagnóstico da carteira ----
export function diagnosticar({ linhas, info, total, perfil, tetoPorAtivo, historicos = {}, dossies = {} }) {
  const P = PERFIS[perfil] || PERFIS.moderado;
  const positivas = linhas.filter((l) => l.valor > 0);
  const peso = (filtro) => positivas.filter(filtro).reduce((s, l) => s + l.valor, 0) / (total || 1);
  const rv = peso((l) => RV.has(l.classe));
  const porSetor = new Map();
  for (const l of positivas.filter((x) => x.classe === 'acao')) { const s = info[l.id]?.setor || 'Não classificado'; porSetor.set(s, (porSetor.get(s) || 0) + l.valor / total); }
  const conc = concentracao(positivas.map((l) => l.valor / total));
  const liquidez = peso((l) => (l.classe === 'rendafixa' && l.indexador !== 'pre' && l.indexador !== 'ipca') || (l.classe === 'tesouro' && /selic/i.test(l.nome || '')));
  const achados = [];
  const add = (gravidade, titulo, texto) => achados.push({ gravidade, titulo, texto });
  for (const l of positivas) if (l.valor / total > tetoPorAtivo + 1e-9) add('atencao', `${l.codigo || l.nome} acima do teto por ativo`, `Pesa ${(l.valor / total * 100).toFixed(1)}% da carteira; o teto definido é ${(tetoPorAtivo * 100).toFixed(0)}%.`);
  for (const [s, w] of porSetor) if (w > P.setorMax) add('atencao', `Concentração no setor ${s}`, `As ações desse setor somam ${(w * 100).toFixed(1)}% da carteira; a referência do perfil ${P.nome.toLowerCase()} é até ${(P.setorMax * 100).toFixed(0)}%.`);
  if (rv > P.rvMax + 0.02) add('atencao', 'Renda variável acima da faixa do perfil', `Ações, ETFs e fundos imobiliários somam ${(rv * 100).toFixed(1)}%; a faixa do perfil ${P.nome.toLowerCase()} vai até ${(P.rvMax * 100).toFixed(0)}%.`);
  else if (rv < P.rvMin - 0.02) add('informacao', 'Renda variável abaixo da faixa do perfil', `Ações, ETFs e fundos imobiliários somam ${(rv * 100).toFixed(1)}%; a faixa do perfil ${P.nome.toLowerCase()} começa em ${(P.rvMin * 100).toFixed(0)}%.`);
  if (conc.efetivo < 5 && positivas.length >= 3) add('atencao', 'Poucas posições efetivas', `A carteira tem ${positivas.length} ativos, mas se comporta como ${conc.efetivo.toFixed(1)}: algumas posições pesam muito mais que as outras.`);
  if (liquidez < 0.05 && total > 0) add('informacao', 'Pouca reserva em pós-fixados', `Só ${(liquidez * 100).toFixed(1)}% da carteira está em títulos pós-fixados de resgate fácil. Confira se a reserva de emergência está fora desta carteira.`);
  for (const l of positivas.filter((x) => x.classe === 'acao')) {
    const d = dossies[l.codigo];
    if (d?.sintese.saude === 'situação frágil') add('atencao', `${l.codigo}: situação financeira frágil`, d.sintese.porque || 'Os critérios de endividamento, liquidez e rentabilidade estão desfavoráveis.');
    else if (d?.sintese.tendencia === 'deterioração dos fundamentos') add('informacao', `${l.codigo}: fundamentos em deterioração`, 'Mais indicadores pioraram do que melhoraram em 12 meses.');
  }
  // Risco conjunto da parte em bolsa, com os históricos disponíveis.
  let risco = null;
  const comHist = positivas.filter((l) => RV.has(l.classe) && (historicos[l.id] || []).length > 60);
  if (comHist.length >= 2) {
    const al = alinhar(comHist.map((l) => historicos[l.id].slice(-253)));
    if (al.datas.length > 40) {
      const est = estatisticasConjuntas(al.valores), soma = comHist.reduce((s, l) => s + l.valor, 0), pesos = comHist.map((l) => l.valor / soma);
      const r = riscoCarteira(pesos, est.cov);
      const pares = [];
      for (let i = 0; i < comHist.length; i++) for (let j = i + 1; j < comHist.length; j++) pares.push({ a: comHist[i].codigo, b: comHist[j].codigo, correlacao: arred(est.correlacao[i][j], 2) });
      pares.sort((x, y) => y.correlacao - x.correlacao);
      risco = { volatilidadeBolsa: arred(r.volatilidade), contribuicao: comHist.map((l, i) => ({ codigo: l.codigo, peso: arred(pesos[i]), risco: arred(r.contribuicao[i]), volatilidade: arred(est.volatilidades[i]) })).sort((x, y) => y.risco - x.risco), correlacoes: pares.slice(0, 6), pregoes: al.datas.length };
      for (const p of pares.filter((x) => x.correlacao > 0.8).slice(0, 3)) add('informacao', `${p.a} e ${p.b} andam juntos`, `Correlação de ${p.correlacao.toFixed(2)} nos últimos 12 meses: os dois diversificam pouco entre si.`);
    }
  }
  return {
    total: arred(total, 2), perfil: P.nome, rendaVariavel: arred(rv), faixaRendaVariavel: [P.rvMin, P.rvMax], posfixadosLiquidos: arred(liquidez),
    concentracao: { maior: arred(conc.maior), tresMaiores: arred(conc.tresMaiores), efetivo: arred(conc.efetivo, 1), ativos: positivas.length },
    setores: [...porSetor].map(([nome, w]) => ({ nome, peso: arred(w) })).sort((a, b) => b.peso - a.peso),
    posicoes: positivas.map((l) => ({ codigo: l.codigo || null, nome: l.nome, classe: l.classe, peso: arred(l.valor / total), rentabilidade: arred(l.rentabilidade), setor: info[l.id]?.setor || null, sintese: dossies[l.codigo] ? { saude: dossies[l.codigo].sintese.saude, tendencia: dossies[l.codigo].sintese.tendencia, sinal: dossies[l.codigo].sintese.sinal } : null })),
    risco, achados,
  };
}

// ---- 2. Triagem do universo ----
// Nota de 0 a 1 por dimensão, a partir dos indicadores de 12 meses e das medianas do setor.
export function pontuar(e, medianas, selic, pesos) {
  const fin = e.plano !== 'comercial';
  const qualidade = [e.roe != null ? lim((e.roe - 0.05) / 0.20) : null, !fin && e.roic != null ? lim((e.roic - 0.04) / 0.16) : null, e.margemLiquida != null && medianas.margemLiquida != null ? lim(0.5 + (e.margemLiquida - medianas.margemLiquida) / (Math.abs(medianas.margemLiquida) * 2 || 0.1)) : null];
  const saude = fin ? [e.roe != null ? lim(e.roe / 0.15) : null] : [e.dividaLiquida != null ? (e.dividaLiquida <= 0 ? 1 : e.dividaLiquidaEbitda == null ? 0 : e.dividaLiquidaEbitda <= 2 ? 0.8 : e.dividaLiquidaEbitda <= 3.5 ? 0.4 : 0) : null, e.liquidezCorrente != null ? (e.liquidezCorrente >= 1.5 ? 1 : e.liquidezCorrente >= 1 ? 0.5 : 0) : null, e.fcoSobreLucro != null ? (e.fcoSobreLucro >= 0.9 ? 1 : e.fcoSobreLucro >= 0.6 ? 0.5 : 0) : null];
  const crescimento = [e.crescimentoReceita != null ? lim((e.crescimentoReceita + 0.05) / 0.25) : null, e.crescimentoLucro != null ? lim((e.crescimentoLucro + 0.05) / 0.30) : null];
  const valor = [e.earningsYield != null && selic ? lim(e.earningsYield / selic) : null, e.evEbitda != null && medianas.evEbitda ? lim(1.5 - e.evEbitda / medianas.evEbitda) : null, e.pl != null && medianas.pl ? lim(1.5 - e.pl / medianas.pl) : null];
  const media = (v) => { const x = v.filter((n) => n != null); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; };
  const notas = { saude: media(saude), qualidade: media(qualidade), crescimento: media(crescimento), valor: media(valor) };
  // Dimensão sem dado conta como 0,4: abaixo do meio, para não premiar a falta de informação.
  const total = Object.entries(pesos).reduce((s, [k, w]) => s + w * (notas[k] ?? 0.4), 0);
  return { ...Object.fromEntries(Object.entries(notas).map(([k, v]) => [k, arred(v, 2)])), total: arred(total, 3) };
}

export function triar({ universo, medianasPorSetor, selic, perfil, diagnostico, tetoPorAtivo, receitaMinima = 500000, volumes = {} }) {
  const P = PERFIS[perfil] || PERFIS.moderado;
  const pesoSetor = new Map(diagnostico.setores.map((s) => [s.nome, s.peso]));
  const pesoAtivo = new Map(diagnostico.posicoes.filter((p) => p.codigo).map((p) => [p.codigo.slice(0, 4), p.peso]));
  const lista = [], descartes = { semPreco: 0, prejuizo: 0, pequenas: 0, semLiquidez: 0, noTeto: 0 };
  for (const e of universo) {
    if (e.preco == null) { descartes.semPreco++; continue; }
    if (!(e.lucro > 0) || e.roe == null) { descartes.prejuizo++; continue; }
    if ((e.receita || 0) < receitaMinima) { descartes.pequenas++; continue; }
    if (volumes[e.ticker] != null && volumes[e.ticker] < 3e6) { descartes.semLiquidez++; continue; }
    if ((pesoAtivo.get(e.ticker.slice(0, 4)) || 0) >= tetoPorAtivo) { descartes.noTeto++; continue; }
    const notas = pontuar(e, medianasPorSetor[e.setor] || {}, selic, P.pesos);
    // Diversificação: setor que já passa do limite do perfil perde 30% da nota; setor ausente ganha 5%.
    const ws = pesoSetor.get(e.setor) || 0;
    const ajuste = ws > P.setorMax ? 0.7 : ws === 0 ? 1.05 : 1;
    lista.push({ ...e, notas, nota: arred(notas.total * ajuste, 3), ajusteDiversificacao: ajuste, pesoSetorAtual: arred(ws) });
  }
  lista.sort((a, b) => b.nota - a.nota);
  return { candidatos: lista, descartes, avaliadas: universo.length };
}

// ---- 3. Seleção final e ordens ----
// `dossies`: dossiês completos dos finalistas (privado/empresa.js). Só entra quem passa na síntese.
export function selecionar({ finalistas, dossies, orcamento, diagnostico, perfil, tetoPorAtivo }) {
  const P = PERFIS[perfil] || PERFIS.moderado;
  const aprovados = [], reprovados = [];
  for (const c of finalistas) {
    const s = dossies[c.ticker]?.sintese;
    const motivo = !s ? 'sem demonstrativos suficientes' : s.saude === 'situação frágil' ? 'situação financeira frágil' : s.saude === 'dados insuficientes' ? 'dados insuficientes' : s.tendencia === 'deterioração dos fundamentos' ? 'fundamentos em deterioração' : s.sinal === 'considerar redução ou venda' ? 'sinal de redução pelas regras' : null;
    (motivo ? reprovados : aprovados).push(motivo ? { ticker: c.ticker, nota: c.nota, motivo } : c);
  }
  // Quanto do orçamento pode ir para renda variável sem estourar a faixa do perfil.
  const totalDepois = diagnostico.total + orcamento;
  const rvAtual = diagnostico.rendaVariavel * diagnostico.total;
  const espacoRV = Math.max(0, P.rvMax * totalDepois - rvAtual);
  const paraRV = Math.min(orcamento, espacoRV);
  const paraRF = orcamento - paraRV;
  // Número de papéis conforme o valor: evita ordens pequenas demais.
  const quantos = paraRV < 800 ? (paraRV >= 100 ? 1 : 0) : paraRV < 4000 ? 2 : paraRV < 15000 ? 3 : paraRV < 50000 ? 4 : 5;
  const escolhidos = [], setoresUsados = new Set();
  for (const c of aprovados) { if (escolhidos.length >= quantos) break; if (setoresUsados.has(c.setor)) continue; setoresUsados.add(c.setor); escolhidos.push(c); }
  // Peso proporcional à nota, limitado pelo espaço que cada papel ainda tem até o teto por ativo.
  const pesoAtual = new Map(diagnostico.posicoes.filter((p) => p.codigo).map((p) => [p.codigo, p.peso * diagnostico.total]));
  const alvos = escolhidos.map((c) => ({ ativo: c.ticker, peso: c.nota, maximo: Math.max(0, tetoPorAtivo * totalDepois - (pesoAtual.get(c.ticker) || 0)) }));
  const precos = Object.fromEntries(escolhidos.map((c) => [c.ticker, c.preco]));
  let d = dimensionar({ alvos, precos, orcamento: paraRV });
  // Respeita o teto: corta o excedente e devolve à sobra.
  let devolvido = 0;
  for (const o of d.ordens) { const max = alvos.find((a) => a.ativo === o.ativo).maximo; if (o.valor > max) { const q = Math.floor(max / o.preco); devolvido += (o.quantidade - q) * o.preco; o.quantidade = q; o.valor = q * o.preco; } }
  const ordens = d.ordens.filter((o) => o.quantidade > 0).map((o) => {
    const c = escolhidos.find((x) => x.ticker === o.ativo), dz = dossies[o.ativo];
    return { ticker: o.ativo, nome: c.nome, setor: c.setor, quantidade: o.quantidade, preco: o.preco, valor: arred(o.valor, 2), pesoNaCarteira: arred(((pesoAtual.get(o.ativo) || 0) + o.valor) / totalDepois), nota: c.nota, notas: c.notas, criterios: criteriosDeOperacao(dz, o.preco, P) };
  });
  return {
    ordens, paraRendaVariavel: arred(paraRV, 2), paraRendaFixa: arred(paraRF, 2), sobra: arred(d.sobra + devolvido, 2),
    motivoRendaFixa: paraRF <= 0.01 ? null : paraRV < 1
      ? `A renda variável já está na faixa máxima do perfil ${P.nome.toLowerCase()} (até ${(P.rvMax * 100).toFixed(0)}%): o valor inteiro foi indicado para renda fixa.`
      : `Para a renda variável não passar da faixa do perfil ${P.nome.toLowerCase()} (até ${(P.rvMax * 100).toFixed(0)}%), parte do valor foi indicada para renda fixa.`,
    reprovados, aprovados: aprovados.map((c) => ({ ticker: c.ticker, nota: c.nota, setor: c.setor })),
  };
}

// Critérios de entrada e de revisão, por regra. O preço-teto é o preço em que os critérios de preço
// favoráveis deixariam de valer; sem critério de preço favorável, 10% acima do preço atual.
export function criteriosDeOperacao(d, preco, P) {
  const u = d?.historico.ultimo?.udm, m = d?.medianas || {};
  const tetos = [];
  if (u) {
    if (u.lpa > 0 && m.pl) tetos.push(0.85 * m.pl * u.lpa);
    if (u.ebitda > 0 && m.evEbitda && u.acoes) tetos.push(((0.85 * m.evEbitda * u.ebitda - (u.dividaLiquida || 0)) * 1000) / u.acoes);
  }
  const validos = tetos.filter((t) => t > preco);
  const precoTeto = validos.length ? Math.min(...validos) : preco * 1.10;
  return {
    precoReferencia: arred(preco, 2), precoTeto: arred(precoTeto, 2), baseTeto: validos.length ? 'preço em que o papel deixa de estar 15% abaixo da mediana do setor em P/L ou EV/EBITDA' : '10% acima do preço de referência (não há critério de preço favorável a preservar)',
    entrada: ['Comprar só até o preço-teto; acima dele, a premissa de preço da recomendação deixa de valer.', 'Dividir a compra em duas ou três datas reduz o risco de entrar num dia ruim.'],
    revisao: [`Queda de ${(P.revisao * 100).toFixed(0)}% em relação ao preço de entrada (R$ ${(preco * (1 - P.revisao)).toFixed(2).replace('.', ',')}): reavaliar a tese, não vender automaticamente.`, 'Síntese da análise passar a "situação frágil" ou a "considerar redução ou venda".', 'Posição ultrapassar o teto por ativo por valorização: rebalancear.', 'Ocorrer um dos fatores que invalidam a tese.'],
    precoRevisao: arred(preco * (1 - P.revisao), 2),
  };
}

// ---- 4. Vendas sugeridas ----
export function sugerirVendas({ linhas, total, tetoPorAtivo, dossies, vendasNoMes = 0 }) {
  const vendas = [];
  for (const l of linhas.filter((x) => x.classe === 'acao' && x.valor > 0 && x.preco)) {
    const s = dossies[l.codigo]?.sintese, w = l.valor / total;
    let fracao = 0, motivo = null;
    if (s?.sinal === 'considerar redução ou venda') { fracao = s.saude === 'situação frágil' ? 1 : 0.5; motivo = s.porque; }
    else if (w > tetoPorAtivo * 1.15) { fracao = 1 - tetoPorAtivo / w; motivo = `A posição pesa ${(w * 100).toFixed(1)}% e o teto por ativo é ${(tetoPorAtivo * 100).toFixed(0)}%.`; }
    if (!fracao) continue;
    const quantidade = Math.floor(l.quantidade * fracao);
    if (quantidade < 1) continue;
    const valor = quantidade * l.preco, lucro = quantidade * (l.preco - l.precoMedio);
    vendas.push({ ticker: l.codigo, quantidade, preco: arred(l.preco, 2), valor: arred(valor, 2), lucro: arred(lucro, 2), motivo, total: fracao === 1 });
  }
  const somaVendas = vendas.reduce((s, v) => s + v.valor, 0) + vendasNoMes, somaLucro = vendas.reduce((s, v) => s + v.lucro, 0);
  const ir = impostoRendaVariavel({ classe: 'acoes', vendasMes: somaVendas, lucro: somaLucro });
  return { vendas, valor: arred(vendas.reduce((s, v) => s + v.valor, 0), 2), lucro: arred(somaLucro, 2), imposto: arred(ir.imposto, 2), isento: ir.isento, liquido: arred(vendas.reduce((s, v) => s + v.valor, 0) - ir.imposto, 2) };
}

// ---- 5. Estruturas com opções ----
// cadeia: { BASE: [{ codigo, tipo, strike, vencimento, ultimo, negocios }] }. Só opções com negócios
// no dia e vencimento entre 15 e 75 dias. Volatilidade histórica de 12 meses quando houver série.
export function estruturarOpcoes({ linhas, cadeia, historicos, hoje, juro, candidatos = [] }) {
  const estruturas = [];
  const dias = (v) => Math.round((Date.parse(v) - Date.parse(hoje)) / 864e5);
  const liquidas = (base) => (cadeia?.[base] || []).filter((o) => o.ultimo > 0 && (o.negocios ?? 1) >= 5 && dias(o.vencimento) >= 15 && dias(o.vencimento) <= 75);
  const volDe = (id) => { const h = historicos[id]; return h && h.length > 60 ? volatilidade(retornos(h.slice(-253).map((p) => p.valor))) : null; };
  const descrever = (tipo, titulo, base, pernas, S, opcoesUsadas, vol, extra) => {
    const a = analisarEstrutura(pernas, { precoAtual: S, faixa: 0.3, pontos: 121 });
    const T = dias(opcoesUsadas[0].vencimento) / 365;
    const detalhes = opcoesUsadas.map((o) => {
      const vi = volatilidadeImplicita({ tipo: o.tipo, preco: o.ultimo, S, K: o.strike, T, r: juro });
      const g = gregas({ tipo: o.tipo, S, K: o.strike, T, r: juro, sigma: vi || vol || 0.3 });
      return { codigo: o.codigo, tipo: o.tipo, strike: o.strike, premio: o.ultimo, vencimento: o.vencimento, negocios: o.negocios ?? null, volatilidadeImplicita: arred(vi), delta: arred(g.delta, 3), theta: arred(g.theta, 4), probabilidadeExercicio: arred(g.probabilidadeExercicio, 3) };
    });
    estruturas.push({ tipo, titulo, base, precoAtivo: arred(S, 2), diasAteVencimento: dias(opcoesUsadas[0].vencimento), volatilidadeHistorica: arred(vol), opcoes: detalhes, pernas,
      ganhoMaximo: Number.isFinite(a.ganhoMaximo) ? arred(a.ganhoMaximo, 2) : null, ganhoIlimitado: a.ganhoMaximo === Infinity, perdaMaxima: Number.isFinite(a.perdaMaxima) ? arred(a.perdaMaxima, 2) : null, perdaIlimitada: a.perdaMaxima === -Infinity,
      equilibrio: a.equilibrio, custo: arred(a.custo, 2), ...extra });
  };
  // Venda coberta e put de proteção sobre as ações que já estão na carteira (lote de 100).
  for (const l of linhas.filter((x) => x.classe === 'acao' && x.quantidade >= 100 && x.preco)) {
    const ops = liquidas(l.codigo), S = l.preco, lotes = Math.floor(l.quantidade / 100) * 100, vol = volDe(l.id);
    const proximoVenc = [...new Set(ops.map((o) => o.vencimento))].sort()[0];
    const doVenc = ops.filter((o) => o.vencimento === proximoVenc);
    const call = doVenc.filter((o) => o.tipo === 'call' && o.strike >= S * 1.04 && o.strike <= S * 1.15).sort((a, b) => a.strike - b.strike)[0];
    if (call) descrever('vendaCoberta', `Venda coberta de ${l.codigo}`, l.codigo, ESTRUTURAS.vendaCoberta({ precoAtivo: S, strike: call.strike, premio: call.ultimo, quantidade: lotes }), S, [call], vol, {
      objetivo: 'Gerar renda sobre ações que já estão na carteira, aceitando vendê-las no strike.', quantidade: lotes,
      retornoPremio: arred(call.ultimo / S), retornoSeExercida: arred((call.strike - S + call.ultimo) / S),
      riscos: ['Se a ação subir além do strike, o ganho fica limitado: a alta acima dele é de quem comprou a call.', 'A perda na queda da ação continua existindo; o prêmio só a reduz.', 'Se for exercida, a venda das ações entra na apuração de imposto do mês.'] });
    const put = doVenc.filter((o) => o.tipo === 'put' && o.strike <= S * 0.97 && o.strike >= S * 0.85).sort((a, b) => b.strike - a.strike)[0];
    if (put) descrever('putProtetora', `Proteção de ${l.codigo} com put`, l.codigo, ESTRUTURAS.putProtetora({ precoAtivo: S, strike: put.strike, premio: put.ultimo, quantidade: lotes }), S, [put], vol, {
      objetivo: 'Limitar a perda da posição até o vencimento, pagando um prêmio (como um seguro).', quantidade: lotes,
      custoProtecao: arred(put.ultimo / S), piso: arred(put.strike, 2),
      riscos: ['O prêmio é perdido se a ação não cair abaixo do strike.', 'A proteção acaba no vencimento: renovar custa um novo prêmio.', 'Proteger sempre, todos os meses, consome boa parte do retorno da ação.'] });
  }
  // Trava de alta para o primeiro candidato com cadeia líquida: aposta direcional com perda limitada.
  for (const c of candidatos) {
    const ops = liquidas(c.ticker), S = c.preco;
    const venc = [...new Set(ops.map((o) => o.vencimento))].sort()[0];
    const calls = ops.filter((o) => o.tipo === 'call' && o.vencimento === venc).sort((a, b) => a.strike - b.strike);
    const compra = calls.find((o) => o.strike >= S * 0.98), venda = compra && calls.find((o) => o.strike >= compra.strike * 1.05 && o.ultimo < compra.ultimo);
    if (!compra || !venda) continue;
    descrever('travaAltaCall', `Trava de alta em ${c.ticker}`, c.ticker, ESTRUTURAS.travaAltaCall({ strikeCompra: compra.strike, premioCompra: compra.ultimo, strikeVenda: venda.strike, premioVenda: venda.ultimo, quantidade: 100 }), S, [compra, venda], null, {
      objetivo: 'Participar de uma alta moderada com perda máxima conhecida e menor que a compra das ações.', quantidade: 100,
      riscos: ['A perda máxima é todo o valor pago, se a ação terminar abaixo do strike comprado.', 'O ganho é limitado ao intervalo entre os strikes.', 'O prazo é curto: a tese precisa se confirmar antes do vencimento.'] });
    break;
  }
  return estruturas;
}

// ---- 6. Cenários por simulação ----
export function cenarios(historico, horizonteAnos) {
  if (!historico || historico.length < 250) return null;
  const rets = retornos(historico.map((p) => p.valor));
  const sim = simularCenarios(rets, { horizonte: 252, simulacoes: 2000, semente: 42 });
  if (!sim) return null;
  return { horizonte: '12 meses', pessimista: arred(sim.p5), desfavoravel: arred(sim.p25), mediano: arred(sim.mediana), favoravel: arred(sim.p75), otimista: arred(sim.p95), probabilidadePerda: arred(sim.probabilidadePerda, 3), volatilidade: arred(volatilidade(rets.slice(-252))), maiorQueda: arred(drawdownMaximo(historico.map((p) => p.valor)).valor), pregoes: historico.length, metodo: 'reamostragem dos retornos diários históricos, 2.000 simulações, semente 42', horizonteDoInvestidor: horizonteAnos };
}

export const PREMISSAS = [
  'Preços de bolsa do último fechamento ou com atraso de 15 a 30 minutos, não em tempo real.',
  'Fundamentos dos últimos 12 meses pelos demonstrativos entregues à CVM; fatos posteriores não estão refletidos.',
  'A triagem considera lucro positivo, receita mínima e liquidez; não avalia governança, gestão nem fatos qualitativos.',
  'Faixas de perfil, teto por ativo e limites de setor são premissas configuráveis, não normas.',
  'Custos de corretagem, emolumentos e impostos não estão descontados dos valores das ordens.',
];
export const LIMITES = [
  'Recomendação gerada por regras e, quando indicado, redigida por IA: é uma hipótese de estudo para o dono da carteira, não uma ordem.',
  'Rentabilidade passada e simulações não garantem resultado. Os cenários descrevem o que os dados históricos comportariam, não o que vai acontecer.',
  'Posições de fundos e investidores institucionais, quando citadas, têm defasagem e não justificam uma compra por si.',
];
