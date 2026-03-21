import express from 'express';
import { Property } from '../models/Property.js';
import { User } from '../models/User.js';

const router = express.Router();

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'in',
  'at',
  'on',
  'near',
  'with',
  'and',
  'or',
  'to',
  'for',
  'under',
  'below',
  'cheap',
  'cheapest',
  'low',
  'price',
  'rooms',
  'room',
]);

const AMENITY_KEYWORDS = {
  wifi: 'WiFi',
  'wi-fi': 'WiFi',
  internet: 'WiFi',
  ac: 'AC',
  'a/c': 'AC',
  airconditioner: 'AC',
  airconditioning: 'AC',
  cctv: 'CCTV',
  camera: 'CCTV',
  parking: 'Parking',
  park: 'Parking',
};

const PROPERTY_TYPE_KEYWORDS = {
  pg: 'PG',
  hostel: 'PG',
  apartment: 'Apartment',
  flat: 'Apartment',
  'independent house': 'Independent House',
  house: 'Independent House',
  room: 'Shared Room',
  'shared room': 'Shared Room',
};

const tokenize = (text) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t && !STOP_WORDS.has(t));

const detectPriceFilter = (qTokens) => {
  let maxPrice = null;
  let minPrice = null;

  for (let i = 0; i < qTokens.length; i += 1) {
    const token = qTokens[i];
    const value = Number(token.replace(/[^0-9]/g, ''));

    if (!Number.isNaN(value) && value > 0) {
      const prev = qTokens[i - 1] || '';
      const prevPrev = qTokens[i - 2] || '';

      if (prev === 'under' || prev === 'below' || prev === 'less' || prev === 'upto') {
        maxPrice = value;
      } else if (prevPrev === 'under' || prevPrev === 'below') {
        maxPrice = value;
      } else if (!maxPrice) {
        // Single numeric value, treat as soft max price
        maxPrice = value;
      }
    }
  }

  return { minPrice, maxPrice };
};

const buildSearchFilters = (q) => {
  const raw = (q || '').toString().toLowerCase();
  const tokens = tokenize(raw);

  const amenities = new Set();
  const propertyTypes = new Set();
  const locationTerms = new Set();
  const areaTerms = new Set();

  tokens.forEach((token, index) => {
    // Amenities
    if (AMENITY_KEYWORDS[token]) {
      amenities.add(AMENITY_KEYWORDS[token]);
    }

    // Property types
    if (PROPERTY_TYPE_KEYWORDS[token]) {
      propertyTypes.add(PROPERTY_TYPE_KEYWORDS[token]);
    }

    // Bigram for "independent house", "shared room"
    const next = tokens[index + 1];
    if (next) {
      const bigram = `${token} ${next}`;
      if (PROPERTY_TYPE_KEYWORDS[bigram]) {
        propertyTypes.add(PROPERTY_TYPE_KEYWORDS[bigram]);
      }
    }

    // Simple location hints (anything not recognized otherwise)
    if (!AMENITY_KEYWORDS[token] && !PROPERTY_TYPE_KEYWORDS[token]) {
      // Heuristic: if token length >= 4, treat as possible city/area
      if (token.length >= 4) {
        locationTerms.add(token);
        areaTerms.add(token);
      }
    }
  });

  const { minPrice, maxPrice } = detectPriceFilter(tokens);

  return {
    tokens,
    amenities: Array.from(amenities),
    propertyTypes: Array.from(propertyTypes),
    locationTerms: Array.from(locationTerms),
    areaTerms: Array.from(areaTerms),
    minPrice,
    maxPrice,
  };
};

const scoreProperty = (property, queryInfo) => {
  const {
    tokens, amenities, propertyTypes, locationTerms, areaTerms, minPrice, maxPrice,
  } = queryInfo;

  let score = 0;

  const lcTitle = property.title.toLowerCase();
  const lcDescription = property.description.toLowerCase();
  const lcCity = property.location.city.toLowerCase();
  const lcArea = property.location.area.toLowerCase();
  const lcAddress = property.location.address.toLowerCase();

  // Location scoring
  locationTerms.forEach((term) => {
    if (lcCity.includes(term)) score += 5; // city match
    if (lcAddress.includes(term)) score += 5;
  });

  areaTerms.forEach((term) => {
    if (lcArea.includes(term)) score += 6; // area match
  });

  // Property type scoring
  propertyTypes.forEach((ptype) => {
    if (property.propertyType.toLowerCase() === ptype.toLowerCase()) {
      score += 4;
    } else if (property.propertyType.toLowerCase().includes(ptype.toLowerCase())) {
      score += 2;
    }
  });

  // Amenities scoring
  const propertyAmenities = (property.amenities || []).map((a) => a.toLowerCase());
  amenities.forEach((amenity) => {
    if (propertyAmenities.includes(amenity.toLowerCase())) {
      score += 3;
    }
  });

  // Title / description scoring with fuzzy/partial matches
  tokens.forEach((token) => {
    if (lcTitle.includes(token)) score += 2;
    if (lcDescription.includes(token)) score += 1;

    // Simple typo tolerance: match first 3 chars
    if (token.length >= 4) {
      const partial = token.slice(0, 3);
      if (lcTitle.includes(partial)) score += 1;
      if (lcDescription.includes(partial)) score += 0.5;
    }
  });

  // Price relevance
  if (typeof property.price === 'number') {
    if (minPrice != null && maxPrice != null) {
      if (property.price >= minPrice && property.price <= maxPrice) {
        score += 4;
      }
    } else if (maxPrice != null) {
      if (property.price <= maxPrice) {
        score += 4;
      } else if (property.price <= maxPrice * 1.2) {
        score += 2;
      }
    }
  }

  return score;
};

// GET /api/search?q=
router.get('/', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const queryInfo = buildSearchFilters(q);

    const baseFilter = {
      is_verified: true,
      status: 'Available',
    };

    // Consider all verified, available properties.
    // Price and other query aspects are handled purely in the scoring function.
    const candidates = await Property.find(baseFilter).limit(200);

    const scored = candidates
      .map((p) => ({
        property: p,
        score: scoreProperty(p, queryInfo),
      }))
      .sort((a, b) => b.score - a.score || b.property.createdAt - a.property.createdAt);

    return res.json({
      query: q,
      count: scored.length,
      results: scored.map((item) => ({
        score: item.score,
        property: item.property,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Search error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/recommendations/:userId
router.get('/recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const baseFilter = {
      is_verified: true,
      status: 'Available',
    };

    const recFilter = { ...baseFilter };

    const preferredCity =
      user.preferences?.preferred_city || user.location?.city || null;
    const preferredArea =
      user.preferences?.preferred_area || user.location?.area || null;
    const budgetMin = user.preferences?.budget_min || null;
    const budgetMax = user.preferences?.budget_max || null;

    const preferredType = user.preferences?.accommodation_type || null;
    const preferredAmenities = Array.isArray(user.preferences?.amenities)
      ? user.preferences.amenities.filter(Boolean)
      : [];

    // Location: city and area
    if (preferredCity) {
      recFilter['location.city'] = { $regex: preferredCity, $options: 'i' };
    }
    if (preferredArea) {
      recFilter['location.area'] = { $regex: preferredArea, $options: 'i' };
    }

    // Property type preference
    if (preferredType) {
      recFilter.propertyType = preferredType;
    }

    // Amenities preference: recommend properties that have at least one of these amenities
    if (preferredAmenities.length > 0) {
      recFilter.amenities = { $in: preferredAmenities };
    }

    // Price range with a small tolerance
    if (budgetMin != null || budgetMax != null) {
      recFilter.price = {};
      if (budgetMin != null) recFilter.price.$gte = budgetMin * 0.8;
      if (budgetMax != null) recFilter.price.$lte = budgetMax * 1.2;
    }

    const recommended = await Property.find(recFilter)
      .sort({ createdAt: -1 })
      .limit(12);

    return res.json({ properties: recommended });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Recommendations error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;

