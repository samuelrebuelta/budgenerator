import { test, expect, type Page, type Download } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const email = 'budgenerator@gmail.com';
const password = 'Local-emulator-Only-2026';
const project = process.env.E2E_FIREBASE_PROJECT_ID ?? 'demo-cimbra';
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9199';
const authEmulatorUrl = `http://${authEmulatorHost}`;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
const notificationLeadId = 'a'.repeat(64);
let primaryUid = '';
const fakeBudget = (id: string, name: string, address: string, price: number, number: string) => ({
  id,
  info: {
    clientName: name,
    address,
    date: number === '01' ? '2025-10-14' : '2026-10-14',
    budgetNumber: number,
  },
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
  catalogId: 'catalog-paint',
  ivaRate: 0.21,
  createdAt: `2026-10-${number === '03' ? '14' : '12'}T10:00:00Z`,
});
test.beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Only local emulators are allowed.');
  await fetch(`${authEmulatorUrl}/emulator/v1/projects/${project}/accounts`, {
    method: 'DELETE',
  });
  const account = async (mail: string) => {
    const response = await fetch(
      `${authEmulatorUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
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
  primaryUid = uid;
  const otherUid = await account('other@example.test');
  const quotaUid = await account('quota@example.test');
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
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
    await setDoc(doc(db, 'users', quotaUid), {
      uid: quotaUid,
      email: 'quota@example.test',
      accountData: { isAdmin: false, plan: 'free' },
      totalBudgetsCreated: 100,
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
    await setDoc(doc(db, 'users', uid, 'projects', 'project-navigation'), {
      id: 'project-navigation',
      sourceBudgetId: 'demo-cocina',
      sourceBudgetNumber: '03',
      title: 'Proyecto de navegación',
      clientName: 'Cliente de navegación',
      address: 'Dirección de demostración',
      budgetDate: '2026-10-12',
      acceptedAt: '2026-10-14T10:00:00Z',
      createdAt: '2026-10-14T10:00:00Z',
      subtotal: 420,
      iva: 88.2,
      total: 508.2,
      ivaRate: 0.21,
      workItemCount: 1,
      mode: 'amount',
      totalConcepts: 1,
      completedConcepts: 0,
      totalAmount: 420,
      completedAmount: 0,
      percent: 0,
      status: 'pending',
      supplementsSubtotal: 0,
      supplementsIva: 0,
      updatedTotal: 508.2,
    });
    await setDoc(
      doc(db, 'users', uid, 'projects', 'project-navigation', 'workItems', 'work-kitchen'),
      {
        id: 'work-kitchen',
        name: 'Cocina',
        position: 0,
        tasks: [
          {
            id: 'task-countertop',
            description: 'Instalar la encimera',
            quantity: 1,
            unit: 'unit',
            price: 420,
            cost: 270,
          },
        ],
      },
    );
    await setDoc(doc(db, 'users', uid, 'teamMembers', 'member-demo-ana'), {
      id: 'member-demo-ana',
      name: 'Ana Demo',
      status: 'active',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    });
    await setDoc(doc(db, 'users', uid, 'teamMembers', 'member-demo-hugo'), {
      id: 'member-demo-hugo',
      name: 'Hugo Soler',
      status: 'inactive',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    });
    await setDoc(doc(db, 'users', uid, 'crews', 'crew-demo-norte'), {
      id: 'crew-demo-norte',
      label: 'Cuadrilla Norte',
      color: 'blue',
      memberIds: ['member-demo-ana', 'member-demo-hugo'],
      status: 'active',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    });
    await setDoc(doc(db, 'users', uid, 'profile', 'data'), {
      name: 'Estudio Roble',
      logo: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="40"%3E%3Crect width="120" height="40" fill="%2324564c"/%3E%3C/svg%3E',
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
    await setDoc(doc(db, 'users', uid, 'leads', notificationLeadId), {
      schemaVersion: 2,
      contact: { name: 'Lead aviso demo', email: 'lead@example.test', phone: '+34 600 111 222' },
      selections: [
        {
          room: 'bathroom',
          scope: 'partial',
          quality: 'medium',
          areaM2: 9,
          instanceId: 'demo-room',
        },
      ],
      startTiming: 'asap',
      estimate: { minimumCents: 100000, maximumCents: 200000, currency: 'EUR', includesVat: false },
      createdAt: '2026-10-18T10:00:00Z',
      consentAt: '2026-10-18T10:00:00Z',
      privacyPolicyUrl: 'https://example.test/privacy',
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

test('notification request link survives login and shows a safe state in another account', async ({
  page,
  browser,
}) => {
  const path = `/profile/solicitudes?leadId=${notificationLeadId}`;
  await page.goto(path);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(path);
  const selectedLead = page.getByRole('heading', { name: 'Lead aviso demo' });
  await expect(selectedLead).toBeVisible();
  await expect(selectedLead).toBeFocused();

  const otherContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const otherPage = await otherContext.newPage();
    await otherPage.goto(path);
    await expect(otherPage).toHaveURL(/\/login$/);
    await otherPage.getByLabel('Email', { exact: true }).fill('other@example.test');
    await otherPage.getByLabel('Contraseña', { exact: true }).fill(password);
    await otherPage.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(otherPage).toHaveURL(path);
    await expect(otherPage.getByRole('status')).toContainText(
      'La solicitud solicitada no está disponible en esta cuenta.',
    );
    await expect(otherPage.getByText('Lead aviso demo')).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
});

test('push permission is requested after interaction and account settings are push-only', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const browserWindow = window as typeof window & { notificationPermissionRequests?: number };
    browserWindow.notificationPermissionRequests = 0;
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', {
        configurable: true,
        get: () => 'default',
      });
      Object.defineProperty(Notification, 'requestPermission', {
        configurable: true,
        value: () => {
          browserWindow.notificationPermissionRequests =
            (browserWindow.notificationPermissionRequests ?? 0) + 1;
          return Promise.resolve('denied');
        },
      });
    }
  });
  await login(page);
  const startupPrompt = page.getByRole('region', { name: 'Activar notificaciones push' });
  await expect(startupPrompt).toBeVisible();
  await expect(
    startupPrompt.getByRole('button', { name: 'Permitir notificaciones' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { notificationPermissionRequests?: number })
          .notificationPermissionRequests,
    ),
  ).toBe(0);
  await startupPrompt.getByRole('button', { name: 'Permitir notificaciones' }).click();
  await expect(
    startupPrompt.getByRole('heading', { name: 'Permite los avisos push' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { notificationPermissionRequests?: number })
          .notificationPermissionRequests,
    ),
  ).toBe(1);
  await startupPrompt.getByRole('link', { name: 'Abrir Mi cuenta' }).click();
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Notificaciones', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Avisos por correo' })).toHaveCount(0);
  const pushSwitch = page.getByRole('switch', { name: 'Avisos push' });
  await expect(pushSwitch).toBeVisible();
  await page.getByText('Avisos push', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El permiso está bloqueado');
  expect(
    await page.evaluate(
      () =>
        (window as Window & { notificationPermissionRequests?: number })
          .notificationPermissionRequests,
    ),
  ).toBe(1);
});

test('primary routes keep tabs and secondary routes use the common return on mobile', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const primaryTabs = [
    ['/budgets', 'Presupuestos'],
    ['/projects', 'Proyectos'],
    ['/team', 'Equipo'],
    ['/profile/solicitudes', 'Solicitudes'],
  ] as const;
  const mobileTabs = page.getByRole('navigation', { name: 'Navegación móvil' });
  for (const [path, label] of primaryTabs) {
    await page.goto(path);
    await expect(mobileTabs).toBeVisible();
    await expect(mobileTabs.getByRole('link')).toHaveText(primaryTabs.map(([, name]) => name));
    await expect(mobileTabs.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('[data-page-header]')).toBeVisible();
    await expect(page.locator('.workspace-footer')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.eyebrow')).toHaveCount(0);
    await expect(page.locator('.back-button')).toHaveCount(0);
    await expect(page.locator('.workspace-header')).toBeVisible();
  }
  await page.goto('/budgets');
  await mobileTabs.getByRole('link', { name: 'Equipo', exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(mobileTabs.getByRole('link', { name: 'Equipo', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, backTo] of [
    ['/catalog', '/budgets'],
    ['/templates', '/budgets'],
    ['/profile', '/projects'],
    ['/account', '/projects'],
    ['/admin', '/projects'],
    ['/help', '/projects'],
  ]) {
    await page.goto(path);
    await expect(page.locator('[data-page-header]')).toBeVisible();
    await expect(page.locator('.workspace-footer')).toHaveCount(0);
    await expect(page.locator('.workspace-header')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toHaveCount(0);
    await expect(page.locator('[data-page-header] > .back-button')).toHaveAttribute('href', backTo);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/budgets');
  const createBudget = page.getByRole('button', { name: 'Crear presupuesto', exact: true });
  await expect(createBudget).toBeVisible();
  await expect(createBudget.getByText('Nuevo presupuesto')).toBeHidden();
  expect(await createBudget.evaluate((button) => button.getBoundingClientRect().width)).toBe(44);
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' }).locator('a')).toHaveText([
    'Presupuestos',
    'Proyectos',
    'Equipo',
    'Solicitudes',
  ]);
  await page.setViewportSize({ width: 1440, height: 844 });
  const desktopCreateBudget = page.getByRole('button', { name: 'Crear presupuesto', exact: true });
  await expect(desktopCreateBudget).toBeVisible();
  await expect(desktopCreateBudget.getByText('Nuevo presupuesto')).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      '/catalog',
      '/budget/demo-cocina',
      '/projects/missing',
      '/templates/new',
      '/account/password',
    ]) {
      await page.goto(path);
      await expect(page.locator('[data-page-header]')).toBeVisible();
      await expect(page.locator('.workspace-footer')).toHaveCount(0);
      const workspaceHeader = page.locator('.workspace-header');
      const backButton =
        width <= 800
          ? page.locator('.mobile-header-back-slot .back-button')
          : page.locator('[data-page-header] > .back-button');
      await expect(workspaceHeader).toBeVisible();
      if (width <= 800) {
        await expect(page.locator('.mobile-brand')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Abrir menú de cuenta' })).toHaveCount(0);
      }
      await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toHaveCount(0);
      await expect(backButton).toBeVisible();
      if (path === '/projects/missing') {
        await expect(
          page.getByRole('heading', { name: 'Proyecto no disponible', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('heading', { name: 'No se ha podido cargar el proyecto', exact: true }),
        ).toHaveCount(0);
      }
      const backBounds = await backButton.boundingBox();
      const titleBounds = await page.getByRole('heading', { level: 1 }).boundingBox();
      if (width <= 800) {
        const headerBounds = await workspaceHeader.boundingBox();
        expect(titleBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y + headerBounds!.height);
      } else {
        expect(titleBounds!.y).toBeGreaterThanOrEqual(backBounds!.y + backBounds!.height);
      }
      await expect(page.locator('[data-page-header]')).toBeVisible();
    }
    await page.goto('/budgets');
    await expect(page.locator('.workspace-header')).toBeVisible();
  }
  await page.goto('/templates/new');
  const desktopBackButton = page.locator('[data-page-header] > .back-button');
  await expect(desktopBackButton).toHaveAttribute('href', '/templates');
  await page.getByLabel('Nombre de la plantilla').fill('Borrador UX');
  await desktopBackButton.click();
  await page
    .getByRole('dialog', { name: '¿Salimos de la plantilla?' })
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(page).toHaveURL(/templates\/new$/);
  await desktopBackButton.click();
  await page
    .getByRole('dialog', { name: '¿Salimos de la plantilla?' })
    .getByRole('button', { name: 'Descartar cambios', exact: true })
    .click();
  await expect(page).toHaveURL(/templates$/);
  await page.goto('/account/password');
  await expect(page.locator('[data-page-header] > .back-button')).toHaveAttribute(
    'href',
    '/account',
  );
});

test('opens projects from the root', async ({ page }) => {
  await login(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();
});

test('shows mobile back navigation on secondary pages and scrollable titles on every page', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 540 });

  const verifyTitleFlow = async (name: string) => {
    const header = page.locator('.workspace-header');
    const title = page.getByRole('heading', { name, exact: true }).first();
    const headerBottom = await header.evaluate((element) => element.getBoundingClientRect().bottom);
    const initialTitleTop = await title.evaluate((element) => element.getBoundingClientRect().top);
    expect(initialTitleTop).toBeGreaterThanOrEqual(headerBottom);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
    ).toBe(true);

    await page.evaluate(() => window.scrollTo({ top: 160, behavior: 'auto' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
    const stickyHeaderTop = await header.evaluate((element) => element.getBoundingClientRect().top);
    const scrolledTitleTop = await title.evaluate((element) => element.getBoundingClientRect().top);
    expect(stickyHeaderTop).toBeCloseTo(0, 0);
    expect(scrolledTitleTop).toBeLessThan(initialTitleTop);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  await page.goto('/team');
  await expect(page.locator('.workspace-header')).toBeVisible();
  await expect(page.locator('.mobile-brand')).toBeVisible();
  await expect(page.locator('.mobile-header-back-slot .back-button')).toHaveCount(0);
  await expect(page.locator('[data-page-header] > .back-button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir menú de cuenta' })).toBeVisible();
  const mobileTabs = page.getByRole('navigation', { name: 'Navegación móvil' });
  await expect(mobileTabs.getByRole('link')).toHaveText([
    'Presupuestos',
    'Proyectos',
    'Equipo',
    'Solicitudes',
  ]);
  await expect(mobileTabs.getByRole('link', { name: 'Equipo', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await verifyTitleFlow('Equipo');
  await mobileTabs.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await expect(page.locator('.mobile-brand')).toBeVisible();
  await expect(page.locator('.mobile-header-back-slot .back-button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir menú de cuenta' })).toBeVisible();
  await verifyTitleFlow('Proyectos');
});

test('manages individual members and colored crews from the team page', async ({ page }) => {
  await login(page);
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Equipo', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Secciones de Equipo' })).toHaveCount(0);
  const editTeamAction = page.getByRole('button', { name: 'Gestionar miembros y cuadrillas' });
  await editTeamAction.click();
  await expect(page).toHaveURL(/\/team\/manage$/);
  await expect(page.getByRole('heading', { name: 'Gestionar equipo', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver a Equipo' }).click();
  await expect(page).toHaveURL(/\/team$/);
  await editTeamAction.click();

  const header = page.locator('[data-page-header]');
  const title = header.getByRole('heading', { name: 'Gestionar equipo', exact: true });
  const subtitle = header.locator('.page-heading-meta > p');
  const crewAction = page.getByRole('button', { name: 'Crear cuadrilla', exact: true }).first();
  const memberAction = page.getByRole('button', { name: 'Añadir persona', exact: true }).first();
  const expectHeaderContentBelowTitle = async () => {
    const titleBottom = await title.evaluate((element) => element.getBoundingClientRect().bottom);
    const subtitleTop = await subtitle.evaluate((element) => element.getBoundingClientRect().top);
    const subtitleBottom = await subtitle.evaluate(
      (element) => element.getBoundingClientRect().bottom,
    );
    const crewActionTop = await crewAction.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    const memberActionTop = await memberAction.evaluate(
      (element) => element.getBoundingClientRect().top,
    );

    expect(subtitleTop).toBeGreaterThanOrEqual(titleBottom);
    expect(crewActionTop).toBeGreaterThanOrEqual(titleBottom);
    expect(memberActionTop).toBeGreaterThanOrEqual(titleBottom);
    if (await page.evaluate(() => window.innerWidth <= 800)) {
      expect(crewActionTop).toBeGreaterThanOrEqual(subtitleBottom);
      expect(memberActionTop).toBeGreaterThanOrEqual(subtitleBottom);
    }
  };

  await expect(subtitle).toBeVisible();
  await expect(crewAction).toHaveText('');
  await expect(memberAction).toHaveText('');
  await expectHeaderContentBelowTitle();
  await page.screenshot({ path: 'docs/testing-evidence/bg011-team-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectHeaderContentBelowTitle();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'docs/testing-evidence/bg011-team-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByRole('button', { name: 'Añadir persona', exact: true }).first().click();
  const memberDialog = page.getByRole('dialog', { name: 'Añadir persona' });
  await memberDialog.getByLabel('Nombre', { exact: true }).fill('Ana Pérez');
  await memberDialog.getByRole('button', { name: 'Guardar persona' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Demo' })).toBeVisible();

  await page.getByRole('button', { name: 'Editar a Ana Pérez' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar persona' });
  await editDialog.getByLabel('Nombre', { exact: true }).fill('Ana Pérez Rojas');
  await editDialog.getByRole('button', { name: 'Guardar persona' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Pérez Rojas' })).toBeVisible();

  await page.getByRole('button', { name: 'Crear cuadrilla' }).first().click();
  const crewDialog = page.getByRole('dialog', { name: 'Crear cuadrilla' });
  await crewDialog.getByLabel('Etiqueta', { exact: true }).fill('Alba');
  await crewDialog.getByRole('button', { name: 'Color Verde' }).click();
  await crewDialog.getByRole('checkbox', { name: 'Ana Pérez Rojas' }).check();
  await crewDialog.getByRole('button', { name: 'Guardar cuadrilla' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Gestión de personas y cuadrillas' })
      .getByText('Alba', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: 'Ana Pérez Rojas' })).toBeVisible();

  await page.getByRole('button', { name: 'Desactivar a Ana Pérez Rojas' }).click();
  await expect(page.getByText('Sin integrantes activos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desactivar cuadrilla Alba' })).toBeVisible();
  await page.goto('/projects/project-navigation');
  await page.getByRole('button', { name: 'Asignar equipo' }).click();
  const inactiveAssignmentDialog = page.getByRole('dialog', {
    name: 'Asignar equipo al proyecto',
  });
  await expect(
    inactiveAssignmentDialog.getByRole('listitem').filter({ hasText: 'Ana Pérez Rojas' }),
  ).toHaveCount(0);
  await expect(
    inactiveAssignmentDialog.getByRole('listitem').filter({ hasText: 'Alba' }),
  ).toHaveCount(0);
  await inactiveAssignmentDialog.getByRole('button', { name: 'Cerrar' }).first().click();
  await page.goto('/team');
  await page.getByRole('button', { name: 'Gestionar miembros y cuadrillas' }).click();
  await page.getByRole('button', { name: 'Reactivar a Ana Pérez Rojas' }).click();
  await expect(page.getByText('1 persona activa')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/team\/manage$/);
  await expect(page.getByRole('heading', { name: 'Ana Pérez Rojas' })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Gestión de personas y cuadrillas' })
      .getByText('Alba', { exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 320, height: 760 });
  await expect(page.getByRole('heading', { name: 'Gestionar equipo', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const addMemberButton = page.getByRole('button', { name: 'Añadir persona', exact: true }).first();
  await addMemberButton.focus();
  await page.keyboard.press('Enter');
  const keyboardDialog = page.getByRole('dialog', { name: 'Añadir persona' });
  await expect(keyboardDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(keyboardDialog).toBeHidden();
});

test('assigns people and crews to a project as immutable snapshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.goto('/projects/project-navigation');
  await expect(page.getByRole('heading', { name: 'Equipo asignado' })).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar aviso de instalación' }).click();
  await page
    .getByRole('region', { name: 'Activar notificaciones push' })
    .getByRole('button', { name: 'Ahora no' })
    .click();

  await page.getByRole('button', { name: 'Asignar equipo' }).click();
  const firstDialog = page.getByRole('dialog', { name: 'Asignar equipo al proyecto' });
  await firstDialog
    .getByRole('listitem')
    .filter({ hasText: 'Ana Demo' })
    .getByRole('button', { name: 'Asignar', exact: true })
    .click();
  await expect(firstDialog).toBeHidden();
  await page.getByRole('button', { name: 'Asignar equipo' }).click();
  const secondDialog = page.getByRole('dialog', { name: 'Asignar equipo al proyecto' });
  await expect(secondDialog.getByRole('heading', { name: 'Cuadrillas' })).toBeVisible();
  await secondDialog
    .getByRole('listitem')
    .filter({ hasText: 'Cuadrilla Norte' })
    .getByRole('button', { name: 'Asignar', exact: true })
    .click();
  await expect(secondDialog).toBeHidden();

  await expect(page.getByRole('heading', { name: 'Ana Demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cuadrilla Norte' })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Integrantes de Cuadrilla Norte' }).getByText('Hugo Soler'),
  ).toHaveCount(0);
  await expect(page.getByText('Color de cuadrilla', { exact: true })).toHaveCount(0);
  const crewAssignment = page
    .getByRole('list', { name: 'Asignaciones del proyecto' })
    .getByRole('listitem')
    .filter({ hasText: 'Cuadrilla Norte' });
  await expect(crewAssignment).toHaveClass(/bg-\[#eaf1ed\]/);
  await expect(crewAssignment.locator('span.h-3.w-3')).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitar asignación de Ana Demo' }).click();
  await page.getByRole('button', { name: 'Asignar equipo' }).click();
  const crewMemberDialog = page.getByRole('dialog', { name: 'Asignar equipo al proyecto' });
  const crewMemberRow = crewMemberDialog.getByRole('listitem').filter({ hasText: 'Ana Demo' });
  await expect(
    crewMemberRow.getByRole('button', { name: 'Incluida en Cuadrilla Norte', exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: 'docs/testing-evidence/bg011-crew-member-blocked-desktop.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/testing-evidence/bg011-crew-member-blocked-mobile.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await crewMemberDialog.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(page.getByRole('heading', { name: 'Ana Demo' })).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: 'docs/testing-evidence/bg011-project-team-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/testing-evidence/bg011-project-team-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/team');
  await page.getByRole('button', { name: 'Gestionar miembros y cuadrillas' }).click();
  await expect(page).toHaveURL(/\/team\/manage$/);
  await page.getByRole('button', { name: 'Editar cuadrilla Cuadrilla Norte' }).click();
  const crewDialog = page.getByRole('dialog', { name: 'Editar cuadrilla' });
  await crewDialog.getByLabel('Etiqueta', { exact: true }).fill('Cuadrilla Norte Renovada');
  await crewDialog.getByRole('button', { name: 'Color Ámbar' }).click();
  await crewDialog.getByRole('button', { name: 'Guardar cuadrilla' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Gestión de personas y cuadrillas' })
      .getByText('Cuadrilla Norte Renovada', { exact: true }),
  ).toBeVisible();

  await page.goto('/projects/project-navigation');
  await expect(page.getByRole('heading', { name: 'Cuadrilla Norte' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cuadrilla Norte Renovada' })).toHaveCount(0);
  await expect(page.getByText('Hugo Soler', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Quitar asignación de Cuadrilla Norte' }).click();
  await expect(page.getByRole('heading', { name: 'Cuadrilla Norte' })).toHaveCount(0);
});

test('keeps team management available without agenda links', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: 'Equipo', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: /Cliente de navegación/ }).click();
  await expect(page.getByRole('link', { name: 'Gestionar equipo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Asignar equipo', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver hitos', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Gestionar equipo', exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole('heading', { name: 'Equipo', exact: true })).toBeVisible();
});

test('returns from an account-menu page to the tab it was opened from', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveURL(/\/budgets$/);

  const tabs = page.getByRole('navigation', { name: 'Navegación móvil' });
  const budgetsTab = tabs.getByRole('link', { name: 'Presupuestos', exact: true });
  await expect(budgetsTab).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();
  await page
    .getByRole('dialog', { name: 'Menú de cuenta' })
    .getByRole('link', { name: 'Mi empresa', exact: true })
    .click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');
  await page.locator('.back-button').click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(budgetsTab).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();
  await page
    .getByRole('dialog', { name: 'Menú de cuenta' })
    .getByRole('link', { name: 'Mi cuenta', exact: true })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');

  await page.getByRole('button', { name: /Cambiar contraseña/ }).click();
  await expect(page).toHaveURL(/\/account\/password$/);
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/account');
  await page.locator('.back-button').click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');
  await page.locator('.back-button').click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(budgetsTab).toHaveAttribute('aria-current', 'page');
});

test('keeps browser back native while animating the explicit project back button', async ({
  page,
}) => {
  await login(page);
  await page.goto('/projects');
  await page.getByRole('link', { name: /Cliente de navegación/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Proyecto de navegación', exact: true }),
  ).toBeVisible();

  await page.evaluate(() => {
    const pageWindow = window as typeof window & { pageTransitionDirections?: string[] };
    pageWindow.pageTransitionDirections = [];
    const startViewTransition = document.startViewTransition.bind(document);
    document.startViewTransition = (callback) => {
      pageWindow.pageTransitionDirections?.push(
        document.documentElement.dataset.pageTransitionDirection ?? 'missing',
      );
      return startViewTransition(callback);
    };
  });

  await page.goBack();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { pageTransitionDirections?: string[] })
            .pageTransitionDirections,
      ),
    )
    .toEqual([]);
  await expect
    .poll(() => page.locator('html').getAttribute('data-page-transition-direction'))
    .toBeNull();

  await page.getByRole('link', { name: /Cliente de navegación/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Proyecto de navegación', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator('html').getAttribute('data-page-transition-direction'))
    .toBeNull();
  await page.evaluate(() => {
    (window as typeof window & { pageTransitionDirections?: string[] }).pageTransitionDirections =
      [];
  });
  await page.locator('.back-button').click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { pageTransitionDirections?: string[] })
            .pageTransitionDirections,
      ),
    )
    .toEqual(['back']);
});

test('places budgets first in desktop and mobile navigation', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 844 });
  await expect(page.locator('.sidebar nav a').first()).toHaveText('Presupuestos');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' }).locator('a')).toHaveText([
    'Presupuestos',
    'Proyectos',
    'Solicitudes',
  ]);
});

test('new registrations include the budget-core tour and allow replay', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }).click();
  await page.getByLabel('Email', { exact: true }).fill('new-account-tour@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Tour-Prueba-2026');
  await page.getByRole('button', { name: 'Registrarse', exact: true }).click();

  const tour = page.locator('[data-app-tour]');
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(tour).toBeVisible();
  await expect(tour).toHaveAttribute('data-step', '1');
  await expect(tour.getByRole('heading', { name: 'El presupuesto es el centro' })).toBeVisible();
  await expect
    .poll(async () => {
      const target = await page.locator('[data-tour="budget-create"]').boundingBox();
      const spotlight = await page.locator('.app-tour-spotlight').boundingBox();
      return !!target && !!spotlight && Math.abs(target.x - 5 - spotlight.x) < 2;
    })
    .toBe(true);
  await page.screenshot({ path: 'docs/testing-evidence/bg010-welcome-tour-budgets-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tour).toBeVisible();
  await expect
    .poll(async () => {
      const target = await page.locator('[data-tour="budget-create"]').boundingBox();
      const spotlight = await page.locator('.app-tour-spotlight').boundingBox();
      return !!target && !!spotlight && Math.abs(target.x - 5 - spotlight.x) < 2;
    })
    .toBe(true);
  await page.screenshot({ path: 'docs/testing-evidence/bg010-welcome-tour-budgets-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/\/profile\/solicitudes$/);
  await expect(tour).toHaveAttribute('data-step', '2');
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(tour).toHaveAttribute('data-step', '3');
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(tour).toHaveAttribute('data-step', '4');
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(tour).toHaveAttribute('data-step', '5');
  const companyTarget = page.locator('[data-tour="company-profile"]');
  await expect(companyTarget).toBeVisible();
  await expect
    .poll(async () => {
      const target = await companyTarget.boundingBox();
      const spotlight = await page.locator('.app-tour-spotlight').boundingBox();
      return !!target && !!spotlight && Math.abs(target.x - 5 - spotlight.x) < 2;
    })
    .toBe(true);
  await page.screenshot({ path: 'docs/testing-evidence/bg010-welcome-tour-profile.png' });
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(tour).toHaveAttribute('data-step', '6');
  await expect(tour.getByRole('heading', { name: 'Del presupuesto al proyecto' })).toBeVisible();
  await expect
    .poll(async () => {
      const target = await page.locator('[data-page-header]').boundingBox();
      const spotlight = await page.locator('.app-tour-spotlight').boundingBox();
      return !!target && !!spotlight && Math.abs(target.x - 5 - spotlight.x) < 2;
    })
    .toBe(true);
  await page.screenshot({ path: 'docs/testing-evidence/bg010-welcome-tour-projects.png' });
  await tour.getByRole('button', { name: 'Volver a presupuestos' }).click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(tour).toHaveCount(0);

  await page.goto('/help');
  await page.getByRole('button', { name: 'Ver guía interactiva' }).click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(tour).toHaveAttribute('data-step', '1');
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Omitir guía' }).click();
  await expect(tour).toHaveCount(0);
});

test('existing catalog can import the complete renovation base', async ({ page }) => {
  await login(page);
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Importar por categoría' }).click();
  const importer = page.getByRole('dialog', { name: 'Importar por categoría' });
  await importer.getByRole('searchbox', { name: 'Buscar categoría' }).fill('reforma integral');
  await importer.getByRole('button', { name: 'Ver detalle Reforma integral' }).click();
  await expect(
    importer.getByRole('heading', { name: 'Reforma integral', exact: true }),
  ).toBeVisible();
  await expect(importer).toContainText('30 capítulos · 271 partidas');
  await expect(
    importer.getByRole('button', { name: 'Mostrar partidas del capítulo Electricidad' }),
  ).toBeVisible();
  await importer
    .getByRole('button', { name: 'Mostrar partidas del capítulo Electricidad' })
    .click();
  await expect(importer).toContainText('Cableado eléctrico');
  await expect(importer).toContainText('Enchufe simple');
  await expect(importer).toContainText('Punto de luz');

  await importer.getByRole('button', { name: 'Importar categoría Reforma integral' }).click();
  await expect(importer).toBeHidden();
  const familyOptions = await page
    .getByLabel('Filtrar por capítulo')
    .locator('option')
    .allTextContents();
  expect(familyOptions.slice(1).map((label) => label.replace(/\s+\(\d+\)$/, ''))).toEqual([
    'Accesibilidad',
    'Aislamiento',
    'Albañilería',
    'Carpintería',
    'Cerrajería',
    'Cimentación',
    'Climatización',
    'Cocinas',
    'Cubiertas',
    'Demolición',
    'Electricidad',
    'Energía solar',
    'Enlucidos',
    'Estructura',
    'Exteriores',
    'Fachadas',
    'Fontanería',
    'Gas',
    'Jardinería',
    'Limpieza',
    'Mudanzas',
    'Pavimentos',
    'Pintura',
    'Piscinas',
    'Pladur',
    'Revestimientos',
    'Telecomunicaciones',
    'Varios',
    'Ventanas',
    'Vidrio',
  ]);
});

test('an account without a catalog starts with the complete renovation catalog', async ({
  page,
}) => {
  await login(page, 'other@example.test');
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
  const partFilter = page.getByLabel('Filtrar por capítulo');
  await expect(partFilter).toBeVisible();
  const familyOptions = await partFilter.locator('option').allTextContents();
  expect(familyOptions.slice(1).map((label) => label.replace(/\s+\(\d+\)$/, ''))).toEqual([
    'Accesibilidad',
    'Aislamiento',
    'Albañilería',
    'Carpintería',
    'Cerrajería',
    'Cimentación',
    'Climatización',
    'Cocinas',
    'Cubiertas',
    'Demolición',
    'Electricidad',
    'Energía solar',
    'Enlucidos',
    'Estructura',
    'Exteriores',
    'Fachadas',
    'Fontanería',
    'Gas',
    'Jardinería',
    'Limpieza',
    'Mudanzas',
    'Pavimentos',
    'Pintura',
    'Piscinas',
    'Pladur',
    'Revestimientos',
    'Telecomunicaciones',
    'Varios',
    'Ventanas',
    'Vidrio',
  ]);
});

test('catalog imports a category, a part, or one concept from category details', async ({
  page,
}) => {
  await login(page);
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Importar por categoría' }).click();
  const importer = page.getByRole('dialog', { name: 'Importar por categoría' });
  await expect(importer).toBeVisible();
  await expect(importer).toContainText(
    'Estas categorías pueden servirte de inspiración: puedes añadir y personalizar más capítulos y partidas según tu forma de trabajar.',
  );
  await expect(importer).toContainText(
    'Todo lo que importes se añadirá al catálogo de tu empresa para utilizarlo en tus presupuestos.',
  );
  await importer.getByRole('searchbox', { name: 'Buscar categoría' }).fill('electricidad');
  await importer.getByRole('button', { name: 'Ver detalle Reforma integral' }).click();
  await expect(
    importer.getByRole('heading', { name: 'Reforma integral', exact: true }),
  ).toBeVisible();
  await importer
    .getByRole('button', { name: 'Mostrar partidas del capítulo Electricidad' })
    .click();
  await expect(importer).toContainText('Cableado eléctrico');
  await expect(importer).toContainText('Enchufe simple');
  await expect(importer).toContainText('Punto de luz');
  const conceptImport = importer.getByRole('button', {
    name: 'Importar partida Punto de luz',
  });
  await expect(conceptImport).toBeVisible();
  const modalPanel = importer.locator('.modal-panel');
  await expect(modalPanel).toHaveCSS('overflow-y', 'hidden');
  await expect(importer.locator('[data-category-import-scroll]')).toHaveCSS('overflow-y', 'auto');
  await page.screenshot({ path: 'docs/testing-evidence/bg008-category-import-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const categoryScroll = importer.locator('[data-category-import-scroll]');
  await categoryScroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  expect(await categoryScroll.evaluate((element) => element.clientHeight)).toBeGreaterThan(400);
  await page.screenshot({ path: 'docs/testing-evidence/bg008-category-import-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await conceptImport.scrollIntoViewIfNeeded();
  await importer.getByRole('button', { name: 'Importar partida Punto de luz' }).click();
  await expect(importer.getByRole('status')).toContainText('Punto de luz');
  await importer.getByRole('button', { name: 'Importar capítulo Electricidad' }).click();
  await expect(importer.getByRole('status')).toContainText('Electricidad');
  await importer.getByRole('button', { name: 'Volver a categorías' }).click();
  await importer.getByRole('button', { name: 'Importar categoría Reforma integral' }).click();
  await expect(importer).toBeHidden();
  await expect(page.locator('p[role="status"]')).toContainText('Reforma integral');
  expect(
    await page
      .getByRole('textbox', { name: 'Descripción' })
      .evaluateAll(
        (fields) =>
          fields.filter((field) => (field as HTMLInputElement).value === 'Punto de luz').length,
      ),
  ).toBe(1);
});

test('collapsed catalog parts hide add on mobile, desktop expands, and focused selects show outline', async ({
  page,
}) => {
  await login(page);
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Contraer Pintura' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: 'Añadir partida al capítulo Pintura' }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 844 });
  const addConcept = page.getByRole('button', { name: 'Añadir partida al capítulo Pintura' });
  await expect(addConcept).toBeVisible();
  await addConcept.click();
  const unit = page.getByRole('combobox', { name: 'Unidad', exact: true });
  await expect(unit).toBeVisible();
  await unit.focus();
  await expect(unit).toBeFocused();
  expect(await unit.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
});

test('UX quota and missing catalog screens keep the common header and safe return', async ({
  page,
}) => {
  await login(page, 'quota@example.test');
  await page.goto('/budget/new');
  await expect(page.locator('[data-page-header]')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Nuevo presupuesto', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toHaveCount(0);
  await page.goto('/catalogs/missing');
  await expect(page.locator('[data-page-header]')).toBeVisible();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Catálogo');
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');
});

test('budget list filters by year and centers its search icon', async ({ page }) => {
  await login(page);
  await page.goto('/budgets');
  const search = page.getByRole('textbox', { name: 'Buscar presupuestos', exact: true });
  const searchIcon = page.locator('.search-box svg');
  const [searchBounds, iconBounds] = await Promise.all([
    search.boundingBox(),
    searchIcon.boundingBox(),
  ]);
  expect(
    Math.abs(searchBounds!.y + searchBounds!.height / 2 - (iconBounds!.y + iconBounds!.height / 2)),
  ).toBeLessThanOrEqual(1);
  const year = page.getByRole('combobox', { name: 'Filtrar presupuestos por año', exact: true });
  await expect(year.locator('option')).toContainText(['Todos los años', '2026', '2025']);
  await year.selectOption('2025');
  await expect(page.locator('.budget-list-row')).toHaveCount(1);
  await expect(page.locator('.budget-list-row')).toContainText('Una casa con otra luz');
  await search.fill('Reforma de cocina');
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await year.selectOption('');
  await expect(page.locator('.budget-list-row')).toHaveCount(1);
  await expect(page.locator('.budget-list-row')).toContainText('Reforma de cocina');
});

test('draft banner spans the page content and save matches discard width', async ({ page }) => {
  await login(page);
  await editor(page);
  const banner = page.locator('.draft-banner');
  await expect(banner).toBeVisible();
  const [bannerBounds, contentBounds] = await Promise.all([
    banner.boundingBox(),
    page.locator('.budget-document-content').boundingBox(),
  ]);
  expect(Math.abs(bannerBounds!.x - contentBounds!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(bannerBounds!.width - contentBounds!.width)).toBeLessThanOrEqual(1);
  const discard = page.getByRole('button', { name: 'Descartar', exact: true });
  const save = page.getByRole('button', { name: 'Guardar', exact: true });
  const [discardBounds, saveBounds] = await Promise.all([
    discard.boundingBox(),
    save.boundingBox(),
  ]);
  expect(Math.abs(discardBounds!.width - saveBounds!.width)).toBeLessThanOrEqual(1);
});

test('UX editor controls have equal heights and dialogs preserve accessible focus', async ({
  page,
}) => {
  await login(page);
  await page.goto('/budget/demo-cocina');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const quantities = page.getByRole('spinbutton', { name: 'Cant.', exact: true });
    const units = page.getByRole('combobox', { name: 'Ud.', exact: true });
    const prices = page.getByRole('spinbutton', { name: 'Precio', exact: true });
    const sizes = await Promise.all(
      [quantities, units, prices].map((field) =>
        field.evaluate((element) => element.getBoundingClientRect().height),
      ),
    );
    expect(sizes).toEqual([44, 44, 44]);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/templates');
  await expect(page.getByRole('button', { name: 'Crear plantilla', exact: true })).toBeVisible();
  await expect(page.locator('.workspace-header')).toBeVisible();
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');
  await page.goto('/budgets');
  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Menú de cuenta', exact: true });
  expect(await dialog.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
  for (let index = 0; index < 8; index++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menú de cuenta' })).toBeFocused();
});

test('explains project acceptance, supplements, and progress history in help', async ({ page }) => {
  await login(page);
  await page.goto('/help');
  await page
    .getByRole('navigation', { name: 'Temas de ayuda' })
    .getByRole('link', { name: 'Proyectos y seguimiento', exact: true })
    .click();
  await expect(page).toHaveURL(/\/help#proyectos$/);

  const acceptanceQuestion = page
    .locator('details')
    .filter({ hasText: '¿Cómo convierto un presupuesto aceptado en proyecto?' });
  await acceptanceQuestion.locator('summary').click();
  await expect(acceptanceQuestion).toContainText('Convertir en proyecto');
  await acceptanceQuestion.getByRole('link', { name: 'Ver presupuestos para aceptar' }).click();
  await expect(page).toHaveURL(/\/budgets$/);

  await page.goto('/help#proyectos');
  const supplementQuestion = page
    .locator('details')
    .filter({ hasText: '¿Cómo registro un imprevisto y actualizo el total del proyecto?' });
  await supplementQuestion.locator('summary').click();
  await expect(supplementQuestion).toContainText('total actualizado');
  await expect(supplementQuestion).toContainText('anúlala indicando un motivo');
  await supplementQuestion.getByRole('link', { name: 'Abrir proyectos y ampliaciones' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();

  await page.goto('/help#proyectos');
  const progressQuestion = page
    .locator('details')
    .filter({ hasText: '¿Puedo corregir la fecha de un trabajo o ver cómo ha avanzado?' });
  await progressQuestion.locator('summary').click();
  await expect(progressQuestion).toContainText('avance acumulado por fecha');
  await expect(progressQuestion).toContainText('no cambia el avance actual');
});

test('UX help has real links and contextual information supports keyboard and Escape', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Ayuda', exact: true }).click();
  await expect(page).toHaveURL(/help$/);
  await expect(page.getByRole('heading', { name: 'Ayuda y guía', exact: true })).toBeVisible();
  await page.getByText('¿Cómo preparo mi primer presupuesto?', { exact: true }).click();
  await page.getByRole('link', { name: 'Abrir presupuestos', exact: true }).click();
  await expect(page).toHaveURL(/budgets$/);
  await page.goto('/catalogs');
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toHaveCount(0);
  await expect(page.locator('.workspace-header')).toBeHidden();
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');
});

test('UX company avatar contains a wide logo and falls back when the image fails', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const logo = page.locator('.company-avatar img');
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((image) => getComputedStyle(image).objectFit)).toBe('contain');
  await expect
    .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBe(120);
  await logo.dispatchEvent('error');
  await expect(logo).toHaveCount(0);
  await expect(page.locator('.company-avatar')).toHaveText('E');
});

test('UX rounded budget cards keep deletion behind menu and confirmation', async ({ page }) => {
  await login(page);
  const row = page.locator('[data-swipe-row]').first();
  expect(await row.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('14px');
  await row.getByRole('button', { name: /^Acciones de/ }).click();
  await row.getByRole('button', { name: 'Eliminar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(row).toBeVisible();
});

test('UX native Chromium touch scrolls vertically and reveals without navigating or deleting', async ({
  page,
  context,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto('/budgets');
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const row = page.locator('.budget-list [data-swipe-row]').first();
  await expect(row).toBeVisible();
  const gesture = async (dx: number, dy: number) => {
    const bounds = (await row.boundingBox())!;
    const x = bounds.x + bounds.width * 0.7,
      y = bounds.y + bounds.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let index = 1; index <= 6; index++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + (dx * index) / 6, y: y + (dy * index) / 6 }],
      });
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await gesture(3, -90);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(row.locator('[data-swipe-action]')).toHaveCount(0);
  await row.scrollIntoViewIfNeeded();
  await gesture(-110, 0);
  await expect(row.locator('[data-swipe-action]')).toHaveCount(0);
  await row.getByRole('button', { name: /^Acciones de/ }).click();
  await expect(row.getByRole('button', { name: 'Eliminar', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/budgets$/);
  await expect(page.getByRole('dialog', { name: '¿Borrar presupuesto?' })).toHaveCount(0);
  await row.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page
    .getByRole('dialog', { name: '¿Borrar presupuesto?' })
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await row.getByRole('link').click();
  await expect(page).toHaveURL(/budget\/demo-cocina$/);
  await session.detach();
});

test('UX visual matrix keeps headings, content and floating tabs usable across viewports', async ({
  page,
}) => {
  await login(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [suffix, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const [name, path] of [
      ['budgets', '/budgets'],
      ['templates', '/templates'],
      ['catalog-detail', '/catalogs/catalog-main'],
      ['help', '/help'],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('[data-page-header]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (path === '/budgets') {
        await expect(page.locator('.overview-card:visible')).toHaveCount(
          suffix === 'desktop' ? 3 : 1,
        );
        if (suffix === 'mobile') {
          const featuredCardBounds = await page.locator('.overview-card.featured').boundingBox();
          expect(featuredCardBounds).not.toBeNull();
          expect(featuredCardBounds!.height).toBeLessThan(124);
        }
      }
      await page.screenshot({
        path: `docs/testing-evidence/bg007-${name}-${suffix}.png`,
        fullPage: true,
      });
    }
  }
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/budget/demo-cocina');
    await expect(page.locator('[data-page-header]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toHaveCount(0);
    await page.goto('/budgets');
    await expect(page.locator('.overview-card:visible')).toHaveCount(1);
    const featuredCardBounds = await page.locator('.overview-card.featured').boundingBox();
    expect(featuredCardBounds).not.toBeNull();
    expect(featuredCardBounds!.height).toBeLessThan(124);
    const bounds = await page.getByRole('navigation', { name: 'Navegación móvil' }).boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  }
});

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
  await expect(page.locator('[data-app-tour]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Reforma de cocina/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menú de cuenta' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mi cuenta', exact: true })).toHaveCount(1);
  await expect(page.getByText('Al día', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();
  const desktopMenu = page.getByRole('dialog', { name: 'Menú de cuenta', exact: true });
  await expect(desktopMenu).toBeVisible();
  await desktopMenu.locator('.modal-panel').screenshot({
    path: 'docs/testing-evidence/bg009-account-menu-panel-1440.png',
  });
  await page.keyboard.press('Escape');
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
  const dialog = page.getByRole('dialog', { name: 'Menú de cuenta', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.locator('.modal-panel').screenshot({
    path: 'docs/testing-evidence/bg009-account-menu-panel-390.png',
  });
  await expect(dialog.getByRole('link', { name: 'Mi empresa', exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Plantillas de presupuestos', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Estimador público', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Ayuda', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Mi cuenta', exact: true })).toBeVisible();
  const menuBlocks = dialog.locator('.account-menu-section');
  await expect(menuBlocks).toHaveCount(3);
  await expect(menuBlocks.nth(0)).toContainText('Panel de administración');
  await expect(menuBlocks.nth(1)).toContainText('Mi empresa');
  await expect(menuBlocks.nth(1)).toContainText('Plantillas de presupuestos');
  await expect(menuBlocks.nth(1)).toContainText('Estimador público');
  await expect(menuBlocks.nth(2)).toContainText('Mi cuenta');
  await expect(menuBlocks.nth(2)).toContainText('Ayuda');
  await expect(menuBlocks.nth(2)).toContainText('Cerrar sesión');
  for (let i = 0; i < 7; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(accountMenu).toBeFocused();
  const tabs = page.getByRole('navigation', { name: 'Navegación móvil' });
  for (const [name, path] of [
    ['Solicitudes', '/profile/solicitudes'],
    ['Presupuestos', '/budgets'],
  ]) {
    await page.setViewportSize({ width: 390, height: 500 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const link = tabs.getByRole('link', { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-page-header]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  }
  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();
  await page
    .getByRole('dialog', { name: 'Menú de cuenta' })
    .getByRole('link', { name: 'Catálogo', exact: true })
    .click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(tabs).toHaveCount(0);
  await expect(page.locator('.workspace-header')).toBeHidden();
  await expect(page.locator('.back-button')).toHaveAttribute('href', '/budgets');
  await page.locator('.back-button').click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(tabs).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();
  await page
    .getByRole('dialog', { name: 'Menú de cuenta' })
    .getByRole('link', { name: 'Plantillas de presupuestos', exact: true })
    .click();
  await expect(page).toHaveURL(/\/templates$/);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(tabs).toHaveCount(0);
  await page.locator('.back-button').click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(tabs).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Crear presupuesto', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar en blanco', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/new$/);
  await expect(tabs).toHaveCount(0);
  await page.locator('.back-button').click();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('regular accounts see the account menu without the admin block', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('other@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Presupuestos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click();

  const dialog = page.getByRole('dialog', { name: 'Menú de cuenta', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.account-menu-section')).toHaveCount(2);
  await expect(
    dialog.getByRole('link', { name: 'Panel de administración', exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Mi empresa', exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Plantillas de presupuestos', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Estimador público', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Mi cuenta', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Ayuda', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Añadir capítulo', exact: true }).click();
  await page.getByRole('button', { name: /^Pintura · \d+ partidas$/ }).click();
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
  await page.getByRole('button', { name: 'Añadir capítulo', exact: true }).click();
  await page.getByRole('button', { name: /^Pintura · \d+ partidas$/ }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Acabado de demostración');
  await page.getByRole('spinbutton', { name: 'Cant.', exact: true }).fill('2.5');
  await page.getByRole('spinbutton', { name: 'Precio', exact: true }).fill('10.75');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
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
test('single catalog redirects old routes, saves edits and isolates accounts', async ({ page }) => {
  await login(page);
  for (const path of ['/catalogs', '/catalogs/catalog-paint', '/catalogs/missing']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Crear catálogo|predeterminado|Borrar catálogo/ }),
    ).toHaveCount(0);
  }
  await page.getByLabel('Descripción', { exact: true }).fill('Tarifa revisada');
  await page.getByRole('spinbutton', { name: 'Coste', exact: true }).fill('6.75');
  await expect(page.getByText('Guardando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue('Tarifa revisada');
  await page.screenshot({
    path: 'docs/testing-evidence/bg008-catalog-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/testing-evidence/bg008-catalog-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Descripción', { exact: true }).fill('Pintura interior (dos manos)');
  await expect(page.getByText('Guardando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Pintura interior (dos manos)',
  );
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await login(page, 'other@example.test');
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Buscar capítulos y partidas', exact: true })
    .fill('Tarifa revisada');
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveCount(0);
});

test('single catalog initializes automatically and search is accent insensitive and alphabetic', async ({
  page,
}) => {
  await login(page, 'other@example.test');
  await page.goto('/catalog');
  const search = page.getByRole('textbox', { name: 'Buscar capítulos y partidas', exact: true });
  await search.fill('FONTANERIA');
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveCount(15);
  const descriptions = await page
    .getByLabel('Descripción', { exact: true })
    .evaluateAll((inputs) => inputs.map((el) => (el as HTMLInputElement).value));
  expect(descriptions.length).toBeGreaterThan(1);
  expect(descriptions).toEqual(
    [...descriptions].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }),
    ),
  );
  await page
    .getByRole('button', { name: 'Añadir partida al capítulo Fontanería', exact: true })
    .click();
  const conceptForm = page.locator('form').filter({
    has: page.getByLabel('Descripción de la partida', { exact: true }),
  });
  await conceptForm
    .getByLabel('Descripción de la partida', { exact: true })
    .fill('Partida de prueba');
  await conceptForm.getByLabel('Coste', { exact: true }).fill('5.25');
  await conceptForm.getByLabel('Precio', { exact: true }).fill('12.75');
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  await search.fill('Partida de prueba');
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Descripción de la partida', { exact: true })).toHaveValue(
    'Partida de prueba',
  );
  await expect(page.getByText('Guardando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await search.fill('Partida de prueba');
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Descripción de la partida', { exact: true })).toHaveValue(
    'Partida de prueba',
  );
});

test('catalog picker searches across chapters and preserves existing measurements', async ({
  page,
}) => {
  await login(page);
  await page.goto('/budget/demo-cocina');
  await expect(page.getByText('Catálogo para este presupuesto', { exact: true })).toHaveCount(0);
  const trigger = page.getByRole('button', { name: 'Aplicar tarifa del catálogo', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Buscar en el catálogo', exact: true });
  const searchInput = dialog.getByLabel('Buscar partidas del capítulo');
  await searchInput.evaluate((element: HTMLInputElement) => element.focus());
  await expect(searchInput).toBeFocused();
  const searchWrapper = dialog.locator('.catalog-search');
  expect(await searchWrapper.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
    'none',
  );
  await searchInput.press('Tab');
  expect(
    await page.evaluate(() =>
      document.activeElement instanceof HTMLElement
        ? getComputedStyle(document.activeElement).outlineStyle
        : 'none',
    ),
  ).toBe('solid');
  await searchInput.fill('PINTURA');
  await expect(dialog.locator('.catalog-picker-result')).toHaveCount(1);
  await dialog.locator('.catalog-picker-result').click();
  await expect(page.getByRole('spinbutton', { name: 'Cant.', exact: true })).toHaveValue('10.5');
  await expect(page.getByRole('spinbutton', { name: 'Precio', exact: true })).toHaveValue('12.75');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel('Buscar partidas del capítulo').fill('inexistente');
  await expect(dialog.getByText(/No hay coincidencias/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('guided structure supports back, cancellation, review, incomplete measurement and saving once', async ({
  page,
}) => {
  await login(page, 'other@example.test');
  await editor(page);
  const trigger = page.getByRole('button', { name: 'Crear paso a paso', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Crear presupuesto paso a paso', exact: true });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: 'docs/testing-evidence/bg008-structure-start-desktop.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/testing-evidence/bg008-structure-start-mobile.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole('checkbox', { name: /^Fontanería/ }).check();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  const conceptSearch = dialog.getByLabel('Buscar partidas');
  await conceptSearch.fill('Tubería de agua fría y caliente');
  await dialog.getByRole('checkbox', { name: /Tubería de agua fría y caliente/ }).check();
  await dialog.getByRole('button', { name: 'Atrás', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: /^Fontanería/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(
    dialog.getByRole('checkbox', { name: /Tubería de agua fría y caliente/ }),
  ).toBeChecked();
  await page.setViewportSize({ width: 320, height: 740 });
  await conceptSearch.fill('Tubería de agua fría y caliente');
  await dialog.getByRole('checkbox', { name: /Tubería de agua fría y caliente/ }).uncheck();
  await expect(dialog.getByRole('status').last()).toHaveText('0 partidas seleccionadas');
  await dialog.getByRole('checkbox', { name: /Tubería de agua fría y caliente/ }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Cant.', exact: true })).toHaveCount(0);
  await trigger.click();
  await dialog.getByRole('checkbox', { name: /^Fontanería/ }).check();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog.getByRole('checkbox', { name: /Tubería de agua fría y caliente/ }).check();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.screenshot({
    path: 'docs/testing-evidence/bg008-structure-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'docs/testing-evidence/bg008-structure-mobile.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Crear estructura', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Tubería de agua fría y caliente',
  );
  await expect(page.getByRole('spinbutton', { name: 'Cant.', exact: true })).toHaveValue('');
  await page.getByLabel('Nombre del cliente', { exact: true }).fill('Asistente guiado');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/[0-9a-f-]+$/);
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Completa o elimina');
  await page.getByRole('spinbutton', { name: 'Cant.', exact: true }).fill('8');
  await expect(page.getByText('Guardando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Cant.', exact: true })).toHaveValue('8');
  await expect(page.getByRole('spinbutton', { name: 'Precio', exact: true })).toHaveValue('');
  await page.goto('/budget/new');
  await trigger.click();
  await dialog.getByRole('checkbox', { name: /^Fontanería/ }).check();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByRole('status').first()).toHaveText('Paso 2 de 3 · Fontanería');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('guided structure has one concept step per selected part and accepts optional quantities', async ({
  page,
}) => {
  await login(page, 'other@example.test');
  await editor(page);
  await page.getByRole('button', { name: 'Crear paso a paso', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear presupuesto paso a paso', exact: true });
  await dialog.getByRole('checkbox', { name: /^Fontanería/ }).check();
  await dialog.getByRole('checkbox', { name: /^Demolición/ }).check();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByRole('status').first()).toHaveText('Paso 2 de 4 · Fontanería');
  await expect(dialog.getByText('Más utilizadas', { exact: false })).toHaveCount(0);
  const plumbingConcept = dialog.getByRole('checkbox', {
    name: /Tubería de agua fría y caliente/,
  });
  await plumbingConcept.check();
  await dialog
    .getByRole('spinbutton', {
      name: 'Cantidad para Tubería de agua fría y caliente',
    })
    .fill('4.5');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByRole('status').first()).toHaveText('Paso 3 de 4 · Demolición');
  const demolitionConcept = dialog.getByRole('checkbox', {
    name: /Carga y retirada de escombros/,
  });
  await demolitionConcept.check();
  await expect(
    dialog.getByRole('spinbutton', { name: 'Cantidad para Carga y retirada de escombros' }),
  ).toHaveValue('');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByRole('status').first()).toHaveText('Paso 4 de 4 · Revisión');
  await expect(dialog.getByText('4,5 ML', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Atrás', exact: true }).click();
  await expect(demolitionConcept).toBeChecked();
  await expect(
    dialog.getByRole('spinbutton', { name: 'Cantidad para Carga y retirada de escombros' }),
  ).toHaveValue('');
  await dialog.getByRole('button', { name: 'Atrás', exact: true }).click();
  await expect(plumbingConcept).toBeChecked();
  await expect(
    dialog.getByRole('spinbutton', {
      name: 'Cantidad para Tubería de agua fría y caliente',
    }),
  ).toHaveValue('4.5');
});

test('saving a template stays within 320px and keeps the budget IVA', async ({ page }) => {
  await login(page);
  await page.goto('/budget/demo-estudio');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Guardar como plantilla', exact: true }).click();
  await page
    .getByLabel('Nombre de la plantilla', { exact: true })
    .fill('Plantilla de prueba con un nombre muy largo para comprobar el formulario');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'docs/testing-evidence/bg008-save-template-mobile.png',
    fullPage: true,
  });
  await page.getByLabel('Nombre de la plantilla', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Plantilla guardada', exact: true })).toBeVisible();
});

test('catalog editor manages partidas inside a chapter', async ({ page }) => {
  await login(page);
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Contraer todo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expandir todo', exact: true })).toBeVisible();
  await expect(page.getByLabel('Descripción de la partida')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expandir todo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Contraer Pintura', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(page.getByRole('textbox', { name: 'Nombre del capítulo' }).first()).toHaveValue(
    'Pintura',
  );
  await expect(page.getByLabel('Descripción de la partida').first()).toHaveValue(
    'Pintura interior (dos manos)',
  );

  await page.getByRole('button', { name: 'Añadir capítulo', exact: true }).click();
  await page.getByPlaceholder('Ej. Fontanería').fill('Recogida de residuos');
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  const addConcept = page.getByRole('button', {
    name: 'Añadir partida al capítulo Recogida de residuos',
    exact: true,
  });
  await addConcept.click();
  const conceptForm = page.locator('form').filter({
    has: page.getByLabel('Descripción de la partida', { exact: true }),
  });
  await conceptForm
    .getByLabel('Descripción de la partida', { exact: true })
    .fill('Retirada de residuos');
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.getByLabel('Descripción de la partida').last()).toHaveValue(
    'Retirada de residuos',
  );

  await page.getByRole('button', { name: 'Eliminar capítulo Recogida de residuos' }).click();
  await page.getByRole('button', { name: 'Eliminar capítulo', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Añadir partida al capítulo Recogida de residuos' }),
  ).toHaveCount(0);
});

test('new budget selects a catalog chapter and searches its partidas', async ({ page }) => {
  await login(page, 'other@example.test');
  await page.goto('/budget/new');
  await page.getByRole('button', { name: 'Añadir capítulo', exact: true }).click();
  await page.getByRole('button', { name: /Fontanería · \d+ partidas/ }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del capítulo' })).toHaveValue(
    'Fontanería',
  );

  const pickerTrigger = page.getByRole('button', {
    name: 'Aplicar tarifa del catálogo',
    exact: true,
  });
  await pickerTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Buscar en el catálogo', exact: true });
  const search = dialog.getByLabel('Buscar partidas del capítulo', { exact: true });
  await search.fill('Pintura interior');
  await expect(dialog.getByText(/No hay coincidencias en este capítulo/)).toBeVisible();
  await search.fill('Punto de agua');
  await expect(dialog.locator('.catalog-picker-result')).toHaveCount(1);
  await dialog.locator('.catalog-picker-result').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue('Punto de agua');
  await page.getByLabel('Nombre del cliente', { exact: true }).fill('Presupuesto de fontanería');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/[0-9a-f-]+$/);
  await page.reload();
  await page.getByRole('button', { name: 'Aplicar tarifa del catálogo', exact: true }).click();
  await page.getByLabel('Buscar partidas del capítulo', { exact: true }).fill('Pintura interior');
  await expect(page.getByText(/No hay coincidencias en este capítulo/)).toBeVisible();
});

test('PWA install banner consumes prompts, stays hidden after dismissal and in standalone', async ({
  page,
}) => {
  await login(page);
  const banner = page.getByRole('complementary', { name: 'Instalar BudGenerator', exact: true });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Cómo instalar', exact: true }).click();
  await expect(banner.getByText(/Abre el menú/)).toBeVisible();
  await page.evaluate(() => {
    Object.assign(window, { installCalls: 0 });
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {
          (window as Window & { installCalls: number }).installCalls++;
        },
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      }),
    );
  });
  await banner.getByRole('button', { name: 'Instalar app', exact: true }).click();
  await expect(banner.getByRole('button', { name: 'Cómo instalar', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { installCalls: number }).installCalls),
  ).toBe(1);
  await banner.getByRole('button', { name: 'Ocultar aviso de instalación', exact: true }).click();
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem('budgenerator:install-dismissed'));
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      query === '(display-mode: standalone)'
        ? Object.defineProperty(original(query), 'matches', { value: true })
        : original(query);
  });
  await page.reload();
  await expect(banner).toHaveCount(0);
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

test('budget acceptance and supplements keep a distinct, traceable project summary', async ({
  page,
}) => {
  await login(page);

  await page.goto('/budget/demo-estudio');
  await page.getByRole('button', { name: 'Marcar como aceptado', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '¿Marcar como aceptado?', exact: true });
  await dialog.getByRole('button', { name: 'Marcar como aceptado', exact: true }).click();
  await expect(page.getByLabel('Nombre del cliente', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retirar aceptación', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '¿Retirar la aceptación?', exact: true });
  await dialog.getByRole('button', { name: 'Retirar aceptación', exact: true }).click();
  await expect(page.getByLabel('Nombre del cliente', { exact: true })).toBeEnabled();

  await page.goto('/budget/demo-cocina');
  await page.getByRole('button', { name: 'Marcar como aceptado', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '¿Marcar como aceptado?', exact: true });
  await dialog.getByRole('button', { name: 'Marcar como aceptado', exact: true }).click();
  await page.getByRole('button', { name: 'Convertir en proyecto', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '¿Convertir en proyecto?', exact: true });
  await dialog.getByRole('button', { name: 'Convertir en proyecto', exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/.+$/);
  await expect(page.getByRole('status', { name: 'Estado: Pendiente' })).toBeVisible();
  await expect(page.locator('[data-project-summary]')).toBeVisible();
  await expect(page.locator('[data-project-work-items]')).toBeVisible();
  expect(
    await page.locator('[data-project-summary]').evaluate((summary) => {
      const workItems = document.querySelector('[data-project-work-items]');
      return (
        workItems &&
        getComputedStyle(summary).backgroundColor !== getComputedStyle(workItems).backgroundColor
      );
    }),
  ).toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Vivienda en Chamberí · Madrid', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Avance del proyecto: 0%')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Ver progreso', exact: true }).click();
  await expect(page.getByText('Aún no hay partidas terminadas', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar evolución', exact: true }).click();
  const finishTask = page.getByRole('button', {
    name: 'Marcar como terminado: Preparación y acabado de paredes',
  });
  await finishTask.focus();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Avance del proyecto: 100%')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(page.getByRole('status', { name: 'Estado: Completado' })).toBeVisible();
  await page.waitForTimeout(250);
  await expect(page.getByText('Completado', { exact: false }).first()).toBeVisible();
  const taskCompletionDate = page.getByLabel(
    'Cambiar fecha de finalización: la partida Preparación y acabado de paredes',
  );
  const today = await taskCompletionDate.inputValue();
  const todayLabel = await page.evaluate(
    (date) =>
      new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    today,
  );
  await page.getByRole('button', { name: 'Ver progreso', exact: true }).click();
  const historyTable = page.getByRole('table', { name: 'Detalle diario del avance acumulado' });
  await expect(
    page.getByRole('img', { name: /Avance acumulado del proyecto por fecha/ }),
  ).toBeVisible();
  await expect(historyTable.getByRole('row')).toHaveCount(2);
  await expect(historyTable.getByRole('row').nth(1)).toContainText(todayLabel);
  await page.getByRole('button', { name: 'Cerrar evolución', exact: true }).click();

  await taskCompletionDate.fill('2020-05-04');
  await expect(taskCompletionDate).toHaveValue('2020-05-04');
  await expect(page.getByLabel('Avance del proyecto: 100%')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(page.getByRole('status', { name: 'Estado: Completado' })).toBeVisible();

  const workItemCompletionDate = page.getByLabel(
    'Cambiar fecha de finalización: el capítulo Pintura',
  );
  await workItemCompletionDate.fill('2020-05-05');
  await expect(workItemCompletionDate).toHaveValue('2020-05-05');
  await expect(taskCompletionDate).toHaveValue('2020-05-05');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/testing-evidence/bg009-project-detail-390.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Ver progreso', exact: true }).click();
  const historyDialog = page.getByRole('dialog', { name: 'Evolución del proyecto', exact: true });
  const panelBounds = await historyDialog.locator('.modal-panel').evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right };
  });
  expect(panelBounds.left).toBeGreaterThanOrEqual(0);
  expect(panelBounds.right).toBeLessThanOrEqual(390);
  await expect(historyTable.getByRole('row').nth(1)).toContainText('5 de mayo de 2020');
  await expect(historyTable.getByRole('row').nth(1)).toContainText('100%');
  await page.screenshot({
    path: 'docs/testing-evidence/bg009-project-history-390.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Cerrar evolución', exact: true }).click();

  const reopenTask = page.getByRole('button', {
    name: 'Reabrir: Preparación y acabado de paredes',
  });
  await reopenTask.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Avance del proyecto: 0%')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Completar capítulo', exact: true }).click();
  await expect(page.getByLabel('Avance del proyecto: 100%')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await page.waitForTimeout(250);

  await page
    .locator('details')
    .filter({ has: page.getByRole('heading', { name: 'Ampliaciones', exact: true }) })
    .locator('summary')
    .click();
  await page.getByRole('button', { name: 'Nueva ampliación', exact: true }).click();
  await page.getByLabel('Partida imprevista').fill('Punto de luz adicional');
  await page.getByLabel('Cantidad').fill('2');
  await page.getByLabel('Precio unitario sin IVA').fill('20');
  await page.getByRole('button', { name: 'Guardar ampliación', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Estado: En curso' })).toBeVisible();
  const updatedTotal = page
    .locator('[data-project-summary] dl div')
    .filter({ hasText: 'Total actualizado' })
    .locator('dd')
    .first();
  await expect(updatedTotal).toContainText('5384,50');
  await page.getByRole('button', { name: 'Anular ampliación', exact: true }).click();
  await page.getByLabel('Motivo de anulación').fill('El cliente cambió el alcance.');
  await page.getByRole('button', { name: 'Confirmar anulación', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Estado: Completado' })).toBeVisible();
  await expect(page.getByText('Anulado el', { exact: false })).toContainText(
    'El cliente cambió el alcance.',
  );
  await expect(updatedTotal).toContainText('5336,10');

  const projectId = page.url().split('/').at(-1);
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole('heading', { name: 'Vivienda en Chamberí · Madrid' }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    await page.screenshot({
      path: `docs/testing-evidence/bg009-project-detail-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto('/projects');
  await expect(page.getByRole('status', { name: 'Estado: Completado' })).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    await page.screenshot({
      path: `docs/testing-evidence/bg009-projects-list-${width}.png`,
      fullPage: true,
    });
  }

  await page.goto('/budget/demo-cocina');
  await expect(page.getByLabel('Nombre del cliente', { exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Abrir proyecto', exact: false })).toHaveAttribute(
    'href',
    `/projects/${projectId}`,
  );
  await page.getByRole('button', { name: 'Crear copia para editar', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/new$/);
  const clientName = page.getByLabel('Nombre del cliente', { exact: true });
  await expect(clientName).toHaveValue('Reforma de cocina');
  await clientName.fill('Copia editable de cocina');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/budget\/[0-9a-f-]+$/);
  await expect(page.getByLabel('Nombre del cliente', { exact: true })).toHaveValue(
    'Copia editable de cocina',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('project load errors are distinct from missing projects and can be retried', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/missing');
  await expect(
    page.getByRole('heading', { name: 'Proyecto no disponible', exact: true }),
  ).toBeVisible();

  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.history.pushState({}, '', '/projects/offline-unloaded');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/projects\/offline-unloaded$/);
  await expect(
    page.getByRole('heading', { name: 'Contenido no disponible sin conexión', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Esta pantalla aún no tiene datos cargados en esta sesión/),
  ).toBeVisible();
  await expect(page.getByRole('status', { name: /Cargando proyecto/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Contenido no disponible sin conexión', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status', { name: 'Cargando contenido' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: /Cargando proyecto/ })).toHaveCount(0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.screenshot({
    path: 'docs/testing-evidence/bg009-project-detail-error-390.png',
    fullPage: true,
  });

  await page.context().setOffline(false);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Proyecto no disponible', exact: true }),
  ).toBeVisible();
});

test('keeps cached views visible offline and toasts when a roster edit cannot be saved', async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto('/team/manage');
  await expect(page.getByRole('heading', { name: 'Gestionar equipo', exact: true })).toBeVisible();
  await page.goto('/projects/project-navigation');
  await expect(
    page.getByRole('heading', { name: 'Proyecto de navegación', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Equipo', exact: true })
    .click();
  await expect(page.getByTestId('day-project-project-navigation').first()).toBeVisible();
  await page.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();

  await context.setOffline(true);
  await page
    .getByRole('link', { name: /Proyecto de navegación/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Proyecto de navegación', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status', { name: /Cargando proyecto/ })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Proyecto de navegación', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status', { name: 'Cargando contenido' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: /Cargando proyecto/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Proyectos', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Proyecto de navegación/ }).first()).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Equipo', exact: true })
    .click();
  const loadedWeekRange = await page.getByTestId('week-range').textContent();
  await expect(page.getByTestId('day-project-project-navigation').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled();
  await expect(page.getByTestId('week-range')).toHaveText(loadedWeekRange!);
  await expect(page.getByRole('status', { name: /Cargando planificación semanal/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Gestionar miembros y cuadrillas' }).click();
  await page.getByRole('button', { name: 'Editar a Ana Demo' }).click();
  const memberDialog = page.getByRole('dialog', { name: 'Editar persona' });
  await memberDialog.getByLabel('Nombre', { exact: true }).fill('Ana Demo sin conexión');
  await memberDialog.getByRole('button', { name: 'Guardar persona' }).click();
  await expect(page.getByTestId('offline-mutation-toast')).toHaveText(
    /Sin conexión\. No se ha podido guardar el cambio\./,
  );
  await expect(page.getByTestId('offline-mutation-toast')).toBeVisible();
  await memberDialog.getByRole('button', { name: 'Cancelar' }).click();

  const emulator = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
  await emulator.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', primaryUid, 'teamMembers', 'member-demo-ana'), {
      id: 'member-demo-ana',
      name: 'Ana Demo actualizada',
      status: 'active',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-11-07T10:00:00.000Z',
    });
  });
  await emulator.cleanup();

  await context.setOffline(false);
  await expect(
    page.getByRole('button', { name: 'Editar a Ana Demo actualizada', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status', { name: 'Cargando contenido' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await expect(page.getByText('Cliente de navegación', { exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: /Cargando proyectos/ })).toHaveCount(0);
  await expect(page.getByText('Ana Demo sin conexión', { exact: true })).toHaveCount(0);
});

test('plans project teams by week and saves person changes only for the selected day', async ({
  page,
}) => {
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
  const db = env.authenticatedContext(primaryUid).firestore();
  const todayKey = await page.evaluate(() => {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  });
  const tomorrowKey = await page.evaluate((today) => {
    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(year!, month! - 1, day! + 1);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }, todayKey);
  const currentWeekDateKeys = await page.evaluate(() => {
    const current = new Date();
    const monday = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 12);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
    });
  });
  const estimatedEndDateKey = currentWeekDateKeys[3]!;
  const afterEstimatedEndDateKey = currentWeekDateKeys[4]!;
  const nextYearEstimatedEndDateKey = `2027${estimatedEndDateKey.slice(4)}`;

  await env.withSecurityRulesDisabled(async (context) => {
    const seedDb = context.firestore();
    await setDoc(doc(seedDb, 'users', primaryUid, 'teamMembers', 'member-demo-luis'), {
      id: 'member-demo-luis',
      name: 'Luis Demo',
      status: 'active',
    });
    await setDoc(doc(seedDb, 'users', primaryUid, 'teamMembers', 'member-demo-eva'), {
      id: 'member-demo-eva',
      name: 'Eva Demo',
      status: 'active',
    });
    await setDoc(doc(seedDb, 'users', primaryUid, 'crews', 'crew-demo-norte'), {
      id: 'crew-demo-norte',
      label: 'Cuadrilla Norte',
      color: 'blue',
      memberIds: ['member-demo-ana', 'member-demo-luis'],
      status: 'active',
    });
    await setDoc(
      doc(
        seedDb,
        'users',
        primaryUid,
        'projects',
        'project-navigation',
        'assignments',
        'crew_crew-demo-norte',
      ),
      {
        id: 'crew_crew-demo-norte',
        resourceType: 'crew',
        resourceId: 'crew-demo-norte',
        label: 'Cuadrilla Norte',
        color: 'blue',
        members: [
          { id: 'member-demo-ana', name: 'Ana Demo' },
          { id: 'member-demo-luis', name: 'Luis Demo' },
        ],
        assignedAt: '2026-11-01T10:00:00.000Z',
      },
    );
    await setDoc(
      doc(
        seedDb,
        'users',
        primaryUid,
        'projects',
        'project-navigation',
        'dailyAssignments',
        afterEstimatedEndDateKey,
      ),
      {
        date: afterEstimatedEndDateKey,
        projectId: 'project-navigation',
        assignments: [
          {
            id: 'crew_crew-demo-norte',
            resourceType: 'crew',
            resourceId: 'crew-demo-norte',
            label: 'Cuadrilla Norte',
            color: 'blue',
            members: [
              { id: 'member-demo-ana', name: 'Ana Demo' },
              { id: 'member-demo-luis', name: 'Luis Demo' },
            ],
            assignedAt: '2026-11-01T10:00:00.000Z',
          },
        ],
        updatedAt: '2026-11-01T10:00:00.000Z',
      },
    );
    await setDoc(doc(seedDb, 'users', primaryUid, 'projects', 'project-weekly-support'), {
      id: 'project-weekly-support',
      title: 'Proyecto de apoyo',
      status: 'pending',
      createdAt: '2026-11-01T10:00:00.000Z',
    });
    await setDoc(
      doc(
        seedDb,
        'users',
        primaryUid,
        'projects',
        'project-weekly-support',
        'assignments',
        'member_member-demo-ana',
      ),
      {
        id: 'member_member-demo-ana',
        resourceType: 'member',
        resourceId: 'member-demo-ana',
        label: 'Ana Demo',
        members: [{ id: 'member-demo-ana', name: 'Ana Demo' }],
        assignedAt: '2026-11-01T10:00:00.000Z',
      },
    );
  });

  try {
    await login(page);
    await page.goto('/team');
    await page.setViewportSize({ width: 1440, height: 1000 });
    const compactWeekSelector = page.getByTestId('week-selector');
    await expect(compactWeekSelector.locator('[data-day-key]')).toHaveCount(7);
    const weekSelectorBounds = await compactWeekSelector.boundingBox();
    const resourceFilterBounds = await page.getByTestId('weekly-resource-filter').boundingBox();
    expect(weekSelectorBounds).not.toBeNull();
    expect(resourceFilterBounds).not.toBeNull();
    expect(resourceFilterBounds!.y).toBeLessThan(weekSelectorBounds!.y);
    const previousWeekButton = page.getByRole('button', { name: 'Semana anterior' });
    const previousWeekButtonBounds = await previousWeekButton.boundingBox();
    expect(previousWeekButtonBounds).not.toBeNull();
    expect(previousWeekButtonBounds!.width).toBeGreaterThanOrEqual(44);
    expect(previousWeekButtonBounds!.width).toBe(previousWeekButtonBounds!.height);
    await expect(previousWeekButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(previousWeekButton).toHaveCSS('border-top-width', '0px');
    await expect(page.getByRole('tablist', { name: 'Secciones de Equipo' })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Gestionar miembros y cuadrillas' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Gestionar miembros y cuadrillas' }).click();
    await expect(page).toHaveURL(/\/team\/manage$/);
    await expect(
      page.getByRole('heading', { name: 'Gestionar equipo', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Volver a Equipo' }).click();
    await expect(page).toHaveURL(/\/team$/);
    await expect(page.locator('[data-week-day]')).toHaveCount(7);
    await expect(
      page
        .locator('[data-week-day]')
        .first()
        .getByTestId('day-project-project-navigation')
        .getByText('Cuadrilla Norte', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Ana Demo' })).toBeVisible();
    const initialProjectCard = page
      .locator('[data-week-day]')
      .first()
      .getByTestId('day-project-project-navigation');
    const initialPeopleButton = initialProjectCard.getByRole('button', {
      name: 'Editar equipo de Proyecto de navegación',
    });
    const initialPeopleButtonBounds = await initialPeopleButton.boundingBox();
    expect(initialPeopleButtonBounds).not.toBeNull();
    expect(initialPeopleButtonBounds!.width).toBe(initialPeopleButtonBounds!.height);
    await expect(
      initialProjectCard.getByRole('link', { name: 'Ir al proyecto Proyecto de navegación' }),
    ).toBeVisible();

    const resourceFilter = page.getByTestId('weekly-resource-filter');
    await resourceFilter.locator('summary').click();
    const luisFilter = page.getByRole('checkbox', {
      name: 'Mostrar asignaciones de Luis Demo',
    });
    const anaFilter = page.getByRole('checkbox', {
      name: 'Mostrar asignaciones de Ana Demo',
    });
    await luisFilter.check();
    await expect(resourceFilter).toHaveAttribute('open', '');
    const visibleWeek = page.locator('[data-week-day]');
    const navigationProjectCards = visibleWeek.getByTestId('day-project-project-navigation');
    await expect(navigationProjectCards).toHaveCount(7);
    await expect(
      navigationProjectCards.first().getByText('Luis Demo', { exact: true }),
    ).toBeVisible();
    await expect(navigationProjectCards.first().getByText('Ana Demo', { exact: true })).toHaveCount(
      0,
    );
    await expect(visibleWeek.getByTestId('day-project-project-weekly-support')).toHaveCount(0);

    await anaFilter.check();
    await expect(visibleWeek.getByTestId('day-project-project-weekly-support')).toHaveCount(7);
    await expect(
      navigationProjectCards.first().getByText('Ana Demo, Luis Demo', { exact: true }),
    ).toBeVisible();
    await luisFilter.uncheck();
    await expect(
      navigationProjectCards.first().getByText('Luis Demo', { exact: true }),
    ).toHaveCount(0);

    await resourceFilter.getByRole('button', { name: 'Limpiar filtros' }).click();
    await page
      .getByRole('checkbox', { name: 'Mostrar asignaciones de cuadrilla Cuadrilla Norte' })
      .check();
    await expect(
      navigationProjectCards.first().getByText('Ana Demo, Luis Demo', { exact: true }),
    ).toBeVisible();
    await resourceFilter.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(resourceFilter).toHaveAttribute('open', '');
    await page.getByRole('heading', { name: 'Equipo', exact: true }).click();
    await expect(resourceFilter).not.toHaveAttribute('open');

    const initialRange = await page.getByTestId('week-range').textContent();
    await page.setViewportSize({ width: 390, height: 844 });
    const swipeSurface = page.getByTestId('weekly-swipe-surface');
    const currentSlide = swipeSurface.locator('[data-week-slide="current"]');
    const activeWeekRange = currentSlide.getByTestId('week-range');
    const surfaceBounds = await swipeSurface.boundingBox();
    const initialSlideBounds = await currentSlide.boundingBox();
    expect(surfaceBounds).not.toBeNull();
    expect(initialSlideBounds).not.toBeNull();
    const dragStartX = surfaceBounds!.x + surfaceBounds!.width / 2;
    const dragStartY = surfaceBounds!.y + surfaceBounds!.height / 2;
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down();
    await page.mouse.move(dragStartX - 90, dragStartY, { steps: 6 });
    await expect
      .poll(async () => (await currentSlide.boundingBox())?.x ?? Number.POSITIVE_INFINITY)
      .toBeLessThan(initialSlideBounds!.x - 40);
    await expect(swipeSurface.locator('[data-week-slide="preview"]')).toBeVisible();
    await page.mouse.up();
    await expect(activeWeekRange).not.toHaveText(initialRange!);
    await expect(swipeSurface).toHaveAttribute('data-slide-direction', 'next');
    await page.getByRole('button', { name: 'Esta semana', exact: true }).click();
    await expect(swipeSurface).toHaveAttribute('data-slide-direction', 'previous');
    await expect(swipeSurface).toHaveAttribute('data-swipe-phase', 'settling');
    await expect(currentSlide).toHaveCSS('transition-property', 'transform');
    await expect(activeWeekRange).toHaveText(initialRange!);
    const todayButton = page.locator(`[data-day-key="${todayKey}"]`);
    await expect(todayButton).toHaveAttribute('aria-pressed', 'true');
    await expect(todayButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const selectedDayNumber = todayButton.getByTestId('week-day-number');
    await expect(selectedDayNumber).toHaveCSS('background-color', 'rgb(86, 19, 33)');
    await expect(todayButton.getByTestId('week-day-dots')).toHaveCSS('margin-top', '2px');

    const otherCurrentDay = currentWeekDateKeys.find((dateKey) => dateKey !== todayKey)!;
    await page.locator(`[data-day-key="${otherCurrentDay}"]`).click();
    await expect(todayButton).toHaveAttribute('aria-pressed', 'false');
    await expect(todayButton.getByTestId('week-day-number')).toHaveCSS('color', 'rgb(86, 19, 33)');
    await expect(todayButton.getByTestId('week-day-number')).toHaveCSS('font-weight', '700');
    await expect(page.getByRole('button', { name: 'Esta semana', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Esta semana', exact: true }).click();
    await expect(todayButton).toHaveAttribute('aria-pressed', 'true');

    const nextWeekDateKey = await page.evaluate((today) => {
      const [year, month, day] = today.split('-').map(Number);
      const date = new Date(year!, month! - 1, day! + 7);
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
    }, todayKey);
    const weekDatePicker = page.getByTestId('week-date-picker');
    await expect(weekDatePicker).toHaveAttribute('type', 'date');
    await weekDatePicker.fill(nextWeekDateKey);
    await expect(page.locator(`[data-day-key="${nextWeekDateKey}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('status', { name: 'Cargando planificación semanal' })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Esta semana', exact: true }).click();
    await expect(todayButton).toHaveAttribute('aria-pressed', 'true');

    const snapBackBounds = await swipeSurface.boundingBox();
    expect(snapBackBounds).not.toBeNull();
    const shortDragStartX = snapBackBounds!.x + snapBackBounds!.width / 2;
    const shortDragStartY = snapBackBounds!.y + snapBackBounds!.height / 2;
    await page.mouse.move(shortDragStartX, shortDragStartY);
    await page.mouse.down();
    await page.mouse.move(shortDragStartX - 24, shortDragStartY, { steps: 2 });
    await page.mouse.up();
    await expect(swipeSurface).toHaveAttribute('data-swipe-phase', 'idle');
    await expect(activeWeekRange).toHaveText(initialRange!);
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await expect(activeWeekRange).not.toHaveText(initialRange!);
    await page.getByRole('button', { name: 'Semana anterior' }).click();
    await expect(activeWeekRange).toHaveText(initialRange!);
    await page.setViewportSize({ width: 320, height: 760 });
    const weekSelector = page.getByTestId('week-selector');
    await expect(weekSelector).toHaveCSS('flex-wrap', 'nowrap');
    const selectorBounds = await weekSelector.boundingBox();
    const weekControlsBounds = await page.getByTestId('week-selector-controls').boundingBox();
    expect(selectorBounds).not.toBeNull();
    expect(weekControlsBounds).not.toBeNull();
    expect(weekControlsBounds!.x + weekControlsBounds!.width).toBeLessThanOrEqual(
      selectorBounds!.x + selectorBounds!.width + 1,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.locator(`[data-day-key="${todayKey}"]`).click();
    await page
      .locator(`[data-week-day="${todayKey}"]`)
      .getByRole('button', { name: 'Editar equipo de Proyecto de navegación' })
      .click();
    const editor = page.getByRole('dialog', { name: 'Editar equipo de Proyecto de navegación' });
    await expect(editor.getByLabel('Incluir Ana Demo en Cuadrilla Norte')).toBeChecked();
    await editor.getByLabel('Incluir Ana Demo en Cuadrilla Norte').uncheck();
    await editor.getByLabel('Asignar persona Eva Demo').check();
    await editor.getByRole('button', { name: 'Guardar cambios' }).click();

    const projectCard = page
      .locator(`[data-week-day="${todayKey}"]`)
      .getByTestId('day-project-project-navigation');
    await expect(projectCard.getByText('Luis Demo')).toBeVisible();
    await expect(projectCard.getByText('Eva Demo')).toBeVisible();
    await expect(projectCard.getByText('Ana Demo')).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'Ana Demo' })).toHaveCount(0);

    await page.locator(`[data-day-key="${tomorrowKey}"]`).click();
    const tomorrowProject = page
      .locator(`[data-week-day="${tomorrowKey}"]`)
      .getByTestId('day-project-project-navigation');
    await expect(tomorrowProject.getByText('Ana Demo')).toBeVisible();
    await expect(tomorrowProject.getByText('Luis Demo')).toBeVisible();
    await expect(tomorrowProject.getByText('Eva Demo')).toHaveCount(0);

    await page.locator(`[data-day-key="${todayKey}"]`).click();
    await page
      .locator(`[data-week-day="${todayKey}"]`)
      .getByRole('button', { name: 'Editar equipo de Proyecto de navegación' })
      .click();
    const savedEditor = page.getByRole('dialog', {
      name: 'Editar equipo de Proyecto de navegación',
    });
    await savedEditor.getByRole('button', { name: 'Restablecer predeterminados' }).click();
    await expect(
      page
        .locator(`[data-week-day="${todayKey}"]`)
        .getByTestId('day-project-project-navigation')
        .getByText('Ana Demo'),
    ).toBeVisible();

    const globalCrew = await getDoc(
      doc(
        db,
        'users',
        primaryUid,
        'projects',
        'project-navigation',
        'assignments',
        'crew_crew-demo-norte',
      ),
    );
    expect(globalCrew.data()?.members).toEqual([
      { id: 'member-demo-ana', name: 'Ana Demo' },
      { id: 'member-demo-luis', name: 'Luis Demo' },
    ]);
    const restoredOverride = await getDoc(
      doc(db, 'users', primaryUid, 'projects', 'project-navigation', 'dailyAssignments', todayKey),
    );
    expect(restoredOverride.exists()).toBe(false);

    const installNotice = page.getByRole('button', { name: 'Ocultar aviso de instalación' });
    if (await installNotice.isVisible()) await installNotice.click();
    const pushNotice = page.getByRole('button', { name: 'Ahora no' });
    if (await pushNotice.isVisible()) await pushNotice.click();
    await page.locator('.skip-link').evaluate((element) => (element as HTMLElement).blur());
    await resourceFilter.locator('summary').click();
    await luisFilter.check();
    await page.screenshot({
      path: 'docs/testing-evidence/bg011-weekly-filter-desktop.png',
      fullPage: true,
    });
    await resourceFilter.getByRole('button', { name: 'Limpiar filtros' }).click();
    await resourceFilter.locator('summary').click();
    await page.screenshot({
      path: 'docs/testing-evidence/bg011-weekly-team-desktop.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await resourceFilter.locator('summary').click();
    await luisFilter.check();
    await page.screenshot({
      path: 'docs/testing-evidence/bg011-weekly-filter-mobile.png',
      fullPage: true,
    });
    await resourceFilter.getByRole('button', { name: 'Limpiar filtros' }).click();
    await resourceFilter.locator('summary').click();
    await page.screenshot({
      path: 'docs/testing-evidence/bg011-weekly-team-mobile.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Gestionar miembros y cuadrillas' }).click();
    await expect(page).toHaveURL(/\/team\/manage$/);
    await expect(
      page.getByRole('heading', { name: 'Gestionar equipo', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Personas', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Volver a Equipo' }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    const todayProjectCard = page
      .locator(`[data-week-day="${todayKey}"]`)
      .getByTestId('day-project-project-navigation');
    const projectTitle = todayProjectCard.getByRole('heading', {
      name: 'Proyecto de navegación',
      exact: true,
    });
    const projectTitleBounds = await projectTitle.boundingBox();
    expect(projectTitleBounds).not.toBeNull();
    expect(projectTitleBounds!.width).toBeGreaterThan(72);
    const editPeopleButton = todayProjectCard.getByRole('button', {
      name: 'Editar equipo de Proyecto de navegación',
    });
    const openProjectLink = todayProjectCard.getByRole('link', {
      name: 'Ir al proyecto Proyecto de navegación',
    });
    const peopleButtonBounds = await editPeopleButton.boundingBox();
    const openProjectLinkBounds = await openProjectLink.boundingBox();
    expect(peopleButtonBounds).not.toBeNull();
    expect(openProjectLinkBounds).not.toBeNull();
    expect(peopleButtonBounds!.width).toBe(peopleButtonBounds!.height);
    expect(openProjectLinkBounds!.width).toBe(openProjectLinkBounds!.height);
    await openProjectLink.click();
    await expect(page).toHaveURL(/\/projects\/project-navigation$/);
    await expect(
      page.getByRole('heading', { name: 'Proyecto de navegación', exact: true }),
    ).toBeVisible();
    const estimatedEndDateInput = page.getByLabel('Fecha estimada de fin del proyecto');
    await expect(page.getByRole('button', { name: 'Guardar fecha', exact: true })).toHaveCount(0);
    await estimatedEndDateInput.dispatchEvent('pointerdown');
    await estimatedEndDateInput.fill(estimatedEndDateKey);
    await expect(estimatedEndDateInput).toHaveValue(estimatedEndDateKey);
    await expect
      .poll(
        async () =>
          (await getDoc(doc(db, 'users', primaryUid, 'projects', 'project-navigation'))).data()
            ?.estimatedEndDate,
      )
      .toBe(estimatedEndDateKey);
    await page.goBack();
    await expect(page).toHaveURL(/\/team$/);
    await expect(
      page
        .locator(`[data-week-day="${estimatedEndDateKey}"]`)
        .getByTestId('day-project-project-navigation'),
    ).toBeVisible();
    await expect(
      page
        .locator(`[data-week-day="${afterEstimatedEndDateKey}"]`)
        .getByTestId('day-project-project-navigation'),
    ).toHaveCount(0);
    const retainedAfterEndOverride = await getDoc(
      doc(
        db,
        'users',
        primaryUid,
        'projects',
        'project-navigation',
        'dailyAssignments',
        afterEstimatedEndDateKey,
      ),
    );
    expect(retainedAfterEndOverride.data()?.assignments).toHaveLength(1);
    expect(retainedAfterEndOverride.data()?.assignments[0]?.resourceId).toBe('crew-demo-norte');

    await page
      .locator(`[data-week-day="${estimatedEndDateKey}"]`)
      .getByTestId('day-project-project-navigation')
      .getByRole('link', { name: 'Ir al proyecto Proyecto de navegación' })
      .click();
    const editEstimatedEndDate = page.getByLabel('Fecha estimada de fin del proyecto');
    await editEstimatedEndDate.focus();
    await editEstimatedEndDate.press('ArrowRight');
    await editEstimatedEndDate.press('ArrowRight');
    await page.keyboard.type('2');
    await page.waitForTimeout(400);
    await expect
      .poll(
        async () =>
          (await getDoc(doc(db, 'users', primaryUid, 'projects', 'project-navigation'))).data()
            ?.estimatedEndDate,
      )
      .toBe(estimatedEndDateKey);
    await page.keyboard.type('027');
    await expect(editEstimatedEndDate).toHaveValue(nextYearEstimatedEndDateKey);
    await page.goBack();
    await expect(page).toHaveURL(/\/team$/);
    await expect
      .poll(
        async () =>
          (await getDoc(doc(db, 'users', primaryUid, 'projects', 'project-navigation'))).data()
            ?.estimatedEndDate,
      )
      .toBe(nextYearEstimatedEndDateKey);
  } finally {
    await env.cleanup();
  }
});

test('edits a project name and client and synchronizes both fields to its source budget', async ({
  page,
}) => {
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
  const db = env.authenticatedContext(primaryUid).firestore();
  const budgetId = 'budget-editable-project';
  const projectId = 'project-editable-project';
  const acceptedAt = '2026-11-01T10:00:00.000Z';

  await env.withSecurityRulesDisabled(async (context) => {
    const seedDb = context.firestore();
    await setDoc(doc(seedDb, 'users', primaryUid, 'budgets', budgetId), {
      id: budgetId,
      info: {
        clientName: 'Cliente inicial',
        address: 'Obra inicial',
        date: '2026-11-01',
        budgetNumber: '91',
      },
      workItems: [],
      acceptedAt,
      projectId,
      createdAt: acceptedAt,
    });
    await setDoc(doc(seedDb, 'users', primaryUid, 'projects', projectId), {
      id: projectId,
      sourceBudgetId: budgetId,
      sourceBudgetNumber: '91',
      title: 'Obra inicial',
      clientName: 'Cliente inicial',
      address: 'Obra inicial',
      budgetDate: '2026-11-01',
      acceptedAt,
      createdAt: acceptedAt,
      subtotal: 100,
      iva: 21,
      total: 121,
      ivaRate: 0.21,
      workItemCount: 0,
      mode: 'concepts',
      totalConcepts: 0,
      completedConcepts: 0,
      totalAmount: 0,
      completedAmount: 0,
      percent: 0,
      status: 'pending',
      supplementsSubtotal: 0,
      supplementsIva: 0,
      updatedTotal: 121,
    });
  });

  try {
    await login(page);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole('heading', { name: 'Obra inicial', exact: true })).toBeVisible();
    const editProjectButton = page
      .locator('.workspace-header-action-slot')
      .getByRole('button', { name: 'Editar datos del proyecto', exact: true });
    const expectEditButtonInGlobalHeader = async () => {
      await expect(editProjectButton).toBeVisible();
      const headerBox = await page.locator('.workspace-header').boundingBox();
      const buttonBox = await editProjectButton.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(buttonBox).not.toBeNull();
      expect(buttonBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
      expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(
        headerBox!.y + headerBox!.height,
      );
    };
    await expectEditButtonInGlobalHeader();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectEditButtonInGlobalHeader();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(editProjectButton).toHaveClass(/rounded-full/);
    await expect(editProjectButton).toHaveAttribute('title', 'Editar datos del proyecto');
    await expect(editProjectButton).toHaveText('');
    await expect(
      page.locator('[data-page-header]').getByRole('button', {
        name: 'Editar datos del proyecto',
        exact: true,
      }),
    ).toHaveCount(0);
    await editProjectButton.click();

    const dialog = page.getByRole('dialog', {
      name: 'Editar nombre y cliente del proyecto',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.modal-panel')).toHaveCSS('opacity', '1');
    await page.screenshot({
      path: 'docs/testing-evidence/bg009-project-identity-desktop.png',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: 'docs/testing-evidence/bg009-project-identity-mobile.png',
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await dialog.getByLabel('Nombre del proyecto', { exact: true }).fill('Reforma renovada');
    await dialog.getByLabel('Nombre del cliente', { exact: true }).fill('Cliente renovado');
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

    await expect(
      page.getByRole('heading', { name: 'Reforma renovada', exact: true }),
    ).toBeVisible();
    const savedProject = await getDoc(doc(db, 'users', primaryUid, 'projects', projectId));
    expect(savedProject.data()).toMatchObject({
      title: 'Reforma renovada',
      address: 'Reforma renovada',
      clientName: 'Cliente renovado',
    });
    const savedBudget = await getDoc(doc(db, 'users', primaryUid, 'budgets', budgetId));
    expect(savedBudget.data()?.info).toMatchObject({
      address: 'Reforma renovada',
      clientName: 'Cliente renovado',
    });

    await page.goto(`/budget/${budgetId}`);
    await expect(page.locator('#clientName')).toHaveValue('Cliente renovado');
    await expect(page.locator('#address')).toHaveValue('Reforma renovada');
  } finally {
    await env.cleanup();
  }
});

test('creates standalone and completed-project work entries from a day in Equipo', async ({
  page,
}) => {
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
  const db = env.authenticatedContext(primaryUid).firestore();
  const completedProjectId = 'project-team-job-completed-old';
  const today = new Date();
  const dateKey = [
    String(today.getFullYear()).padStart(4, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const completedProject = {
    id: completedProjectId,
    sourceBudgetId: 'budget-team-job-completed-old',
    sourceBudgetNumber: '76',
    title: 'Proyecto terminado hace años',
    clientName: 'Cliente de prueba',
    address: 'Proyecto terminado hace años',
    budgetDate: '2024-02-01',
    acceptedAt: '2024-02-02T10:00:00.000Z',
    createdAt: '2024-02-02T10:00:00.000Z',
    completedAt: '2024-04-15T10:00:00.000Z',
    subtotal: 100,
    iva: 21,
    total: 121,
    ivaRate: 0.21,
    workItemCount: 1,
    mode: 'concepts',
    totalConcepts: 1,
    completedConcepts: 1,
    totalAmount: 100,
    completedAmount: 100,
    percent: 100,
    status: 'completed',
    supplementsSubtotal: 0,
    supplementsIva: 0,
    updatedTotal: 121,
  };
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), 'users', primaryUid, 'projects', completedProjectId),
      completedProject,
    );
  });

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Equipo', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo trabajo', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/team/jobs/new\\?date=${dateKey}$`));
    await expect(page.getByRole('heading', { name: 'Nuevo trabajo', exact: true })).toBeVisible();
    await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue(dateKey);
    await expect(page.getByLabel('Descripción (opcional)', { exact: true })).toBeVisible();
    const headerSave = page
      .getByRole('banner')
      .getByRole('button', { name: 'Guardar trabajo', exact: true });
    await expect(headerSave).toBeVisible();
    await expect(page.locator('#team-job-form button[type="submit"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Añadir persona', exact: true }).click();
    const memberDialog = page.getByRole('dialog', { name: 'Añadir persona' });
    await memberDialog.getByLabel('Nombre', { exact: true }).fill('Diego Demo');
    await memberDialog.getByRole('button', { name: 'Añadir y asignar', exact: true }).click();
    const newMemberCheckbox = page.getByRole('checkbox', { name: 'Diego Demo', exact: true });
    await expect(newMemberCheckbox).toBeChecked();

    await page.getByLabel('Título del trabajo', { exact: true }).fill('Remate sin proyecto');
    await headerSave.click();
    await expect(page).toHaveURL(new RegExp(`/team\\?date=${dateKey}$`));
    const standaloneCard = page.locator('[data-testid^="day-job-"]:visible').filter({
      hasText: 'Remate sin proyecto',
    });
    await expect(standaloneCard).toContainText('Remate sin proyecto');
    await expect(standaloneCard).toContainText('Diego Demo');
    await expect(standaloneCard).not.toContainText('Repasar el sellado de la encimera.');

    const projectBefore = await getDoc(
      doc(db, 'users', primaryUid, 'projects', completedProjectId),
    );
    await page.getByRole('button', { name: 'Nuevo trabajo', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/team/jobs/new\\?date=${dateKey}$`));
    const projectSelect = page.getByLabel('Proyecto (opcional)', { exact: true });
    await expect(
      projectSelect.getByRole('option', { name: /Proyecto terminado hace años/ }),
    ).toBeAttached();
    await projectSelect.selectOption(completedProjectId);
    await expect(page.getByLabel('Título del trabajo', { exact: true })).toHaveValue(
      'Proyecto terminado hace años',
    );
    await page.getByRole('checkbox', { name: 'Ana Demo', exact: true }).check();
    await headerSave.click();
    await expect(page).toHaveURL(new RegExp(`/team\\?date=${dateKey}$`));
    const linkedCard = page.locator('[data-testid^="day-job-"]:visible').filter({
      hasText: 'Proyecto terminado hace años',
    });
    await expect(linkedCard).toContainText('Proyecto terminado hace años');
    await expect(linkedCard.getByRole('link')).toHaveAttribute(
      'href',
      `/projects/${completedProjectId}`,
    );
    const projectAfter = await getDoc(doc(db, 'users', primaryUid, 'projects', completedProjectId));
    expect(projectAfter.data()).toEqual(projectBefore.data());
    expect(projectAfter.data()).toMatchObject({ status: 'completed', percent: 100 });

    const standaloneDocs = await getDocs(
      query(
        collection(db, 'users', primaryUid, 'teamJobs'),
        where('title', '==', 'Remate sin proyecto'),
      ),
    );
    expect(standaloneDocs.docs).toHaveLength(1);
    expect(standaloneDocs.docs[0]?.data()).toMatchObject({
      date: dateKey,
      title: 'Remate sin proyecto',
      description: '',
    });
    const linkedDocs = await getDocs(
      query(
        collection(db, 'users', primaryUid, 'teamJobs'),
        where('projectId', '==', completedProjectId),
      ),
    );
    expect(linkedDocs.docs).toHaveLength(1);
    expect(linkedDocs.docs[0]?.data()).toMatchObject({
      projectId: completedProjectId,
      projectTitle: 'Proyecto terminado hace años',
    });

    const resourceFilter = page.getByTestId('weekly-resource-filter');
    await resourceFilter.locator('summary').click();
    await page.getByLabel('Mostrar asignaciones de Diego Demo', { exact: true }).check();
    await expect(
      page.locator('[data-testid^="day-job-"]:visible').filter({ hasText: 'Remate sin proyecto' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo trabajo', exact: true })).toBeVisible();
  } finally {
    await env.cleanup();
  }
});
