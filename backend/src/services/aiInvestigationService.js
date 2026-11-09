require('../config/env');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env');
  }
  return new GoogleGenerativeAI(apiKey);
}

async function investigateIncident(incident) {
  const genAI = getGenAI();

  // Use AI to explain existing findings, not invent payment facts.
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
You are PayPilot AI, a payment incident investigation assistant for small businesses.
Explain the supplied incident in simple business language.
Structure your response into two clear parts:
1. Incident Explanation: What happened based on the facts provided.
2. Recommended Practical Next Steps: Clear, bulleted action items for the business analyst.

Strict constraints:
- Use only the supplied facts. Do not invent transaction details or claim an action has been completed.
- Clearly label anything that cannot be determined from the data.
- Keep the language clear, practical, and non-technical.

Incident data:
${JSON.stringify(incident, null, 2)}
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { investigateIncident };
