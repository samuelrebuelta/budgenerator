import { createTemplateRepository } from '@bg/firebase-api/template';
import { db } from '@/shared/firebase/config';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared template repository (`@bg/firebase-api`, BG-014 D2). */
const repository = createTemplateRepository({
  sdk: webFirestoreSdk,
  database: db,
  guardMutation: guardNetworkMutation,
});

export const { fetchTemplates, createTemplate, saveTemplate, deleteTemplateDoc } = repository;
