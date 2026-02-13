-- Enhanced Supabase Schema with Ship Faster Patterns
-- Includes RLS policies for sealed agent boundaries + approval gates

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============= USERS TABLE =============
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  profile_picture_url TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferences JSONB DEFAULT '{}',
  availability_hours_per_day FLOAT DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- ============= APPLICATIONS TABLE =============
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  job_url TEXT,
  location VARCHAR(255),
  salary_min INTEGER,
  salary_max INTEGER,
  description TEXT,
  applied_date DATE,
  source_site VARCHAR(100),
  easy_apply BOOLEAN DEFAULT false,
  current_status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
  last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  days_in_stage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Approval gate for status changes initiated by Mail Agent
  status_change_pending BOOLEAN DEFAULT false,
  status_change_approved_at TIMESTAMP WITH TIME ZONE,
  status_change_rejected_reason TEXT
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = user_id);

-- Tracker Agent can only update specific fields + set approval gate
CREATE POLICY "Tracker Agent can update pipeline fields"
  ON applications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============= STATUS HISTORY TABLE (Event Log) =============
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  event_type VARCHAR(100),
  reason VARCHAR(255),
  notes TEXT,
  email_subject TEXT,
  email_body TEXT,
  detected_by VARCHAR(100) NOT NULL,
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own status history"
  ON status_history FOR SELECT
  USING (auth.uid() = user_id);

-- Only Mail Agent can insert (sealed boundary)
CREATE POLICY "Mail Agent can create status history"
  ON status_history FOR INSERT
  WITH CHECK (detected_by = 'mail-listener-agent' AND auth.uid() = user_id);

-- ============= JOB SUGGESTIONS TABLE =============
CREATE TABLE job_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_title VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  salary_min INTEGER,
  salary_max INTEGER,
  description TEXT,
  job_url TEXT NOT NULL,
  source_site VARCHAR(100),
  easy_apply BOOLEAN DEFAULT false,
  match_score FLOAT DEFAULT 0.0,
  applied BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE job_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
  ON job_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON job_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Only Job Market Agent can insert (sealed boundary)
CREATE POLICY "Job Market Agent can create suggestions"
  ON job_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============= SKILL DEMAND TABLE (Market Analysis) =============
CREATE TABLE skill_demand (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name VARCHAR(255) NOT NULL,
  skill_category VARCHAR(100),
  frequency INTEGER DEFAULT 1,
  rising_trend BOOLEAN DEFAULT false,
  appears_in_rejections INTEGER DEFAULT 0,
  appears_in_offers INTEGER DEFAULT 0,
  last_detected TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, skill_name)
);

ALTER TABLE skill_demand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill demand"
  ON skill_demand FOR SELECT
  USING (auth.uid() = user_id);

-- Only Skill Research Agent can write (sealed boundary)
CREATE POLICY "Skill Research Agent can manage skill demand"
  ON skill_demand FOR ALL
  USING (auth.uid() = user_id);

-- ============= LEARNING TASKS TABLE =============
CREATE TABLE learning_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  topic VARCHAR(100),
  skill_target VARCHAR(255),
  difficulty_level VARCHAR(50),
  estimated_hours FLOAT,
  resources TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  priority VARCHAR(50) DEFAULT 'MEDIUM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE learning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning tasks"
  ON learning_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning tasks"
  ON learning_tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- Only Learning Planner Agent can create (sealed boundary)
CREATE POLICY "Learning Planner Agent can create tasks"
  ON learning_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============= AGENT AUDIT LOG TABLE =============
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

-- Agents can write audit logs
CREATE POLICY "Agents can create audit logs"
  ON agent_audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============= SCHEDULED JOBS TABLE =============
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

-- ============= EMAIL LOGS TABLE =============
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

-- ============= INDEXES FOR PERFORMANCE =============
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(current_status);
CREATE INDEX idx_applications_applied_date ON applications(applied_date);
CREATE INDEX idx_status_history_application_id ON status_history(application_id);
CREATE INDEX idx_status_history_user_id ON status_history(user_id);
CREATE INDEX idx_status_history_created_at ON status_history(created_at);
CREATE INDEX idx_job_suggestions_user_id ON job_suggestions(user_id);
CREATE INDEX idx_job_suggestions_applied ON job_suggestions(applied);
CREATE INDEX idx_skill_demand_user_id ON skill_demand(user_id);
CREATE INDEX idx_skill_demand_trending ON skill_demand(rising_trend);
CREATE INDEX idx_learning_tasks_user_id ON learning_tasks(user_id);
CREATE INDEX idx_learning_tasks_completed ON learning_tasks(completed);
CREATE INDEX idx_agent_audit_logs_user_id ON agent_audit_logs(user_id);
CREATE INDEX idx_agent_audit_logs_agent_name ON agent_audit_logs(agent_name);

-- ============= UPDATED_AT TRIGGER =============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at_trigger BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER applications_updated_at_trigger BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER job_suggestions_updated_at_trigger BEFORE UPDATE ON job_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER skill_demand_updated_at_trigger BEFORE UPDATE ON skill_demand
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER learning_tasks_updated_at_trigger BEFORE UPDATE ON learning_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER scheduled_jobs_updated_at_trigger BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
