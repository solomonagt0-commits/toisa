import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { format, addDays } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY)

interface TenderRow {
  id: string
  title: string
  entity: string | null
  category: string | null
  closing_date: string | null
  days_remaining: number | null
  location: string | null
  relevance_score: number
  url: string | null
}

function buildTenderCard(tender: TenderRow, urgency: 'urgent' | 'upcoming' | 'new'): string {
  const colors = {
    urgent: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', badge: '#dc2626' },
    upcoming: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', badge: '#d97706' },
    new: { bg: '#dcfce7', border: '#22c55e', text: '#166534', badge: '#16a34a' }
  }
  const c = colors[urgency]
  
  const daysRemaining = tender.days_remaining ?? 0
  const closingFormatted = tender.closing_date 
    ? format(new Date(tender.closing_date), 'MMM d, yyyy') 
    : 'TBD'
  
  return `
    <tr>
      <td style="padding: 16px; background: ${c.bg}; border-left: 4px solid ${c.border}; border-radius: 8px; margin-bottom: 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: top;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: ${c.text}; font-size: 15px;">
                ${tender.entity || 'Unknown Entity'}
              </p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;">
                ${tender.title}
              </p>
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${tender.category || 'General'}</span>
                ${tender.location ? `<span style="margin-left: 8px;">📍 ${tender.location}</span>` : ''}
              </p>
            </td>
            <td style="text-align: right; vertical-align: top; padding-left: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">Closes</p>
              <p style="margin: 0; font-weight: 700; color: ${c.badge}; font-size: 14px;">
                ${closingFormatted}
              </p>
              <p style="margin: 2px 0 0 0; font-weight: 600; color: ${c.badge}; font-size: 13px;">
                ${daysRemaining <= 0 ? 'CLOSED' : `in ${daysRemaining} days`}
              </p>
            </td>
          </tr>
        </table>
        ${tender.url ? `
          <p style="margin: 8px 0 0 0;">
            <a href="${tender.url}" style="color: #3b82f6; text-decoration: none; font-size: 13px;">
              View on eTenders →
            </a>
          </p>
        ` : ''}
      </td>
    </tr>
  `
}

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userEmail = user.email || 'mahlaselaza98@gmail.com'
    
    // Get user's profile for match info
    const { data: profile } = await supabase
      .from('toisa_user_profile')
      .select('service_categories, provinces')
      .eq('id', user.id)
      .single()
    
    // Get all tenders to categorize
    const { data: allTenders } = await supabase
      .from('toisa_tenders')
      .select('*')
      .order('discovered_at', { ascending: false })
      .limit(50)
    
    // Categorize by urgency
    const urgent: TenderRow[] = []
    const upcoming: TenderRow[] = []
    const newThisWeek: TenderRow[] = []
    
    for (const t of (allTenders || [])) {
      const days = t.days_remaining ?? 999
      if (days < 0) continue // Skip closed
      
      if (days < 7) {
        urgent.push(t as TenderRow)
      } else if (days <= 14) {
        upcoming.push(t as TenderRow)
      } else if (days <= 30) {
        newThisWeek.push(t as TenderRow)
      }
    }
    
    // Sort each by relevance_score desc
    const sortByRelevance = (a: TenderRow, b: TenderRow) => b.relevance_score - a.relevance_score
    urgent.sort(sortByRelevance)
    upcoming.sort(sortByRelevance)
    newThisWeek.sort(sortByRelevance)
    
    const totalCount = urgent.length + upcoming.length + newThisWeek.length
    
    // Build sections
    const urgentSection = urgent.length > 0 
      ? `
        <tr>
          <td style="padding: 0 0 24px 0;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">
              🔴 Urgent — Closing in less than 7 days
            </h2>
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
              ${urgent.map(t => buildTenderCard(t, 'urgent')).join('')}
            </table>
          </td>
        </tr>
      `
      : ''
    
    const upcomingSection = upcoming.length > 0
      ? `
        <tr>
          <td style="padding: 0 0 24px 0;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">
              🟡 Upcoming — Closing in 7-14 days
            </h2>
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
              ${upcoming.map(t => buildTenderCard(t, 'upcoming')).join('')}
            </table>
          </td>
        </tr>
      `
      : ''
    
    const newSection = newThisWeek.length > 0
      ? `
        <tr>
          <td style="padding: 0 0 24px 0;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
              🟢 New This Week — Closing in 14+ days
            </h2>
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
              ${newThisWeek.slice(0, 5).map(t => buildTenderCard(t, 'new')).join('')}
            </table>
            ${newThisWeek.length > 5 ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">...and ${newThisWeek.length - 5} more in your dashboard</p>` : ''}
          </td>
        </tr>
      `
      : ''
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 24px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 28px 32px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">
                      TOISA Daily Digest
                    </h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                      ${format(new Date(), 'MMMM d, yyyy')} · ${totalCount} tenders to review
                    </p>
                  </td>
                </tr>
                
                <!-- Filters info -->
                ${profile ? `
                <tr>
                  <td style="background: #e0e7ff; padding: 12px 24px; font-size: 12px; color: #3730a3;">
                    📋 Your filters: ${(profile.service_categories || []).join(', ')} · ${(profile.provinces || []).join(', ')}
                  </td>
                </tr>
                ` : ''}
                
                <!-- Content -->
                <tr>
                  <td style="background: white; padding: 24px 32px;">
                    ${totalCount === 0 ? `
                      <p style="text-align: center; color: #64748b; padding: 32px 0;">
                        No new tenders match your filters today. Check back soon!
                      </p>
                    ` : `
                      <table width="100%" cellpadding="0" cellspacing="0">
                        ${urgentSection}
                        ${upcomingSection}
                        ${newSection}
                      </table>
                    `}
                  </td>
                </tr>
                
                <!-- CTA -->
                ${totalCount > 0 ? `
                <tr>
                  <td style="background: white; padding: 0 32px 24px 32px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/tenders" 
                       style="display: inline-block; background: #1e40af; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      View All Tenders →
                    </a>
                  </td>
                </tr>
                ` : ''}
                
                <!-- Footer -->
                <tr>
                  <td style="background: #f8fafc; padding: 20px 32px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #64748b; font-size: 12px;">
                      TOISA — Tender Operations Intelligence System
                    </p>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;">
                      For Mahlasela Za (Pty) Ltd
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
    
    // Send email
    const { error } = await resend.emails.send({
      from: 'TOISA <toisa@resend.dev>',
      to: userEmail,
      subject: `TOISA Daily Digest — ${totalCount} tenders to review`,
      html,
    })
    
    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      tender_count: totalCount,
      urgent_count: urgent.length,
      upcoming_count: upcoming.length,
      new_count: newThisWeek.length,
      sent_to: userEmail,
    })
  } catch (error) {
    console.error('Send digest error:', error)
    return NextResponse.json({ error: 'Failed to send digest' }, { status: 500 })
  }
}