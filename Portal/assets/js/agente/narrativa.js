// Redação dos relatórios do agente. Dois caminhos sobre o mesmo dossiê:
//   por regras: textos montados por modelos fixos, sempre disponíveis;
//   com IA: o modelo recebe o dossiê e escreve a parte qualitativa; cada trecho passa pelo
//           validador, que recusa texto com número ausente do dossiê. Trecho recusado volta ao
//           texto por regras, e o relatório registra o que aconteceu.
// Funções puras (salvo a chamada ao modelo, injetada): rodam no navegador e no Node.
import { conversar, extrairJSON } from './llm.js';

const p1 = (v) => (v == null ? null : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const x2 = (v) => (v == null ? null : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`);
const frase = (...partes) => partes.filter(Boolean).join(' ');

// ---- Validador de números ----
// Todo número citado pela IA precisa existir no dossiê (como valor, como percentual do valor ou
// arredondado), ser um inteiro pequeno (contagens: "cinco forças", "3 riscos") ou um ano.
export function numerosDoDossie(objeto) {
  const conjunto = new Set();
  const add = (n) => { if (!Number.isFinite(n)) return; for (const v of [n, n * 100, n / 1000, n / 1e6]) for (const c of [0, 1, 2]) conjunto.add(Math.abs(v).toFixed(c)); };
  (function andar(o) {
    if (typeof o === 'number') add(o);
    else if (typeof o === 'string') for (const m of o.matchAll(/\d+(?:[.,]\d+)*/g)) { const n = Number(m[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); add(n); }
    else if (Array.isArray(o)) o.forEach(andar);
    else if (o && typeof o === 'object') Object.values(o).forEach(andar);
  })(objeto);
  return conjunto;
}
export function numerosForaDoDossie(texto, conjunto) {
  const fora = [];
  for (const m of String(texto).matchAll(/\d+(?:[.,]\d+)*/g)) {
    const bruto = m[0];
    const n = Number(bruto.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) continue;
    if (Number.isInteger(n) && (n <= 12 || (n >= 1990 && n <= 2100))) continue; // contagens e anos
    const casas = (bruto.split(',')[1] || '').length;
    if (conjunto.has(Math.abs(n).toFixed(Math.min(casas, 2))) || conjunto.has(Math.abs(n).toFixed(0)) && casas === 0) continue;
    fora.push(bruto);
  }
  return fora;
}

// ---- Textos por regras ----
export function tesePorRegras(c) {
  const i = c.indicadores, s = c.sintese;
  return frase(
    `${c.ticker} foi selecionada pela triagem por regras: nota ${c.nota?.toLocaleString('pt-BR')} de 1, a partir de saúde financeira, qualidade, preço e crescimento.`,
    `A síntese dos demonstrativos indica ${s.saude} e ${s.tendencia}.`,
    i.roe != null && `O retorno sobre o patrimônio em 12 meses é de ${p1(i.roe)}${c.medianasSetor?.roe != null ? `, contra mediana de ${p1(c.medianasSetor.roe)} no setor` : ''}.`,
    i.dividaLiquidaEbitda != null && (i.dividaLiquidaEbitda <= 0 ? 'A empresa tem mais caixa que dívida.' : `A dívida líquida equivale a ${x2(i.dividaLiquidaEbitda)} o EBITDA.`),
    i.pl != null && `O preço corresponde a ${x2(i.pl)} o lucro por ação${c.medianasSetor?.pl != null ? ` (mediana do setor: ${x2(c.medianasSetor.pl)})` : ''}.`);
}
export function riscosPorRegras(c) {
  const r = c.desfavoraveis.map((d) => `Critério desfavorável: ${d}.`);
  if (c.cenarios) r.push(`Oscilação: volatilidade de ${p1(c.cenarios.volatilidade)} ao ano e maior queda histórica de ${p1(c.cenarios.maiorQueda)} na série usada.`);
  r.push('Risco de mercado: o preço pode cair por juros, câmbio ou cenário, sem mudança nos fundamentos.', 'Os demonstrativos são do passado: resultados futuros podem contrariar a tendência observada.');
  return r;
}
export function cenariosPorRegras(c) {
  const k = c.cenarios;
  if (!k) return { favoravel: 'Sem série histórica suficiente para simular cenários deste papel.', desfavoravel: 'Considere, como referência, que quedas de 30% ou mais em 12 meses já ocorreram em ações líquidas da bolsa brasileira.' };
  return {
    favoravel: `Em um quarto das simulações de 12 meses, o retorno ficou acima de ${p1(k.favoravel)}; em 5%, acima de ${p1(k.otimista)}.`,
    desfavoravel: `Em um quarto das simulações, o retorno ficou abaixo de ${p1(k.desfavoravel)}; em 5%, abaixo de ${p1(k.pessimista)}. A chance de terminar 12 meses no prejuízo, pelo modelo, foi de ${p1(k.probabilidadePerda)}.`,
  };
}
export const invalidacaoPorRegras = (c) => [
  'Queda de receita ou de margem por dois trimestres seguidos sem explicação pontual.',
  c.indicadores.dividaLiquidaEbitda != null && c.indicadores.dividaLiquidaEbitda > 0 ? 'Dívida líquida passar de 3,5 vezes o EBITDA.' : 'A empresa deixar de ter caixa líquido por aquisição ou distribuição extraordinária.',
  'Lucro deixar de se converter em caixa (caixa operacional abaixo de 0,6 vez o lucro).',
  'Preço subir acima do preço-teto sem melhora equivalente dos resultados.',
  'Mudança de controle, de regulação ou fato relevante que altere o negócio.',
].filter(Boolean);

export function resumoPorRegras(d) {
  const g = d.diagnostico, o = d.selecao.ordens;
  return frase(
    `A carteira soma ${g.concentracao.ativos} ativos, com ${p1(g.rendaVariavel)} em renda variável (faixa do perfil ${g.perfil.toLowerCase()}: ${p1(g.faixaRendaVariavel[0])} a ${p1(g.faixaRendaVariavel[1])}) e ${g.concentracao.efetivo.toLocaleString('pt-BR')} posições efetivas.`,
    g.achados.length ? `O diagnóstico levantou ${g.achados.length} ${g.achados.length === 1 ? 'ponto' : 'pontos'}: ${g.achados.slice(0, 3).map((a) => a.titulo).join('; ')}.` : 'O diagnóstico não encontrou concentração nem desvio relevante em relação ao perfil.',
    o.length ? `Com o valor informado, as regras indicam ${o.length === 1 ? 'uma compra' : `${o.length} compras`}: ${o.map((x) => x.ticker).join(', ')}.` : 'Com o valor e os critérios informados, as regras não indicam compra de ações agora.',
    d.selecao.paraRendaFixa > 0.01 && d.selecao.motivoRendaFixa,
    d.vendas?.vendas.length ? `Há ${d.vendas.vendas.length} ${d.vendas.vendas.length === 1 ? 'venda sugerida' : 'vendas sugeridas'} para reduzir risco ou financiar as compras.` : null);
}

// Relatório inteiro por regras.
export function narrarPorRegras(d) {
  return {
    modo: 'regras', modelo: null, recusados: [],
    resumo: resumoPorRegras(d),
    empresas: Object.fromEntries(d.empresas.map((c) => [c.ticker, {
      tese: tesePorRegras(c), riscos: riscosPorRegras(c), cenarios: cenariosPorRegras(c), invalidacao: invalidacaoPorRegras(c),
      modeloNegocio: c.atividade ? `Atividade declarada à CVM: ${c.atividade}` : null,
      posicionamento: null, vantagens: null, porter: null, macro: null, qualitativoPorIA: false,
    }])),
  };
}

// ---- Com IA ----
const SISTEMA = `Você é um analista de investimentos que escreve em português do Brasil, em linguagem clara e direta.
Você recebe um DOSSIÊ em JSON com números já calculados por um sistema determinístico. Regras obrigatórias:
1. Não faça contas e não invente números. Cite apenas números que estejam no dossiê, com o mesmo valor.
2. Nas partes qualitativas (modelo de negócio, concorrência, forças de Porter, vantagens), use seu conhecimento geral sobre a empresa e o setor, SEM números. Se não tiver segurança, diga que a informação precisa ser confirmada no Formulário de Referência da empresa.
3. Não prometa retorno, não use "garantido", "certeza" nem "sem risco". Probabilidades do dossiê são de um modelo, não previsões.
4. Não recomende nada além das ordens que já estão no dossiê. Seu papel é explicar, contextualizar e apontar riscos.
5. Responda só com um objeto JSON válido, no formato pedido, sem texto fora dele.`;

const FORMATO_EMPRESA = `{
 "modeloNegocio": "2 a 4 frases: como a empresa ganha dinheiro",
 "posicionamento": "2 a 3 frases: posição frente aos concorrentes",
 "porter": {"rivalidade": {"nivel": "baixa|média|alta", "texto": "1 a 2 frases"}, "novosEntrantes": {...}, "substitutos": {...}, "poderClientes": {...}, "poderFornecedores": {...}},
 "vantagens": ["até 4 vantagens competitivas, cada uma em uma frase"],
 "riscos": ["4 a 6 riscos operacionais e financeiros, usando os critérios desfavoráveis do dossiê"],
 "macro": "2 a 3 frases: como juros, inflação e câmbio do dossiê afetam esta empresa",
 "tese": "3 a 5 frases: por que a triagem escolheu este papel, com os números do dossiê",
 "cenarioFavoravel": "2 frases", "cenarioDesfavoravel": "2 frases",
 "invalidacao": ["3 a 5 fatos que invalidariam a tese"]
}`;

// O que segue ao provedor: sem valores absolutos da carteira, salvo consentimento explícito.
export function dossieParaIA(d, { enviarCarteira = false } = {}) {
  const g = d.diagnostico;
  return {
    data: d.geradoEm.slice(0, 10), macro: d.macro,
    carteira: { perfil: g.perfil, rendaVariavel: g.rendaVariavel, faixaRendaVariavel: g.faixaRendaVariavel, concentracao: g.concentracao, setores: g.setores, achados: g.achados.map((a) => a.titulo), ...(enviarCarteira ? { posicoes: g.posicoes.map((p) => ({ codigo: p.codigo, classe: p.classe, peso: p.peso })) } : {}) },
    ordens: d.selecao.ordens.map((o) => ({ ticker: o.ticker, setor: o.setor, pesoNaCarteira: o.pesoNaCarteira, nota: o.nota, precoTeto: o.criterios.precoTeto, preco: o.preco })),
    parametros: { horizonteAnos: d.parametros.horizonteAnos, perfil: d.parametros.perfil },
  };
}

async function pedirJSON(llm, config, sistema, usuario, opcoes) {
  const r = await llm(config, [{ role: 'system', content: sistema }, { role: 'user', content: usuario }], { json: true, ...opcoes });
  return { dados: extrairJSON(r.texto), modelo: r.modelo };
}
const textosDe = (o) => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(textosDe) : o && typeof o === 'object' ? Object.values(o).flatMap(textosDe) : []);

// Escreve com IA; em qualquer falha (rede, limite, formato, número inventado) fica o texto por regras.
export async function narrar(d, config, { llm = conversar, aoAvancar = () => {} } = {}) {
  const base = narrarPorRegras(d);
  if (!config?.chave && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(config?.base || '')) return base;
  const saida = { ...base, modo: 'ia', modelo: config.modelo, recusados: [], falhas: [] };
  const contexto = dossieParaIA(d, { enviarCarteira: d.parametros.enviarCarteiraAoLLM });
  try {
    aoAvancar('Resumo da carteira');
    const conj = numerosDoDossie(contexto);
    const { dados, modelo } = await pedirJSON(llm, config, SISTEMA, `DOSSIÊ:\n${JSON.stringify(contexto)}\n\nEscreva {"resumo": "4 a 6 frases: situação da carteira, o que as ordens fazem por ela e o principal risco"}.`, { maxTokens: 900 });
    saida.modelo = modelo;
    const fora = numerosForaDoDossie(dados.resumo || '', conj);
    if (dados.resumo && !fora.length) saida.resumo = dados.resumo; else saida.recusados.push({ trecho: 'resumo', numeros: fora });
  } catch (e) { saida.falhas.push(`Resumo: ${e.message}`); }
  for (const c of d.empresas) {
    aoAvancar(`Relatório de ${c.ticker}`);
    try {
      const conj = numerosDoDossie({ c, macro: d.macro });
      const { dados } = await pedirJSON(llm, config, SISTEMA, `DOSSIÊ DA EMPRESA:\n${JSON.stringify({ empresa: c, macro: d.macro, horizonteAnos: d.parametros.horizonteAnos })}\n\nEscreva o relatório neste formato:\n${FORMATO_EMPRESA}`, { maxTokens: 2600 });
      const alvo = saida.empresas[c.ticker], aceitos = {};
      for (const [chave, valor] of Object.entries(dados)) {
        const fora = textosDe(valor).flatMap((t) => numerosForaDoDossie(t, conj));
        if (fora.length) saida.recusados.push({ trecho: `${c.ticker}: ${chave}`, numeros: [...new Set(fora)] }); else aceitos[chave] = valor;
      }
      if (aceitos.tese) alvo.tese = aceitos.tese;
      if (Array.isArray(aceitos.riscos) && aceitos.riscos.length) alvo.riscos = aceitos.riscos;
      if (Array.isArray(aceitos.invalidacao) && aceitos.invalidacao.length) alvo.invalidacao = aceitos.invalidacao;
      if (aceitos.cenarioFavoravel && aceitos.cenarioDesfavoravel && !c.cenarios) alvo.cenarios = { favoravel: aceitos.cenarioFavoravel, desfavoravel: aceitos.cenarioDesfavoravel };
      else if (aceitos.cenarioFavoravel && aceitos.cenarioDesfavoravel) alvo.cenariosIA = { favoravel: aceitos.cenarioFavoravel, desfavoravel: aceitos.cenarioDesfavoravel };
      for (const k of ['modeloNegocio', 'posicionamento', 'macro']) if (typeof aceitos[k] === 'string') alvo[k] = aceitos[k];
      if (Array.isArray(aceitos.vantagens)) alvo.vantagens = aceitos.vantagens;
      if (aceitos.porter && typeof aceitos.porter === 'object') alvo.porter = aceitos.porter;
      alvo.qualitativoPorIA = true;
    } catch (e) { saida.falhas.push(`${c.ticker}: ${e.message}`); }
  }
  if (saida.falhas.length && !Object.values(saida.empresas).some((e) => e.qualitativoPorIA) && saida.resumo === base.resumo) saida.modo = 'regras';
  return saida;
}
