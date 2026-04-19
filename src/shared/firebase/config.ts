import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAqb-gBxz9Ja_s-uCAUDpdNnZG2j9acQQk',
  authDomain: 'budgenerator.firebaseapp.com',
  projectId: 'budgenerator',
  storageBucket: 'budgenerator.firebasestorage.app',
  messagingSenderId: '553278348569',
  appId: '1:553278348569:web:2b72da2d8338f2d3823988',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
