/**
 * Unified Workflow Scheduler Facade
 * 
 * Delegates directly to the comprehensive ScheduleService to prevent duplicate
 * node-cron tasks, while maintaining full compatibility with callers using the
 * refreshWorkflowSchedules / removeWorkflowSchedules interface.
 */
export {
  syncWorkflowSchedules as refreshWorkflowSchedules,
  removeWorkflowSchedules,
  initializeScheduler as initializeWorkflowScheduler,
  stopScheduler as stopWorkflowScheduler,
} from './scheduleService.js';
