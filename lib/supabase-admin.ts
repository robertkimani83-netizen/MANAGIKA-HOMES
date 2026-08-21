import { createClient } from '@supabase/supabase-js'

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
