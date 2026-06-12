import { Router } from 'express';
import { authenticate } from '../authenticate';
import * as metricsService from '../metricsService';

const router = Router({ mergeParams: true });

// All metrics routes require authentication
router.use(authenticate);

type Window = '24h' | '7d' | '30d';
const VALID_WINDOWS: Window[] = ['24h', '7d', '30d'];

function parseWindow(raw: unknown): Window {
  return VALID_WINDOWS.includes(raw as Window) ? (raw as Window) : '24h';
}

// GET /api/v1/monitors/:id/stats?window=24h
router.get<{ id: string }>('/stats', async (req, res, next) => {
  try {
    const window = parseWindow(req.query.window);
    const data = await metricsService.getStats(req.params.id, req.userId, window);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/monitors/:id/checks?window=24h&page=1&limit=50
router.get<{ id: string }>('/checks', async (req, res, next) => {
  try {
    const window = parseWindow(req.query.window);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const data = await metricsService.getChecks(req.params.id, req.userId, window, page, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/monitors/:id/incidents?page=1&limit=20
router.get<{ id: string }>('/incidents', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const data = await metricsService.getIncidents(req.params.id, req.userId, page, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/monitors/:id/latency?window=24h
router.get<{ id: string }>('/latency', async (req, res, next) => {
  try {
    const window = parseWindow(req.query.window);
    const data = await metricsService.getLatency(req.params.id, req.userId, window);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
