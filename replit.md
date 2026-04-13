# AuroraChat

A Discord-like real-time chat application built with React, Vite, TypeScript, and Supabase.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Routing**: React Router v6
- **State/Data fetching**: TanStack React Query
- **Backend**: Supabase (hosted) — handles auth, PostgreSQL database, realtime subscriptions, and file storage
- **i18n**: Custom translation system (Turkish default)

## Current Version

**v0.8.3** — Spotify token yönetimi Supabase Edge Function'a taşındı; telefonla ses kontrolü (QR kod + Realtime broadcast); UserProfileCard Spotify şu an çalıyor düzeltmesi.

## Key Features

- Server/channel system (Discord-like)
- Direct messaging between users
- Real-time messaging via Supabase Realtime
- File/image attachments via Supabase Storage
- User authentication with MFA (TOTP) support
- Voice channels via LiveKit with full-screen meeting room UI (camera + screen share)
- **DM Voice Calling**: Supabase Realtime broadcast-based call signaling; incoming call modal (accept/reject); DM voice panel using shared VoiceMeetingRoom component; toggle panel while chatting
- Voice/text split view: chat panel alongside voice meeting room
- Browser push notifications for @mentions (Notification API + Service Worker at /sw.js)
- Real-time kick detection: kicked users are redirected instantly
- Audio settings persisted to profiles DB (audio_settings JSONB column)
- 6-language i18n system (TR, EN, AZ, RU, JA, DE)
- reCAPTCHA v2 on login/register
- User profiles, friend system, roles, bans
- Thread messages, message reactions, emoji picker, GIF picker
- Server categories, invites, audit logs, notifications
- Voice channel UI (VoicePanel)
- Admin premium badge toggle (Supabase Edge Function)
- **Blocking system**: Discord-style block confirmation modal (`BlockConfirmModal`); "Engellediğin bir kullanıcıya mesaj gönderemezsin" bar with inline unblock in `DMChatArea`; block/unblock from `UserProfileCard` profile popup
- **Role-based permissions**: `ServerSettings` now checks user's assigned roles & `getHighestPermissions()` — admins with `manage_channels`, `manage_roles`, `kick_members`, etc. can access those sections without being the owner; real-time role update subscription
- **Privacy settings**: `allow_dms` and `friend_request_setting` stored in Supabase profiles (migration `20260324000000_privacy_block_realtime.sql`)
- **Realtime reactions/poll votes**: `REPLICA IDENTITY FULL` on `message_reactions` ensures DELETE events carry full row data for instant sync across all users

## Environment Variables

Set these as Replit environment variables (already configured):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` — Supabase project ID

## Development

```bash
npm run dev       # Start dev server on port 5000
npm run build     # Production build
npm run preview   # Preview production build
```

## Supabase

The app uses a hosted Supabase project (`ktittqaubkaylprxnoya`). Database schema and migrations are in `supabase/migrations/`. Edge functions are in `supabase/functions/`.

## Notes

- The Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` env vars

## Pending Supabase Migration (v0.4.6)

The migration file `supabase/migrations/20260324000000_privacy_block_realtime.sql` must be applied to the Supabase project via the SQL editor. It:
1. Adds `allow_dms boolean DEFAULT true` and `friend_request_setting text DEFAULT 'everyone'` columns to `profiles`
2. Sets `REPLICA IDENTITY FULL` on `message_reactions` for proper realtime DELETE events
3. Adds RLS policy to prevent blocked users from sending DMs at the database level

The frontend code has fallbacks so it functions while the migration is pending.

## Pending Supabase Migration (v0.4.7)

Apply `supabase/migrations/20260328000000_push_subscriptions_and_kick_realtime.sql` via the Supabase SQL editor. It:
1. Creates `push_subscriptions` table for Web Push API subscription storage
2. Sets `REPLICA IDENTITY FULL` on `server_members` for proper real-time kick detection
3. Sets `REPLICA IDENTITY FULL` on `blocked_users` for real-time block sync

For Web Push notifications to work end-to-end, also set the `VITE_VAPID_PUBLIC_KEY` environment variable with your VAPID public key.

## v0.6.1 Sürüm Notları

- **Electron ESM düzeltme**: `electron/main.js` ESM formatına dönüştürüldü, `require()` → `import` ifadelerine çevrildi. `electron/package.json` `"type": "module"` yapıldı.
- **Nativefier yapılandırması**: `nativefier.json` oluşturuldu — `nodeIntegration: true`, `contextIsolation: false` ile modül çakışması giderildi.
- **Gradient animasyon**: `roleGradientShimmer` animasyonu soldan sağa (`0% → 200%`), varsayılan `paused`, hover'da `running`, hız `0.5s` (↑ daha hızlı).
- **Ban kontrolü**: `InvitePage` ve `ServerInviteEmbed` davet akışlarına `server_bans` DB sorgusu eklendi; yasaklı kullanıcı katılamaz.
- **Davet embed üye sayısı**: `fetch` fonksiyon ismi shadowing hatası düzeltildi; `select('*', head:true)` yerine tam satır sorgusu (`select('id')`) kullanıldı — "0 Üye" sorunu giderildi.
- **Gerçek zamanlı sunucu listesi**: Kullanıcı yeni sunucuya katıldığında `server_members INSERT` eventi yakalanıyor, sunucu listesi yenileniyor ve kullanıcı otomatik olarak o sunucunun ilk metin kanalına yönlendiriliyor.
- **DM mesaj scroll**: `handleNavigateToMessage` DM navigasyonuna `messageId` aktarımı eklendi; `DMChatArea` yeni `scrollToMessageId` propunu alıyor ve mesajı `scrollIntoView` ile vurgulayarak odaklıyor.

## Pending Supabase Migrations (v0.7.1 + v0.7.2)

Apply these two migrations in order via the Supabase SQL editor:

**1. `supabase/migrations/20260405000000_v071_leave_message_welcome_fix.sql`**
- Adds `leave_enabled`, `leave_message`, `leave_channel_id` columns to `servers`
- Creates `handle_welcome_message_v3()` with COALESCE+NULLIF fallback
- Creates `handle_leave_message()` trigger for member leave bot messages
- Creates `on_member_leave_message` trigger (BEFORE DELETE on server_members)

**2. `supabase/migrations/20260405100000_fix_block_rls_and_check_fn.sql`**
- Adds RLS SELECT policy so blocked users can detect they are blocked
- Creates `is_blocked_by(p_blocker_id UUID)` SECURITY DEFINER RPC function

**3. `supabase/migrations/20260406000000_v072_welcome_fix.sql`**
- Drops ALL old welcome trigger variants (on_member_joined_welcome, on_member_join_welcome, trg_welcome_message)
- Creates clean `handle_welcome_message_v4()` with is_bot=TRUE and NULL user_id
- Creates single canonical trigger `on_member_join_welcome`
- Fixes duplicate welcome message and {user} template not rendering
