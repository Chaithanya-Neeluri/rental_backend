import mongoose from 'mongoose';

const enquirySchema = new mongoose.Schema(
  {
    tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected', 'Resolved'],
      default: 'Pending',
      required: true,
    },
    read_status: { type: Boolean, default: false, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Enquiry = mongoose.model('Enquiry', enquirySchema);

