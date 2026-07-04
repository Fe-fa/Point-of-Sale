const DEFAULT_SEQUENCE_MAP = {
  receipt: {
    prefix: 'REC-',
    suffix: '',
    last_number: 0,
  },
  invoice: {
    prefix: 'INV-',
    suffix: '',
    last_number: 0,
  },
  order: {
    prefix: 'ORD-',
    suffix: '',
    last_number: 0,
  },
  packing_slip: {
    prefix: 'PKG-',
    suffix: '',
    last_number: 0,
  },
};

const DEFAULT_MPESA_SETTINGS = {
  enabled: false,
  environment: 'sandbox',
  shortcode_type: 'paybill',
  shortcode: '',
  till_number: '',
  consumer_key: '',
  consumer_secret: '',
  passkey: '',
  callback_base_url: '',
  account_reference_prefix: '',
  consumer_key_set: false,
  consumer_secret_set: false,
  passkey_set: false,
};

const DEFAULT_STORE_SETTINGS = {
  default_vat_rate: 15,
  low_stock_alert: 5,

  spacious_layout: true,
  show_product_images: true,
  receipt_layout: 'default',

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

  document_sequences: DEFAULT_SEQUENCE_MAP,
  mpesa: DEFAULT_MPESA_SETTINGS,
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
};

const toText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const normalizeSequencesFromArray = (sequenceArray = []) => {
  if (!Array.isArray(sequenceArray)) return {};

  return sequenceArray.reduce((acc, item) => {
    if (!item?.document_type) return acc;

    acc[item.document_type] = {
      prefix: item.prefix ?? '',
      suffix: item.suffix ?? '',
      last_number: toNumber(item.last_number, 0),
    };

    return acc;
  }, {});
};

const resolveMpesaSource = (source = {}) => {
  if (source?.mpesa && typeof source.mpesa === 'object' && !Array.isArray(source.mpesa)) {
    return source.mpesa;
  }

  return {
    enabled: source?.mpesa_enabled,
    environment: source?.mpesa_environment,
    shortcode_type: source?.mpesa_shortcode_type,
    shortcode: source?.mpesa_shortcode,
    till_number: source?.mpesa_till_number,
    consumer_key: source?.mpesa_consumer_key,
    consumer_secret: source?.mpesa_consumer_secret,
    passkey: source?.mpesa_passkey,
    callback_base_url: source?.mpesa_callback_base_url,
    account_reference_prefix: source?.mpesa_account_reference_prefix,
    consumer_key_set: source?.mpesa_consumer_key_set,
    consumer_secret_set: source?.mpesa_consumer_secret_set,
    passkey_set: source?.mpesa_passkey_set,
  };
};

export function mergeStoreSettings(source = {}) {
  const rawSettings =
    source?.settings && !Array.isArray(source.settings)
      ? source.settings
      : source?.settings ?? source ?? {};

  const sequenceMap =
    source?.document_sequences && !Array.isArray(source.document_sequences)
      ? source.document_sequences
      : normalizeSequencesFromArray(source?.document_sequences ?? source?.documentSequences ?? []);

  const rawMpesa = resolveMpesaSource(source);

  return {
    ...DEFAULT_STORE_SETTINGS,

    default_vat_rate: toNumber(rawSettings.default_vat_rate, DEFAULT_STORE_SETTINGS.default_vat_rate),
    low_stock_alert: toNumber(rawSettings.low_stock_alert, DEFAULT_STORE_SETTINGS.low_stock_alert),

    spacious_layout: toBoolean(rawSettings.spacious_layout, DEFAULT_STORE_SETTINGS.spacious_layout),
    show_product_images: toBoolean(rawSettings.show_product_images, DEFAULT_STORE_SETTINGS.show_product_images),
    receipt_layout: ['default', 'compact', 'detailed'].includes(rawSettings.receipt_layout)
      ? rawSettings.receipt_layout
      : DEFAULT_STORE_SETTINGS.receipt_layout,

    receipt_header: rawSettings.receipt_header ?? DEFAULT_STORE_SETTINGS.receipt_header,
    invoice_header: rawSettings.invoice_header ?? DEFAULT_STORE_SETTINGS.invoice_header,
    receipt_footer: rawSettings.receipt_footer ?? DEFAULT_STORE_SETTINGS.receipt_footer,
    invoice_footer: rawSettings.invoice_footer ?? DEFAULT_STORE_SETTINGS.invoice_footer,

    show_barcode: toBoolean(rawSettings.show_barcode, DEFAULT_STORE_SETTINGS.show_barcode),
    show_qrcode: toBoolean(rawSettings.show_qrcode, DEFAULT_STORE_SETTINGS.show_qrcode),
    show_vat_summary: toBoolean(rawSettings.show_vat_summary, DEFAULT_STORE_SETTINGS.show_vat_summary),
    show_customer_on_print: toBoolean(rawSettings.show_customer_on_print, DEFAULT_STORE_SETTINGS.show_customer_on_print),
    show_cashier_on_print: toBoolean(rawSettings.show_cashier_on_print, DEFAULT_STORE_SETTINGS.show_cashier_on_print),
    show_logo_on_print: toBoolean(rawSettings.show_logo_on_print, DEFAULT_STORE_SETTINGS.show_logo_on_print),
    show_store_contacts_on_print: toBoolean(rawSettings.show_store_contacts_on_print, DEFAULT_STORE_SETTINGS.show_store_contacts_on_print),
    show_store_pin_on_print: toBoolean(rawSettings.show_store_pin_on_print, DEFAULT_STORE_SETTINGS.show_store_pin_on_print),
    show_payment_method_on_print: toBoolean(rawSettings.show_payment_method_on_print, DEFAULT_STORE_SETTINGS.show_payment_method_on_print),

    paper_width: toNumber(rawSettings.paper_width, DEFAULT_STORE_SETTINGS.paper_width),
    print_delay_ms: toNumber(rawSettings.print_delay_ms, DEFAULT_STORE_SETTINGS.print_delay_ms),

    document_sequences: Object.fromEntries(
      Object.entries(DEFAULT_SEQUENCE_MAP).map(([key, defaults]) => [
        key,
        {
          ...defaults,
          ...(sequenceMap[key] ?? {}),
          last_number: toNumber(sequenceMap[key]?.last_number, defaults.last_number),
        },
      ])
    ),

    mpesa: {
      ...DEFAULT_MPESA_SETTINGS,
      enabled: toBoolean(rawMpesa.enabled, DEFAULT_MPESA_SETTINGS.enabled),
      environment: ['sandbox', 'production'].includes(rawMpesa.environment)
        ? rawMpesa.environment
        : DEFAULT_MPESA_SETTINGS.environment,
      shortcode_type: ['paybill', 'till'].includes(rawMpesa.shortcode_type)
        ? rawMpesa.shortcode_type
        : DEFAULT_MPESA_SETTINGS.shortcode_type,
      shortcode: toText(rawMpesa.shortcode, DEFAULT_MPESA_SETTINGS.shortcode),
      till_number: toText(rawMpesa.till_number, DEFAULT_MPESA_SETTINGS.till_number),
      consumer_key: toText(rawMpesa.consumer_key, DEFAULT_MPESA_SETTINGS.consumer_key),
      consumer_secret: toText(rawMpesa.consumer_secret, DEFAULT_MPESA_SETTINGS.consumer_secret),
      passkey: toText(rawMpesa.passkey, DEFAULT_MPESA_SETTINGS.passkey),
      callback_base_url: toText(rawMpesa.callback_base_url, DEFAULT_MPESA_SETTINGS.callback_base_url),
      account_reference_prefix: toText(rawMpesa.account_reference_prefix, DEFAULT_MPESA_SETTINGS.account_reference_prefix),
      consumer_key_set: toBoolean(rawMpesa.consumer_key_set, !!rawMpesa.consumer_key),
      consumer_secret_set: toBoolean(rawMpesa.consumer_secret_set, !!rawMpesa.consumer_secret),
      passkey_set: toBoolean(rawMpesa.passkey_set, !!rawMpesa.passkey),
    },
  };
}
