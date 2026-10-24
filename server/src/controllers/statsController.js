const prisma = require('../prisma');
const { effectiveStatus } = require('./projectController');

// GET /api/stats — admin/chairman dashboard summary numbers + status breakdown.
async function getStats(req, res, next) {
  try {
    const now = new Date();
    const [
      totalViewers,
      totalOfficials,
      totalNews,
      upcomingEvents,
      projects,
      pendingDeletions,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'VIEWER' } }),
      prisma.official.count({ where: { isActive: true } }),
      prisma.news.count({ where: { status: 'PUBLISHED' } }),
      prisma.event.count({ where: { startAt: { gte: now } } }),
      // Archived projects are kept for the record but left out of the Dashboard numbers.
      prisma.project.findMany({
        where: { archivedAt: null },
        select: { budget: true, status: true, startDate: true, approvalState: true },
      }),
      prisma.deletionRequest.count({ where: { status: 'PENDING' } }),
    ]);

    // Count on the effective status so a started PLANNING project shows as Ongoing.
    // Rejected proposals never became projects, so they are left out of the totals.
    const counts = {};
    let totalBudget = 0;
    let pendingApproval = 0;
    let totalProjects = 0;
    projects.forEach((p) => {
      if (p.approvalState === 'REJECTED') return;
      totalProjects += 1;
      const status = effectiveStatus(p);
      counts[status] = (counts[status] || 0) + 1;
      totalBudget += Number(p.budget || 0);
      if (status === 'PROPOSED' && p.approvalState === 'PENDING') pendingApproval += 1;
    });

    res.json({
      stats: {
        totalProjects,
        ongoingProjects: counts.ONGOING || 0,
        completedProjects: counts.COMPLETED || 0,
        pendingApproval,
        pendingDeletions,
        totalViewers,
        totalOfficials,
        totalNews,
        upcomingEvents,
        totalBudget,
        byStatus: Object.entries(counts).map(([status, count]) => ({ status, count })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
