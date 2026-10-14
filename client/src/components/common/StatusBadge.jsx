import React from 'react';

const STATUS_COLOR_MAP = {
  // Success
  IN_STOCK: 'bg-success',
  APPROVED: 'bg-success',
  RECEIVED: 'bg-success',
  ACTIVE: 'bg-success',
  DELIVERED: 'bg-success',

  // Warning
  LOW: 'bg-warning text-dark',
  PENDING_HOD: 'bg-warning text-dark',
  PENDING_PRINCIPAL: 'bg-warning text-dark',
  PENDING: 'bg-warning text-dark',
  PLACED: 'bg-warning text-dark',
  CONFIRMED: 'bg-warning text-dark',

  // Info
  SHIPPED: 'bg-info text-dark',
  ORDERED: 'bg-info text-dark',

  // Danger
  OUT: 'bg-danger',
  REJECTED: 'bg-danger',
  CANCELLED: 'bg-danger',
  DISABLED: 'bg-danger',
  RETURNED_BY_PROCUREMENT: 'bg-danger'
};

const STATUS_LABEL_MAP = {
  IN_STOCK: 'In Stock',
  OUT: 'Out of Stock',
  LOW: 'Low Stock',
  PENDING_HOD: 'Pending HoD',
  PENDING_PRINCIPAL: 'Pending Principal',
  RETURNED_BY_PROCUREMENT: 'Returned by Procurement',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  PENDING: 'Pending',
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  RECEIVED: 'Received',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  ORDERED: 'Ordered'
};

export function StatusBadge({ status, className = '' }) {
  if (!status) return null;

  const badgeClass = STATUS_COLOR_MAP[status] || 'bg-secondary';
  const label = STATUS_LABEL_MAP[status] || status;

  return (
    <span className={`badge ${badgeClass} fw-medium px-2 py-1 ${className}`}>
      {label}
    </span>
  );
}

export default StatusBadge;
