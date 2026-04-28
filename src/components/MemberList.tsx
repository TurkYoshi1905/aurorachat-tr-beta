import { useState, useMemo } from 'react';
import { DbMember } from '@/types/chat';
import { ArrowLeft, Moon, Search, Crown, Zap, Smartphone } from 'lucide-react';
import { useTranslation } from '@/i18n';
import UserProfileCard from './UserProfileCard';

interface MemberListProps {
  members: DbMember[];
  isMobile?: boolean;
  onBack?: () => void;
  serverId?: string;
  premiumUsers?: Set<string>;
  currentUserId?: string;
  ownerId?: string;
}

const statusColor: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

const statusLabel: Record<string, string> = {
  online: 'Çevrimiçi',
  idle: 'Boşta',
  dnd: 'Rahatsız Etme',
  offline: 'Çevrimdışı',
};

const MemberRow = ({
  member,
  serverId,
  currentUserId,
  premiumUsers,
  isOwner,
}: {
  member: DbMember;
  serverId?: string;
  currentUserId?: string;
  premiumUsers?: Set<string>;
  isOwner?: boolean;
}) => {
  const hasGradient = !!(member.roleColor && member.roleGradientEnd);
  void currentUserId;
  const isPremium = premiumUsers?.has(member.id);

  const nameStyle: React.CSSProperties = hasGradient
    ? {
        background: `linear-gradient(to right, ${member.roleColor}, ${member.roleGradientEnd}, ${member.roleColor})`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }
    : member.roleColor
    ? { color: member.roleColor }
    : {};

  return (
    <UserProfileCard key={member.id} userId={member.id} serverId={serverId} status={member.status} platform={member.platform}>
      <div
        data-testid={`member-row-${member.id}`}
        className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-all duration-150"
      >
        <div className="relative flex-shrink-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm overflow-hidden ring-2 transition-all ${
              member.status === 'offline' ? 'ring-transparent opacity-50' : 'ring-transparent group-hover:ring-white/10'
            }`}
          >
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white font-semibold text-sm">
                {member.avatar}
              </div>
            )}
          </div>

          {isOwner ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-[#2b2d31] rounded-full border border-[#1e1f22]" title="Sunucu Sahibi">
              <Crown className="w-2.5 h-2.5 text-yellow-400" />
            </div>
          ) : member.platform === 'mobile' ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-[#2b2d31] rounded-full border border-[#1e1f22]" title="Mobil istemci">
              <Smartphone className="w-2.5 h-2.5 text-green-500" />
            </div>
          ) : member.status === 'idle' ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-[#313338] rounded-full">
              <Moon className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
            </div>
          ) : (
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${statusColor[member.status]}`}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            {isOwner ? (
              <p
                className={`text-sm font-medium truncate leading-tight transition-colors text-yellow-400`}
              >
                {member.name}
              </p>
            ) : (
              <p
                key={`name-${member.id}-${member.roleColor ?? ''}-${member.roleGradientEnd ?? ''}`}
                className={`text-sm font-medium truncate leading-tight transition-colors ${
                  member.status === 'offline' ? 'opacity-40' : ''
                } ${!member.roleColor ? 'text-[#b5bac1] group-hover:text-[#dbdee1]' : ''} ${hasGradient ? 'role-gradient-text' : ''}`}
                style={member.roleColor ? nameStyle : undefined}
              >
                {member.name}
              </p>
            )}
            {isPremium && (
              <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
            )}
          </div>
          {member.status !== 'offline' && (
            <p className="text-[10px] text-[#6d6f78] leading-tight truncate">
              {statusLabel[member.status]}
            </p>
          )}
        </div>
      </div>
    </UserProfileCard>
  );
};

const SectionHeader = ({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color?: string;
  icon?: React.ReactNode;
}) => (
  <div className="flex items-center gap-2 px-2 mb-1.5 mt-3 first:mt-0">
    {icon && <span className="flex-shrink-0">{icon}</span>}
    <p
      className="text-[10px] font-bold uppercase tracking-widest truncate"
      style={{ color: color || '#6d6f78' }}
    >
      {label}
    </p>
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
      style={
        color
          ? { color: color, backgroundColor: color + '20' }
          : { color: '#6d6f78', backgroundColor: '#3f414750' }
      }
    >
      {count}
    </span>
  </div>
);

const MemberList = ({ members, isMobile, onBack, serverId, premiumUsers, currentUserId, ownerId }: MemberListProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m => m.name.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q));
  }, [members, search]);

  const ownerMember = useMemo(() => ownerId ? filtered.find(m => m.id === ownerId) : undefined, [filtered, ownerId]);

  const roleGroups = useMemo(() => {
    const groups: { roleName: string; roleColor: string; position: number; members: DbMember[] }[] = [];
    const noRole: DbMember[] = [];

    filtered.forEach(member => {
      if (member.id === ownerId) return;
      if (member.role && member.role !== 'Member' && member.roleColor) {
        const existing = groups.find(g => g.roleName === member.role);
        if (existing) {
          existing.members.push(member);
        } else {
          groups.push({ roleName: member.role!, roleColor: member.roleColor!, position: member.rolePosition || 0, members: [member] });
        }
      } else {
        noRole.push(member);
      }
    });

    groups.sort((a, b) => b.position - a.position);
    return { groups, noRole };
  }, [filtered, ownerId]);

  const onlineCount = members.filter(m => m.status !== 'offline').length;
  const totalCount = members.length;
  const hasRoles = roleGroups.groups.length > 0;

  const renderMember = (member: DbMember) => (
    <MemberRow
      key={member.id}
      member={member}
      serverId={serverId}
      currentUserId={currentUserId}
      premiumUsers={premiumUsers}
      isOwner={member.id === ownerId}
    />
  );

  return (
    <div
      className={`${isMobile ? 'w-full h-full' : 'w-60'} bg-[#2b2d31] border-l border-[#1e1f22] flex flex-col overflow-hidden`}
      data-testid="member-list"
    >
      {isMobile && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[#b5bac1] hover:text-[#dbdee1] px-3 py-2 border-b border-[#1e1f22] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t('members.back')}
        </button>
      )}

      <div className="px-3 pt-3 pb-2 border-b border-[#1e1f22]/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6d6f78]">Üyeler</span>
            <span className="flex items-center gap-1 text-[9px] text-green-500/80 font-semibold" title="Supabase Realtime WebSocket ile canlı">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              canlı
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#6d6f78] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {onlineCount}
            </span>
            <span className="text-[10px] text-[#4a4d54]">/</span>
            <span className="text-[10px] text-[#4a4d54]">{totalCount}</span>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6d6f78]" />
          <input
            type="text"
            placeholder="Üye ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-member-search"
            className="w-full pl-6 pr-2.5 py-1.5 text-xs bg-[#1e1f22] text-[#dbdee1] placeholder-[#4a4d54] rounded-md outline-none focus:ring-1 focus:ring-[#5865f2]/50 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-1.5 py-2 space-y-0.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Search className="w-6 h-6 text-[#4a4d54] mb-2" />
            <p className="text-xs text-[#6d6f78]">Sonuç bulunamadı</p>
          </div>
        )}

        {ownerMember && (
          <div>
            <SectionHeader
              label="Sahip"
              count={1}
              color="#facc15"
              icon={<Crown className="w-3 h-3 text-yellow-400" />}
            />
            {renderMember(ownerMember)}
          </div>
        )}

        {hasRoles ? (
          <>
            {roleGroups.groups.map(group => {
              const groupOnline = group.members.filter(m => m.status !== 'offline');
              if (groupOnline.length === 0) return null;
              return (
                <div key={group.roleName}>
                  <SectionHeader label={group.roleName} count={groupOnline.length} color={group.roleColor} />
                  {groupOnline.map(renderMember)}
                </div>
              );
            })}

            {(() => {
              const onlineNoRole = roleGroups.noRole.filter(m => m.status !== 'offline');
              if (onlineNoRole.length === 0) return null;
              return (
                <div>
                  <SectionHeader label={t('members.online')} count={onlineNoRole.length} />
                  {onlineNoRole.map(renderMember)}
                </div>
              );
            })()}

            {(() => {
              const offlineAll = filtered.filter(m => m.status === 'offline' && m.id !== ownerId);
              if (offlineAll.length === 0) return null;
              return (
                <div>
                  <SectionHeader label={t('members.offline')} count={offlineAll.length} />
                  {offlineAll.map(renderMember)}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            {(() => {
              const online = filtered.filter(m => m.status !== 'offline' && m.id !== ownerId);
              if (online.length === 0) return null;
              return (
                <div>
                  <SectionHeader label={t('members.online')} count={online.length} />
                  {online.map(renderMember)}
                </div>
              );
            })()}
            {(() => {
              const offline = filtered.filter(m => m.status === 'offline' && m.id !== ownerId);
              if (offline.length === 0) return null;
              return (
                <div>
                  <SectionHeader label={t('members.offline')} count={offline.length} />
                  {offline.map(renderMember)}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default MemberList;
