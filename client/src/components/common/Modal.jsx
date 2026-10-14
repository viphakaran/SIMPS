import React, { useEffect, useState } from 'react';

export function Modal({ isOpen, onClose, title, children, footer, size = '' }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-dialog-centered ${size}`}>
          <div className="modal-content shadow">
            <div className="modal-header border-bottom py-3">
              <h2 className="modal-title h5 mb-0 fw-semibold text-dark">{title}</h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body p-4">{children}</div>
            {footer && <div className="modal-footer border-top py-2 px-4">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  loading = false
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn btn-${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-1" role="status"></span>
            ) : null}
            {confirmText}
          </button>
        </div>
      }
    >
      <p className="mb-0 text-muted">{message}</p>
    </Modal>
  );
}

export function ConfirmReason({
  isOpen,
  onClose,
  onConfirm,
  title = 'Provide Reason',
  message = 'Please provide a reason to proceed with this action.',
  placeholder = 'Enter reason here...',
  confirmText = 'Submit',
  confirmVariant = 'danger',
  loading = false,
  required = true
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (required && !reason.trim()) {
      setError('A reason is required.');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-${confirmVariant}`}
            onClick={handleSubmit}
            disabled={loading || (required && !reason.trim())}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-1" role="status"></span>
            ) : null}
            {confirmText}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <p className="text-muted small mb-3">{message}</p>
        <div className="mb-2">
          <textarea
            className={`form-control ${error ? 'is-invalid' : ''}`}
            rows="3"
            placeholder={placeholder}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            disabled={loading}
            autoFocus
          ></textarea>
          {error && <div className="invalid-feedback d-block small mt-1">{error}</div>}
        </div>
      </form>
    </Modal>
  );
}

export default Modal;
