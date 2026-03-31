import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: "text" | "voice";
  position: number;
}

interface ChatContextType {
  servers: Server[];
  currentServer: Server | null;
  setCurrentServerId: (id: string | null) => void;
  channels: Channel[];
  currentChannel: Channel | null;
  setCurrentChannelId: (id: string | null) => void;
  loadingServers: boolean;
  createServer: (name: string) => Promise<void>;
  joinServer: (inviteCode: string) => Promise<{ error?: string }>;
  createChannel: (name: string, type?: "text" | "voice") => Promise<void>;
}

const ChatContext = createContext<ChatContextType>({} as ChatContextType);
export const useChat = () => useContext(ChatContext);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [loadingServers, setLoadingServers] = useState(true);

  const currentServer = servers.find((s) => s.id === currentServerId) ?? null;
  const currentChannel = channels.find((c) => c.id === currentChannelId) ?? null;

  // Load servers user is member of — single query via join
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("server_members")
        .select("servers(*)")
        .eq("user_id", user.id);
      const loaded = (data || [])
        .map((m: any) => m.servers)
        .filter(Boolean) as Server[];
      setServers(loaded);
      setLoadingServers(false);
    };
    load();
  }, [user]);

  // Load channels when server changes
  useEffect(() => {
    if (!currentServerId) { setChannels([]); setCurrentChannelId(null); return; }
    const load = async () => {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("server_id", currentServerId)
        .order("position");
      const ch = (data as Channel[]) || [];
      setChannels(ch);
      if (ch.length > 0 && !currentChannelId) setCurrentChannelId(ch[0].id);
    };
    load();
  }, [currentServerId]);

  const createServer = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("servers")
      .insert({ name, owner_id: user.id })
      .select()
      .single();
    if (!error && data) {
      setServers((prev) => [...prev, data as Server]);
      setCurrentServerId((data as Server).id);
    }
  };

  const joinServer = async (inviteCode: string) => {
    if (!user) return { error: "Not logged in" };
    const { data: server } = await supabase
      .from("servers")
      .select("id")
      .eq("invite_code", inviteCode)
      .single();
    if (!server) return { error: "Geçersiz davet kodu" };
    const { error } = await supabase
      .from("server_members")
      .insert({ server_id: server.id, user_id: user.id });
    if (error) {
      if (error.code === "23505") return { error: "Zaten bu sunucudasınız" };
      return { error: error.message };
    }
    // Reload servers
    const { data: s } = await supabase.from("servers").select("*").eq("id", server.id).single();
    if (s) {
      setServers((prev) => [...prev, s as Server]);
      setCurrentServerId((s as Server).id);
    }

    // Send welcome message if enabled
    try {
      const { data: serverSettings } = await supabase
        .from("servers")
        .select("welcome_enabled, welcome_channel_id, welcome_message, name")
        .eq("id", server.id)
        .single();

      if (serverSettings && (serverSettings as any).welcome_enabled && (serverSettings as any).welcome_channel_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", user.id)
          .single();
        const userName = (profile as any)?.display_name || (profile as any)?.username || "Kullanıcı";
        const rawMsg = (serverSettings as any).welcome_message || `Hoş geldin, **{user}**! 🎉 **${(serverSettings as any).name}** sunucusuna katıldın.`;
        const welcomeMsg = rawMsg.replace(/\{user\}/g, userName).replace(/\{server\}/g, (serverSettings as any).name || "");
        await supabase.from("messages").insert({
          channel_id: (serverSettings as any).welcome_channel_id,
          user_id: user.id,
          author_name: "AuroraChat Bot",
          content: welcomeMsg,
          server_id: server.id,
        } as any);
      }
    } catch { /* welcome message is optional, don't fail join */ }

    return {};
  };

  const createChannel = async (name: string, type: "text" | "voice" = "text") => {
    if (!currentServerId) return;
    const { data, error } = await supabase
      .from("channels")
      .insert({ server_id: currentServerId, name, type, position: channels.length })
      .select()
      .single();
    if (!error && data) {
      setChannels((prev) => [...prev, data as Channel]);
      setCurrentChannelId((data as Channel).id);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        servers, currentServer, setCurrentServerId,
        channels, currentChannel, setCurrentChannelId,
        loadingServers, createServer, joinServer, createChannel,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
