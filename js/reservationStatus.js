// ==========================================
// 予定ステータス（練習が開催できるかどうか）
// カレンダーのカードの色分けに使う。色は css/theme.css の --color-reservation-*。
// ※ 出欠（〇・△・×）のステータスとは別物（そちらは js/icons.js の STATUS_ORDER）
//
// 種類を増やす・減らすときはこの一覧を直す（value は DB の reservations.status に入る値）。
// 色を付けるには css/theme.css に --color-reservation-<value> を、
// 見た目を変えるには css/calendar.css の .is-<value> を足す。
// ==========================================
export const RESERVATION_STATUSES = [
    { value: 'tentative', label: '開催未定' }, // 練習未確定（コートの予約待ちなど）
    { value: 'confirmed', label: '開催決定' }, // 練習確定
    { value: 'cancelled', label: 'キャンセル' } // 練習のキャンセル
];

// 新しく登録した予定は「開催未定」から始める
export const DEFAULT_RESERVATION_STATUS = 'tentative';

// 以前の値（'scheduled' = 予定どおり）は「開催決定」として扱う
const LEGACY_VALUES = { scheduled: 'confirmed' };

// DB の値を一覧の値にそろえる（一覧にない・空の古いデータは「開催決定」として扱う）
export function toReservationStatus(value) {
    const normalized = LEGACY_VALUES[value] ?? value;
    return RESERVATION_STATUSES.some(status => status.value === normalized) ? normalized : 'confirmed';
}

export function getReservationStatusLabel(value) {
    return RESERVATION_STATUSES.find(status => status.value === value)?.label ?? '';
}
