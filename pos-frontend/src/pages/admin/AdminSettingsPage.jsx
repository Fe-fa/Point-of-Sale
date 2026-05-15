import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';

const defaultSettings = {
  default_vat_rate: 15,
  invoice_prefix: 'INV',
  receipt_footer: 'Thank you for your purchase.',
  invoice_footer: 'Goods once sold are not returnable.',
  low_stock_alert: 5,
  spacious_layout: true,
  show_product_images: true,
};

const getSettingsKey = (storeId) => `pos_admin_settings_${storeId || 'default'}`;

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { stores, storeId, activeStore } = useStore();
  const currentStore = useMemo(
    () => activeStore || stores.find((store) => String(store.store_id) === String(storeId)),
    [activeStore, stores, storeId]
  );

  const [form, setForm] = useState(defaultSettings);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(getSettingsKey(storeId));
    const next = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    setForm(next);
    document.documentElement.classList.toggle('spacious-ui', !!next.spacious_layout);
  }, [storeId]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    localStorage.setItem(getSettingsKey(storeId), JSON.stringify(form));
    document.documentElement.classList.toggle('spacious-ui', !!form.spacious_layout);
    setMessage('Settings saved successfully.');
  };

  return (
    <section className="stack-lg">
      <div className="section-header">
        <div>
          <h2>Settings</h2>
          <p>Manage spacious admin layout preferences, invoice defaults, and store-focused workflow options.</p>
        </div>
      </div>

      <div className="dashboard-grid two-wide">
        <article className="card info-panel">
          <div className="card-header">
            <div>
              <h3>Access overview</h3>
              <p>{user?.role === 'admin' ? 'Global access profile' : 'Restricted store manager profile'}</p>
            </div>
          </div>

          <div className="stack-md">
            <div className="info-tile">
              <strong>Role</strong>
              <span>{user?.role}</span>
            </div>
            <div className="info-tile">
              <strong>Current store</strong>
              <span>{currentStore?.store_name || 'Not selected yet'}</span>
            </div>
            <div className="info-tile">
              <strong>Password recovery</strong>
              <span>Forgot password and reset password screens are available inside the auth pages folder.</span>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <h3>Workspace preferences</h3>
              <p>{currentStore?.store_name || 'Current store'}</p>
            </div>
          </div>

          <form className="form-grid two-columns" onSubmit={handleSubmit}>
            <label>
              Default VAT rate (%)
              <input
                className="text-input"
                type="number"
                min="0"
                step="0.01"
                value={form.default_vat_rate}
                onChange={(e) => updateField('default_vat_rate', e.target.value)}
              />
            </label>

            <label>
              Low stock alert threshold
              <input
                className="text-input"
                type="number"
                min="0"
                value={form.low_stock_alert}
                onChange={(e) => updateField('low_stock_alert', e.target.value)}
              />
            </label>

            <label>
              Invoice prefix
              <input
                className="text-input"
                value={form.invoice_prefix}
                onChange={(e) => updateField('invoice_prefix', e.target.value)}
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_product_images}
                onChange={(e) => updateField('show_product_images', e.target.checked)}
              />
              <span>Show product images in admin tables</span>
            </label>

            <label className="checkbox-row span-2">
              <input
                type="checkbox"
                checked={form.spacious_layout}
                onChange={(e) => updateField('spacious_layout', e.target.checked)}
              />
              <span>Use spacious page layout</span>
            </label>

            <label className="span-2">
              Receipt footer
              <textarea
                className="text-input"
                rows="4"
                value={form.receipt_footer}
                onChange={(e) => updateField('receipt_footer', e.target.value)}
              />
            </label>

            <label className="span-2">
              Invoice footer
              <textarea
                className="text-input"
                rows="4"
                value={form.invoice_footer}
                onChange={(e) => updateField('invoice_footer', e.target.value)}
              />
            </label>

            {message ? <p className="form-success span-2">{message}</p> : null}

            <div className="row-actions span-2">
              <button className="primary-button" type="submit">
                Save settings
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}
