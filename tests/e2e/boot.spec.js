// tests/e2e/boot.spec.js -- verifica que o mapa carrega corretamente

import { test, expect } from '@playwright/test';

test.describe('Boot', () => {
  test('mapa carrega e loading overlay some', async ({ page }) => {
    await page.goto('/');

    // loading overlay deve sumir (timeout generoso pra CI)
    const overlay = page.locator('#loading-overlay');
    await expect(overlay).toHaveClass(/hidden/, { timeout: 45000 });

    // mapa deve existir
    const map = page.locator('#map');
    await expect(map).toBeVisible();

    // sidebar deve estar visivel
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('malha tem layers renderizados', async ({ page }) => {
    await page.goto('/');

    const overlay = page.locator('#loading-overlay');
    await expect(overlay).toHaveClass(/hidden/, { timeout: 45000 });

    // checar via estado global exposto no window
    const layerCount = await page.evaluate(() => {
      return window.__geodemo_state?.muniLayers?.size || 0;
    });

    // deve ter ~5570 municipios (tolerancia pra malha simplificada)
    expect(layerCount).toBeGreaterThan(5000);
  });

  test('stats panel mostra variavel ativa', async ({ page }) => {
    await page.goto('/');

    const overlay = page.locator('#loading-overlay');
    await expect(overlay).toHaveClass(/hidden/, { timeout: 45000 });

    const themeLabel = page.locator('#stat-theme');
    await expect(themeLabel).toHaveText('População');
  });
});
