import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['tenant', 'owner', 'admin'], required: true },
    aadhaarId: { type: String },
    preferences: {
      accommodation_type: { type: String },
      budget_min: { type: Number },
      budget_max: { type: Number },
      preferred_city: { type: String },
      preferred_area: { type: String },
      gender_preference: { type: String },
      amenities: [{ type: String }],
      move_in_date: { type: Date },
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      lastUpdated: { type: Date },
    },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);

