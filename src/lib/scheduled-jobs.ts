/**
 * Scheduled Jobs Configuration
 *
 * Vercel Cron job definitions that trigger agents on a schedule
 * Each agent runs as a separate cron job for reliability and parallelism
 */

export interface CronJob {
  name: string
  agent: string
  schedule: string
  description: string
}

/**
 * All scheduled agents and their cron expressions
 *
 * Cron reference: https://crontab.guru/
 * Format: minute hour day month dayOfWeek
 */
export const SCHEDULED_AGENTS: CronJob[] = [
  {
    name: 'mail-listener',
    agent: 'workflow-mail-listener',
    schedule: '*/5 * * * *', // Every 5 minutes
    description: 'Monitor inbox for status changes',
  },
  {
    name: 'pipeline-tracker',
    agent: 'workflow-tracker',
    schedule: '*/10 * * * *', // Every 10 minutes
    description: 'Update application pipeline',
  },
  {
    name: 'job-finder',
    agent: 'workflow-role-finder',
    schedule: '0 * * * *', // Hourly at :00
    description: 'Search for job opportunities',
  },
  {
    name: 'skill-scanner',
    agent: 'workflow-market-scanner',
    schedule: '0 11 * * *', // Daily at 11 AM
    description: 'Analyze market skills',
  },
  {
    name: 'learning-planner',
    agent: 'workflow-gap-closer',
    schedule: '0 8 * * *', // Daily at 8 AM
    description: 'Generate weekly learning plans',
  },
  {
    name: 'metrics-daily-email',
    agent: 'workflow-metrics-reporter',
    schedule: '0 9 * * *', // Daily at 9 AM
    description: 'Send daily job recommendations email',
  },
]

/**
 * Get job status by agent name
 */
export function getJobByAgent(agentName: string): CronJob | undefined {
  return SCHEDULED_AGENTS.find((job) => job.agent === agentName)
}

/**
 * Get all job names
 */
export function getAllJobNames(): string[] {
  return SCHEDULED_AGENTS.map((job) => job.name)
}

/**
 * Verify cron expression format
 */
export function isValidCronExpression(cronExpression: string): boolean {
  const cronParts = cronExpression.split(' ')
  return cronParts.length === 5
}
