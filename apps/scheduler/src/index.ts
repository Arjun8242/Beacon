import './config/env'; // validates env vars on startup
import './scheduler';   // registers the cron job
import './jobs/dataRetention'; // registers the 30-day data retention cleanup job
