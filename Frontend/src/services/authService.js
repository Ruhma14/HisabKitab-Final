import { api, getToken } from './api';
const SESSION_KEY='hisabkitab_auth_session';
export function initOwnerCredentials(){return null;}
export function getActiveSession(){try{const raw=localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null;}catch{return null;}}
export function clearSession(){localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem('hisabkitab_auth_token');sessionStorage.removeItem('hisabkitab_auth_token');}
export async function authenticateOwner(identifier,password,rememberMe=true){const result=await api('/auth/login',{method:'POST',body:{identifier,pin:password}});const session={token:result.token,authenticatedAt:new Date().toISOString(),ownerName:result.user.ownerName,shopName:result.user.shopName,phone:result.user.phone,role:result.user.role};localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem('hisabkitab_auth_token');sessionStorage.removeItem('hisabkitab_auth_token');const storage=rememberMe?localStorage:sessionStorage;storage.setItem(SESSION_KEY,JSON.stringify(session));storage.setItem('hisabkitab_auth_token',result.token);return result;}
export async function updateOwnerPassword(currentPassword,newPassword){try{return await api('/auth/pin',{method:'PUT',body:{currentPin:currentPassword,newPin:newPassword}});}catch(e){return {success:false,message:e.message};}}
export async function updateOwnerProfile(data){return api('/auth/profile',{method:'PUT',body:data});}
export { getToken };
