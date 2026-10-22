// ==========================================
// ドラムを回して値を選ぶダイアログ（すべての「選ぶ欄」で共通）
//   予定の時間（開始 ～ 終了）、施設のキャンセル期限・最少人数で使う
// ==========================================
import { openModal, closeModal } from './modal.js';

// ドラム1行の高さ（css/modals.css の .drum-item と合わせる）
const ITEM_HEIGHT = 40;

const modal = document.getElementById('drum-picker-modal');
const titleLabel = document.getElementById('drum-picker-title');
const row = document.getElementById('drum-picker-row');
const errorLabel = document.getElementById('drum-picker-error');

// いま開いているダイアログのドラムと、「決定」で呼ぶ処理
let drums = [];
let handleConfirm = null;

export function setupDrumPicker() {
    document.getElementById('drum-picker-confirm').addEventListener('click', () => {
        const values = drums.map(getDrumValue);
        // handleConfirm が文字を返したら（選んだ値が正しくないなど）、それをドラムの下に出して閉じない
        const error = handleConfirm(values);
        if (typeof error === 'string') {
            errorLabel.textContent = error;
            errorLabel.hidden = false;
            return;
        }
        closeModal(modal);
    });
}

/**
 * ドラムのダイアログを開く
 * @param {object} params
 * @param {string} params.title - ダイアログの見出し
 * @param {Array<{ options: Array<{ value: string, label: string }>, value: string } | string>} params.columns
 *   ドラムの列（左から順）。文字列を入れると、その位置に区切りの文字（「：」「～」など）を出す
 * @param {(values: string[]) => string | void} params.onConfirm
 *   「決定」で、各ドラムで選んだ値を左から順に受け取る。文字を返すと、それをエラーとして出してダイアログを閉じない
 * @example
 *   openDrumPicker({
 *       title: '最少人数を選択',
 *       columns: [{ options: [{ value: '4', label: '4人' }, ...], value: '4' }],
 *       onConfirm: ([value]) => { ... }
 *   });
 */
export function openDrumPicker({ title, columns, onConfirm }) {
    titleLabel.textContent = title;
    errorLabel.hidden = true;
    handleConfirm = onConfirm;
    drums = [];

    row.replaceChildren(...columns.map(column => {
        if (typeof column === 'string') {
            const separator = document.createElement('span');
            separator.className = 'drum-separator';
            separator.textContent = column;
            return separator;
        }
        const drum = createDrum(column.options);
        drums.push({ ...drum, initialValue: column.value });
        return drum.element;
    }));

    // 非表示のままだとスクロール位置を設定できないので、表示してから今の値の位置まで回す
    openModal(modal);
    drums.forEach(drum => scrollToValue(drum, drum.initialValue));
}

function createDrum(options) {
    const element = document.createElement('div');
    element.className = 'drum';

    const highlight = document.createElement('div');
    highlight.className = 'drum-highlight';

    const list = document.createElement('div');
    list.className = 'drum-list';
    list.append(...options.map(({ value, label }) => {
        const item = document.createElement('div');
        item.className = 'drum-item';
        item.dataset.value = value;
        item.textContent = label;
        return item;
    }));

    const drum = { element, list, options };
    // 項目をタップしたらそこまで回す
    list.addEventListener('click', (event) => {
        const item = event.target.closest('.drum-item');
        if (item) scrollToValue(drum, item.dataset.value, 'smooth');
    });

    element.append(highlight, list);
    return drum;
}

function scrollToValue(drum, value, behavior = 'auto') {
    const index = Math.max(0, drum.options.findIndex(option => option.value === value));
    drum.list.scrollTo({ top: index * ITEM_HEIGHT, behavior });
}

// 中央の帯に止まっている項目の値
function getDrumValue(drum) {
    const index = Math.min(Math.round(drum.list.scrollTop / ITEM_HEIGHT), drum.options.length - 1);
    return drum.options[index].value;
}
