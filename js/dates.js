// ==========================================
// 日付の小さな道具
// ==========================================

// Date → 'YYYY-MM-DD'（日本時間のまま。toISOString は UTC になるので使わない）
export function toDateString(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}
