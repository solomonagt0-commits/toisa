import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing tokens for revocation
    const { data: connection } = await supabase
      .from('gmail_connections')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .single()

    // Attempt to revoke tokens with Google (best effort)
    if (connection?.access_token) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: connection.access_token }),
        })
      } catch (e) {
        console.warn('Token revocation failed (non-critical):', e)
      }
    }

    // Remove from database
    const { error: deleteError } = await supabase
      .from('gmail_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete Gmail connection:', deleteError)
      return NextResponse.json({ error: 'Failed to disconnect Gmail' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gmail disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Gmail' }, { status: 500 })
  }
}