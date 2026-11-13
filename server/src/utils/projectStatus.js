// The SK project process: which status changes are allowed. Every change goes through
// assertTransition, so any other change is refused by the server.
//   DRAFT -> PENDING                       the SK Admin submits (Project Request)
//   PENDING -> APPROVED | REJECTED | FOR_REVISION   the Barangay Chairman decides (Review)
//   FOR_REVISION -> PENDING                the SK Admin resubmits (Project Request)
//   APPROVED -> ONGOING                    the SK Admin starts the project
//   ONGOING -> COMPLETED                   Completion
//   APPROVED | ONGOING -> CANCELLED        Cancellation

const TRANSITIONS = {
  DRAFT: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED', 'FOR_REVISION'],
  FOR_REVISION: ['PENDING'],
  APPROVED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['COMPLETED', 'CANCELLED'],
};

const STATUS_LABEL = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  FOR_REVISION: 'For Revision',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

// The SK Admin may change a request's details only while it is a draft or returned for revision.
const EDITABLE = ['DRAFT', 'FOR_REVISION'];
// Closed projects: view only (kept in Archives).
const CLOSED = ['REJECTED', 'COMPLETED', 'CANCELLED'];

const canMove = (from, to) => (TRANSITIONS[from] || []).includes(to);

// Throws a 400 error unless the change is allowed.
function assertTransition(from, to) {
  if (!canMove(from, to)) {
    const err = new Error(
      `A ${STATUS_LABEL[from] || from} project cannot be changed to ${STATUS_LABEL[to] || to}`
    );
    err.status = 400;
    throw err;
  }
}

module.exports = { TRANSITIONS, STATUS_LABEL, EDITABLE, CLOSED, canMove, assertTransition };
