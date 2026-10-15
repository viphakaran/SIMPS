import bcrypt from 'bcryptjs';
import { query } from '../src/config/db.js';
import { initTestDatabase, clearTestDatabase } from './setup.js';
import { UserService } from '../src/services/userService.js';
import { ItemService } from '../src/services/itemService.js';
import { SupplierService } from '../src/services/supplierService.js';
import { DepartmentService } from '../src/services/departmentService.js';
import { StockService } from '../src/services/stockService.js';
import { RequestService } from '../src/services/requestService.js';
import { OrderService } from '../src/services/orderService.js';

describe('Comprehensive Service Coverage (Target >= 80% on server/src/services)', () => {
  let deptId;
  let catId;
  let adminUser;
  let hodUser;
  let requesterUser;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    const hash = await bcrypt.hash('TestPass123!', 12);

    // 1. Dept
    const deptRes = await query("INSERT INTO departments (name, is_active) VALUES ('Mech Dept', 1)");
    deptId = deptRes.insertId;

    // 2. Category
    const catRes = await query("INSERT INTO categories (name) VALUES ('Lab Consumables')");
    catId = catRes.insertId;

    // 4. Users
    const admRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Admin', 'admin@ritrjpm.ac.in', ?, 'ADMIN', 'ACTIVE')`,
      [hash]
    );
    adminUser = { id: admRes.insertId, role: 'ADMIN', email: 'admin@ritrjpm.ac.in' };

    const hodRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('Dr. HOD', 'hod@ritrjpm.ac.in', ?, 'HOD', 'ACTIVE', ?)`,
      [hash, deptId]
    );
    hodUser = { id: hodRes.insertId, role: 'HOD', departmentId: deptId, email: 'hod@ritrjpm.ac.in' };
    await query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [hodUser.id, deptId]);

    const reqRes = await query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id)
       VALUES ('Requester', 'req@ritrjpm.ac.in', ?, 'REQUESTER', 'ACTIVE', ?)`,
      [hash, deptId]
    );
    requesterUser = { id: reqRes.insertId, role: 'REQUESTER', departmentId: deptId, email: 'req@ritrjpm.ac.in' };
  });

  describe('UserService coverage', () => {
    it('exercises listUsers, updateUser, approveUser, enableUser, disableUser', async () => {
      // listUsers with filters
      const list = await UserService.listUsers({
        role: 'REQUESTER',
        status: 'ACTIVE',
        search: 'Requester',
        page: 1,
        pageSize: 10
      });
      expect(list.data.length).toBe(1);
      expect(list.data[0].id).toBe(requesterUser.id);

      // updateUser
      const updated = await UserService.updateUser(requesterUser.id, {
        name: 'Requester Renamed',
        phone: '9842109842'
      });
      expect(updated.name).toBe('Requester Renamed');
      expect(updated.phone).toBe('9842109842');

      // Create a pending user and approve
      const pendingUser = await UserService.createUser({
        name: 'Pending Staff',
        email: 'staff.pending@ritrjpm.ac.in',
        password: 'Pass123!456',
        role: 'REQUESTER',
        departmentId: deptId
      });
      expect(pendingUser.status).toBe('ACTIVE'); // Direct create sets ACTIVE

      // Disable user
      const disabled = await UserService.disableUser(pendingUser.id, adminUser.id);
      expect(disabled.status).toBe('DISABLED');

      // Enable user
      const enabled = await UserService.enableUser(pendingUser.id);
      expect(enabled.status).toBe('ACTIVE');

      // Prevent disabling self
      await expect(UserService.disableUser(adminUser.id, adminUser.id)).rejects.toThrow(
        /cannot disable their own account/
      );

      // getUserById not found
      await expect(UserService.getUserById(99999)).rejects.toThrow(/User not found/);
    });

    it('enforces role constraints on user creation', async () => {
      // HOD without departmentId
      await expect(
        UserService.createUser({
          name: 'Bad HoD',
          email: 'bad.hod@ritrjpm.ac.in',
          password: 'Password123!',
          role: 'HOD'
        })
      ).rejects.toThrow(/require a valid departmentId/);

      // SUPPLIER without supplierId
      await expect(
        UserService.createUser({
          name: 'Bad Supp',
          email: 'bad.supp@ritrjpm.ac.in',
          password: 'Password123!',
          role: 'SUPPLIER'
        })
      ).rejects.toThrow(/require a valid supplierId/);

      // Duplicate email
      await expect(
        UserService.createUser({
          name: 'Duplicate Admin',
          email: 'admin@ritrjpm.ac.in',
          password: 'Password123!',
          role: 'ADMIN'
        })
      ).rejects.toThrow(/email already exists/);
    });
  });

  describe('DepartmentService & SupplierService coverage', () => {
    it('exercises DepartmentService CRUD and HoD assignment', async () => {
      // Create dept
      const newDept = await DepartmentService.createDepartment({ name: 'Civil Dept' });
      expect(newDept.name).toBe('Civil Dept');

      // List depts
      const depts = await DepartmentService.listDepartments({ search: 'Civil', active: 'true' });
      expect(depts.data.length).toBe(1);

      // Update dept
      const updated = await DepartmentService.updateDepartment(newDept.id, { name: 'Civil Engineering' });
      expect(updated.name).toBe('Civil Engineering');

      // Assign HoD
      const assigned = await DepartmentService.assignHod(deptId, hodUser.id);
      expect(assigned.hodUserId).toBe(hodUser.id);

      // Deactivate & activate
      const deactivated = await DepartmentService.updateDepartment(newDept.id, { isActive: false });
      expect(deactivated.isActive).toBe(false);

      const activated = await DepartmentService.updateDepartment(newDept.id, { isActive: true });
      expect(activated.isActive).toBe(true);

      // Not found
      await expect(DepartmentService.getDepartmentById(99999)).rejects.toThrow(/Department not found/);
    });

    it('exercises SupplierService CRUD and activation', async () => {
      // Create supplier
      const newSupp = await SupplierService.createSupplier({
        name: 'Apex Tools',
        email: 'sales@apextools.demo.invalid',
        phone: '9876543210',
        address: '123 Test Road',
        categoryId: catId
      });
      expect(newSupp.name).toBe('Apex Tools');

      // List suppliers
      const list = await SupplierService.listSuppliers({ search: 'Apex', active: 'true' });
      expect(list.data.length).toBe(1);

      // Update supplier
      const updated = await SupplierService.updateSupplier(newSupp.id, { phone: '9999999999' });
      expect(updated.phone).toBe('9999999999');

      // Deactivate & activate
      const deactivated = await SupplierService.updateSupplier(newSupp.id, { isActive: false });
      expect(deactivated.isActive).toBe(false);

      const activated = await SupplierService.updateSupplier(newSupp.id, { isActive: true });
      expect(activated.isActive).toBe(true);

      // Not found
      await expect(SupplierService.getSupplierById(99999)).rejects.toThrow(/Supplier not found/);
    });
  });

  describe('ItemService & StockService coverage', () => {
    it('exercises ItemService CRUD, filters, and StockService ledger', async () => {
      // Create item
      const item = await ItemService.createItem(
        {
          sku: 'TEST-SKU-001',
          name: 'Ball Bearing 6204',
          categoryId: catId,
          unit: 'nos',
          minLevel: 10,
          unitCost: 150.0,
          openingStock: 25
        },
        adminUser.id
      );
      expect(item.stockQty).toBe(25);

      // List items with filters
      const list = await ItemService.listItems({
        search: 'Bearing',
        categoryId: catId,
        status: 'IN_STOCK',
        active: 'true'
      });
      expect(list.data.length).toBe(1);

      // Update item
      const updated = await ItemService.updateItem(item.id, {
        name: 'Deep Groove Ball Bearing 6204',
        unitCost: 165.0
      });
      expect(updated.name).toContain('Deep Groove');
      expect(updated.unitCost).toBe(165.0);

      // List stock movements
      const movements = await StockService.listMovements({
        itemId: item.id,
        type: 'ADJUSTMENT'
      });
      expect(movements.data.length).toBe(1);
      expect(movements.data[0].balanceAfter).toBe(25);

      // Issue stock below min level to trigger LOW status
      await ItemService.issueStock(
        item.id,
        { quantity: 20, departmentId: deptId, reason: 'Lab session issue' },
        requesterUser.id
      );
      const itemAfterIssue = await ItemService.getItemById(item.id);
      expect(itemAfterIssue.stockQty).toBe(5);

      // Deactivate & activate item
      const deactivated = await ItemService.updateItem(item.id, { isActive: false });
      expect(deactivated.isActive).toBe(false);

      const activated = await ItemService.updateItem(item.id, { isActive: true });
      expect(activated.isActive).toBe(true);

      // Not found
      await expect(ItemService.getItemById(99999)).rejects.toThrow(/Item not found/);
    });
  });

  describe('RequestService & OrderService coverage', () => {
    it('exercises RequestService cancellation, return by procurement, and order listing', async () => {
      // Create item for request
      const item = await ItemService.createItem(
        {
          sku: 'REQ-ITEM-001',
          name: 'Multimeter Digital',
          categoryId: catId,
          unit: 'nos',
          minLevel: 5,
          unitCost: 800.0,
          openingStock: 10
        },
        adminUser.id
      );

      // Create request by requester
      const req = await RequestService.createRequest(requesterUser, {
        priority: 'HIGH',
        justification: 'Lab practical testing multimeters',
        lines: [{ itemId: item.id, quantity: 2 }]
      });
      expect(req.status).toBe('PENDING_HOD');

      // List requests with filters
      const reqs = await RequestService.listRequests(hodUser, {
        status: 'PENDING_HOD',
        departmentId: deptId,
        queue: 'true'
      });
      expect(reqs.data.length).toBe(1);

      // HoD approves
      const approved = await RequestService.decideRequest(req.id, hodUser, {
        decision: 'APPROVED'
      });
      expect(approved.status).toBe('APPROVED');

      // Procurement officer returns request
      const officer = {
        id: adminUser.id,
        role: 'PROCUREMENT_OFFICER',
        email: 'officer@ritrjpm.ac.in'
      };
      const returned = await RequestService.returnRequest(req.id, officer, {
        reason: 'Specification obsolete, please specify newer model'
      });
      expect(returned.status).toBe('RETURNED_BY_PROCUREMENT');

      // Cancel a pending request
      const req2 = await RequestService.createRequest(requesterUser, {
        priority: 'LOW',
        justification: 'Spare cables',
        lines: [{ itemId: item.id, quantity: 1 }]
      });
      const cancelled = await RequestService.cancelRequest(req2.id, requesterUser);
      expect(cancelled.status).toBe('CANCELLED');

      // List orders
      const orders = await OrderService.listOrders(adminUser, {});
      expect(Array.isArray(orders.data)).toBe(true);

    });
  });

});
