import { Router } from 'express';
import * as statusService from '../statusService';

const router = Router();

// GET /api/v1/status/:slug (public, no authentication required)
router.get<{ slug: string }>('/:slug', async (req, res, next) => {
  try {
    const data = await statusService.getBySlug(req.params.slug);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
