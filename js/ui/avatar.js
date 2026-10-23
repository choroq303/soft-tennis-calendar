// ==========================================
// LINE のアイコン（出欠のメンバー一覧・通知・メンバー管理で共通）
// アイコンがない人は、名前の頭文字を丸で表示する
// ==========================================

/**
 * @param {{ name: string, pictureUrl: string | null }} person
 * @param {string} [extraClass] - 大きさを変えるときなど（例: 'member-avatar--large'）
 * @returns {HTMLElement}
 */
export function createAvatar({ name, pictureUrl }, extraClass = '') {
    let avatar;
    if (pictureUrl?.startsWith('https://')) {
        avatar = document.createElement('img');
        avatar.src = pictureUrl;
        avatar.alt = '';
        avatar.loading = 'lazy';
    } else {
        avatar = document.createElement('span');
        avatar.textContent = Array.from(name ?? '')[0] ?? '?';
    }
    avatar.className = `member-avatar ${extraClass}`.trim();
    return avatar;
}
