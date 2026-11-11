const prisma = require('../prisma');
const { effectiveStatus } = require('./projectController');

// GET /api/stats — dashboard summary numbers, status breakdown and the analytics behind
// the dashboard charts. ?projectId= narrows everything to one project ("Sort by Project"):
// its budget and expenses, and the events linked to it.
async function getStats(req, res, next) {
  try {
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const onlyProject = projectId ? { id: projectId } : {};
    const onlyLinked = projectId ? { relatedProjectId: projectId } : {};
    const now = new Date();

    const [
      totalViewers,
      totalOfficials,
      totalNews,
      upcomingEvents,
      projects,
      pendingDeletions,
      heldEvents,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'VIEWER' } }),
      prisma.official.count({ where: { isActive: true } }),
      prisma.news.count({ where: { status: 'PUBLISHED' } }),
      prisma.event.count({ where: { startAt: { gte: now }, ...onlyLinked } }),
      // Archived projects are kept for the record but left out of the Dashboard numbers.
      prisma.project.findMany({
        where: { archivedAt: null, ...onlyProject },
        select: {
          id: true,
          title: true,
          budget: true,
          status: true,
          startDate: true,
          progressType: true,
          events: { select: { startAt: true } },
          approvalState: true,
          expenses: { select: { amount: true } },
        },
      }),
      prisma.deletionRequest.count({ where: { status: 'PENDING' } }),
      // Sessions that already took place, with their attendance records
      prisma.event.findMany({
        where: { startAt: { lte: now }, ...onlyLinked },
        orderBy: { startAt: 'desc' },
        take: 40,
        select: {
          id: true,
          title: true,
          startAt: true,
          attendance: { select: { status: true } },
        },
      }),
    ]);

    // Count on the effective status so a started PLANNING project shows as Ongoing.
    // Rejected proposals never became projects, so they are left out of the totals.
    const counts = {};
    let totalBudget = 0;
    let totalSpent = 0;
    let pendingApproval = 0;
    let totalProjects = 0;
    const spendByProject = [];

    projects.forEach((p) => {
      if (p.approvalState === 'REJECTED') return;
      totalProjects += 1;
      const status = effectiveStatus(p);
      counts[status] = (counts[status] || 0) + 1;
      const budget = Number(p.budget || 0);
      totalBudget += budget;
      if (status === 'PROPOSED' && p.approvalState === 'PENDING') pendingApproval += 1;

      let spent = 0;
      p.expenses.forEach((e) => {
        spent += Number(e.amount || 0);
      });
      totalSpent += spent;
      if (budget > 0 || spent > 0) spendByProject.push({ id: p.id, title: p.title, budget, spent });
    });

    // Present and Absent per session that already happened (Attendance by session chart)
    const sessionAttendance = [];
    heldEvents.forEach((e) => {
      if (e.attendance.length === 0) return;
      const row = { id: e.id, title: e.title, startAt: e.startAt, present: 0, absent: 0 };
      e.attendance.forEach((a) => {
        row[a.status === 'PRESENT' ? 'present' : 'absent'] += 1;
      });
      if (sessionAttendance.length < 8) sessionAttendance.push(row);
    });

    const closed = (counts.COMPLETED || 0) + (counts.ONGOING || 0) + (counts.CANCELLED || 0);

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
        totalSpent,
        byStatus: Object.entries(counts).map(([status, count]) => ({ status, count })),
        analytics: {
          activeProjects: (counts.ONGOING || 0) + (counts.PLANNING || 0),
          completionRate: closed > 0 ? Math.round(((counts.COMPLETED || 0) / closed) * 100) : null,
          budgetUsedRate: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : null,
          spendByProject: spendByProject.sort((a, b) => b.budget - a.budget).slice(0, 6),
          sessionAttendance: sessionAttendance.reverse(), // oldest first, so the chart reads left to right
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
