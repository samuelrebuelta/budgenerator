const STORAGE_KEY = 'renovation-budget-data';

export function loadFromStorage<T>(key: string = STORAGE_KEY): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch {
    return null;
  }
}

export function saveToStorage<T>(data: T, key: string = STORAGE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.error('Failed to save to localStorage');
  }
}
