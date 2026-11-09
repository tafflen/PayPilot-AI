const test = require('node:test');
const assert = require('node:assert/strict');
const { investigateIncident } = require('../src/services/aiInvestigationService');

test('AI Investigation Service - Throws clear error when GEMINI_API_KEY is missing', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;

    await assert.rejects(
      async () => {
        await investigateIncident({
          incidentRef: 'INC-TEST-001',
          incidentType: 'AMOUNT_MISMATCH',
          orderRef: 'ORD-TEST-001',
          expectedAmount: 10000,
          recordedAmount: 8000,
          currency: 'USD',
        });
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Gemini API key is not configured'));
        return true;
      }
    );
  } finally {
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }
});
