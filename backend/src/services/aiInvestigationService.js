require('../config/env');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Read the API key from backend/.env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function investigateIncident(incident) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

  // Use AI to explain existing findings, not invent payment facts.
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
You are PayPilot AI, a payment incident investigation assistant.
Explain the supplied incident in simple business language.
Suggest practical investigation steps.
Use only the supplied facts. Do not invent transaction details.
Clearly label anything that cannot be determined from the data.

Incident data:
${JSON.stringify(incident, null, 2)}
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { investigateIncident };
