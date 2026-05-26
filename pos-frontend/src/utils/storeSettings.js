export const defaultStoreSettings = {
  default_vat_rate: 15,
  low_stock_alert: 5,

  spacious_layout: true,
  show_product_images: true,

  receipt_header: '',
  invoice_header: '',
  receipt_footer: 'Thank you for your purchase.',
  invoice_footer: 'Goods once sold are not returnable.',

  show_barcode: true,
  show_qrcode: true,
  show_vat_summary: true,
  show_customer_on_print: true,
  show_cashier_on_print: true,
  show_logo_on_print: true,
  show_store_contacts_on_print: true,
  show_store_pin_on_print: true,
  show_payment_method_on_print: true,

  paper_width: 80,
  print_delay_ms: 300,
};

export const mergeStoreSettings = (storeOrSettings = {}) => {
  const raw =
    storeOrSettings && typeof storeOrSettings === 'object' && 'settings' in storeOrSettings
      ? storeOrSettings.settings || {}
      : storeOrSettings || {};

  return {
    ...defaultStoreSettings,
    ...raw,
  };
};
