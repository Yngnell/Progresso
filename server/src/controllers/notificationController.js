const prisma = require('../prisma');
const { syncNotifications } = require('../utils/notifications');

// Alerts with an audience were only for the SK Chairperson's account, which no longer
// exists; everyone sees the alerts without an audience.
function visibleTo() {
  return { audience: null };
}

// GET /api/notifications — the SK side. Newest first, with a per-user read flag.
async function listNotifications(req, res, next) {
  try {
    await syncNotifications(); // throttled; keeps the list fresh without waiting for the timer

    const uid = req.user.id;
    const visible = visibleTo(req.user);
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: visible,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          project: { select: { id: true, title: true, archivedAt: true } },
          event: { select: { id: true, title: true } },
        },
      }),
      prisma.notification.count({ where: { AND: [visible, { NOT: { readByIds: { has: uid } } }] } }),
    ]);

    const notifications = rows.map(({ readByIds, ...n }) => ({
      ...n,
      read: readByIds.includes(uid),
    }));
    res.json({ notifications, unread });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    const uid = req.user.id;
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ message: 'Notification not found' });
    if (!n.readByIds.includes(uid)) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { readByIds: { push: uid } },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/read-all
async function markAllRead(req, res, next) {
  try {
    const uid = req.user.id;
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "readByIds" = array_append("readByIds", ${uid})
      WHERE NOT (${uid} = ANY("readByIds"))`;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
};
