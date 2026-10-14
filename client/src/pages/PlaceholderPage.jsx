import React from 'react';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';

export function PlaceholderPage({ title = 'Module', description = 'This feature is scheduled for implementation in the next phase.' }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <div className="text-center py-5">
          <div
            className="rounded-circle bg-light text-primary d-inline-flex align-items-center justify-content-center mx-auto mb-3"
            style={{ width: '56px', height: '56px' }}
          >
            <i className="bi bi-cone-striped fs-3 text-warning"></i>
          </div>
          <h5 className="fw-semibold text-dark mb-1">{title} — Coming Soon</h5>
          <p className="text-muted small mb-0" style={{ maxWidth: '420px', margin: '0 auto' }}>
            This screen is actively under development as part of the SmartInv procurement & inventory workflow.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default PlaceholderPage;
