-- Enhanced Supabase Schema - RLS Policies & Additional Tables
-- This file adds Row-Level Security policies and new tables for auditing/scheduling
-- It assumes tables from 001_init.sql already exist

-- ============= ADD RLS POLICIES TO EXISTING TABLES =============

-- Users Table RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Applications Table RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = user_id);

-- Status History Table RLS
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own status history"
  ON status_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Mail Agent can create status history"
  ON status_history FOR INSERT
  WITH CHECK (detected_by = 'mail-listener-agent' AND auth.uid() = user_id);

-- Job Suggestions Table RLS
ALTER TABLE job_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
  ON job_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON job_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Job Market Agent can create suggestions"
  ON job_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Skill Demand Table RLS
ALTER TABLE skill_demand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill demand"
  ON skill_demand FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Skill Research Agent can manage skill demand"
  ON skill_demand FOR ALL
  USING (auth.uid() = user_id);

-- Learning Tasks Table RLS
ALTER TABLE learning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning tasks"
  ON learning_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning tasks"
  ON learning_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Learning Planner Agent can create tasks"
  ON learning_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============= NEW TABLES FOR AUDITING & SCHEDULING =============

-- Agent Audit Log Table
CREATE TABLE agent_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_name VARCHAR(100) NOT NULL,
  action VARCHAR(255) NOT NULL,
  input_data JSONB,
  output_data JSONB,
  status VARCHAR(50), -- SUCCESS, ERROR, ESCALATED
  error_message TEXT,
  escalation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE agent_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON agent_audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Agents can create audit logs"
  ON agent_audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Email Logs Table
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_to VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50), -- SENT, FAILED, BOUNCED
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Scheduled Jobs Table
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_type VARCHAR(100) NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  cron_expression VARCHAR(100),
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status VARCHAR(50),
  last_run_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled jobs"
  ON scheduled_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- ============= ADDITIONAL INDEXES FOR PERFORMANCE =============

CREATE INDEX idx_agent_audit_logs_user_id ON agent_audit_logs(user_id);
CREATE INDEX idx_agent_audit_logs_agent_name ON agent_audit_logs(agent_name);
CREATE INDEX idx_agent_audit_logs_created_at ON agent_audit_logs(created_at);
CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX idx_scheduled_jobs_user_id ON scheduled_jobs(user_id);

-- ============= APPLY UPDATED_AT TRIGGER TO NEW TABLES =============

CREATE TRIGGER scheduled_jobs_updated_at_trigger BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
