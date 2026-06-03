import {
  CreditCard,
  FolderClock,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  Wallet,
  Download,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { billingService } from '../../services/billingService';
import { categoryService } from '../../services/categoryService';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { currency, formatDateTime } from '../../utils/helpers';
import { openBillingPrint, downloadBillingDocument } from '../../utils/print';
import { mergeStoreSettings } from '../../utils/storeSettings';

const PRODUCTS_PER_PAGE = 8;
const SEARCH_DEBOUNCE_MS = 300;
const PRODUCT_CACHE_TTL_MS = 60_000; // 1-minute soft cache

const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL || '';

const paymentMethods = [
  { key: 'cash',  title: 'CASH',  description: 'Receive cash and enter tendered amount', icon: Wallet },
  { key: 'mpesa', title: 'MPESA', description: 'Enter phone number and transaction code', icon: Smartphone },
  { key: 'card',  title: 'CARD',  description: 'Enter card reference', icon: CreditCard },
];

const extractList = (res) => {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
};

const extractMeta = (res) => res?.meta || res?.data?.meta || res || {};

const getProductImage = (product) => {
  const rawPath =
    product?.image_url ||
    product?.product_image ||
    product?.photo_url ||
    product?.thumbnail ||
    product?.image ||
    product?.photo ||
    product?.media?.[0]?.url ||
    '';

  if (!rawPath) return '';
  if (rawPath.startsWith('http') || rawPath.startsWith('data:')) return rawPath;

  const cleanPath = rawPath.startsWith('/') ? rawPath.substring(1) : rawPath;
  return `${IMAGE_BASE_URL}${cleanPath}`;
};

const getItemTotal = (item) =>
  Number(
    item?.total_amount ??
      item?.line_total ??
      item?.line_subtotal ??
      Number(item?.quantity || 0) * Number(item?.unit_price || 0)
  );

const isTypingElement = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target.isContentEditable;
};

const isHotkeyBlockedElement = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) || target.isContentEditable;
};

export default function CashierPosPage() {
  const { user } = useAuth();
  const { stores, storeId, loading: storeLoading } = useStore();

  const currentStore = stores.find((store) => String(store.store_id) === String(storeId));
  const printSettings = mergeStoreSettings(currentStore);

  const searchInputRef = useRef(null);
  const productCacheRef = useRef(new Map());     // key -> { items, pageInfo, ts }
  const productRequestIdRef = useRef(0);
  const lastProductFilterRef = useRef('');
  const prefetchedKeysRef = useRef(new Set());   // avoid re-prefetching

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [drafts, setDrafts] = useState([]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [productPageInfo, setProductPageInfo] = useState({
    currentPage: 1,
    lastPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
    from: 0,
    to: 0,
    total: 0,
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [billing, setBilling] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [amountTendered, setAmountTendered] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [cardReference, setCardReference] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const focusSearchInput = useCallback((selectText = false) => {
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      if (selectText && typeof input.select === 'function') input.select();
    });
  }, []);

  const isOwnedByCurrentCashier = useCallback(
    (record) => {
      if (!user?.user_id) return true;
      const ownerId = record?.user_id || record?.user?.user_id || record?.user?.id;
      if (!ownerId) return true;
      return String(ownerId) === String(user.user_id);
    },
    [user]
  );

  const balanceDue =
    amountTendered && amountReceived
      ? (Number(amountTendered) - Number(amountReceived)).toFixed(2)
      : '0.00';

  const resetPaymentState = (total = '') => {
    setPaymentMethod('');
    setAmountReceived(total ? String(total) : '');
    setAmountTendered('');
    setMpesaPhone('');
    setMpesaCode('');
    setCardReference('');
    setCardHolder('');
  };

  const resetSale = () => {
    setBilling(null);
    setSelectedCustomerId('');
    setNotes('');
    resetPaymentState('');
    setShowPaymentModal(false);
  };

  const mergeDraftPreview = (billingRecord) => {
    if (!billingRecord?.billing_id) return;
    setDrafts((prev) => {
      const withoutCurrent = prev.filter(
        (item) => String(item.billing_id) !== String(billingRecord.billing_id)
      );
      if (!billingRecord.is_draft) return withoutCurrent;
      return [billingRecord, ...withoutCurrent].sort(
        (a, b) => Number(b.billing_id || 0) - Number(a.billing_id || 0)
      );
    });
  };

  const removeDraftPreview = (billingId) => {
    setDrafts((prev) => prev.filter((item) => String(item.billing_id) !== String(billingId)));
  };

  const deleteBillingRecord = async (billingId) => {
    if (typeof billingService.destroy === 'function') return billingService.destroy(billingId);
    if (typeof billingService.delete === 'function') return billingService.delete(billingId);
    if (typeof billingService.remove === 'function') return billingService.remove(billingId);
    throw new Error('Delete billing method is not implemented in billingService.');
  };

  /* =======================================================================
     PARALLEL CATALOG LOADER (categories + customers in ONE shot)
     ======================================================================= */
  const loadStaticData = useCallback(async () => {
    if (!storeId) return;
    setCatalogLoading(true);
    setError('');

    try {
      // ✅ PARALLEL fetch instead of sequential → ~2x faster
      const [categoriesRes, customersRes] = await Promise.all([
        categoryService.list({ store_id: Number(storeId), per_page: 100 }),
        customerService.list({ store_id: Number(storeId), per_page: 100 }),
      ]);

      setCategories(extractList(categoriesRes));
      setCustomers(extractList(customersRes));
    } catch (err) {
      console.error('Intercepted UI Error:', err);
      setError(
        `Failed to load catalog: ${err?.response?.data?.message || err?.message || 'Network Error'}`
      );
      setCategories([]);
      setCustomers([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [storeId]);

  /* =======================================================================
     CACHE KEY HELPER
     ======================================================================= */
  const buildCacheKey = useCallback(
    (page) =>
      JSON.stringify({
        storeId: String(storeId),
        page,
        category: String(activeCategory),
        search: debouncedSearch.trim().toLowerCase(),
      }),
    [storeId, activeCategory, debouncedSearch]
  );

  /* =======================================================================
     PRODUCT LOADER — uses backend meta correctly + smart cache
     ======================================================================= */
  const fetchProductsPage = useCallback(
    async (page) => {
      const params = {
        store_id: Number(storeId),
        per_page: PRODUCTS_PER_PAGE,
        page,                                  // ✅ next page sent to Laravel
        is_active: true,
      };
      if (activeCategory !== 'all') params.category_id = Number(activeCategory);
      const normalized = debouncedSearch.trim();
      if (normalized) params.search = normalized;

      const response = await productService.list(params);
      const meta = extractMeta(response);
      const items = extractList(response);

      const currentPg = Number(meta?.current_page || page);
      const lastPg    = Number(meta?.last_page    || 1);
      const total     = Number(meta?.total        || items.length);
      const perPage   = Number(meta?.per_page     || PRODUCTS_PER_PAGE);

      // ✅ Compute from/to locally if API didn’t send them
      const from = meta?.from ?? (items.length ? (currentPg - 1) * perPage + 1 : 0);
      const to   = meta?.to   ?? (items.length ? (currentPg - 1) * perPage + items.length : 0);

      const pageInfo = {
        currentPage: currentPg,
        lastPage:    lastPg,
        hasNextPage: currentPg < lastPg,        // ✅ reliable now
        hasPrevPage: currentPg > 1,
        from,
        to,
        total,
      };

      return { items, pageInfo };
    },
    [storeId, activeCategory, debouncedSearch]
  );

  const loadProducts = useCallback(
    async (page = 1, { force = false } = {}) => {
      if (!storeId) return;

      const cacheKey = buildCacheKey(page);
      const cached   = productCacheRef.current.get(cacheKey);
      const fresh    = cached && (Date.now() - cached.ts) < PRODUCT_CACHE_TTL_MS;

      // ✅ Instant render from cache (still revalidate in background if stale)
      if (!force && cached) {
        setProducts(cached.items);
        setProductPageInfo(cached.pageInfo);
        if (page !== cached.pageInfo.currentPage) setCurrentPage(cached.pageInfo.currentPage);
        if (fresh) return;                       // skip refetch
      }

      setProductsLoading(true);
      const requestId = ++productRequestIdRef.current;

      try {
        const { items, pageInfo } = await fetchProductsPage(page);
        if (requestId !== productRequestIdRef.current) return;

        productCacheRef.current.set(cacheKey, { items, pageInfo, ts: Date.now() });
        setProducts(items);
        setProductPageInfo(pageInfo);
        if (pageInfo.currentPage !== page) setCurrentPage(pageInfo.currentPage);
      } catch (err) {
        if (requestId !== productRequestIdRef.current) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to load products.');
        setProducts([]);
        setProductPageInfo({
          currentPage: 1, lastPage: 1, hasNextPage: false, hasPrevPage: false,
          from: 0, to: 0, total: 0,
        });
      } finally {
        if (requestId === productRequestIdRef.current) setProductsLoading(false);
      }
    },
    [storeId, buildCacheKey, fetchProductsPage]
  );

  /* =======================================================================
     PREFETCH NEXT PAGE → instant "Next" click
     ======================================================================= */
  const prefetchNextPage = useCallback(
    async (nextPage) => {
      if (!storeId || nextPage < 1) return;
      const key = buildCacheKey(nextPage);
      if (prefetchedKeysRef.current.has(key)) return;
      if (productCacheRef.current.has(key)) return;

      prefetchedKeysRef.current.add(key);
      try {
        const { items, pageInfo } = await fetchProductsPage(nextPage);
        productCacheRef.current.set(key, { items, pageInfo, ts: Date.now() });
      } catch {
        prefetchedKeysRef.current.delete(key); // allow retry later
      }
    },
    [storeId, buildCacheKey, fetchProductsPage]
  );

  /* =======================================================================
     DRAFTS — lazy / silent loading
     ======================================================================= */
  const loadDrafts = useCallback(
    async ({ silent = false } = {}) => {
      if (!storeId) return;
      if (!silent) setDraftsLoading(true);

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Drafts request timeout after 10 seconds')), 10000)
        );

        const response = await Promise.race([
          billingService.list({ store_id: Number(storeId), per_page: 25, is_draft: true }),
          timeoutPromise,
        ]);

        const data = extractList(response);
        const filtered = (Array.isArray(data) ? data : []).filter((item) =>
          isOwnedByCurrentCashier(item)
        );
        setDrafts(filtered);
      } catch (err) {
        if (!silent) setError(err?.response?.data?.message || err?.message || 'Failed to load drafts.');
        setDrafts([]);
      } finally {
        if (!silent) setDraftsLoading(false);
      }
    },
    [storeId, isOwnedByCurrentCashier]
  );

  const loadBillingDetail = async (billingId, { silent = false } = {}) => {
    if (!billingId) return null;
    if (!silent) setBillingLoading(true);

    try {
      const response = await billingService.show(billingId);
      const detail = response?.data || response;
      setBilling(detail);
      setSelectedCustomerId(detail?.customer_id ? String(detail.customer_id) : '');
      setNotes(detail?.notes || '');
      mergeDraftPreview(detail);
      return detail;
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load billing details.');
      throw err;
    } finally {
      if (!silent) setBillingLoading(false);
    }
  };

  /* =======================================================================
     EFFECTS
     ======================================================================= */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ✅ Initial mount — parallel boot of catalog + drafts; products load via filter effect
  useEffect(() => {
    if (!storeId) return;

    resetSale();
    setCategories([]);
    setCustomers([]);
    setProducts([]);
    setDrafts([]);
    setSearch('');
    setDebouncedSearch('');
    setDraftSearch('');
    setActiveCategory('all');
    setCurrentPage(1);
    setProductPageInfo({
      currentPage: 1, lastPage: 1, hasNextPage: false, hasPrevPage: false,
      from: 0, to: 0, total: 0,
    });

    productCacheRef.current.clear();
    prefetchedKeysRef.current.clear();
    lastProductFilterRef.current = '';

    // ✅ Fully parallel boot
    Promise.all([
      loadStaticData(),
      loadDrafts({ silent: true }),
    ]).catch((e) => console.error('POS init failed:', e));
  }, [storeId, loadStaticData, loadDrafts]);

  // Reset page when filters change
  useEffect(() => {
    if (!storeId) return;

    const filterSignature = JSON.stringify({
      storeId: String(storeId),
      category: String(activeCategory),
      search: debouncedSearch.trim().toLowerCase(),
    });

    const filtersChanged = lastProductFilterRef.current !== filterSignature;

    if (filtersChanged) {
      lastProductFilterRef.current = filterSignature;
      prefetchedKeysRef.current.clear(); // clear prefetch hints
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
    }

    void loadProducts(currentPage);
  }, [storeId, activeCategory, debouncedSearch, currentPage, loadProducts]);

  // ✅ Prefetch the next page whenever we successfully land on one
  useEffect(() => {
    if (productPageInfo.hasNextPage) {
      void prefetchNextPage(productPageInfo.currentPage + 1);
    }
  }, [productPageInfo.currentPage, productPageInfo.hasNextPage, prefetchNextPage]);

  useEffect(() => {
    if (!storeLoading && !catalogLoading && !showPaymentModal && !showDraftModal) {
      focusSearchInput();
    }
  }, [storeLoading, catalogLoading, showPaymentModal, showDraftModal, focusSearchInput]);

  /* =======================================================================
     BILLING OPERATIONS (unchanged logic, slight cleanup)
     ======================================================================= */
  const ensureDraft = async () => {
    if (billing?.billing_id) return billing;

    const response = await billingService.createDraft({
      store_id: Number(storeId),
      customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
      notes: notes || null,
    });

    const createdDraft = response?.data || response;
    const detail = await loadBillingDetail(createdDraft.billing_id, { silent: true });
    mergeDraftPreview(detail || createdDraft);
    return detail || createdDraft;
  };

  const addOrIncrementProduct = async (product) => {
    const current = await ensureDraft();
    const existing = current?.items?.find(
      (item) => String(item.product_id) === String(product.product_id)
    );

    if (existing) {
      await billingService.updateItem(existing.billing_item_id, {
        quantity: Number(existing.quantity) + 1,
        unit_price: existing.unit_price,
      });
    } else {
      await billingService.addItem(current.billing_id, {
        product_id: product.product_id,
        quantity: 1,
        unit_price: product.price,
      });
    }

    const updatedBilling = await loadBillingDetail(current.billing_id, { silent: true });
    setDrafts((prev) => prev.filter((item) => String(item.billing_id) !== String(current.billing_id)));
    return updatedBilling;
  };

  const handleAddProduct = async (product) => {
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      await addOrIncrementProduct(product);
      setSuccess(`${product.product_name} added to billing.`);
      focusSearchInput(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to add product.');
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentModalForBilling = (billingData) => {
    resetPaymentState(billingData?.total || '');
    setShowPaymentModal(true);
  };

  const handlePayNow = async (product) => {
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const updatedBilling = await addOrIncrementProduct(product);
      openPaymentModalForBilling(updatedBilling);
      setSuccess(`${product.product_name} added. Select payment method.`);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to proceed to payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateItemQuantity = async (item, nextQuantity) => {
    if (!billing?.billing_id) return;
    if (nextQuantity < 1) return removeItem(item.billing_item_id);

    setError(''); setSuccess(''); setSubmitting(true);
    try {
      await billingService.updateItem(item.billing_item_id, {
        quantity: nextQuantity,
        unit_price: item.unit_price,
      });
      const updatedBilling = await loadBillingDetail(billing.billing_id, { silent: true });
      mergeDraftPreview(updatedBilling);
      focusSearchInput();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to update quantity.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeItem = async (billingItemId) => {
    if (!billing?.billing_id) return;
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      await billingService.removeItem(billingItemId);
      const updatedBilling = await loadBillingDetail(billing.billing_id, { silent: true });
      mergeDraftPreview(updatedBilling);
      focusSearchInput();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to remove item.');
    } finally {
      setSubmitting(false);
    }
  };

  const persistDraftHeader = async () => {
    if (!billing?.billing_id) return null;
    await billingService.update(billing.billing_id, {
      customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
      notes: notes || null,
    });
    const updatedBilling = await loadBillingDetail(billing.billing_id, { silent: true });
    mergeDraftPreview(updatedBilling);
    return updatedBilling;
  };

  const handleSaveOrUpdateDraft = async () => {
    if (!billing?.items?.length) return;
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const updatedBilling = await persistDraftHeader();
      mergeDraftPreview(updatedBilling);
      setSuccess(
        updatedBilling?.billing_id
          ? `Draft #${updatedBilling.billing_id} updated successfully.`
          : 'Draft saved successfully.'
      );
      resetSale();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to save draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!billing?.items?.length) return;
    setError(''); setSuccess('');
    try {
      const currentBilling = await persistDraftHeader();
      openPaymentModalForBilling(currentBilling || billing);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to open payment.');
    }
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    setError('');
    if (method !== 'cash') setAmountTendered('');
  };

  const validatePayment = () => {
    if (!paymentMethod) { setError('Please select a payment method.'); return false; }
    if (!amountReceived || Number(amountReceived) <= 0) {
      setError('Please enter a valid amount received.'); return false;
    }
    if (paymentMethod === 'cash') return true;
    if (paymentMethod === 'mpesa') {
      if (!mpesaPhone.trim()) { setError('Please enter MPESA phone number.'); return false; }
      if (!mpesaCode.trim())  { setError('Please enter MPESA transaction code.'); return false; }
    }
    if (paymentMethod === 'card') {
      if (!cardReference.trim()) { setError('Please enter card reference.'); return false; }
    }
    return true;
  };

  const handleCharge = async () => {
    if (!billing?.billing_id || !billing?.items?.length) return;
    if (!validatePayment()) return;

    setSubmitting(true); setError(''); setSuccess('');
    try {
      await persistDraftHeader();
      await billingService.charge(billing.billing_id, {
        payment_method: paymentMethod,
        amount_received: Number(amountReceived || 0),
        amount_tendered:
          paymentMethod === 'cash'
            ? Number(amountTendered || amountReceived || 0)
            : Number(amountReceived || 0),
        mpesa_phone: paymentMethod === 'mpesa' ? mpesaPhone : null,
        mpesa_code:  paymentMethod === 'mpesa' ? mpesaCode  : null,
        card_reference: paymentMethod === 'card' ? cardReference : null,
        card_holder:    paymentMethod === 'card' ? cardHolder || null : null,
      });

      const paidResponse = await billingService.show(billing.billing_id);
      const paidBilling = paidResponse?.data || paidResponse;

      openBillingPrint(paidBilling, currentStore, 'receipt', printSettings);

      removeDraftPreview(billing.billing_id);
      resetSale();
      setShowPaymentModal(false);
      setSuccess('Payment processed successfully.');
      focusSearchInput(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to process payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadDraft = async (draftId) => {
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      await loadBillingDetail(draftId);
      setShowDraftModal(false);
      setShowPaymentModal(false);
      setSuccess('Draft loaded successfully.');
      focusSearchInput(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDraft = async (draftId) => {
    const confirmed = window.confirm('Move this draft to trash?');
    if (!confirmed) return;

    setError(''); setSuccess(''); setSubmitting(true);
    try {
      await deleteBillingRecord(draftId);
      if (String(billing?.billing_id) === String(draftId)) resetSale();
      removeDraftPreview(draftId);
      setSuccess('Draft moved to trash successfully.');
      focusSearchInput();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to delete draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscapeShortcut = useCallback(async () => {
    if (submitting) return;

    if (showPaymentModal) { setShowPaymentModal(false); focusSearchInput(true); return; }
    if (showDraftModal)   { setShowDraftModal(false);   focusSearchInput(true); return; }
    if (!billing?.billing_id && !billing?.items?.length && !search) {
      focusSearchInput(true); return;
    }

    const confirmed = window.confirm('Cancel the current sale and clear the active cart?');
    if (!confirmed) return;

    setError(''); setSuccess(''); setSubmitting(true);
    try {
      if (billing?.billing_id) {
        await deleteBillingRecord(billing.billing_id);
        removeDraftPreview(billing.billing_id);
      }
      resetSale();
      setSearch('');
      setSuccess('Current sale moved to trash.');
      focusSearchInput(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to cancel current sale.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, showPaymentModal, showDraftModal, billing, search, focusSearchInput]);

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      const blockedTarget = isHotkeyBlockedElement(event.target);
      const typingTarget  = isTypingElement(event.target);

      if (event.key === 'F2') { event.preventDefault(); focusSearchInput(true); return; }
      if (event.key === 'F8') {
        event.preventDefault();
        if (!submitting && billing?.items?.length) void handleSaveOrUpdateDraft();
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); void handleEscapeShortcut(); return; }

      const wantsCheckout =
        (event.code === 'Space' || event.key === ' ' || event.key === 'Enter') &&
        !blockedTarget && !typingTarget && !showPaymentModal && !showDraftModal;

      if (wantsCheckout && !submitting && billing?.items?.length) {
        event.preventDefault();
        void handleProceedToPayment();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [billing, submitting, showPaymentModal, showDraftModal, focusSearchInput, handleEscapeShortcut]);

  const itemCount =
    billing?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;

  const filteredDrafts = useMemo(() => {
    const keyword = draftSearch.trim().toLowerCase();
    if (!keyword) return drafts;
    return drafts.filter((draft) => {
      const haystack = [
        draft?.invnumber,
        `Draft #${draft?.billing_id || ''}`,
        draft?.customer?.full_name,
        draft?.customer?.phone,
        draft?.customer?.email,
        draft?.notes,
        String(draft?.total || ''),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [drafts, draftSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.customer_id) === String(selectedCustomerId)) || null,
    [customers, selectedCustomerId]
  );

  const invoiceTotal = Number(billing?.total || 0);

  const customerCurrentBalance = Number(
    selectedCustomer?.current_balance ??
      selectedCustomer?.balance ??
      selectedCustomer?.opening_balance ??
      0
  );

  /* =======================================================================
     PAGINATION HANDLERS (use cache → near-instant)
     ======================================================================= */
  const goToPreviousPage = () => {
    if (!productPageInfo.hasPrevPage || productsLoading) return;
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    if (!productPageInfo.hasNextPage || productsLoading) return;
    setCurrentPage((prev) => Math.min(prev + 1, productPageInfo.lastPage || prev + 1));
  };

  if (storeLoading) {
    return (
      <section className="pos-grid cashier-pos-page">
        <div className="pos-catalog stack-lg">
          <div className="page-loader">Loading stores...</div>
        </div>
      </section>
    );
  }

  if (!stores.length) {
    return (
      <section className="pos-grid cashier-pos-page">
        <div className="pos-catalog stack-lg">
          <div className="card hero-card compact-hero">
            <div>
              <span className="eyebrow">Cashier</span>
              <h2>Fortune Supermarket</h2>
            </div>
          </div>
          <div className="card">
            <p><strong>No stores assigned</strong></p>
            <p className="muted" style={{ marginTop: 8 }}>
              Your account does not have any store assigned. Please contact your administrator.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="pos-grid cashier-pos-page">
        <div className="pos-catalog stack-lg">
          <div className="card hero-card compact-hero">
            <div className="store-header-layout">
              <div className="store-brand-identity">
                <span className="eyebrow">{user?.role || currentStore?.role || 'Cashier'}</span>
                <h2 className="store-title">{currentStore?.store_name || 'Fortune Supermarket'}</h2>
              </div>
              <div className="store-contact-meta">
                <span className="meta-location">{currentStore?.location || 'Store Location'}</span>
                <p className="meta-address">{currentStore?.physical_address || 'Physical address not available'}</p>
                <p className="meta-communication">
                  {currentStore?.telephone || 'Telephone not available'}
                  {currentStore?.email_address && <span className="meta-divider">|</span>}
                  {currentStore?.email_address || ''}
                </p>
              </div>
            </div>
          </div>

          <div className="toolbar-row pos-toolbar-wrap">
            <div className="search-shell">
              <Search className="search-icon-pos" size={16} />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or SKU"
              />
            </div>

            <div className="chips-row">
              <button
                type="button"
                className={`chip ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.category_id}
                  type="button"
                  className={`chip ${String(activeCategory) === String(category.category_id) ? 'active' : ''}`}
                  onClick={() => setActiveCategory(category.category_id)}
                >
                  {category.category_name}
                </button>
              ))}
            </div>
          </div>

          {catalogLoading ? (
            <div className="page-loader">Loading POS...</div>
          ) : (
            <>
              {error   ? <div className="form-error">{error}</div> : null}
              {success ? <div className="form-success">{success}</div> : null}

              {productsLoading ? <div className="page-loader">Loading products...</div> : null}

              <div className="products-grid products-grid-enhanced">
                {products.map((product) => {
                  const image = getProductImage(product);
                  return (
                    <article key={product.product_id} className="product-card">
                      <div
                        className="product-card-overlay"
                        style={{
                          backgroundImage: image
                            ? `url(${image})`
                            : `linear-gradient(135deg, #427E97 0%, #E17A38 100%)`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                        }}
                      >
                        <div className="product-card-actions">
                          <button
                            type="button"
                            className="primary-button pay-now-btn"
                            disabled={submitting}
                            onClick={() => handlePayNow(product)}
                          >
                            Pay Now
                          </button>
                          <button
                            type="button"
                            className="ghost-button add-btn"
                            disabled={submitting}
                            onClick={() => handleAddProduct(product)}
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="product-card-info">
                        <h3>{product.product_name}</h3>
                        <strong>{currency(product.price, currentStore?.currency)}</strong>
                      </div>
                    </article>
                  );
                })}

                {!productsLoading && !products.length ? (
                  <div className="card">
                    <p>No products matched your search.</p>
                  </div>
                ) : null}
              </div>

              {products.length > 0 ? (
                <div className="pagination-bar">
                  <div className="pagination-summary">
                    Showing <strong>{productPageInfo.from}</strong> -{' '}
                    <strong>{productPageInfo.to}</strong> of{' '}
                    <strong>{productPageInfo.total}</strong> products
                  </div>

                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="ghost-button pagination-btn"
                      onClick={goToPreviousPage}
                      disabled={!productPageInfo.hasPrevPage || productsLoading}
                    >
                      Previous
                    </button>

                    <span className="pagination-page-indicator">
                      Page <strong>{productPageInfo.currentPage}</strong> of{' '}
                      <strong>{productPageInfo.lastPage}</strong>
                    </span>

                    <button
                      type="button"
                      className="ghost-button pagination-btn"
                      onClick={goToNextPage}
                      disabled={!productPageInfo.hasNextPage || productsLoading}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* === BILLING SIDEBAR (unchanged JSX) === */}
        <aside className="billing-panel stack-md">
          <div className="card billing-sidebar-card">
            <div className="card-header">
              <div>
                <h3>Current billing</h3>
                <p className="invoice-subtext">
                  {billing ? billing.invnumber || `Draft #${billing.billing_id}` : 'No active billing yet'}
                </p>
              </div>
              <div className="cart-badge">
                <ShoppingCart size={16} />
                <span>{itemCount} items</span>
              </div>
            </div>

            <div className="customer-billing-section">
              {selectedCustomerId ? (
                <div className="selected-customer-box">
                  <div className="customer-meta">
                    <span className="meta-label">Customer</span>
                    <strong>{selectedCustomer?.full_name || 'Selected Customer'}</strong>
                  </div>
                  <button type="button" className="change-customer-btn" onClick={() => setSelectedCustomerId('')}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="form-grid">
                  <label>
                    Customer Account
                    <select
                      className="select-input"
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                    >
                      <option value="">Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.customer_id} value={customer.customer_id}>
                          {customer.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="hero-quick-actions">
              <button
                type="button"
                className="ghost-button view-drafts-btn"
                onClick={async () => { setShowDraftModal(true); await loadDrafts(); }}
              >
                <FolderClock size={16} />
                Drafts ({drafts.length})
              </button>
              {draftsLoading && <span className="inline-note-spinner">Refreshing drafts...</span>}
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Billing items</h3>
                {billingLoading ? <p>Refreshing billing...</p> : null}
              </div>
              <div className="header-action-icons-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!billing?.items?.length || submitting}
                  onClick={handleSaveOrUpdateDraft}
                  title={billing?.billing_id ? 'Update Draft' : 'Save Draft'}
                  style={{ padding: '6px', minWidth: 'auto' }}
                >
                  <FolderClock size={16} />
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => billing && openBillingPrint(billing, currentStore, 'invoice', printSettings)}
                  disabled={!billing}
                  title="Print"
                  style={{ padding: '6px', minWidth: 'auto' }}
                >
                  <Printer size={16} />
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => billing && downloadBillingDocument(billing, 'invoice')}
                  disabled={!billing}
                  title="Download"
                  style={{ padding: '6px', minWidth: 'auto' }}
                >
                  <Download size={16} />
                </button>
              </div>
            </div>

            <div className="billing-items-list">
              {billing?.items?.length ? (
                billing.items.map((item) => (
                  <div className="billing-item-row" key={item.billing_item_id}>
                    <div className="billing-item-info">
                      <strong className="product-name">{item.product?.product_name}</strong>
                      <div className="vat-meta-wrapper">
                        <span className="vat-badge">
                          {item.vat_amount !== undefined && ` +${Number(item.vat_amount).toFixed(2)}`} (VAT)
                        </span>
                      </div>
                    </div>
                    <div className="billing-item-actions">
                      <div className="quantity-control">
                        <button type="button" className="icon-button"
                          onClick={() => updateItemQuantity(item, Number(item.quantity) - 1)} disabled={submitting}>
                          <Minus size={14} />
                        </button>
                        <span className="quantity-display">{item.quantity}</span>
                        <button type="button" className="icon-button"
                          onClick={() => updateItemQuantity(item, Number(item.quantity) + 1)} disabled={submitting}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong className="line-total">
                        {currency(getItemTotal(item), currentStore?.currency)}
                      </strong>
                      <button type="button" className="icon-button danger-icon"
                        onClick={() => removeItem(item.billing_item_id)} disabled={submitting}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Empty billing...hover over a product to add it.</p>
              )}
            </div>

            <div className="billing-summary-container">
              <div className="billing-summary-list">
                <div className="summary-row">
                  <span className="summary-label">Net Amount</span>
                  <span className="summary-value">{currency(billing?.subtotal || 0, currentStore?.currency)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">VAT ({Number(billing?.vat_rate || 16)}%)</span>
                  <span className="summary-value">{currency(billing?.vat_amount || 0, currentStore?.currency)}</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-row total-accent-row">
                  <span className="total-label">Total Amount</span>
                  <strong className="total-value">{currency(billing?.total || 0, currentStore?.currency)}</strong>
                </div>
              </div>
            </div>

            <div className="billing-bottom-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!billing?.items?.length || submitting}
                onClick={handleProceedToPayment}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Proceed to Payment
              </button>
            </div>
          </div>
        </aside>
      </section>

      {/* === PAYMENT MODAL (unchanged) === */}
      {showPaymentModal ? (
        <div className="modal-backdrop" onClick={() => !submitting && setShowPaymentModal(false)}>
          <div className="modal-card payment-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Payment</h3>
                <p className="muted">{billing?.invnumber || `Draft #${billing?.billing_id || ''}`}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowPaymentModal(false)} disabled={submitting}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-content payment-modal-content">
              <div className="payment-summary-strip">
                <div className="payment-summary-pill">
                  <span>Total due</span>
                  <strong>{currency(billing?.total || 0, currentStore?.currency)}</strong>
                </div>
                <div className="payment-summary-pill">
                  <span>Items</span>
                  <strong>{itemCount}</strong>
                </div>
                {selectedCustomerId ? (
                  <div className="payment-summary-pill">
                    <span>Customer</span>
                    <strong>{selectedCustomer?.full_name || 'Selected'}</strong>
                  </div>
                ) : null}
              </div>

              <div className="payment-method-card-grid">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.key}
                      type="button"
                      className={`payment-method-card ${paymentMethod === method.key ? 'active' : ''}`}
                      onClick={() => handlePaymentMethodChange(method.key)}
                    >
                      <div className="payment-method-card-top">
                        <span className="payment-method-icon"><Icon size={18} /></span>
                        <strong>{method.title}</strong>
                      </div>
                      <p>{method.description}</p>
                    </button>
                  );
                })}
              </div>

              {paymentMethod ? (
                <div className="payment-fields-card">
                  {paymentMethod === 'cash' ? (
                    <div className="form-grid two-columns payment-fields-grid">
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>
                          Amount to be paid
                          {selectedCustomer && customerCurrentBalance > 0 && (
                            <span style={{ color: '#2563eb', fontWeight: 'bold', marginLeft: '6px' }}>
                              ({`+${invoiceTotal.toFixed(2)} / +${customerCurrentBalance.toFixed(2)}`})
                            </span>
                          )}
                        </span>
                        <input className="text-input" type="number" min="0" step="0.01"
                          value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="Amount to be paid" />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>Cash received</span>
                        <input className="text-input" type="number" min="0" step="0.01"
                          value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)}
                          placeholder="Cash tendered" />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>Change</span>
                        <input className="text-input" type="text"
                          value={Number(balanceDue) >= 0 ? balanceDue : '0.00'}
                          readOnly placeholder="0.00"
                          style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }} />
                      </label>
                    </div>
                  ) : null}

                  {paymentMethod === 'mpesa' ? (
                    <div className="form-grid two-columns payment-fields-grid">
                      <label>Balance due
                        <input className="text-input" type="number" min="0" step="0.01"
                          value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="Amount to be paid" />
                      </label>
                      <label>MPESA phone number
                        <input className="text-input" type="text" value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)} placeholder="e.g. 07XXXXXXXX" />
                      </label>
                      <label className="span-2">MPESA transaction code
                        <input className="text-input" type="text" value={mpesaCode}
                          onChange={(e) => setMpesaCode(e.target.value)} placeholder="Enter transaction code" />
                      </label>
                    </div>
                  ) : null}

                  {paymentMethod === 'card' ? (
                    <div className="form-grid two-columns payment-fields-grid">
                      <label>Paid amount
                        <input className="text-input" type="number" min="0" step="0.01"
                          value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="Paid amount" />
                      </label>
                      <label>Card holder
                        <input className="text-input" type="text" value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)} placeholder="Card holder name" />
                      </label>
                      <label className="span-2">Card reference
                        <input className="text-input" type="text" value={cardReference}
                          onChange={(e) => setCardReference(e.target.value)} placeholder="POS slip or card reference" />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="payment-empty-state">
                  <p>Select a payment method to show the required fields.</p>
                </div>
              )}

              <div className="payment-modal-actions">
                <button type="button" className="primary-button" onClick={handleCharge}
                  disabled={!billing?.items?.length || submitting || !paymentMethod}>
                  Charge Payment
                </button>
                <button type="button" className="ghost-button" onClick={() => setShowPaymentModal(false)} disabled={submitting}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* === DRAFT MODAL (unchanged) === */}
      {showDraftModal ? (
        <div className="modal-backdrop" onClick={() => setShowDraftModal(false)}>
          <div className="modal-card draft-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Saved Drafts</h3>
                <p className="muted">Only your drafts for this store are shown</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowDraftModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="toolbar-row pos-toolbar-wrap" style={{ marginBottom: 12 }}>
              <div className="search-shell">
                <Search size={16} />
                <input value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)}
                  placeholder="Search drafts by invoice, customer, phone, email or note" />
              </div>
            </div>

            <div className="draft-modal-list">
              {draftsLoading ? (
                <div className="empty-draft-state"><p>Loading drafts...</p></div>
              ) : filteredDrafts.length ? (
                filteredDrafts.map((draft) => (
                  <div key={draft.billing_id}
                    className={`draft-modal-row ${String(billing?.billing_id) === String(draft.billing_id) ? 'active' : ''}`}>
                    <button type="button" className="draft-modal-row-main" onClick={() => handleLoadDraft(draft.billing_id)}>
                      <div className="draft-modal-main">
                        <strong>{draft.invnumber || `Draft #${draft.billing_id}`}</strong>
                        <p>{draft.customer?.full_name || 'Customer'}</p>
                        {draft.customer?.phone ? <small>{draft.customer.phone}</small> : null}
                        {draft.customer?.email ? <small>{draft.customer.email}</small> : null}
                        {draft.notes ? <span className="draft-note">{draft.notes}</span> : null}
                      </div>
                      <div className="align-right draft-side-meta">
                        <strong>{currency(draft.total || 0, currentStore?.currency)}</strong>
                        <p>{formatDateTime(draft.billing_date)}</p>
                      </div>
                    </button>
                    <div className="draft-modal-actions">
                      <button type="button" className="ghost-button draft-edit-button"
                        onClick={() => handleLoadDraft(draft.billing_id)} disabled={submitting}>
                        Edit
                      </button>
                      <button type="button" className="ghost-button danger-button"
                        onClick={() => handleDeleteDraft(draft.billing_id)} disabled={submitting}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-draft-state"><p>No drafts matched your search.</p></div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
