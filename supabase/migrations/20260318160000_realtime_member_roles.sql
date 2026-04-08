-- Enable realtime for server_member_roles so role assignments
-- update member list without page refresh
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_member_roles;
