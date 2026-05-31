/* eslint-env node */

import { Webhook } from 'svix'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET)

  let evt
  try {
    evt = wh.verify(JSON.stringify(req.body), {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature'],
    })
  } catch {
    return res.status(400).json({ error: 'Invalid webhook signature' })
  }

  const { type, data } = evt

  if (type === 'user.created' || type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, public_metadata } = data
    const email = email_addresses?.[0]?.email_address || ''
    const fullName = `${first_name || ''} ${last_name || ''}`.trim()
    const role = public_metadata?.role || 'patient'
    const isBanned = public_metadata?.is_banned || false

    if (type === 'user.created') {
      const legacyId = public_metadata?.legacy_id

      if (legacyId) {
        await supabase
          .from('users')
          .update({
            email,
            full_name: fullName,
            is_banned: isBanned,
          })
          .eq('id', legacyId)
      } else {
        const newId = crypto.randomUUID()
        const { error } = await supabase
          .from('users')
          .insert({
            id: newId,
            email,
            full_name: fullName,
            role,
            is_banned: isBanned,
            password: null,
          })

        if (error) throw error

        if (role === 'provider') {
          await supabase.from('providers').insert([{ user_id: newId }])
        }

        const clerk = await import('@clerk/clerk-sdk-node')
        await clerk.clerkClient.users.updateUser(id, {
          publicMetadata: {
            ...public_metadata,
            legacy_id: newId,
          },
        })
      }
    }

    if (type === 'user.updated') {
      const legacyId = public_metadata?.legacy_id
      if (legacyId) {
        await supabase
          .from('users')
          .update({
            email,
            full_name: fullName,
            is_banned: isBanned,
          })
          .eq('id', legacyId)
      }
    }
  }

  if (type === 'user.deleted') {
    const legacyId = data.public_metadata?.legacy_id
    if (legacyId) {
      await supabase.from('users').delete().eq('id', legacyId)
    }
  }

  if (type === 'session.created') {
    const { user_id } = data
    const clerk = await import('@clerk/clerk-sdk-node')
    const clerkUser = await clerk.clerkClient.users.getUser(user_id)

    if (!clerkUser.publicMetadata?.legacy_id) {
      const newId = crypto.randomUUID()
      await supabase.from('users').insert({
        id: newId,
        email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
        full_name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
        role: clerkUser.publicMetadata?.role || 'patient',
        is_banned: false,
        password: null,
      })

      await clerk.clerkClient.users.updateUser(user_id, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          legacy_id: newId,
        },
      })
    }
  }

  res.status(200).json({ received: true })
}
