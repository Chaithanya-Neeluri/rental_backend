import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = express.Router();

// GET current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        aadhaarId: user.aadhaarId,
        preferences: user.preferences,
        location: user.location,
      },
    });
  } catch (err) {
    console.error('Get profile error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update profile + preferences (tenants only)
router.put('/update-profile', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can update preferences' });
    }

    const { name, phone_number, aadhaar_id, preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({ message: 'Preferences are required' });
    }

    const { budget_min, budget_max } = preferences;
    if (
      typeof budget_min === 'number' &&
      typeof budget_max === 'number' &&
      budget_min > budget_max
    ) {
      return res.status(400).json({ message: 'Minimum budget cannot exceed maximum budget' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) {
      user.name = name;
    }
    if (phone_number) {
      user.mobile = phone_number;
    }
    if (aadhaar_id) {
      user.aadhaarId = aadhaar_id;
    }

    user.preferences = {
      ...user.preferences?.toObject?.(),
      ...preferences,
    };

    await user.save();

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        aadhaarId: user.aadhaarId,
        preferences: user.preferences,
        location: user.location,
      },
      message: 'Profile updated successfully',
    });
  } catch (err) {
    console.error('Update profile error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update location (tenants only)
router.put('/location', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can update location' });
    }

    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ message: 'Latitude and longitude are required numbers' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.location = {
      latitude,
      longitude,
      lastUpdated: new Date(),
    };

    await user.save();

    return res.json({
      message: 'Location updated',
      location: user.location,
    });
  } catch (err) {
    console.error('Update location error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;

