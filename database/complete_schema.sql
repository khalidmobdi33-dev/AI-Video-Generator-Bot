-- ============================================
-- Complete Database Schema for Telegram Bot
-- ============================================
-- This file contains all database tables, indexes, triggers, and storage setup
-- Run this file in Supabase SQL Editor to set up the complete database
-- ============================================

-- ============================================
-- 1. USER STATES TABLE
-- ============================================
-- Stores the current state of each user in the bot conversation
CREATE TABLE IF NOT EXISTS user_states (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  video_file_id TEXT,
  image_file_id TEXT,
  video_url TEXT,
  image_url TEXT,
  prompt TEXT,
  task_id TEXT,
  current_message_id TEXT,
  youtube_client_secret TEXT,
  youtube_client_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. USER TASKS TABLE
-- ============================================
-- Stores all video generation tasks
CREATE TABLE IF NOT EXISTS user_tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  task_id TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'waiting',
  result_json TEXT,
  fail_code TEXT,
  fail_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. GENERATED VIDEOS LIBRARY TABLE
-- ============================================
-- Stores all generated videos for each user (video library)
CREATE TABLE IF NOT EXISTS generated_videos (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT UNIQUE NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. YOUTUBE CHANNELS TABLE
-- ============================================
-- Stores YouTube channel configuration for each user
CREATE TABLE IF NOT EXISTS youtube_channels (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  client_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  channel_id TEXT,
  channel_title TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. YOUTUBE UPLOADS TABLE
-- ============================================
-- Stores information about uploaded videos to YouTube
CREATE TABLE IF NOT EXISTS youtube_uploads (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  youtube_video_id TEXT,
  youtube_video_url TEXT,
  upload_status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================

-- User States indexes
CREATE INDEX IF NOT EXISTS idx_user_states_user_id ON user_states(user_id);

-- User Tasks indexes
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task_id ON user_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_state ON user_tasks(state);

-- Generated Videos indexes
CREATE INDEX IF NOT EXISTS idx_generated_videos_user_id ON generated_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_task_id ON generated_videos(task_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_created_at ON generated_videos(created_at DESC);

-- YouTube Channels indexes
CREATE INDEX IF NOT EXISTS idx_youtube_channels_user_id ON youtube_channels(user_id);

-- YouTube Uploads indexes
CREATE INDEX IF NOT EXISTS idx_youtube_uploads_user_id ON youtube_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_uploads_task_id ON youtube_uploads(task_id);

-- ============================================
-- 7. UPDATED_AT TRIGGER FUNCTION
-- ============================================
-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 8. TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================

-- Drop existing triggers if they exist (to allow re-running this script)
DROP TRIGGER IF EXISTS update_user_states_updated_at ON user_states;
DROP TRIGGER IF EXISTS update_user_tasks_updated_at ON user_tasks;
DROP TRIGGER IF EXISTS update_generated_videos_updated_at ON generated_videos;
DROP TRIGGER IF EXISTS update_youtube_channels_updated_at ON youtube_channels;
DROP TRIGGER IF EXISTS update_youtube_uploads_updated_at ON youtube_uploads;

-- Create triggers for updated_at
CREATE TRIGGER update_user_states_updated_at 
  BEFORE UPDATE ON user_states 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tasks_updated_at 
  BEFORE UPDATE ON user_tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_videos_updated_at 
  BEFORE UPDATE ON generated_videos 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_youtube_channels_updated_at 
  BEFORE UPDATE ON youtube_channels 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_youtube_uploads_updated_at 
  BEFORE UPDATE ON youtube_uploads 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. TABLE COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE user_states IS 'Stores the current conversation state for each Telegram user';
COMMENT ON TABLE user_tasks IS 'Stores all video generation tasks and their status';
COMMENT ON TABLE generated_videos IS 'Stores all generated videos library for users';
COMMENT ON TABLE youtube_channels IS 'Stores YouTube channel configuration for users';
COMMENT ON TABLE youtube_uploads IS 'Stores information about videos uploaded to YouTube';

COMMENT ON COLUMN user_states.state IS 'Current state: idle, waiting_video, waiting_image, waiting_prompt, generating, youtube_setup_client_secret, youtube_setup_client_id, youtube_setup_refresh_token, waiting_youtube_description';
COMMENT ON COLUMN user_tasks.state IS 'Task state: waiting, queuing, generating, success, fail';
COMMENT ON COLUMN youtube_channels.is_active IS 'Whether the YouTube channel is active and ready to use';
COMMENT ON COLUMN youtube_uploads.upload_status IS 'Upload status: pending, uploading, success, failed';

-- ============================================
-- 10. SUPABASE STORAGE SETUP
-- ============================================
-- Create storage bucket for videos if it doesn't exist
-- Note: This requires Supabase Storage API. Run this in Supabase Dashboard > Storage

-- Create bucket for videos (run this in Supabase Dashboard > Storage > New Bucket)
-- Bucket name: videos
-- Public: false (private bucket)
-- File size limit: 100MB
-- Allowed MIME types: video/*

-- Alternatively, you can use the Supabase Dashboard to create the bucket:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: videos
-- 4. Public: false
-- 5. File size limit: 100MB
-- 6. Allowed MIME types: video/*

-- Storage policies (run these after creating the bucket)
-- Allow authenticated users to upload videos
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'videos');

-- Allow authenticated users to read their own videos
-- CREATE POLICY "Allow authenticated reads" ON storage.objects
--   FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'videos');

-- Allow authenticated users to delete their own videos
-- CREATE POLICY "Allow authenticated deletes" ON storage.objects
--   FOR DELETE
--   TO authenticated
--   USING (bucket_id = 'videos');

-- ============================================
-- END OF SCHEMA
-- ============================================
-- This schema includes:
-- ✅ All tables (user_states, user_tasks, generated_videos, youtube_channels, youtube_uploads)
-- ✅ All indexes for performance
-- ✅ All triggers for auto-updating timestamps
-- ✅ All comments for documentation
-- ✅ Storage setup instructions
-- ============================================

