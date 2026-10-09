const prisma = require('../prisma');

// GET /api/stats — admin dashboard summary numbers + project status breakdown.
async function getStats(req, res, next) {
  try {
    const now = new Date();
    const [
      totalProjects,
      ongoingProjects,
      completedProjects,
      totalViewers,
      totalOfficials,
      totalNews,
      upcomingEvents,
      projects,
      byStatus,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: 'ONGOING' } }),
      prisma.project.count({ where: { status: 'COMPLETED' } }),
      prisma.user.count({ where: { role: 'VIEWER' } }),
      prisma.official.count({ where: { isActive: true } }),
      prisma.news.count({ where: { status: 'PUBLISHED' } }),
      prisma.event.count({ where: { startAt: { gte: now } } }),
      prisma.project.findMany({ select: { budget: true } }),
      prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

    res.json({
      stats: {
        totalProjects,
        ongoingProjects,
        completedProjects,
        totalViewers,
        totalOfficials,
        totalNews,
        upcomingEvents,
        totalBudget,
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
