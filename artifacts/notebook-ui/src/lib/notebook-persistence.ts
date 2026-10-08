const DATABASE_NAME = "notebook-ui-local";
const STORE_NAME = "workspace";
const CURRENT_NOTEBOOK_KEY = "current-notebook";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(DATABASE_NAME, 1);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть локальное хранилище блокнота."));
  });
}

function runStoreRequest<T>(
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(database => new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(STORE_NAME, mode);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    let result: T;
    let hasResult = false;
    const request = createRequest(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => {
      result = request.result;
      hasResult = true;
    };

    transaction.oncomplete = () => {
      database.close();
      if (hasResult) resolve(result!);
      else reject(new Error("Локальное хранилище не вернуло результат."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? request.error ?? new Error("Не удалось сохранить блокнот локально."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Сохранение блокнота было отменено."));
    };
  }));
}

export async function loadCurrentNotebook(): Promise<unknown | null> {
  const saved = await runStoreRequest<unknown>(
    "readonly",
    store => store.get(CURRENT_NOTEBOOK_KEY),
  );
  return saved === undefined ? null : saved;
}

export async function saveCurrentNotebook(notebook: unknown): Promise<void> {
  await runStoreRequest<IDBValidKey>(
    "readwrite",
    store => store.put(notebook, CURRENT_NOTEBOOK_KEY),
  );
}

export async function clearCurrentNotebook(): Promise<void> {
  await runStoreRequest<undefined>(
    "readwrite",
    store => store.delete(CURRENT_NOTEBOOK_KEY),
  );
}
