const prisma = require('../prisma');

// The single settings row (SK information and attendance defaults). Created with the
// defaults the first time it is read.
async function getSettings() {
  return prisma.setting.upsert({ where: { id: 'sk' }, update: {}, create: { id: 'sk' } });
}

module.exports = { getSettings };
