import { Router } from 'express';
import { authenticate } from '../authenticate';
import * as dashboardService from '../dashboardService';

const router = Router();

// Dashboard route requires authentication
router.use(authenticate);

// GET /api/v1/dashboard
router.get('/', async (req, res, next) => {
  try {
    const summary = await dashboardService.getDashboardSummary(req.userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/failed-jobs
router.get('/failed-jobs', async (req, res, next) => {
  try {
    const jobType = typeof req.query.jobType === 'string' ? req.query.jobType : undefined;
    const failedJobs = await dashboardService.getFailedJobs(jobType);
    res.json(failedJobs);
  } catch (err) {
    next(err);
  }
});

export default router;
