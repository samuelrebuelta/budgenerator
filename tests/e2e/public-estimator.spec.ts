import { test, expect, type Page } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const project = 'demo-cimbra';
const email = 'estimator-owner@example.test';
const password = 'Local-emulator-Only-2026';
let ownerUid = '';
const previewPort = process.env.E2E_PREVIEW_PORT ?? '4173';

test.beforeAll(async () => {
  if (
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !process.env.FUNCTIONS_EMULATOR_HOST
  )
    throw new Error('Only local Firebase emulators are allowed.');

  await fetch(`http://127.0.0.1:9199/emulator/v1/projects/${project}/accounts`, {
    method: 'DELETE',
  });
  const response = await fetch(
    'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const account = (await response.json()) as { localId?: string };
  if (!account.localId) throw new Error('Unable to seed estimator account in Auth emulator.');
  ownerUid = account.localId;

  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: { host: '127.0.0.1', port: 8180 },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', account.localId!), {
      uid: account.localId,
      email,
      accountData: { isAdmin: false, plan: 'free' },
      totalBudgetsCreated: 0,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'users', account.localId!, 'profile', 'data'), {
      name: 'Estudio Roble',
      cif: '',
      address: '',
      phone: '',
      email,
    });
    await setDoc(doc(db, 'users', account.localId!, 'tariffCatalogs', 'main-v1'), {
      id: 'main-v1',
      name: 'Mi catálogo',
      parts: [
        {
          id: 'paint',
          name: 'Pintura',
          concepts: [
            {
              id: 'paint',
              description: 'Pintura interior',
              unit: 'm2',
              basePrice: 12.75,
              cost: 5.25,
            },
            {
              id: 'tile',
              description: 'Alicatado',
              unit: 'm2',
              basePrice: 32,
              cost: 18,
            },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'users', account.localId!, 'settings', 'tariffCatalog'), {
      activeCatalogId: 'main-v1',
    });
  });
  await env.cleanup();
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Presupuestos', exact: true })).toBeVisible();
}

test('owner publishes a simplified public estimate and can revoke its token link', async ({
  page,
}) => {
  await login(page);
  await page.goto('/profile');
  await page
    .getByLabel('URL del aviso de privacidad', { exact: true })
    .fill('https://roble.example/privacy');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/budgets$/);
  await page.goto('/profile/estimador-publico');
  await expect(page.getByRole('heading', { name: 'Estimador público', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Baño' }).check();
  await page.getByRole('checkbox', { name: 'Salón' }).check();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Media · desde €/m²', { exact: true }).nth(0).fill('12');
  await page.getByLabel('Media · hasta €/m²', { exact: true }).nth(0).fill('18');
  await page
    .getByRole('button', { name: 'Aumentar incremento de Baño en 10 euros por metro cuadrado' })
    .click();
  await page.getByLabel('Media · desde €/m²', { exact: true }).nth(1).fill('10');
  await page.getByLabel('Media · hasta €/m²', { exact: true }).nth(1).fill('14');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y generar enlace', exact: true }).click();

  const publicUrl = page.getByLabel('Enlace público', { exact: true });
  await expect(publicUrl).toBeVisible();
  const href = await publicUrl.inputValue();
  expect(href).toMatch(
    new RegExp(`^http://127\\.0\\.0\\.1:${previewPort}/solicitar-presupuesto/[A-Za-z0-9_-]{32}$`),
  );
  expect(href).not.toContain('estimator-owner');

  let publicResponse: unknown;
  let leadResponse: unknown;
  page.on('response', (response) => {
    const url = response.url();
    if (
      !url.includes('/europe-west1/getPublicEstimator') &&
      !url.includes('/europe-west1/calculatePublicEstimate') &&
      !url.includes('/europe-west1/submitPublicLead')
    )
      return;
    void response
      .json()
      .then((payload: { result?: unknown }) => {
        if (url.includes('/getPublicEstimator')) publicResponse = payload.result;
        else leadResponse = payload.result;
      })
      .catch(() => {});
  });

  await page.goto(href);
  await expect(
    page.getByRole('heading', { name: 'Cuéntanos qué quieres renovar', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Cocina' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Baño' }).check();
  await page.getByRole('checkbox', { name: 'Salón' }).check();
  await page.getByRole('radio', { name: 'Reforma integral', exact: true }).check();
  await expect(page.getByText(/Añade cada estancia por separado/)).toBeVisible();
  await page.getByLabel('Calidad · Baño 1', { exact: true }).selectOption('high');
  await page.getByLabel('Superficie aproximada de baño 1 (m²)', { exact: true }).fill('8');
  await page.getByLabel('Superficie aproximada de salón 1 (m²)', { exact: true }).fill('10');
  await page.getByLabel('Nombre', { exact: true }).fill('Lucía Martín');
  await page.getByLabel('Email', { exact: true }).fill('lucia@example.test');
  await page.getByLabel('Teléfono', { exact: true }).fill('+34 600 123 456');
  await page.getByLabel('Plazo aproximado', { exact: true }).selectOption('oneToThreeMonths');
  await page
    .getByRole('checkbox', { name: /acepto que me contacten sobre esta solicitud/i })
    .check();
  await page.screenshot({ path: 'docs/testing-evidence/bg005-public-form.png', fullPage: true });
  await page
    .getByRole('button', { name: 'Enviar solicitud y ver mi estimación', exact: true })
    .click();
  const result = page.getByRole('region', { name: 'El rango aproximado de tu reforma' });
  await expect(result).toContainText('276,00');
  await expect(result).toContainText('364,00');
  await expect(result).not.toContainText('paint');
  await expect(page.getByRole('status')).toContainText('Hemos recibido tu solicitud');
  await expect.poll(() => publicResponse).toBeDefined();
  await expect.poll(() => leadResponse).toBeDefined();
  expect(publicResponse).toMatchObject({
    schemaVersion: 2,
    companyName: 'Estudio Roble',
    leadCaptureEnabled: true,
    privacyPolicyUrl: 'https://roble.example/privacy',
  });
  expect((publicResponse as { services?: unknown[] }).services).toHaveLength(12);
  expect(leadResponse).toEqual({
    received: true,
    estimate: { minimumCents: 27600, maximumCents: 36400, currency: 'EUR', includesVat: false },
  });
  expect(JSON.stringify(publicResponse)).not.toContain(ownerUid);
  expect(JSON.stringify(publicResponse)).not.toMatch(/cost|basePrice|catalog|paint/i);
  expect(JSON.stringify(leadResponse)).not.toMatch(
    /lucía|lucia@example|600 123|cost|basePrice|catalog/i,
  );

  await page.goto('/profile/solicitudes');
  await expect(
    page.getByRole('heading', { name: 'Solicitudes recibidas', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Lucía Martín', { exact: true })).toBeVisible();
  await expect(page.getByText('lucia@example.test', { exact: true })).toBeVisible();
  await expect(page.getByText('+34 600 123 456', { exact: true })).toBeVisible();
  await expect(page.getByText(/Baño.*Reforma integral.*Calidad alta.*8 m²/)).toBeVisible();
  await expect(page.getByText(/Salón.*Reforma integral.*Calidad media.*10 m²/)).toBeVisible();
  await expect(page.getByText('Inicio previsto: En 1–3 meses', { exact: true })).toBeVisible();

  const mainNavigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(mainNavigation.getByRole('link', { name: 'Solicitudes' })).toBeVisible();
  await expect(mainNavigation.getByRole('link', { name: 'Mi empresa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Menú de cuenta' });
  await expect(accountMenu.getByRole('link', { name: 'Mi empresa' })).toBeVisible();
  await expect(accountMenu.getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
  await expect(accountMenu.getByRole('link', { name: 'Ayuda' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('link'),
  ).toHaveText(['Proyectos', 'Presupuestos', 'Catálogo', 'Solicitudes']);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole('button', { name: 'Crear presupuesto', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/new\?leadId=/);
  await expect(page.getByLabel('Nombre del cliente', { exact: true })).toHaveValue('Lucía Martín');
  await expect(page.getByRole('region', { name: 'Contexto de la solicitud' })).toContainText(
    'lucia@example.test',
  );
  await expect(page.getByRole('region', { name: 'Contexto de la solicitud' })).toContainText(
    '276,00',
  );
  await expect(page.getByRole('region', { name: 'Contexto de la solicitud' })).toContainText(
    'Inicio previsto: En 1–3 meses',
  );
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/[A-Za-z0-9-]+$/);
  await page.goto('/profile/solicitudes');
  await expect(page.getByRole('link', { name: /Abrir presupuesto/ })).toBeVisible();

  await page.getByRole('button', { name: 'Borrar solicitud', exact: true }).click();
  await page.getByRole('button', { name: 'Borrar', exact: true }).last().click();
  await expect(page.getByText('Lucía Martín', { exact: true })).toHaveCount(0);

  await page.goto('/profile/estimador-publico');
  await page.getByRole('button', { name: 'Revocar enlace', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Enlace revocado');
  await page.goto(href);
  await expect(
    page.getByRole('heading', { name: 'Este enlace no está disponible', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Estudio Roble', { exact: true })).toHaveCount(0);
});
