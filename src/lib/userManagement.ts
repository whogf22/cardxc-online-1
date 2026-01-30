// User management API client - uses real backend API
import { apiClient } from './apiClient';

interface CreateUserData {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  country?: string;
  role?: 'USER' | 'SUPER_ADMIN';
  status?: 'active' | 'suspended' | 'blocked';
}

interface UpdateUserData {
  user_id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  country?: string;
  status?: 'active' | 'suspended' | 'blocked';
}

interface UpdateRoleData {
  user_id: string;
  role: 'USER' | 'SUPER_ADMIN';
}

export async function createUser(userData: CreateUserData) {
  console.warn('[UserManagement] Admin user creation should be done via API');
  throw new Error('Admin user creation not available. Users should register through the signup page.');
}

export async function updateUser(userData: UpdateUserData) {
  try {
    const response = await apiClient.put(`/admin/users/${userData.user_id}/status`, {
      status: userData.status || 'active',
      reason: 'Admin update',
    });
    
    return {
      success: response.data.success,
      user: userData,
    };
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || 'Failed to update user');
  }
}

export async function deleteUser(userId: string) {
  console.warn('[UserManagement] User deletion should be done carefully via API');
  throw new Error('User deletion not available through this interface. Contact system administrator.');
}

export async function updateUserRole(roleData: UpdateRoleData) {
  try {
    const response = await apiClient.put(`/admin/users/${roleData.user_id}/role`, {
      role: roleData.role,
    });
    
    return {
      success: response.data.success,
      user: { id: roleData.user_id, role: roleData.role },
    };
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || 'Failed to update user role');
  }
}
