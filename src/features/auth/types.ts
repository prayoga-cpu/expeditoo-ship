// ========================================
// User Roles
// ========================================

export enum UserRole {
  BUYER = "buyer",
  SELLER = "seller",
  AUCTIONEER = "auctioneer",
  TRANSPORTER = "transporter",
  OPERATOR = "operator",
  ADMIN = "admin",
}

export type UserRoleType = `${UserRole}`;

// ========================================
// User Types
// ========================================

export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithRoles extends User {
  roles: UserRoleType[];
}

// ========================================
// Session Types
// ========================================

export interface AuthSession {
  user: User;
  session: {
    id: string;
    expiresAt: Date;
  };
}

// ========================================
// Auth Form Types
// ========================================

export interface SignInFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
  token: string;
}

export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileFormData {
  name?: string;
  image?: string;
}

// ========================================
// Auth Response Types
// ========================================

export interface AuthResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface SignInResponse extends AuthResponse {
  user?: User;
  session?: {
    id: string;
    expiresAt: Date;
  };
}

export interface SignUpResponse extends AuthResponse {
  userId?: string;
}

// ========================================
// Role Helper Types
// ========================================

export type RolePermissions = {
  [key in UserRole]: string[];
};

// Define what each role can do
export const ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.BUYER]: [
    "view:items",
    "bid:auction",
    "purchase:item",
    "create:shipment",
    "view:own_profile",
  ],
  [UserRole.SELLER]: [
    "view:items",
    "create:listing",
    "manage:own_listings",
    "view:own_profile",
  ],
  [UserRole.AUCTIONEER]: [
    "view:items",
    "create:auction",
    "manage:auctions",
    "approve:items",
    "view:own_profile",
  ],
  [UserRole.TRANSPORTER]: [
    "view:shipments",
    "accept:shipment",
    "update:shipment_status",
    "upload:proof_of_delivery",
    "view:own_profile",
  ],
  [UserRole.OPERATOR]: [
    "view:all_shipments",
    "validate:shipment",
    "adjust:pricing",
    "assign:transporter",
    "override:shipment_status",
    "view:analytics",
  ],
  [UserRole.ADMIN]: [
    "manage:users",
    "assign:roles",
    "view:all_data",
    "manage:platform",
    "access:admin_panel",
  ],
};

// ========================================
// Role Check Helpers
// ========================================

export function hasRole(userRoles: UserRoleType[], role: UserRole): boolean {
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: UserRoleType[], roles: UserRole[]): boolean {
  return roles.some((role) => userRoles.includes(role));
}

export function hasAllRoles(userRoles: UserRoleType[], roles: UserRole[]): boolean {
  return roles.every((role) => userRoles.includes(role));
}

export function hasPermission(
  userRoles: UserRoleType[],
  permission: string
): boolean {
  return userRoles.some((role) => {
    const rolePermissions = ROLE_PERMISSIONS[role as UserRole];
    return rolePermissions?.includes(permission) ?? false;
  });
}

// ========================================
// Route Guards
// ========================================

export interface RouteGuard {
  path: string;
  requiredRoles?: UserRole[];
  requiredPermissions?: string[];
  requireEmailVerification?: boolean;
}

export const PROTECTED_ROUTES: RouteGuard[] = [
  {
    path: "/admin",
    requiredRoles: [UserRole.ADMIN],
    requireEmailVerification: true,
  },
  {
    path: "/create",
    requiredRoles: [UserRole.SELLER, UserRole.AUCTIONEER],
    requireEmailVerification: true,
  },
  {
    path: "/deliveries",
    requiredRoles: [UserRole.BUYER, UserRole.SELLER, UserRole.TRANSPORTER],
    requireEmailVerification: true,
  },
  {
    path: "/home",
    requireEmailVerification: true,
  },
  {
    path: "/profile",
    requireEmailVerification: true,
  },
  {
    path: "/settings",
    requireEmailVerification: true,
  },
  {
    path: "/messages",
    requireEmailVerification: true,
  },
];
