import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

    // Verify conversation ownership
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

    // Find and delete the last assistant message
    const { data: lastMsg } = await service
      .from('chat_messages')
      .select('id')
      .eq('conversation_id', id)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastMsg) {
      await service.from('chat_messages').delete().eq('id', lastMsg.id)
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Delete last message error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
