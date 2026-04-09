import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
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
    const { data: conversations, error } = await service
      .from('chat_conversations')
      .select('id, title, created_at, updated_at')
      .eq('org_id', userOrg.org_id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch conversations:', error)
      return Response.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    return Response.json({ conversations: conversations ?? [] })
  } catch (error) {
    console.error('Conversations GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const { title } = body as { title?: string }

    const service = createServiceClient()
    const { data: conversation, error } = await service
      .from('chat_conversations')
      .insert({
        org_id: userOrg.org_id,
        user_id: user.id,
        title: title || 'New Chat',
      })
      .select('id, title, created_at, updated_at')
      .single()

    if (error) {
      console.error('Failed to create conversation:', error)
      return Response.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    return Response.json({ conversation })
  } catch (error) {
    console.error('Conversations POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
