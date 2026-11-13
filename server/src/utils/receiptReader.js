const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk').default;
const { betaZodOutputFormat } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { z } = require('zod');
const { EXPENSE_CATEGORIES } = require('./projectBudget');

// Reads an uploaded receipt (JPG, PNG or PDF) with Claude and returns what it says:
// { total, date, storeName, category, readable }. Only runs when ANTHROPIC_API_KEY is set on the server;
// otherwise the SK Admin types the amount (like email, it is simply off until set up).

const ReceiptSchema = z.object({
  readable: z.boolean().describe('false when the file is not a receipt or the total cannot be read'),
  total: z.number().nullable().describe('the total amount paid, in pesos, e.g. 1234.5'),
  date: z.string().nullable().describe('the date on the receipt as YYYY-MM-DD, or null'),
  storeName: z.string().nullable().describe('the name of the store or supplier, or null'),
  category: z.enum(EXPENSE_CATEGORIES).nullable().describe('what the purchase was for, one of the listed categories, or null'),
});

const INSTRUCTION =
  'This is a receipt (official receipt, sales invoice or cash receipt) from the Philippines. ' +
  'Find the TOTAL amount paid (the grand total / amount due, not a subtotal, VAT or change), the receipt date, ' +
  'and the store or supplier name. Amounts are in pesos. Also choose the category that best fits what was bought: ' +
  EXPENSE_CATEGORIES.join('; ') + ' (use Other Expenses when none fits). ' +
  'If the file is not a receipt or the total cannot be read, set readable to false and total to null.';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const TIMEOUT_MS = 60 * 1000;

let client = null;
// Tests can put in a fake reader; null goes back to the real one.
let testReader = null;
function setReaderForTests(fn) {
  testReader = fn;
}

function isReaderConfigured() {
  return Boolean(testReader || process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

// filePath: the stored file; mimeType: image/jpeg, image/png or application/pdf.
// Returns { total, date, storeName, category, readable } or throws.
async function readReceipt(filePath, mimeType) {
  if (testReader) return testReader(filePath, mimeType);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Receipt reading is not set up');
  const data = fs.readFileSync(filePath).toString('base64');
  const fileBlock = IMAGE_TYPES.includes(mimeType)
    ? { type: 'image', source: { type: 'base64', media_type: mimeType, data } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };

  const response = await getClient().beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    // If the request is declined, the API retries it on a fallback model by itself.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(ReceiptSchema) },
    messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: INSTRUCTION }] }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The receipt could not be read');
  const out = response.parsed_output;
  if (!out) throw new Error('The receipt could not be read');
  return out;
}

// Turns a reader result into the fields saved on the receipt.
function toReceiptFields(result) {
  const total = Number(result?.total);
  if (!result?.readable || !Number.isFinite(total) || total < 0) {
    return { readStatus: 'FAILED' };
  }
  const date = result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date) ? new Date(`${result.date}T00:00:00+08:00`) : null;
  return {
    amount: Math.round(total * 100) / 100,
    receiptDate: date && !Number.isNaN(date.getTime()) ? date : null,
    storeName: result.storeName ? String(result.storeName).trim().slice(0, 120) || null : null,
    readStatus: 'READ',
  };
}

module.exports = { readReceipt, toReceiptFields, isReaderConfigured, setReaderForTests };
