// Testes das regras de integração que não dependem de rede: escolha de modelo de IA, horário do
// pregão para pedir cotações novas e o endereço pré-preenchido do token do GitHub.
// Rodar: node --test "testes/*.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { modelosDeTexto, modeloSugerido } from '../Portal/assets/js/agente/llm.js';
import { emPregao, cotacoesVelhas } from '../Portal/assets/js/privado/mercado.js';
import { linkToken } from '../Portal/assets/js/privado/ajustes.js';

test('IA: só modelos de texto e sugestão do flash-lite estável', () => {
  const lista = modelosDeTexto(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash-lite-preview', 'text-embedding-004', 'imagen-4', 'gemini-3.1-pro', 'gemini-2.5-flash-preview-tts', 'whisper-large-v3']);
  assert.deepEqual(lista, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash-lite-preview', 'gemini-3.1-pro']);
  assert.equal(modeloSugerido(lista), 'gemini-3.5-flash-lite');
  assert.equal(modeloSugerido(['gemini-3.8-flash', 'gemini-3.1-pro']), 'gemini-3.8-flash');
  assert.equal(modeloSugerido(['gemini-4-flash-lite-preview']), 'gemini-4-flash-lite-preview');
  assert.equal(modeloSugerido(['llama-3.3-70b']), 'llama-3.3-70b');
  assert.equal(modeloSugerido([]), '');
});

test('cotações: pedido de rodada só no pregão e com dados de mais de 40 minutos', () => {
  const segunda14h = new Date('2026-11-16T17:00:00Z'); // 14h de Brasília
  assert.equal(emPregao(segunda14h), true);
  assert.equal(emPregao(new Date('2026-11-15T17:00:00Z')), false); // domingo
  assert.equal(emPregao(new Date('2026-11-16T12:59:00Z')), false); // antes das 10h
  assert.equal(emPregao(new Date('2026-11-16T21:31:00Z')), false); // depois do fechamento
  assert.equal(cotacoesVelhas({ geradoEm: '2026-11-16T16:00:00Z' }, segunda14h), true);
  assert.equal(cotacoesVelhas({ geradoEm: '2026-11-16T16:30:00Z' }, segunda14h), false);
  assert.equal(cotacoesVelhas(null, segunda14h), true);
  assert.equal(cotacoesVelhas(null, new Date('2026-11-15T17:00:00Z')), false);
});

test('token do GitHub: página de criação pré-preenchida, só Contents e Actions', () => {
  const u = new URL(linkToken('dono/financas-dados'));
  assert.equal(u.origin + u.pathname, 'https://github.com/settings/personal-access-tokens/new');
  assert.equal(u.searchParams.get('target_name'), 'dono');
  assert.equal(u.searchParams.get('contents'), 'write');
  assert.equal(u.searchParams.get('actions'), 'write');
  assert.equal(u.searchParams.get('expires_in'), '366');
  const permissoes = [...u.searchParams.keys()].filter((k) => !['name', 'description', 'expires_in', 'target_name'].includes(k));
  assert.deepEqual(permissoes.sort(), ['actions', 'contents']);
  assert.equal(new URL(linkToken('')).searchParams.has('target_name'), false);
});
