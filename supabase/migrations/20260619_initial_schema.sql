-- Create Meetings Table
CREATE TABLE public.meetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'processing' NOT NULL, -- 'processing', 'completed', 'failed'
    transcript TEXT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '30 days') NOT NULL
);

-- Create Action Items Table
CREATE TABLE public.action_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    assignee VARCHAR(255),
    deadline DATE,
    is_completed BOOLEAN DEFAULT false NOT NULL
);

-- Create Decisions Table
CREATE TABLE public.decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL
);

-- Create Risks Table
CREATE TABLE public.risks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) DEFAULT 'medium' NOT NULL -- 'low', 'medium', 'high'
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can only view/manage their own meetings"
    ON public.meetings
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access actions of their meetings"
    ON public.action_items
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE meetings.id = action_items.meeting_id AND meetings.user_id = auth.uid()
    ));

CREATE POLICY "Users can only access decisions of their meetings"
    ON public.decisions
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE meetings.id = decisions.meeting_id AND meetings.user_id = auth.uid()
    ));

CREATE POLICY "Users can only access risks of their meetings"
    ON public.risks
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE meetings.id = risks.meeting_id AND meetings.user_id = auth.uid()
    ));
