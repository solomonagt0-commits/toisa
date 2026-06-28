import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { format, addDays } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userEmail = user.email || 'mahlaselaza98@gmail.com'
    
    // Get new tenders from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: newTenders } = await supabase
      .from('toisa_tenders')
      .select('*')
      .gte('discovered_at', yesterday)
      .order('relevance_score', { ascending: false })
      .limit(10)
    
    // Get pipeline summary
    const { data: pipelineItems } = await supabase
      .from('toisa_pipeline_items')
      .select('*')
    
    const pipelineSummary = {
      discovered: pipelineItems?.filter(p => p.stage === 'discovered').length || 0,
      in_progress: pipelineItems?.filter(p => p.stage === 'in_progress').length || 0,
      submitted: pipelineItems?.filter(p => p.stage === 'submitted').length || 0,
      under_review: pipelineItems?.filter(p => p.stage === 'under_review').length || 0,
      won: pipelineItems?.filter(p => p.stage === 'won').length || 0,
      lost: pipelineItems?.filter(p => p.stage === 'lost').length || 0,
    }
    
    // Get upcoming deadlines (next 7 days)
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
    
    // Build email HTML
    const newTendersHtml = newTenders && newTenders.length > 0
      ? newTenders.map(t => `
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
      : '<tr><td style="padding: 12px; color: #666;">No new tenders in the last 24 hours</td></tr>'
    
    const complianceHtml = expiringDocs && expiringDocs.length > 0
      ? `
          <div style="background: #fef3cd; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="color: #856404; margin: 0 0 12px 0;">⚠️ Expiring Documents</h3>
            ${expiringDocs.map(d => `
              <p style="margin: 4px 0; color: #856404;">
                ${d.name} - Expires ${format(new Date(d.expiry_date), 'MMM d, yyyy')}
              </p>
            `).join('')}
          </div>
        `
      : ''
    
    const deadlinesHtml = upcomingDeadlines && upcomingDeadlines.length > 0
      ? `
          <h3 style="margin: 16px 0 8px 0;">Upcoming Deadlines</h3>
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
          <h1 style="margin: 0;">TOISA Daily Digest</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.8;">
            ${format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
          ${complianceHtml}
          
          <h2 style="margin: 0 0 16px 0; color: #1e293b;">New Tenders (${newTenders?.length || 0})</h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
            ${newTendersHtml}
          </table>
          
          <h2 style="margin: 24px 0 16px 0; color: #1e293b;">Pipeline Summary</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${pipelineSummary.discovered}</div>
              <div style="font-size: 12px; color: #666;">Discovered</div>
            </div>
            <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${pipelineSummary.in_progress}</div>
              <div style="font-size: 12px; color: #666;">In Progress</div>
            </div>
            <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${pipelineSummary.submitted}</div>
              <div style="font-size: 12px; color: #666;">Submitted</div>
            </div>
          </div>
          
          ${deadlinesHtml}
          
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
               style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
              Open TOISA Dashboard
            </a>
          </div>
        </div>
        
        <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">TOISA - Tender Operations Intelligence System</p>
          <p style="margin: 4px 0 0 0;">For Mahlasela Za (Pty) Ltd</p>
        </div>
      </div>
    `
    
    // Send email
    const { error } = await resend.emails.send({
      from: 'TOISA <toisa@gramatis.co.za>',
      to: userEmail,
      subject: `TOISA Daily Digest - ${newTenders?.length || 0} new tenders`,
      html,
    })
    
    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      tender_count: newTenders?.length || 0,
      sent_to: userEmail,
    })
  } catch (error) {
    console.error('Send digest error:', error)
    return NextResponse.json({ error: 'Failed to send digest' }, { status: 500 })
  }
}
