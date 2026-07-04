import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  FileText,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import GrnPaymentModal from '../../components/modals/GrnPaymentModal';
import MpesaStkModal from '../../components/modals/MpesaStkModal';
import { useStore } from '../../contexts/StoreContext';
import { productService } from '../../services/productService';
import { grnService } from '../../services/grnService';
import { supplierService } from '../../services/supplierService';
import { mpesaService } from '../../services/mpesaService';
import { openGrnPrint } from '../../utils/grnPrint';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const PAYMENT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'partial', label: 'Partial' },
  { key: 'paid', label: 'Paid' },
];

const DEFAULT_ITEM = {
  grn_item_id: null,
  product_id: '',
  product_name_snapshot: '',
  barcode: '',
  batch_no: '',
  qty_received: 1,
  free_qty: 0,
  cost_price_excl_tax: 0,
  cost_price_incl_tax: 0,
  tax_rate: 0,
  taxable_amount: 0,
  tax_amount: 0,
  total_amount: 0,
  mrp: 0,
  selling_price: 0,
  low_inventory_level: 0,
  notes: '',
};

const DEFAULT_EDITOR = {
  grn_id: null,
  grn_number: 'Auto',
  grn_date: new Date().toISOString().slice(0, 10),
  invoice_number: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  supplier_id: '',
  supplier_name: '',
  is_po_available: false,
  po_number: '',
  notes: '',
  additional_discount_1: 0,
  additional_discount_2: 0,
  other_charges: 0,
  round_off: 0,
  subtotal: 0,
  tax_amount: 0,
  total_discount_amount: 0,
  grand_total: 0,
  final_total: 0,
  paid_amount: 0,
  balance_due: 0,
  payment_status: 'unpaid',
  payments: [],
  status: 'draft',
  stock_applied_at: null,
  release_to_inventory: true,
  items: [],
};

const DEFAULT_SUPPLIER_FORM = {
  supplier_id: null,
  supplier_name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  opening_balance: 0,
  is_active: true,
};

const toNum = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeResponse = (response) => response?.data ?? response ?? null;

const normalizeListResponse = (response) => ({
  rows: Array.isArray(response?.data) ? response.data : [],
  meta: response?.meta || {},
});

const money = (value, currencyCode = 'KES') =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(toNum(value));

const dateLabel = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB');
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const toDateInput = (date) => date.toISOString().slice(0, 10);

function getRangeParams(rangeKey, customFrom, customTo) {
  const today = new Date();

  if (rangeKey === 'today') {
    return { from: toDateInput(startOfDay(today)), to: toDateInput(endOfDay(today)) };
  }

  if (rangeKey === 'yesterday') {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return { from: toDateInput(startOfDay(date)), to: toDateInput(endOfDay(date)) };
  }

  if (rangeKey === 'this_week') {
    const date = new Date(today);
    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - diff);
    return { from: toDateInput(startOfDay(date)), to: toDateInput(endOfDay(today)) };
  }

  if (rangeKey === 'this_month') {
    const date = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toDateInput(startOfDay(date)), to: toDateInput(endOfDay(today)) };
  }

  if (rangeKey === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  return {};
}

function resolvePaymentStatus(finalTotal, paidAmount) {
  if (toNum(paidAmount) <= 0) return 'unpaid';
  if (toNum(paidAmount) >= toNum(finalTotal)) return 'paid';
  return 'partial';
}

function createItemDraft(product) {
  const taxRate = toNum(product?.vat_rate);
  const costExcl = toNum(product?.cost_price || 0);
  const costIncl = +(costExcl + (costExcl * taxRate) / 100).toFixed(2);
  const qtyReceived = 1;

  return {
    ...DEFAULT_ITEM,
    product_id: product?.product_id || '',
    product_name_snapshot: product?.product_name || '',
    barcode: product?.sku || '',
    cost_price_excl_tax: costExcl,
    cost_price_incl_tax: costIncl,
    tax_rate: taxRate,
    mrp: toNum(product?.price || 0),
    selling_price: toNum(product?.price || 0),
    qty_received: qtyReceived,
    taxable_amount: +(qtyReceived * costExcl).toFixed(2),
    tax_amount: +((qtyReceived * costExcl * taxRate) / 100).toFixed(2),
    total_amount: +(qtyReceived * costIncl).toFixed(2),
    low_inventory_level: toNum(product?.low_inventory_level || 0),
  };
}

function recalcItem(item) {
  const qtyReceived = Math.max(1, parseInt(item.qty_received || 0, 10) || 1);
  const freeQty = Math.max(0, parseInt(item.free_qty || 0, 10) || 0);
  const costExcl = toNum(item.cost_price_excl_tax);
  const taxRate = toNum(item.tax_rate);
  const costIncl =
    item.cost_price_incl_tax !== undefined &&
      item.cost_price_incl_tax !== null &&
      item.cost_price_incl_tax !== ''
      ? toNum(item.cost_price_incl_tax)
      : +(costExcl + (costExcl * taxRate) / 100).toFixed(2);

  const taxableAmount = +(qtyReceived * costExcl).toFixed(2);
  const taxAmount = +(qtyReceived * Math.max(costIncl - costExcl, 0)).toFixed(2);
  const totalAmount = +(qtyReceived * costIncl).toFixed(2);

  return {
    ...item,
    qty_received: qtyReceived,
    free_qty: freeQty,
    cost_price_excl_tax: costExcl,
    cost_price_incl_tax: costIncl,
    tax_rate: taxRate,
    taxable_amount: taxableAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    mrp: toNum(item.mrp),
    selling_price: toNum(item.selling_price),
    low_inventory_level: Math.max(0, parseInt(item.low_inventory_level || 0, 10) || 0),
  };
}

function recalcEditor(editor) {
  const items = (editor.items || []).map(recalcItem);
  const subtotal = items.reduce((sum, item) => sum + toNum(item.taxable_amount), 0);
  const taxAmount = items.reduce((sum, item) => sum + toNum(item.tax_amount), 0);
  const grandTotal = +(subtotal + taxAmount + toNum(editor.other_charges)).toFixed(2);
  const finalTotal = +Math.max(
    grandTotal - toNum(editor.additional_discount_1) - toNum(editor.additional_discount_2) + toNum(editor.round_off),
    0,
  ).toFixed(2);
  const paidAmount = toNum(editor.paid_amount);
  const balanceDue = +Math.max(finalTotal - paidAmount, 0).toFixed(2);

  return {
    ...editor,
    items,
    subtotal: +subtotal.toFixed(2),
    tax_amount: +taxAmount.toFixed(2),
    grand_total: +grandTotal.toFixed(2),
    final_total: finalTotal,
    paid_amount: paidAmount,
    balance_due: balanceDue,
    payment_status: editor.payment_status || resolvePaymentStatus(finalTotal, paidAmount),
    release_to_inventory:
      typeof editor.release_to_inventory === 'boolean' ? editor.release_to_inventory : true,
  };
}

function buildHeaderPayload(editor, storeId) {
  return {
    store_id: Number(storeId),
    grn_date: editor.grn_date,
    invoice_number: editor.invoice_number || null,
    invoice_date: editor.invoice_date || null,
    supplier_id: editor.supplier_id ? Number(editor.supplier_id) : null,
    supplier_name: editor.supplier_name || null,
    is_po_available: Boolean(editor.is_po_available),
    po_number: editor.is_po_available ? editor.po_number || null : null,
    notes: editor.notes || null,
    additional_discount_1: toNum(editor.additional_discount_1),
    additional_discount_2: toNum(editor.additional_discount_2),
    other_charges: toNum(editor.other_charges),
    round_off: toNum(editor.round_off),
    release_to_inventory: Boolean(editor.release_to_inventory),
  };
}

function buildItemPayload(item) {
  const next = recalcItem(item);
  return {
    product_id: Number(next.product_id),
    product_name_snapshot: next.product_name_snapshot || null,
    barcode: next.barcode || null,
    batch_no: next.batch_no || null,
    qty_received: next.qty_received,
    free_qty: next.free_qty,
    cost_price_excl_tax: toNum(next.cost_price_excl_tax),
    cost_price_incl_tax: toNum(next.cost_price_incl_tax),
    tax_rate: toNum(next.tax_rate),
    taxable_amount: toNum(next.taxable_amount),
    tax_amount: toNum(next.tax_amount),
    total_amount: toNum(next.total_amount),
    mrp: toNum(next.mrp),
    selling_price: toNum(next.selling_price),
    low_inventory_level: Math.max(0, parseInt(next.low_inventory_level || 0, 10) || 0),
    notes: next.notes || null,
  };
}

function getInventoryReleaseLabel(row) {
  if (row.stock_applied_at) return 'Added';
  if (row.release_to_inventory) return 'Queued';
  return 'Hold';
}

function getStatusClass(status) {
  if (status === 'paid') return 'inv-pill-healthy';
  if (status === 'partial') return 'inv-pill-low';
  if (status === 'completed') return 'inv-pill-healthy';
  return 'inv-pill-critical';
}

function balanceClass(balance) {
  const value = toNum(balance);
  if (value > 0) return 'inv-pill-critical';
  if (value < 0) return 'inv-pill-low';
  return 'inv-pill-healthy';
}

function Field({ label, children, span = 1 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: `span ${span}` }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
      {helper ? <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{helper}</div> : null}
    </div>
  );
}

function RangeButton({ active, onClick, children }) {
  return (
    <button type="button" className={active ? 'primary-button' : 'ghost-button'} onClick={onClick}>
      {children}
    </button>
  );
}

function ItemModal({ open, onClose, products, productsLoading, onSubmit, initialItem }) {
  const [item, setItem] = useState(DEFAULT_ITEM);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setItem(recalcItem(initialItem || DEFAULT_ITEM));
    setSearch(initialItem?.product_name_snapshot || '');
  }, [open, initialItem]);

  if (!open) return null;

  const filteredProducts = products
    .filter((product) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        String(product?.product_name || '').toLowerCase().includes(term) ||
        String(product?.sku || '').toLowerCase().includes(term)
      );
    })
    .slice(0, 100);

  const selectProduct = (productId) => {
    const product = products.find((entry) => String(entry.product_id) === String(productId));
    if (!product) return;
    const draft = createItemDraft(product);
    setItem(recalcItem({ ...item, ...draft }));
    setSearch(product.product_name || '');
  };

  const updateField = (field, value) =>
    setItem((prev) => recalcItem({ ...prev, [field]: value }));

  return (
    <div className="modal-backdrop">
      <div
        className="modal-card"
        style={{
          width: 'min(820px, 96vw)',
          borderRadius: 22,
          maxHeight: '92vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0 }}>{item.grn_item_id ? 'Update Line Item' : 'Add Line Item'}</h3>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Minimal GRN line capture for fast stock intake.
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <Field label="Search Product">
            <input
              className="text-input"
              placeholder="Search by product name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>

          <Field label="Select Product">
            <select className="select-input" value={item.product_id} onChange={(e) => selectProduct(e.target.value)}>
              <option value="">{productsLoading ? 'Loading products…' : 'Choose product'}</option>
              {filteredProducts.map((product) => (
                <option key={product.product_id} value={product.product_id}>
                  {product.product_name} {product.sku ? `(${product.sku})` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="SKU / Barcode">
            <input
              className="text-input"
              value={item.barcode || ''}
              onChange={(e) => updateField('barcode', e.target.value)}
            />
          </Field>

          <Field label="Traceability Code">
            <input
              className="text-input"
              value={item.batch_no || ''}
              onChange={(e) => updateField('batch_no', e.target.value)}
              placeholder="Auto-generated when blank"
            />
          </Field>

          <Field label="Qty">
            <input
              className="text-input"
              type="number"
              min="1"
              value={item.qty_received}
              onChange={(e) => updateField('qty_received', e.target.value)}
            />
          </Field>

          <Field label="Free Qty">
            <input
              className="text-input"
              type="number"
              min="0"
              value={item.free_qty}
              onChange={(e) => updateField('free_qty', e.target.value)}
            />
          </Field>

          <Field label="Comment" span={2}>
            <textarea
              className="text-input"
              rows={4}
              value={item.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => onSubmit(recalcItem(item))}
            disabled={!item.product_id}
          >
            {item.grn_item_id ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
        fontWeight: strong ? 800 : 600,
      }}
    >
      <span style={{ color: strong ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function SupplierManagerModal({
  open,
  onClose,
  suppliers,
  suppliersLoading,
  currencyCode,
  onCreate,
  onUpdate,
  onDelete,
  saving,
  onFetchStatement,
}) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(DEFAULT_SUPPLIER_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [statementFor, setStatementFor] = useState(null);
  const [statement, setStatement] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormOpen(false);
      setForm(DEFAULT_SUPPLIER_FORM);
      setStatementFor(null);
      setStatement(null);
    }
  }, [open]);

  if (!open) return null;

  const filtered = suppliers.filter((s) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      String(s.supplier_name || '').toLowerCase().includes(term) ||
      String(s.contact_person || '').toLowerCase().includes(term) ||
      String(s.phone || '').toLowerCase().includes(term)
    );
  });

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const startCreate = () => {
    setForm(DEFAULT_SUPPLIER_FORM);
    setStatementFor(null);
    setFormOpen(true);
  };

  const startEdit = (supplier) => {
    setForm({
      supplier_id: supplier.supplier_id,
      supplier_name: supplier.supplier_name || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      opening_balance: supplier.opening_balance || 0,
      is_active: Boolean(supplier.is_active),
    });
    setStatementFor(null);
    setFormOpen(true);
  };

  const viewStatement = async (supplier) => {
    setFormOpen(false);
    setStatementFor(supplier);
    setStatementLoading(true);
    try {
      const data = await onFetchStatement(supplier.supplier_id);
      setStatement(data);
    } finally {
      setStatementLoading(false);
    }
  };

  const submitForm = async () => {
    if (form.supplier_id) {
      await onUpdate(form);
    } else {
      await onCreate(form);
    }
    setFormOpen(false);
    setForm(DEFAULT_SUPPLIER_FORM);
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-card"
        style={{ width: 'min(920px, 96vw)', borderRadius: 22, maxHeight: '92vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0 }}>Suppliers</h3>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Create suppliers and check what you currently owe each one.
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <label className="catalog-search" style={{ marginBottom: 0, flex: 1 }}>
                <span className="catalog-search-icon">
                  <Search size={16} />
                </span>
                <input
                  className="text-input"
                  placeholder="Search suppliers"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button type="button" className="primary-button" onClick={startCreate}>
                <Plus size={16} /> New
              </button>
            </div>

            <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Balance</th>
                    <th className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersLoading ? (
                    <tr>
                      <td colSpan={3} className="catalog-empty-cell">Loading suppliers…</td>
                    </tr>
                  ) : !filtered.length ? (
                    <tr>
                      <td colSpan={3} className="catalog-empty-cell">No suppliers found.</td>
                    </tr>
                  ) : (
                    filtered.map((supplier) => (
                      <tr key={supplier.supplier_id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <strong>{supplier.supplier_name}</strong>
                            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                              {supplier.phone || supplier.email || '—'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`inv-status-pill ${balanceClass(supplier.balance ?? supplier.outstanding_balance)}`}>
                            {money(supplier.balance ?? supplier.outstanding_balance, currencyCode)}
                          </span>
                        </td>
                        <td className="align-right">
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button type="button" className="icon-button" title="Statement" onClick={() => viewStatement(supplier)}>
                              <FileText size={15} />
                            </button>
                            <button type="button" className="icon-button" title="Edit" onClick={() => startEdit(supplier)}>
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              title="Delete"
                              onClick={() => {
                                if (window.confirm(`Delete ${supplier.supplier_name}?`)) {
                                  onDelete(supplier.supplier_id);
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside style={{ border: '1px solid var(--line)', borderRadius: 18, padding: 16, background: 'var(--surface)' }}>
            {formOpen ? (
              <>
                <h4 style={{ marginTop: 0 }}>{form.supplier_id ? 'Edit Supplier' : 'New Supplier'}</h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  <Field label="Supplier Name">
                    <input className="text-input" value={form.supplier_name} onChange={(e) => updateField('supplier_name', e.target.value)} />
                  </Field>
                  <Field label="Contact Person">
                    <input className="text-input" value={form.contact_person} onChange={(e) => updateField('contact_person', e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <input className="text-input" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <input className="text-input" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                  </Field>
                  <Field label="Opening Balance">
                    <input className="text-input" type="number" step="0.01" value={form.opening_balance} onChange={(e) => updateField('opening_balance', e.target.value)} />
                  </Field>
                  <Field label="Address">
                    <textarea className="text-input" rows={2} value={form.address} onChange={(e) => updateField('address', e.target.value)} />
                  </Field>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={Boolean(form.is_active)} onChange={(e) => updateField('is_active', e.target.checked)} />
                    <span>{form.is_active ? 'Active' : 'Inactive'}</span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="primary-button" disabled={saving || !form.supplier_name} onClick={submitForm}>
                    {form.supplier_id ? 'Save Changes' : 'Create Supplier'}
                  </button>
                </div>
              </>
            ) : statementFor ? (
              <>
                <h4 style={{ marginTop: 0 }}>{statementFor.supplier_name} — Statement</h4>
                {statementLoading ? (
                  <div style={{ color: 'var(--muted)', padding: 12 }}>Loading…</div>
                ) : (
                  <>
                    <SummaryRow label="Opening Balance" value={money(statement?.opening_balance, currencyCode)} />
                    <SummaryRow label="Total Invoiced" value={money(statement?.total_invoiced, currencyCode)} />
                    <SummaryRow label="Total Paid" value={money(statement?.total_paid, currencyCode)} />
                    <SummaryRow label="Balance" value={money(statement?.balance, currencyCode)} strong />

                    <div style={{ marginTop: 14, maxHeight: 280, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
                      <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Entry</th>
                            <th className="align-right">Running</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(statement?.entries || []).map((entry, index) => (
                            <tr key={`${entry.type}-${index}`}>
                              <td style={{ fontSize: 12 }}>{dateLabel(entry.date)}</td>
                              <td style={{ fontSize: 12 }}>{entry.label}</td>
                              <td className="align-right" style={{ fontSize: 12 }}>
                                {money(entry.running_balance, currencyCode)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button type="button" className="ghost-button" onClick={() => setStatementFor(null)}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '40px 12px' }}>
                Select a supplier to view their statement, or create a new one.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function EditorScreen({
  editor,
  setEditor,
  currencyCode,
  storeLabel,
  suppliers,
  suppliersLoading,
  onBack,
  onSaveDraft,
  onSaveAsCredit,
  onSaveAndPay,
  onDeleteItem,
  onOpenItemModal,
  onPrintInvoice,
  onRecordPayment,
  onOpenSupplierModal,
  saving,
}) {
  const summary = recalcEditor(editor);
  const isCompleted = summary.status === 'completed';

  const handleHeaderChange = (field, value) =>
    setEditor((prev) => recalcEditor({ ...prev, [field]: value }));

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find((entry) => String(entry.supplier_id) === String(supplierId));
    setEditor((prev) =>
      recalcEditor({
        ...prev,
        supplier_id: supplier ? supplier.supplier_id : '',
        supplier_name: supplier ? supplier.supplier_name || supplier.name || '' : '',
      }),
    );
  };

  const saveDisabled = saving || !summary.supplier_id || !summary.items.length;

  return (
    <section className="stack-lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="ghost-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to GRN list
        </button>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {isCompleted ? 'Completed GRN' : 'Draft GRN'} · Inventory{' '}
          {summary.stock_applied_at
            ? 'already released'
            : summary.release_to_inventory
              ? 'queued for release'
              : 'held from release'}
        </div>
      </div>

      <article style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 22, padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
          <Field label="Supplier">
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="select-input"
                value={summary.supplier_id || ''}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                disabled={isCompleted}
              >
                <option value="">{suppliersLoading ? 'Loading suppliers…' : 'Select supplier'}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.supplier_name || supplier.name}
                  </option>
                ))}
              </select>

              {!isCompleted ? (
                <button type="button" className="icon-button" title="Manage suppliers" onClick={onOpenSupplierModal}>
                  <Plus size={16} />
                </button>
              ) : null}
            </div>
          </Field>

          <Field label="Received At">
            <input
              className="text-input"
              type="date"
              value={summary.grn_date || ''}
              onChange={(e) => handleHeaderChange('grn_date', e.target.value)}
              disabled={isCompleted}
            />
          </Field>

          <Field label="Store Branch Destination">
            <input className="text-input" readOnly value={storeLabel} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text)' }}>Line Items</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Product lookup, qty, traceability, and comment.
                </div>
              </div>

              {!isCompleted ? (
                <button type="button" className="primary-button" onClick={() => onOpenItemModal()} disabled={!summary.supplier_id}>
                  <Plus size={16} /> Add Item
                </button>
              ) : null}
            </div>

            <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Traceability</th>
                    <th>Qty</th>
                    <th>Comment</th>
                    <th className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.items.length ? (
                    summary.items.map((item, index) => (
                      <tr key={item.grn_item_id || `${item.product_id}-${index}`}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <strong>{item.product_name_snapshot}</strong>
                            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{item.barcode || '—'}</span>
                          </div>
                        </td>
                        <td>{item.batch_no || `${summary.grn_number === 'Auto' ? 'GRN-NEW' : summary.grn_number}-${index + 1}`}</td>
                        <td>{item.qty_received}</td>
                        <td>{item.notes || '—'}</td>
                        <td className="align-right">
                          {!isCompleted ? (
                            <div style={{ display: 'inline-flex', gap: 8 }}>
                              <button type="button" className="icon-button" onClick={() => onOpenItemModal(item)}>
                                <Pencil size={15} />
                              </button>
                              <button type="button" className="icon-button" onClick={() => onDeleteItem(item)}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 12 }}>View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="catalog-empty-cell">No items added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
              <Field label="Inventory Release">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(summary.release_to_inventory)}
                    onChange={(e) => handleHeaderChange('release_to_inventory', e.target.checked)}
                    disabled={isCompleted && Boolean(summary.stock_applied_at)}
                  />
                  <span>{summary.release_to_inventory ? 'ADD TO INVENTORY' : 'NO ADD TO INVENTORY'}</span>
                </label>
              </Field>
            </div>
          </div>

          <aside style={{ border: '1px solid var(--line)', borderRadius: 18, padding: 16, background: 'var(--surface)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>GRN Summary</h3>

            <SummaryRow label="GRN Number" value={summary.grn_number || 'Auto'} />
            <SummaryRow label="Item Count" value={String(summary.items.length)} />
            <SummaryRow label="Payment Status" value={String(summary.payment_status || 'unpaid').toUpperCase()} />
            <SummaryRow label="Final Total" value={money(summary.final_total, currencyCode)} />
            <SummaryRow label="Paid Amount" value={money(summary.paid_amount, currencyCode)} />
            <SummaryRow label="Balance Due" value={money(summary.balance_due, currencyCode)} strong />
            <SummaryRow
              label="Stock Release"
              value={
                summary.stock_applied_at
                  ? 'POSTED TO INVENTORY'
                  : summary.release_to_inventory
                    ? 'WILL POST ON COMPLETE'
                    : 'HELD'
              }
            />

            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
              {!isCompleted ? (
                <>
                  <button type="button" className="ghost-button" onClick={onSaveDraft} disabled={saveDisabled}>
                    <Save size={16} /> Save Draft
                  </button>
                  <button type="button" className="ghost-button" onClick={onSaveAsCredit} disabled={saveDisabled}>
                    <PackagePlus size={16} /> Save & Complete (On Credit)
                  </button>
                  <button type="button" className="primary-button" onClick={onSaveAndPay} disabled={saveDisabled}>
                    <Wallet size={16} /> Save & Open Settlement
                  </button>
                </>
              ) : null}

              {isCompleted && !summary.stock_applied_at ? (
                <button type="button" className="primary-button" onClick={onSaveAsCredit} disabled={saving}>
                  <PackagePlus size={16} /> Release Stock to Inventory
                </button>
              ) : null}

              {summary.grn_id && toNum(summary.balance_due) > 0 ? (
                <button type="button" className="ghost-button" onClick={onRecordPayment} disabled={saving}>
                  <Wallet size={16} /> Record Deposit / Final Payment
                </button>
              ) : null}

              <button type="button" className="ghost-button" onClick={onPrintInvoice} disabled={!summary.items.length}>
                <Printer size={16} /> Print GRN
              </button>
            </div>
          </aside>
        </div>
      </article>
    </section>
  );
}

export default function AdminGrnPage() {
  const queryClient = useQueryClient();
  const { storeId, activeStore } = useStore();
  const currencyCode = activeStore?.currency || 'KES';
  const storeLabel = activeStore?.store_name || `Store #${storeId || '—'}`;

  const [mode, setMode] = useState('list');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('today');
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));
  const [supplierFilter, setSupplierFilter] = useState('');
  const [itemCountMin, setItemCountMin] = useState('');
  const [itemCountMax, setItemCountMax] = useState('');
  const [valueMin, setValueMin] = useState('');
  const [valueMax, setValueMax] = useState('');
  const [editor, setEditor] = useState(DEFAULT_EDITOR);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(DEFAULT_ITEM);
  const [page, setPage] = useState(1);
  const [stkSession, setStkSession] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setPage(1);
    setMode('list');
    setEditor(DEFAULT_EDITOR);
  }, [storeId]);

  const rangeParams = getRangeParams(range, customFrom, customTo);

  const grnQuery = useQuery({
    queryKey: ['grns', storeId, statusFilter, paymentStatus, search, range, customFrom, customTo, supplierFilter, itemCountMin, itemCountMax, valueMin, valueMax, page],
    enabled: Boolean(storeId),
    queryFn: async () =>
      normalizeListResponse(
        await grnService.list({
          store_id: Number(storeId),
          status: statusFilter,
          payment_status: paymentStatus,
          supplier_id: supplierFilter || undefined,
          search: search || undefined,
          date_from: rangeParams.from,
          date_to: rangeParams.to,
          item_count_min: itemCountMin || undefined,
          item_count_max: itemCountMax || undefined,
          value_min: valueMin || undefined,
          value_max: valueMax || undefined,
          page,
          per_page: 20,
        }),
      ),
  });

  const productsQuery = useQuery({
    queryKey: ['grn-products', storeId],
    enabled: Boolean(storeId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await productService.list({ store_id: Number(storeId), per_page: 300 });
      const payload = response?.data?.data || response?.data || response || [];
      return Array.isArray(payload) ? payload : payload?.data || [];
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ['grn-suppliers', storeId],
    enabled: Boolean(storeId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await supplierService.list({ store_id: Number(storeId), per_page: 500, is_active: 1 });
      const payload = response?.data?.data || response?.data || response || [];
      return Array.isArray(payload) ? payload : payload?.data || [];
    },
  });

  const hydrateEditor = (detail) =>
    recalcEditor({
      ...DEFAULT_EDITOR,
      ...detail,
      items: detail?.items || [],
      payments: detail?.payments || [],
    });

  const saveHeaderMutation = useMutation({
    mutationFn: async (nextEditor) => {
      const payload = buildHeaderPayload(nextEditor, storeId);
      if (nextEditor.grn_id) return normalizeResponse(await grnService.update(nextEditor.grn_id, payload));
      return normalizeResponse(await grnService.createDraft(payload));
    },
    onSuccess: (data) => {
      setEditor(hydrateEditor(data));
      queryClient.invalidateQueries({ queryKey: ['grns', storeId] });
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async ({ currentEditor, item }) => {
      const ensured = currentEditor.grn_id
        ? currentEditor
        : normalizeResponse(await grnService.createDraft(buildHeaderPayload(currentEditor, storeId)));

      const grnId = ensured.grn_id || currentEditor.grn_id;
      const payload = buildItemPayload(item);

      if (item.grn_item_id) {
        await grnService.updateItem(grnId, item.grn_item_id, payload);
      } else {
        await grnService.addItem(grnId, payload);
      }

      return normalizeResponse(await grnService.show(grnId));
    },
    onSuccess: (detail) => {
      setEditor(hydrateEditor(detail));
      setItemModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['grns', storeId] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (item) => {
      if (!editor.grn_id || !item.grn_item_id) return null;
      await grnService.removeItem(editor.grn_id, item.grn_item_id);
      return normalizeResponse(await grnService.show(editor.grn_id));
    },
    onSuccess: (detail) => {
      if (detail) setEditor(hydrateEditor(detail));
      queryClient.invalidateQueries({ queryKey: ['grns', storeId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ nextEditor, payNow = false }) => {
      let current = nextEditor;

      if (!current.grn_id) {
        current = normalizeResponse(await grnService.createDraft(buildHeaderPayload(current, storeId)));
      }

      if (!current.items?.length && nextEditor.items?.length) {
        for (const item of nextEditor.items) {
          await grnService.addItem(current.grn_id, buildItemPayload(item));
        }
      }

      await grnService.update(current.grn_id, buildHeaderPayload(nextEditor, storeId));

      const detail = normalizeResponse(
        await grnService.complete(current.grn_id, {
          release_to_inventory: Boolean(nextEditor.release_to_inventory),
          notes: nextEditor.notes || null,
        }),
      );

      return { detail, payNow };
    },
    onSuccess: ({ detail, payNow }) => {
      const nextEditor = hydrateEditor(detail);
      queryClient.invalidateQueries({ queryKey: ['grns', storeId] });
      setEditor(nextEditor);
      setMode('editor');

      if (payNow && toNum(nextEditor.balance_due) > 0) {
        setPaymentModalOpen(true);
      }
    },
  });

  const chargeMutation = useMutation({
    mutationFn: async (payload) => {
      if (!editor?.grn_id) throw new Error('Save draft first before recording payment.');
      return normalizeResponse(await grnService.charge(editor.grn_id, payload));
    },
    onSuccess: (detail) => {
      const normalizedEditor = hydrateEditor(detail);
      setEditor(normalizedEditor);
      setPaymentModalOpen(false);
      openGrnPrint(detail, activeStore, 'receipt');
      queryClient.invalidateQueries({ queryKey: ['grns', storeId] });
    },
  });

  const initiateGrnStkMutation = useMutation({
    mutationFn: async ({ phone, amount }) => {
      if (!editor?.grn_id) throw new Error('Complete the GRN before sending an M-Pesa request.');
      return mpesaService.initiateStkPush({
        grn_id: editor.grn_id,
        phone,
        amount,
      });
    },
    onSuccess: (response, variables) => {
      const payload = response?.data || response || {};
      setStkSession({
        checkoutRequestId: payload.checkout_request_id,
        phone: payload.phone_number || variables.phone,
        amount: payload.amount || variables.amount,
        pollingIntervalMs: payload?.polling?.interval_ms || 3000,
        pollingTimeoutMs: payload?.polling?.timeout_ms || 120000,
      });
    },
  });


  const toggleReleaseMutation = useMutation({
    mutationFn: async (row) => {
      if (row.status === 'completed') {
        return normalizeResponse(
          await grnService.complete(row.grn_id, { release_to_inventory: !Boolean(row.stock_applied_at) }),
        );
      }
      return normalizeResponse(
        await grnService.update(row.grn_id, { release_to_inventory: !Boolean(row.release_to_inventory) }),
      );
    },
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ['grns', storeId] });
      if (detail?.grn_id && detail.grn_id === editor.grn_id) {
        setEditor(hydrateEditor(detail));
      }
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: (payload) => supplierService.create({ ...payload, store_id: Number(storeId) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grn-suppliers', storeId] }),
  });

  const updateSupplierMutation = useMutation({
    mutationFn: (payload) => supplierService.update(payload.supplier_id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grn-suppliers', storeId] }),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (supplierId) => supplierService.destroy(supplierId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grn-suppliers', storeId] }),
  });

  const fetchSupplierStatement = async (supplierId) => {
    const response = await supplierService.statement(supplierId);
    return response?.data || null;
  };

  const listRows = grnQuery.data?.rows || [];
  const listMeta = grnQuery.data?.meta || {};

  const stats = useMemo(() => {
    const completed = listRows.filter((row) => row.status === 'completed').length;
    const pending = listRows.filter((row) => row.status !== 'completed').length;
    const totalValue = listRows.reduce((sum, row) => sum + toNum(row.final_total || row.grand_total), 0);
    return { completed, pending, totalValue };
  }, [listRows]);

  const openNewEditor = () => {
    setEditor(DEFAULT_EDITOR);
    setMode('editor');
  };

  const openExisting = async (grnId) => {
    const detail = normalizeResponse(await grnService.show(grnId));
    setEditor(hydrateEditor(detail));
    setMode('editor');
  };

  const openPaymentForGrn = async (grnId) => {
    let detail = normalizeResponse(await grnService.show(grnId));

    if (detail.status !== 'completed') {
      detail = normalizeResponse(await grnService.complete(grnId, {
        release_to_inventory: Boolean(detail.release_to_inventory),
        notes: detail.notes || null,
      }));
    }

    setEditor(hydrateEditor(detail));
    setPaymentModalOpen(true);
  };


  const printGrnFromList = async (grnId) => {
    const detail = normalizeResponse(await grnService.show(grnId));
    openGrnPrint(detail, activeStore, 'invoice');
  };

  const isSaving =
    saveHeaderMutation.isPending ||
    saveItemMutation.isPending ||
    completeMutation.isPending ||
    chargeMutation.isPending ||
    initiateGrnStkMutation.isPending ||
    toggleReleaseMutation.isPending ||
    createSupplierMutation.isPending ||
    updateSupplierMutation.isPending;

  return (
    <section className="stack-lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="catalog-title" style={{ marginBottom: 6 }}>Goods Receipt Note</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="ghost-button" onClick={() => setSupplierModalOpen(true)}>
            <Users size={16} /> Suppliers
          </button>
          {mode === 'list' ? (
            <button type="button" className="primary-button" onClick={openNewEditor}>
              <Plus size={16} /> New GRN
            </button>
          ) : null}
        </div>
      </div>

      {mode === 'list' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
            <StatCard label="Completed GRN Count" value={stats.completed} helper="Fully posted intake notes" />
            <StatCard label="Pending GRN Count" value={stats.pending} helper="Draft or unreleased notes" />
            <StatCard label="Visible GRN Value" value={money(stats.totalValue, currencyCode)} helper={`Current branch: ${storeLabel}`} />
          </div>

          <article style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 22, padding: 18 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {PAYMENT_TABS.map((tab) => (
                <RangeButton key={tab.key} active={paymentStatus === tab.key} onClick={() => { setPaymentStatus(tab.key); setPage(1); }}>
                  {tab.label}
                </RangeButton>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.4fr) repeat(4, minmax(0, 1fr))', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <label className="catalog-search" style={{ marginBottom: 0 }}>
                <span className="catalog-search-icon"><Search size={16} /></span>
                <input
                  className="text-input"
                  placeholder="Search GRN no or supplier"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>

              <select className="select-input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="all">All states</option>
                <option value="draft">Pending / Draft</option>
                <option value="completed">Completed</option>
              </select>

              <select className="select-input" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
                <option value="">All suppliers</option>
                {(suppliersQuery.data || []).map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.supplier_name || supplier.name}
                  </option>
                ))}
              </select>

              <input
                className="text-input"
                placeholder="Item count min"
                type="number"
                min="0"
                value={itemCountMin}
                onChange={(e) => {
                  setItemCountMin(e.target.value);
                  setPage(1);
                }}
              />

              <input
                className="text-input"
                placeholder="Item count max"
                type="number"
                min="0"
                value={itemCountMax}
                onChange={(e) => {
                  setItemCountMax(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              {RANGE_OPTIONS.map((option) => (
                <RangeButton key={option.key} active={range === option.key} onClick={() => { setRange(option.key); setPage(1); }}>
                  {option.label}
                </RangeButton>
              ))}
            </div>

            {range === 'custom' ? (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarDays size={16} />
                  <input
                    className="text-input"
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarDays size={16} />
                  <input
                    className="text-input"
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>

                <input
                  className="text-input"
                  placeholder="Value min"
                  type="number"
                  min="0"
                  value={valueMin}
                  onChange={(e) => {
                    setValueMin(e.target.value);
                    setPage(1);
                  }}
                />

                <input
                  className="text-input"
                  placeholder="Value max"
                  type="number"
                  min="0"
                  value={valueMax}
                  onChange={(e) => {
                    setValueMax(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 220px))', gap: 12, marginBottom: 16 }}>
                <input
                  className="text-input"
                  placeholder="Value min"
                  type="number"
                  min="0"
                  value={valueMin}
                  onChange={(e) => {
                    setValueMin(e.target.value);
                    setPage(1);
                  }}
                />
                <input
                  className="text-input"
                  placeholder="Value max"
                  type="number"
                  min="0"
                  value={valueMax}
                  onChange={(e) => {
                    setValueMax(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}

            <div style={{ border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>GRN No. / Add</th>
                    <th>Supplier Name</th>
                    <th>Item Count</th>
                    <th>Qty</th>
                    <th>Comment</th>
                    <th>Status</th>
                    <th>Store Branch</th>
                    <th className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grnQuery.isLoading ? (
                    <tr><td colSpan={8} className="catalog-empty-cell">Loading GRNs…</td></tr>
                  ) : !listRows.length ? (
                    <tr><td colSpan={8} className="catalog-empty-cell">No GRN records found.</td></tr>
                  ) : (
                    listRows.map((row) => (
                      <tr key={row.grn_id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <strong>{row.grn_number || `GRN-${row.grn_id}`}</strong>
                            <button
                              type="button"
                              className={row.stock_applied_at || row.release_to_inventory ? 'ghost-button' : 'primary-button'}
                              style={{ alignSelf: 'flex-start', padding: '6px 10px', minHeight: 'unset' }}
                              onClick={() => toggleReleaseMutation.mutate(row)}
                              disabled={toggleReleaseMutation.isPending}
                              title={row.stock_applied_at ? 'Already posted to inventory' : 'Toggle inventory release'}
                            >
                              {row.stock_applied_at || row.release_to_inventory ? <Check size={14} /> : <X size={14} />}{' '}
                              {getInventoryReleaseLabel(row)}
                            </button>
                          </div>
                        </td>

                        <td>{row.supplier?.supplier_name || row.supplier_name || '—'}</td>
                        <td>{row.items_count || row.items?.length || 0}</td>
                        <td>{row.total_qty ?? ((row.items || []).reduce((sum, item) => sum + toNum(item.qty_received), 0) || '—')}</td>
                        <td>
                          {(row.items || [])
                            .map((item) => item.notes)
                            .filter(Boolean)
                            .join('; ') || '—'}
                        </td>

                        <td>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <span className={`inv-status-pill ${getStatusClass(row.status)}`}>
                              {row.status === 'completed' ? 'Completed' : 'Pending'}
                            </span>
                            <span className={`inv-status-pill ${getStatusClass(row.payment_status)}`}>
                              {String(row.payment_status || 'unpaid').toUpperCase()}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                              Balance: {money(row.balance_due, currencyCode)}
                            </span>
                          </div>
                        </td>

                        <td>{row.store?.store_name || storeLabel}</td>

                        <td className="align-right">
                          <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button type="button" className="icon-button" title={row.status === 'completed' ? 'View' : 'Edit'} onClick={() => openExisting(row.grn_id)}>
                              <Eye size={15} />
                            </button>
                            <button type="button" className="icon-button" title="Print" onClick={() => printGrnFromList(row.grn_id)}>
                              <Printer size={15} />
                            </button>
                            <button type="button" className="icon-button" title="Log" onClick={() => openExisting(row.grn_id)}>
                              <Pencil size={15} />
                            </button>
                            {toNum(row.balance_due) > 0 ? (
                              <button type="button" className="icon-button" title="Record Deposit / Final Payment" onClick={() => openPaymentForGrn(row.grn_id)}>
                                <Wallet size={15} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, color: 'var(--muted)', fontSize: 13 }}>
              <span>Page {listMeta.current_page || 1} of {listMeta.last_page || 1}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={(listMeta.current_page || 1) <= 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={(listMeta.current_page || 1) >= (listMeta.last_page || 1)}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </article>
        </>
      ) : (
        <EditorScreen
          editor={editor}
          setEditor={setEditor}
          currencyCode={currencyCode}
          storeLabel={storeLabel}
          suppliers={suppliersQuery.data || []}
          suppliersLoading={suppliersQuery.isLoading}
          onBack={() => setMode('list')}
          onSaveDraft={() => saveHeaderMutation.mutate(recalcEditor(editor))}
          onSaveAsCredit={() => completeMutation.mutate({ nextEditor: recalcEditor(editor), payNow: false })}
          onSaveAndPay={() => completeMutation.mutate({ nextEditor: recalcEditor(editor), payNow: true })}
          onDeleteItem={(item) => deleteItemMutation.mutate(item)}
          onOpenItemModal={(item) => {
            setEditingItem(item ? recalcItem(item) : DEFAULT_ITEM);
            setItemModalOpen(true);
          }}
          onPrintInvoice={async () => {
            let detail = editor;
            if (!editor.grn_id) {
              detail = normalizeResponse(await grnService.createDraft(buildHeaderPayload(recalcEditor(editor), storeId)));
              detail = normalizeResponse(await grnService.show(detail.grn_id));
              setEditor(hydrateEditor(detail));
            }
            openGrnPrint(detail, activeStore, 'invoice');
          }}
          onRecordPayment={async () => {
            let detail = editor.grn_id
              ? normalizeResponse(await grnService.show(editor.grn_id))
              : normalizeResponse(await grnService.createDraft(buildHeaderPayload(recalcEditor(editor), storeId)));

            if (detail.status !== 'completed') {
              if (!detail.items?.length && editor.items?.length) {
                for (const item of editor.items) {
                  await grnService.addItem(detail.grn_id, buildItemPayload(item));
                }
              }

              await grnService.update(detail.grn_id, buildHeaderPayload(recalcEditor(editor), storeId));

              detail = normalizeResponse(await grnService.complete(detail.grn_id, {
                release_to_inventory: Boolean(recalcEditor(editor).release_to_inventory),
                notes: recalcEditor(editor).notes || null,
              }));
            }

            const normalizedDetail =
              detail.grn_id && !detail.items
                ? normalizeResponse(await grnService.show(detail.grn_id))
                : detail;

            setEditor(hydrateEditor(normalizedDetail));
            setPaymentModalOpen(true);
          }}

          onOpenSupplierModal={() => setSupplierModalOpen(true)}
          saving={isSaving}
        />
      )}

      <ItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        products={productsQuery.data || []}
        productsLoading={productsQuery.isLoading}
        initialItem={editingItem}
        onSubmit={(item) => saveItemMutation.mutate({ currentEditor: recalcEditor(editor), item })}
      />

      <GrnPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        grn={editor}
        currency={(value) => money(value, currencyCode)}
        submitting={chargeMutation.isPending}
        stkSubmitting={initiateGrnStkMutation.isPending}
        onCharge={(payload) => chargeMutation.mutateAsync(payload)}
        onInitiateStk={(payload) => initiateGrnStkMutation.mutateAsync(payload)}
      />

      <MpesaStkModal
        isOpen={Boolean(stkSession?.checkoutRequestId)}
        checkoutRequestId={stkSession?.checkoutRequestId}
        phone={stkSession?.phone}
        amount={stkSession?.amount}
        currency={(value, code) => money(value, code || currencyCode)}
        storeCurrency={currencyCode}
        pollingIntervalMs={stkSession?.pollingIntervalMs || 3000}
        pollingTimeoutMs={stkSession?.pollingTimeoutMs || 120000}
        onSuccess={async () => {
          const detail = normalizeResponse(await grnService.show(editor.grn_id));
          setEditor(hydrateEditor(detail));
          setPaymentModalOpen(false);
          setStkSession(null);
          openGrnPrint(detail, activeStore, 'receipt');
          queryClient.invalidateQueries({ queryKey: ['grns', storeId] });
        }}
        onFailure={() => {
          setStkSession(null);
        }}
        onClose={() => setStkSession(null)}
      />


      <SupplierManagerModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        suppliers={suppliersQuery.data || []}
        suppliersLoading={suppliersQuery.isLoading}
        currencyCode={currencyCode}
        onCreate={(payload) => createSupplierMutation.mutateAsync(payload)}
        onUpdate={(payload) => updateSupplierMutation.mutateAsync(payload)}
        onDelete={(supplierId) => deleteSupplierMutation.mutate(supplierId)}
        saving={createSupplierMutation.isPending || updateSupplierMutation.isPending}
        onFetchStatement={fetchSupplierStatement}
      />
    </section>
  );
}
