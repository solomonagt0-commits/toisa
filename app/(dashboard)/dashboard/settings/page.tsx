'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, Mail, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  full_name: string | null
  company_name: string
  email: string | null
  bbee_level: number
  cidb_grade: number
  service_categories: string[]
  provinces: string[]
  preferred_alerts: string
}

const serviceCategoryOptions = [
  'MARC',
  'Construction',
  'Water Tank',
  'Electrical',
  'Plumbing',
  'Painting',
  'Roofing',
  'Fencing',
  'Landscaping',
  'Cleaning',
  'Security',
  'IT Services',
  'Professional Services',
]

const provinceOptions = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
]

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [gmailConnected, setGmailConnected] = useState(false)

  // Form state
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [bbeeLevel, setBbeeLevel] = useState('4')
  const [cidbGrade, setCidbGrade] = useState('1')
  const [categories, setCategories] = useState<string[]>([])
  const [provinces, setProvinces] = useState<string[]>([])
  const [preferredAlerts, setPreferredAlerts] = useState('email')

  useEffect(() => {
    fetchProfile()
    checkGmailConnection()
  }, [])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('toisa_user_profile')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setFullName(data.full_name || '')
      setCompanyName(data.company_name)
      setBbeeLevel(data.bbee_level.toString())
      setCidbGrade(data.cidb_grade.toString())
      setCategories(data.service_categories)
      setProvinces(data.provinces)
      setPreferredAlerts(data.preferred_alerts)
    } else {
      // Create default profile
      const { data: newProfile } = await supabase
        .from('toisa_user_profile')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
        })
        .select()
        .single()
      
      if (newProfile) {
        setProfile(newProfile)
      }
    }
    setLoading(false)
  }

  async function checkGmailConnection() {
    // For demo purposes, we'll show Gmail as connected if we have OAuth tokens
    const hasGmailToken = !!localStorage.getItem('gmail_access_token')
    setGmailConnected(hasGmailToken)
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)

    const { error } = await supabase
      .from('toisa_user_profile')
      .update({
        full_name: fullName,
        company_name: companyName,
        bbee_level: parseInt(bbeeLevel),
        cidb_grade: parseInt(cidbGrade),
        service_categories: categories,
        provinces: provinces,
        preferred_alerts: preferredAlerts,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to save settings')
    } else {
      toast.success('Settings saved!')
    }

    setSaving(false)
  }

  function toggleCategory(cat: string) {
    setCategories(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    )
  }

  function toggleProvince(prov: string) {
    setProvinces(prev => 
      prev.includes(prov) 
        ? prev.filter(p => p !== prov)
        : [...prev, prov]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your profile and preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal and company information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bbee_level">B-BBEE Level</Label>
              <Select value={bbeeLevel} onValueChange={(v) => v && setBbeeLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(level => (
                    <SelectItem key={level} value={level.toString()}>Level {level}</SelectItem>
                  ))}
                  <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cidb_grade">CIDB Grade</Label>
              <Select value={cidbGrade} onValueChange={(v) => v && setCidbGrade(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(grade => (
                    <SelectItem key={grade} value={grade.toString()}>Grade {grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Service Categories</CardTitle>
          <CardDescription>
            Select the categories you want to filter tenders by
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {serviceCategoryOptions.map(cat => (
              <Badge
                key={cat}
                variant={categories.includes(cat) ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1"
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Selected: {categories.length} categories
          </p>
        </CardContent>
      </Card>

      {/* Provinces */}
      <Card>
        <CardHeader>
          <CardTitle>Provinces</CardTitle>
          <CardDescription>
            Select the provinces where you want to find tenders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {provinceOptions.map(prov => (
              <Badge
                key={prov}
                variant={provinces.includes(prov) ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1"
                onClick={() => toggleProvince(prov)}
              >
                {prov}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Selected: {provinces.length} provinces
          </p>
        </CardContent>
      </Card>

      {/* Alert Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Preferences</CardTitle>
          <CardDescription>How would you like to receive alerts?</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={preferredAlerts} onValueChange={(v) => v && setPreferredAlerts(v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email Only</SelectItem>
              <SelectItem value="sms">SMS Only</SelectItem>
              <SelectItem value="both">Email + SMS</SelectItem>
              <SelectItem value="none">No Alerts</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect external services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium">Gmail</p>
                <p className="text-sm text-slate-500">
                  {gmailConnected ? 'Connected - syncing emails' : 'Connect to auto-import tender emails'}
                </p>
              </div>
            </div>
            {gmailConnected ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700">
                  <Check className="w-3 h-3 mr-1" /> Connected
                </Badge>
                <Button variant="outline" size="sm" onClick={() => {
                  localStorage.removeItem('gmail_access_token')
                  setGmailConnected(false)
                  toast.success('Gmail disconnected')
                }}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => {
                toast.info('Gmail OAuth would open here in production')
              }}>
                Connect Gmail
              </Button>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Resend</p>
                <p className="text-sm text-slate-500">Email delivery service (API configured)</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700">
              <Check className="w-3 h-3 mr-1" /> Configured
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  )
}
