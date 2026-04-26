export interface DbMessage {
  id: string;
  author: string;
  avatar: string;
  avatarUrl?: string | null;
  userId: string;
  content: string;
  timestamp: string;
  insertedAt?: string;
  isBot?: boolean;
  edited?: boolean;
  status?: 'sending' | 'failed';
  attachments?: string[];
  replyTo?: string;
  replyAuthor?: string;
  replyContent?: string;
  isPinned?: boolean;
}

export interface DbReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface DbMember {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  avatarUrl?: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  role?: string;
  roleColor?: string;
  rolePosition?: number;
  roleId?: string;
  roleGradientEnd?: string;
  platform?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
}

export interface DbChannel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
  sort_order?: number;
  category_id?: string | null;
  is_locked?: boolean;
  slow_mode_interval?: number;
}

export interface DbServer {
  id: string;
  name: string;
  icon: string;
  owner_id: string | null;
  channels: DbChannel[];
  categories?: DbCategory[];
  word_filter?: string[];
  word_filter_exempt_role_ids?: string[];
}

export interface DbCategory {
  id: string;
  name: string;
  position: number;
  server_id: string;
}
