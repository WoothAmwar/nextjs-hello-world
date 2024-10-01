
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies();
  console.log("YEAH SURE");

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            // console.log('Cookies to set:', cookiesToSet) // Logging for debugging
            // cookiesToSet.forEach(({ name, value, options }) =>
            //   cookieStore.set(name, value, {
            //     ...options,
            //     secure: process.env.NODE_ENV === 'production', // Secure flag conditionally set
            //     sameSite: options?.sameSite || 'Lax', // Default SameSite
            //     path: options?.path || '/', // Default path
            //     domain: process.env.NODE_ENV === 'production' ? 'malw-api.onrender.com/' : undefined, // Set domain in production
            //   })
            // )
            cookiesToSet.forEach(({ name, value, options}) => 
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            console.error('Error setting cookies:', error)
          }
        },
      },
    }
  )
}
