import express from 'express';
import { requireAdmin } from '../middleware/admin.js';
import { Property } from '../models/Property.js';
import { User } from '../models/User.js';

const router = express.Router();

// Get all unverified properties for admin review
router.get('/properties', requireAdmin, async (req, res) => {
  try {
    const properties = await Property.find({ is_verified: false })
      .populate('owner_id', 'name email mobile')
      .sort({ createdAt: -1 });

    return res.json({ properties });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin get properties error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Approve a property
router.patch('/approve/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findByIdAndUpdate(
      id,
      { is_verified: true },
      { new: true },
    ).populate('owner_id', 'name email mobile');

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    return res.json({ property });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin approve property error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Reject a property (delete from collection)
router.delete('/reject/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findByIdAndDelete(id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    return res.json({ message: 'Property rejected and removed.' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin reject property error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;

