import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
) {
  const messaging = getMessaging(initializeApp(firebaseConfig));
  onBackgroundMessage(messaging, async (payload) => {
    const jobId = payload.data?.jobId;
    const leadId = payload.data?.leadId;
    if (
      typeof jobId !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(jobId) ||
      typeof leadId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(leadId)
    ) {
      return;
    }
    const url = new URL('/profile/solicitudes', self.location.origin);
    url.searchParams.set('leadId', leadId);
    const registration = (self as unknown as { registration: ServiceWorkerRegistration })
      .registration;
    await registration.showNotification('Nueva solicitud de presupuesto', {
      body: 'Tienes una nueva solicitud en BudGenerator.',
      tag: jobId,
      data: { leadId, url: `${url.pathname}${url.search}` },
      icon: '/favicon-192.png',
      badge: '/favicon-192.png',
    });
  });
}
