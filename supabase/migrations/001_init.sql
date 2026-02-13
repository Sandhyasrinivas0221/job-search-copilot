-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  profile_picture_url TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Applications table
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Status History table (event log for applications)
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  reason VARCHAR(255),
  notes TEXT,
  email_subject TEXT,
  email_body TEXT,
  detected_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Job Suggestions table
CREATE TABLE job_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_title VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  salary_min INTEGER,
  salary_max INTEGER,
  description TEXT,
  job_url TEXT NOT NULL UNIQUE,
  source_site VARCHAR(100),
  easy_apply BOOLEAN DEFAULT false,
  match_score FLOAT DEFAULT 0.0,
  applied BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Skill Demand table (market analysis)
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

-- Learning Tasks table
CREATE TABLE learning_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  topic VARCHAR(100),
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

-- Create indexes for better query performance
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(current_status);
CREATE INDEX idx_applications_date ON applications(applied_date);
CREATE INDEX idx_status_history_application_id ON status_history(application_id);
CREATE INDEX idx_status_history_user_id ON status_history(user_id);
CREATE INDEX idx_job_suggestions_user_id ON job_suggestions(user_id);
CREATE INDEX idx_job_suggestions_applied ON job_suggestions(applied);
CREATE INDEX idx_skill_demand_user_id ON skill_demand(user_id);
CREATE INDEX idx_skill_demand_trending ON skill_demand(rising_trend);
CREATE INDEX idx_learning_tasks_user_id ON learning_tasks(user_id);
CREATE INDEX idx_learning_tasks_completed ON learning_tasks(completed);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
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
