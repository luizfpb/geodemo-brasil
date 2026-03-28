// tests/e2e/export.spec.js -- verifica exportacao de dados

import { test, expect } from '@playwright/test';

test.describe('Exportação', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#loading-overlay');
    await expect(overlay).toHaveClass(/hidden/, { timeout: 45000 });
  });

  test('botoes de export desabilitados sem selecao', async ({ page }) => {
    const csvBtn = page.locator('#export-csv-btn');
    const xlsxBtn = page.locator('#export-xlsx-btn');

    await expect(csvBtn).toBeDisabled();
    await expect(xlsxBtn).toBeDisabled();
  });

  test('CSV download dispara apos selecao', async ({ page }) => {
    // selecionar via busca
    const input = page.locator('#search-input');
    await input.fill('Resplendor');

    const results = page.locator('#search-results');
    await expect(results).toHaveClass(/visible/, { timeout: 5000 });

    const firstItem = results.locator('.search-item[data-code]').first();
    await firstItem.click();

    // CSV deve estar habilitado
    const csvBtn = page.locator('#export-csv-btn');
    await expect(csvBtn).toBeEnabled();

    // capturar download
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await csvBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/geodemo-brasil.*\.csv$/);
  });
});
