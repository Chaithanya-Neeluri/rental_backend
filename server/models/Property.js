import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    city: { type: String, required: true },
    area: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false },
);

const propertySchema = new mongoose.Schema(
  {
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    propertyType: {
      type: String,
      enum: ['PG', 'Apartment', 'Independent House', 'Shared Room'],
      required: true,
    },
    price: { type: Number, required: true },
    location: { type: locationSchema, required: true },
    amenities: [{ type: String }],
    images: [{ type: String }],
    documents: [{ type: String }],
    is_verified: { type: Boolean, default: false },
    status: { type: String, enum: ['Available', 'Booked'], default: 'Available' },
  },
  { timestamps: true },
);

// Indexes to optimize search queries
propertySchema.index({ title: 'text', description: 'text' });
propertySchema.index({ 'location.city': 1 });
propertySchema.index({ 'location.area': 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ amenities: 1 });
propertySchema.index({ price: 1 });

export const Property = mongoose.model('Property', propertySchema);

