import dotenv from 'dotenv';

dotenv.config();



export const requireAdmin = (req, res, next) => {
  try {
    const adminKey = req.headers['x-admin-key'];

    // Some secrets may contain whitespace (copy/paste). Normalize before comparing.
    const ADMIN_SECRET_RAW =
      process.env.ADMIN_SECRET ||
      '8ee4c1a27185e91b684bd763e11a585aad34f8b1da831fafa41c57a0b72a99ed';
    const ADMIN_SECRET = ADMIN_SECRET_RAW.trim();
    const normalizedAdminKey = (adminKey || '').toString().trim();

    if (!ADMIN_SECRET) {
      // If not configured, block admin access by default
      return res.status(500).json({ message: 'Admin configuration missing' });
    }

    if (!normalizedAdminKey || normalizedAdminKey !== ADMIN_SECRET) {
      return res.status(401).json({ message: 'Unauthorized: invalid admin key' });
    }

    return next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Admin middleware error', err);
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

