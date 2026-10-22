// ==========================================
// ブラウザ標準の alert / confirm の代わりのダイアログ（すべてのモーダルより手前に出る）
// ==========================================
import { openModal, closeModal } from './modal.js';

const modal = document.getElementById('dialog-modal');
const titleLabel = document.getElementById('dialog-title');
const messageLabel = document.getElementById('dialog-message');
const codeBox = document.getElementById('dialog-code');
const footer = document.getElementById('dialog-footer');

// いま開いているダイアログを閉じたときに、押したボタンの値を返す処理
let resolveCurrent = null;

// 背景をタップして閉じたときは、何も押さなかった（null）として扱う
modal.addEventListener('click', (event) => {
    if (event.target === modal) finish(null);
});

function finish(value) {
    closeModal(modal);
    resolveCurrent?.(value);
    resolveCurrent = null;
}

/**
 * ダイアログを開き、押したボタンの value を返す（背景をタップして閉じたら null）
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message - 改行（\n）はそのまま改行して表示する
 * @param {'error' | 'danger' | 'info'} [params.tone] - 見出しの左のアイコンの種類
 * @param {string | null} [params.code] - エラーコード。あれば発生日時と一緒に枠で囲んで出す
 * @param {Array<{ label: string, value: string, style?: 'primary' | 'danger' }>} params.buttons - 左から順
 * @returns {Promise<string | null>}
 */
export function showDialog({ title, message, tone = 'info', code = null, buttons }) {
    // 前のダイアログが開いたままなら、何も押さなかったことにして閉じる
    if (resolveCurrent) finish(null);

    modal.dataset.tone = tone;
    titleLabel.textContent = title;
    messageLabel.textContent = message;

    codeBox.hidden = !code;
    if (code) {
        codeBox.querySelector('.dialog-code-value').textContent = code;
        codeBox.querySelector('.dialog-code-time').textContent = formatNow();
    }

    footer.replaceChildren(...buttons.map(({ label, value, style }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = style ? `btn btn-${style}` : 'btn';
        button.textContent = label;
        button.addEventListener('click', () => finish(value));
        return button;
    }));

    openModal(modal);
    return new Promise(resolve => { resolveCurrent = resolve; });
}

/**
 * 削除などの取り消せない操作の確認。「削除する」を押したときだけ true
 * @example if (!await confirmDanger({ title: '予定を削除しますか？', message: '…', confirmLabel: '削除する' })) return;
 */
export async function confirmDanger({ title, message, confirmLabel }) {
    const result = await showDialog({
        title,
        message,
        tone: 'danger',
        buttons: [
            { label: 'やめる', value: 'cancel' },
            { label: confirmLabel, value: 'confirm', style: 'danger' }
        ]
    });
    return result === 'confirm';
}

// 2026/10/22 19:05（管理者に連絡するとき、いつ起きたかがわかるように）
function formatNow() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
