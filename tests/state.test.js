// tests/state.test.js -- testa logica do estado (selecao, grupos, agregacao)
//
// roda com: node --test tests/state.test.js

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// mock minimo de window (state.js seta window.__geodemo_state)
global.window = global.window || {};

let state;

beforeEach(async () => {
  // re-importar nao funciona bem com ESM, entao limpamos o estado manualmente
  if (!state) {
    state = await import('../src/state.js');
  }
  state.selection.clear();
  state.muniData.clear();
  state.muniLayers.clear();
  state.loadedThemes.clear();
  state.ui.activeTheme = 'populacao';
  state.ui.activeSubvar = null;
  state.ui.activeGroup = 'A';
});

describe('select / deselect', () => {
  it('seleciona um municipio no grupo ativo', () => {
    state.select('3100104');
    assert.equal(state.selection.size, 1);
    assert.equal(state.selection.get('3100104'), 'A');
  });

  it('nao duplica selecao', () => {
    state.select('3100104');
    state.select('3100104');
    assert.equal(state.selection.size, 1);
  });

  it('deseleciona um municipio', () => {
    state.select('3100104');
    state.deselect('3100104');
    assert.equal(state.selection.size, 0);
  });

  it('deselect de codigo inexistente nao quebra', () => {
    state.deselect('9999999');
    assert.equal(state.selection.size, 0);
  });
});

describe('toggleSelect', () => {
  it('seleciona se nao selecionado', () => {
    state.toggleSelect('3100104');
    assert.equal(state.selection.has('3100104'), true);
  });

  it('deseleciona se ja selecionado', () => {
    state.select('3100104');
    state.toggleSelect('3100104');
    assert.equal(state.selection.has('3100104'), false);
  });
});

describe('groups', () => {
  it('getGroupCodes retorna codigos do grupo correto', () => {
    state.ui.activeGroup = 'A';
    state.select('3100104');
    state.select('3550308');
    state.ui.activeGroup = 'B';
    state.select('2304400');

    const a = state.getGroupCodes('A');
    const b = state.getGroupCodes('B');
    assert.equal(a.length, 2);
    assert.equal(b.length, 1);
    assert.ok(a.includes('3100104'));
    assert.ok(b.includes('2304400'));
  });

  it('swapGroups troca A e B', () => {
    state.ui.activeGroup = 'A';
    state.select('3100104');
    state.ui.activeGroup = 'B';
    state.select('2304400');

    state.swapGroups();

    assert.equal(state.selection.get('3100104'), 'B');
    assert.equal(state.selection.get('2304400'), 'A');
  });
});

describe('aggregate', () => {
  it('soma populacao dos codigos', () => {
    state.muniData.set('3100104', { name: 'BH', pop: 2500000, uf: 'MG', area: null });
    state.muniData.set('3550308', { name: 'SP', pop: 12300000, uf: 'SP', area: null });

    const result = state.aggregate(['3100104', '3550308']);
    assert.equal(result.count, 2);
    assert.equal(result.totalPop, 14800000);
  });

  it('ignora municipios sem pop', () => {
    state.muniData.set('3100104', { name: 'BH', pop: 2500000, uf: 'MG', area: null });
    state.muniData.set('9999999', { name: 'X', pop: null, uf: '', area: null });

    const result = state.aggregate(['3100104', '9999999']);
    assert.equal(result.count, 2);
    assert.equal(result.totalPop, 2500000);
  });
});

describe('deselectAll', () => {
  it('limpa toda a selecao', () => {
    state.select('3100104');
    state.select('3550308');
    state.deselectAll();
    assert.equal(state.selection.size, 0);
  });
});

describe('ensure', () => {
  it('cria registro se nao existe', () => {
    const d = state.ensure('1234567');
    assert.equal(d.name, null);
    assert.equal(d.pop, null);
    assert.ok(state.muniData.has('1234567'));
  });

  it('retorna registro existente', () => {
    state.muniData.set('1234567', { name: 'Test', pop: 100, uf: 'XX', area: 50 });
    const d = state.ensure('1234567');
    assert.equal(d.name, 'Test');
    assert.equal(d.pop, 100);
  });
});
