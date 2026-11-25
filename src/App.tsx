import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Calendar,
  Download,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AuthView } from './components/AuthView';
import { ReservationModal, type SelectedSlot } from './components/ReservationModal';
import { ResultBanner, type BannerState } from './components/ResultBanner';
import { RlsGuideModal } from './components/RlsGuideModal';
import { TimetableGrid } from './components/TimetableGrid';
import {
  getSupabaseClient,
  SCHOOL_RESOURCES,
  supabase,
  TIME_SLOTS,
  type Reservation,
} from './lib/supabase';

type PageView = 'board' | 'auth';
type CategoryFilter = '전체' | '공간' | '기자재';
type ListTab = 'date' | 'mine';

function getLocalDateString(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getKoreanWeekdayLabel(dateStr: string, offsetDays: number): string {
  if (offsetDays === 0) return '오늘';
  if (offsetDays === 1) return '내일';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(dt);
}

function getBookerName(item: Reservation): string {
  if (item.user_email && item.user_email.includes('@')) {
    return item.user_email.split('@')[0];
  }
  return `학생 (${item.user_id.slice(0, 6)})`;
}

function exportReservationsCsv(rows: Reservation[], filename: string) {
  const escapeCsv = (val: string) => `"${val.replaceAll('"', '""')}"`;
  const header = ['날짜', '시간대', '공간/기자재', '예약자', '이용 목적', '등록 시각'];
  const body = rows.map((r) => [
    escapeCsv(r.booking_date),
    escapeCsv(r.time_slot),
    escapeCsv(r.resource_name),
    escapeCsv(getBookerName(r)),
    escapeCsv(r.purpose),
    escapeCsv(r.created_at),
  ]);
  const csv = '\uFEFF' + [header.join(','), ...body.map((b) => b.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [view, setView] = useState<PageView>('board');
  const [user, setUser] = useState<User | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString(0));
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('전체');
  const [listTab, setListTab] = useState<ListTab>('date');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [securityTestMode, setSecurityTestMode] = useState<boolean>(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  const showBanner = useCallback((type: 'success' | 'error', message: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setBanner({
      id: Date.now(),
      type,
      message,
    });
    timerRef.current = window.setTimeout(() => {
      setBanner(null);
      timerRef.current = null;
    }, 6000);
  }, []);

  const showSuccess = useCallback(
    (message: string) => showBanner('success', message),
    [showBanner]
  );

  const showError = useCallback(
    (message: string) => showBanner('error', message),
    [showBanner]
  );

  const closeBanner = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setBanner(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const fetchReservations = useCallback(
    async (options?: { announceSuccess?: boolean }) => {
      const announceSuccess = options?.announceSuccess ?? true;
      setLoadingList(true);
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('reservations')
          .select('*')
          .order('booking_date', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) {
          showError(error.message);
          return;
        }

        setReservations((data as Reservation[]) ?? []);
        if (announceSuccess) {
          showSuccess('예약 현황을 불러왔습니다.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(message);
      } finally {
        setLoadingList(false);
      }
    },
    [showError, showSuccess]
  );

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!supabase) {
        await fetchReservations({ announceSuccess: true });
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;

        if (error) {
          showError(error.message);
        } else {
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : String(err);
        showError(message);
      }

      if (active) {
        await fetchReservations({ announceSuccess: true });
      }
    };

    init();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const channel = supabase
      .channel('reservations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          void fetchReservations({ announceSuccess: false });
        }
      )
      .subscribe();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      void supabase?.removeChannel(channel);
    };
  }, [fetchReservations, showError]);

  const handleSignIn = async (email: string, password: string) => {
    setAuthLoading(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showError(error.message);
        return;
      }

      setUser(data.user ?? null);
      setView('board');
      showSuccess('로그인에 성공했습니다.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    setAuthLoading(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
      });

      if (error) {
        showError(error.message);
        return;
      }

      if (data.session?.user) {
        setUser(data.session.user);
        setView('board');
        showSuccess('회원가입 및 로그인이 완료되었습니다.');
      } else {
        showSuccess('회원가입이 완료되었습니다. 이메일 확인 후 로그인해 주세요.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signOut();

      if (error) {
        showError(error.message);
        return;
      }

      setUser(null);
      showSuccess('로그아웃되었습니다.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateBatch = async (
    inputs: Array<{
      resource_name: string;
      booking_date: string;
      time_slot: string;
      purpose: string;
    }>
  ): Promise<boolean> => {
    if (inputs.length === 0 || inputs.some((item) => !item.purpose)) {
      showError('이용 목적을 입력해 주세요.');
      return false;
    }

    setBusyAction(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('reservations')
        .insert(inputs)
        .select();

      if (error) {
        showError(error.message);
        return false;
      }

      const inserted = (data as Reservation[] | null) ?? [];
      if (inserted.length > 0) {
        setReservations((prev) => [...inserted, ...prev]);
      } else {
        await fetchReservations({ announceSuccess: false });
      }

      if (inputs.length === 1) {
        showSuccess(
          `${inputs[0].resource_name} (${inputs[0].time_slot}) 예약이 확정되었습니다.`
        );
      } else {
        showSuccess(
          `${inputs[0].resource_name} ${inputs.length}개 시간대 연속 예약이 확정되었습니다.`
        );
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
      return false;
    } finally {
      setBusyAction(false);
    }
  };

  const handleUpdatePurpose = async (
    reservationId: string,
    purpose: string
  ): Promise<boolean> => {
    if (!purpose) {
      showError('이용 목적을 입력해 주세요.');
      return false;
    }

    setBusyAction(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('reservations')
        .update({ purpose })
        .eq('id', reservationId)
        .select();

      if (error) {
        showError(error.message);
        return false;
      }

      const updated = (data as Reservation[] | null)?.[0];
      if (!updated) {
        showError('예약을 수정할 수 없습니다. (RLS 정책에 의해 타인 예약 수정 차단)');
        return false;
      }

      setReservations((prev) =>
        prev.map((item) => (item.id === reservationId ? updated : item))
      );
      showSuccess('예약 이용 목적이 수정되었습니다.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
      return false;
    } finally {
      setBusyAction(false);
    }
  };

  const handleCancelReservation = async (reservationId: string): Promise<boolean> => {
    setBusyAction(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('reservations')
        .delete()
        .eq('id', reservationId)
        .select();

      if (error) {
        showError(error.message);
        return false;
      }

      const deleted = (data as Reservation[] | null) ?? [];
      if (deleted.length === 0) {
        showError('예약을 취소할 수 없습니다. (RLS 정책에 의해 타인 예약 삭제 차단)');
        return false;
      }

      setReservations((prev) => prev.filter((item) => item.id !== reservationId));
      showSuccess('예약이 취소되었습니다.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
      return false;
    } finally {
      setBusyAction(false);
    }
  };

  const handleFindNextOpenSlot = () => {
    const filteredResources = SCHOOL_RESOURCES.filter(
      (res) => categoryFilter === '전체' || res.category === categoryFilter
    );
    const occupied = new Set(
      reservations
        .filter((r) => r.booking_date === selectedDate)
        .map((r) => `${r.resource_name}__${r.time_slot}`)
    );

    for (const res of filteredResources) {
      for (const slot of TIME_SLOTS) {
        if (!occupied.has(`${res.name}__${slot}`)) {
          setSelectedSlot({
            resourceName: res.name,
            bookingDate: selectedDate,
            timeSlot: slot,
            existing: null,
          });
          return;
        }
      }
    }
    showError(`${selectedDate}에는 선택된 분류의 빈 예약 시간대가 없습니다.`);
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const dateStr = getLocalDateString(idx);
      const count = reservations.filter((r) => r.booking_date === dateStr).length;
      return {
        dateStr,
        label: getKoreanWeekdayLabel(dateStr, idx),
        dayNum: dateStr.slice(8),
        count,
      };
    });
  }, [reservations]);

  const dateReservations = useMemo(() => {
    return reservations.filter((item) => item.booking_date === selectedDate);
  }, [reservations, selectedDate]);

  const myReservations = useMemo(() => {
    if (!user) return [];
    return reservations.filter((item) => item.user_id === user.id);
  }, [reservations, user]);

  const topResourceName = useMemo(() => {
    if (reservations.length === 0) return '집계 없음';
    const counts = new Map<string, number>();
    for (const item of reservations) {
      counts.set(item.resource_name, (counts.get(item.resource_name) ?? 0) + 1);
    }
    let best = '집계 없음';
    let bestCount = 0;
    for (const [name, count] of counts.entries()) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    return best;
  }, [reservations]);

  const displayedList = useMemo(() => {
    const base = listTab === 'mine' ? myReservations : dateReservations;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter(
      (item) =>
        item.resource_name.toLowerCase().includes(query) ||
        item.purpose.toLowerCase().includes(query) ||
        item.user_email.toLowerCase().includes(query)
    );
  }, [listTab, myReservations, dateReservations, searchQuery]);

  const totalSlotsForDate = SCHOOL_RESOURCES.length * TIME_SLOTS.length;
  const availableSlotsForDate = Math.max(0, totalSlotsForDate - dateReservations.length);
  const occupancyRate = Math.round((dateReservations.length / totalSlotsForDate) * 100);
  const userHandle = user?.email ? user.email.split('@')[0] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <ResultBanner banner={banner} onClose={closeBanner} />
      <RlsGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <ReservationModal
        slot={selectedSlot}
        reservations={reservations}
        currentUserId={user?.id ?? null}
        securityTestMode={securityTestMode}
        busy={busyAction}
        onClose={() => setSelectedSlot(null)}
        onCreateBatch={handleCreateBatch}
        onUpdatePurpose={handleUpdatePurpose}
        onCancelReservation={handleCancelReservation}
        onGoToAuth={() => setView('auth')}
      />

      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setView('board')}
            className="text-lg font-bold tracking-tight text-slate-900 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            학교 시설·기자재 예약
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setView('board')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                view === 'board' ? 'text-slate-900 font-semibold' : 'hover:text-slate-900'
              }`}
            >
              예약 현황판
            </button>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />
              DB 보안 및 SQL
            </button>
            <button
              type="button"
              onClick={() => fetchReservations({ announceSuccess: true })}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              새로고침
            </button>
            {user && userHandle && (
              <span className="text-slate-500 whitespace-nowrap shrink-0">
                접속 계정: {userHandle}
              </span>
            )}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                disabled={authLoading}
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                로그아웃
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView(view === 'auth' ? 'board' : 'auth')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" aria-hidden="true" />
                {view === 'auth' ? '예약 현황판 보기' : '로그인 / 회원가입'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {view === 'auth' ? (
          <AuthView
            loading={authLoading}
            onSignIn={handleSignIn}
            onSignUp={handleSignUp}
            onBackToList={() => setView('board')}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
                  교내 공간·기자재 실시간 예약
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mt-1.5">
                  빈 시간표를 클릭해 연속 교시까지 한 번에 예약하세요. DB 중복 방지 및 RLS 보안이 실시간 적용됩니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFindNextOpenSlot}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  빠른 빈자리 예약
                </button>
                <button
                  type="button"
                  onClick={() => setSecurityTestMode((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
                    securityTestMode
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  {securityTestMode ? '보안 검증 모드: 켜짐' : '보안 검증 모드: 꺼짐'}
                </button>
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="md:hidden inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl whitespace-nowrap"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />
                  SQL 보기
                </button>
                <button
                  type="button"
                  onClick={() => fetchReservations({ announceSuccess: true })}
                  className="md:hidden inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  새로고침
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">선택일 잔여 시간대</p>
                <p className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                  {availableSlotsForDate}
                  <span className="text-sm font-normal text-slate-500"> / {totalSlotsForDate}</span>
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">선택일 예약률</p>
                <p className="text-2xl font-bold font-mono-num text-blue-700 mt-1">
                  {occupancyRate}%
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">내 누적 예약</p>
                <p className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                  {user ? `${myReservations.length}건` : '로그인 필요'}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">가장 인기 있는 항목</p>
                <p className="text-lg font-bold text-slate-900 mt-1.5 truncate">
                  {topResourceName}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="grid grid-cols-7 gap-1.5 flex-1">
                  {weekDays.map((day) => {
                    const isSelected = selectedDate === day.dateStr;
                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(day.dateStr)}
                        className={`py-2 px-1.5 rounded-xl border text-center transition-colors ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-[11px] opacity-80">{day.label}</div>
                        <div className="text-sm font-bold font-mono-num">{day.dayNum}</div>
                        <div
                          className={`text-[10px] font-mono-num mt-0.5 ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {day.count}건
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl shrink-0 self-start lg:self-center">
                  <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    aria-label="직접 날짜 선택"
                    className="text-sm font-mono-num font-semibold bg-transparent text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
                    {(['전체', '공간', '기자재'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                          categoryFilter === cat
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setOnlyAvailable((prev) => !prev)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
                      onlyAvailable
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {onlyAvailable ? '빈 시간대만 표시 중' : '빈 시간대만 보기'}
                  </button>
                </div>

                <div className="relative w-full md:w-72">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="공간·예약자·이용 목적 검색..."
                    aria-label="예약 검색"
                    className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {loadingList ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-500">
                시간표 데이터를 불러오는 중입니다...
              </div>
            ) : (
              <TimetableGrid
                selectedDate={selectedDate}
                reservations={reservations}
                currentUserId={user?.id ?? null}
                categoryFilter={categoryFilter}
                searchQuery={searchQuery}
                onlyAvailable={onlyAvailable}
                onSelectSlot={setSelectedSlot}
              />
            )}

            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">
                  {listTab === 'mine'
                    ? `내 전체 예약 내역 (${displayedList.length}건)`
                    : `${selectedDate} 예약 내역 (${displayedList.length}건)`}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setListTab('date')}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        listTab === 'date'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      선택 날짜 전체
                    </button>
                    <button
                      type="button"
                      onClick={() => setListTab('mine')}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        listTab === 'mine'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      내 예약만 보기
                    </button>
                  </div>

                  {displayedList.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        exportReservationsCsv(
                          displayedList,
                          listTab === 'mine'
                            ? '내_예약_내역.csv'
                            : `예약_현황_${selectedDate}.csv`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      CSV 저장
                    </button>
                  )}
                </div>
              </div>

              {displayedList.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
                  {listTab === 'mine'
                    ? user
                      ? '아직 신청한 예약이 없습니다. 위 시간표에서 빈 칸을 클릭해 예약해 보세요.'
                      : '로그인하면 내가 신청한 예약 내역을 모아볼 수 있습니다.'
                    : '표시할 예약 내역이 없습니다.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedList.map((item) => {
                    const isMine = Boolean(user && item.user_id === user.id);
                    const canShowControls = isMine || securityTestMode;
                    return (
                      <article
                        key={item.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <h3 className="text-base font-bold text-slate-900">
                              {item.resource_name}
                            </h3>
                            {isMine && (
                              <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">
                                내 예약
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono-num text-slate-500 mb-2.5">
                            {item.booking_date} · {item.time_slot}
                          </p>
                          <p className="text-sm text-slate-700 leading-relaxed break-words">
                            {item.purpose}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">
                            예약자: {getBookerName(item)}
                          </span>
                          {canShowControls && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSlot({
                                    resourceName: item.resource_name,
                                    bookingDate: item.booking_date,
                                    timeSlot: item.time_slot,
                                    existing: item,
                                  })
                                }
                                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                              >
                                관리
                              </button>
                              <button
                                type="button"
                                disabled={busyAction}
                                onClick={() => handleCancelReservation(item.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                취소
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>학교 시설·기자재 예약 시스템</span>
          <span>Supabase 인증 · 실시간 동기화 · 중복 방지 · RLS 보안 적용</span>
        </div>
      </footer>
    </div>
  );
}
