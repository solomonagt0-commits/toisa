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
  // Extract tender number patterns
  const tenderNumberMatch = subject.match(/[A-Z]+[\-\/]?\d+[\/\-]?\d+/i)
  
  // Try to get a clean title from subject
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

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // For demo purposes, we'll simulate email sync
    // In production, this would use Gmail API with OAuth tokens
    
    let processed = 0
    let created = 0
    let updated = 0
    
    // Simulated email data for demo (in production, fetch from Gmail API)
    const simulatedEmails = [
      {
        subject: 'RFQ: Supply and Delivery of Water Tanks - REF: WT-2026-001',
        sender: 'procurement@government.gov.za',
        body: 'Dear Supplier, Please submit your quotation for the supply and delivery of water tanks...',
        date: new Date().toISOString()
      },
      {
        subject: 'Award Notification - Construction Services Contract',
        sender: 'awards@etenders.gov.za',
        body: 'Congratulations! Your company has been awarded the contract...',
        date: new Date().toISOString()
      }
    ]
    
    for (const email of simulatedEmails) {
      processed++
      
      // Check if pipeline item already exists by subject
      const { data: existing } = await supabase
        .from('toisa_pipeline_items')
        .select('id, stage')
        .eq('subject', email.subject)
        .single()
      
      const { tenderNumber, title } = extractTenderInfo(email.subject, email.body)
      
      // Determine stage from email rules
      let newStage = 'discovered'
      for (const rule of emailRules) {
        if (rule.pattern.test(email.subject) || rule.pattern.test(email.body)) {
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
            body: email.body.substring(0, 1000),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        updated++
      } else {
        // Create new
        await supabase.from('toisa_pipeline_items').insert({
          subject: title,
          sender: email.sender,
          body: email.body.substring(0, 1000),
          stage: newStage,
          source: 'email',
          deadline: null, // Would need to parse from email
        })
        created++
      }
    }
    
    return NextResponse.json({
      processed,
      created,
      updated,
      message: 'Email sync completed (demo mode)'
    })
  } catch (error) {
    console.error('Email sync error:', error)
    return NextResponse.json({ error: 'Email sync failed' }, { status: 500 })
  }
}
