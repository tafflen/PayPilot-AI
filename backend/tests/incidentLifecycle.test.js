const test = require('node:test');
const assert = require('node:assert/strict');
const { validateStatusTransition } = require('../src/validators/incidentValidator');
const { INCIDENT_STATUS } = require('../src/utils/constants');

test('Incident Lifecycle - Valid transition: open to investigating', () => {
  const check = validateStatusTransition(INCIDENT_STATUS.OPEN, INCIDENT_STATUS.INVESTIGATING);
  assert.equal(check.isValid, true);
});

test('Incident Lifecycle - Valid transition: investigating to resolved with note', () => {
  const check = validateStatusTransition(
    INCIDENT_STATUS.INVESTIGATING,
    INCIDENT_STATUS.RESOLVED,
    'Root cause identified: manual ledger adjustment completed by finance team.'
  );
  assert.equal(check.isValid, true);
});

test('Incident Lifecycle - Invalid transition: open to resolved directly', () => {
  const check = validateStatusTransition(
    INCIDENT_STATUS.OPEN,
    INCIDENT_STATUS.RESOLVED,
    'Attempting direct resolution'
  );
  assert.equal(check.isValid, false);
  assert.match(check.message, /not allowed/i);
});

test('Incident Lifecycle - Invalid transition: resolving without resolution note', () => {
  const checkEmpty = validateStatusTransition(
    INCIDENT_STATUS.INVESTIGATING,
    INCIDENT_STATUS.RESOLVED,
    ''
  );
  assert.equal(checkEmpty.isValid, false);
  assert.match(checkEmpty.message, /resolution note is required/i);

  const checkWhitespace = validateStatusTransition(
    INCIDENT_STATUS.INVESTIGATING,
    INCIDENT_STATUS.RESOLVED,
    '    '
  );
  assert.equal(checkWhitespace.isValid, false);
});

test('Incident Lifecycle - Valid transition: reopening resolved incident', () => {
  const check = validateStatusTransition(INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.OPEN);
  assert.equal(check.isValid, true);
});

test('Incident Lifecycle - Invalid target status', () => {
  const check = validateStatusTransition(INCIDENT_STATUS.OPEN, 'unknown_status');
  assert.equal(check.isValid, false);
  assert.match(check.message, /invalid target status/i);
});

test('Incident Lifecycle - Idempotent same-state transition', () => {
  const check = validateStatusTransition(INCIDENT_STATUS.OPEN, INCIDENT_STATUS.OPEN);
  assert.equal(check.isValid, true);
});
