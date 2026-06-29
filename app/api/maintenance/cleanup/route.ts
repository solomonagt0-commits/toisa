import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Delete tenders where closing_date is more than 7 days in the past
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: deleted, error } = await supabase
      .from('toisa_tenders')
      .delete()
      .lt('closing_date', sevenDaysAgo.toISOString())
      .eq('status', 'new')
      .select()
    
    if (error) {
      console.error('Cleanup error:', error)
      return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
    }
    
    // Also delete tenders that are > 30 days old (discovered_at) regardless of status
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: deletedOld, error: error2 } = await supabase
      .from('toisa_tenders')
      .delete()
      .lt('discovered_at', thirtyDaysAgo.toISOString())
      .select()
    
    if (error2) {
      console.error('Old cleanup error:', error2)
    }
    
    const totalDeleted = (deleted?.length || 0) + (deletedOld?.length || 0)
    
    return NextResponse.json({
      success: true,
      closed_tenders_deleted: deleted?.length || 0,
      stale_tenders_deleted: deletedOld?.length || 0,
      total_deleted: totalDeleted,
      cleanup_date: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}

// Also support GET for manual/debug access
export async function GET() {
  return POST()
}