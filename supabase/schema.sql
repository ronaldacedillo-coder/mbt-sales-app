-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('sales_engineer', 'bd_engineer', 'nsm', 'commercial_ac_head')),
  team_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accounts table
CREATE TABLE accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  description TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  contact_name TEXT,
  contact_title TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  decision_maker TEXT,
  decision_maker_title TEXT,
  budget_range TEXT,
  current_solution TEXT,
  pain_points TEXT,
  goals TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  notes TEXT,
  recommended_approach TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Itineraries table
CREATE TABLE itineraries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT,
  month DATE NOT NULL,
  visits JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  submitter_role TEXT NOT NULL,
  approver_role TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FCRs table (Field Contact Reports)
CREATE TABLE fcrs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  visit_date DATE,
  visit_type TEXT DEFAULT 'field_visit' CHECK (visit_type IN ('field_visit', 'phone_call', 'video_call', 'meeting', 'presentation')),
  attendees JSONB DEFAULT '[]'::jsonb,
  discussion_points JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  next_steps TEXT,
  follow_up_date DATE,
  notes TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  submitter_role TEXT NOT NULL,
  approver_role TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetings table
CREATE TABLE meetings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  meeting_date DATE,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  agenda TEXT,
  discussion_points JSONB DEFAULT '[]'::jsonb,
  decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  next_meeting_date DATE,
  notes TEXT,
  minutes_text TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can insert own accounts" ON accounts
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (created_by = auth.uid());

-- Itineraries policies
CREATE POLICY "Users can view own itineraries" ON itineraries
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "NSM can view SE itineraries" ON itineraries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'nsm')
    AND submitter_role IN ('sales_engineer', 'nsm')
  );

CREATE POLICY "Commercial AC Head can view BD and NSM itineraries" ON itineraries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'commercial_ac_head')
    AND submitter_role IN ('bd_engineer', 'nsm')
  );

CREATE POLICY "Users can insert own itineraries" ON itineraries
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own itineraries" ON itineraries
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Approvers can update status" ON itineraries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = approver_role)
  );

-- FCRs policies
CREATE POLICY "Users can view own FCRs" ON fcrs
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "NSM can view SE FCRs" ON fcrs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'nsm')
    AND submitter_role = 'sales_engineer'
  );

CREATE POLICY "Commercial AC Head can view BD FCRs" ON fcrs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'commercial_ac_head')
    AND submitter_role = 'bd_engineer'
  );

CREATE POLICY "Users can insert own FCRs" ON fcrs
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own FCRs" ON fcrs
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Approvers can update FCR status" ON fcrs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = approver_role)
  );

-- Meetings policies
CREATE POLICY "Users can view own meetings" ON meetings
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can insert own meetings" ON meetings
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own meetings" ON meetings
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own meetings" ON meetings
  FOR DELETE USING (created_by = auth.uid());

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales_engineer'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Indexes for performance
CREATE INDEX idx_accounts_created_by ON accounts(created_by);
CREATE INDEX idx_itineraries_created_by ON itineraries(created_by);
CREATE INDEX idx_itineraries_status ON itineraries(status);
CREATE INDEX idx_itineraries_submitter_role ON itineraries(submitter_role);
CREATE INDEX idx_fcrs_created_by ON fcrs(created_by);
CREATE INDEX idx_fcrs_status ON fcrs(status);
CREATE INDEX idx_fcrs_submitter_role ON fcrs(submitter_role);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_meetings_meeting_date ON meetings(meeting_date);