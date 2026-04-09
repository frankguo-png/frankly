import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!userOrg) {
      return Response.json({ error: 'Organization not found' }, { status: 404 })
    }

    const service = createServiceClient()

    // Verify conversation belongs to this user/org
    const { data: conversation, error: convError } = await service
      .from('chat_conversations')
      .select('id, title, created_at, updated_at')
      .eq('id', id)
      .eq('org_id', userOrg.org_id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Fetch messages
    const { data: messages, error: msgError } = await service
      .from('chat_messages')
      .select('id, role, content, metadata, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('Failed to fetch messages:', msgError)
      return Response.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return Response.json({ conversation, messages: messages ?? [] })
  } catch (error) {
    console.error('Conversation GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title } = body as { title?: string }

    if (!title) {
      return Response.json({ error: 'Title is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!userOrg) {
      return Response.json({ error: 'Organization not found' }, { status: 404 })
    }

    const service = createServiceClient()

    const { error } = await service
      .from('chat_conversations')
      .update({ title })
      .eq('id', id)
      .eq('org_id', userOrg.org_id)
      .eq('user_id', user.id)

    if (error) {
      return Response.json({ error: 'Failed to update title' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Conversation PATCH error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!userOrg) {
      return Response.json({ error: 'Organization not found' }, { status: 404 })
    }

    const service = createServiceClient()

    // Verify ownership before deleting
    const { data: conv } = await service
      .from('chat_conversations')
      .select('id')
      .eq('id', id)
      .eq('org_id', userOrg.org_id)
      .eq('user_id', user.id)
      .single()

    if (!conv) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Delete messages first (FK constraint), then conversation
    await service.from('chat_messages').delete().eq('conversation_id', id)
    await service.from('chat_conversations').delete().eq('id', id)

    return Response.json({ success: true })
  } catch (error) {
    console.error('Conversation DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
