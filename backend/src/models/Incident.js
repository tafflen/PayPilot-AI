const mongoose = require('mongoose');
const { INCIDENT_STATUS, INCIDENT_SEVERITY, INCIDENT_TYPE } = require('../utils/constants');

const investigationNoteSchema = new mongoose.Schema(
  {
    note: {
      type: String,
      required: [true, 'Note text is required'],
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      default: 'System',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentRef: {
      type: String,
      required: [true, 'Incident reference is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    // Idempotency key prevents duplicate open incidents for the same problem on repeated runs
    idempotencyKey: {
      type: String,
      required: true,
      index: true,
    },
    incidentType: {
      type: String,
      required: [true, 'Incident type is required'],
      enum: Object.values(INCIDENT_TYPE),
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: Object.values(INCIDENT_SEVERITY),
      default: INCIDENT_SEVERITY.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(INCIDENT_STATUS),
      default: INCIDENT_STATUS.OPEN,
      index: true,
    },
    orderRef: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
      default: '',
    },
    transactionRef: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
      default: '',
    },
    expectedAmount: {
      type: Number,
      default: null,
    },
    recordedAmount: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'USD',
    },
    triggeredRule: {
      type: String,
      required: [true, 'Triggered rule identifier is required'],
      trim: true,
    },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    investigationNotes: [investigationNoteSchema],
    resolutionNote: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedBy: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

incidentSchema.virtual('expectedAmountMajor').get(function () {
  return this.expectedAmount !== null ? (this.expectedAmount / 100).toFixed(2) : null;
});

incidentSchema.virtual('recordedAmountMajor').get(function () {
  return this.recordedAmount !== null ? (this.recordedAmount / 100).toFixed(2) : null;
});

incidentSchema.set('toJSON', { virtuals: true });
incidentSchema.set('toObject', { virtuals: true });

const Incident = mongoose.model('Incident', incidentSchema);
module.exports = Incident;
