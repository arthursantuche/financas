// Chamada ao modelo de linguagem, por qualquer endereço compatível com a API de chat da OpenAI.
// A chave é do próprio usuário: fica no cofre cifrado e vai direto do navegador ao provedor.
// Sem configuração, o agente funciona no modo por regras (narrativa.js).

export const PROVEDORES = {
  gemini: { nome: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', ondeCriar: 'https://aistudio.google.com/apikey', dica: 'Chave gratuita criada no Google AI Studio com a sua conta Google.' },
  groq: { nome: 'Groq', base: 'https://api.groq.com/openai/v1', ondeCriar: 'https://console.groq.com/keys', dica: 'Chave gratuita criada no console da Groq.' },
  openrouter: { nome: 'OpenRouter', base: 'https://openrouter.ai/api/v1', ondeCriar: 'https://openrouter.ai/keys', dica: 'Use um modelo com o sufixo ":free" para não gerar custo.' },
  local: { nome: 'Servidor local', base: 'http://127.0.0.1:3001/v1', ondeCriar: null, dica: 'Um servidor compatível rodando neste computador (só funciona nele).' },
};

export class ErroLLM extends Error { constructor(m, status) { super(m); this.status = status; } }

const cabecalhos = (c) => ({ 'Content-Type': 'application/json', ...(c.chave ? { Authorization: `Bearer ${c.chave}` } : {}) });

export async function listarModelos(config) {
  const r = await fetch(`${config.base.replace(/\/$/, '')}/models`, { headers: cabecalhos(config) }).catch(() => { throw new ErroLLM('Sem conexão com o provedor.', 0); });
  if (!r.ok) throw new ErroLLM(r.status === 401 || r.status === 403 ? 'O provedor recusou a chave.' : `O provedor respondeu ${r.status}.`, r.status);
  const j = await r.json();
  return (j.data || j.models || []).map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean).sort();
}

// Devolve o texto da resposta. `json: true` pede resposta em JSON (o texto ainda é validado por quem chama).
export async function conversar(config, mensagens, { json = false, temperatura = 0.3, maxTokens = 3000, tempoMs = 90000 } = {}) {
  const corpo = { model: config.modelo, messages: mensagens, temperature: temperatura, max_tokens: maxTokens, ...(json ? { response_format: { type: 'json_object' } } : {}) };
  let r;
  try { r = await fetch(`${config.base.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: cabecalhos(config), body: JSON.stringify(corpo), signal: AbortSignal.timeout(tempoMs) }); }
  catch (e) { throw new ErroLLM(e.name === 'TimeoutError' ? 'O provedor demorou demais para responder.' : 'Sem conexão com o provedor de IA.', 0); }
  if (r.status === 429) throw new ErroLLM('Limite gratuito do provedor atingido. Tente mais tarde ou use o modo por regras.', 429);
  if (r.status === 401 || r.status === 403) throw new ErroLLM('O provedor recusou a chave de IA.', r.status);
  if (!r.ok) throw new ErroLLM(`O provedor de IA respondeu ${r.status}.`, r.status);
  const j = await r.json();
  const texto = j.choices?.[0]?.message?.content;
  if (!texto) throw new ErroLLM('O provedor devolveu uma resposta vazia.', 0);
  return { texto, uso: j.usage || null, modelo: j.model || config.modelo };
}

// Extrai o primeiro objeto JSON de um texto (alguns modelos cercam a resposta com ```json).
export function extrairJSON(texto) {
  const limpo = String(texto).replace(/```(?:json)?/gi, '').trim();
  const i = limpo.indexOf('{'), f = limpo.lastIndexOf('}');
  if (i < 0 || f <= i) throw new ErroLLM('A resposta da IA não veio no formato esperado.', 0);
  try { return JSON.parse(limpo.slice(i, f + 1)); } catch { throw new ErroLLM('A resposta da IA não veio no formato esperado.', 0); }
}
