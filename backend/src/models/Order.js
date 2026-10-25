const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../utils/constants');

const orderSchema = new mongoose.Schema(
  {
    orderRef: {
      type: String,
      required: [true, 'Order reference is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Order description is required'],
      trim: true,
    },
    // Stored as integer minor units (e.g. 15000 = $150.00 USD)
    expectedAmount: {
      type: Number,
      required: [true, 'Expected amount in minor units is required'],
      min: [0, 'Expected amount cannot be negative'],
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
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    invoiceRef: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    invoiceAmount: {
      type: Number,
      min: 0,
      validate: {
        validator: (v) => v === undefined || v === null || Number.isInteger(v),
        message: '{VALUE} must be an integer minor unit amount',
      },
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to help frontend with major unit presentation
orderSchema.virtual('expectedAmountMajor').get(function () {
  return (this.expectedAmount / 100).toFixed(2);
});

orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
