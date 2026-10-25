const prisma = require('../prisma');
const { effectiveStatus } = require('./projectController');

const MONTH_KEY = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// GET /api/stats — admin/chairman dashboard summary numbers, status breakdown and the
// analytics behind the dashboard charts.
async function getStats(req, res, next) {
  try {
    const now = new Date();
    // First day of the month, five months back: the chart shows the last six months.
    const monthsFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);

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
      prisma.event.count({ where: { startAt: { gte: now } } }),
      // Archived projects are kept for the record but left out of the Dashboard numbers.
      prisma.project.findMany({
        where: { archivedAt: null },
        select: {
          id: true,
          title: true,
          budget: true,
          status: true,
          startDate: true,
          approvalState: true,
          expenses: { select: { amount: true, date: true } },
        },
      }),
      prisma.deletionRequest.count({ where: { status: 'PENDING' } }),
      // Sessions that already took place, with their attendance records
      prisma.event.findMany({
        where: { startAt: { lte: now } },
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
    const monthly = new Map();
    for (let i = 0; i < 6; i += 1) {
      monthly.set(MONTH_KEY(new Date(monthsFrom.getFullYear(), monthsFrom.getMonth() + i, 1)), 0);
    }
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
        const amount = Number(e.amount || 0);
        spent += amount;
        const key = MONTH_KEY(new Date(e.date));
        if (monthly.has(key)) monthly.set(key, monthly.get(key) + amount);
      });
      totalSpent += spent;
      if (budget > 0 || spent > 0) spendByProject.push({ id: p.id, title: p.title, budget, spent });
    });

    // Attendance across the sessions that already happened
    const attendance = { present: 0, late: 0, absent: 0, excused: 0 };
    const sessionAttendance = [];
    heldEvents.forEach((e) => {
      if (e.attendance.length === 0) return;
      const row = { id: e.id, title: e.title, startAt: e.startAt, present: 0, late: 0, absent: 0, excused: 0 };
      e.attendance.forEach((a) => {
        const k = a.status.toLowerCase();
        row[k] += 1;
        attendance[k] += 1;
      });
      if (sessionAttendance.length < 8) sessionAttendance.push(row);
    });
    const recorded = attendance.present + attendance.late + attendance.absent + attendance.excused;

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
          monthlySpending: [...monthly].map(([month, total]) => ({ month, total })),
          spendByProject: spendByProject.sort((a, b) => b.budget - a.budget).slice(0, 6),
          attendance: {
            ...attendance,
            recorded,
            rate: recorded > 0 ? Math.round(((attendance.present + attendance.late) / recorded) * 100) : null,
          },
          sessionAttendance: sessionAttendance.reverse(), // oldest first, so the chart reads left to right
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
