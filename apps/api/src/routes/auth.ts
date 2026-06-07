import { Router } from 'express';
import { z } from 'zod';
import { register, login } from '../authService';
import { authenticate } from '../authenticate';
import { validate } from '../validate';
import { prisma } from 'database';

const router = Router();

const AuthBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// POST /api/v1/auth/register
router.post('/register', validate(AuthBody), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof AuthBody>;
    const result = await register(email, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(AuthBody), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof AuthBody>;
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
