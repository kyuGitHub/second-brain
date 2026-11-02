import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Supabase 주소·공개 키가 있을 때만 로그인과 데이터 불러오기가 동작한다. */
export const isConfigured = Boolean(url && anonKey);
export const supabase = isConfigured ? createClient(url, anonKey) : null;

/** 그래프 데이터를 보관하는 비공개 저장소 이름 (supabase/schema.sql 과 같아야 함) */
export const BUCKET = 'second-brain';
