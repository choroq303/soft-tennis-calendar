// ==========================================
// ローディング表示とエラー表示
//   入力の不足   → 欄の下に赤い文字（showFieldError）
//   処理のエラー → ダイアログ（showError）
//   起動できない → 画面全体のエラー（showFatalError）
// ==========================================
import { describeError } from '../errors.js';
import { showDialog } from './dialog.js';

export function showLoading(message = '読み込み中...') {
    document.getElementById('loading-text').textContent = message;
    document.getElementById('loading').hidden = false;
}

export function hideLoading() {
    document.getElementById('loading').hidden = true;
}

/**
 * 処理のあいだローディングを表示する
 * @example await withLoading('保存しています...', () => saveReservation(data));
 */
export async function withLoading(message, task) {
    showLoading(message);
    try {
        return await task();
    } finally {
        hideLoading();
    }
}

/**
 * 失敗したことをダイアログで伝える（詳しい内容はコンソールに出す）
 * @param {string} operation - 何をしていたときか（js/errors.js の OPERATIONS のキー）
 * @param {any} error
 * @param {object} [options]
 * @param {() => void} [options.onRetry] - 渡すと、通信・サーバーのエラーのとき「もう一度試す」を出す
 * @param {() => void} [options.onRefresh] - 他の人が先に消していたとき、閉じたあとに呼ぶ（最新の状態を読み込み直す）
 * @example showError('saveReservation', error, { onRetry: save });
 */
export async function showError(operation, error, { onRetry, onRefresh } = {}) {
    console.error(operation, error);
    const { kind, title, message, code } = describeError(operation, error);

    // 時間をおけば直る種類のときだけ「もう一度試す」を出す
    const canRetry = onRetry && (kind === 'network' || kind === 'server');
    const buttons = canRetry
        ? [{ label: '閉じる', value: 'close' }, { label: 'もう一度試す', value: 'retry', style: 'primary' }]
        : [{ label: '閉じる', value: 'close', style: 'primary' }];

    const result = await showDialog({ title, message, tone: 'error', code, buttons });
    if (result === 'retry') onRetry();
    if (kind === 'gone') onRefresh?.();
}

/**
 * アプリを起動できないとき、画面全体にエラーを出す（「再読み込み」でページを読み込み直す）
 * @param {string} operation - js/errors.js の OPERATIONS のキー
 */
export function showFatalError(operation, error) {
    console.error(operation, error);
    hideLoading();
    const { title, message, code } = describeError(operation, error);

    const screen = document.getElementById('fatal-screen');
    document.getElementById('fatal-title').textContent = title;
    document.getElementById('fatal-message').textContent = message;
    const codeLabel = document.getElementById('fatal-code');
    codeLabel.hidden = !code;
    codeLabel.textContent = code ? `エラーコード：${code}` : '';
    screen.hidden = false;
}

/**
 * 入力の不足を、その欄の下に赤い文字で出す（欄を直す・選び直すと消える）
 * @param {HTMLElement} field - 入力欄（.form-group の中にあるもの）
 */
export function showFieldError(field, message) {
    const group = field.closest('.form-group');
    let note = group.querySelector('.field-error');
    if (!note) {
        note = document.createElement('p');
        note.className = 'field-error';
        group.appendChild(note);
    }
    note.textContent = message;
    field.classList.add('is-invalid');
    field.focus();
}

// その欄の下のエラーを消す
export function clearFieldError(field) {
    clearFieldErrors(field.closest('.form-group'));
}

// container（モーダルなど）の中の、すべての欄のエラーを消す
export function clearFieldErrors(container) {
    container.querySelectorAll('.field-error').forEach(note => note.remove());
    container.querySelectorAll('.is-invalid').forEach(field => field.classList.remove('is-invalid'));
}
