// Creates the first admin and the Barangay Chairman accounts if they do not exist.
// Run with: npm run prisma:seed
// Uses ADMIN_* and CHAIRMAN_* values from .env (with defaults below).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function ensureUser({ email, password, name, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${role} already exists: ${email}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      emailVerifiedAt: new Date(), // staff accounts are created by the admin, so they start verified
    },
  });

  console.log(`Created ${role} account: ${user.email}`);
}

// Sangguniang Kabataan of Barangay Salinas 1, City of Bacoor (in photo order).
// displayOrder keeps the chairperson, secretary and treasurer first.
const SK_OFFICIALS = [
  { name: 'Sehj Miranda', position: 'SK Chairperson' },
  { name: 'Kyrar Espiritu', position: 'SK Secretary' },
  { name: 'Alison Reyes', position: 'SK Treasurer' },
  { name: 'John Murillo', position: 'SK Kagawad' },
  { name: 'Arvin Virata', position: 'SK Kagawad' },
  { name: 'Elaine Bellon', position: 'SK Kagawad' },
  { name: 'Ryan Seña', position: 'SK Kagawad' },
  { name: 'Jasmin Quindoza', position: 'SK Kagawad' },
  { name: 'Roby Ramos', position: 'SK Kagawad' },
  { name: 'Jhay Cerdeña', position: 'SK Kagawad' },
];

async function ensureOfficials() {
  for (const [i, o] of SK_OFFICIALS.entries()) {
    const existing = await prisma.official.findFirst({ where: { name: o.name } });
    if (existing) {
      console.log(`Official already exists: ${o.name}`);
      continue;
    }
    await prisma.official.create({
      data: { name: o.name, position: o.position, displayOrder: i + 1, isActive: true },
    });
    console.log(`Created official: ${o.name} (${o.position})`);
  }
}

// The documents each stage of the SK project process needs (minFiles: checked uploads needed).
// The same list is added by the 20261118090000_sk_project_process migration.
const REQUIRED_DOCUMENTS = [
  ['PENDING_APPROVAL', 'Project Proposal', 1],
  ['PENDING_APPROVAL', 'SK Resolution', 1],
  ['PENDING_APPROVAL', 'Meeting Minutes', 1],
  ['PURCHASING', 'Purchase Request', 1],
  ['PURCHASING', 'Supplier Canvass', 3],
  ['PURCHASING', 'Abstract of Canvass', 1],
  ['PURCHASING', 'Purchase Order', 1],
  ['FUND_RELEASE', 'Obligation Request', 1],
  ['FUND_RELEASE', 'Disbursement Voucher', 1],
  ['FUND_RELEASE', 'Check or Cash Advance Record', 1],
  ['IMPLEMENTATION', 'Attendance Sheet', 1],
  ['IMPLEMENTATION', 'Activity Photos', 3],
  ['IMPLEMENTATION', 'Delivery Receipt', 1],
  ['IMPLEMENTATION', 'Inspection or Acceptance Report', 1],
  ['LIQUIDATION', 'Liquidation Report', 1],
  ['LIQUIDATION', 'Official Receipts or Sales Invoices', 1],
];

async function ensureRequiredDocuments() {
  const order = {};
  for (const [stage, name, minFiles] of REQUIRED_DOCUMENTS) {
    order[stage] = (order[stage] || 0) + 1;
    await prisma.requiredDocument.upsert({
      where: { stage_name: { stage, name } },
      update: {},
      create: { stage, name, minFiles, displayOrder: order[stage] },
    });
  }
  console.log(`Required documents ready: ${REQUIRED_DOCUMENTS.length}`);
}

async function main() {
  await ensureOfficials();
  await ensureRequiredDocuments();

  await ensureUser({
    email: process.env.ADMIN_EMAIL || 'admin.sksalinas1@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    name: process.env.ADMIN_NAME || 'SK Administrator',
    role: 'ADMIN',
  });

  await ensureUser({
    email: process.env.CHAIRMAN_EMAIL || 'chairman.sksalinas1@gmail.com',
    password: process.env.CHAIRMAN_PASSWORD || 'chairman123',
    name: process.env.CHAIRMAN_NAME || 'Barangay Chairman',
    role: 'CHAIRMAN',
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
