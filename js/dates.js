// ==========================================
// 日付の小さな道具
// ==========================================

// Date → 'YYYY-MM-DD'（日本時間のまま。toISOString は UTC になるので使わない）
export function toDateString(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

// 'YYYY-MM-DD' → Date（日本時間の0時。new Date('YYYY-MM-DD') は UTC になるので使わない）
export function fromDateString(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// '2026-10-22' → '2026年10月22日（木）'
export function formatDateWithWeekday(dateString) {
    const date = fromDateString(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
}
