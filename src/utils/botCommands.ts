import { supabase } from '@/integrations/supabase/client';

export interface BotResponse {
  content: string;
  isEmbed?: boolean;
  fields?: { label: string; value: string }[];
}

export interface CommandDef {
  name: string;
  description: string;
  usage: string;
  ownerOnly: boolean;
}

export const COMMANDS: CommandDef[] = [
  { name: 'help', description: 'Tüm komutları listele', usage: '/help', ownerOnly: false },
  { name: 'info', description: 'Sunucu istatistiklerini göster', usage: '/info', ownerOnly: false },
  { name: 'list', description: 'Üye listesini göster', usage: '/list', ownerOnly: false },
  { name: 'ping', description: 'Bot gecikme süresini göster', usage: '/ping', ownerOnly: false },
  { name: 'flip', description: 'Yazı-tura at', usage: '/flip', ownerOnly: false },
  { name: 'roll', description: 'Zar at (varsayılan: 1-6)', usage: '/roll [max]', ownerOnly: false },
  { name: 'poll', description: 'Anket oluştur', usage: '/poll Soru? Seçenek1, Seçenek2', ownerOnly: false },
  { name: 'say', description: 'Bot aracılığıyla mesaj gönder', usage: '/say [mesaj]', ownerOnly: true },
  { name: 'afk', description: 'AFK modunu aç/kapat', usage: '/afk [sebep]', ownerOnly: false },
  { name: 'unafk', description: 'AFK modunu kapat', usage: '/unafk', ownerOnly: false },
  { name: 'announce', description: 'Kanal duyurusu yap', usage: '/announce [mesaj]', ownerOnly: true },
  { name: 'slowmode', description: 'Kanal yavaş modunu ayarla (saniye)', usage: '/slowmode [saniye]', ownerOnly: true },
  { name: 'lock', description: 'Kanalı kilitle', usage: '/lock', ownerOnly: true },
  { name: 'unlock', description: 'Kanal kilidini aç', usage: '/unlock', ownerOnly: true },
  { name: 'kick', description: 'Kullanıcıyı sunucudan çıkar', usage: '/kick @kullanıcı', ownerOnly: true },
  { name: 'ban', description: 'Kullanıcıyı kalıcı olarak yasakla', usage: '/ban @kullanıcı [sebep]', ownerOnly: true },
  { name: 'unban', description: 'Kullanıcının yasağını kaldır', usage: '/unban @kullanıcı', ownerOnly: true },
  { name: 'timeout', description: 'Kullanıcıyı geçici olarak sustur', usage: '/timeout @kullanıcı [dakika]', ownerOnly: true },
  { name: 'untimeout', description: 'Susturma kaldır', usage: '/untimeout @kullanıcı', ownerOnly: true },
];

interface CommandContext {
  serverId: string;
  channelId: string;
  userId: string;
  isOwner: boolean;
  members: { id: string; name: string; role?: string }[];
}

function findMemberByMention(mention: string, members: CommandContext['members']) {
  const name = mention.replace('@', '').trim();
  return members.find(m => m.name.toLowerCase() === name.toLowerCase());
}

export async function executeBotCommand(
  text: string,
  ctx: CommandContext
): Promise<BotResponse | null> {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().replace('/', '');
  const args = parts.slice(1);

  switch (cmd) {
    case 'help': {
      const lines = COMMANDS.map(c => `**${c.usage}** — ${c.description}${c.ownerOnly ? ' 🔒' : ''}`);
      return { content: '📖 **AuroraChat Bot Komutları**\n\n' + lines.join('\n'), isEmbed: true };
    }

    case 'ping': {
      const start = Date.now();
      await supabase.from('profiles').select('id').limit(1);
      const latency = Date.now() - start;
      return { content: `🏓 **Pong!** Gecikme: **${latency}ms**` };
    }

    case 'flip': {
      const result = Math.random() < 0.5 ? '**Yazı**' : '**Tura**';
      return { content: `🪙 Yazı-Tura: ${result}` };
    }

    case 'roll': {
      const max = parseInt(args[0]) || 6;
      if (max < 2) return { content: '❌ Maksimum değer en az 2 olmalıdır.' };
      const rolled = Math.floor(Math.random() * max) + 1;
      return { content: `🎲 Zar atıldı (1-${max}): **${rolled}**` };
    }

    case 'poll': {
      const pollText = args.join(' ');
      if (!pollText) return { content: '❌ Kullanım: `/poll Soru? Seçenek1, Seçenek2`' };
      const parts = pollText.split('?');
      const question = parts[0].trim();
      const optionsPart = parts[1] || '';
      const options = optionsPart.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return { content: '❌ En az 2 seçenek girin: `/poll Soru? Seçenek1, Seçenek2`' };
      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
      const lines = ['📊 **ANKET**', '', `**${question}?**`, ''];
      options.slice(0, 10).forEach((opt, i) => lines.push(`${emojis[i]} ${opt}`));
      return { content: lines.join('\n'), isEmbed: true };
    }

    case 'say': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      const message = args.join(' ');
      if (!message) return { content: '❌ Kullanım: `/say [mesaj]`' };
      return { content: message };
    }

    case 'announce': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      const announcement = args.join(' ');
      if (!announcement) return { content: '❌ Kullanım: `/announce [mesaj]`' };
      return { content: `📢 **DUYURU**\n\n${announcement}\n\n— Sunucu Sahibi`, isEmbed: true };
    }

    case 'slowmode': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      const seconds = parseInt(args[0]);
      if (isNaN(seconds) || seconds < 0) return { content: '❌ Kullanım: `/slowmode [saniye]` (0 = kapalı)' };
      const { error } = await supabase.from('channels').update({ slow_mode_interval: seconds } as any).eq('id', ctx.channelId);
      if (error) return { content: '❌ Yavaş mod ayarlanırken hata oluştu.' };
      if (seconds === 0) return { content: '✅ **Yavaş mod kapatıldı.**' };
      return { content: `⏱️ **Yavaş mod ayarlandı:** ${seconds} saniye` };
    }

    case 'info': {
      const [{ count: memberCount }, { count: channelCount }, { data: serverData }] = await Promise.all([
        supabase.from('server_members').select('*', { count: 'exact', head: true }).eq('server_id', ctx.serverId),
        supabase.from('channels').select('*', { count: 'exact', head: true }).eq('server_id', ctx.serverId),
        supabase.from('servers').select('name, created_at').eq('id', ctx.serverId).single(),
      ]);
      const createdRaw = (serverData as any)?.created_at;
      const created = createdRaw ? new Date(createdRaw).toLocaleDateString('tr-TR') : '?';
      const serverName = (serverData as any)?.name || '?';
      const content = [
        '📊 **Sunucu Bilgisi**',
        '',
        `📌 **Sunucu Adı:** ${serverName}`,
        `👥 **Üye Sayısı:** ${memberCount ?? 0}`,
        `📢 **Kanal Sayısı:** ${channelCount ?? 0}`,
        `📅 **Oluşturulma:** ${created}`,
      ].join('\n');
      return { content, isEmbed: true };
    }

    case 'list': {
      if (ctx.members.length === 0) return { content: '👥 Üye bulunamadı.' };
      const lines = ctx.members.map(m => `• **${m.name}**${m.role ? ` — ${m.role}` : ''}`);
      return { content: '👥 **Üye Listesi**\n\n' + lines.join('\n'), isEmbed: true };
    }

    case 'afk': {
      const reason = args.join(' ') || 'AFK';
      await supabase.from('profiles').update({ is_afk: true, afk_reason: reason } as any).eq('id', ctx.userId);
      return { content: `💤 **AFK modunu açtın.** Sebep: ${reason}` };
    }

    case 'unafk': {
      await supabase.from('profiles').update({ is_afk: false, afk_reason: '' } as any).eq('id', ctx.userId);
      return { content: `✅ **AFK modu kapatıldı.** Tekrar aktifsin!` };
    }

    case 'lock': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      const { error } = await supabase.from('channels').update({ is_locked: true } as any).eq('id', ctx.channelId);
      if (error) return { content: '❌ Kanal kilitlenirken hata oluştu.' };
      return { content: '🔒 **Bu kanal kilitlendi.** Yalnızca sunucu sahibi mesaj gönderebilir.' };
    }

    case 'unlock': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      const { error } = await supabase.from('channels').update({ is_locked: false } as any).eq('id', ctx.channelId);
      if (error) return { content: '❌ Kanal kilidi açılırken hata oluştu.' };
      return { content: '🔓 **Kanal kilidi açıldı.** Herkes mesaj gönderebilir.' };
    }

    case 'kick': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      if (!args[0]) return { content: '❌ Kullanım: `/kick @kullanıcı`' };
      const target = findMemberByMention(args[0], ctx.members);
      if (!target) return { content: `❌ Kullanıcı bulunamadı: ${args[0]}` };
      if (target.id === ctx.userId) return { content: '❌ Kendini atamazsın!' };
      const { error } = await supabase.from('server_members').delete().eq('server_id', ctx.serverId).eq('user_id', target.id);
      if (error) return { content: '❌ Kullanıcı atılırken hata oluştu.' };
      await supabase.from('audit_logs').insert({
        server_id: ctx.serverId, user_id: ctx.userId, action: 'member_kicked',
        target_type: 'member', target_id: target.id, details: { name: target.name },
      } as any);
      return { content: `👢 **${target.name}** sunucudan atıldı.` };
    }

    case 'ban': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      if (!args[0]) return { content: '❌ Kullanım: `/ban @kullanıcı [sebep]`' };
      const target = findMemberByMention(args[0], ctx.members);
      if (!target) return { content: `❌ Kullanıcı bulunamadı: ${args[0]}` };
      if (target.id === ctx.userId) return { content: '❌ Kendini yasaklayamazsın!' };
      const reason = args.slice(1).join(' ') || '';
      const { error: banErr } = await supabase.from('server_bans').insert({
        server_id: ctx.serverId,
        user_id: target.id,
        banned_by: ctx.userId,
        reason,
      } as any);
      if (banErr) return { content: '❌ Yasaklama sırasında hata oluştu.' };
      await supabase.from('server_members').delete().eq('server_id', ctx.serverId).eq('user_id', target.id);
      // Add audit log entry for ban
      await supabase.from('audit_logs').insert({
        server_id: ctx.serverId, user_id: ctx.userId, action: 'member_banned',
        target_type: 'member', target_id: target.id, details: { name: target.name, reason },
      } as any);
      return { content: `🔨 **${target.name}** sunucudan yasaklandı.${reason ? ` Sebep: ${reason}` : ''}` };
    }

    case 'unban': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      if (!args[0]) return { content: '❌ Kullanım: `/unban @kullanıcı`' };
      const name = args[0].replace('@', '');
      const { data: bans } = await supabase.from('server_bans').select('id, user_id').eq('server_id', ctx.serverId);
      if (!bans || bans.length === 0) return { content: '❌ Bu sunucuda yasaklı kullanıcı yok.' };
      const userIds = bans.map(b => b.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
      const profile = profiles?.find(p => (p.display_name || '').toLowerCase() === name.toLowerCase());
      if (!profile) return { content: `❌ Yasaklı kullanıcı bulunamadı: ${name}` };
      await supabase.from('server_bans').delete().eq('server_id', ctx.serverId).eq('user_id', profile.id);
      return { content: `✅ **${profile.display_name}** kullanıcısının yasağı kaldırıldı.` };
    }

    case 'timeout': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      if (!args[0]) return { content: '❌ Kullanım: `/timeout @kullanıcı [dakika]`' };
      const target = findMemberByMention(args[0], ctx.members);
      if (!target) return { content: `❌ Kullanıcı bulunamadı: ${args[0]}` };
      const minutes = parseInt(args[1]) || 10;
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const { error } = await supabase.from('server_members').update({ timeout_until: until } as any).eq('server_id', ctx.serverId).eq('user_id', target.id);
      if (error) return { content: '❌ Susturma sırasında hata oluştu.' };
      await supabase.from('audit_logs').insert({
        server_id: ctx.serverId, user_id: ctx.userId, action: 'member_timeout',
        target_type: 'member', target_id: target.id, details: { name: target.name, minutes },
      } as any);
      return { content: `🔇 **${target.name}** ${minutes} dakika boyunca susturuldu.` };
    }

    case 'untimeout': {
      if (!ctx.isOwner) return { content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir.' };
      if (!args[0]) return { content: '❌ Kullanım: `/untimeout @kullanıcı`' };
      const target = findMemberByMention(args[0], ctx.members);
      if (!target) return { content: `❌ Kullanıcı bulunamadı: ${args[0]}` };
      const { error } = await supabase.from('server_members').update({ timeout_until: null } as any).eq('server_id', ctx.serverId).eq('user_id', target.id);
      if (error) return { content: '❌ Susturma kaldırılırken hata oluştu.' };
      await supabase.from('audit_logs').insert({
        server_id: ctx.serverId, user_id: ctx.userId, action: 'member_untimeout',
        target_type: 'member', target_id: target.id, details: { name: target.name },
      } as any);
      return { content: `🔊 **${target.name}** kullanıcısının susturması kaldırıldı.` };
    }

    default:
      return { content: `❌ Bilinmeyen komut: \`/${cmd}\`. Tüm komutlar için \`/help\` yazın.` };
  }
}

// Check if a mentioned user is AFK and return a notification message
export async function checkAfkMention(content: string, members: { id: string; name: string; username?: string }[]): Promise<string | null> {
  const mentionRegex = /@([\w\u00C0-\u024F\u0100-\u017E\u0180-\u024F]+)/g;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    const mentionedName = match[1].toLowerCase();
    const member = members.find(m =>
      m.name.toLowerCase() === mentionedName ||
      (m.username && m.username.toLowerCase() === mentionedName)
    );
    if (member) {
      const { data } = await supabase.from('profiles').select('is_afk, afk_reason, display_name').eq('id', member.id).single();
      if (data && (data as any).is_afk) {
        return `💤 **${(data as any).display_name || member.name}** şu anda AFK. Sebep: ${(data as any).afk_reason || 'Belirtilmedi'}`;
      }
    }
  }
  return null;
}
