import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { TIME_SLOTS, type Reservation } from '../lib/supabase';

export interface SelectedSlot {
  resourceName: string;
  bookingDate: string;
  timeSlot: string;
  existing: Reservation | null;
}

interface ReservationModalProps {
  slot: SelectedSlot | null;
  reservations: Reservation[];
  currentUserId: string | null;
  securityTestMode: boolean;
  busy: boolean;
  onClose: () => void;
  onCreateBatch: (
    inputs: Array<{
      resource_name: string;
      booking_date: string;
      time_slot: string;
      purpose: string;
    }>
  ) => Promise<boolean>;
  onUpdatePurpose: (reservationId: string, purpose: string) => Promise<boolean>;
  onCancelReservation: (reservationId: string) => Promise<boolean>;
  onGoToAuth: () => void;
}

const PURPOSE_PRESETS = [
  '수행평가 준비',
  '동아리 활동',
  '팀 프로젝트 회의',
  '자습 및 시험 공부',
  '행사·영상 촬영',
];

function downloadReservationIcs(reservation: Reservation) {
  const dateCompact = reservation.booking_date.replaceAll('-', '');
  const timeMatch = reservation.time_slot.match(/(\d{2}):(\d{2})~(\d{2}):(\d{2})/);
  const startTime = timeMatch ? `${timeMatch[1]}${timeMatch[2]}00` : '120000';
  const endTime = timeMatch ? `${timeMatch[3]}${timeMatch[4]}00` : '130000';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//School Reservation//KR',
    'BEGIN:VEVENT',
    `UID:${reservation.id}@school-reservation`,
    `DTSTART;TZID=Asia/Seoul:${dateCompact}T${startTime}`,
    `DTEND;TZID=Asia/Seoul:${dateCompact}T${endTime}`,
    `SUMMARY:[예약] ${reservation.resource_name}`,
    `DESCRIPTION:${reservation.purpose}`,
    `LOCATION:${reservation.resource_name}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reservation.resource_name}_${reservation.booking_date}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReservationModal({
  slot,
  reservations,
  currentUserId,
  securityTestMode,
  busy,
  onClose,
  onCreateBatch,
  onUpdatePurpose,
  onCancelReservation,
  onGoToAuth,
}: ReservationModalProps) {
  const [purpose, setPurpose] = useState('');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    if (!slot) return;
    setPurpose(slot.existing?.purpose ?? '');
    setSelectedTimeSlots([slot.timeSlot]);
    setCopiedShare(false);
  }, [slot]);

  const occupiedSlotsForResourceDate = useMemo(() => {
    if (!slot) return new Set<string>();
    return new Set(
      reservations
        .filter(
          (r) => r.resource_name === slot.resourceName && r.booking_date === slot.bookingDate
        )
        .map((r) => r.time_slot)
    );
  }, [reservations, slot]);

  if (!slot) {
    return null;
  }

  const existing = slot.existing;
  const isMine = Boolean(existing && currentUserId && existing.user_id === currentUserId);
  const bookerLabel = existing
    ? existing.user_email && existing.user_email.includes('@')
      ? existing.user_email.split('@')[0]
      : `학생 (${existing.user_id.slice(0, 6)})`
    : null;

  const toggleTimeSlot = (timeSlot: string) => {
    setSelectedTimeSlots((prev) => {
      if (prev.includes(timeSlot)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== timeSlot);
      }
      return [...prev, timeSlot];
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (existing) {
      const ok = await onUpdatePurpose(existing.id, purpose.trim());
      if (ok) onClose();
      return;
    }

    const targets = selectedTimeSlots.length > 0 ? selectedTimeSlots : [slot.timeSlot];
    const ok = await onCreateBatch(
      targets.map((timeSlot) => ({
        resource_name: slot.resourceName,
        booking_date: slot.bookingDate,
        time_slot: timeSlot,
        purpose: purpose.trim(),
      }))
    );
    if (ok) onClose();
  };

  const handleDuplicateAttempt = async () => {
    const ok = await onCreateBatch([
      {
        resource_name: slot.resourceName,
        booking_date: slot.bookingDate,
        time_slot: slot.timeSlot,
        purpose: purpose.trim() || '중복 예약 테스트',
      },
    ]);
    if (ok) onClose();
  };

  const handleDelete = async () => {
    if (!existing) return;
    const ok = await onCancelReservation(existing.id);
    if (ok) onClose();
  };

  const handleCopyShareText = async () => {
    if (!existing) return;
    const text = `[학교 예약 안내] ${existing.resource_name} · ${existing.booking_date} ${existing.time_slot} (${existing.purpose})`;
    await navigator.clipboard.writeText(text);
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-modal-title"
      className="fixed inset-0 z-40 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="reservation-modal-title" className="text-lg font-bold text-slate-900">
            {existing ? '예약 상세 및 관리' : '새 예약 신청'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 text-base">{slot.resourceName}</span>
              {existing && (
                <span
                  className={`text-xs font-semibold ${
                    isMine ? 'text-blue-700' : 'text-slate-600'
                  }`}
                >
                  {isMine ? '내 예약' : `예약자: ${bookerLabel}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-mono-num">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                {slot.bookingDate}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                {existing ? slot.timeSlot : `${selectedTimeSlots.length}개 교시 선택됨`}
              </span>
            </div>
          </div>

          {existing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyShareText}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    안내 문구 복사됨
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    예약 내용 복사
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => downloadReservationIcs(existing)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                캘린더(.ics) 저장
              </button>
            </div>
          )}

          {!existing && !currentUserId && !securityTestMode ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                예약을 등록하려면 먼저 로그인해야 합니다.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToAuth();
                }}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors"
              >
                로그인 / 회원가입으로 이동
              </button>
            </div>
          ) : existing && !isMine && !securityTestMode ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">이용 목적</p>
                <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {existing.purpose}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                다른 학생이 예약한 시간대입니다. 본인 예약만 수정하거나 취소할 수 있습니다.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!existing && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    연속 시간대 일괄 선택 (원하는 교시 추가 가능)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_SLOTS.map((timeSlot) => {
                      const isOccupied = occupiedSlotsForResourceDate.has(timeSlot);
                      const isChecked = selectedTimeSlots.includes(timeSlot);
                      const [label, range] = timeSlot.split(' (');
                      return (
                        <button
                          key={timeSlot}
                          type="button"
                          disabled={isOccupied}
                          onClick={() => toggleTimeSlot(timeSlot)}
                          className={`p-2.5 text-left rounded-xl border text-xs transition-colors ${
                            isOccupied
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : isChecked
                              ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>{label}</span>
                            {isOccupied && <span className="text-[10px]">마감</span>}
                          </div>
                          <div className="font-mono-num text-[11px] opacity-75 mt-0.5">
                            ({range}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="reservation-purpose"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  이용 목적 및 인원
                </label>
                <input
                  id="reservation-purpose"
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="예: 정보 수행평가 영상 편집 (3명)"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PURPOSE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPurpose(preset)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {existing ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap"
                    >
                      {busy ? '처리 중...' : '이용 목적 수정'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleDelete}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      예약 취소
                    </button>
                  </div>

                  {securityTestMode && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleDuplicateAttempt}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                      동일 시간대 중복 예약 시도 (DB 제약조건 테스트)
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-xl transition-colors"
                >
                  {busy
                    ? '예약 처리 중...'
                    : `${selectedTimeSlots.length}개 시간대 예약 확정`}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
