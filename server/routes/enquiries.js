import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Enquiry } from '../models/Enquiry.js';
import { Property } from '../models/Property.js';

const router = express.Router();

const serializeEnquiry = (enquiry) => {
  const tenant = enquiry.tenant_id && typeof enquiry.tenant_id === 'object'
    ? {
        id: enquiry.tenant_id._id?.toString?.() ?? enquiry.tenant_id.id?.toString?.(),
        name: enquiry.tenant_id.name,
        mobile: enquiry.tenant_id.mobile,
        email: enquiry.tenant_id.email,
      }
    : null;

  const property =
    enquiry.property_id && typeof enquiry.property_id === 'object'
      ? {
          id: enquiry.property_id._id?.toString?.(),
          title: enquiry.property_id.title,
        }
      : null;

  return {
    id: enquiry._id.toString(),
    tenant_id: enquiry.tenant_id?._id?.toString?.() ?? enquiry.tenant_id?.toString?.() ?? null,
    property_id:
      enquiry.property_id?._id?.toString?.() ?? enquiry.property_id?.toString?.() ?? null,
    tenant,
    property,
    message: enquiry.message,
    status: enquiry.status,
    created_at: enquiry.created_at,
    read_status: enquiry.read_status,
  };
};

// POST /api/enquiries
// Tenant creates an enquiry against a property.
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can create enquiries' });
    }

    const { propertyId, message } = req.body;

    if (!propertyId || !message) {
      return res.status(400).json({ message: 'propertyId and message are required' });
    }

    const property = await Property.findById(propertyId).select('owner_id is_verified status');
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (!property.is_verified) {
      return res.status(403).json({ message: 'Property is not verified' });
    }
    if (property.status !== 'Available') {
      return res.status(403).json({ message: 'Property is not available' });
    }

    const enquiry = await Enquiry.create({
      tenant_id: req.user.id,
      property_id: property._id,
      message: message.toString(),
      status: 'Pending',
      read_status: false,
    });

    return res.status(201).json({ enquiry: serializeEnquiry(enquiry) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Create enquiry error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/enquiries/owner
// Owner views their property enquiries and can mark them as read.
router.get('/owner', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can view enquiries' });
    }

    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === true;

    const myProperties = await Property.find({ owner_id: req.user.id }).select('_id');
    const propertyIds = myProperties.map((p) => p._id);

    if (propertyIds.length === 0) {
      return res.json({ enquiries: [], unreadCount: 0 });
    }

    const unreadCount = await Enquiry.countDocuments({
      property_id: { $in: propertyIds },
      read_status: false,
    });

    const filter = {
      property_id: { $in: propertyIds },
    };

    if (unreadOnly) {
      filter.read_status = false;
    }

    const enquiries = await Enquiry.find(filter)
      .sort({ created_at: -1 })
      .populate({ path: 'tenant_id', select: 'name mobile email' })
      .populate({ path: 'property_id', select: 'title' });

    return res.json({
      enquiries: enquiries.map(serializeEnquiry),
      unreadCount,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get owner enquiries error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/enquiries/:enquiryId/read
router.patch('/:enquiryId/read', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can update enquiry read status' });
    }

    const { enquiryId } = req.params;
    const enquiry = await Enquiry.findById(enquiryId)
      .populate({ path: 'property_id', select: 'owner_id title' })
      .populate({ path: 'tenant_id', select: 'name mobile email' });

    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    if (enquiry.property_id?.owner_id?.toString?.() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own enquiries' });
    }

    enquiry.read_status = true;
    await enquiry.save();

    return res.json({ enquiry: serializeEnquiry(enquiry) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Mark enquiry read error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;

