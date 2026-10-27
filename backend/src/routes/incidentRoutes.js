const express = require('express');
const {
  listIncidents,
  getIncidentById,
  updateIncidentStatus,
  addInvestigationNote,
  investigateIncidentWithAI,
} = require('../controllers/incidentController');
const { authenticate } = require('../middleware/auth');
const {
  validateIncidentStatusUpdate,
  validateAddNote,
} = require('../validators/incidentValidator');

const router = express.Router();

router.use(authenticate);

router.get('/', listIncidents);
router.post('/:id/ai-investigation', investigateIncidentWithAI);
router.get('/:id', getIncidentById);
router.patch('/:id/status', validateIncidentStatusUpdate, updateIncidentStatus);
router.post('/:id/notes', validateAddNote, addInvestigationNote);

module.exports = router;
