import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { getDbConnection } from './db.js';
import { clearDemoData } from './clear.js';

export async function loadDemoData(connection, options = {}) {
  const { reset = false } = options;

  // 1. Check if demo data exists
  const [demoUsers] = await connection.query('SELECT COUNT(*) AS count FROM users WHERE is_demo = 1');
  const demoCount = Number(demoUsers[0].count);

  if (demoCount > 0) {
    if (!reset) {
      throw new Error(
        'Demo data already exists. Run with --reset to replace existing demo data, or run demo:clear first.'
      );
    }
    console.log('\x1b[33m[RESET]\x1b[0m Clearing existing demo data first...');
    await clearDemoData(connection, { isCli: false, force: true });
  }

  // Set fixed seed for deterministic, repeatable demo data
  faker.seed(20261015);

  console.log('\x1b[36m[GENERATING]\x1b[0m Seeding demo dataset...');

  // Common Demo Password
  const plainPassword = process.env.DEMO_PASSWORD || 'DemoPass123!';
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  // 2. Categories (5)
  const categoryNames = [
    'Demo - Electronic Components',
    'Demo - Lab Consumables & Chemicals',
    'Demo - Mechanical Tools & Hardware',
    'Demo - Safety & Workshop Gear',
    'Demo - Office & Paper Supplies'
  ];

  const categoryIds = [];
  for (const name of categoryNames) {
    const [res] = await connection.query(
      'INSERT INTO categories (name, is_demo) VALUES (?, 1)',
      [name]
    );
    categoryIds.push(res.insertId);
  }

  // 3. Departments (4)
  // Re-use existing real departments (e.g. from seed:college) if present; never create duplicates
  const targetDepartmentNames = [
    'Mechanical Engineering',
    'Civil Engineering',
    'Electrical and Electronics Engineering',
    'Computer Science and Engineering'
  ];

  const fallbackDemoNames = [
    'Demo Dept - Mechanical Engineering',
    'Demo Dept - Civil Engineering',
    'Demo Dept - Electrical & Electronics',
    'Demo Dept - Computer Science & Engg'
  ];

  const departmentIds = [];
  for (let i = 0; i < targetDepartmentNames.length; i++) {
    const targetName = targetDepartmentNames[i];
    const fallbackName = fallbackDemoNames[i];

    // Check if target real or demo department already exists
    const [existing] = await connection.query(
      'SELECT id, name, is_demo FROM departments WHERE name = ? OR name = ? LIMIT 1',
      [targetName, fallbackName]
    );

    if (existing.length > 0) {
      departmentIds.push(existing[0].id);
    } else {
      const [res] = await connection.query(
        'INSERT INTO departments (name, is_active, is_demo) VALUES (?, 1, 1)',
        [targetName]
      );
      departmentIds.push(res.insertId);
    }
  }

  // 4. Suppliers (6)
  const suppliersData = [
    { name: 'Apex Instruments & Sensors', email: 'sales.apex@demo.invalid', phone: '9842100001', categoryId: categoryIds[0], address: 'Plot 12, Industrial Estate, Rajapalayam' },
    { name: 'Bharath Lab Chemicals', email: 'orders.bharath@demo.invalid', phone: '9842100002', categoryId: categoryIds[1], address: '44 Chemistry Lane, Madurai' },
    { name: 'Kaveri Engineering Tools', email: 'info.kaveri@demo.invalid', phone: '9842100003', categoryId: categoryIds[2], address: '78 Tool Works Road, Coimbatore' },
    { name: 'Titan Safety Works', email: 'support.titansafety@demo.invalid', phone: '9842100004', categoryId: categoryIds[3], address: '15 Protection Highway, Tirunelveli' },
    { name: 'Madurai Office & Print Supplies', email: 'sales.maduraioffice@demo.invalid', phone: '9842100005', categoryId: categoryIds[4], address: '109 West Masi Street, Madurai' },
    { name: 'Southern Tech Robotics & Hardware', email: 'contact.southerntech@demo.invalid', phone: '9842100006', categoryId: categoryIds[0], address: '88 Electronics City, Chennai' }
  ];

  const supplierIds = [];
  for (const s of suppliersData) {
    const [res] = await connection.query(
      'INSERT INTO suppliers (name, email, phone, address, category_id, is_active, is_demo) VALUES (?, ?, ?, ?, ?, 1, 1)',
      [s.name, s.email, s.phone, s.address, s.categoryId]
    );
    supplierIds.push(res.insertId);
  }

  // 5. Users
  const usersToInsert = [];

  // Principal
  usersToInsert.push({
    name: 'Dr. K. Principal (Demo)',
    email: 'principal@demo.invalid',
    role: 'PRINCIPAL',
    deptId: null,
    suppId: null
  });

  // HoDs (1 per department)
  const hodEmails = [
    'hod.mech@demo.invalid',
    'hod.civil@demo.invalid',
    'hod.eee@demo.invalid',
    'hod.cse@demo.invalid'
  ];
  const hodNames = [
    'Dr. A. Arumugam (Demo HoD)',
    'Dr. B. Balaji (Demo HoD)',
    'Dr. C. Chitra (Demo HoD)',
    'Dr. D. Dhanasekar (Demo HoD)'
  ];

  for (let i = 0; i < departmentIds.length; i++) {
    usersToInsert.push({
      name: hodNames[i],
      email: hodEmails[i],
      role: 'HOD',
      deptId: departmentIds[i],
      suppId: null
    });
  }

  // Requesters (2 per department)
  const requesterNames = [
    ['Prof. E. Elango (Demo)', 'Prof. F. Fatima (Demo)'],
    ['Prof. G. Ganesan (Demo)', 'Prof. H. Harini (Demo)'],
    ['Prof. I. Ilayaraja (Demo)', 'Prof. J. Janani (Demo)'],
    ['Prof. K. Karthik (Demo)', 'Prof. L. Lavanya (Demo)']
  ];
  const requesterCodes = ['mech', 'civil', 'eee', 'cse'];

  for (let d = 0; d < departmentIds.length; d++) {
    for (let r = 0; r < 2; r++) {
      usersToInsert.push({
        name: requesterNames[d][r],
        email: `req${r + 1}.${requesterCodes[d]}@demo.invalid`,
        role: 'REQUESTER',
        deptId: departmentIds[d],
        suppId: null
      });
    }
  }

  // Procurement Officer
  usersToInsert.push({
    name: 'Mr. M. Mani (Demo Officer)',
    email: 'officer@demo.invalid',
    role: 'PROCUREMENT_OFFICER',
    deptId: null,
    suppId: null
  });

  // Store Manager
  usersToInsert.push({
    name: 'Mr. S. Sakthivel (Demo Store)',
    email: 'storekeeper@demo.invalid',
    role: 'STORE_MANAGER',
    deptId: null,
    suppId: null
  });

  // Supplier users (1 per supplier)
  for (let s = 0; s < suppliersData.length; s++) {
    usersToInsert.push({
      name: `${suppliersData[s].name} Sales Rep`,
      email: suppliersData[s].email,
      role: 'SUPPLIER',
      deptId: null,
      suppId: supplierIds[s]
    });
  }

  const userIds = {};
  for (const u of usersToInsert) {
    const [res] = await connection.query(
      `INSERT INTO users (name, email, password_hash, role, status, department_id, supplier_id, is_demo)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, 1)`,
      [u.name, u.email, passwordHash, u.role, u.deptId, u.suppId]
    );
    userIds[u.email] = res.insertId;
  }

  // Link HoDs to their departments
  for (let i = 0; i < departmentIds.length; i++) {
    const hodId = userIds[hodEmails[i]];
    await connection.query('UPDATE departments SET hod_user_id = ? WHERE id = ?', [
      hodId,
      departmentIds[i]
    ]);
  }

  // 6. Items (30 realistic items across 5 categories)
  const itemsCatalog = [
    // Electronics
    { sku: 'DEMO-ELE-001', name: 'Arduino Uno R3 Microcontroller', catIdx: 0, unit: 'nos', minLevel: 10, unitCost: 480.00 },
    { sku: 'DEMO-ELE-002', name: 'Raspberry Pi 4 Model B (4GB)', catIdx: 0, unit: 'nos', minLevel: 5, unitCost: 4200.00 },
    { sku: 'DEMO-ELE-003', name: 'Solderless Breadboard 830 Points', catIdx: 0, unit: 'nos', minLevel: 15, unitCost: 120.00 },
    { sku: 'DEMO-ELE-004', name: 'Digital Multimeter Auto-Ranging', catIdx: 0, unit: 'nos', minLevel: 8, unitCost: 750.00 },
    { sku: 'DEMO-ELE-005', name: 'Electric Soldering Station 60W', catIdx: 0, unit: 'nos', minLevel: 6, unitCost: 1450.00 },
    { sku: 'DEMO-ELE-006', name: 'ESP32 Wi-Fi & Bluetooth Board', catIdx: 0, unit: 'nos', minLevel: 12, unitCost: 320.00 },

    // Chemicals & Consumables
    { sku: 'DEMO-CHM-001', name: 'Ethanol AR Grade 99.9% 500ml', catIdx: 1, unit: 'bottle', minLevel: 10, unitCost: 260.00 },
    { sku: 'DEMO-CHM-002', name: 'Hydrochloric Acid 1M 1 Litre', catIdx: 1, unit: 'bottle', minLevel: 6, unitCost: 310.00 },
    { sku: 'DEMO-CHM-003', name: 'Deionized Distilled Water 5L', catIdx: 1, unit: 'can', minLevel: 15, unitCost: 180.00 },
    { sku: 'DEMO-CHM-004', name: 'Borosilicate Glass Beakers 250ml', catIdx: 1, unit: 'nos', minLevel: 20, unitCost: 85.00 },
    { sku: 'DEMO-CHM-005', name: 'Whatman Filter Paper Circles 100pk', catIdx: 1, unit: 'pack', minLevel: 10, unitCost: 450.00 },
    { sku: 'DEMO-CHM-006', name: 'Disposable Nitrile Gloves Medium', catIdx: 1, unit: 'box', minLevel: 15, unitCost: 380.00 },

    // Mechanical Tools
    { sku: 'DEMO-MEC-001', name: 'Precision Vernier Caliper 150mm', catIdx: 2, unit: 'nos', minLevel: 8, unitCost: 650.00 },
    { sku: 'DEMO-MEC-002', name: 'Digital Outside Micrometer 0-25mm', catIdx: 2, unit: 'nos', minLevel: 5, unitCost: 1250.00 },
    { sku: 'DEMO-MEC-003', name: 'Deep Groove Ball Bearing 6204-2RS', catIdx: 2, unit: 'nos', minLevel: 20, unitCost: 140.00 },
    { sku: 'DEMO-MEC-004', name: 'Metric Hex Bolts M8x30 Box (100pcs)', catIdx: 2, unit: 'box', minLevel: 10, unitCost: 350.00 },
    { sku: 'DEMO-MEC-005', name: 'HSS Drill Bits Set 1mm-13mm (25pcs)', catIdx: 2, unit: 'box', minLevel: 6, unitCost: 1100.00 },
    { sku: 'DEMO-MEC-006', name: 'Anti-Rust Machine Lubricant Spray 400ml', catIdx: 2, unit: 'can', minLevel: 12, unitCost: 220.00 },

    // Safety Gear
    { sku: 'DEMO-SAF-001', name: 'Clear Polycarbonate Safety Goggles', catIdx: 3, unit: 'nos', minLevel: 25, unitCost: 95.00 },
    { sku: 'DEMO-SAF-002', name: 'Heavy Duty Leather Welding Apron', catIdx: 3, unit: 'nos', minLevel: 6, unitCost: 780.00 },
    { sku: 'DEMO-SAF-003', name: 'Full Face Protective Grinding Shield', catIdx: 3, unit: 'nos', minLevel: 8, unitCost: 420.00 },
    { sku: 'DEMO-SAF-004', name: 'Industrial Ear Muff SNR 30dB', catIdx: 3, unit: 'nos', minLevel: 10, unitCost: 340.00 },
    { sku: 'DEMO-SAF-005', name: 'Dotted Cotton Work Gloves (12 Pairs)', catIdx: 3, unit: 'pack', minLevel: 15, unitCost: 240.00 },
    { sku: 'DEMO-SAF-006', name: 'Fire Retardant Emergency Blanket 1.2m', catIdx: 3, unit: 'nos', minLevel: 5, unitCost: 550.00 },

    // Office & Paper
    { sku: 'DEMO-OFF-001', name: 'JK Copier A4 Paper 75GSM (500 Sheets)', catIdx: 4, unit: 'ream', minLevel: 30, unitCost: 290.00 },
    { sku: 'DEMO-OFF-002', name: 'Whiteboard Markers Assorted Box (10pcs)', catIdx: 4, unit: 'box', minLevel: 12, unitCost: 190.00 },
    { sku: 'DEMO-OFF-003', name: 'Thermal Billing Paper Rolls 80mm (10pk)', catIdx: 4, unit: 'pack', minLevel: 8, unitCost: 320.00 },
    { sku: 'DEMO-OFF-004', name: 'Self-Adhesive Sticky Notes 3x3in (12pk)', catIdx: 4, unit: 'pack', minLevel: 15, unitCost: 180.00 },
    { sku: 'DEMO-OFF-005', name: 'Cello Ballpoint Pens Blue Box (50pcs)', catIdx: 4, unit: 'box', minLevel: 10, unitCost: 220.00 },
    { sku: 'DEMO-OFF-006', name: 'Heavy Duty Desktop Stapler & Pin Pack', catIdx: 4, unit: 'nos', minLevel: 6, unitCost: 280.00 }
  ];

  const itemIds = [];
  for (const it of itemsCatalog) {
    const [res] = await connection.query(
      `INSERT INTO items (sku, name, category_id, unit, stock_qty, min_level, unit_cost, is_active, low_stock_alerted, is_demo)
       VALUES (?, ?, ?, ?, 0, ?, ?, 1, 0, 1)`,
      [it.sku, it.name, categoryIds[it.catIdx], it.unit, it.minLevel, it.unitCost]
    );
    itemIds.push(res.insertId);
  }

  // 7. 60-Day Stock Movements Ledger & Historical Receipts
  // Track running balances strictly
  const runningBalances = new Array(itemIds.length).fill(0);

  // Helper date function
  function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  const storeMgrId = userIds['storekeeper@demo.invalid'];

  // A. Day -60: Opening Stock
  for (let i = 0; i < itemIds.length; i++) {
    // Generates a healthy initial buffer
    const openingQty = itemsCatalog[i].minLevel * 2 + 10 + (i % 7);
    runningBalances[i] = openingQty;

    await connection.query(
      `INSERT INTO stock_movements (
        item_id, type, quantity, balance_after, recorded_by, reason, is_demo, created_at
      ) VALUES (?, 'RECEIPT', ?, ?, ?, 'Initial inventory opening stock', 1, ?)`,
      [itemIds[i], openingQty, openingQty, storeMgrId, daysAgo(60)]
    );
  }

  // B. Day -50 to -5: Periodic department issues
  const issueEvents = [
    { days: 48, itemIdx: 0, qty: 5, deptIdx: 3, reason: 'Microcontroller Lab practical session' },
    { days: 42, itemIdx: 24, qty: 10, deptIdx: 0, reason: 'Semester exam question paper printing' },
    { days: 38, itemIdx: 6, qty: 4, deptIdx: 1, reason: 'Environmental Chemistry laboratory testing' },
    { days: 35, itemIdx: 12, qty: 3, deptIdx: 0, reason: 'Workshop metrology measurement exercise' },
    { days: 30, itemIdx: 18, qty: 8, deptIdx: 0, reason: 'Foundry & welding safety gear allocation' },
    { days: 25, itemIdx: 2, qty: 6, deptIdx: 2, reason: 'Power electronics breadboard prototyping' },
    { days: 20, itemIdx: 25, qty: 4, deptIdx: 3, reason: 'Faculty lecture notes and seminar presentation' },
    { days: 15, itemIdx: 1, qty: 2, deptIdx: 3, reason: 'IoT embedded systems final year project' },
    { days: 10, itemIdx: 15, qty: 5, deptIdx: 0, reason: 'Lathe machine fixture assembly' },
    { days: 6, itemIdx: 21, qty: 4, deptIdx: 2, reason: 'High voltage lab acoustic attenuation' }
  ];

  for (const ev of issueEvents) {
    const prevBal = runningBalances[ev.itemIdx];
    const newBal = prevBal - ev.qty;
    runningBalances[ev.itemIdx] = newBal;

    await connection.query(
      `INSERT INTO stock_movements (
        item_id, type, quantity, balance_after, department_id, recorded_by, reason, is_demo, created_at
      ) VALUES (?, 'ISSUE', ?, ?, ?, ?, 'Lab practical issue', 1, ?)`,
      [itemIds[ev.itemIdx], -ev.qty, newBal, departmentIds[ev.deptIdx], storeMgrId, daysAgo(ev.days)]
    );
  }

  // 8. Purchase Requests in EVERY Status
  const reqDefs = [
    // 0: PENDING_HOD (Req by Prof E. Elango, Mech)
    {
      reqNo: 'REQ-2026-00001',
      deptIdx: 0,
      userEmail: 'req1.mech@demo.invalid',
      priority: 'HIGH',
      status: 'PENDING_HOD',
      justification: 'Required for Dynamics of Machinery experimental setup',
      daysAgo: 2,
      items: [{ itemIdx: 12, qty: 5 }, { itemIdx: 13, qty: 2 }]
    },
    // 1: PENDING_PRINCIPAL (Req by Dr. B. Balaji HoD, Civil)
    {
      reqNo: 'REQ-2026-00002',
      deptIdx: 1,
      userEmail: 'hod.civil@demo.invalid',
      priority: 'NORMAL',
      status: 'PENDING_PRINCIPAL',
      justification: 'Surveying camp equipment consumables requirement',
      daysAgo: 3,
      items: [{ itemIdx: 18, qty: 10 }]
    },
    // 2: APPROVED (HoD approved, waiting in procurement queue)
    {
      reqNo: 'REQ-2026-00003',
      deptIdx: 2,
      userEmail: 'req1.eee@demo.invalid',
      priority: 'HIGH',
      status: 'APPROVED',
      justification: 'High voltage laboratory instrumentation sensors',
      daysAgo: 5,
      approvals: [{ stage: 'HOD', decision: 'APPROVED', userEmail: 'hod.eee@demo.invalid', daysAgo: 4 }],
      items: [{ itemIdx: 3, qty: 4 }, { itemIdx: 4, qty: 2 }]
    },
    // 3: APPROVED (HoD request approved by Principal)
    {
      reqNo: 'REQ-2026-00004',
      deptIdx: 0,
      userEmail: 'hod.mech@demo.invalid',
      priority: 'NORMAL',
      status: 'APPROVED',
      justification: 'Thermal engineering heat transfer lab replenishment',
      daysAgo: 7,
      approvals: [{ stage: 'PRINCIPAL', decision: 'APPROVED', userEmail: 'principal@demo.invalid', daysAgo: 6 }],
      items: [{ itemIdx: 14, qty: 15 }]
    },
    // 4: REJECTED (HoD rejected with reason)
    {
      reqNo: 'REQ-2026-00005',
      deptIdx: 3,
      userEmail: 'req1.cse@demo.invalid',
      priority: 'LOW',
      status: 'REJECTED',
      justification: 'Non-standard tablet monitors for conference room',
      daysAgo: 10,
      approvals: [{ stage: 'HOD', decision: 'REJECTED', userEmail: 'hod.cse@demo.invalid', reason: 'Department budget exhausted for non-academic hardware.', daysAgo: 9 }],
      items: [{ itemIdx: 1, qty: 8 }]
    },
    // 5: RETURNED_BY_PROCUREMENT (Procurement returned with reason)
    {
      reqNo: 'REQ-2026-00006',
      deptIdx: 1,
      userEmail: 'req1.civil@demo.invalid',
      priority: 'NORMAL',
      status: 'RETURNED_BY_PROCUREMENT',
      justification: 'Geotechnical soil mechanics testing supplies',
      daysAgo: 12,
      approvals: [
        { stage: 'HOD', decision: 'APPROVED', userEmail: 'hod.civil@demo.invalid', daysAgo: 11 },
        { stage: 'PROCUREMENT', decision: 'RETURNED', userEmail: 'officer@demo.invalid', reason: 'Specification obsolete. Please resubmit with updated model numbers.', daysAgo: 10 }
      ],
      items: [{ itemIdx: 9, qty: 12 }]
    },
    // 6: CANCELLED (Cancelled by requester before approval)
    {
      reqNo: 'REQ-2026-00007',
      deptIdx: 2,
      userEmail: 'req2.eee@demo.invalid',
      priority: 'LOW',
      status: 'CANCELLED',
      justification: 'Redundant test leads order entered in error',
      daysAgo: 15,
      items: [{ itemIdx: 2, qty: 20 }]
    },
    // 7: ORDERED (PO in progress)
    {
      reqNo: 'REQ-2026-00008',
      deptIdx: 3,
      userEmail: 'req2.cse@demo.invalid',
      priority: 'HIGH',
      status: 'ORDERED',
      justification: 'Embedded systems development hardware bulk order',
      daysAgo: 20,
      approvals: [
        { stage: 'HOD', decision: 'APPROVED', userEmail: 'hod.cse@demo.invalid', daysAgo: 19 },
        { stage: 'PROCUREMENT', decision: 'APPROVED', userEmail: 'officer@demo.invalid', daysAgo: 18 }
      ],
      items: [{ itemIdx: 0, qty: 15 }, { itemIdx: 5, qty: 10 }]
    },
    // 8: RECEIVED (Historical received request)
    {
      reqNo: 'REQ-2026-00009',
      deptIdx: 0,
      userEmail: 'req2.mech@demo.invalid',
      priority: 'NORMAL',
      status: 'RECEIVED',
      justification: 'Central workshop safety gear semester allotment',
      daysAgo: 45,
      approvals: [
        { stage: 'HOD', decision: 'APPROVED', userEmail: 'hod.mech@demo.invalid', daysAgo: 44 },
        { stage: 'PROCUREMENT', decision: 'APPROVED', userEmail: 'officer@demo.invalid', daysAgo: 42 }
      ],
      items: [{ itemIdx: 18, qty: 30 }, { itemIdx: 19, qty: 10 }]
    },
    // 9: RECEIVED (Historical received request)
    {
      reqNo: 'REQ-2026-00010',
      deptIdx: 1,
      userEmail: 'req2.civil@demo.invalid',
      priority: 'NORMAL',
      status: 'RECEIVED',
      justification: 'Concrete laboratory chemical solutions',
      daysAgo: 35,
      approvals: [
        { stage: 'HOD', decision: 'APPROVED', userEmail: 'hod.civil@demo.invalid', daysAgo: 34 },
        { stage: 'PROCUREMENT', decision: 'APPROVED', userEmail: 'officer@demo.invalid', daysAgo: 33 }
      ],
      items: [{ itemIdx: 6, qty: 10 }]
    }
  ];

  const requestIds = [];
  for (const r of reqDefs) {
    const [prRes] = await connection.query(
      `INSERT INTO purchase_requests (
        req_no, department_id, requested_by, priority, status, justification, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        r.reqNo,
        departmentIds[r.deptIdx],
        userIds[r.userEmail],
        r.priority,
        r.status,
        r.justification,
        daysAgo(r.daysAgo),
        daysAgo(r.daysAgo)
      ]
    );
    const reqId = prRes.insertId;
    requestIds.push(reqId);

    // Insert Request Items
    for (const item of r.items) {
      await connection.query(
        'INSERT INTO request_items (request_id, item_id, quantity) VALUES (?, ?, ?)',
        [reqId, itemIds[item.itemIdx], item.qty]
      );
    }

    // Insert Approvals
    if (r.approvals) {
      for (const app of r.approvals) {
        await connection.query(
          `INSERT INTO request_approvals (
            request_id, decided_by, stage, decision, reason, decided_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            reqId,
            userIds[app.userEmail],
            app.stage,
            app.decision,
            app.reason || null,
            daysAgo(app.daysAgo)
          ]
        );
      }
    }
  }

  // 9. Purchase Orders (Across all statuses, including on-time and late deliveries)
  const poDefs = [
    // PO 1: PLACED
    {
      poNo: 'PO-2026-00001',
      reqId: requestIds[7],
      suppIdx: 0,
      status: 'PLACED',
      expectedDaysAhead: 7,
      deliveredDaysAgo: null,
      createdDaysAgo: 16,
      items: [{ itemIdx: 0, qty: 15, unitPrice: 480.00 }]
    },
    // PO 2: CONFIRMED
    {
      poNo: 'PO-2026-00002',
      reqId: requestIds[7],
      suppIdx: 5,
      status: 'CONFIRMED',
      expectedDaysAhead: 5,
      deliveredDaysAgo: null,
      createdDaysAgo: 14,
      items: [{ itemIdx: 5, qty: 10, unitPrice: 320.00 }]
    },
    // PO 3: SHIPPED
    {
      poNo: 'PO-2026-00003',
      reqId: requestIds[7],
      suppIdx: 2,
      status: 'SHIPPED',
      expectedDaysAhead: 2,
      deliveredDaysAgo: null,
      createdDaysAgo: 10,
      items: [{ itemIdx: 15, qty: 8, unitPrice: 350.00 }]
    },
    // PO 4: DELIVERED (Awaiting Store Manager receipt)
    {
      poNo: 'PO-2026-00004',
      reqId: requestIds[7],
      suppIdx: 3,
      status: 'DELIVERED',
      expectedDaysAhead: -1, // Due yesterday
      deliveredDaysAgo: 1,  // Delivered yesterday (On time)
      createdDaysAgo: 8,
      items: [{ itemIdx: 20, qty: 6, unitPrice: 420.00 }]
    },
    // PO 5: CANCELLED
    {
      poNo: 'PO-2026-00005',
      reqId: requestIds[7],
      suppIdx: 4,
      status: 'CANCELLED',
      expectedDaysAhead: 10,
      deliveredDaysAgo: null,
      createdDaysAgo: 18,
      items: [{ itemIdx: 26, qty: 10, unitPrice: 320.00 }]
    },
    // PO 6: RECEIVED (Historical ON-TIME delivery: expected 28 days ago, delivered 30 days ago)
    {
      poNo: 'PO-2026-00006',
      reqId: requestIds[8],
      suppIdx: 3,
      status: 'RECEIVED',
      expectedDaysAhead: -28,
      deliveredDaysAgo: 30,
      receivedDaysAgo: 29,
      createdDaysAgo: 40,
      items: [{ itemIdx: 18, qty: 30, unitPrice: 95.00 }]
    },
    // PO 7: RECEIVED (Historical LATE delivery: expected 25 days ago, delivered 20 days ago)
    {
      poNo: 'PO-2026-00007',
      reqId: requestIds[8],
      suppIdx: 3,
      status: 'RECEIVED',
      expectedDaysAhead: -25,
      deliveredDaysAgo: 20,
      receivedDaysAgo: 19,
      createdDaysAgo: 38,
      items: [{ itemIdx: 19, qty: 10, unitPrice: 780.00 }]
    },
    // PO 8: RECEIVED (Historical ON-TIME delivery: expected 15 days ago, delivered 16 days ago)
    {
      poNo: 'PO-2026-00008',
      reqId: requestIds[9],
      suppIdx: 1,
      status: 'RECEIVED',
      expectedDaysAhead: -15,
      deliveredDaysAgo: 16,
      receivedDaysAgo: 15,
      createdDaysAgo: 30,
      items: [{ itemIdx: 6, qty: 10, unitPrice: 260.00 }]
    }
  ];

  function futureOrPastDate(daysFromNow) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().slice(0, 10);
  }

  const officerId = userIds['officer@demo.invalid'];

  for (const po of poDefs) {
    const expectedDate = futureOrPastDate(po.expectedDaysAhead);
    const deliveredDate = po.deliveredDaysAgo !== null ? futureOrPastDate(-po.deliveredDaysAgo) : null;
    const totalAmount = po.items.reduce((acc, it) => acc + it.qty * it.unitPrice, 0);

    const [poRes] = await connection.query(
      `INSERT INTO purchase_orders (
        po_no, request_id, supplier_id, status, expected_date, delivered_date, total_amount, created_by, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        po.poNo,
        po.reqId,
        supplierIds[po.suppIdx],
        po.status,
        expectedDate,
        deliveredDate,
        totalAmount,
        officerId,
        daysAgo(po.createdDaysAgo),
        daysAgo(po.createdDaysAgo)
      ]
    );
    const poId = poRes.insertId;

    // PO Items
    for (const item of po.items) {
      await connection.query(
        'INSERT INTO po_items (po_id, item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [poId, itemIds[item.itemIdx], item.qty, item.unitPrice]
      );

      // If PO was RECEIVED, add stock movement and credit running balance
      if (po.status === 'RECEIVED') {
        const prevBal = runningBalances[item.itemIdx];
        const newBal = prevBal + item.qty;
        runningBalances[item.itemIdx] = newBal;

        await connection.query(
          `INSERT INTO stock_movements (
            item_id, type, quantity, balance_after, po_id, recorded_by, reason, is_demo, created_at
          ) VALUES (?, 'RECEIPT', ?, ?, ?, ?, ?, 1, ?)`,
          [
            itemIds[item.itemIdx],
            item.qty,
            newBal,
            poId,
            storeMgrId,
            `Goods receipt against purchase order ${po.poNo}`,
            daysAgo(po.receivedDaysAgo || 10)
          ]
        );
      }
    }
  }

  // 10. Force a few items into LOW and OUT of stock for realistic dashboard alerts & reorder suggestions
  // Item 0: Reduce to 4 (minLevel is 10 -> LOW)
  const item0Prev = runningBalances[0];
  const item0Issue = item0Prev - 4;
  runningBalances[0] = 4;
  await connection.query(
    `INSERT INTO stock_movements (item_id, type, quantity, balance_after, department_id, recorded_by, reason, is_demo, created_at)
     VALUES (?, 'ISSUE', ?, 4, ?, ?, 'Robotics laboratory semester project', 1, ?)`,
    [itemIds[0], -item0Issue, departmentIds[3], storeMgrId, daysAgo(2)]
  );

  // Item 1: Reduce to 0 (minLevel is 5 -> OUT)
  const item1Prev = runningBalances[1];
  runningBalances[1] = 0;
  await connection.query(
    `INSERT INTO stock_movements (item_id, type, quantity, balance_after, department_id, recorded_by, reason, is_demo, created_at)
     VALUES (?, 'ISSUE', ?, 0, ?, ?, 'Special research cluster deployment', 1, ?)`,
    [itemIds[1], -item1Prev, departmentIds[3], storeMgrId, daysAgo(1)]
  );

  // Update all items with final stock_qty and low_stock_alerted
  for (let i = 0; i < itemIds.length; i++) {
    const finalStock = runningBalances[i];
    const isAlerted = finalStock <= itemsCatalog[i].minLevel ? 1 : 0;
    await connection.query(
      'UPDATE items SET stock_qty = ?, low_stock_alerted = ? WHERE id = ?',
      [finalStock, isAlerted, itemIds[i]]
    );
  }

  // 11. In-App Notifications for Demo Users
  const notifDefs = [
    {
      userEmail: 'hod.mech@demo.invalid',
      type: 'REQUEST_SUBMITTED',
      message: 'New purchase request REQ-2026-00001 submitted for approval by Prof. E. Elango.',
      link: '/approvals',
      daysAgo: 2
    },
    {
      userEmail: 'principal@demo.invalid',
      type: 'REQUEST_SUBMITTED',
      message: 'New purchase request REQ-2026-00002 submitted for approval by Dr. B. Balaji (HoD).',
      link: '/approvals',
      daysAgo: 3
    },
    {
      userEmail: 'officer@demo.invalid',
      type: 'REQUEST_APPROVED',
      message: 'Purchase request REQ-2026-00003 approved by Dr. C. Chitra and ready for procurement.',
      link: '/procurement',
      daysAgo: 4
    },
    {
      userEmail: 'storekeeper@demo.invalid',
      type: 'LOW_STOCK',
      message: 'Low stock alert: Item "Arduino Uno R3 Microcontroller" (SKU: DEMO-ELE-001) is LOW with 4 remaining.',
      link: `/items/${itemIds[0]}`,
      daysAgo: 2
    },
    {
      userEmail: 'storekeeper@demo.invalid',
      type: 'PO_DELIVERED',
      message: 'Purchase order PO-2026-00004 has been marked as delivered by supplier. Ready for receipt.',
      link: '/orders',
      daysAgo: 1
    },
    {
      userEmail: 'req2.mech@demo.invalid',
      type: 'PO_RECEIVED',
      message: 'Items from purchase order PO-2026-00006 have been received into central store inventory.',
      link: `/requests/${requestIds[8]}`,
      daysAgo: 29
    }
  ];

  for (const n of notifDefs) {
    await connection.query(
      `INSERT INTO notifications (user_id, type, message, link, is_read, emailed, is_demo, created_at)
       VALUES (?, ?, ?, ?, 0, 0, 1, ?)`,
      [userIds[n.userEmail], n.type, n.message, n.link, daysAgo(n.daysAgo)]
    );
  }

  // 12. Self-Check: Invariants Verification
  console.log('\x1b[36m[VALIDATING]\x1b[0m Running end-of-load self-check on invariants...');

  // A. All demo rows must have is_demo = 1
  const tablesToCheck = [
    'categories',
    'departments',
    'suppliers',
    'users',
    'items',
    'purchase_requests',
    'purchase_orders',
    'stock_movements',
    'notifications'
  ];

  for (const tbl of tablesToCheck) {
    const [invalid] = await connection.query(
      `SELECT COUNT(*) AS c FROM ${tbl} WHERE is_demo NOT IN (0, 1)`
    );
    if (invalid[0].c > 0) {
      throw new Error(`Invariant failed: invalid is_demo values found in ${tbl}`);
    }
  }

  // B. Demo emails domain
  const [badEmails] = await connection.query(
    "SELECT COUNT(*) AS c FROM users WHERE is_demo = 1 AND email NOT LIKE '%@demo.invalid'"
  );
  if (badEmails[0].c > 0) {
    throw new Error('Invariant failed: demo user with non-demo email domain detected');
  }

  // C. Stock invariants
  const [negStock] = await connection.query(
    'SELECT COUNT(*) AS c FROM items WHERE is_demo = 1 AND stock_qty < 0'
  );
  if (negStock[0].c > 0) {
    throw new Error('Invariant failed: negative stock_qty detected in items');
  }

  const [negBalance] = await connection.query(
    'SELECT COUNT(*) AS c FROM stock_movements WHERE is_demo = 1 AND balance_after < 0'
  );
  if (negBalance[0].c > 0) {
    throw new Error('Invariant failed: negative balance_after detected in stock_movements');
  }

  // D. Balance after equals current stock_qty
  for (let i = 0; i < itemIds.length; i++) {
    const [latestSm] = await connection.query(
      'SELECT balance_after FROM stock_movements WHERE item_id = ? ORDER BY id DESC LIMIT 1',
      [itemIds[i]]
    );
    const [itemRow] = await connection.query(
      'SELECT stock_qty FROM items WHERE id = ?',
      [itemIds[i]]
    );

    if (latestSm.length > 0) {
      if (latestSm[0].balance_after !== itemRow[0].stock_qty) {
        throw new Error(
          `Invariant failed: item ${itemIds[i]} stock_qty (${itemRow[0].stock_qty}) != latest balance_after (${latestSm[0].balance_after})`
        );
      }
    }
  }

  // E. Sum of movements equals stock_qty
  const [sumCheck] = await connection.query(`
    SELECT i.id, i.stock_qty, COALESCE(SUM(sm.quantity), 0) AS calc_qty
    FROM items i
    JOIN stock_movements sm ON i.id = sm.item_id
    WHERE i.is_demo = 1
    GROUP BY i.id, i.stock_qty
    HAVING i.stock_qty <> calc_qty
  `);

  if (sumCheck.length > 0) {
    throw new Error(
      `Invariant failed: stock movement sum mismatch detected for ${sumCheck.length} items.`
    );
  }

  console.log('\x1b[32m✔ Self-check passed: All data invariants strictly satisfied.\x1b[0m');

  return {
    categoriesCount: categoryIds.length,
    departmentsCount: departmentIds.length,
    suppliersCount: supplierIds.length,
    usersCount: Object.keys(userIds).length,
    itemsCount: itemIds.length,
    requestsCount: requestIds.length,
    ordersCount: poDefs.length,
    password: plainPassword
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');

  console.log('\x1b[36m[SIMPS Demo Loader]\x1b[0m Connecting to database...');
  const connection = await getDbConnection();

  try {
    const stats = await loadDemoData(connection, { reset });

    console.log('\n\x1b[32m========================================================\x1b[0m');
    console.log('\x1b[32m          SIMPS DEMO DATA LOADED SUCCESSFULLY          \x1b[0m');
    console.log('\x1b[32m========================================================\x1b[0m');
    console.log(`- Categories Generated:   ${stats.categoriesCount}`);
    console.log(`- Departments Generated:  ${stats.departmentsCount}`);
    console.log(`- Suppliers Generated:    ${stats.suppliersCount}`);
    console.log(`- Users Generated:        ${stats.usersCount}`);
    console.log(`- Items in Catalog:       ${stats.itemsCount}`);
    console.log(`- Purchase Requests:      ${stats.requestsCount}`);
    console.log(`- Purchase Orders:        ${stats.ordersCount}`);
    console.log(`- Common Demo Password:   ${stats.password}`);

    console.log('\n\x1b[33m--- DEMO LOGIN CREDENTIALS TABLE ---\x1b[0m');
    const demoAccounts = [
      { Role: 'PRINCIPAL', Email: 'principal@demo.invalid', Scope: 'College-wide Approvals & Analytics' },
      { Role: 'HOD (Mech)', Email: 'hod.mech@demo.invalid', Scope: 'Mechanical Dept Approvals & Requisitions' },
      { Role: 'HOD (Civil)', Email: 'hod.civil@demo.invalid', Scope: 'Civil Dept Approvals & Requisitions' },
      { Role: 'HOD (EEE)', Email: 'hod.eee@demo.invalid', Scope: 'EEE Dept Approvals & Requisitions' },
      { Role: 'HOD (CSE)', Email: 'hod.cse@demo.invalid', Scope: 'CSE Dept Approvals & Requisitions' },
      { Role: 'REQUESTER (Mech)', Email: 'req1.mech@demo.invalid', Scope: 'Mechanical Dept Requisitions' },
      { Role: 'REQUESTER (CSE)', Email: 'req1.cse@demo.invalid', Scope: 'CSE Dept Requisitions' },
      { Role: 'PROCUREMENT_OFFICER', Email: 'officer@demo.invalid', Scope: 'Requisition Review & PO Creation' },
      { Role: 'STORE_MANAGER', Email: 'storekeeper@demo.invalid', Scope: 'Goods Receipt & Inventory Ledger' },
      { Role: 'SUPPLIER (Apex)', Email: 'sales.apex@demo.invalid', Scope: 'Supplier Order Status Progression' }
    ];
    console.table(demoAccounts);
    console.log('Password for all demo accounts: ' + stats.password);
    console.log('To clean up demo data at any time: npm run demo:clear\n');
  } catch (err) {
    console.error('\n\x1b[31m[ERROR]\x1b[0m Failed to load demo data:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('load.js')) {
  runCli();
}
