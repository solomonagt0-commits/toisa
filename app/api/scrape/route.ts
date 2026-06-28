import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface TenderListing {
  title: string
  category: string
  closingDate: string
  url: string
  tenderNumber?: string
}

function parseClosingDate(dateStr: string): string | null {
  // eTenders format: "27/06/2026 in 8 days" or "27 June 2026"
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (match) {
    const [, day, month, year] = match
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`).toISOString()
  }
  
  // Try "in X days" format
  const daysMatch = dateStr.match(/in\s+(\d+)\s+days?/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[1])
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString()
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
      
      // Detect category headers (usually in CAPS or specific format)
      if (trimmed.length > 0 && trimmed.length < 100) {
        // Check if it looks like a category
        const categoryKeywords = ['Construction', 'Energy', 'Facilities', 'Fleet', 'Technology', 
                                 'Office', 'Print', 'Professional', 'Travel', 'Communication',
                                 'MARC', 'Water', 'Security', 'Electrical', 'Plumbing']
        
        if (categoryKeywords.some(k => trimmed.toLowerCase().includes(k.toLowerCase()))) {
          currentCategory = trimmed
          continue
        }
      }
      
      // Look for lines with dates (closing dates pattern)
      const datePatterns = [
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*(?:in\s+\d+\s+days?)?/i,
        /(\d{1,2}\s+\w+\s+\d{4})/i,
      ]
      
      for (const pattern of datePatterns) {
        const dateMatch = trimmed.match(pattern)
        if (dateMatch) {
          const dateStr = dateMatch[1]
          const title = trimmed.replace(pattern, '').replace(dateStr, '').trim()
          
          if (title.length > 10) {
            listings.push({
              title: title.substring(0, 200),
              category: currentCategory || 'General',
              closingDate: dateStr,
              url: 'https://www.etenders.gov.za/Home/opportunities?id=1'
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
        // Check if tender already exists (by title)
        const { data: existing } = await supabase
          .from('toisa_tenders')
          .select('id')
          .eq('title', listing.title)
          .eq('source_portal', 'etenders')
          .single()
        
        if (existing) {
          // Update existing tender
          const closingDate = parseClosingDate(listing.closingDate)
          await supabase
            .from('toisa_tenders')
            .update({ closing_date: closingDate })
            .eq('id', existing.id)
          updatedCount++
        } else {
          // Calculate relevance score
          let relevanceScore = 5
          const titleLower = listing.title.toLowerCase()
          const categoryLower = listing.category.toLowerCase()
          
          // Boost score for matching categories
          for (const cat of userCategories) {
            if (titleLower.includes(cat.toLowerCase()) || categoryLower.includes(cat.toLowerCase())) {
              relevanceScore += 2
            }
          }
          
          // Boost score for matching provinces
          for (const prov of userProvinces) {
            if (titleLower.includes(prov.toLowerCase())) {
              relevanceScore += 1
            }
          }
          
          // Cap at 10
          relevanceScore = Math.min(10, relevanceScore)
          
          // Insert new tender
          const closingDate = parseClosingDate(listing.closingDate)
          await supabase.from('toisa_tenders').insert({
            source_portal: 'etenders',
            title: listing.title,
            category: listing.category,
            closing_date: closingDate,
            url: listing.url,
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
      errors: errors.slice(0, 5), // Return first 5 errors
      total_listings_found: listings.length,
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json({ error: 'Scraping failed' }, { status: 500 })
  }
}
