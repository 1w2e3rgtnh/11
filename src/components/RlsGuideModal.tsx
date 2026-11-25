import { useState } from 'react';
import { Check, Copy, ShieldCheck, X } from 'lucide-react';
import { RESERVATIONS_SETUP_SQL } from '../lib/supabase';

interface RlsGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function RlsGuideModal({ open, onClose }: RlsGuideModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) {
    return null;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(RESERVATIONS_SETUP_SQL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rls-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <h2 id="rls-modal-title" className="text-lg font-bold text-slate-900">
              DB 보안(RLS) · 중복 방지 설계 및 SQL
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="font-bold text-slate-900 mb-1">1. 중복 예약 DB 원천 차단</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                `(resource_name, booking_date, time_slot)` UNIQUE 제약조건으로 두 명이 동시에 눌러도 1명만 성공합니다.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="font-bold text-slate-900 mb-1">2. 신원 위조 방지 (DEFAULT)</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                `user_id`와 `user_email`은 프론트에서 보내지 않고 DB가 JWT(`auth.uid()`, `auth.jwt()`)에서 직접 채웁니다.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="font-bold text-slate-900 mb-1">3. 수정·취소 권한 보호 (RLS)</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                예약한 본인(`auth.uid() = user_id`) 외에는 다른 학생의 예약을 수정하거나 취소할 수 없습니다.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="font-bold text-slate-900 mb-1">4. 비로그인 현황 조회 허용</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                로그인하지 않아도 전체 시간표 빈자리는 열람 가능하며, 예약은 로그인 사용자에게만 허용됩니다.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-bold text-slate-900">Supabase SQL Editor 실행 코드</p>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    SQL 복사
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono-num overflow-x-auto leading-relaxed">
              {RESERVATIONS_SETUP_SQL}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
