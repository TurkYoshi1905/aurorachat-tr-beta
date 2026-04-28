export const PERMISSIONS = [
  'administrator',
  'manage_server',
  'manage_channels',
  'manage_roles',
  'manage_messages',
  'manage_emojis',
  'kick_members',
  'ban_members',
  'send_messages',
  'pin_messages',
  'mention_everyone',
  'attach_files',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface RolePermissions {
  [key: string]: boolean;
}

export function hasPermission(
  permissions: RolePermissions | undefined | null,
  permission: Permission
): boolean {
  if (!permissions) return false;
  if (permissions.administrator) return true;
  return !!permissions[permission];
}

export function getHighestPermissions(
  roles: { permissions: RolePermissions | null }[]
): RolePermissions {
  const merged: RolePermissions = {};
  for (const role of roles) {
    if (!role.permissions) continue;
    for (const [key, value] of Object.entries(role.permissions)) {
      if (value) merged[key] = true;
    }
  }
  return merged;
}
