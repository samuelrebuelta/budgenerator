import { test, expect, type Page, type Download } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const email = 'budgenerator@gmail.com';
const password = 'Local-emulator-Only-2026';
const project = 'demo-cimbra';
const fakeBudget = (id: string, name: string, address: string, price: number, number: string) => ({
  id,
  info: { clientName: name, address, date: '2026-10-14', budgetNumber: number },
  workItems: [
    {
      id: 'item',
      name: 'Pintura',
      tasks: [
        {
          id: 'task',
          description: 'Preparación y acabado de paredes',
          quantity: 10.5,
          unit: 'm2',
          price,
          cost: 4.25,
        },
      ],
    },
  ],
  ivaRate: 0.21,
  createdAt: `2026-10-${number === '03' ? '14' : '12'}T10:00:00Z`,
});
test.beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Only local emulators are allowed.');
  await fetch(`http://127.0.0.1:9199/emulator/v1/projects/${project}/accounts`, {
    method: 'DELETE',
  });
  const account = async (mail: string) => {
    const response = await fetch(
      'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail, password, returnSecureToken: true }),
      },
    );
    const data = (await response.json()) as { localId?: string };
    if (!data.localId) throw Error('Unable to seed auth emulator');
    return data.localId;
  };
  const uid = await account(email);
  const otherUid = await account('other@example.test');
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: { host: '127.0.0.1', port: 8180 },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      accountData: { isAdmin: true, plan: 'premium' },
      totalBudgetsCreated: 3,
      createdAt: '2026-10-01T10:00:00Z',
    });
    await setDoc(doc(db, 'users', otherUid), {
      uid: otherUid,
      email: 'other@example.test',
      accountData: { isAdmin: false, plan: 'free' },
      totalBudgetsCreated: 0,
      createdAt: '2026-10-01T10:00:00Z',
    });
    for (const b of [
      fakeBudget('demo-cocina', 'Reforma de cocina', 'Vivienda en Chamberí · Madrid', 420, '03'),
      fakeBudget('demo-estudio', 'Un nuevo estudio', 'Local en Gràcia · Barcelona', 280, '02'),
      fakeBudget(
        'demo-pintura',
        'Una casa con otra luz',
        'Pintura y acabados · Valencia',
        170,
        '01',
      ),
    ])
      await setDoc(doc(db, 'users', uid, 'budgets', b.id), b);
    await setDoc(doc(db, 'users', uid, 'profile', 'data'), {
      name: 'Estudio Roble',
      cif: 'B00000000',
      address: 'Dirección de demostración',
      phone: '',
      email,
    });
    for (const [id, name] of [
      ['catalog-main', 'Reformas · Mi selección'],
      ['catalog-paint', 'Pintura y acabados'],
    ])
      await setDoc(doc(db, 'users', uid, 'tariffCatalogs', id!), {
        id,
        name,
        tariffs: [
          {
            id: 'tariff',
            description: 'Pintura interior (dos manos)',
            unit: 'm2',
            basePrice: 12.75,
            cost: 5.25,
            category: 'Pintura',
          },
        ],
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });
    await setDoc(doc(db, 'users', uid, 'settings', 'tariffCatalog'), {
      activeCatalogId: 'catalog-main',
    });
    for (const [id, name] of [
      ['tpl-main', 'Reforma de baño'],
      ['tpl-paint', 'Puesta a punto'],
    ])
      await setDoc(doc(db, 'users', uid, 'templates', id!), {
        id,
        name,
        workItems: fakeBudget('sample', 'Sample', '', 12, '01').workItems,
        ivaRate: 0.21,
        createdAt: '2026-10-01',
      });
  });
  await env.cleanup();
  await mkdir('docs/testing-evidence', { recursive: true });
});
async function login(page: Page, mail = email) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(mail);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Presupuestos', exact: true })).toBeVisible();
}
async function editor(page: Page) {
  await page.goto('/budget/new');
  await expect(page.getByLabel('Nombre del cliente', { exact: true })).toBeVisible();
}
test('brand, desktop and mobile navigation with real seeded data', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Budgenerator' })).toBeVisible();
  await expect(page).toHaveTitle('budgenerator · Presupuestos');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toHaveCount(1);
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-login-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-login-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await expect(page.getByRole('link', { name: /Reforma de cocina/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menú de cuenta' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Mi cuenta', exact: true })).toHaveCount(1);
  await expect(page.getByText('Al día', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-dashboard-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-dashboard-mobile.png',
    fullPage: false,
  });
  const accountMenu = page.getByRole('button', { name: 'Abrir menú de cuenta', exact: true });
  await accountMenu.click();
  const dialog = page.getByRole('dialog', { name: 'Mi cuenta', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Administración', exact: true })).toBeVisible();
  for (let i = 0; i < 7; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(accountMenu).toBeFocused();
  const tabs = page.getByRole('navigation', { name: 'Navegación móvil' });
  for (const [name, path] of [
    ['Catálogos', '/catalogs'],
    ['Plantillas', '/templates'],
    ['Mi empresa', '/profile'],
    ['Presupuestos', '/budgets'],
  ]) {
    const link = tabs.getByRole('link', { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('button', { name: 'Nuevo presupuesto', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar en blanco', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/new$/);
  await expect(tabs.getByRole('link', { name: 'Presupuestos', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await tabs.getByRole('link', { name: 'Presupuestos', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('direct draft URLs survive reload and template IVA persists', async ({ page }) => {
  await login(page);
  await editor(page);
  await page.getByLabel('Nombre del cliente', { exact: true }).fill('Borrador conservado');
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('Nombre del cliente', { exact: true })).toHaveValue(
    'Borrador conservado',
  );
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await page.goto('/templates/new');
  await expect(page.getByLabel('Nombre de la plantilla')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Nombre de la plantilla')).toBeVisible();
  await page.getByLabel('Nombre de la plantilla').fill('Plantilla IVA 21');
  await page.getByRole('button', { name: 'Añadir partida', exact: true }).click();
  await page.getByRole('button', { name: 'Pintura', exact: true }).click();
  await page.getByLabel('IVA, porcentaje').fill('21');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plantillas', exact: true })).toBeVisible();
  await page.getByText('Plantilla IVA 21', { exact: true }).click();
  await expect(page.getByLabel('IVA, porcentaje')).toHaveValue('21');
});
test('decimal budget saves once, exports and shares no internal cost', async ({
  page,
  context,
}) => {
  await login(page);
  await editor(page);
  await page.getByLabel('Nombre del cliente', { exact: true }).fill('Prueba decimal');
  await page.getByRole('button', { name: 'Añadir partida', exact: true }).click();
  await page.getByRole('button', { name: 'Pintura', exact: true }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Acabado de demostración');
  await page.getByRole('spinbutton', { name: 'Cant.', exact: true }).fill('2.5');
  await page.getByRole('spinbutton', { name: 'Precio', exact: true }).fill('10.75');
  await page.getByRole('button', { name: 'Guardar presupuesto', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/[0-9a-f]{8}-[0-9a-f-]+$/);
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Cant.', exact: true })).toHaveValue('2.5');
  await expect(page.getByRole('spinbutton', { name: 'Precio', exact: true })).toHaveValue('10.75');
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-editor-desktop.png',
    fullPage: true,
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Crear enlace público', exact: true }).click();
  const publicLink = page.getByRole('link', { name: 'Abrir enlace', exact: true });
  await expect(publicLink).toBeVisible();
  const url = await publicLink.getAttribute('href');
  const publicPage = await context.newPage();
  await publicPage.goto(url!);
  await expect(publicPage.getByText('Prueba decimal', { exact: true })).toBeVisible();
  await expect(publicPage.getByText(/29,57\s*€/)).toBeVisible();
  let receiveDownload!: (download: Download) => void;
  const downloaded = new Promise<Download>((resolve) => (receiveDownload = resolve));
  const watchDownload = (popup: Page) => popup.once('download', receiveDownload);
  context.on('page', watchDownload);
  publicPage.once('download', receiveDownload);
  const popupPromise = publicPage.waitForEvent('popup');
  await publicPage.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const pdf = await popupPromise;
  const downloadedFile = await downloaded;
  await downloadedFile.saveAs('test-artifacts/exported-budget.pdf');
  expect((await readFile('test-artifacts/exported-budget.pdf')).subarray(0, 5).toString()).toBe(
    '%PDF-',
  );
  context.off('page', watchDownload);
  await pdf.close();
  await publicPage.close();
  await page.getByRole('button', { name: 'Revocar', exact: true }).click();
  await page.getByRole('button', { name: 'Revocar enlace', exact: true }).click();
  await expect(publicLink).toHaveCount(0);
});
test('catalog list opens an isolated editor and logout resets the library', async ({ page }) => {
  await login(page);
  await page.goto('/catalogs');
  await expect(page.getByRole('heading', { name: /^Tus catálogos/ })).toBeVisible();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Volver a presupuestos', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-catalogs-desktop.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: /^Pintura y acabados/ }).click();
  await expect(page).toHaveURL(/\/catalogs\/catalog-paint$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pintura y acabados', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Descripción', { exact: true }).fill('Tarifa revisada');
  await page.getByRole('spinbutton', { name: 'Coste', exact: true }).fill('6.75');
  await expect(page.getByText('Guardando…', { exact: true })).toBeVisible();
  await expect(page.getByText('Guardando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue('Tarifa revisada');
  await page.getByLabel('Nombre del catálogo', { exact: true }).fill('Pintura · Precios 2026');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Guardando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pintura · Precios 2026', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-catalog-detail-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-catalog-detail-mobile.png',
    fullPage: false,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Todos los catálogos', exact: true }).click();
  const defaultCatalog = page.getByRole('link', { name: /^Reformas · Mi selección/ });
  await expect(defaultCatalog.getByText('Por defecto', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/testing-evidence/budgenerator-catalogs-mobile.png',
    fullPage: true,
  });
  await defaultCatalog.click();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Pintura interior (dos manos)',
  );
  await expect(page.getByRole('spinbutton', { name: 'Coste', exact: true })).toHaveValue('5.25');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await login(page, 'other@example.test');
  await expect(page.getByRole('link', { name: /Reforma de cocina/ })).toHaveCount(0);
  await page.goto('/catalogs');
  await expect(page.getByRole('heading', { name: 'No hay catálogos', exact: true })).toBeVisible();
  const baseCatalogDialog = page.getByRole('dialog', {
    name: 'Selecciona un catálogo base',
    exact: true,
  });
  await expect(baseCatalogDialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear catálogo', exact: true }).click();
  await baseCatalogDialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(baseCatalogDialog).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Crear catálogo', exact: true }).click();
  await expect(baseCatalogDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(baseCatalogDialog).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Navegación móvil' })
    .getByRole('link', { name: 'Presupuestos', exact: true })
    .click();
  await expect(page).toHaveURL(/\/budgets$/);
});
test('catalog creation opens its detail and deletion returns to the list', async ({ page }) => {
  await login(page, 'other@example.test');
  await page.goto('/catalogs/missing-catalog');
  await expect(
    page.getByRole('heading', { name: 'Catálogo no encontrado', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Todos los catálogos', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Crear mi primer catálogo', exact: true }).click();
  await page.getByRole('button', { name: /^En blanco/ }).click();
  await expect(page).toHaveURL(/\/catalogs\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'En blanco', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Añadir concepto', exact: true }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Concepto de prueba');
  await page.getByLabel('Categoría', { exact: true }).selectOption('Pintura');
  await page.getByLabel('Coste', { exact: true }).fill('5.25');
  await page.getByLabel('PVP', { exact: true }).fill('12.75');
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.getByText('Guardando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue('Concepto de prueba');
  await page.getByRole('button', { name: 'Borrar catálogo', exact: true }).click();
  await page
    .getByRole('dialog', { name: '¿Borrar catálogo?', exact: true })
    .getByRole('button', { name: 'Sí, borrar catálogo', exact: true })
    .click();
  await expect(page).toHaveURL(/\/catalogs$/);
  await expect(page.getByRole('heading', { name: 'No hay catálogos', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('PWA opens offline, offers a bounded retry and applies an update on demand', async ({
  page,
  context,
}) => {
  await login(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Sin conexión\./)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No se ha podido cargar la página' })).toBeVisible(
    {
      timeout: 22000,
    },
  );
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Volver a intentarlo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Presupuestos', exact: true })).toBeVisible({
    timeout: 22000,
  });
  const index = await readFile('dist/index.html', 'utf8');
  await writeFile('dist/index.html', index + '<!-- local update regression -->');
  execFileSync('node', ['scripts/build-sw.mjs']);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Presupuestos', exact: true })).toBeVisible();
});

test('a missing boot bundle exposes recovery instead of leaving an endless spinner', async ({
  page,
}) => {
  const index = await readFile('dist/index.html', 'utf8');
  const entry =
    index.match(/src="([^"]+\.js)" crossorigin/)?.[1] ??
    index.match(/crossorigin src="([^"]+\.js)"/)?.[1];
  if (!entry) throw Error('Build entry not found');
  await page.route(`**${entry}`, (route) => route.abort());
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'Reparar instalación y reintentar', exact: true }),
  ).toBeVisible({ timeout: 17000 });
  await page.unroute(`**${entry}`);
  await page.getByRole('button', { name: 'Reparar instalación y reintentar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
