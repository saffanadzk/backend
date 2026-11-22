const { PrismaClient } = require('@prisma/client');

// Instance PrismaClient tunggal untuk seluruh aplikasi
const prisma = new PrismaClient();

module.exports = prisma;
