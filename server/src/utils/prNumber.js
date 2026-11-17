// PR No. of a Purchase Request, in the format of the SKFPD "Monthly Itemized List of Purchase
// Request" (Annex E): MM-NNN-YYYY. MM and YYYY are the month and year of the PR (Philippine
// time); NNN counts the PRs of that month for the whole SK, starting again at 001 each month.
// Example: the second PR of November 2026 is 11-002-2026.

function phMonthYear(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return { month: parts.find((p) => p.type === 'month').value, year: parts.find((p) => p.type === 'year').value };
}

// The next free PR No. for the month of `date`. Uses the highest number already given that
// month (not a count), so deleting a PR never lets two PRs share a number.
async function nextPrNumber(db, date = new Date()) {
  const { month, year } = phMonthYear(date);
  const used = await db.liquidationFile.findMany({
    where: { prNo: { startsWith: `${month}-`, endsWith: `-${year}` } },
    select: { prNo: true },
  });
  const highest = used.reduce((max, { prNo }) => Math.max(max, Number(prNo.split('-')[1]) || 0), 0);
  return `${month}-${String(highest + 1).padStart(3, '0')}-${year}`;
}

module.exports = { nextPrNumber, phMonthYear };
