const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../utils/constants');

const paymentSchema = new mongoose.Schema(
  {
    orderRef: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
      default: '',
    },
    transactionRef: {
      type: String,
      required: [true, 'Transaction reference is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      default: 'DEMO', // Clearly indicates demo provider in this prototype
      uppercase: true,
      trim: true,
    },
    // Stored as integer minor units (e.g. 15000 = $150.00 USD)
    amount: {
      type: Number,
      required: [true, 'Payment amount in minor units is required'],
      min: [0, 'Payment amount cannot be negative'],
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
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.CAPTURED,
      index: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isDemo: {
      type: Boolean,
      default: true,
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

paymentSchema.virtual('amountMajor').get(function () {
  return (this.amount / 100).toFixed(2);
});

paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
