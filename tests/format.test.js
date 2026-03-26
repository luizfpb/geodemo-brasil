// tests/format.test.js -- testa funcoes de formatacao
//
// roda com: node --test tests/format.test.js
// precisa simular document.createElement porque escapeHtml usa DOM

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// setup minimo de DOM pra escapeHtml funcionar
before(() => {
  // se JSDOM nao estiver disponivel, pular testes que precisam de DOM
  try {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
  } catch (_) {
    // se JSDOM nao disponivel, criar mock simples
    global.document = {
      createElement: () => {
        let _text = '';
        return {
          set textContent(v) { _text = v; },
          get innerHTML() {
            return _text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
          },
        };
      },
    };
  }
});

// importar depois do setup de DOM
let fmtPop, fmtPercent, fmtCurrency, fmtCompact, fmtDec, fmtDec2;

before(async () => {
  const mod = await import('../src/utils/format.js');
  fmtPop = mod.fmtPop;
  fmtPercent = mod.fmtPercent;
  fmtCurrency = mod.fmtCurrency;
  fmtCompact = mod.fmtCompact;
  fmtDec = mod.fmtDec;
  fmtDec2 = mod.fmtDec2;
});

describe('fmtPop', () => {
  it('formata inteiro com separador de milhar', () => {
    const result = fmtPop(1234567);
    // pt-BR usa ponto como separador de milhar
    assert.ok(result.includes('1'));
    assert.ok(result.includes('234'));
    assert.ok(result.includes('567'));
  });

  it('retorna travessao pra null', () => {
    assert.equal(fmtPop(null), '\u2014');
  });

  it('retorna travessao pra undefined', () => {
    assert.equal(fmtPop(undefined), '\u2014');
  });

  it('retorna travessao pra NaN', () => {
    assert.equal(fmtPop(NaN), '\u2014');
  });

  it('formata zero', () => {
    assert.equal(fmtPop(0), '0');
  });
});

describe('fmtPercent', () => {
  it('formata com virgula e %', () => {
    const result = fmtPercent(45.678);
    assert.equal(result, '45,7%');
  });

  it('aceita decimals customizado', () => {
    assert.equal(fmtPercent(45.678, 2), '45,68%');
  });

  it('retorna travessao pra null', () => {
    assert.equal(fmtPercent(null), '\u2014');
  });
});

describe('fmtCurrency', () => {
  it('formata como BRL', () => {
    const result = fmtCurrency(1500.5);
    // deve conter R$ e virgula
    assert.ok(result.includes('R$'));
    assert.ok(result.includes('1.500') || result.includes('1500'));
  });

  it('retorna travessao pra null', () => {
    assert.equal(fmtCurrency(null), '\u2014');
  });
});

describe('fmtCompact', () => {
  it('formata milhoes', () => {
    const result = fmtCompact(12_500_000);
    assert.ok(result.includes('mi'));
  });

  it('formata milhares', () => {
    const result = fmtCompact(45_000);
    assert.ok(result.includes('mil'));
  });

  it('formata bilhoes', () => {
    const result = fmtCompact(2_000_000_000);
    assert.ok(result.includes('bi'));
  });

  it('retorna travessao pra null', () => {
    assert.equal(fmtCompact(null), '\u2014');
  });
});
