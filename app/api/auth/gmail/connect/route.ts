import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GMAIL_CLIENT_ID
    const redirectUri = process.env.GMAIL_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: 'Gmail OAuth not configured' }, { status: 500 })
    }

    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', GMAIL_SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('Gmail connect error:', error)
    return NextResponse.json({ error: 'Failed to initiate Gmail connection' }, { status: 500 })
  }
}