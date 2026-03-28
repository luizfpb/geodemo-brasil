// tests/e2e/theme.spec.js -- verifica troca de tema

import { test, expect } from '@playwright/test';

test.describe('Troca de tema', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#loading-overlay');
    await expect(overlay).toHaveClass(/hidden/, { timeout: 45000 });
  });

  test('troca para Densidade e atualiza UI', async ({ page }) => {
    const select = page.locator('#theme-select');
    await select.selectOption('densidade');

    // aguardar carregamento do tema
    await page.waitForTimeout(2000);

    // select deve ter o valor correto
    await expect(select).toHaveValue('densidade');

    // label de variavel ativa deve atualizar
    const themeLabel = page.locator('#stat-theme');
    await expect(themeLabel).toHaveText('Densidade demográfica');

    // legenda deve existir no mapa
    const legend = page.locator('.pop-legend');
    await expect(legend).toBeVisible();
  });

  test('tema com subvariaveis mostra dropdown extra', async ({ page }) => {
    const select = page.locator('#theme-select');
    await select.selectOption('faixa-etaria');

    await page.waitForTimeout(2000);

    const subvar = page.locator('#theme-subvar');
    await expect(subvar).toBeVisible();
  });
});
