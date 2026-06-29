import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const emailRules = [
  { 
    pattern: /RFQ|request for quote|tender invitation|quotation/i, 
    category: 'rfq_invitation', 
    stage: 'discovered' 
  },
  { 
    pattern: /award|successful|contract awarded|you have been selected|won/i, 
    category: 'award', 
    stage: 'won' 
  },
  { 
    pattern: /regret|unsuccessful|not successful|declined|lost/i, 
    category: 'rejection', 
    stage: 'lost' 
  },
  { 
    pattern: /clarification|additional information|query|response required|please clarify/i, 
    category: 'clarification', 
    stage: 'in_progress' 
  },
  { 
    pattern: /reminder|closing date|deadline|submit by|due date/i, 
    category: 'deadline_reminder', 
    stage: null 
  },
]

function extractTenderInfo(subject: string, body: string): { tenderNumber?: string; title?: string } {
  const tenderNumberMatch = subject.match(/[A-Z]+[\-\/]?\d+[\/\-]?\d+/i)
  
  let title = subject
    .replace(/^(RE:|FW:|FWD:)\s*/i, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
  
  if (title.length > 150) {
    title = title.substring(0, 150) + '...'
  }
  
  return {
    tenderNumber: tenderNumberMatch ? tenderNumberMatch[0] : undefined,
    title: title || 'Untitled Tender'
  }
}

async function getValidGmailAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: connection } = await supabase
    .from('gmail_connections')
    .select('access_token, refresh_token, expiry_date')
    .eq('user_id', userId)
    .single()

  if (!connection) return null

  // Check if token is expired (with 5 min buffer)
  const expiryTime = new Date(connection.expiry_date).getTime()
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000

  if (expiryTime - now > bufferMs) {
    // Token still valid
    return connection.access_token
  }

  // Need to refresh
  if (!connection.refresh_token) return null

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenResponse.ok) return null

    const tokens = await tokenResponse.json()

    // Update stored tokens
    await supabase
      .from('gmail_connections')
      .update({
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return tokens.access_token
  } catch {
    return null
  }
}

async function fetchGmailMessages(accessToken: string, maxResults = 20) {
  // List messages from inbox
  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!listResponse.ok) {
    throw new Error('Failed to fetch Gmail messages')
  }

  const listData = await listResponse.json()
  const messages = listData.messages || []

  // Fetch full message details
  const detailedMessages = []
  for (const msg of messages.slice(0, 10)) { // Limit to 10 for performance
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (msgResponse.ok) {
      const msgData = await msgResponse.json()
      detailedMessages.push(msgData)
    }
  }

  return detailedMessages
}

function parseGmailMessage(message: any): { subject: string; sender: string; body: string; date: string } {
  const headers = message.payload?.headers || []
  
  const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)'
  const sender = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || ''
  const date = new Date(parseInt(message.internalDate)).toISOString()

  // Extract body
  let body = ''
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
  } else if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8')
        break
      }
    }
  }

  return { subject, sender, body, date }
}

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get valid access token
    const accessToken = await getValidGmailAccessToken(supabase, user.id)
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'Gmail not connected',
        code: 'GMAIL_NOT_CONNECTED'
      }, { status: 400 })
    }

    // Fetch real Gmail messages
    const messages = await fetchGmailMessages(accessToken)
    
    let processed = 0
    let created = 0
    let updated = 0

    for (const message of messages) {
      const { subject, sender, body, date } = parseGmailMessage(message)
      
      // Skip very short subjects (likely automated)
      if (subject.length < 10) continue

      processed++

      // Check if pipeline item already exists by subject
      const { data: existing } = await supabase
        .from('toisa_pipeline_items')
        .select('id, stage')
        .eq('subject', subject)
        .single()

      const { tenderNumber, title } = extractTenderInfo(subject, body)

      // Determine stage from email rules
      let newStage = 'discovered'
      for (const rule of emailRules) {
        if (rule.pattern.test(subject) || rule.pattern.test(body)) {
          if (rule.stage) {
            newStage = rule.stage
          }
          break
        }
      }

      if (existing) {
        // Update existing
        await supabase
          .from('toisa_pipeline_items')
          .update({ 
            stage: newStage,
            body: body.substring(0, 1000),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        updated++
      } else {
        // Create new
        await supabase.from('toisa_pipeline_items').insert({
          subject: title,
          sender: sender,
          body: body.substring(0, 1000),
          stage: newStage,
          source: 'email',
          deadline: null,
        })
        created++
      }
    }

    return NextResponse.json({
      processed,
      created,
      updated,
      message: 'Email sync completed'
    })
  } catch (error) {
    console.error('Email sync error:', error)
    return NextResponse.json({ error: 'Email sync failed' }, { status: 500 })
  }
}