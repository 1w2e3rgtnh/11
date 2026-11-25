import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ResourceItem {
  name: string;
  category: '공간' | '기자재';
  detail: string;
}

export const SCHOOL_RESOURCES: ResourceItem[] = [
  { name: '스터디룸 A', category: '공간', detail: '최대 6인 · 화이트보드' },
  { name: '스터디룸 B', category: '공간', detail: '최대 4인 · 조용한 자습' },
  { name: '컴퓨터실', category: '공간', detail: 'PC 30대 · 정보 수업/과제' },
  { name: '음악 연습실', category: '공간', detail: '방음실 · 합주/개인 연습' },
  { name: '디지털 카메라', category: '기자재', detail: 'DSLR · 행사/영상 촬영' },
  { name: '빔프로젝터 세트', category: '기자재', detail: '이동식 · 발표/동아리' },
];

export const TIME_SLOTS = [
  '점심시간 (12:30~13:20)',
  '방과후 1 (16:00~17:00)',
  '방과후 2 (17:00~18:00)',
  '석식시간 (18:00~19:00)',
  '야자 1교시 (19:00~20:20)',
  '야자 2교시 (20:30~21:50)',
] as const;

export interface Reservation {
  id: string;
  user_id: string;
  user_email: string;
  resource_name: string;
  booking_date: string;
  time_slot: string;
  purpose: string;
  created_at: string;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const MISSING_ENV_MESSAGE =
  'VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(MISSING_ENV_MESSAGE);
  }
  return supabase;
}

export const RESERVATIONS_SETUP_SQL = `create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_email text not null default coalesce(auth.jwt() ->> 'email', ''),
  resource_name text not null,
  booking_date date not null,
  time_slot text not null,
  purpose text not null,
  created_at timestamptz not null default now(),
  constraint unique_resource_date_slot unique (resource_name, booking_date, time_slot)
);

create index if not exists reservations_date_idx
  on public.reservations (booking_date asc, created_at desc);

alter table public.reservations
  alter column user_id set default auth.uid();

alter table public.reservations
  alter column user_email set default coalesce(auth.jwt() ->> 'email', '');

alter table public.reservations enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'reservations'
  loop
    execute format('drop policy if exists %I on public.reservations', pol.policyname);
  end loop;
end $$;

-- 1. 누구나 예약 현황 조회 가능 (중복 예약 확인)
create policy "reservations_select_public"
  on public.reservations for select
  to anon, authenticated
  using (true);

-- 2. 로그인한 사용자만 본인 명의로 예약 생성 가능
create policy "reservations_insert_own"
  on public.reservations for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 3. 예약한 본인만 사용 목적 수정 가능
create policy "reservations_update_own"
  on public.reservations for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. 예약한 본인만 예약 취소(삭제) 가능
create policy "reservations_delete_own"
  on public.reservations for delete
  to authenticated
  using (auth.uid() = user_id);`;
