import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storageKeys } from '../lib/api';
import { storeService } from '../services/storeService';
import { normalizeStores } from '../utils/helpers';
import { useAuth } from './AuthContext';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState(localStorage.getItem(storageKeys.storeId) || '');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function resolveStores() {
      if (!user) {
        setStoreId('');
        setStores([]);
        localStorage.removeItem(storageKeys.storeId);
        return;
      }

      const embeddedStores = normalizeStores(user);

      if (user.role === 'admin') {
        setLoading(true);
        try {
          const response = await storeService.list({ per_page: 200 });
          const apiStores = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
          const nextStores = apiStores.length ? apiStores : embeddedStores;
          setStores(nextStores);

          const preferred = String(localStorage.getItem(storageKeys.storeId) || user.default_store_id || nextStores[0]?.store_id || '');
          setStoreId(preferred);
          if (preferred) localStorage.setItem(storageKeys.storeId, preferred);
          else localStorage.removeItem(storageKeys.storeId);
        } catch {
          setStores(embeddedStores);
          const preferred = String(localStorage.getItem(storageKeys.storeId) || user.default_store_id || embeddedStores[0]?.store_id || '');
          setStoreId(preferred);
          if (preferred) localStorage.setItem(storageKeys.storeId, preferred);
          else localStorage.removeItem(storageKeys.storeId);
        } finally {
          setLoading(false);
        }
        return;
      }

      setStores(embeddedStores);
      const hasSelectedAccessibleStore = embeddedStores.some((store) => String(store.store_id) === String(storeId));
      const preferred = String(
        hasSelectedAccessibleStore
          ? storeId
          : user.default_store_id || embeddedStores[0]?.store_id || ''
      );
      setStoreId(preferred);
      if (preferred) localStorage.setItem(storageKeys.storeId, preferred);
      else localStorage.removeItem(storageKeys.storeId);
    }

    resolveStores();
  }, [user]);

  const updateStoreId = (value) => {
    const next = String(value || '');
    setStoreId(next);
    if (next) localStorage.setItem(storageKeys.storeId, next);
    else localStorage.removeItem(storageKeys.storeId);
  };

  const value = useMemo(() => ({
    storeId,
    setStoreId: updateStoreId,
    stores,
    loading,
    activeStore: stores.find((store) => String(store.store_id) === String(storeId)) || null,
  }), [loading, storeId, stores]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
