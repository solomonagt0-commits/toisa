import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { format, addDays } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'cron-secret-123'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const supabase = await createClient()
    
    // Get user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No user found' }, { status: 400 })
    }
    
    const userEmail = user.email || 'mahlaselaza98@gmail.com'
    
    // Scrape new tenders first
    let newTenders: any[] = []
    try {
      const scrapeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (scrapeResponse.ok) {
        const scrapeResult = await scrapeResponse.json()
        newTenders = scrapeResult.new_count > 0 ? [{ count: scrapeResult.new_count }] : []
      }
    } catch (e) {
      console.error('Cron scrape error:', e)
    }
    
    // Get new tenders from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentTenders } = await supabase
      .from('toisa_tenders')
      .select('*')
      .gte('discovered_at', yesterday)
      .order('relevance_score', { ascending: false })
      .limit(10)
    
    // Get pipeline summary
    const { data: pipelineItems } = await supabase
      .from('toisa_pipeline_items')
      .select('*')
    
    const wonItems = pipelineItems?.filter(p => p.stage === 'won') || []
    const lostItems = pipelineItems?.filter(p => p.stage === 'lost') || []
    const totalDecided = wonItems.length + lostItems.length
    const winRate = totalDecided > 0 ? Math.round((wonItems.length / totalDecided) * 100) : 0
    
    // Get upcoming deadlines
    const sevenDays = addDays(new Date(), 7).toISOString()
    const { data: upcomingDeadlines } = await supabase
      .from('toisa_pipeline_items')
      .select('*, toisa_tenders(title)')
      .not('deadline', 'is', null)
      .gte('deadline', new Date().toISOString())
      .lte('deadline', sevenDays)
      .order('deadline', { ascending: true })
      .limit(5)
    
    // Get compliance alerts
    const { data: expiringDocs } = await supabase
      .from('toisa_compliance_documents')
      .select('*')
      .eq('status', 'expiring_soon')
      .order('expiry_date', { ascending: true })
      .limit(3)
    
    // Build email
    const tendersHtml = recentTenders && recentTenders.length > 0
      ? recentTenders.map(t => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
              <strong>${t.title}</strong><br>
              <span style="color: #666; font-size: 12px;">
                ${t.source_portal} • ${t.category || 'General'}
                ${t.closing_date ? ` • Closes: ${format(new Date(t.closing_date), 'MMM d, yyyy')}` : ''}
              </span>
            </td>
          </tr>
        `).join('')
      : '<tr><td style="padding: 12px; color: #666;">No new tenders discovered today</td></tr>'
    
    const complianceHtml = expiringDocs && expiringDocs.length > 0
      ? `
          <div style="background: #fffbeb; border: 2px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="color: #d97706; margin: 0 0 12px 0;">⚠️ Expiring Documents</h3>
            ${expiringDocs.map(d => `
              <p style="margin: 4px 0; color: #92400e;">
                ${d.name} - ${d.expiry_date ? format(new Date(d.expiry_date), 'MMM d, yyyy') : 'No expiry'}
              </p>
            `).join('')}
          </div>
        `
      : ''
    
    const deadlinesHtml = upcomingDeadlines && upcomingDeadlines.length > 0
      ? `
          <h3 style="margin: 16px 0 8px 0;">📅 Upcoming Deadlines (Next 7 Days)</h3>
          ${upcomingDeadlines.map(item => `
            <p style="margin: 4px 0;">
              ${item.subject} - 
              <strong>${format(new Date(item.deadline), 'MMM d, yyyy')}</strong>
            </p>
          `).join('')}
        `
      : ''
    
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">📋 TOISA Daily Digest</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.8;">
            ${format(new Date(), 'EEEE, MMMM d, yyyy')} • South African Time
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
          <div style="background: #dcfce7; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="color: #166534; margin: 0 0 8px 0;">📊 Pipeline Overview</h3>
            <div style="display: flex; gap: 24px; flex-wrap: wrap;">
              <span style="color: #166534;"><strong>${pipelineItems?.length || 0}</strong> Total</span>
              <span style="color: #3b82f6;"><strong>${wonItems.length}</strong> Won</span>
              <span style="color: #dc2626;"><strong>${lostItems.length}</strong> Lost</span>
              <span style="color: #7c3aed;"><strong>${winRate}%</strong> Win Rate</span>
            </div>
          </div>
          
          ${complianceHtml}
          
          <h2 style="margin: 0 0 16px 0; color: #1e293b;">
            🆕 New Tenders Today (${recentTenders?.length || 0})
          </h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            ${tendersHtml}
          </table>
          
          ${deadlinesHtml}
          
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
               style="display: inline-block; background: #1e40af; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open TOISA Dashboard
            </a>
          </div>
        </div>
        
        <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">TOISA - Tender Operations Intelligence System</p>
          <p style="margin: 4px 0 0 0;">Built for Mahlasela Za (Pty) Ltd • Powered by Gramatis</p>
        </div>
      </div>
    `
    
    // Send email
    const { error } = await resend.emails.send({
      from: 'TOISA <toisa@gramatis.co.za>',
      to: userEmail,
      subject: `📋 TOISA Daily Digest - ${recentTenders?.length || 0} new tenders found`,
      html,
    })
    
    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      tenders_found: recentTenders?.length || 0,
      pipeline_total: pipelineItems?.length || 0,
      win_rate: winRate,
      sent_to: userEmail,
    })
  } catch (error) {
    console.error('Daily digest cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
