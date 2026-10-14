import React from 'react';
import { LoadingState } from './LoadingState.jsx';
import { EmptyState } from './EmptyState.jsx';

export function DataTable({
  columns = [],
  data = [],
  loading = false,
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange = null,
  search = '',
  onSearchChange = null,
  searchPlaceholder = 'Search records...',
  emptyTitle = 'No records found',
  emptyMessage = 'Try adjusting your search or filters.',
  emptyAction = null,
  actions = null
}) {
  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="card">
      {(onSearchChange !== null || actions) && (
        <div className="card-header bg-white border-bottom p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          {onSearchChange !== null ? (
            <div className="input-group" style={{ maxWidth: '320px' }}>
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          ) : (
            <div></div>
          )}
          {actions && <div>{actions}</div>}
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              {columns.map((col, index) => (
                <th
                  key={col.key || index}
                  className={`text-muted small fw-semibold text-uppercase ${col.className || ''}`}
                  style={col.width ? { width: col.width } : {}}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <LoadingState rows={4} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={row.id || rowIndex}>
                  {columns.map((col, colIndex) => (
                    <td key={col.key || colIndex} className={col.className || ''}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 && onPageChange && (
        <div className="card-footer bg-white border-top py-3 px-4 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span className="text-muted small">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} records
          </span>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                <button
                  type="button"
                  className="page-link"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </button>
              </li>
              <li className="page-item disabled">
                <span className="page-link text-muted">
                  Page {page} of {totalPages}
                </span>
              </li>
              <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                <button
                  type="button"
                  className="page-link"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}

export default DataTable;
