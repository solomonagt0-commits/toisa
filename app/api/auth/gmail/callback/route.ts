import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
      console.error('Gmail OAuth error:', error)
      return NextResponse.redirect(new URL(`/dashboard/settings?gmail_error=${error}`, request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/dashboard/settings?gmail_error=no_code', request.url))
    }

    // Verify state matches user
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
        if (stateData.userId !== user.id) {
          return NextResponse.redirect(new URL('/dashboard/settings?gmail_error=state_mismatch', request.url))
        }
      } catch {
        // State is optional, continue without it
      }
    }

    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET
    const redirectUri = process.env.GMAIL_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(new URL('/dashboard/settings?gmail_error=not_configured', request.url))
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      console.error('Token exchange failed:', err)
      return NextResponse.redirect(new URL('/dashboard/settings?gmail_error=token_failed', request.url))
    }

    const tokens = await tokenResponse.json()

    // Store tokens in Supabase
    const { error: upsertError } = await supabase
      .from('gmail_connections')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      console.error('Failed to store Gmail tokens:', upsertError)
      return NextResponse.redirect(new URL('/dashboard/settings?gmail_error=db_error', request.url))
    }

    return NextResponse.redirect(new URL('/dashboard/settings?gmail_connected=true', request.url))
  } catch (error) {
    console.error('Gmail callback error:', error)
    return NextResponse.redirect(new URL('/dashboard/settings?gmail_error=server_error', request.url))
  }
}