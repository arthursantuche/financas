// Avaliação de alertas. Funções puras, usadas pelo navegador (central de alertas) e pela rotina
// agendada do repositório privado (coleta/alertas.mjs): a regra é a mesma nos dois lugares.
//  alerta: { id, tipo, codigo, valor, base, descricao }
//  tipos de preço:  acima (preço ≥ valor) · abaixo (preço ≤ valor)
//                   alta (subiu valor% sobre a base) · queda (caiu valor% sobre a base)
//  fundamentos:     a síntese da análise passou a frágil, em deterioração ou com sinal de redução
//  documento:       a companhia entregou um demonstrativo mais novo que o conhecido (base = data)
//  só no navegador: concentracao (posição acima de valor% da carteira) · vencimento (em valor dias)

export const TIPOS = {
  acima: { nome: 'Preço acima de', unidade: 'R$', precisaCodigo: true, servidor: true },
  abaixo: { nome: 'Preço abaixo de', unidade: 'R$', precisaCodigo: true, servidor: true },
  alta: { nome: 'Alta de', unidade: '%', precisaCodigo: true, servidor: true, usaBase: true },
  queda: { nome: 'Queda de', unidade: '%', precisaCodigo: true, servidor: true, usaBase: true },
  fundamentos: { nome: 'Piora dos fundamentos', unidade: null, precisaCodigo: true, servidor: true },
  documento: { nome: 'Novo demonstrativo na CVM', unidade: null, precisaCodigo: true, servidor: true },
  concentracao: { nome: 'Posição acima de', unidade: '% da carteira', precisaCodigo: false, servidor: false },
  vencimento: { nome: 'Vencimento em até', unidade: 'dias', precisaCodigo: false, servidor: false },
};

const br = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// contexto: { precos: { COD: número }, sinteses: { COD: { saude, tendencia, sinal } },
//             documentos: { COD: 'AAAA-MM-DD' }, posicoes: [{ codigo, nome, peso, vencimento }], hoje }
export function avaliarAlerta(a, ctx) {
  const c = a.codigo?.toUpperCase(), p = c ? ctx.precos?.[c] : null;
  switch (a.tipo) {
    case 'acima': return p != null && p >= a.valor ? { texto: `${c} chegou a R$ ${br(p)}, acima de R$ ${br(a.valor)}.` } : null;
    case 'abaixo': return p != null && p <= a.valor ? { texto: `${c} caiu a R$ ${br(p)}, abaixo de R$ ${br(a.valor)}.` } : null;
    case 'alta': { if (p == null || !(a.base > 0)) return null; const v = p / a.base - 1; return v >= a.valor / 100 ? { texto: `${c} subiu ${br(v * 100)}% desde R$ ${br(a.base)} (agora R$ ${br(p)}).` } : null; }
    case 'queda': { if (p == null || !(a.base > 0)) return null; const v = p / a.base - 1; return v <= -a.valor / 100 ? { texto: `${c} caiu ${br(-v * 100)}% desde R$ ${br(a.base)} (agora R$ ${br(p)}).` } : null; }
    case 'fundamentos': {
      const s = ctx.sinteses?.[c];
      if (!s) return null;
      const motivos = [s.saude === 'situação frágil' && 'situação financeira frágil', s.tendencia === 'deterioração dos fundamentos' && 'fundamentos em deterioração', s.sinal === 'considerar redução ou venda' && 'sinal de redução pelas regras'].filter(Boolean);
      return motivos.length ? { texto: `${c}: ${motivos.join(', ')}.` } : null;
    }
    case 'documento': { const d = ctx.documentos?.[c]; return d && (!a.base || d > a.base) ? { texto: `${c} entregou demonstrativo com data de ${d.split('-').reverse().join('/')}.`, novaBase: d } : null; }
    case 'concentracao': { const acima = (ctx.posicoes || []).filter((x) => x.peso * 100 > a.valor); return acima.length ? { texto: `${acima.map((x) => `${x.codigo || x.nome} (${br(x.peso * 100)}%)`).join(', ')} acima de ${br(a.valor)}% da carteira.` } : null; }
    case 'vencimento': { const limite = ctx.hoje && new Date(Date.parse(ctx.hoje) + a.valor * 864e5).toISOString().slice(0, 10); const prox = (ctx.posicoes || []).filter((x) => x.vencimento && x.vencimento >= ctx.hoje && x.vencimento <= limite); return prox.length ? { texto: `Vencem em até ${a.valor} dias: ${prox.map((x) => `${x.codigo || x.nome} (${x.vencimento.split('-').reverse().join('/')})`).join(', ')}.` } : null; }
    default: return null;
  }
}

// Avalia uma lista e controla repetição: um alerta que continua verdadeiro não dispara de novo;
// volta a armar quando a condição deixa de valer. estado: { [id]: { ativo: bool, quando } }.
export function avaliarTodos(alertas, ctx, estado = {}, agora = new Date().toISOString()) {
  const disparos = [], novo = { ...estado };
  for (const a of alertas) {
    const r = avaliarAlerta(a, ctx), antes = estado[a.id];
    if (r && !antes?.ativo) disparos.push({ id: a.id, tipo: a.tipo, codigo: a.codigo || null, quando: agora, texto: r.texto, ...(r.novaBase ? { novaBase: r.novaBase } : {}) });
    novo[a.id] = { ativo: !!r && a.tipo !== 'documento', quando: r ? (antes?.ativo ? antes.quando : agora) : antes?.quando || null, ...(r?.novaBase ? { base: r.novaBase } : antes?.base ? { base: antes.base } : {}) };
  }
  return { disparos, estado: novo };
}
