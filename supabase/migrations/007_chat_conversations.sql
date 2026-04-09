-- Chat conversations and messages tables
-- Enables persistent AI chat history per user per org

-- Conversations table
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages table
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_chat_conversations_org_user on public.chat_conversations(org_id, user_id);
create index if not exists idx_chat_conversations_updated on public.chat_conversations(updated_at desc);
create index if not exists idx_chat_messages_conversation on public.chat_messages(conversation_id, created_at asc);

-- RLS
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- Conversations: users can only see conversations belonging to their org
create policy "Users can view own org conversations"
  on public.chat_conversations for select
  using (
    exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.org_id = chat_conversations.org_id
    )
    and user_id = auth.uid()
  );

create policy "Users can insert own org conversations"
  on public.chat_conversations for insert
  with check (
    exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.org_id = chat_conversations.org_id
    )
    and user_id = auth.uid()
  );

create policy "Users can update own conversations"
  on public.chat_conversations for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.org_id = chat_conversations.org_id
    )
  );

-- Messages: users can access messages for conversations they own
create policy "Users can view messages for own conversations"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_conversations cc
      join public.user_organizations uo on uo.org_id = cc.org_id
      where cc.id = chat_messages.conversation_id
        and cc.user_id = auth.uid()
        and uo.user_id = auth.uid()
    )
  );

create policy "Users can insert messages for own conversations"
  on public.chat_messages for insert
  with check (
    exists (
      select 1 from public.chat_conversations cc
      join public.user_organizations uo on uo.org_id = cc.org_id
      where cc.id = chat_messages.conversation_id
        and cc.user_id = auth.uid()
        and uo.user_id = auth.uid()
    )
  );

-- Service role bypass (for API routes using service client)
create policy "Service role full access to conversations"
  on public.chat_conversations for all
  using (true)
  with check (true);

create policy "Service role full access to messages"
  on public.chat_messages for all
  using (true)
  with check (true);
