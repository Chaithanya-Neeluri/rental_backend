import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { Property } from '../models/Property.js';
import { storageBucket } from '../firebase.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadToFirebase = async (file, folder) => {
  if (!storageBucket) {
    throw new Error('Firebase storage is not configured');
  }

  const timestamp = Date.now();
  const safeName = file.originalname.replace(/\s+/g, '_');
  const filePath = `${folder}/${timestamp}_${safeName}`;
  const bucketFile = storageBucket.file(filePath);

  await bucketFile.save(file.buffer, {
    contentType: file.mimetype,
    public: true,
  });

  await bucketFile.makePublic();
  return bucketFile.publicUrl();
};

// Create a new property (owners only)
router.post(
  '/add',
  requireAuth,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'documents', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      if (req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Only owners can add properties' });
      }

      const {
        title,
        description,
        propertyType,
        price,
        location_city,
        location_area,
        location_address,
        location_pincode,
        location_latitude,
        location_longitude,
        amenities,
        status,
      } = req.body;

      if (!title || !description || !price) {
        return res.status(400).json({ message: 'Title, description and price are required' });
      }

      if (!location_city || !location_area || !location_address || !location_pincode) {
        return res.status(400).json({ message: 'Complete location details are required' });
      }

      const imagesFiles = req.files?.images || [];
      const documentFiles = req.files?.documents || [];

      if (!imagesFiles.length) {
        return res.status(400).json({ message: 'At least one property image is required' });
      }

      if (!documentFiles.length) {
        return res
          .status(400)
          .json({ message: 'At least one legal verification document is required' });
      }

      const imageUrls = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const file of imagesFiles) {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadToFirebase(file, 'properties/images');
        imageUrls.push(url);
      }

      const documentUrls = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const file of documentFiles) {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadToFirebase(file, 'properties/documents');
        documentUrls.push(url);
      }

      const location = {
        city: location_city,
        area: location_area,
        address: location_address,
        pincode: location_pincode,
      };

      if (location_latitude) {
        location.latitude = Number(location_latitude);
      }
      if (location_longitude) {
        location.longitude = Number(location_longitude);
      }

      const amenitiesArray =
        typeof amenities === 'string'
          ? amenities.split(',').map((a) => a.trim()).filter(Boolean)
          : Array.isArray(amenities)
            ? amenities
            : [];

      const property = await Property.create({
        owner_id: req.user.id,
        title,
        description,
        propertyType,
        price: Number(price),
        location,
        amenities: amenitiesArray,
        images: imageUrls,
        documents: documentUrls,
        status: status || 'Available',
      });

      return res.status(201).json({ property });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Add property error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },
);

// Update an existing property (owners only)
router.put(
  '/:propertyId',
  requireAuth,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'documents', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      if (req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Only owners can update properties' });
      }

      const { propertyId } = req.params;
      const property = await Property.findById(propertyId);

      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }

      if (property.owner_id.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You can only update your own properties' });
      }

      const {
        title,
        description,
        propertyType,
        price,
        location_city,
        location_area,
        location_address,
        location_pincode,
        location_latitude,
        location_longitude,
        amenities,
        status,
      } = req.body;

      if (title !== undefined) property.title = title;
      if (description !== undefined) property.description = description;
      if (propertyType !== undefined) property.propertyType = propertyType;
      if (price !== undefined) property.price = Number(price);

      if (
        location_city !== undefined ||
        location_area !== undefined ||
        location_address !== undefined ||
        location_pincode !== undefined ||
        location_latitude !== undefined ||
        location_longitude !== undefined
      ) {
        const nextLocation = {
          city: location_city ?? property.location.city,
          area: location_area ?? property.location.area,
          address: location_address ?? property.location.address,
          pincode: location_pincode ?? property.location.pincode,
          latitude:
            location_latitude !== undefined
              ? Number(location_latitude)
              : property.location.latitude,
          longitude:
            location_longitude !== undefined
              ? Number(location_longitude)
              : property.location.longitude,
        };
        property.location = nextLocation;
      }

      if (amenities !== undefined) {
        const amenitiesArray =
          typeof amenities === 'string'
            ? amenities.split(',').map((a) => a.trim()).filter(Boolean)
            : Array.isArray(amenities)
              ? amenities
              : [];
        property.amenities = amenitiesArray;
      }

      if (status !== undefined) {
        property.status = status;
      }

      const imagesFiles = req.files?.images || [];
      const documentFiles = req.files?.documents || [];

      if (imagesFiles.length) {
        const imageUrls = [];
        // eslint-disable-next-line no-restricted-syntax
        for (const file of imagesFiles) {
          // eslint-disable-next-line no-await-in-loop
          const url = await uploadToFirebase(file, 'properties/images');
          imageUrls.push(url);
        }

        // For simplicity, append new images to existing ones
        property.images = [...property.images, ...imageUrls];
      }

      if (documentFiles.length) {
        const documentUrls = [];
        // eslint-disable-next-line no-restricted-syntax
        for (const file of documentFiles) {
          // eslint-disable-next-line no-await-in-loop
          const url = await uploadToFirebase(file, 'properties/documents');
          documentUrls.push(url);
        }

        // For simplicity, append new documents to existing ones
        property.documents = [...property.documents, ...documentUrls];
      }

      await property.save();

      return res.json({ property });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Update property error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },
);

// Get all properties for an owner
router.get('/owner/:ownerId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can view their properties' });
    }

    const { ownerId } = req.params;

    if (ownerId !== req.user.id) {
      return res.status(403).json({ message: 'You can only view your own properties' });
    }

    const properties = await Property.find({ owner_id: ownerId }).sort({ createdAt: -1 });
    return res.json({ properties });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get owner properties error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/properties/:propertyId/details
// Tenant view: property details + owner's phone/email for enquiries/contact.
router.get('/:propertyId/details', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can view property details' });
    }

    const { propertyId } = req.params;

    const property = await Property.findById(propertyId).populate({
      path: 'owner_id',
      select: 'name mobile email',
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (!property.is_verified) {
      return res.status(403).json({ message: 'Property is not verified' });
    }

    if (property.status !== 'Available') {
      return res.status(403).json({ message: 'Property is not available' });
    }

    return res.json({ property });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Get property details error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;

