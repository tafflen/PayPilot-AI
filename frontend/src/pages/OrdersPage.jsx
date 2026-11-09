import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  UploadCloud,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState(null);

  // Detail drawer / modal
  const [viewingOrder, setViewingOrder] = useState(null);
  const [viewingOrderDetails, setViewingOrderDetails] = useState(null);

  // PayPal interaction state
  const [initiatingPayPalId, setInitiatingPayPalId] = useState(null);
  const [paypalFeedback, setPaypalFeedback] = useState(null);

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

  // Handle return redirect from PayPal Sandbox checkout
  useEffect(() => {
    const isSuccess = searchParams.get('paypal_success') === 'true';
    const isCancelled = searchParams.get('paypal_cancelled') === 'true';
    const token = searchParams.get('token'); // PayPal Order ID
    const orderRef = searchParams.get('orderRef');

    if (isSuccess && token) {
      setPaypalFeedback({
        type: 'processing',
        message: `Finalizing PayPal Sandbox payment for order ${orderRef || token}... Capturing funds.`,
      });

      // Clear query params from URL so refresh does not trigger repeated captures
      setSearchParams({}, { replace: true });

      api.paypal
        .captureOrder({ paypalOrderId: token, orderRef })
        .then((res) => {
          const captureRef = res.data?.payment?.transactionRef || token;
          setPaypalFeedback({
            type: 'success',
            message: `PayPal Sandbox payment captured and verified! Capture ID: ${captureRef}`,
          });
          fetchOrders();
        })
        .catch((err) => {
          setPaypalFeedback({
            type: 'error',
            message: `PayPal capture failed: ${err.message}`,
          });
        });
    } else if (isCancelled) {
      setPaypalFeedback({
        type: 'warning',
        message: `PayPal Sandbox payment checkout was cancelled by the buyer${orderRef ? ` for order ${orderRef}` : ''}.`,
      });
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleOpenDetail = async (order) => {
    setViewingOrder(order);
    try {
      const res = await api.orders.getById(order._id);
      setViewingOrderDetails(res.data);
    } catch (err) {
      console.error('Failed to load order details:', err);
    }
  };

  const handlePayWithPayPal = async (order) => {
    if (!order) return;
    setInitiatingPayPalId(order._id);
    setPaypalFeedback(null);

    try {
      const res = await api.paypal.createOrder({
        orderId: order._id,
        orderRef: order.orderRef,
      });

      if (res.data?.approvalUrl) {
        window.location.href = res.data.approvalUrl;
      } else {
        throw new Error('PayPal did not return an approval URL.');
      }
    } catch (err) {
      setPaypalFeedback({
        type: 'error',
        message: `Could not initialize PayPal checkout: ${err.message}`,
      });
      setInitiatingPayPalId(null);
    }
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
          {o.status !== 'paid' && (
            <button
              className="btn btn-secondary btn-sm"
              title="Pay with PayPal Sandbox"
              disabled={initiatingPayPalId === o._id}
              onClick={(e) => {
                e.stopPropagation();
                handlePayWithPayPal(o);
              }}
              style={{
                borderColor: 'var(--accent-teal)',
                color: 'var(--accent-teal)',
              }}
            >
              {initiatingPayPalId === o._id ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <CreditCard size={13} />
              )}
            </button>
          )}
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

      {/* PayPal Feedback Banner */}
      {paypalFeedback && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            backgroundColor:
              paypalFeedback.type === 'success'
                ? 'var(--status-success-bg)'
                : paypalFeedback.type === 'warning'
                ? 'var(--status-warning-bg)'
                : paypalFeedback.type === 'error'
                ? 'var(--status-danger-bg)'
                : 'rgba(6, 182, 212, 0.15)',
            border: `1px solid ${
              paypalFeedback.type === 'success'
                ? 'var(--status-success-border)'
                : paypalFeedback.type === 'warning'
                ? 'var(--status-warning-border)'
                : paypalFeedback.type === 'error'
                ? 'var(--status-danger-border)'
                : 'var(--border-focus)'
            }`,
            color:
              paypalFeedback.type === 'success'
                ? 'var(--status-success)'
                : paypalFeedback.type === 'warning'
                ? 'var(--status-warning)'
                : paypalFeedback.type === 'error'
                ? 'var(--status-danger)'
                : 'var(--accent-teal)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {paypalFeedback.type === 'processing' && <Loader2 size={18} className="spin" />}
            {paypalFeedback.type === 'success' && <CheckCircle2 size={18} />}
            {paypalFeedback.type === 'warning' && <AlertTriangle size={18} />}
            {paypalFeedback.type === 'error' && <XCircle size={18} />}
            <span>{paypalFeedback.message}</span>
          </div>
          <button
            className="btn-ghost"
            style={{ border: 'none', color: 'inherit', padding: '0.2rem', cursor: 'pointer', fontSize: '1.2rem', background: 'none' }}
            onClick={() => setPaypalFeedback(null)}
          >
            &times;
          </button>
        </div>
      )}

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

      {/* Order Detail Modal with linked payments and incidents */}
      {viewingOrder && viewingOrderDetails && (
        <div className="modal-backdrop" onClick={() => setViewingOrder(null)}>
          <div className="modal-card" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
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

              {/* PayPal Sandbox Checkout Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={18} color="var(--accent-teal)" />
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                      PayPal Sandbox Checkout
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      backgroundColor: 'rgba(6, 182, 212, 0.12)',
                      color: 'var(--accent-teal)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    Sandbox Environment
                  </span>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Process customer payment via PayPal Sandbox. Amount is dynamically retrieved from MongoDB and verified upon capture.
                </p>

                {viewingOrderDetails.order.status === 'paid' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', fontSize: '0.85rem' }}>
                    <CheckCircle2 size={16} />
                    <span>Order is already fully paid. No further payment required.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Charge Amount: </span>
                      <strong className="font-mono text-teal">
                        {formatCurrency(viewingOrderDetails.order.expectedAmount, viewingOrderDetails.order.currency)}
                      </strong>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={initiatingPayPalId === viewingOrderDetails.order._id}
                      onClick={() => handlePayWithPayPal(viewingOrderDetails.order)}
                    >
                      {initiatingPayPalId === viewingOrderDetails.order._id ? (
                        <>
                          <Loader2 size={14} className="spin" /> Opening PayPal...
                        </>
                      ) : (
                        <>
                          <ExternalLink size={14} /> Pay with PayPal Sandbox
                        </>
                      )}
                    </button>
                  </div>
                )}
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
