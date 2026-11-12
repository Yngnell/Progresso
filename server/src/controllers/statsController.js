const prisma = require('../prisma');
const { RUNNING_STAGES } = require('../utils/notifications');

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
      upcomingEvents,
      projects,
      pendingDeletions,
      heldEvents,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'VIEWER' } }),
      prisma.official.count({ where: { isActive: true } }),
      prisma.event.count({ where: { startAt: { gte: now }, ...onlyLinked } }),
      // Archived projects are kept for the record but left out of the Dashboard numbers.
      prisma.project.findMany({
        where: { archivedAt: null, ...onlyProject },
        select: {
          id: true,
          status: true,
          approvalState: true,
          submittedAt: true,
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

    // The stage is stored on each project (Pending Approval through Completed, Rejected, On Hold, Archived).
    const counts = {};
    let pendingApproval = 0;
    let totalProjects = 0;

    projects.forEach((p) => {
      totalProjects += 1;
      const { status } = p;
      counts[status] = (counts[status] || 0) + 1;
      // Requests the SK Admin submitted and the Barangay Chairman has not decided yet
      if (status === 'PENDING_APPROVAL' && p.submittedAt) pendingApproval += 1;
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

    const running = RUNNING_STAGES.reduce((sum, s) => sum + (counts[s] || 0), 0);
    res.json({
      stats: {
        totalProjects,
        ongoingProjects: running,
        pendingApproval,
        pendingDeletions,
        totalViewers,
        totalOfficials,
        upcomingEvents,
        byStatus: Object.entries(counts).map(([status, count]) => ({ status, count })),
        analytics: {
          activeProjects: running + (counts.APPROVED || 0),
          sessionAttendance: sessionAttendance.reverse(), // oldest first, so the chart reads left to right
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
