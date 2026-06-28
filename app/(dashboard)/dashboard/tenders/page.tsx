'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileText, RefreshCw, Plus, ExternalLink, Filter, Loader2, MapPin, Clock, Building } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'

interface Tender {
  id: string
  source_portal: string
  tender_number: string | null
  title: string
  entity: string | null
  description: string | null
  url: string | null
  category: string | null
  location: string | null
  closing_date: string | null
  days_remaining: number | null
  estimated_value: number | null
  status: string
  relevance_score: number
  discovered_at: string
}

function TenderCard({ tender, onAddToPipeline, onMarkIrrelevant }: {
  tender: Tender
  onAddToPipeline: (t: Tender) => void
  onMarkIrrelevant: (t: Tender) => void
}) {
  const daysRemaining = tender.days_remaining ?? 0
  const urgencyColor = daysRemaining < 0 ? 'text-slate-400' : daysRemaining < 7 ? 'text-red-600' : daysRemaining < 14 ? 'text-amber-600' : 'text-green-600'
  const urgencyBg = daysRemaining < 0 ? 'bg-slate-100' : daysRemaining < 7 ? 'bg-red-50 border-red-200' : daysRemaining < 14 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
  
  return (
    <div className={`border rounded-lg p-5 hover:shadow-md transition-all ${urgencyBg}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Entity - Bold at top */}
          <div className="flex items-center gap-2 mb-2">
            <Building className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-900">{tender.entity || 'Unknown Entity'}</span>
          </div>
          
          {/* Title */}
          <h3 className="text-base font-medium text-slate-800 mb-2 leading-snug">{tender.title}</h3>
          
          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap text-sm text-slate-500 mb-3">
            {tender.category && (
              <Badge variant="secondary" className="text-xs">{tender.category}</Badge>
            )}
            {tender.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {tender.location}
              </span>
            )}
            {tender.tender_number && (
              <span className="font-mono text-xs">#{tender.tender_number}</span>
            )}
          </div>
        </div>
        
        {/* Right side - closing info */}
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end text-slate-500 text-xs mb-1">
            <Clock className="w-3 h-3" />
            <span>Closes</span>
          </div>
          {tender.closing_date ? (
            <>
              <p className="font-medium text-slate-900 text-sm">
                {format(new Date(tender.closing_date), 'MMM d, yyyy')}
              </p>
              <p className={`font-semibold text-sm ${urgencyColor}`}>
                {daysRemaining < 0 ? 'CLOSED' : `in ${daysRemaining}d`}
              </p>
            </>
          ) : (
            <p className="text-slate-400 text-sm">TBD</p>
          )}
        </div>
      </div>
      
      {/* Bottom row - relevance + actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
        {/* Relevance score */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Match:</span>
          <div className="flex">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-3 rounded-sm mx-px ${
                  i < tender.relevance_score ? 'bg-blue-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-blue-600 ml-1">{tender.relevance_score}/10</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {tender.url && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open(tender.url!, '_blank')}>
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </Button>
          )}
          <Button 
            variant="default" 
            size="sm" 
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={() => onAddToPipeline(tender)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add to Pipeline
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs text-slate-500"
            onClick={() => onMarkIrrelevant(tender)}
          >
            Not Relevant
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function TendersPage() {
  const supabase = createClient()
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPortal, setFilterPortal] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [addToPipelineOpen, setAddToPipelineOpen] = useState(false)
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null)
  const [pipelineNotes, setPipelineNotes] = useState('')
  const [addingToPipeline, setAddingToPipeline] = useState(false)

  useEffect(() => {
    fetchTenders()
  }, [])

  async function fetchTenders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('toisa_tenders')
      .select('*')
      .order('days_remaining', { ascending: true })
      .limit(50)
    
    if (data) setTenders(data)
    setLoading(false)
  }

  async function handleScrape() {
    setScraping(true)
    toast.info('Scraping portals...', { description: 'This may take a minute' })
    
    try {
      const response = await fetch('/api/scrape', { method: 'POST' })
      const result = await response.json()
      
      if (response.ok) {
        toast.success(`Scraping complete!`, {
          description: `Found ${result.new_count} new tenders`
        })
        fetchTenders()
      } else {
        toast.error('Scraping failed', { description: result.error })
      }
    } catch (error) {
      toast.error('Scraping failed', { description: 'Network error' })
    }
    
    setScraping(false)
  }

  async function handleSendDigest() {
    toast.info('Sending digest...', { description: 'Check your email shortly' })
    
    try {
      const response = await fetch('/api/alerts/send-digest', { method: 'POST' })
      if (response.ok) {
        toast.success('Digest sent!', { description: 'Check your email inbox' })
      } else {
        toast.error('Failed to send digest')
      }
    } catch (error) {
      toast.error('Failed to send digest')
    }
  }

  async function handleAddToPipeline(tender: Tender) {
    setSelectedTender(tender)
    setAddToPipelineOpen(true)
  }

  async function submitToPipeline() {
    if (!selectedTender) return
    setAddingToPipeline(true)
    
    const { error } = await supabase.from('toisa_pipeline_items').insert({
      tender_id: selectedTender.id,
      subject: selectedTender.title,
      body: selectedTender.description,
      stage: 'discovered',
      deadline: selectedTender.closing_date,
      source: 'discovery',
      notes: pipelineNotes,
    })
    
    if (error) {
      toast.error('Failed to add to pipeline')
    } else {
      toast.success('Added to pipeline!', { description: 'View in Pipeline tab' })
      await supabase.from('toisa_tenders').update({ status: 'in_progress' }).eq('id', selectedTender.id)
      setAddToPipelineOpen(false)
      setPipelineNotes('')
      fetchTenders()
    }
    
    setAddingToPipeline(false)
  }

  async function handleMarkIrrelevant(tender: Tender) {
    await supabase.from('toisa_tenders').update({ status: 'lost' }).eq('id', tender.id)
    toast.success('Marked as irrelevant')
    fetchTenders()
  }

  const filteredTenders = tenders.filter(tender => {
    if (filterStatus !== 'all' && tender.status !== filterStatus) return false
    if (filterPortal !== 'all' && tender.source_portal !== filterPortal) return false
    if (filterCategory !== 'all' && tender.category !== filterCategory) return false
    return true
  })

  const portals = [...new Set(tenders.map(t => t.source_portal))]
  const categories = [...new Set(tenders.map(t => t.category).filter(Boolean))]

  // Stats
  const urgentCount = tenders.filter(t => (t.days_remaining ?? 999) < 7 && (t.days_remaining ?? 999) >= 0).length
  const upcomingCount = tenders.filter(t => (t.days_remaining ?? 999) >= 7 && (t.days_remaining ?? 999) < 14).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tender Discovery</h1>
          <p className="text-slate-500">Discover and track government tender opportunities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSendDigest} disabled={scraping}>
            <FileText className="w-4 h-4 mr-2" />
            Send Digest
          </Button>
          <Button onClick={handleScrape} disabled={scraping}>
            {scraping ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {scraping ? 'Scraping...' : 'Scrape Portals'}
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={urgentCount > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${urgentCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{urgentCount}</p>
            <p className="text-xs text-slate-500">Urgent (closing &lt;7d)</p>
          </CardContent>
        </Card>
        <Card className={upcomingCount > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${upcomingCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{upcomingCount}</p>
            <p className="text-xs text-slate-500">Upcoming (7-14d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-600">{tenders.length}</p>
            <p className="text-xs text-slate-500">Total Tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">Filters:</span>
            </div>
            <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPortal} onValueChange={(v) => v && setFilterPortal(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Portal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Portals</SelectItem>
                {portals.map(portal => (
                  <SelectItem key={portal} value={portal}>{portal}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={(v) => v && setFilterCategory(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat!} value={cat!}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filteredTenders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No tenders found</h3>
            <p className="text-slate-500 mb-4">
              {tenders.length === 0 
                ? 'Click "Scrape Portals" to discover tenders from government portals.'
                : 'Try adjusting your filters to see more results.'}
            </p>
            {tenders.length === 0 && (
              <Button onClick={handleScrape} disabled={scraping}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Scrape Portals Now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTenders.map(tender => (
            <TenderCard 
              key={tender.id} 
              tender={tender}
              onAddToPipeline={handleAddToPipeline}
              onMarkIrrelevant={handleMarkIrrelevant}
            />
          ))}
        </div>
      )}

      {/* Add to Pipeline Dialog */}
      <Dialog open={addToPipelineOpen} onOpenChange={setAddToPipelineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Pipeline</DialogTitle>
          </DialogHeader>
          {selectedTender && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-500 text-xs uppercase">Tender</Label>
                <p className="font-medium">{selectedTender.title}</p>
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={pipelineNotes}
                  onChange={(e) => setPipelineNotes(e.target.value)}
                  placeholder="Add any notes about this tender..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddToPipelineOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitToPipeline} disabled={addingToPipeline}>
                  {addingToPipeline ? 'Adding...' : 'Add to Pipeline'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}