import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import type { BudgetTemplate } from '@/shared/types';

function templatesCol(uid: string) {
  return collection(db, 'users', uid, 'templates');
}

export async function fetchTemplates(uid: string): Promise<BudgetTemplate[]> {
  const snap = await getDocs(templatesCol(uid));
  return snap.docs.map((d) => d.data() as BudgetTemplate);
}

export async function saveTemplate(uid: string, template: BudgetTemplate) {
  const data: BudgetTemplate = {
    id: template.id,
    name: template.name,
    workItems: template.workItems,
    ...(template.adjustment ? { adjustment: template.adjustment } : {}),
    createdAt: template.createdAt,
  };
  await setDoc(doc(templatesCol(uid), template.id), data);
}

export async function deleteTemplateDoc(uid: string, templateId: string) {
  await deleteDoc(doc(templatesCol(uid), templateId));
}
