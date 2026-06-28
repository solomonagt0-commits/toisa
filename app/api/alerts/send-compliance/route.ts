import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { format, differenceInDays } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userEmail = user.email || 'mahlaselaza98@gmail.com'
    
    // Get expiring/expired documents
    const { data: documents } = await supabase
      .from('toisa_compliance_documents')
      .select('*')
      .or('status.eq.expiring_soon,status.eq.expired')
      .order('expiry_date', { ascending: true })
    
    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        sent_count: 0,
        message: 'No expiring documents'
      })
    }
    
    const sentCount = 0
    
    // Group by days until expiry
    const urgent = documents.filter(d => {
      if (!d.expiry_date) return false
      const days = differenceInDays(new Date(d.expiry_date), new Date())
      return days <= 7 && days >= 0
    })
    
    const soon = documents.filter(d => {
      if (!d.expiry_date) return false
      const days = differenceInDays(new Date(d.expiry_date), new Date())
      return days > 7 && days <= 30
    })
    
    const expired = documents.filter(d => d.status === 'expired')
    
    // Build email
    let urgentHtml = ''
    let soonHtml = ''
    let expiredHtml = ''
    
    if (urgent.length > 0) {
      urgentHtml = `
        <div style="background: #fef2f2; border: 2px solid #ef4444; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h3 style="color: #dc2626; margin: 0 0 12px 0;">🚨 URGENT - Expiring in 7 days</h3>
          ${urgent.map(d => `
            <p style="margin: 8px 0; color: #991b1b;">
              <strong>${d.name}</strong><br>
              Expires: ${d.expiry_date ? format(new Date(d.expiry_date), 'MMMM d, yyyy') : 'N/A'}
              (${differenceInDays(new Date(d.expiry_date), new Date())} days)
            </p>
          `).join('')}
        </div>
      `
    }
    
    if (soon.length > 0) {
      soonHtml = `
        <div style="background: #fffbeb; border: 2px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h3 style="color: #d97706; margin: 0 0 12px 0;">⚠️ Expiring Soon (8-30 days)</h3>
          ${soon.map(d => `
            <p style="margin: 8px 0; color: #92400e;">
              <strong>${d.name}</strong><br>
              Expires: ${d.expiry_date ? format(new Date(d.expiry_date), 'MMMM d, yyyy') : 'N/A'}
              (${differenceInDays(new Date(d.expiry_date), new Date())} days)
            </p>
          `).join('')}
        </div>
      `
    }
    
    if (expired.length > 0) {
      expiredHtml = `
        <div style="background: #fee2e2; border: 2px solid #b91c1c; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h3 style="color: #b91c1c; margin: 0 0 12px 0;">❌ EXPIRED</h3>
          ${expired.map(d => `
            <p style="margin: 8px 0; color: #7f1d1d;">
              <strong>${d.name}</strong><br>
              Expired: ${d.expiry_date ? format(new Date(d.expiry_date), 'MMMM d, yyyy') : 'N/A'}
            </p>
          `).join('')}
        </div>
      `
    }
    
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">⚠️ Compliance Alert</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">
            ${documents.length} document${documents.length > 1 ? 's' : ''} need attention
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #475569;">
            The following compliance documents require your attention:
          </p>
          
          ${expiredHtml}
          ${urgentHtml}
          ${soonHtml}
          
          <div style="margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/compliance" 
               style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
              Manage Compliance Documents
            </a>
          </div>
        </div>
        
        <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">TOISA - Tender Operations Intelligence System</p>
        </div>
      </div>
    `
    
    // Send email
    const { error } = await resend.emails.send({
      from: 'TOISA Alerts <alerts@gramatis.co.za>',
      to: userEmail,
      subject: `⚠️ TOISA Compliance Alert - ${documents.length} documents need attention`,
      html,
    })
    
    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send alert' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      sent_count: 1,
      documents_alerted: documents.length,
    })
  } catch (error) {
    console.error('Compliance alert error:', error)
    return NextResponse.json({ error: 'Failed to send compliance alert' }, { status: 500 })
  }
}
