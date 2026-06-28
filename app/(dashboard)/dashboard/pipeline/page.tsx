'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface PipelineItem {
  id: string
  tender_id: string | null
  subject: string
  sender: string | null
  body: string | null
  stage: string
  deadline: string | null
  notes: string | null
  source: string
  won_amount: number | null
  created_at: string
  updated_at: string
  toisa_tenders?: { title: string } | null
}

const stages = [
  { id: 'discovered', label: 'Discovered', color: 'bg-blue-100 border-blue-300' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-100 border-amber-300' },
  { id: 'submitted', label: 'Submitted', color: 'bg-purple-100 border-purple-300' },
  { id: 'under_review', label: 'Under Review', color: 'bg-orange-100 border-orange-300' },
  { id: 'won', label: 'Won 🎉', color: 'bg-green-100 border-green-300' },
  { id: 'lost', label: 'Lost', color: 'bg-red-100 border-red-300' },
]

export default function PipelinePage() {
  const supabase = createClient()
  const [items, setItems] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<PipelineItem | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [formSubject, setFormSubject] = useState('')
  const [formSender, setFormSender] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formStage, setFormStage] = useState('discovered')
  const [formDeadline, setFormDeadline] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formWonAmount, setFormWonAmount] = useState('')
  const [formSource, setFormSource] = useState('manual')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('toisa_pipeline_items')
      .select('*, toisa_tenders(title)')
      .order('updated_at', { ascending: false })
    
    if (data) setItems(data)
    setLoading(false)
  }

  function openAddDialog() {
    setEditItem(null)
    setFormSubject('')
    setFormSender('')
    setFormBody('')
    setFormStage('discovered')
    setFormDeadline('')
    setFormNotes('')
    setFormWonAmount('')
    setFormSource('manual')
    setAddDialogOpen(true)
  }

  function openEditDialog(item: PipelineItem) {
    setEditItem(item)
    setFormSubject(item.subject)
    setFormSender(item.sender || '')
    setFormBody(item.body || '')
    setFormStage(item.stage)
    setFormDeadline(item.deadline ? item.deadline.split('T')[0] : '')
    setFormNotes(item.notes || '')
    setFormWonAmount(item.won_amount?.toString() || '')
    setFormSource(item.source)
    setAddDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    
    const data = {
      subject: formSubject,
      sender: formSender || null,
      body: formBody || null,
      stage: formStage,
      deadline: formDeadline || null,
      notes: formNotes || null,
      won_amount: formWonAmount ? parseFloat(formWonAmount) : null,
      source: formSource,
      updated_at: new Date().toISOString(),
    }
    
    if (editItem) {
      const { error } = await supabase
        .from('toisa_pipeline_items')
        .update(data)
        .eq('id', editItem.id)
      
      if (error) {
        toast.error('Failed to update item')
      } else {
        toast.success('Pipeline item updated')
        setAddDialogOpen(false)
        fetchItems()
      }
    } else {
      const { error } = await supabase
        .from('toisa_pipeline_items')
        .insert(data)
      
      if (error) {
        toast.error('Failed to add item')
      } else {
        toast.success('Added to pipeline')
        setAddDialogOpen(false)
        fetchItems()
      }
    }
    
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this pipeline item?')) return
    
    const { error } = await supabase.from('toisa_pipeline_items').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Deleted')
      fetchItems()
    }
  }

  async function handleStageChange(item: PipelineItem, newStage: string) {
    const { error } = await supabase
      .from('toisa_pipeline_items')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    
    if (error) {
      toast.error('Failed to update stage')
    } else {
      fetchItems()
    }
  }

  function getItemsByStage(stageId: string) {
    return items.filter(item => item.stage === stageId)
  }

  // Calculate stats
  const wonItems = items.filter(i => i.stage === 'won')
  const lostItems = items.filter(i => i.stage === 'lost')
  const totalDecided = wonItems.length + lostItems.length
  const winRate = totalDecided > 0 ? Math.round((wonItems.length / totalDecided) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline Tracker</h1>
          <p className="text-slate-500">Track your tender submissions through to completion</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger>
            <Button onClick={openAddDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editItem ? 'Edit Pipeline Item' : 'Add Pipeline Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Tender title or email subject"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stage">Stage</Label>
                  <Select value={formStage} onValueChange={(v) => v && setFormStage(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="source">Source</Label>
                  <Select value={formSource} onValueChange={(v) => v && setFormSource(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="discovery">Discovery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="won_amount">Won Amount (R)</Label>
                  <Input
                    id="won_amount"
                    type="number"
                    value={formWonAmount}
                    onChange={(e) => setFormWonAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="sender">Sender</Label>
                <Input
                  id="sender"
                  value={formSender}
                  onChange={(e) => setFormSender(e.target.value)}
                  placeholder="Email sender (optional)"
                />
              </div>
              <div>
                <Label htmlFor="body">Description</Label>
                <Textarea
                  id="body"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Brief description or email body..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !formSubject}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{items.length}</p>
            <p className="text-sm text-slate-500">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{items.filter(i => i.stage === 'in_progress').length}</p>
            <p className="text-sm text-slate-500">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{wonItems.length}</p>
            <p className="text-sm text-slate-500">Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{winRate}%</p>
            <p className="text-sm text-slate-500">Win Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-6 gap-4 overflow-x-auto">
        {stages.map(stage => {
          const stageItems = getItemsByStage(stage.id)
          return (
            <div key={stage.id} className="min-w-[220px]">
              <div className={`rounded-t-lg p-3 border-2 ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{stage.label}</h3>
                  <Badge variant="secondary">{stageItems.length}</Badge>
                </div>
              </div>
              <div className="bg-slate-100 rounded-b-lg p-2 min-h-[400px] space-y-2">
                {stageItems.map(item => (
                  <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEditDialog(item)}>
                    <CardContent className="p-3">
                      <p className="font-medium text-sm text-slate-900 line-clamp-2 mb-2">
                        {item.subject}
                      </p>
                      {item.toisa_tenders?.title && (
                        <p className="text-xs text-slate-500 mb-2 truncate">
                          Tender: {item.toisa_tenders.title}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{item.source}</Badge>
                        {item.deadline && (
                          <span className="text-xs text-slate-500">
                            {format(new Date(item.deadline), 'MMM d')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <Select value={item.stage} onValueChange={(v) => v && handleStageChange(item, v)}>
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(item.id)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stageItems.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No items
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
