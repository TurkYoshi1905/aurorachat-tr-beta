# AuroraChat

A Discord-like real-time chat application built with React + Vite + TypeScript.

## Run & Operate

- **Dev server**: `npm run dev` — Vite on port 5000 (host: 0.0.0.0)
- **Build**: `npm run build` — outputs to `dist/`
- **Package manager**: npm
- **Env vars**: Supabase URL/anon key in `src/integrations/supabase/client.ts` (public)

## Stack

- React 19 + TypeScript + Vite, Tailwind CSS, shadcn/ui (Radix UI)
- Supabase JS v2 (auth, PostgreSQL, Realtime, Storage)
- LiveKit Client (voice/video WebRTC)
- TanStack Query v5, React Router v6, Framer Motion, Lucide React

## Where things live

- `src/pages/` — route-level pages (Index, Settings, Announcements, BotDeveloper, …)
- `src/components/` — reusable UI (GroupDMChatArea, VoiceMeetingRoom, ServerSidebar, …)
- `src/contexts/` — AuthContext, VoiceContext, ChatContext
- `src/data/changelogData.ts` — version history source-of-truth
- `supabase/migrations/` — SQL migrations (chronological)
- `src/integrations/supabase/` — Supabase client + generated types

## Architecture decisions

- Static deployment: Vite builds to `dist/`, Supabase handles all backend/auth/realtime
- Server order persisted in both IndexedDB (instant) and Supabase `server_members.order_index` (sync across devices)
- Admin email `asfurkan140@gmail.com` hard-coded for app-level admin features (Announcements publish, Moderation)
- GroupDM status: Supabase Presence channel `group-dm-presence-{groupId}` for real-time online/offline; 30s polling as fallback
- Broadcast signaling for voice calls on channel `group-voice-signal-{groupId}` (recall uses subscribe-then-send pattern)

## Product

- Servers with channels (text, voice, screenshare), direct messages, group DMs
- Voice/video rooms via LiveKit; Group DM voice calls with incoming call banner, recall, resizable room (140–520px drag)
- Bot Developer Center: create/manage bots, custom slash commands, add bots to servers
- Plugin/Extension marketplace (CSS/JS plugins)
- Announcements system: admin publishes rich-text posts with images; users comment & reply in real-time
- AuroraChat Premium, connected devices, Spotify integration, MFA (TOTP)
- Moderation panel for app admins

## User preferences

- Turkish UI language throughout
- Admin email: `asfurkan140@gmail.com`
- Date format for announcements/timestamps: `dd.MM.yyyy HH:mm` (Turkish locale)

## Gotchas

- `server_bot_roles` table must be created with `IF NOT EXISTS` (prod DB may lag behind migrations)
- Supabase broadcast requires `channel.subscribe()` before `channel.send()` to guarantee delivery
- GroupDM presence tracks `onlineStatus` field (not Supabase `status`) to avoid conflict with profile status
- Always run new SQL migrations against Supabase prod separately (no auto-migration on deploy)

## SQL Migrations (chronological)

- `20260502300000_v110_bots_plugins_realtime.sql` — bots, server_bots, plugins, user_plugins + RLS + realtime
- `20260502700000_v110_server_bot_roles.sql` — server_bot_roles table + get_server_members_full RPC
- `20260505000000_v112_group_dm_voice_bots.sql` — group_dm_voice_calls, server_bots RLS fixes
- `20260506000000_v113_announcements_system.sql` — announcements + comments tables, server order_index column, RLS, realtime, helper RPCs
- `20260506100000_v114_bot_member_commands_fix.sql` — bots.commands NOT NULL fix, server_bots SELECT policy, get_server_members_full EXCEPTION block, get_server_bot_commands RPC

## Current Version: v1.2.3 (20 Mayıs 2026)

### Features by version
- **v1.2.1**: Communities/Keşfet sayfası + compass butonu (ServerSidebar), mesaj kopyalama (masaüstü hover + mobil long-press), idle/background durum senkronizasyonu (usePresenceKeeper), Bot Developer değişken kopyalama (tıkla→kopyala), PDF veri dışa aktarma (Settings gizlilik), Moderation çevrimiçi sayısı istatistiği, ServerSettings topluluk toggle (is_community, açıklama, kategori), Settings modpanel erişimi (myModRole), sürüm v1.2.1
- **v1.1.5**: Aurora Guard güvenlik katmanı (IP Ban, Rate Limit 6/s, 30-dk cooldown, XSS sanitize), Bot Profil Modalı (BotProfileModal.tsx), komut değişken sistemi ({user}/{username}/{memberCount}/{serverName}), komut düzenleme, moderasyon rol hiyerarşisi (Yetkili/Admin/Moderatör/Deneme), Güvenlik sekmesi modpanelde, mic chevron görünürlük fix, announcement comment RLS 42501 fix, SEO meta güncelleme
- **v1.1.4**: Bot üye listesi düzeltmesi (fallback + RPC EXCEPTION), custom bot komutları slash popup'ta görünüyor, bots.commands NULL bug fix, server_bots SELECT politikası güçlendirildi
- **v1.1.3**: Announcements system (admin publish, rich text, image, comments/replies), GroupDM presence (Supabase Presence), recall fix, resizable voice room, server order persistence fix, server_bot_roles 42P01 fix
- **v1.1.2**: Bot profile editing, "Add Bot to Server" modal, Group DM voice call system, "Bot Ekleme İzni" role permission, custom slash commands from DB
- **v1.1.1**: GroupDM status realtime, manage_bots permission, bot code/commands DB, server_bots RLS
- **v1.1.0**: Bot & Developer system, Plugin marketplace, screenshare freeze fix, mention regex fix

## SQL Migrations (chronological, continued)
- `20260508000000_v115_aurora_guard_security.sql` — banned_ips, rate_limit_cooldowns, mod_role_assignments, announcement_comments RLS fix, lift_user_cooldown RPC
- `20260510000000_v116_updates.sql` — gender_visibility/birth_date_visibility columns, server_members.order_index, profiles RLS (admin update), mod_role_assignments RLS, banned_ips RLS, user_login_ips table
- `20260519000000_v121_community_bot_api.sql` — servers.is_community/community_description/community_category, bot_api_tokens, get_community_servers RPC, validate_bot_token RPC
- `20260520000000_v122_bot_variables_extension_store.sql` — plugin_ratings + plugin_reviews tabloları, RLS, realtime, get_plugin_avg_rating RPC
- `20260520100000_v122_statement_timeout_fix.sql` — **57014 timeout tamamen giderildi**: profiles.status index, pg_trgm GIN index (community search), get_landing_stats approximate counts, get_server_members_full N+1→LATERAL JOIN, get_community_servers timeout guard, get_server_online_count timeout guard, validate_bot_token JOIN optimizasyonu, get_user_servers_full tek-pass sorgu, plugin_ratings/reviews/bot_api_tokens indexleri

## New files (v1.1.5)
- `src/utils/rateLimiter.ts` — in-memory rate limiter (6 req/s, 30-min cooldown)
- `src/utils/sanitize.ts` — XSS sanitization utilities
- `src/components/BotProfileModal.tsx` — bot profile modal with "Sunucuya Ekle"
- `src/components/IpBanModal.tsx` — IP ban modal shown to IP-banned users

## Changes (v1.1.8)
- `src/pages/ChangelogDetail.tsx` — geri butonu navigate('/changelog') yerine navigate(-1) ile döngü düzeltildi
- `src/components/UserProfileCard.tsx` — banner yüksekliği 90px→150px, objectPosition center center; bot yönlendirme mantığı botName öncelikli hale getirildi; CustomBotWrapper name fallback sorgusu eklendi
- `src/pages/Settings.tsx` — banner aspectRatio 21/6→7/3, objectPosition center center
- `src/hooks/useVoice.ts` — joinVoice başarı ve hata sonrası joiningRef.current=false sıfırlanıyor (regions flooding düzeltmesi)
- `src/data/changelogData.ts` — v1.1.8 girişi güncellendi (5 bug fix açıklaması)
- `src/components/ReleaseNotesModal.tsx` — v1.1.8 sürüm notları güncellendi
- `supabase/migrations/20260514000000_v118_custom_bot_message_id.sql` — messages.bot_id kolonu

## Changes (v1.1.7)
- `src/components/BannerUploadSuccessModal.tsx` — NEW: banner upload başarı modalı (animasyon, preview, oto-kapanma)
- `src/pages/Settings.tsx` — Özel Profil Banner bölümü (görünüm sekmesi), gizlilik senkronizasyonu fix, Upload/ImageIcon imports, BannerUploadSuccessModal entegrasyonu
- `src/components/UserProfileCard.tsx` — banner_url desteği (interface, select query, image render, realtime güncelleme)
- `src/contexts/AuthContext.tsx` — banner_url, gender_visibility, birth_date_visibility alanları Profile interface + buildProfile + fetchProfile
- `src/components/ChatArea.tsx` — bot mesajlarında UserProfileCard'a isBot/botName/botAvatarUrl prop'ları eklendi (BotProfileModal tetiklenir)
- `src/hooks/useVoice.ts` — joiningRef guard (eş zamanlı join önleme), _cachedLivekitToken (session boyunca token cache)
- `src/pages/Register.tsx` — avatar race condition fix: signUpData.session varsa setSession ile auth sonra upload
- `src/pages/ModerationPage.tsx` — handleModRoleError helper (403/42501 tespiti + açıklayıcı hata mesajı), tüm mod rol fonksiyonlarında error capture
- `supabase/migrations/20260513000000_v117_banner_mod_fixes.sql` — profiles.banner_url kolonu, profile-banners bucket, mod_role_assignments ALL policy, profiles admin update policy
- `src/data/changelogData.ts` — v1.1.7 girişi (başa eklendi)
- `src/components/ReleaseNotesModal.tsx` — v1.1.7 sürüm notları
- `src/pages/Landing.tsx` — footer v1.1.7

## Changes (v1.1.6)
- `src/pages/ModerationPage.tsx` — userModRoles state, myModRole (mod panel access for role holders), mod role tags in Users tab, inline role assignment in user cards, canAccess includes mod roles
- `src/components/PluginsTab.tsx` — creator display_name/username in store cards, EditPluginModal for own plugins, DocsModal (docs tab), Store/Mine/Create/Admin views, improved UI
- `src/components/BotProfileModal.tsx` — full redesign: gradient banner, initials avatar fallback, tabbed UI (Hakkında/Komutlar/Sunucuya Ekle), bot stats (server count, command count, creation date)
- `src/data/changelogData.ts` — v1.1.6 full entry
- `src/components/ReleaseNotesModal.tsx` — v1.1.6 features list
- `src/pages/Landing.tsx` — v1.1.5 → v1.1.6 footer
- `src/pages/Settings.tsx` — About section v1.1.6, 10 Mayıs 2026

## Gotchas (updated v1.1.6)
- After SQL migration v116, run in Supabase SQL Editor to get: gender_visibility, birth_date_visibility (privacy persistence), server_members.order_index (server order), profiles RLS fix (403 on admin update), user_login_ips (IP tracking)
- mod_role_assignments SELECT policy is now public — any logged-in user can read their own role
- assignModRole/removeModRole now allow isAppAdmin in addition to isFounder
- Plugin store query uses `*, creator:profiles!plugins_creator_id_fkey(username, display_name)` join
