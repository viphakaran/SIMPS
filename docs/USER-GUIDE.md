# SIMPS — User Guide & Role Manual

This guide describes the roles, navigation structures, and actionable workflows for users of the Smart Inventory and Procurement Management System (SIMPS).

---

## Roles Overview

| Role | Primary Purpose | Scope of Visibility |
|---|---|---|
| **ADMIN** | System administration & user governance | All master data, users, and audit logs |
| **PRINCIPAL** | Institutional executive oversight & HoD approvals | Institutional dashboard, department requests, approval queue for HoD requests |
| **HOD** | Departmental purchase request verification & tracking | Departmental purchase requests, approval queue for department requester requests |
| **REQUESTER** | Raising procurement requests for academic/lab needs | Personal purchase requests, item catalog |
| **PROCUREMENT_OFFICER** | Purchase order creation & vendor management | Approved requests, purchase orders, suppliers, reorder suggestions |
| **STORE_MANAGER** | Inventory stock tracking, goods receipt & issuance | Master items, stock ledger, stock adjustments/issues, goods receipt |
| **SUPPLIER** | Vendor order fulfillment & delivery updates | Assigned purchase orders only |

---

## 1. Requester Workflow

### Raising a Purchase Request
1. Log in to SIMPS and navigate to **Purchase Requests** (`/requests`).
2. Click **New Request** (`/requests/new`).
3. Select priority (`LOW`, `NORMAL`, `HIGH`, `URGENT`).
4. Enter justification for the procurement.
5. Add line items: select an active item from the catalog and specify the required quantity.
6. Click **Submit Request**. The request enters `PENDING_HOD` status and routes to your department Head of Department.

### Tracking and Cancelling Requests
- View request progress in the request list or detail view (`/requests/:id`).
- If a request is still in `PENDING_HOD` status, the requester can click **Cancel Request** to withdraw it.

---

## 2. Head of Department (HoD) Workflow

### Approving Departmental Requests
1. Log in and open **Approval Queue** (`/approvals`).
2. Requests submitted by requesters within your department are displayed.
3. Click on a request to inspect item lines and justifications.
4. Click **Approve** to forward the request to Procurement (status advances to `APPROVED`).
5. Or click **Reject**, enter the mandatory rejection reason, and confirm (status transitions to `REJECTED`).

### Raising HoD Requests
- When an HoD raises a request, the system routes the approval directly to the **Principal** (`PENDING_PRINCIPAL`), preventing self-approval.

---

## 3. Principal Workflow

### Executive Overview & Institutional Approvals
1. The **Executive Dashboard** displays institutional stock valuation, monthly procurement trends, active request counts, and department expenditure breakdown.
2. Under **Approval Queue**, requests submitted directly by Heads of Departments appear.
3. The Principal can **Approve** or **Reject** with comments.

---

## 4. Procurement Officer Workflow

### Generating Purchase Orders from Approved Requests
1. Open **Purchase Requests** and filter by status `APPROVED` or view **Procurement Queue**.
2. Click **Create Orders** (`/requests/:id/orders`).
3. For each requested line item:
   - Select an active **Supplier** offering that category.
   - Enter the agreed **Unit Price** (in INR).
4. Enter an **Expected Delivery Date**.
5. Click **Generate Purchase Orders**. The system automatically groups items by supplier into distinct POs in status `PLACED`, advances the request status to `ORDERED`, and notifies vendors.

### Returning Requests for Revision
- If an approved request has obsolete specifications or budgetary issues, click **Return to Requester**, provide the reason, and transition status to `RETURNED_BY_PROCUREMENT`.

### Monitoring Supplier Performance & Reorders
- Check **Supplier Performance** report (`/reports/suppliers`) for on-time delivery percentages and average lead times.
- Check **Reorder Suggestions** (`/reports/reorder-suggestions`) to view items at or below minimum threshold and estimated reorder quantities.

---

## 5. Supplier Workflow

### Managing Assigned Purchase Orders
1. Log in with your vendor credentials.
2. View only purchase orders assigned to your supplier organization (`/orders`).
3. View order lines, total cost, and delivery deadline.
4. Once items are dispatched and delivered to the central store, click **Mark as Delivered**. Status transitions to `DELIVERED`, triggering an alert to Store Managers.

---

## 6. Store Manager Workflow

### Goods Receipt
1. Open **Purchase Orders** (`/orders`) and filter by status `DELIVERED`.
2. When the physical shipment arrives, verify the physical items against the PO lines.
3. Click **Receive Goods**.
4. The system updates the order to `RECEIVED`, atomically increases the stock quantity of each item, records an immutable `RECEIPT` in the stock ledger, and checks if all POs for the parent request are complete.

### Issuing Stock to Departments
1. Navigate to **Items & Stock** (`/items`).
2. Open the item detail view (`/items/:id`).
3. Click **Issue Stock**.
4. Select the receiving Department, enter the quantity and reason.
5. Stock quantity is deducted and an `ISSUE` movement is logged.

### Stock Adjustments
- Perform physical audit reconciliations by clicking **Adjust Stock** on an item. Enter the positive or negative delta and the required audit justification.

---

## 7. Administrator Workflow

### User Governance & Approval
1. Navigate to **User Management** (`/admin/users`).
2. Self-registered users start in `PENDING` status.
3. Click **Approve** to activate their account and assign or verify their department.
4. Disable accounts or update user roles when needed.

### Master Data Administration
- **Departments** (`/admin/departments`): Create and activate departments, assign active HoDs.
- **Categories** (`/admin/categories`): Maintain item classifications.
- **Suppliers** (`/admin/suppliers`): Onboard suppliers, assign contact details and primary categories.
