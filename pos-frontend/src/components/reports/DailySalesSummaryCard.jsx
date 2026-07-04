import { memo } from 'react';
import { currency } from '../../utils/helpers';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function DailySalesSummaryCard({
  title = 'Daily sales summary',
  rows = [],
  currentCurrency = 'KES',
  className = '',
  emptyText = 'No cashier shift has been opened yet.',
  showCarryForward = false,
}) {
  return (
    <article className={className}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p style={{ margin: '6px 0 0', color: 'var(--muted, #64748b)' }}>
            Opening balance, cash sales, non-cash sales, expected drawer cash, and variance by cashier.
          </p>
        </div>
        <div style={{ fontWeight: 700, color: '#0f766e' }}>
          {currency(rows.reduce((sum, row) => sum + toNumber(row.total_sales), 0), currentCurrency)}
        </div>
      </div>

      {!rows.length ? (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.12)', color: '#475569' }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: showCarryForward ? 900 : 780 }}>
            <thead>
              <tr>
                <th style={thStyle}>Cashier</th>
                <th style={thStyle}>Store</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Opening</th>
                {showCarryForward && <th style={thStyle}>Carry-Fwd</th>}
                <th style={thStyle}>Cash sales</th>
                <th style={thStyle}>Non-cash</th>
                <th style={thStyle}>Total sales</th>
                <th style={thStyle}>Expected cash</th>
                <th style={thStyle}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const variance = row.variance;
                const varianceColor = variance == null ? '#64748b' : variance < 0 ? '#b91c1c' : variance > 0 ? '#15803d' : '#0f766e';
                const carryFwd = toNumber(row.carry_forward_variance);

                return (
                  <tr key={`${row.store_id}-${row.cashier_user_id}-${index}`}>
                    <td style={tdStyle}>
                      <strong>{row.cashier_name || 'Cashier'}</strong>
                      <div style={subStyle}>
                        {row.business_date || 'Today'}
                        {row.closed_by_name && row.status === 'closed' && (
                          <span style={{ marginLeft: 6, color: '#92a0ae' }}>
                            · closed by {row.closed_by_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>{row.store_name || 'Store'}</td>
                    <td style={tdStyle}>
                      <span style={statusPillStyle(row.status)}>{row.status || 'not opened'}</span>
                    </td>
                    <td style={tdStyle}>{currency(row.opening_balance, currentCurrency)}</td>
                    {showCarryForward && (
                      <td style={{ ...tdStyle, color: carryFwd !== 0 ? (carryFwd < 0 ? '#b91c1c' : '#15803d') : '#92a0ae', fontWeight: carryFwd !== 0 ? 700 : 400 }}>
                        {carryFwd !== 0 ? `${carryFwd < 0 ? '-' : '+'}${currency(Math.abs(carryFwd), currentCurrency)}` : '—'}
                      </td>
                    )}
                    <td style={tdStyle}>{currency(row.cash_sales, currentCurrency)}</td>
                    <td style={tdStyle}>{currency(row.non_cash_sales, currentCurrency)}</td>
                    <td style={tdStyle}>{currency(row.total_sales, currentCurrency)}</td>
                    <td style={tdStyle}>{currency(row.expected_cash, currentCurrency)}</td>
                    <td style={{ ...tdStyle, color: varianceColor, fontWeight: 700 }}>
                      {variance == null ? '—' : currency(variance, currentCurrency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#64748b',
  borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
};

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
  verticalAlign: 'top',
};

const subStyle = {
  marginTop: 4,
  color: '#64748b',
  fontSize: 12,
};

const statusPillStyle = (status) => {
  const safe = String(status || '').toLowerCase();
  const background = safe === 'closed' ? 'rgba(22, 163, 74, 0.12)' : safe === 'open' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(148, 163, 184, 0.16)';
  const color = safe === 'closed' ? '#166534' : safe === 'open' ? '#1d4ed8' : '#475569';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'capitalize',
  };
};

export default memo(DailySalesSummaryCard);
