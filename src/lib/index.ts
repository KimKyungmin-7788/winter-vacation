import type { Backend } from './backend';
import { createLocalBackend } from './localBackend';
import { createSupabaseBackend } from './supabaseBackend';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase 키가 있으면 서버, 없으면 이 태블릿 안에 저장하는 체험 모드 */
export const backend: Backend = url && key ? createSupabaseBackend(url, key) : createLocalBackend();
