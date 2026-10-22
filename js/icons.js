// ==========================================
// 出欠アイコン（〇・△・×）の共通定義
// システム内の〇△×はすべてここの SVG を使う（形・太さをそろえるため）
// 色は stroke="currentColor" にして、css/calendar.css の .status-icon--ok などで付ける
// ==========================================

// 24×24 の枠の中で、〇△×の見た目の大きさと中心をそろえた形
const STATUS_SHAPES = {
    // 〇：直径18（3〜21）
    ok: '<circle cx="12" cy="12" r="9"></circle>',
    // △：幅18（3〜21）・高さ16。三角形は底辺側が重く見えるため、
    //     枠の中心（11.5）を〇の中心（12）より少しだけ上に置くと、見た目の中心がそろう
    pending: '<polygon points="12,3.5 21,19.5 3,19.5"></polygon>',
    // ×：線の太さで大きく見えるので、〇より一回り小さい14（5〜19）
    ng: '<line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line>'
};

/**
 * 出欠アイコンの SVG 文字列を返す
 * @param {'ok'|'pending'|'ng'} status
 * @param {string} extraClass - 大きさ調整などで追加するクラス
 */
export function statusIconSvg(status, extraClass = '') {
    return `<svg class="status-icon status-icon--${status} ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${STATUS_SHAPES[status]}</svg>`;
}

export const STATUS_ORDER = ['ok', 'pending', 'ng'];
