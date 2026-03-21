import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Helper to build response user object (no password)
const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  mobile: user.mobile,
  email: user.email,
  role: user.role,
  aadhaarId: user.aadhaarId,
  preferences: user.preferences,
  location: user.location,
});

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

// Tenant registration
router.post('/tenant/register', async (req, res) => {
  try {
    const { name, mobile, email, password, location } = req.body;

    if (!name || !mobile || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      mobile,
      email,
      passwordHash,
      role: 'tenant',
      location,
    });

    const token = signToken(user);

    return res.status(201).json({ user: buildUserResponse(user), token });
  } catch (err) {
    console.error('Tenant register error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Owner registration
router.post('/owner/register', async (req, res) => {
  try {
    const { name, mobile, email, password, location } = req.body;

    if (!name || !mobile || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      mobile,
      email,
      passwordHash,
      role: 'owner',
      location,
    });

    const token = signToken(user);

    return res.status(201).json({ user: buildUserResponse(user), token });
  } catch (err) {
    console.error('Owner register error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Tenant login
router.post('/tenant/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'tenant' });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);

    return res.json({ user: buildUserResponse(user), token });
  } catch (err) {
    console.error('Tenant login error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Owner login
router.post('/owner/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'owner' });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);

    return res.json({ user: buildUserResponse(user), token });
  } catch (err) {
    console.error('Owner login error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;

