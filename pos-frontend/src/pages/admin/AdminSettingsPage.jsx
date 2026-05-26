import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { storeService } from '../../services/storeService';
import { mergeStoreSettings } from '../../utils/storeSettings';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { stores, storeId, activeStore } = useStore();

  const currentStore = useMemo(
    () => activeStore || stores.find((store) => String(store.store_id) === String(storeId)),
    [activeStore, stores, storeId]
  );

  const [form, setForm] = useState(mergeStoreSettings());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    setForm(mergeStoreSettings(currentStore));
    setMessage('');
    setError('');
  }, [currentStore]);

  useEffect(() => {
    document.documentElement.classList.toggle('spacious-ui', !!form.spacious_layout);
  }, [form.spacious_layout]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentStore?.store_id) {
      setError('Please select a store first.');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await storeService.updateSettings(currentStore.store_id, {
        settings: form,
      });

      const updatedStore = response?.data || currentStore;
      setForm(mergeStoreSettings(updatedStore));
      setMessage('Store POS settings saved successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save store settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="stack-lg">
        <div className="section-header">
          <div>
            <h2>Admin settings</h2>
            <p>Only system administrators can update POS system settings.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentStore) {
    return (
      <section className="stack-lg">
        <div className="section-header">
          <div>
            <h2>Admin settings</h2>
            <p>Select a store to configure POS settings.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="stack-lg">
      <div className="dashboard-grid two-wide">
        <article className="card info-panel">
          <div className="card-header">
            <div>
              <h3>Admin control</h3>
              <p>Settings below are saved per store and affect receipt / invoice printing and POS behavior.</p>
            </div>
          </div>

          <div className="stack-md">
            <div className="info-tile">
              <strong>Role</strong>
              <span>{user?.role}</span>
            </div>

            <div className="info-tile">
              <strong>Current store</strong>
              <span>{currentStore?.store_name || 'Not selected'}</span>
            </div>

            <div className="info-tile">
              <strong>Print behavior</strong>
              <span>Barcode, QR code, footer, header, VAT breakdown, paper width and visibility options are managed here.</span>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <h3>POS settings</h3>
              <p>{currentStore?.store_name}</p>
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
                onChange={(e) => updateField('default_vat_rate', Number(e.target.value))}
              />
            </label>

            <label>
              Low stock alert threshold
              <input
                className="text-input"
                type="number"
                min="0"
                value={form.low_stock_alert}
                onChange={(e) => updateField('low_stock_alert', Number(e.target.value))}
              />
            </label>

            <label>
              Paper width
              <select
                className="select-input"
                value={form.paper_width}
                onChange={(e) => updateField('paper_width', Number(e.target.value))}
              >
                <option value={80}>80 mm</option>
                <option value={58}>58 mm</option>
              </select>
            </label>

            <label>
              Print delay (ms)
              <input
                className="text-input"
                type="number"
                min="0"
                step="50"
                value={form.print_delay_ms}
                onChange={(e) => updateField('print_delay_ms', Number(e.target.value))}
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_product_images}
                onChange={(e) => updateField('show_product_images', e.target.checked)}
              />
              <span>Show product images in POS / admin tables</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.spacious_layout}
                onChange={(e) => updateField('spacious_layout', e.target.checked)}
              />
              <span>Use spacious page layout</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_barcode}
                onChange={(e) => updateField('show_barcode', e.target.checked)}
              />
              <span>Show barcode on receipt / invoice</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_qrcode}
                onChange={(e) => updateField('show_qrcode', e.target.checked)}
              />
              <span>Show QR code on receipt / invoice</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_vat_summary}
                onChange={(e) => updateField('show_vat_summary', e.target.checked)}
              />
              <span>Show VAT summary table on print</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_logo_on_print}
                onChange={(e) => updateField('show_logo_on_print', e.target.checked)}
              />
              <span>Show store logo on print</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_store_contacts_on_print}
                onChange={(e) => updateField('show_store_contacts_on_print', e.target.checked)}
              />
              <span>Show store contacts on print</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_store_pin_on_print}
                onChange={(e) => updateField('show_store_pin_on_print', e.target.checked)}
              />
              <span>Show store PIN on print</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_customer_on_print}
                onChange={(e) => updateField('show_customer_on_print', e.target.checked)}
              />
              <span>Show customer on print</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.show_cashier_on_print}
                onChange={(e) => updateField('show_cashier_on_print', e.target.checked)}
              />
              <span>Show cashier on print</span>
            </label>

            <label className="checkbox-row span-2">
              <input
                type="checkbox"
                checked={form.show_payment_method_on_print}
                onChange={(e) => updateField('show_payment_method_on_print', e.target.checked)}
              />
              <span>Show payment method on receipt / invoice</span>
            </label>

            <label className="span-2">
              Receipt header
              <textarea
                className="text-input"
                rows="3"
                value={form.receipt_header}
                onChange={(e) => updateField('receipt_header', e.target.value)}
                placeholder="Optional short message shown under store name on receipt"
              />
            </label>

            <label className="span-2">
              Invoice header
              <textarea
                className="text-input"
                rows="3"
                value={form.invoice_header}
                onChange={(e) => updateField('invoice_header', e.target.value)}
                placeholder="Optional short message shown under store name on invoice"
              />
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

            {error ? <p className="form-error span-2">{error}</p> : null}
            {message ? <p className="form-success span-2">{message}</p> : null}

            <div className="row-actions span-2">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}
