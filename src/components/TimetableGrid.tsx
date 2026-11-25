import { Plus } from 'lucide-react';
import { SCHOOL_RESOURCES, TIME_SLOTS, type Reservation } from '../lib/supabase';

interface TimetableGridProps {
  selectedDate: string;
  reservations: Reservation[];
  currentUserId: string | null;
  categoryFilter: '전체' | '공간' | '기자재';
  searchQuery: string;
  onlyAvailable: boolean;
  onSelectSlot: (params: {
    resourceName: string;
    bookingDate: string;
    timeSlot: string;
    existing: Reservation | null;
  }) => void;
}

function getBookerShortName(reservation: Reservation): string {
  if (reservation.user_email && reservation.user_email.includes('@')) {
    return reservation.user_email.split('@')[0];
  }
  return `학생 (${reservation.user_id.slice(0, 6)})`;
}

export function TimetableGrid({
  selectedDate,
  reservations,
  currentUserId,
  categoryFilter,
  searchQuery,
  onlyAvailable,
  onSelectSlot,
}: TimetableGridProps) {
  const query = searchQuery.trim().toLowerCase();

  const filteredResources = SCHOOL_RESOURCES.filter((res) => {
    if (categoryFilter !== '전체' && res.category !== categoryFilter) {
      return false;
    }
    if (query) {
      const resourceMatch =
        res.name.toLowerCase().includes(query) || res.detail.toLowerCase().includes(query);
      if (resourceMatch) return true;
      const hasMatchingBooking = reservations.some(
        (r) =>
          r.booking_date === selectedDate &&
          r.resource_name === res.name &&
          (r.purpose.toLowerCase().includes(query) || r.user_email.toLowerCase().includes(query))
      );
      return hasMatchingBooking;
    }
    return true;
  });

  const slotMap = new Map<string, Reservation>();
  for (const item of reservations) {
    if (item.booking_date === selectedDate) {
      slotMap.set(`${item.resource_name}__${item.time_slot}`, item);
    }
  }

  if (filteredResources.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
        검색 조건에 맞는 공간 또는 기자재가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3.5 px-4 text-xs font-bold text-slate-600 w-52 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                공간 / 기자재
              </th>
              {TIME_SLOTS.map((slot) => {
                const [label, time] = slot.split(' (');
                return (
                  <th
                    key={slot}
                    className="py-3 px-3 text-xs font-semibold text-slate-700 border-r last:border-r-0 border-slate-200 min-w-[136px]"
                  >
                    <div>{label}</div>
                    <div className="font-mono-num text-[11px] font-normal text-slate-500 mt-0.5">
                      ({time}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredResources.map((resource) => {
              const bookedCount = TIME_SLOTS.filter((slot) =>
                slotMap.has(`${resource.name}__${slot}`)
              ).length;

              return (
                <tr key={resource.name} className="hover:bg-slate-50/40">
                  <th className="py-3.5 px-4 align-top sticky left-0 bg-white z-10 border-r border-slate-200 font-normal">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">{resource.name}</span>
                      <span className="text-[11px] font-mono-num text-slate-500 whitespace-nowrap">
                        {TIME_SLOTS.length - bookedCount}/{TIME_SLOTS.length}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {resource.category} · {resource.detail}
                    </div>
                  </th>

                  {TIME_SLOTS.map((slot) => {
                    const existing = slotMap.get(`${resource.name}__${slot}`) ?? null;
                    const isMine = Boolean(
                      existing && currentUserId && existing.user_id === currentUserId
                    );

                    if (!existing) {
                      return (
                        <td
                          key={slot}
                          className="p-2 align-middle border-r last:border-r-0 border-slate-200"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onSelectSlot({
                                resourceName: resource.name,
                                bookingDate: selectedDate,
                                timeSlot: slot,
                                existing: null,
                              })
                            }
                            className="w-full h-16 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 text-slate-500 hover:text-blue-700 flex flex-col items-center justify-center gap-1 transition-colors text-xs font-medium"
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>예약 가능</span>
                          </button>
                        </td>
                      );
                    }

                    if (onlyAvailable) {
                      return (
                        <td
                          key={slot}
                          className="p-2 align-middle border-r last:border-r-0 border-slate-200"
                        >
                          <div className="w-full h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[11px] text-slate-400">
                            예약 마감
                          </div>
                        </td>
                      );
                    }

                    const matchesQuery =
                      Boolean(query) &&
                      (existing.purpose.toLowerCase().includes(query) ||
                        existing.user_email.toLowerCase().includes(query) ||
                        existing.resource_name.toLowerCase().includes(query));

                    return (
                      <td
                        key={slot}
                        className="p-2 align-middle border-r last:border-r-0 border-slate-200"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onSelectSlot({
                              resourceName: resource.name,
                              bookingDate: selectedDate,
                              timeSlot: slot,
                              existing,
                            })
                          }
                          className={`w-full h-16 rounded-xl border p-2.5 text-left flex flex-col justify-between transition-colors ${
                            matchesQuery
                              ? 'bg-amber-50 border-amber-400 hover:bg-amber-100/80'
                              : isMine
                              ? 'bg-blue-50 border-blue-300 hover:bg-blue-100/80'
                              : 'bg-slate-100 border-slate-200 hover:bg-slate-200/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold">
                            <span
                              className={`truncate ${
                                isMine ? 'text-blue-800' : 'text-slate-700'
                              }`}
                            >
                              {getBookerShortName(existing)}
                            </span>
                            {isMine && (
                              <span className="shrink-0 text-blue-700 whitespace-nowrap">
                                내 예약
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 truncate">{existing.purpose}</p>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
