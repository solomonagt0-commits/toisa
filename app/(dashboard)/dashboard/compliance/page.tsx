'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Upload, Shield, AlertTriangle, CheckCircle, XCircle, Bell } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'

interface ComplianceDocument {
  id: string
  document_type: string
  name: string
  file_url: string | null
  issue_date: string | null
  expiry_date: string | null
  status: string
  alert_30d: boolean
  alert_14d: boolean
  alert_7d: boolean
  created_at: string
}

const documentTypes = [
  { value: 'BBEE', label: 'B-BBEE Certificate' },
  { value: 'SARS', label: 'SARS Tax Clearance' },
  { value: 'CIDB', label: 'CIDB Registration' },
  { value: 'BANK_LETTER', label: 'Bank Confirmation Letter' },
  { value: 'COMPANY_REG', label: 'Company Registration (CIPC)' },
  { value: 'COIDA', label: 'COIDA' },
  { value: 'OTHER', label: 'Other' },
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'valid':
      return <Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Valid</Badge>
    case 'expiring_soon':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-300"><AlertTriangle className="w-3 h-3 mr-1" />Expiring Soon</Badge>
    case 'expired':
      return <Badge className="bg-red-100 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function CompliancePage() {
  const supabase = createClient()
  const [documents, setDocuments] = useState<ComplianceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingAlerts, setSendingAlerts] = useState(false)

  // Form state
  const [formType, setFormType] = useState('BBEE')
  const [formName, setFormName] = useState('')
  const [formIssueDate, setFormIssueDate] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formAlert30d, setFormAlert30d] = useState(true)
  const [formAlert14d, setFormAlert14d] = useState(true)
  const [formAlert7d, setFormAlert7d] = useState(true)

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    setLoading(true)
    const { data } = await supabase
      .from('toisa_compliance_documents')
      .select('*')
      .order('expiry_date', { ascending: true })
    
    if (data) setDocuments(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!formName || !formExpiryDate) {
      toast.error('Please fill in required fields')
      return
    }

    setSaving(true)
    
    // Calculate status based on expiry date
    const today = new Date()
    const expiry = new Date(formExpiryDate)
    const daysUntilExpiry = differenceInDays(expiry, today)
    
    let status = 'valid'
    if (daysUntilExpiry < 0) {
      status = 'expired'
    } else if (daysUntilExpiry < 14) {
      status = 'expiring_soon'
    }

    const { error } = await supabase.from('toisa_compliance_documents').insert({
      document_type: formType,
      name: formName,
      issue_date: formIssueDate || null,
      expiry_date: formExpiryDate,
      status,
      alert_30d: formAlert30d,
      alert_14d: formAlert14d,
      alert_7d: formAlert7d,
    })

    if (error) {
      toast.error('Failed to add document')
    } else {
      toast.success('Document added')
      setAddDialogOpen(false)
      resetForm()
      fetchDocuments()
    }
    
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this document?')) return
    
    const { error } = await supabase.from('toisa_compliance_documents').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Deleted')
      fetchDocuments()
    }
  }

  async function handleSendAlerts() {
    setSendingAlerts(true)
    toast.info('Sending compliance alerts...')
    
    try {
      const response = await fetch('/api/alerts/send-compliance', { method: 'POST' })
      if (response.ok) {
        toast.success('Compliance alerts sent!')
      } else {
        toast.error('Failed to send alerts')
      }
    } catch (error) {
      toast.error('Failed to send alerts')
    }
    
    setSendingAlerts(false)
  }

  function resetForm() {
    setFormType('BBEE')
    setFormName('')
    setFormIssueDate('')
    setFormExpiryDate('')
    setFormAlert30d(true)
    setFormAlert14d(true)
    setFormAlert7d(true)
  }

  // Calculate stats
  const validDocs = documents.filter(d => d.status === 'valid').length
  const expiringDocs = documents.filter(d => d.status === 'expiring_soon').length
  const expiredDocs = documents.filter(d => d.status === 'expired').length

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
          <h1 className="text-2xl font-bold text-slate-900">Compliance Manager</h1>
          <p className="text-slate-500">Track and manage your compliance documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSendAlerts} disabled={sendingAlerts}>
            <Bell className="w-4 h-4 mr-2" />
            {sendingAlerts ? 'Sending...' : 'Send Alerts Now'}
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger>
              <Button onClick={() => { resetForm(); setAddDialogOpen(true) }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Compliance Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="type">Document Type *</Label>
                  <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map(dt => (
                        <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="name">Document Name *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., B-BBEE Certificate 2026"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="issue_date">Issue Date</Label>
                    <Input
                      id="issue_date"
                      type="date"
                      value={formIssueDate}
                      onChange={(e) => setFormIssueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiry_date">Expiry Date *</Label>
                    <Input
                      id="expiry_date"
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Alert Settings</Label>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formAlert30d}
                        onChange={(e) => setFormAlert30d(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Alert 30 days before expiry</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formAlert14d}
                        onChange={(e) => setFormAlert14d(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Alert 14 days before expiry</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formAlert7d}
                        onChange={(e) => setFormAlert7d(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Alert 7 days before expiry</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Document'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={validDocs > 0 ? 'border-green-300' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{validDocs}</p>
                <p className="text-sm text-slate-500">Valid Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={expiringDocs > 0 ? 'border-amber-300' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{expiringDocs}</p>
                <p className="text-sm text-slate-500">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={expiredDocs > 0 ? 'border-red-300' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{expiredDocs}</p>
                <p className="text-sm text-slate-500">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document List */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No compliance documents</h3>
            <p className="text-slate-500 mb-4">
              Add your first compliance document to start tracking expiry dates.
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map(doc => {
            const daysUntilExpiry = doc.expiry_date 
              ? differenceInDays(new Date(doc.expiry_date), new Date())
              : null
            
            return (
              <Card key={doc.id} className={`
                ${doc.status === 'expired' ? 'border-red-300 bg-red-50' : ''}
                ${doc.status === 'expiring_soon' ? 'border-amber-300 bg-amber-50' : ''}
              `}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${doc.status === 'valid' ? 'bg-green-100' : ''}
                        ${doc.status === 'expiring_soon' ? 'bg-amber-100' : ''}
                        ${doc.status === 'expired' ? 'bg-red-100' : ''}
                      `}>
                        {doc.status === 'valid' && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {doc.status === 'expiring_soon' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                        {doc.status === 'expired' && <XCircle className="w-5 h-5 text-red-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{doc.name}</h3>
                          {getStatusBadge(doc.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>
                            {documentTypes.find(t => t.value === doc.document_type)?.label || doc.document_type}
                          </span>
                          {doc.issue_date && (
                            <span>Issued: {format(new Date(doc.issue_date), 'MMM d, yyyy')}</span>
                          )}
                          {doc.expiry_date && (
                            <span className={daysUntilExpiry !== null && daysUntilExpiry < 0 ? 'text-red-600 font-medium' : daysUntilExpiry !== null && daysUntilExpiry < 14 ? 'text-amber-600 font-medium' : ''}>
                              Expires: {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
                              {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                                <> ({daysUntilExpiry} days)</>
                              )}
                              {daysUntilExpiry !== null && daysUntilExpiry < 0 && (
                                <> (expired {Math.abs(daysUntilExpiry)} days ago)</>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0 && (
                        <Button variant="outline" size="sm" onClick={handleSendAlerts}>
                          <Bell className="w-4 h-4 mr-1" />
                          Remind
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
