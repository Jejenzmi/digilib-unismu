export const ADMIN_ROLES = ['admin', 'kepala IT'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}
