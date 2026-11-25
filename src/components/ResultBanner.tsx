import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface BannerState {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface ResultBannerProps {
  banner: BannerState | null;
  onClose: () => void;
}

export function ResultBanner({ banner, onClose }: ResultBannerProps) {
  if (!banner) {
    return null;
  }

  const isSuccess = banner.type === 'success';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-0 left-0 right-0 z-50 border-b shadow-lg transition-transform duration-150 ${
        isSuccess
          ? 'bg-emerald-600 border-emerald-700 text-white'
          : 'bg-red-600 border-red-700 text-white'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {isSuccess ? (
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5 text-emerald-100" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-red-100" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-white/90 mb-0.5">
              {isSuccess ? '요청 성공' : '요청 실패'}
            </p>
            <p className="text-base sm:text-lg font-semibold leading-snug whitespace-pre-wrap break-words">
              {banner.message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="결과 알림 닫기"
          className="p-2 rounded-lg hover:bg-black/15 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
