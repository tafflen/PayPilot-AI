const express = require('express');
const { createTicket, listTickets, updateTicket } = require('../controllers/supportController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

// Customers can create tickets and list their own; staff can list all
router.post('/tickets', createTicket);
router.get('/tickets', listTickets);

// Only Business Admin and Analyst can update ticket status
router.patch('/tickets/:id', authorize(ROLES.BUSINESS_ADMIN, ROLES.ADMIN, ROLES.ANALYST), updateTicket);

module.exports = router;
