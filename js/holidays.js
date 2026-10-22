// ==========================================
// 日本の祝日（カレンダーで日付を赤くするのに使う）
// 公開されている祝日 API（https://holidays-jp.github.io/）から、去年〜来年の祝日を読み込む。
// 読み込めなかったときは祝日なしとして動く（カレンダー自体は表示できるように）
// ==========================================
const HOLIDAYS_URL = 'https://holidays-jp.github.io/api/v1/date.json';

// 通信が遅いときにアプリの起動を待たせすぎないよう、この時間で諦める
const TIMEOUT_MS = 3000;

/**
 * @returns {Promise<Map<string, string>>} 'YYYY-MM-DD' → 祝日名（例: '2026-11-03' → '文化の日'）
 */
export async function loadHolidays() {
    try {
        const response = await fetch(HOLIDAYS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return new Map(Object.entries(await response.json()));
    } catch (error) {
        console.warn('祝日を読み込めなかったので、祝日なしで表示します。', error);
        return new Map();
    }
}
