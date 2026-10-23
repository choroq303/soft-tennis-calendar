// ==========================================
// 日付を選ぶカレンダーのダイアログ（練習の登録・編集の「日付」で使う）
// スマホ標準の日付選択の代わりに、アプリのカレンダーと同じ見た目（日曜・祝日は赤、土曜は青、今日はライム）で出す。
// 日付をタップするとすぐ決まって閉じる
// ==========================================
import { openModal, closeModal } from './modal.js';
import { toDateString, fromDateString } from '../dates.js';

const modal = document.getElementById('date-picker-modal');
const titleLabel = document.getElementById('date-picker-title');
const grid = document.getElementById('date-picker-grid');

// 祝日（js/holidays.js）。setupDatePicker で受け取る
let holidays = new Map();
// 表示中の月の1日、選んでいる日付（'YYYY-MM-DD'）、日付を選んだときの処理
let shownMonth = null;
let selectedDate = null;
let handleSelect = null;

/**
 * @param {Map<string, string>} holidayMap - 祝日（'YYYY-MM-DD' → 祝日名）
 */
export function setupDatePicker(holidayMap) {
    holidays = holidayMap;
    document.getElementById('date-picker-prev').addEventListener('click', () => moveMonth(-1));
    document.getElementById('date-picker-next').addEventListener('click', () => moveMonth(1));
    document.getElementById('date-picker-today').addEventListener('click', () => select(toDateString(new Date())));
    grid.addEventListener('click', (event) => {
        const cell = event.target.closest('.date-cell');
        if (cell) select(cell.dataset.date);
    });
}

/**
 * 日付のダイアログを開く
 * @param {{ value: string, onSelect: (date: string) => void }} params
 *   value … 今選んでいる日付（'YYYY-MM-DD'）。その月を表示する
 */
export function openDatePicker({ value, onSelect }) {
    selectedDate = value;
    handleSelect = onSelect;
    const date = value ? fromDateString(value) : new Date();
    shownMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    render();
    openModal(modal);
}

function select(date) {
    handleSelect(date);
    closeModal(modal);
}

function moveMonth(step) {
    shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + step, 1);
    render();
}

// 表示中の月を、日曜はじまりの6週（42日）で描く（月によって高さが変わらないように）
function render() {
    titleLabel.textContent = `${shownMonth.getFullYear()}年${shownMonth.getMonth() + 1}月`;
    const today = toDateString(new Date());
    const start = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), 1 - shownMonth.getDay());

    grid.replaceChildren(...Array.from({ length: 42 }, (_, i) => {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const date = toDateString(day);

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'date-cell';
        cell.dataset.date = date;
        cell.textContent = day.getDate();
        cell.classList.toggle('is-other-month', day.getMonth() !== shownMonth.getMonth());
        cell.classList.toggle('is-sun', day.getDay() === 0 || holidays.has(date));
        cell.classList.toggle('is-sat', day.getDay() === 6);
        cell.classList.toggle('is-today', date === today);
        cell.classList.toggle('is-selected', date === selectedDate);
        cell.setAttribute('aria-label', `${day.getMonth() + 1}月${day.getDate()}日${holidays.get(date) ? `（${holidays.get(date)}）` : ''}`);
        return cell;
    }));
}
