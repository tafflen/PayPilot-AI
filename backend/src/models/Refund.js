const mongoose = require('mongoose');
const { REFUND_STATUS } = require('../utils/constants');

const refundSchema = new mongoose.Schema(
  {
    refundRef: {
      type: String,
      required: [true, 'Refund reference is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    originalTransactionRef: {
      type: String,
      required: [true, 'Original transaction reference is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    orderRef: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
      default: '',
    },
    customerEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      default: '',
    },
    // Stored as integer minor units (e.g. 10000 = $100.00 USD)
    amount: {
      type: Number,
      required: [true, 'Refund amount in minor units is required'],
      min: [1, 'Refund amount must be positive'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer minor unit amount',
      },
    },
    currency: {
      type: String,
      required: [true, 'Currency code is required'],
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: 'USD',
    },
    reason: {
      type: String,
      trim: true,
      default: 'Duplicate payment refund',
    },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUS),
      default: REFUND_STATUS.PENDING,
      index: true,
    },
    paypalRefundId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    incidentRef: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

refundSchema.virtual('amountMajor').get(function () {
  return (this.amount / 100).toFixed(2);
});

refundSchema.set('toJSON', { virtuals: true });
refundSchema.set('toObject', { virtuals: true });

const Refund = mongoose.model('Refund', refundSchema);
module.exports = Refund;
