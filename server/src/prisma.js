// Single shared Prisma client instance (avoids opening too many connections in dev).
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
