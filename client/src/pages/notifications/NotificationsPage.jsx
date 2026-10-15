import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { LoadingState, ErrorState } from '../../components/common/LoadingState.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';

export function NotificationsPage() {
  const { showSuccess } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        pageSize: 50
      };
      if (onlyUnread) {
        params.unread = 'true';
      }
      const res = await apiClient.get('/notifications', { params });
      setNotifications(res.data.data || res.data || []);
      setUnreadCount(res.data.unreadCount ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [onlyUnread]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkOneRead = async (notif) => {
    if (notif.isRead) return;
    try {
      await apiClient.patch(`/notifications/${notif.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Non-blocking
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      showSuccess('All notifications marked as read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || 'Failed to mark all as read');
    }
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'LOW_STOCK':
        return <span className="badge bg-danger"><i className="bi bi-exclamation-triangle-fill me-1"></i>Low Stock</span>;
      case 'REQUEST_SUBMITTED':
        return <span className="badge bg-primary"><i className="bi bi-file-earmark-plus me-1"></i>Requisition</span>;
      case 'REQUEST_APPROVED':
        return <span className="badge bg-success"><i className="bi bi-check-circle-fill me-1"></i>Approved</span>;
      case 'REQUEST_DECIDED':
        return <span className="badge bg-info text-dark"><i className="bi bi-bell me-1"></i>Status Update</span>;
      case 'REQUEST_RETURNED':
        return <span className="badge bg-warning text-dark"><i className="bi bi-arrow-return-left me-1"></i>Returned</span>;
      case 'PO_PLACED':
        return <span className="badge bg-primary"><i className="bi bi-cart me-1"></i>PO Placed</span>;
      case 'PO_RECEIVED':
        return <span className="badge bg-success"><i className="bi bi-box-seam me-1"></i>Goods Received</span>;
      case 'ACCOUNT_APPROVED':
        return <span className="badge bg-success"><i className="bi bi-person-check-fill me-1"></i>Account Active</span>;
      default:
        return <span className="badge bg-secondary">{type || 'Notification'}</span>;
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Institutional procurement alerts, inventory updates, and requisition approvals."
        action={
          unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
              onClick={handleMarkAllRead}
            >
              <i className="bi bi-check2-all"></i>
              <span>Mark all as read</span>
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className={`btn ${!onlyUnread ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setOnlyUnread(false)}
          >
            All Notifications
          </button>
          <button
            type="button"
            className={`btn ${onlyUnread ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setOnlyUnread(true)}
          >
            Unread Only {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState title="Failed to load notifications" message={error} onRetry={fetchNotifications} />
      ) : loading ? (
        <LoadingState message="Loading your notification inbox..." />
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            title={onlyUnread ? 'No unread notifications' : 'Your notification inbox is empty'}
            message="Alerts regarding purchase orders, approvals, and inventory changes will appear here."
          />
        </Card>
      ) : (
        <div className="card shadow-sm border overflow-hidden">
          <div className="list-group list-group-flush">
            {notifications.map((n) => {
              const isUnread = !n.isRead;
              return (
                <div
                  key={n.id}
                  className={`list-group-item p-3 list-group-item-action border-bottom ${
                    isUnread ? 'bg-light border-start border-primary border-4' : ''
                  }`}
                  style={{ cursor: isUnread ? 'pointer' : 'default' }}
                  onClick={() => handleMarkOneRead(n)}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                    <div className="d-flex align-items-center gap-2">
                      {getEventBadge(n.type)}
                      <h3 className={`h6 mb-0 ${isUnread ? 'fw-bold text-dark' : 'fw-semibold text-secondary'}`}>
                        {n.title}
                      </h3>
                      {isUnread && (
                        <span className="badge rounded-pill bg-primary" style={{ fontSize: '8px' }}>
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-muted small">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <p className="mb-0 text-muted small ps-1">{n.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
