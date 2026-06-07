import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../authenticate';
import { validate } from '../validate';
import { CreateMonitorSchema } from 'shared';
import * as monitorService from '../monitorService';

const router = Router();

// All monitor routes require authentication
router.use(authenticate);

// Partial schema for PATCH updates (all fields optional)
const UpdateMonitorSchema = CreateMonitorSchema.partial();

// POST /api/v1/monitors — create a monitor
router.post('/', validate(CreateMonitorSchema), async (req, res, next) => {
  try {
    const monitor = await monitorService.create(req.userId, req.body);
    res.status(201).json({ monitor });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/monitors — list monitors for the current user (paginated)
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const result = await monitorService.listByUser(req.userId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/monitors/:id — get a single monitor
router.get('/:id', async (req, res, next) => {
  try {
    const monitor = await monitorService.getById(req.params.id, req.userId);
    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/monitors/:id — update a monitor
router.patch('/:id', validate(UpdateMonitorSchema), async (req, res, next) => {
  try {
    const monitor = await monitorService.update(req.params.id, req.userId, req.body);
    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/monitors/:id — delete a monitor
router.delete('/:id', async (req, res, next) => {
  try {
    await monitorService.remove(req.params.id, req.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/monitors/:id/pause
router.post('/:id/pause', async (req, res, next) => {
  try {
    const monitor = await monitorService.pause(req.params.id, req.userId);
    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/monitors/:id/resume
router.post('/:id/resume', async (req, res, next) => {
  try {
    const monitor = await monitorService.resume(req.params.id, req.userId);
    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

export default router;
