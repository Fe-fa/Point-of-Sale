import { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  CreditCard,
  Hash,
  Eye,
  CheckCircle2,
  Settings2,
  FileText,
  Layers,
  Package,
  DollarSign,
  Sliders,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { storeService } from '../../services/storeService';
import { mergeStoreSettings } from '../../utils/storeSettings';

const PRINT_OPTIONS = [
  ['show_barcode', 'Show barcode on receipt / invoice'],
  ['show_qrcode', 'Show QR code on receipt / invoice'],
  ['show_vat_summary', 'Show VAT summary table on print'],
  ['show_logo_on_print', 'Show store logo on print'],
  ['show_store_contacts_on_print', 'Show store contacts on print'],
  ['show_store_pin_on_print', 'Show store PIN on print'],
  ['show_customer_on_print', 'Show customer on print'],
  ['show_cashier_on_print', 'Show cashier on print'],
  ['show_payment_method_on_print', 'Show payment method on receipt / invoice'],
];

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: Sliders },
  { key: 'register', label: 'Register Control', icon: Settings2 },
  { key: 'print', label: 'Print & Display', icon: Printer },
  { key: 'operations', label: 'Operations', icon: Layers },
  { key: 'accounting', label: 'Accounting', icon: DollarSign },
];

const SEQUENCE_ROWS = [
  { type: 'Receipt', key: 'receipt', icon: FileText, section: 'receiptSequence', placeholder: 'REC-' },
  { type: 'Invoice', key: 'invoice', icon: FileText, section: 'invoiceSequence', placeholder: 'INV-' },
  { type: 'Order', key: 'order', icon: Package, section: 'orderSequence', placeholder: 'ORD-' },
  { type: 'Packing Slip', key: 'packing_slip', icon: Layers, section: 'packingSequence', placeholder: 'PKG-' },
];

const SECTION_KEYS = [
  'general',
  'printContent',
  'printMessages',
  'receiptSequence',
  'invoiceSequence',
  'orderSequence',
  'packingSequence',
  'payment',
  'productDisplay',
  'advanced',
];

const emptySectionState = () =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = { saving: false, message: '', error: '' };
    return acc;
  }, {});

const extractApiData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

const normalizeNullableText = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const buildSequencePreview = (sequence = {}, fallbackPrefix = 'DOC-') => {
  const prefix = sequence?.prefix || fallbackPrefix;
  const suffix = sequence?.suffix || '';
  const start = Math.max(1, Number(sequence?.last_number || 0) - 1);
  const preview = Array.from({ length: 4 }, (_, index) => `${prefix}${start + index}${suffix}`);
  return preview.join(', ');
};

const buildReceiptPreviewRows = (layout) => {
  if (layout === 'compact') {
    return [
      ['Bread', '1', '$2.50'],
      ['Milk', '1', '$1.80'],
    ];
  }

  if (layout === 'detailed') {
    return [
      ['Bread (VAT incl.)', '1', '$2.50'],
      ['Milk 500ml', '1', '$1.80'],
      ['Loyalty Discount', '1', '-$0.30'],
    ];
  }

  return [
    ['Bread', '1', '$2.50'],
    ['Milk', '1', '$1.80'],
    ['Juice', '1', '$3.00'],
  ];
};

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { stores, storeId, activeStore } = useStore();

  const currentStore = useMemo(
    () => activeStore || stores.find((store) => String(store.store_id) === String(storeId)),
    [activeStore, stores, storeId]
  );

  const [form, setForm] = useState(mergeStoreSettings());
  const [loadError, setLoadError] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [sections, setSections] = useState(emptySectionState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [printerSubTab, setPrinterSubTab] = useState('layout');
  const [sequenceSubTab, setSequenceSubTab] = useState('numbering');
  const [showConsumerKey, setShowConsumerKey] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    document.documentElement.classList.toggle('spacious-ui', !!form.spacious_layout);
    return () => document.documentElement.classList.remove('spacious-ui');
  }, [form.spacious_layout]);

  useEffect(() => {
    if (!currentStore?.store_id) {
      setForm(mergeStoreSettings());
      setLoadError('');
      setSections(emptySectionState());
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      setLoadingSettings(true);
      setLoadError('');
      setSections(emptySectionState());

      try {
        const response = await storeService.getSettings(currentStore.store_id);
        if (cancelled) return;
        setForm(mergeStoreSettings(extractApiData(response)));
      } catch (err) {
        if (cancelled) return;
        setForm(mergeStoreSettings(currentStore));
        setLoadError(err?.response?.data?.message || 'Unable to load store settings.');
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    };

    loadSettings();
    return () => { cancelled = true; };
  }, [currentStore]);

  const patchSectionState = (keys, patch) => {
    const list = Array.isArray(keys) ? keys : [keys];
    setSections((prev) => {
      const next = { ...prev };
      list.forEach((key) => {
        next[key] = { ...next[key], ...patch };
      });
      return next;
    });
  };

  const updateField = (sectionKey, key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    patchSectionState(sectionKey, { message: '', error: '' });
  };

  const updateSequenceField = (sectionKey, documentType, key, value) => {
    setForm((prev) => ({
      ...prev,
      document_sequences: {
        ...prev.document_sequences,
        [documentType]: {
          ...(prev.document_sequences?.[documentType] || {}),
          [key]: value,
        },
      },
    }));
    patchSectionState(sectionKey, { message: '', error: '' });
  };

  const updatePaymentField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      mpesa: {
        ...(prev.mpesa || {}),
        [key]: value,
      },
    }));
    patchSectionState('payment', { message: '', error: '' });
  };

  const persistSections = async (sectionKeys, payload) => {
    if (!currentStore?.store_id) {
      patchSectionState(sectionKeys, { error: 'Please select a store first.' });
      return false;
    }

    patchSectionState(sectionKeys, { saving: true, message: '', error: '' });

    try {
      const response = await storeService.updateSettings(currentStore.store_id, payload);
      setForm(mergeStoreSettings(extractApiData(response)));
      patchSectionState(sectionKeys, { saving: false, message: 'Saved successfully.', error: '' });
      return true;
    } catch (err) {
      patchSectionState(sectionKeys, {
        saving: false,
        message: '',
        error: err?.response?.data?.message || 'Unable to save these settings.',
      });
      return false;
    }
  };

  const buildCoreSettings = () => ({
    default_vat_rate: Number(form.default_vat_rate || 0),
    low_stock_alert: Number(form.low_stock_alert || 0),
    paper_width: Number(form.paper_width || 80),
    print_delay_ms: Number(form.print_delay_ms || 0),
    show_product_images: !!form.show_product_images,
    spacious_layout: !!form.spacious_layout,
    receipt_layout: form.receipt_layout || 'default',
    receipt_header: form.receipt_header || '',
    invoice_header: form.invoice_header || '',
    receipt_footer: form.receipt_footer || '',
    invoice_footer: form.invoice_footer || '',
    ...PRINT_OPTIONS.reduce((acc, [key]) => {
      acc[key] = !!form[key];
      return acc;
    }, {}),
  });

  const buildPaymentPayload = () => {
    const mpesa = {
      enabled: !!form.mpesa?.enabled,
      environment: form.mpesa?.environment === 'production' ? 'production' : 'sandbox',
      shortcode_type: form.mpesa?.shortcode_type === 'till' ? 'till' : 'paybill',
      shortcode: normalizeNullableText(form.mpesa?.shortcode),
      till_number: normalizeNullableText(form.mpesa?.till_number),
      callback_base_url: normalizeNullableText(form.mpesa?.callback_base_url),
      account_reference_prefix: normalizeNullableText(form.mpesa?.account_reference_prefix),
    };

    ['consumer_key', 'consumer_secret', 'passkey'].forEach((key) => {
      const value = String(form.mpesa?.[key] ?? '').trim();
      if (value) mpesa[key] = value;
    });

    return mpesa;
  };

  const handleSaveAll = () =>
    persistSections(
      ['general', 'payment', 'productDisplay', 'advanced', 'receiptSequence', 'invoiceSequence', 'orderSequence', 'packingSequence'],
      {
        settings: buildCoreSettings(),
        document_sequences: form.document_sequences,
        mpesa: buildPaymentPayload(),
      }
    );

  const handleRevertDefaults = () => {
    if (!window.confirm('Revert the settings form back to defaults? Unsaved changes will be lost.')) return;
    setForm(mergeStoreSettings());
    setSections(emptySectionState());
  };

  const handleGeneralSubmit = (event) => {
    event.preventDefault();
    persistSections('general', {
      settings: {
        paper_width: Number(form.paper_width || 80),
        print_delay_ms: Number(form.print_delay_ms || 0),
        receipt_layout: form.receipt_layout || 'default',
      },
    });
  };

  const handlePrintContentSubmit = (event) => {
    event.preventDefault();
    persistSections('printContent', {
      settings: PRINT_OPTIONS.reduce((acc, [key]) => {
        acc[key] = !!form[key];
        return acc;
      }, {}),
    });
  };

  const handlePrintMessagesSubmit = (event) => {
    event.preventDefault();
    persistSections('printMessages', {
      settings: {
        receipt_header: form.receipt_header || '',
        invoice_header: form.invoice_header || '',
        receipt_footer: form.receipt_footer || '',
        invoice_footer: form.invoice_footer || '',
      },
    });
  };

  const handleSequenceSubmit = (sectionKey, documentType) => (event) => {
    event.preventDefault();
    persistSections(sectionKey, {
      document_sequences: {
        [documentType]: form.document_sequences?.[documentType] || {},
      },
    });
  };

  const handlePaymentSubmit = (event) => {
    event.preventDefault();
    persistSections('payment', { mpesa: buildPaymentPayload() });
  };

  const saveProductDisplay = () =>
    persistSections('productDisplay', {
      settings: {
        show_product_images: !!form.show_product_images,
      },
    });

  const saveAdvanced = () =>
    persistSections('advanced', {
      settings: {
        default_vat_rate: Number(form.default_vat_rate || 0),
        low_stock_alert: Number(form.low_stock_alert || 0),
        spacious_layout: !!form.spacious_layout,
      },
    });

  const receiptPreviewRows = buildReceiptPreviewRows(form.receipt_layout);
  const currentDate = new Date();
  const previewDate = currentDate.toLocaleDateString('en-GB');
  const previewTime = currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (!isAdmin) {
    return (
      <section className="stack-lg admin-settings-page">
        <article className="card settings-empty-state">
          <div className="section-header">
            <div>
              <h2>Admin settings</h2>
              <p>Only system administrators can update POS system settings.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  if (!currentStore) {
    return (
      <section className="stack-lg admin-settings-page">
        <article className="card settings-empty-state">
          <div className="section-header">
            <div>
              <h2>Admin settings</h2>
              <p>Select a store to configure POS settings.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="stack-lg admin-settings-page pos-settings-shell">
      <header className="pos-settings-header">
        <div>
          <h2 className="pos-settings-title">
            POS Settings — <span>{currentStore?.store_name || 'Store'}</span>
          </h2>
          <p className="pos-settings-sub">
            Configure printer, payments, document numbering and display preferences for this store.
          </p>
        </div>
        {loadingSettings ? <span className="badge muted">Loading settings…</span> : null}
      </header>

      <nav className="pos-tabs" role="tablist" aria-label="POS Settings tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              className={`pos-tab ${isActive ? 'pos-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {loadError ? <p className="form-error">{loadError}</p> : null}

      {activeTab === 'dashboard' && (
        <div className="pos-settings-grid">
          <div className="pos-settings-col">
            <article className="pos-card">
              <header className="pos-card__header">
                <div className="pos-card__title-wrap">
                  <Printer size={18} className="pos-card__icon" />
                  <div>
                    <h3>Printer Configuration</h3>
                    <p className="pos-card__meta">Receipt layout, paper width and print delay</p>
                  </div>
                </div>
              </header>

              <div className="pos-subtabs">
                <button
                  type="button"
                  className={`pos-subtab ${printerSubTab === 'layout' ? 'pos-subtab--active' : ''}`}
                  onClick={() => setPrinterSubTab('layout')}
                >
                  Printer &amp; Layout
                </button>
                <button
                  type="button"
                  className={`pos-subtab ${printerSubTab === 'active' ? 'pos-subtab--active' : ''}`}
                  onClick={() => setPrinterSubTab('active')}
                >
                  Active Layout
                </button>
              </div>

              {printerSubTab === 'layout' && (
                <form className="pos-card__body" onSubmit={handleGeneralSubmit}>
                  <div className="pos-status-row">
                    <div className="pos-field-label">Printing Status</div>
                    <div className="pos-status-pill">
                      <span className="pos-status-pill__dot" />
                      <strong>Ready for browser / system print</strong>
                      <span className="pos-status-pill__tag">Connected</span>
                    </div>
                  </div>

                  <label className="pos-field">
                    <span>Print Delay (ms)</span>
                    <input
                      className="text-input"
                      type="number"
                      min="0"
                      step="50"
                      value={form.print_delay_ms || 300}
                      onChange={(e) => updateField('general', 'print_delay_ms', Number(e.target.value))}
                      disabled={loadingSettings || sections.general.saving}
                    />
                  </label>

                  <div className="pos-field">
                    <span>Paper Width</span>
                    <div className="pos-segmented">
                      {[
                        { v: 80, l: '80mm' },
                        { v: 58, l: '58mm' },
                      ].map((opt) => (
                        <button
                          key={opt.l}
                          type="button"
                          className={`pos-segmented__btn ${Number(form.paper_width) === opt.v ? 'pos-segmented__btn--active' : ''}`}
                          onClick={() => updateField('general', 'paper_width', opt.v)}
                          disabled={loadingSettings || sections.general.saving}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="pos-field">
                    <span>Receipt Layout</span>
                    <div className="pos-inline-row">
                      <select
                        className="select-input"
                        value={form.receipt_layout || 'default'}
                        onChange={(e) => updateField('general', 'receipt_layout', e.target.value)}
                        disabled={loadingSettings || sections.general.saving}
                      >
                        <option value="default">Default</option>
                        <option value="compact">Compact</option>
                        <option value="detailed">Detailed</option>
                      </select>
                    </div>
                  </label>

                  <div className="pos-receipt-preview">
                    <div className={`pos-receipt-preview__paper pos-receipt-preview__paper--${form.receipt_layout || 'default'}`}>
                      <div className="pos-receipt-preview__header">
                        <strong>{currentStore?.store_name || 'Store'}</strong>
                        {form.receipt_header ? <div className="pos-receipt-preview__note">{form.receipt_header}</div> : null}
                        <div className="pos-receipt-preview__meta">
                          Date: {previewDate}<br />
                          Time: {previewTime}<br />
                          Cashier: Demo User
                        </div>
                      </div>
                      <div className="pos-receipt-preview__divider" />
                      <div className="pos-receipt-preview__row pos-receipt-preview__row--head">
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Total</span>
                      </div>
                      <div className="pos-receipt-preview__divider" />
                      {receiptPreviewRows.map((row) => (
                        <div key={row.join('-')} className="pos-receipt-preview__row">
                          <span>{row[0]}</span>
                          <span>{row[1]}</span>
                          <span>{row[2]}</span>
                        </div>
                      ))}
                      <div className="pos-receipt-preview__divider" />
                      <div className="pos-receipt-preview__row pos-receipt-preview__row--foot">
                        <span>Total</span>
                        <span />
                        <span>$7.30</span>
                      </div>
                      {form.receipt_footer ? <div className="pos-receipt-preview__footer">{form.receipt_footer}</div> : null}
                    </div>
                  </div>

                  {sections.general.error ? <p className="form-error">{sections.general.error}</p> : null}
                  {sections.general.message ? <p className="form-success">{sections.general.message}</p> : null}
                  <div className="row-actions">
                    <button className="primary-button" type="submit" disabled={sections.general.saving || loadingSettings}>
                      {sections.general.saving ? 'Saving…' : 'Save Printer Settings'}
                    </button>
                  </div>
                </form>
              )}

              {printerSubTab === 'active' && (
                <div className="pos-card__body">
                  <div className="pos-soft-panel">
                    <p className="pos-soft-panel__title">Current Layout</p>
                    <p className="pos-soft-panel__text">
                      {form.receipt_layout === 'compact'
                        ? 'Compact receipt optimized for small thermal paper.'
                        : form.receipt_layout === 'detailed'
                          ? 'Detailed receipt with richer line item context.'
                          : 'Default balanced receipt layout.'}
                    </p>
                    <div className="pos-pill-row">
                      <span className="pos-mini-pill">{Number(form.paper_width) || 80}mm paper</span>
                      <span className="pos-mini-pill">{Number(form.print_delay_ms) || 0}ms delay</span>
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="pos-card">
              <header className="pos-card__header">
                <div className="pos-card__title-wrap">
                  <CreditCard size={18} className="pos-card__icon" />
                  <div>
                    <h3>Payment Methods</h3>
                    <p className="pos-card__meta">Per-store M-Pesa credentials and environment</p>
                  </div>
                </div>
              </header>

              <div className="pos-subtabs">
                <button type="button" className="pos-subtab pos-subtab--active">
                  Payment Services
                </button>
              </div>

              <form className="pos-card__body" onSubmit={handlePaymentSubmit}>
                <div className="pos-mpesa-header">
                  <div>
                    <h4 className="pos-mpesa-title">
                      M-Pesa Integration <span className="pos-muted">(Store-level override)</span>
                    </h4>
                  </div>
                  <div className="pos-mpesa-badge">M<span>PESA</span></div>
                </div>

                <div className="pos-two-col">
                  <div>
                    <div className="pos-field-label">Status &amp; Environment</div>
                    <label className="pos-switch-row">
                      <div className="pos-switch">
                        <input
                          type="checkbox"
                          checked={!!form.mpesa?.enabled}
                          onChange={(e) => updatePaymentField('enabled', e.target.checked)}
                          disabled={loadingSettings || sections.payment.saving}
                        />
                        <span className="pos-switch__slider" />
                      </div>
                      <span>Enable M-Pesa Payments</span>
                    </label>
                  </div>
                  <div>
                    <div className="pos-field-label">Environment</div>
                    <div className="pos-segmented">
                      {['sandbox', 'production'].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`pos-segmented__btn ${(form.mpesa?.environment || 'sandbox') === mode ? 'pos-segmented__btn--active' : ''}`}
                          onClick={() => updatePaymentField('environment', mode)}
                          disabled={loadingSettings || sections.payment.saving}
                        >
                          {mode === 'sandbox' ? 'Sandbox' : 'Production'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pos-two-col">
                  <label className="pos-field">
                    <span>Shortcode Type</span>
                    <select
                      className="select-input"
                      value={form.mpesa?.shortcode_type || 'paybill'}
                      onChange={(e) => updatePaymentField('shortcode_type', e.target.value)}
                      disabled={loadingSettings || sections.payment.saving}
                    >
                      <option value="paybill">Paybill</option>
                      <option value="till">Till</option>
                    </select>
                  </label>

                  <div>
                    <div className="pos-field-label">M-Pesa Till Preview</div>
                    <div className="pos-till-card">
                      <div className="pos-till-card__logo">M<span>PESA</span></div>
                      <div className="pos-till-card__body">
                        <strong>{(currentStore?.store_name || 'STORE').toUpperCase()}</strong>
                        <span>
                          {form.mpesa?.shortcode_type === 'till' ? 'Till' : 'Shortcode'}: {form.mpesa?.till_number || form.mpesa?.shortcode || 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pos-two-col">
                  <label className="pos-field">
                    <span>Shortcode</span>
                    <input
                      className="text-input"
                      type="text"
                      value={form.mpesa?.shortcode || ''}
                      onChange={(e) => updatePaymentField('shortcode', e.target.value)}
                      disabled={loadingSettings || sections.payment.saving}
                    />
                    <small className="pos-help">Leave blank to use the global backend default.</small>
                  </label>
                  <label className="pos-field">
                    <span>Till Number</span>
                    <input
                      className="text-input"
                      type="text"
                      value={form.mpesa?.till_number || ''}
                      onChange={(e) => updatePaymentField('till_number', e.target.value)}
                      disabled={loadingSettings || sections.payment.saving}
                    />
                    <small className="pos-help">Only required when shortcode type is set to till.</small>
                  </label>
                </div>

                <div className="pos-field-label pos-field-label--section">
                  Credentials <span className="pos-muted">(Saved encrypted in the backend)</span>
                </div>

                <div className="pos-two-col">
                  <label className="pos-field">
                    <span>Consumer Key</span>
                    <div className="password-field">
                      <input
                        className="text-input"
                        type={showConsumerKey ? 'text' : 'password'}
                        value={form.mpesa?.consumer_key || ''}
                        onChange={(e) => updatePaymentField('consumer_key', e.target.value)}
                        placeholder={form.mpesa?.consumer_key_set ? 'Saved — enter new value to replace' : 'Enter consumer key'}
                        disabled={loadingSettings || sections.payment.saving}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConsumerKey((state) => !state)}
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </label>

                  <label className="pos-field">
                    <span>Consumer Secret</span>
                    <div className="password-field">
                      <input
                        className="text-input"
                        type={showConsumerSecret ? 'text' : 'password'}
                        value={form.mpesa?.consumer_secret || ''}
                        onChange={(e) => updatePaymentField('consumer_secret', e.target.value)}
                        placeholder={form.mpesa?.consumer_secret_set ? 'Saved — enter new value to replace' : 'Enter consumer secret'}
                        disabled={loadingSettings || sections.payment.saving}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConsumerSecret((state) => !state)}
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </label>
                </div>

                <div className="pos-two-col">
                  <label className="pos-field">
                    <span>Passkey</span>
                    <div className="password-field">
                      <input
                        className="text-input"
                        type={showPasskey ? 'text' : 'password'}
                        value={form.mpesa?.passkey || ''}
                        onChange={(e) => updatePaymentField('passkey', e.target.value)}
                        placeholder={form.mpesa?.passkey_set ? 'Saved — enter new value to replace' : 'Enter passkey'}
                        disabled={loadingSettings || sections.payment.saving}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPasskey((state) => !state)}
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </label>
                  <div className="pos-soft-panel">
                    <p className="pos-soft-panel__title">Existing secure values</p>
                    <div className="pos-pill-row">
                      <span className={`pos-mini-pill ${form.mpesa?.consumer_key_set ? 'is-success' : ''}`}>Consumer key {form.mpesa?.consumer_key_set ? 'saved' : 'not saved'}</span>
                      <span className={`pos-mini-pill ${form.mpesa?.consumer_secret_set ? 'is-success' : ''}`}>Consumer secret {form.mpesa?.consumer_secret_set ? 'saved' : 'not saved'}</span>
                      <span className={`pos-mini-pill ${form.mpesa?.passkey_set ? 'is-success' : ''}`}>Passkey {form.mpesa?.passkey_set ? 'saved' : 'not saved'}</span>
                    </div>
                  </div>
                </div>

                <div className="pos-field-label pos-field-label--section">M-Pesa Configuration</div>
                <div className="pos-two-col">
                  <label className="pos-field">
                    <span>Callback Base URL</span>
                    <input
                      className="text-input"
                      type="text"
                      value={form.mpesa?.callback_base_url || ''}
                      onChange={(e) => updatePaymentField('callback_base_url', e.target.value)}
                      disabled={loadingSettings || sections.payment.saving}
                    />
                    <small className="pos-help">Leave blank to fall back to the backend configuration.</small>
                  </label>
                  <label className="pos-field">
                    <span>Account Reference Prefix</span>
                    <input
                      className="text-input"
                      type="text"
                      value={form.mpesa?.account_reference_prefix || ''}
                      onChange={(e) => updatePaymentField('account_reference_prefix', e.target.value)}
                      disabled={loadingSettings || sections.payment.saving}
                    />
                    <small className="pos-help">Example: FAF-, UNITY-, INV-</small>
                  </label>
                </div>

                {sections.payment.error ? <p className="form-error">{sections.payment.error}</p> : null}
                {sections.payment.message ? <p className="form-success">{sections.payment.message}</p> : null}
                <div className="row-actions">
                  <button className="primary-button" type="submit" disabled={sections.payment.saving || loadingSettings}>
                    {sections.payment.saving ? 'Saving…' : 'Save Payment Settings'}
                  </button>
                </div>
              </form>
            </article>
          </div>

          <div className="pos-settings-col">
            <article className="pos-card">
              <header className="pos-card__header">
                <div className="pos-card__title-wrap">
                  <Hash size={18} className="pos-card__icon" />
                  <div>
                    <h3>System Defaults &amp; Sequences</h3>
                    <p className="pos-card__meta">Editable numbering for receipt, invoice, order and packing slip</p>
                  </div>
                </div>
              </header>

              <div className="pos-subtabs">
                <button
                  type="button"
                  className={`pos-subtab ${sequenceSubTab === 'numbering' ? 'pos-subtab--active' : ''}`}
                  onClick={() => setSequenceSubTab('numbering')}
                >
                  Document Numbering
                </button>
                <button
                  type="button"
                  className={`pos-subtab ${sequenceSubTab === 'locked' ? 'pos-subtab--active' : ''}`}
                  onClick={() => setSequenceSubTab('locked')}
                >
                  Sequence Notes
                </button>
              </div>

              {sequenceSubTab === 'numbering' && (
                <div className="pos-card__body">
                  <div className="table-wrap pos-seq-table-wrap">
                    <table className="data-table pos-seq-table">
                      <thead>
                        <tr>
                          <th>Document Type</th>
                          <th>Prefix</th>
                          <th>Suffix</th>
                          <th>Current Number</th>
                          <th>Preview</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SEQUENCE_ROWS.map((row) => {
                          const seq = form.document_sequences?.[row.key] || {};
                          const preview = buildSequencePreview(seq, row.placeholder);
                          const rowState = sections[row.section];
                          return (
                            <tr key={row.key}>
                              <td><strong>{row.type}</strong></td>
                              <td>
                                <input
                                  className="text-input pos-inline-input"
                                  type="text"
                                  maxLength={15}
                                  value={seq.prefix || ''}
                                  onChange={(e) => updateSequenceField(row.section, row.key, 'prefix', e.target.value)}
                                  disabled={loadingSettings || rowState.saving}
                                  placeholder={row.placeholder}
                                />
                              </td>
                              <td>
                                <input
                                  className="text-input pos-inline-input"
                                  type="text"
                                  maxLength={15}
                                  value={seq.suffix || ''}
                                  onChange={(e) => updateSequenceField(row.section, row.key, 'suffix', e.target.value)}
                                  disabled={loadingSettings || rowState.saving}
                                  placeholder="Optional"
                                />
                              </td>
                              <td>
                                <input
                                  className="text-input pos-inline-input pos-inline-input--number"
                                  type="number"
                                  min="0"
                                  value={seq.last_number ?? 0}
                                  onChange={(e) => updateSequenceField(row.section, row.key, 'last_number', Number(e.target.value))}
                                  disabled={loadingSettings || rowState.saving}
                                />
                              </td>
                              <td><span className="pos-seq-preview">{preview}</span></td>
                              <td>
                                <button
                                  type="button"
                                  className="primary-button pos-seq-save"
                                  onClick={() => persistSections(row.section, { document_sequences: { [row.key]: seq } })}
                                  disabled={loadingSettings || rowState.saving}
                                >
                                  {rowState.saving ? 'Saving…' : 'Save'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {SEQUENCE_ROWS.map((row) => (
                    sections[row.section].error ? <p key={`${row.key}-error`} className="form-error">{row.type}: {sections[row.section].error}</p> : null
                  ))}
                </div>
              )}

              {sequenceSubTab === 'locked' && (
                <div className="pos-card__body">
                  <div className="pos-soft-panel">
                    <p className="pos-soft-panel__title">How numbering works</p>
                    <p className="pos-soft-panel__text">
                      Each document type stores its own prefix, suffix and current number. Saving a row updates only that sequence.
                    </p>
                    <div className="pos-pill-row">
                      <span className="pos-mini-pill">Per-store numbering</span>
                      <span className="pos-mini-pill">Editable prefixes</span>
                      <span className="pos-mini-pill">Current number persistence</span>
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="pos-card">
              <header className="pos-card__header">
                <div className="pos-card__title-wrap">
                  <Package size={18} className="pos-card__icon" />
                  <div>
                    <h3>Product Display</h3>
                    <p className="pos-card__meta">Inventory grid appearance and image visibility</p>
                  </div>
                </div>
              </header>
              <div className="pos-card__body pos-product-display">
                <div>
                  <p className="pos-product-display__label">Display product images in tables</p>
                  <span className={`pos-status-tag ${form.show_product_images ? 'pos-status-tag--enabled' : ''}`}>
                    {form.show_product_images ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="pos-product-display__actions">
                  <label className="pos-switch">
                    <input
                      type="checkbox"
                      checked={!!form.show_product_images}
                      onChange={(e) => updateField('productDisplay', 'show_product_images', e.target.checked)}
                      disabled={loadingSettings || sections.productDisplay.saving}
                    />
                    <span className="pos-switch__slider" />
                  </label>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={saveProductDisplay}
                    disabled={loadingSettings || sections.productDisplay.saving}
                  >
                    {sections.productDisplay.saving ? 'Saving…' : 'Save Display'}
                  </button>
                </div>
              </div>
              <div className="pos-card__body pos-card__body--compact">
                {sections.productDisplay.error ? <p className="form-error">{sections.productDisplay.error}</p> : null}
                {sections.productDisplay.message ? <p className="form-success">{sections.productDisplay.message}</p> : null}
              </div>
            </article>

            <article className="pos-card">
              <header className="pos-card__header">
                <div className="pos-card__title-wrap">
                  <Shield size={18} className="pos-card__icon" />
                  <div>
                    <h3>Advanced Settings</h3>
                    <p className="pos-card__meta">Stock alerts, VAT defaults and page spacing</p>
                  </div>
                </div>
              </header>
              <div className="pos-card__body">
                <div className="pos-two-col">
                  <label className="pos-field">
                    <span>Default VAT rate (%)</span>
                    <input
                      className="text-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.default_vat_rate}
                      onChange={(e) => updateField('advanced', 'default_vat_rate', Number(e.target.value))}
                      disabled={loadingSettings || sections.advanced.saving}
                    />
                  </label>
                  <label className="pos-field">
                    <span>Low Stock Alert Threshold</span>
                    <input
                      className="text-input"
                      type="number"
                      min="0"
                      value={form.low_stock_alert}
                      onChange={(e) => updateField('advanced', 'low_stock_alert', Number(e.target.value))}
                      disabled={loadingSettings || sections.advanced.saving}
                    />
                  </label>
                </div>

                <label className="pos-switch-row">
                  <div className="pos-switch">
                    <input
                      type="checkbox"
                      checked={!!form.spacious_layout}
                      onChange={(e) => updateField('advanced', 'spacious_layout', e.target.checked)}
                      disabled={loadingSettings || sections.advanced.saving}
                    />
                    <span className="pos-switch__slider" />
                  </div>
                  <span>Use spacious page layout on admin pages</span>
                </label>

                {sections.advanced.error ? <p className="form-error">{sections.advanced.error}</p> : null}
                {sections.advanced.message ? <p className="form-success">{sections.advanced.message}</p> : null}

                <div className="row-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={saveAdvanced}
                    disabled={loadingSettings || sections.advanced.saving}
                  >
                    {sections.advanced.saving ? 'Saving…' : 'Save Advanced Settings'}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      )}

      {activeTab === 'register' && (
        <article className="pos-card">
          <header className="pos-card__header">
            <div className="pos-card__title-wrap">
              <Settings2 size={18} className="pos-card__icon" />
              <div>
                <h3>Register Control</h3>
                <p className="pos-card__meta">Same controls exposed in the dashboard advanced panel</p>
              </div>
            </div>
          </header>
          <form className="pos-card__body" onSubmit={(event) => { event.preventDefault(); saveAdvanced(); }}>
            <div className="pos-two-col">
              <label className="pos-field">
                <span>Default VAT rate (%)</span>
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.default_vat_rate}
                  onChange={(e) => updateField('advanced', 'default_vat_rate', Number(e.target.value))}
                />
              </label>
              <label className="pos-field">
                <span>Low stock alert threshold</span>
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  value={form.low_stock_alert}
                  onChange={(e) => updateField('advanced', 'low_stock_alert', Number(e.target.value))}
                />
              </label>
            </div>
            <label className="pos-switch-row">
              <div className="pos-switch">
                <input
                  type="checkbox"
                  checked={!!form.spacious_layout}
                  onChange={(e) => updateField('advanced', 'spacious_layout', e.target.checked)}
                />
                <span className="pos-switch__slider" />
              </div>
              <span>Use spacious page layout</span>
            </label>
            {sections.advanced.error ? <p className="form-error">{sections.advanced.error}</p> : null}
            {sections.advanced.message ? <p className="form-success">{sections.advanced.message}</p> : null}
            <div className="row-actions">
              <button className="primary-button" type="submit" disabled={sections.advanced.saving}>
                {sections.advanced.saving ? 'Saving...' : 'Save register settings'}
              </button>
            </div>
          </form>
        </article>
      )}

      {activeTab === 'print' && (
        <div className="pos-settings-grid">
          <article className="pos-card">
            <header className="pos-card__header">
              <div className="pos-card__title-wrap">
                <Printer size={18} className="pos-card__icon" />
                <div>
                  <h3>Print Content</h3>
                  <p className="pos-card__meta">Toggle the receipt and invoice detail blocks</p>
                </div>
              </div>
            </header>
            <form className="pos-card__body" onSubmit={handlePrintContentSubmit}>
              <div className="settings-toggle-grid">
                {PRINT_OPTIONS.map(([key, label]) => (
                  <label key={key} className="settings-toggle-card">
                    <input
                      type="checkbox"
                      checked={!!form[key]}
                      onChange={(e) => updateField('printContent', key, e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {sections.printContent.error ? <p className="form-error">{sections.printContent.error}</p> : null}
              {sections.printContent.message ? <p className="form-success">{sections.printContent.message}</p> : null}
              <div className="row-actions">
                <button className="primary-button" type="submit" disabled={sections.printContent.saving}>
                  {sections.printContent.saving ? 'Saving...' : 'Save print content'}
                </button>
              </div>
            </form>
          </article>

          <article className="pos-card">
            <header className="pos-card__header">
              <div className="pos-card__title-wrap">
                <FileText size={18} className="pos-card__icon" />
                <div>
                  <h3>Print Messages</h3>
                  <p className="pos-card__meta">Receipt and invoice headers / footers</p>
                </div>
              </div>
            </header>
            <form className="pos-card__body" onSubmit={handlePrintMessagesSubmit}>
              <label className="pos-field">
                <span>Receipt header</span>
                <textarea
                  className="text-input"
                  rows="2"
                  value={form.receipt_header || ''}
                  onChange={(e) => updateField('printMessages', 'receipt_header', e.target.value)}
                  placeholder="Optional short message shown under store name on receipt"
                />
              </label>
              <label className="pos-field">
                <span>Invoice header</span>
                <textarea
                  className="text-input"
                  rows="2"
                  value={form.invoice_header || ''}
                  onChange={(e) => updateField('printMessages', 'invoice_header', e.target.value)}
                  placeholder="Optional short message shown under store name on invoice"
                />
              </label>
              <label className="pos-field">
                <span>Receipt footer</span>
                <textarea
                  className="text-input"
                  rows="3"
                  value={form.receipt_footer || ''}
                  onChange={(e) => updateField('printMessages', 'receipt_footer', e.target.value)}
                />
              </label>
              <label className="pos-field">
                <span>Invoice footer</span>
                <textarea
                  className="text-input"
                  rows="3"
                  value={form.invoice_footer || ''}
                  onChange={(e) => updateField('printMessages', 'invoice_footer', e.target.value)}
                />
              </label>
              {sections.printMessages.error ? <p className="form-error">{sections.printMessages.error}</p> : null}
              {sections.printMessages.message ? <p className="form-success">{sections.printMessages.message}</p> : null}
              <div className="row-actions">
                <button className="primary-button" type="submit" disabled={sections.printMessages.saving}>
                  {sections.printMessages.saving ? 'Saving...' : 'Save print messages'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}

      {activeTab === 'operations' && (
        <article className="pos-card">
          <header className="pos-card__header">
            <div className="pos-card__title-wrap">
              <Layers size={18} className="pos-card__icon" />
              <div>
                <h3>Document Sequences</h3>
                <p className="pos-card__meta">Standalone editor for all sequence types</p>
              </div>
            </div>
          </header>
          <div className="pos-card__body">
            <div className="sequence-settings-grid">
              {SEQUENCE_ROWS.map((cfg) => {
                const seq = form.document_sequences?.[cfg.key] || {};
                const sectionState = sections[cfg.section];
                return (
                  <form key={cfg.key} className="sequence-card" onSubmit={handleSequenceSubmit(cfg.section, cfg.key)}>
                    <div className="sequence-card__header">
                      <h5>{cfg.type} sequence</h5>
                    </div>
                    <div className="pos-two-col">
                      <label className="pos-field">
                        <span>Prefix</span>
                        <input
                          className="text-input"
                          type="text"
                          maxLength={15}
                          value={seq.prefix || ''}
                          onChange={(e) => updateSequenceField(cfg.section, cfg.key, 'prefix', e.target.value)}
                          placeholder={cfg.placeholder}
                        />
                      </label>
                      <label className="pos-field">
                        <span>Suffix</span>
                        <input
                          className="text-input"
                          type="text"
                          maxLength={15}
                          value={seq.suffix || ''}
                          onChange={(e) => updateSequenceField(cfg.section, cfg.key, 'suffix', e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                    <label className="pos-field">
                      <span>Last number</span>
                      <input
                        className="text-input"
                        type="number"
                        min="0"
                        value={seq.last_number ?? 0}
                        onChange={(e) => updateSequenceField(cfg.section, cfg.key, 'last_number', Number(e.target.value))}
                      />
                    </label>
                    <small className="pos-help">Preview: {buildSequencePreview(seq, cfg.placeholder)}</small>
                    {sectionState.error ? <p className="form-error">{sectionState.error}</p> : null}
                    {sectionState.message ? <p className="form-success">{sectionState.message}</p> : null}
                    <div className="row-actions">
                      <button className="primary-button" type="submit" disabled={sectionState.saving}>
                        {sectionState.saving ? 'Saving...' : `Save ${cfg.type.toLowerCase()} sequence`}
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          </div>
        </article>
      )}

      {activeTab === 'accounting' && (
        <article className="pos-card">
          <header className="pos-card__header">
            <div className="pos-card__title-wrap">
              <DollarSign size={18} className="pos-card__icon" />
              <div>
                <h3>Accounting Settings</h3>
                <p className="pos-card__meta">Store-level tax and payment-related defaults</p>
              </div>
            </div>
          </header>
          <div className="pos-card__body">
            <div className="pos-soft-panel">
              <p className="pos-soft-panel__title">Configured defaults</p>
              <div className="pos-pill-row">
                <span className="pos-mini-pill">VAT: {form.default_vat_rate}%</span>
                <span className="pos-mini-pill">Low stock alert: {form.low_stock_alert}</span>
                <span className={`pos-mini-pill ${form.mpesa?.enabled ? 'is-success' : ''}`}>
                  M-Pesa {form.mpesa?.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
            </div>
          </div>
        </article>
      )}

      <footer className="pos-settings-footer">
        <button
          type="button"
          className="primary-button pos-save-all"
          onClick={handleSaveAll}
          disabled={loadingSettings || SECTION_KEYS.some((key) => sections[key].saving)}
        >
          <CheckCircle2 size={16} />
          {SECTION_KEYS.some((key) => sections[key].saving) ? 'Saving...' : 'Save All Settings'}
        </button>
        <button
          type="button"
          className="ghost-button pos-revert"
          onClick={handleRevertDefaults}
          disabled={loadingSettings}
        >
          Revert to Defaults
        </button>
      </footer>
    </section>
  );
}
