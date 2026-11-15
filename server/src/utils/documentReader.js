const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk').default;
const { betaZodOutputFormat } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { z } = require('zod');

// Reads an uploaded project file (JPG, PNG or PDF) with Claude and says what kind of SK document
// it is, e.g. a purchase request or an SK resolution. This is separate from the receipt reader:
// that one reads the amount of a receipt for the Expense form; this one only names the document.
// Only runs when ANTHROPIC_API_KEY is set; otherwise File Upload keeps the file's format type.

const KINDS = ['PURCHASE_REQUEST', 'SK_RESOLUTION', 'ACTIVITY_DESIGN', 'RECEIPT', 'PHOTO', 'REPORT', 'LIQUIDATION', 'OTHER'];

const DocumentSchema = z.object({
  documentType: z.enum(KINDS).describe('the kind of document, one of the listed values'),
});

const INSTRUCTION =
  'This file was uploaded to a project of the Sangguniang Kabataan (SK), the youth council of a barangay in the Philippines. ' +
  'Say what kind of document it is: PURCHASE_REQUEST (a purchase request or PR form listing items, quantities and costs to buy); ' +
  'SK_RESOLUTION (a resolution of the SK council, usually with "Resolution No." and "Resolved"); ' +
  'ACTIVITY_DESIGN (an activity design or project proposal with objectives, schedule and budget); ' +
  'RECEIPT (an official receipt, sales invoice or cash receipt); ' +
  'PHOTO (a photograph of an activity, people or a place, not a scanned document); ' +
  'REPORT (an accomplishment or narrative report of a finished activity); ' +
  'LIQUIDATION (a liquidation report summarizing the expenses of a project); ' +
  'OTHER (any other document).';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const READABLE = [...IMAGE_TYPES, 'application/pdf'];
const TIMEOUT_MS = 60 * 1000;

let client = null;
let testReader = null;
// Tests can put in a fake reader; null goes back to the real one.
function setDocumentReaderForTests(fn) {
  testReader = fn;
}

function isDocumentReaderConfigured() {
  return Boolean(testReader || process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

// filePath: the stored file; mimeType: its checked type. Returns one of KINDS, or throws.
async function readDocumentType(filePath, mimeType) {
  if (!READABLE.includes(mimeType)) throw new Error('Only images and PDF files can be read');
  if (testReader) return testReader(filePath, mimeType);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Document reading is not set up');
  const data = fs.readFileSync(filePath).toString('base64');
  const fileBlock = IMAGE_TYPES.includes(mimeType)
    ? { type: 'image', source: { type: 'base64', media_type: mimeType, data } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };

  const response = await getClient().beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 1000,
    // If the request is declined, the API retries it on a fallback model by itself.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(DocumentSchema) },
    messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: INSTRUCTION }] }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The document could not be read');
  const type = response.parsed_output?.documentType;
  if (!KINDS.includes(type)) throw new Error('The document could not be read');
  return type;
}

// Word and Excel files cannot be read here; a clear file name still tells their kind.
function guessFromName(name) {
  const n = String(name || '').toLowerCase();
  if (/purchase[\s_-]*request|(^|[^a-z])pr([^a-z]|$)/.test(n)) return 'PURCHASE_REQUEST';
  if (/resolution/.test(n)) return 'SK_RESOLUTION';
  if (/activity[\s_-]*design|proposal/.test(n)) return 'ACTIVITY_DESIGN';
  if (/liquidation/.test(n)) return 'LIQUIDATION';
  if (/accomplishment|report/.test(n)) return 'REPORT';
  if (/receipt|invoice|(^|[^a-z])or([^a-z]|$)/.test(n)) return 'RECEIPT';
  return null;
}

module.exports = { KINDS, readDocumentType, guessFromName, isDocumentReaderConfigured, setDocumentReaderForTests, READABLE };
