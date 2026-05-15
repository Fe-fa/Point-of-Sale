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
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { billingService } from '../../services/billingService';
import { categoryService } from '../../services/categoryService';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { currency, formatDateTime } from '../../utils/helpers';
import { openBillingPrint } from '../../utils/print';

const paymentMethods = [
  {
    key: 'cash',
    title: 'CASH',
    description: 'Receive cash and enter tendered amount',
    icon: Wallet,
  },
  {
    key: 'mpesa',
    title: 'MPESA',
    description: 'Enter phone number and transaction code',
    icon: Smartphone,
  },
  {
    key: 'card',
    title: 'CARD',
    description: 'Enter card reference',
    icon: CreditCard,
  },
];

const extractList = (res) => {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
};

const getProductImage = (product) =>
  product?.image_url ||
  product?.product_image ||
  product?.photo_url ||
  product?.thumbnail ||
  product?.image ||
  product?.photo ||
  product?.media?.[0]?.url ||
  '';

const getItemTotal = (item) =>
  Number(
    item?.total_amount ??
      item?.line_total ??
      item?.line_subtotal ??
      Number(item?.quantity || 0) * Number(item?.unit_price || 0)
  );

export default function CashierPosPage() {
  const { user } = useAuth();
  const { stores, storeId, loading: storeLoading } = useStore();

  const currentStore = stores.find((store) => String(store.store_id) === String(storeId));

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [drafts, setDrafts] = useState([]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

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
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwnedByCurrentCashier = (record) => {
    if (!user?.user_id) return true;
    const ownerId = record?.user_id || record?.user?.user_id || record?.user?.id;
    if (!ownerId) return true;
    return String(ownerId) === String(user.user_id);
  };

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

      if (!billingRecord.is_draft) {
        return withoutCurrent;
      }

      return [billingRecord, ...withoutCurrent].sort(
        (a, b) => Number(b.billing_id || 0) - Number(a.billing_id || 0)
      );
    });
  };

  const removeDraftPreview = (billingId) => {
    setDrafts((prev) => prev.filter((item) => String(item.billing_id) !== String(billingId)));
  };

  const deleteBillingRecord = async (billingId) => {
    if (typeof billingService.destroy === 'function') {
      return billingService.destroy(billingId);
    }

    if (typeof billingService.delete === 'function') {
      return billingService.delete(billingId);
    }

    if (typeof billingService.remove === 'function') {
      return billingService.remove(billingId);
    }

    throw new Error('Delete billing method is not implemented in billingService.');
  };

  const loadStaticData = async () => {
    setCatalogLoading(true);
    setError('');

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API request timeout after 10 seconds')), 10000)
      );

      const apiCall = Promise.all([
        categoryService.list({ per_page: 50 }),
        productService.list({ per_page: 200, is_active: true }),
        customerService.list({ per_page: 100 }),
      ]);

      const [categoriesRes, productsRes, customersRes] = await Promise.race([
        apiCall,
        timeoutPromise,
      ]);

      setCategories(extractList(categoriesRes));
      setProducts(extractList(productsRes));
      setCustomers(extractList(customersRes));
    } catch (err) {
      setError(
        `Failed to load catalog: ${
          err?.response?.data?.message || err?.message || 'Unknown error'
        }`
      );
      setCategories([]);
      setProducts([]);
      setCustomers([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadDrafts = async ({ silent = false } = {}) => {
    if (!storeId) return;

    if (!silent) setDraftsLoading(true);

    try {
      const response = await billingService.list({ per_page: 100, is_draft: true });
      const data = extractList(response);

      const filtered = (Array.isArray(data) ? data : []).filter(
        (item) =>
          String(item.store_id) === String(storeId) &&
          isOwnedByCurrentCashier(item)
      );

      setDrafts(filtered);
    } catch (err) {
      if (!silent) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load drafts.');
      }
      setDrafts([]);
    } finally {
      if (!silent) setDraftsLoading(false);
    }
  };

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

  useEffect(() => {
    if (!storeId) return;

    resetSale();

    const bootstrap = async () => {
      await Promise.allSettled([loadStaticData(), loadDrafts()]);
    };

    bootstrap();
  }, [storeId]);

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
    mergeDraftPreview(updatedBilling);
    return updatedBilling;
  };

  const handleAddProduct = async (product) => {
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await addOrIncrementProduct(product);
      setSuccess(`${product.product_name} added to billing.`);
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
    setError('');
    setSuccess('');
    setSubmitting(true);

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

    if (nextQuantity < 1) {
      return removeItem(item.billing_item_id);
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await billingService.updateItem(item.billing_item_id, {
        quantity: nextQuantity,
        unit_price: item.unit_price,
      });

      const updatedBilling = await loadBillingDetail(billing.billing_id, { silent: true });
      mergeDraftPreview(updatedBilling);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to update quantity.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeItem = async (billingItemId) => {
    if (!billing?.billing_id) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await billingService.removeItem(billingItemId);
      const updatedBilling = await loadBillingDetail(billing.billing_id, { silent: true });
      mergeDraftPreview(updatedBilling);
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

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const updatedBilling = await persistDraftHeader();
      mergeDraftPreview(updatedBilling);

      setSuccess(
        updatedBilling?.billing_id
          ? `Draft #${updatedBilling.billing_id} updated successfully.`
          : 'Draft saved successfully.'
      );

      setShowDraftModal(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to save draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!billing?.items?.length) return;

    setError('');
    setSuccess('');

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

    if (method !== 'cash') {
      setAmountTendered('');
    }
  };

  const validatePayment = () => {
    if (!paymentMethod) {
      setError('Please select a payment method.');
      return false;
    }

    if (!amountReceived || Number(amountReceived) <= 0) {
      setError('Please enter a valid amount received.');
      return false;
    }

    if (paymentMethod === 'cash') {
      if (amountTendered && Number(amountTendered) < Number(amountReceived)) {
        setError('Cash tendered cannot be less than amount received.');
        return false;
      }
    }

    if (paymentMethod === 'mpesa') {
      if (!mpesaPhone.trim()) {
        setError('Please enter MPESA phone number.');
        return false;
      }
      if (!mpesaCode.trim()) {
        setError('Please enter MPESA transaction code.');
        return false;
      }
    }

    if (paymentMethod === 'card') {
      if (!cardReference.trim()) {
        setError('Please enter card reference.');
        return false;
      }
    }

    return true;
  };

  const handleCharge = async () => {
    if (!billing?.billing_id || !billing?.items?.length) return;
    if (!validatePayment()) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

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
        mpesa_code: paymentMethod === 'mpesa' ? mpesaCode : null,
        card_reference: paymentMethod === 'card' ? cardReference : null,
        card_holder: paymentMethod === 'card' ? cardHolder || null : null,
      });

      const paidResponse = await billingService.show(billing.billing_id);
      const paidBilling = paidResponse?.data || paidResponse;

      openBillingPrint(paidBilling, currentStore, 'receipt');

      removeDraftPreview(billing.billing_id);
      resetSale();
      setShowPaymentModal(false);
      setSuccess('Payment processed successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to process payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadDraft = async (draftId) => {
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await loadBillingDetail(draftId);
      setShowDraftModal(false);
      setShowPaymentModal(false);
      setSuccess('Draft loaded successfully. You can now edit and update it.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDraft = async (draftId) => {
    const confirmed = window.confirm('Delete this draft permanently?');
    if (!confirmed) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await deleteBillingRecord(draftId);

      if (String(billing?.billing_id) === String(draftId)) {
        resetSale();
      }

      removeDraftPreview(draftId);
      setSuccess('Draft deleted successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to delete draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'all' || String(product.category_id) === String(activeCategory);

      const keyword = search.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        product?.product_name?.toLowerCase().includes(keyword) ||
        product?.sku?.toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  const itemCount =
    billing?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;

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
              <p>Welcome to the Point of Sale Service Center</p>
            </div>
          </div>

          <div className="card">
            <p>
              <strong>No stores assigned</strong>
            </p>
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
            <div>
              <span className="eyebrow">Cashier</span>
              <h2>{currentStore?.store_name || 'Fortune Supermarket'}</h2>
              <p>Quality Service.</p>
            </div>
          </div>

          <div className="toolbar-row pos-toolbar-wrap">
            <div className="search-shell">
              <Search size={16} />
              <input
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
                  className={`chip ${
                    String(activeCategory) === String(category.category_id) ? 'active' : ''
                  }`}
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
              {error ? <div className="form-error">{error}</div> : null}
              {success ? <div className="form-success">{success}</div> : null}

              <div className="products-grid products-grid-enhanced">
                {filteredProducts.map((product) => {
                  const image = getProductImage(product);

                  return (
                    <article
                      key={product.product_id}
                      className="product-card product-card-image"
                      style={{
                        backgroundImage: image
                          ? `linear-gradient(180deg, rgba(3, 7, 18, 0.08) 0%, rgba(3, 7, 18, 0.82) 100%), url(${image})`
                          : 'linear-gradient(135deg, #1e1b4b 0%, #5b21b6 52%, #f59e0b 100%)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="product-card-overlay">
                        <div className="product-card-meta">
                          <span className="product-category badge-on-image">
                            {product.category?.category_name || 'Product'}
                          </span>
                        </div>

                        <div className="product-card-info">
                          <h3>{product.product_name}</h3>
                          <strong>{currency(product.price, currentStore?.currency)}</strong>
                        </div>

                        <div className="product-card-actions">
                          <button
                            type="button"
                            className="primary-button"
                            disabled={submitting}
                            onClick={() => handlePayNow(product)}
                          >
                            <Wallet size={16} />
                            Pay
                          </button>

                          <button
                            type="button"
                            className="ghost-button product-add-button"
                            disabled={submitting}
                            onClick={() => handleAddProduct(product)}
                          >
                            <ShoppingCart size={16} />
                            Add
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {!filteredProducts.length ? (
                  <div className="card">
                    <p>No products matched your search.</p>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <aside className="billing-panel stack-md">
          <div className="card">
            <div className="card-header">
              <div>
                <h3>Current billing</h3>
                <p>
                  {billing
                    ? billing.invnumber || `Draft #${billing.billing_id}`
                    : 'No active billing yet'}
                </p>
              </div>

              <div className="cart-badge">
                <ShoppingCart size={16} />
                {itemCount} items
              </div>
            </div>

            <div className="hero-quick-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={async () => {
                  setShowDraftModal(true);
                  await loadDrafts();
                }}
              >
                <FolderClock size={16} />
                Drafts ({drafts.length})
              </button>

              {draftsLoading ? <span className="muted inline-note">Refreshing drafts...</span> : null}
            </div>

            <div className="form-grid">
              <label>
                Customer
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
              {/* <label>
                Notes 
                <textarea
                  className="text-input textarea-input"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note for this bill or draft..."
                />
              </label> */}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3>Billing items</h3>
                {billingLoading ? <p>Refreshing billing...</p> : null}
              </div>
            </div>

            <div className="billing-items-list">
              {billing?.items?.length ? (
                billing.items.map((item) => (
                  <div className="billing-item-row" key={item.billing_item_id}>
                    <div>
                      <strong>{item.product?.product_name}</strong>
                      <p>{currency(item.unit_price, currentStore?.currency)} each</p>
                    </div>

                    <div className="billing-item-actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => updateItemQuantity(item, Number(item.quantity) - 1)}
                        disabled={submitting}
                      >
                        <Minus size={14} />
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => updateItemQuantity(item, Number(item.quantity) + 1)}
                        disabled={submitting}
                      >
                        <Plus size={14} />
                      </button>

                      <strong>{currency(getItemTotal(item), currentStore?.currency)}</strong>

                      <button
                        type="button"
                        className="icon-button danger-icon"
                        onClick={() => removeItem(item.billing_item_id)}
                        disabled={submitting}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Add products to start billing.</p>
              )}
            </div>

            <div className="billing-summary-grid">
                <div className="summary-box accent">
                <span>Total</span>
                <strong>{currency(billing?.total || 0, currentStore?.currency)}</strong>
              </div>
              <div className="summary-box">
                <span>VAT</span>
                <strong>{currency(billing?.vat_amount || 0, currentStore?.currency)}</strong>
              </div>

              <div className="summary-box">
                <span>Paid</span>
                <strong>{currency(billing?.paid_amount || 0, currentStore?.currency)}</strong>
              </div>
               <div className="summary-box">
                <span>Subtotal</span>
                <strong>{currency(billing?.subtotal || 0, currentStore?.currency)}</strong>
              </div>
            </div>

            <div className="billing-bottom-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={!billing?.items?.length || submitting}
                onClick={handleSaveOrUpdateDraft}
              >
                <FolderClock size={16} />
                {billing?.billing_id ? 'Save' : 'Update'}
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={!billing?.items?.length || submitting}
                onClick={handleProceedToPayment}
              >
                <CreditCard size={16} />
                Proceed to Payment
              </button>

              <button
                type="button"
                className="ghost-button"
                onClick={() => billing && openBillingPrint(billing, currentStore, 'invoice')}
                disabled={!billing}
              >
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>
        </aside>
      </section>

      {showPaymentModal ? (
        <div className="modal-backdrop" onClick={() => !submitting && setShowPaymentModal(false)}>
          <div className="modal-card payment-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Payment</h3>
                <p className="muted">
                  {billing?.invnumber || `Draft #${billing?.billing_id || ''}`}
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPaymentModal(false)}
                disabled={submitting}
              >
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
                    <strong>
                      {customers.find(
                        (customer) =>
                          String(customer.customer_id) === String(selectedCustomerId)
                      )?.full_name || 'Selected'}
                    </strong>
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
                      className={`payment-method-card ${
                        paymentMethod === method.key ? 'active' : ''
                      }`}
                      onClick={() => handlePaymentMethodChange(method.key)}
                    >
                      <div className="payment-method-card-top">
                        <span className="payment-method-icon">
                          <Icon size={18} />
                        </span>
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
                      <label>
                        Amount received
                        <input
                          className="text-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="Amount received"
                        />
                      </label>

                      <label>
                        Cash tendered
                        <input
                          className="text-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountTendered}
                          onChange={(e) => setAmountTendered(e.target.value)}
                          placeholder="Cash tendered"
                        />
                      </label>
                    </div>
                  ) : null}

                  {paymentMethod === 'mpesa' ? (
                    <div className="form-grid two-columns payment-fields-grid">
                      <label>
                        Amount received
                        <input
                          className="text-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="Amount received"
                        />
                      </label>

                      <label>
                        MPESA phone number
                        <input
                          className="text-input"
                          type="text"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          placeholder="e.g. 07XXXXXXXX"
                        />
                      </label>

                      <label className="span-2">
                        MPESA transaction code
                        <input
                          className="text-input"
                          type="text"
                          value={mpesaCode}
                          onChange={(e) => setMpesaCode(e.target.value)}
                          placeholder="Enter transaction code"
                        />
                      </label>
                    </div>
                  ) : null}

                  {paymentMethod === 'card' ? (
                    <div className="form-grid two-columns payment-fields-grid">
                      <label>
                        Paid amount
                        <input
                          className="text-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          placeholder="Paid amount"
                        />
                      </label>

                      <label>
                        Card holder
                        <input
                          className="text-input"
                          type="text"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          placeholder="Card holder name"
                        />
                      </label>

                      <label className="span-2">
                        Card reference
                        <input
                          className="text-input"
                          type="text"
                          value={cardReference}
                          onChange={(e) => setCardReference(e.target.value)}
                          placeholder="POS slip or card reference"
                        />
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
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCharge}
                  disabled={!billing?.items?.length || submitting || !paymentMethod}
                >
                  Charge Payment
                </button>

                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDraftModal ? (
        <div className="modal-backdrop" onClick={() => setShowDraftModal(false)}>
          <div className="modal-card draft-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Saved Drafts</h3>
                <p className="muted">Only your drafts for this store are shown</p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => setShowDraftModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="draft-modal-list">
              {draftsLoading ? (
                <div className="empty-draft-state">
                  <p>Loading drafts...</p>
                </div>
              ) : drafts.length ? (
                drafts.map((draft) => (
                  <div
                    key={draft.billing_id}
                    className={`draft-modal-row ${
                      String(billing?.billing_id) === String(draft.billing_id) ? 'active' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="draft-modal-row-main"
                      onClick={() => handleLoadDraft(draft.billing_id)}
                    >
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
                      <button
                        type="button"
                        className="ghost-button draft-edit-button"
                        onClick={() => handleLoadDraft(draft.billing_id)}
                        disabled={submitting}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="ghost-button danger-button"
                        onClick={() => handleDeleteDraft(draft.billing_id)}
                        disabled={submitting}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-draft-state">
                  <p>No open drafts right now.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
