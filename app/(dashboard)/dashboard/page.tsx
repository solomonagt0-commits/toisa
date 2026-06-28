import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, TrendingUp, Clock, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { format, addDays } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Get user
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get tenders stats
  const { count: totalTenders } = await supabase
    .from('toisa_tenders')
    .select('*', { count: 'exact', head: true })
  
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: newThisWeek } = await supabase
    .from('toisa_tenders')
    .select('*', { count: 'exact', head: true })
    .gte('discovered_at', weekAgo)
  
  // Get pipeline stats
  const { data: pipelineItems } = await supabase
    .from('toisa_pipeline_items')
    .select('*')
  
  const pendingSubmissions = pipelineItems?.filter(p => p.stage === 'in_progress' || p.stage === 'discovered').length || 0
  
  const wonItems = pipelineItems?.filter(p => p.stage === 'won') || []
  const lostItems = pipelineItems?.filter(p => p.stage === 'lost') || []
  const totalDecided = wonItems.length + lostItems.length
  const winRate = totalDecided > 0 ? Math.round((wonItems.length / totalDecided) * 100) : 0
  
  // Get upcoming deadlines (next 7 days)
  const sevenDaysFromNow = addDays(new Date(), 7).toISOString()
  const { data: upcomingDeadlines } = await supabase
    .from('toisa_pipeline_items')
    .select('*, toisa_tenders(title)')
    .not('deadline', 'is', null)
    .gte('deadline', new Date().toISOString())
    .lte('deadline', sevenDaysFromNow)
    .order('deadline', { ascending: true })
    .limit(5)
  
  // Get compliance stats
  const { data: complianceDocs } = await supabase
    .from('toisa_compliance_documents')
    .select('*')
  
  const validDocs = complianceDocs?.filter(d => d.status === 'valid').length || 0
  const expiringDocs = complianceDocs?.filter(d => d.status === 'expiring_soon').length || 0
  const expiredDocs = complianceDocs?.filter(d => d.status === 'expired').length || 0
  
  // Get recent tenders
  const { data: recentTenders } = await supabase
    .from('toisa_tenders')
    .select('*')
    .order('discovered_at', { ascending: false })
    .limit(5)
  
  // Get recent pipeline activity
  const { data: recentPipeline } = await supabase
    .from('toisa_pipeline_items')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: 'Total Tenders', value: totalTenders || 0, icon: FileText, color: 'text-blue-600' },
    { label: 'New This Week', value: newThisWeek || 0, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Pending', value: pendingSubmissions, icon: Clock, color: 'text-amber-600' },
    { label: 'Win Rate', value: `${winRate}%`, icon: CheckCircle, color: 'text-emerald-600' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back! Here's your tender overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <stat.icon className={`w-10 h-10 ${stat.color} opacity-20`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
            <Link href="/dashboard/pipeline" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines && upcomingDeadlines.length > 0 ? (
              <div className="space-y-3">
                {upcomingDeadlines.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.subject}</p>
                      <p className="text-sm text-slate-500">
                        {item.toisa_tenders?.title ? `Tender: ${item.toisa_tenders.title}` : item.source}
                      </p>
                    </div>
                    <Badge variant={new Date(item.deadline) < addDays(new Date(), 3) ? 'destructive' : 'secondary'}>
                      {format(new Date(item.deadline), 'MMM d')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No upcoming deadlines</p>
                <p className="text-sm">Add tenders to your pipeline to track deadlines</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Compliance Status</CardTitle>
            <Link href="/dashboard/compliance" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Manage <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-bold">{validDocs}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Valid</p>
                  <p className="text-sm text-slate-500">Documents with 14+ days validity</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-amber-600 font-bold">{expiringDocs}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Expiring Soon</p>
                  <p className="text-sm text-slate-500">Documents expiring within 14 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-600 font-bold">{expiredDocs}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Expired</p>
                  <p className="text-sm text-slate-500">Documents past expiry date</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tenders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Tenders</CardTitle>
            <Link href="/dashboard/tenders" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentTenders && recentTenders.length > 0 ? (
              <div className="space-y-3">
                {recentTenders.map((tender: any) => (
                  <div key={tender.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{tender.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{tender.source_portal}</Badge>
                          {tender.category && <Badge variant="outline" className="text-xs">{tender.category}</Badge>}
                        </div>
                      </div>
                      {tender.closing_date && (
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {format(new Date(tender.closing_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No tenders discovered yet</p>
                <Link href="/dashboard/tenders" className="text-sm text-blue-600 hover:underline">
                  Scrape portals to discover tenders
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Pipeline Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pipeline Activity</CardTitle>
            <Link href="/dashboard/pipeline" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentPipeline && recentPipeline.length > 0 ? (
              <div className="space-y-3">
                {recentPipeline.map((item: any) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{item.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={
                              item.stage === 'won' ? 'default' : 
                              item.stage === 'lost' ? 'destructive' : 
                              'secondary'
                            }
                            className="text-xs"
                          >
                            {item.stage.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-slate-500">{item.source}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {format(new Date(item.updated_at), 'MMM d')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No pipeline activity yet</p>
                <Link href="/dashboard/pipeline" className="text-sm text-blue-600 hover:underline">
                  Add tenders to your pipeline
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
