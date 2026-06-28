import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface TenderListing {
  title: string
  entity: string
  category: string
  closingDate: string
  daysRemaining: number
  url: string
  tenderNumber?: string
  location?: string
}

const PROVINCES = [
  'Gauteng', 'Mpumalanga', 'Limpopo', 'KwaZulu-Natal', 'KZN',
  'Western Cape', 'Eastern Cape', 'Northern Cape', 'Free State', 'North West'
]

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  )
}

function extractLocation(text: string): string | undefined {
  for (const prov of PROVINCES) {
    if (text.toLowerCase().includes(prov.toLowerCase())) {
      return prov
    }
  }
  return undefined
}

function extractEntity(description: string): string {
  // Entity is often mentioned at the end in patterns like:
  // "Supply and Delivery of X for Y" where Y is the entity
  // or "The Department of X invites..." 
  // or "Entity: X"
  
  // Try to find entity patterns
  const patterns = [
    /(?:for|to|by|from)\s+([A-Z][A-Za-z\s]+(?:District|Municipality|Province|Department|City|Metro|Council|Board|Authority))/i,
    /(?:Entity|Buyer|Client|Organization)[:\s]+([A-Za-z\s]+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  // Fallback: last meaningful capitalized phrase
  const words = description.split(/\s+/)
  const meaningful = words.filter(w => w.length > 3 && /^[A-Z]/.test(w))
  if (meaningful.length > 0) {
    return meaningful[meaningful.length - 1]
  }
  
  return 'Unknown'
}

function parseClosingDate(dateStr: string): { date: string; daysRemaining: number } | null {
  // eTenders format: "27/06/2026 in 8 days" or "27 June 2026"
  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (slashMatch) {
    const [, day, month, year] = slashMatch
    const dateStr2 = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`
    const closingDate = new Date(dateStr2)
    const now = new Date()
    const diffTime = closingDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return { date: dateStr2, daysRemaining: diffDays }
  }
  
  // Try "in X days" format
  const daysMatch = dateStr.match(/in\s+(\d+)\s+days?/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[1])
    const date = new Date()
    date.setDate(date.getDate() + days)
    return { date: date.toISOString(), daysRemaining: days }
  }
  
  // Try "dd Month yyyy" format
  const monthMatch = dateStr.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i)
  if (monthMatch) {
    const [, day, month, year] = monthMatch
    const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1
    const dateStr2 = `${year}-${String(monthNum).padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`
    const closingDate = new Date(dateStr2)
    const now = new Date()
    const diffTime = closingDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return { date: dateStr2, daysRemaining: diffDays }
  }
  
  return null
}

async function scrapeETenders(): Promise<TenderListing[]> {
  const listings: TenderListing[] = []
  
  try {
    // Use Jina AI Reader to fetch eTenders page
    const response = await fetch('https://r.jina.ai/https://www.etenders.gov.za/Home/opportunities?id=1', {
      headers: { 'Accept': 'text/plain' }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const text = await response.text()
    
    // Parse the text content - eTenders format is lines with: Category | Title | Date | status
    const lines = text.split('\n').filter(line => line.trim())
    
    let currentCategory = ''
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Detect category headers
      if (trimmed.length > 0 && trimmed.length < 100) {
        const categoryKeywords = ['Construction', 'Energy', 'Facilities', 'Fleet', 'Technology', 
                                 'Office', 'Print', 'Professional', 'Travel', 'Communication',
                                 'MARC', 'Water', 'Security', 'Electrical', 'Plumbing', 'Chemical']
        
        if (categoryKeywords.some(k => trimmed.toLowerCase().includes(k.toLowerCase()))) {
          currentCategory = trimmed
          continue
        }
      }
      
      // Look for lines with dates
      const datePatterns = [
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*(?:in\s+\d+\s+days?)?/i,
        /(\d{1,2}\s+\w+\s+\d{4})\s*(?:in\s+\d+\s+days?)?/i,
      ]
      
      for (const pattern of datePatterns) {
        const dateMatch = trimmed.match(pattern)
        if (dateMatch) {
          const dateStr = dateMatch[1]
          const titleAndRest = trimmed.replace(pattern, '').trim()
          
          // Extract title (everything before the date pattern)
          const title = titleAndRest.replace(dateStr, '').trim()
          
          if (title.length > 10) {
            const entity = extractEntity(title)
            const location = extractLocation(title)
            const parsed = parseClosingDate(dateStr + (dateStr.includes('in') ? '' : ' in 30 days'))
            
            listings.push({
              title: toTitleCase(title).substring(0, 250),
              entity,
              category: currentCategory || 'General',
              closingDate: parsed?.date || new Date().toISOString(),
              daysRemaining: parsed?.daysRemaining || 30,
              url: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              location
            })
          }
          break
        }
      }
    }
  } catch (error) {
    console.error('eTenders scrape error:', error)
  }
  
  return listings
}

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Get user's service categories and provinces
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: profile } = await supabase
      .from('toisa_user_profile')
      .select('service_categories, provinces')
      .eq('id', user.id)
      .single()
    
    const userCategories = profile?.service_categories || ['MARC', 'Construction', 'Water Tank']
    const userProvinces = profile?.provinces || ['Mpumalanga', 'Gauteng', 'Limpopo']
    
    // Scrape eTenders
    const listings = await scrapeETenders()
    
    let newCount = 0
    let updatedCount = 0
    const errors: string[] = []
    
    for (const listing of listings) {
      try {
        // Check if tender already exists (by title and entity)
        const { data: existing } = await supabase
          .from('toisa_tenders')
          .select('id')
          .eq('title', listing.title)
          .eq('source_portal', 'etenders')
          .single()
        
        if (existing) {
          // Update existing tender
          await supabase
            .from('toisa_tenders')
            .update({ 
              closing_date: listing.closingDate,
              days_remaining: listing.daysRemaining,
              entity: listing.entity,
              location: listing.location
            })
            .eq('id', existing.id)
          updatedCount++
        } else {
          // Calculate relevance score
          let relevanceScore = 5
          const titleLower = listing.title.toLowerCase()
          const categoryLower = listing.category.toLowerCase()
          const matchReasons: string[] = []
          
          // Boost score for matching categories
          for (const cat of userCategories) {
            if (titleLower.includes(cat.toLowerCase()) || categoryLower.includes(cat.toLowerCase())) {
              relevanceScore += 2
              matchReasons.push(`${cat} category`)
            }
          }
          
          // Boost score for matching provinces
          for (const prov of userProvinces) {
            if (listing.location?.toLowerCase().includes(prov.toLowerCase()) || 
                titleLower.includes(prov.toLowerCase())) {
              relevanceScore += 1
              matchReasons.push(`${prov} province`)
            }
          }
          
          // Boost score for urgent tenders
          if (listing.daysRemaining < 7) {
            relevanceScore += 3
            matchReasons.push('Urgent (closing soon)')
          } else if (listing.daysRemaining < 14) {
            relevanceScore += 1
          }
          
          // Cap at 10
          relevanceScore = Math.min(10, relevanceScore)
          
          // Insert new tender
          await supabase.from('toisa_tenders').insert({
            source_portal: 'etenders',
            title: listing.title,
            entity: listing.entity,
            category: listing.category,
            closing_date: listing.closingDate,
            days_remaining: listing.daysRemaining,
            location: listing.location,
            url: listing.url,
            tender_number: listing.tenderNumber,
            status: 'new',
            relevance_score: relevanceScore,
            discovered_at: new Date().toISOString(),
          })
          newCount++
        }
      } catch (err) {
        errors.push(`Error processing tender: ${listing.title.substring(0, 50)}`)
      }
    }
    
    return NextResponse.json({
      new_count: newCount,
      updated_count: updatedCount,
      errors: errors.slice(0, 5),
      total_listings_found: listings.length,
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json({ error: 'Scraping failed' }, { status: 500 })
  }
}