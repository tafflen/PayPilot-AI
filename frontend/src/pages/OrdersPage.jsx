import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  UploadCloud,
  Copy,
  Check,
  Link2,
  Calendar,
  User,
  FileText,
  CreditCard,
} from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchAndFilters } from '../components/common/SearchAndFilters';
import { OrderModal } from '../components/orders/OrderModal';
import { CsvImportModal } from '../components/common/CsvImportModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState(null);

  // Detail drawer / modal
  const [viewingOrder, setViewingOrder] = useState(null);
  const [viewingOrderDetails, setViewingOrderDetails] = useState(null);

  // Copy link feedback
  const [copiedOrderRef, setCopiedOrderRef] = useState(null);
  const [copiedModalLink, setCopiedModalLink] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;

      const res = await api.orders.list(params);
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, status]);

  const handleOpenDetail = async (order) => {
    setViewingOrder(order);
    try {
      const res = await api.orders.getById(order._id);
      setViewingOrderDetails(res.data);
    } catch (err) {
      console.error('Failed to load order details:', err);
    }
  };

  const handleCopyPaymentLink = (order, e) => {
    if (e) e.stopPropagation();
    const link = `${window.location.origin}/portal/invoices?orderRef=${order.orderRef}`;
    navigator.clipboard.writeText(link);
    setCopiedOrderRef(order.orderRef);
    setTimeout(() => setCopiedOrderRef(null), 2500);
  };

  const handleCopyModalPaymentLink = (orderRef) => {
    const link = `${window.location.origin}/portal/invoices?orderRef=${orderRef}`;
    navigator.clipboard.writeText(link);
    setCopiedModalLink(true);
    setTimeout(() => setCopiedModalLink(false), 2500);
  };

  const handleConfirmDelete = async (force = false) => {
    if (!orderToDelete) return;
    setDeleteErrorMessage(null);
    try {
      await api.orders.delete(orderToDelete._id, force);
      setOrderToDelete(null);
      fetchOrders();
    } catch (err) {
      setDeleteErrorMessage(err.message || 'Cannot delete order.');
    }
  };

  const columns = [
    {
      header: 'Order Ref',
      key: 'orderRef',
      render: (o) => (
        <span className="font-mono text-teal" style={{ fontWeight: 600 }}>
          {o.orderRef}
        </span>
      ),
    },
    {
      header: 'Customer',
      key: 'customerName',
      render: (o) => (
        <div>
          <div style={{ fontWeight: 500 }}>{o.customerName}</div>
          {o.customerEmail && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.customerEmail}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Description',
      key: 'description',
      render: (o) => (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {o.description}
        </span>
      ),
    },
    {
      header: 'Expected Amount',
      key: 'expectedAmount',
      render: (o) => (
        <span className="font-mono" style={{ fontWeight: 600 }}>
          {formatCurrency(o.expectedAmount, o.currency)}
        </span>
      ),
    },
    {
      header: 'Invoice Ref',
      key: 'invoiceRef',
      render: (o) => (
        <span className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {o.invoiceRef || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      header: 'Source',
      key: 'isDemo',
      render: (o) =>
        o.isDemo ? (
          <span className="badge badge-demo" style={{ fontSize: '0.72rem' }}>
            Demo Data
          </span>
        ) : (
          <span
            className="badge badge-imported"
            style={{
              fontSize: '0.72rem',
              backgroundColor: 'rgba(20, 184, 166, 0.15)',
              color: 'var(--accent-teal)',
            }}
          >
            Imported
          </span>
        ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (o) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          {/* Copy Customer Payment Link */}
          <button
            className="btn btn-secondary btn-sm"
            title="Copy Customer Payment Link"
            onClick={(e) => handleCopyPaymentLink(o, e)}
            style={{
              borderColor: copiedOrderRef === o.orderRef ? 'var(--status-success)' : undefined,
              color: copiedOrderRef === o.orderRef ? 'var(--status-success)' : undefined,
            }}
          >
            {copiedOrderRef === o.orderRef ? (
              <>
                <Check size={13} />
                <span style={{ fontSize: '0.72rem', marginLeft: '0.2rem' }}>Copied!</span>
              </>
            ) : (
              <>
                <Link2 size={13} />
                <span style={{ fontSize: '0.72rem', marginLeft: '0.2rem' }}>Payment Link</span>
              </>
            )}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            title="View Details & Ledger Matches"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail(o);
            }}
          >
            <Eye size={13} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            title="Edit Order"
            onClick={(e) => {
              e.stopPropagation();
              setEditingOrder(o);
              setIsOrderModalOpen(true);
            }}
          >
            <Edit2 size={13} />
          </button>
          <button
            className="btn btn-danger btn-sm"
            title="Delete Order (Safeguarded)"
            onClick={(e) => {
              e.stopPropagation();
              setOrderToDelete(o);
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <ShoppingCart size={24} color="var(--accent-teal)" /> Orders & Invoices Ledger
          </h1>
          <p className="page-subtitle">
            Contractual expectations, billing accounts, and expected settlement amounts
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchOrders}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsCsvModalOpen(true)}
          >
            <UploadCloud size={14} /> Import CSV
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingOrder(null);
              setIsOrderModalOpen(true);
            }}
          >
            <Plus size={14} /> Create Order
          </button>
        </div>
      </div>

      <SearchAndFilters
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by order ref, customer, invoice..."
        filters={[
          {
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'All Statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'partially_paid', label: 'Partially Paid' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        emptyTitle="No orders found"
        emptyDescription="Create your first billing order using the button above."
        onRowClick={handleOpenDetail}
      />

      {/* Order Create / Edit Modal */}
      <OrderModal
        isOpen={isOrderModalOpen}
        order={editingOrder}
        onClose={() => {
          setIsOrderModalOpen(false);
          setEditingOrder(null);
        }}
        onSuccess={fetchOrders}
      />

      {/* Safeguarded Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!orderToDelete}
        title={`Delete Order ${orderToDelete?.orderRef}`}
        message={
          deleteErrorMessage ||
          `Are you sure you want to delete order '${orderToDelete?.orderRef}'? If captured payments or open incidents exist, deletion will be blocked by safeguards.`
        }
        confirmLabel={deleteErrorMessage ? 'Force Delete Anyway' : 'Delete Order'}
        isDanger={true}
        onConfirm={() => handleConfirmDelete(!!deleteErrorMessage)}
        onCancel={() => {
          setOrderToDelete(null);
          setDeleteErrorMessage(null);
        }}
      />

      {/* Order Detail Modal with Customer Billing Details and Shareable Link */}
      {viewingOrder && viewingOrderDetails && (
        <div className="modal-backdrop" onClick={() => setViewingOrder(null)}>
          <div className="modal-card" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="font-mono text-teal">Order Details: {viewingOrderDetails.order.orderRef}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Customer: {viewingOrderDetails.order.customerName}
                </span>
              </div>
              <button className="btn-ghost" onClick={() => setViewingOrder(null)} style={{ border: 'none' }}>
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EXPECTED AMOUNT</div>
                  <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-teal)' }}>
                    {formatCurrency(viewingOrderDetails.order.expectedAmount, viewingOrderDetails.order.currency)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STATUS</div>
                  <StatusBadge status={viewingOrderDetails.order.status} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CREATED AT</div>
                  <div style={{ fontSize: '0.85rem' }}>{formatDateTime(viewingOrderDetails.order.createdAt)}</div>
                </div>
              </div>

              {/* Customer Billing & Invoice Information Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                  <User size={16} color="var(--accent-teal)" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Customer Billing Information</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Customer Name: </span>
                    <strong>{viewingOrderDetails.order.customerName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Billing Email: </span>
                    <span>{viewingOrderDetails.order.customerEmail || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Invoice Reference: </span>
                    <strong className="font-mono">{viewingOrderDetails.order.invoiceRef || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Due Date: </span>
                    <span>{viewingOrderDetails.order.dueDate ? formatDateTime(viewingOrderDetails.order.dueDate) : 'On Receipt'}</span>
                  </div>
                </div>
                {viewingOrderDetails.order.description && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-muted)' }}>Description: </strong>
                    {viewingOrderDetails.order.description}
                  </div>
                )}
              </div>

              {/* Line Items if available */}
              {viewingOrderDetails.order.items && viewingOrderDetails.order.items.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={15} color="var(--accent-teal)" /> Itemized Line Items ({viewingOrderDetails.order.items.length})
                  </h4>
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Item</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Unit Price</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingOrderDetails.order.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.name}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{item.quantity || 1}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }} className="font-mono">
                              {formatCurrency(item.unitPrice || 0, viewingOrderDetails.order.currency)}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }} className="font-mono">
                              {formatCurrency(item.total || (item.unitPrice * (item.quantity || 1)), viewingOrderDetails.order.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Customer Payment Portal Share Link */}
              <div
                style={{
                  backgroundColor: 'rgba(20, 184, 166, 0.08)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Link2 size={16} color="var(--accent-teal)" />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--accent-teal)' }}>
                      Customer Payment Portal Link
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      backgroundColor: 'rgba(20, 184, 166, 0.2)',
                      color: 'var(--accent-teal)',
                    }}
                  >
                    Customer Self-Service
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Share this secure payment link with your customer so they can view the invoice and complete settlement via PayPal Sandbox in their dedicated Customer Portal.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    readOnly
                    className="form-input font-mono"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.65rem', backgroundColor: 'var(--bg-input)' }}
                    value={`${window.location.origin}/portal/invoices?orderRef=${viewingOrderDetails.order.orderRef}`}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => handleCopyModalPaymentLink(viewingOrderDetails.order.orderRef)}
                  >
                    {copiedModalLink ? (
                      <>
                        <Check size={14} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Linked Payments */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  Linked Payment Transactions ({viewingOrderDetails.linkedPayments?.length || 0})
                </h4>
                {viewingOrderDetails.linkedPayments?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Zero payment transactions linked to this order ref yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {viewingOrderDetails.linkedPayments.map((p) => (
                      <div
                        key={p._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span className="font-mono">{p.transactionRef}</span>
                        <span className="font-mono">{formatCurrency(p.amount, p.currency)}</span>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Incidents */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  Linked Investigation Incidents ({viewingOrderDetails.linkedIncidents?.length || 0})
                </h4>
                {viewingOrderDetails.linkedIncidents?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    No discrepancies detected for this order.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {viewingOrderDetails.linkedIncidents.map((inc) => (
                      <div
                        key={inc._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span className="font-mono text-teal">{inc.incidentRef}</span>
                        <span>{inc.incidentType.replace(/_/g, ' ')}</span>
                        <StatusBadge status={inc.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewingOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        type="orders"
        onSuccess={fetchOrders}
      />
    </div>
  );
}

export default OrdersPage;
