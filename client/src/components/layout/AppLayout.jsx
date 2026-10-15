import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import apiClient from '../../api/client.js';
import { ChangePasswordModal } from '../auth/ChangePasswordModal.jsx';

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [demoDataPresent, setDemoDataPresent] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [offcanvasOpen, setOffcanvasOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);

  const handleToggleNotifMenu = async () => {
    const nextState = !notifMenuOpen;
    setNotifMenuOpen(nextState);
    if (nextState) {
      setUserMenuOpen(false);
      try {
        const res = await apiClient.get('/notifications?pageSize=5');
        setRecentNotifications(res.data.data || res.data || []);
      } catch {
        // Non-blocking
      }
    }
  };

  // Fetch demo data flag and notification unread count
  useEffect(() => {
    async function loadMetaAndNotifications() {
      try {
        const metaRes = await apiClient.get('/meta');
        setDemoDataPresent(Boolean(metaRes.data.demoDataPresent));
      } catch {
        // Meta fetch failure shouldn't block layout
      }

      if (user) {
        try {
          const notifRes = await apiClient.get('/notifications?unread=true');
          setUnreadCount(notifRes.data.unreadCount || 0);
        } catch {
          // Notification count failure shouldn't block layout
        }
      }
    }

    loadMetaAndNotifications();
  }, [user, location.pathname]);

  // Determine navigation items allowed for the logged in user's role
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2', roles: ['ALL'] },
    {
      label: 'Inventory',
      path: '/items',
      icon: 'bi-box-seam',
      roles: ['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']
    },
    {
      label: 'Reorder Suggestions',
      path: '/reorder',
      icon: 'bi-arrow-repeat',
      roles: ['STORE_MANAGER', 'PROCUREMENT_OFFICER']
    },
    {
      label: 'Purchase Requests',
      path: '/requests',
      icon: 'bi-file-earmark-text',
      roles: ['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']
    },
    {
      label: 'Approvals Queue',
      path: '/approvals',
      icon: 'bi-check2-circle',
      roles: ['HOD', 'PRINCIPAL']
    },
    {
      label: 'Procurement Processing',
      path: '/procurement',
      icon: 'bi-cart-check',
      roles: ['PROCUREMENT_OFFICER']
    },
    {
      label: 'Purchase Orders',
      path: '/orders',
      icon: 'bi-truck',
      roles: ['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER']
    },
    {
      label: 'Suppliers',
      path: '/suppliers',
      icon: 'bi-building',
      roles: ['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']
    },
    {
      label: 'Users',
      path: '/users',
      icon: 'bi-people',
      roles: ['ADMIN']
    },
    {
      label: 'Departments',
      path: '/departments',
      icon: 'bi-diagram-3',
      roles: ['ADMIN']
    },
    {
      label: 'Categories',
      path: '/categories',
      icon: 'bi-tags',
      roles: ['ADMIN']
    },
    {
      label: 'Reports & Analytics',
      path: '/reports',
      icon: 'bi-bar-chart-line',
      roles: ['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'HOD']
    },
    { label: 'Notifications', path: '/notifications', icon: 'bi-bell', roles: ['ALL'] }
  ];

  const allowedNavItems = navItems.filter((item) => {
    if (item.roles.includes('ALL')) return true;
    return user && item.roles.includes(user.role);
  });

  const renderNavLinks = () => (
    <nav className="sidebar-nav px-3">
      {allowedNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={() => setOffcanvasOpen(false)}
        >
          <i className={`bi ${item.icon} fs-6`}></i>
          <span>{item.label}</span>
          {item.path === '/notifications' && unreadCount > 0 && (
            <span className="badge bg-danger ms-auto rounded-pill">{unreadCount}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Desktop Fixed Sidebar */}
      <aside className="sidebar-wrapper">
        <div className="p-3 border-bottom d-flex align-items-center gap-2">
          <div className="bg-primary text-white rounded p-2 d-flex align-items-center justify-content-center">
            <i className="bi bi-box-fill fs-5"></i>
          </div>
          <div>
            <div className="fw-bold text-dark lh-1">SmartInv</div>
            <small className="text-muted" style={{ fontSize: '11px' }}>
              RIT Central Store
            </small>
          </div>
        </div>
        <div className="py-3 flex-grow-1 overflow-y-auto">{renderNavLinks()}</div>
        <div className="p-3 border-top bg-light text-muted small text-center">
          v1.0.0 &bull; Ramco Institute of Tech
        </div>
      </aside>

      {/* Mobile Offcanvas Sidebar */}
      <div
        className={`offcanvas offcanvas-start ${offcanvasOpen ? 'show' : ''}`}
        tabIndex="-1"
        style={{ visibility: offcanvasOpen ? 'visible' : 'hidden' }}
      >
        <div className="offcanvas-header border-bottom">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-primary text-white rounded p-2 d-flex align-items-center justify-content-center">
              <i className="bi bi-box-fill fs-5"></i>
            </div>
            <div>
              <div className="fw-bold text-dark lh-1">SmartInv</div>
              <small className="text-muted" style={{ fontSize: '11px' }}>
                RIT Central Store
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setOffcanvasOpen(false)}
          ></button>
        </div>
        <div className="offcanvas-body p-0 py-3">{renderNavLinks()}</div>
      </div>
      {offcanvasOpen && (
        <div
          className="offcanvas-backdrop fade show"
          onClick={() => setOffcanvasOpen(false)}
        ></div>
      )}

      {/* Top Navbar */}
      <header className="topbar-wrapper justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-lg-none"
            onClick={() => setOffcanvasOpen(true)}
            aria-label="Toggle navigation"
          >
            <i className="bi bi-list fs-5"></i>
          </button>
          {demoDataPresent && (
            <div className="demo-banner">
              <i className="bi bi-info-circle-fill"></i>
              <span>Demo data loaded</span>
            </div>
          )}
        </div>

        <div className="d-flex align-items-center gap-3">
          {/* Notification Bell Dropdown */}
          <div className={`dropdown ${notifMenuOpen ? 'show' : ''}`}>
            <button
              id="notif-menu-btn"
              type="button"
              className="btn btn-light position-relative p-2 rounded-circle"
              onClick={handleToggleNotifMenu}
              aria-expanded={notifMenuOpen}
              title="Notifications"
            >
              <i className="bi bi-bell text-muted fs-5"></i>
              {unreadCount > 0 && (
                <span
                  className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                  style={{ fontSize: '10px' }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                  <span className="visually-hidden">unread notifications</span>
                </span>
              )}
            </button>

            <ul
              className={`dropdown-menu dropdown-menu-end shadow border-0 mt-2 p-0 ${notifMenuOpen ? 'show' : ''}`}
              style={{ position: 'absolute', right: 0, left: 'auto', width: '320px', maxWidth: '90vw' }}
            >
              <li className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light rounded-top">
                <span className="fw-semibold text-dark small">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none small"
                    style={{ fontSize: '12px' }}
                    onClick={async () => {
                      try {
                        await apiClient.post('/notifications/read-all');
                        setUnreadCount(0);
                        setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
                      } catch {
                        // Non-blocking
                      }
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </li>

              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {recentNotifications.length === 0 ? (
                  <li className="p-3 text-center text-muted small">No notifications</li>
                ) : (
                  recentNotifications.map((n) => (
                    <li
                      key={n.id}
                      className={`p-2 px-3 border-bottom ${!n.isRead ? 'bg-light' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={async () => {
                        if (!n.isRead) {
                          try {
                            await apiClient.patch(`/notifications/${n.id}/read`);
                            setUnreadCount((c) => Math.max(0, c - 1));
                            setRecentNotifications((prev) =>
                              prev.map((item) => (item.id === n.id ? { ...item, isRead: 1 } : item))
                            );
                          } catch {
                            // Non-blocking
                          }
                        }
                        setNotifMenuOpen(false);
                        navigate('/notifications');
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <strong className="small text-dark" style={{ fontSize: '13px' }}>
                          {n.title}
                        </strong>
                        {!n.isRead && (
                          <span className="badge rounded-pill bg-primary" style={{ fontSize: '7px' }}>
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-muted small text-truncate" style={{ fontSize: '12px' }}>
                        {n.message}
                      </div>
                    </li>
                  ))
                )}
              </div>

              <li className="p-2 text-center border-top">
                <button
                  type="button"
                  className="btn btn-link btn-sm text-decoration-none w-100 py-1"
                  onClick={() => {
                    setNotifMenuOpen(false);
                    navigate('/notifications');
                  }}
                >
                  View all notifications
                </button>
              </li>
            </ul>
          </div>

          {/* User Menu */}
          {user && (
            <div className={`dropdown ${userMenuOpen ? 'show' : ''}`}>
              <button
                id="user-menu-btn"
                className="btn btn-light d-flex align-items-center gap-2 border py-1 px-2 rounded"
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
              >
                <div
                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                  style={{ width: '32px', height: '32px', fontSize: '13px' }}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-start d-none d-md-block lh-sm">
                  <div className="small fw-semibold text-dark">{user.name}</div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>
                    {user.role}
                  </div>
                </div>
                <i className="bi bi-chevron-down text-muted small ms-1"></i>
              </button>
              <ul
                className={`dropdown-menu dropdown-menu-end shadow border-0 mt-2 ${userMenuOpen ? 'show' : ''}`}
                style={{ position: 'absolute', right: 0, left: 'auto' }}
              >
                <li className="px-3 py-2 border-bottom">
                  <div className="fw-semibold text-dark small">{user.name}</div>
                  <div className="text-muted small">{user.email}</div>
                  {user.departmentName && (
                    <div className="badge bg-light text-dark border mt-1">
                      {user.departmentName}
                    </div>
                  )}
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item py-2 d-flex align-items-center gap-2"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowChangePassword(true);
                    }}
                  >
                    <i className="bi bi-key text-muted"></i>
                    <span>Change Password</span>
                  </button>
                </li>
                <li>
                  <hr className="dropdown-divider my-1" />
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item text-danger py-2 d-flex align-items-center gap-2"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    <i className="bi bi-box-arrow-right"></i>
                    <span>Logout</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="main-content-wrapper flex-grow-1">
        <Outlet />
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}

export default AppLayout;
