const mongoose = require('mongoose');
const { SUPPORT_STATUS } = require('../utils/constants');

const supportTicketSchema = new mongoose.Schema(
  {
    ticketRef: {
      type: String,
      required: [true, 'Ticket reference is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    customerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    orderRef: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    transactionRef: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    issueType: {
      type: String,
      enum: [
        'DUPLICATE_CHARGE',
        'PAYMENT_NOT_REFLECTED',
        'INCORRECT_AMOUNT',
        'REFUND_INQUIRY',
        'OTHER',
      ],
      default: 'OTHER',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Message description is required'],
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: Object.values(SUPPORT_STATUS),
      default: SUPPORT_STATUS.OPEN,
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;
