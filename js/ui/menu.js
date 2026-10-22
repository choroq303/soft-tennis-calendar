// ==========================================
// メニュー（☰）と画面の切り替え
// 画面は3つ：練習日程（view-calendar）／予定の追加・編集（view-schedule-edit）／施設管理（view-locations）
// ==========================================

const menu = document.getElementById('menu');
let currentView = 'view-calendar';

export function getCurrentView() {
    return currentView;
}

/**
 * メニューを押したボタンの真下（右端揃え）に開く／閉じる
 * カレンダーのツールバーの ☰ と、施設管理画面の ☰ の両方から呼ばれる
 */
export function toggleMenu(event, button) {
    event.stopPropagation(); // 下の「画面のどこかをタップしたら閉じる」がすぐ動かないようにする
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.classList.toggle('is-open');
}

/**
 * メニューの項目と ☰ ボタンを使えるようにする
 * @param {(viewId: string) => void} onViewChange - 画面を切り替えた直後に呼ばれる
 */
export function setupMenu(onViewChange) {
    document.querySelectorAll('.js-menu-button').forEach(button => {
        button.addEventListener('click', (event) => toggleMenu(event, button));
    });
    document.addEventListener('click', () => menu.classList.remove('is-open'));

    menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            showView(item.dataset.view);
            onViewChange(item.dataset.view);
        });
    });
}

function showView(viewId) {
    currentView = viewId;
    // 管理メニューの画面（練習日程以外）では、テーマの色をアクア系に切り替える（css/theme.css）
    document.body.dataset.mode = viewId === 'view-calendar' ? 'member' : 'admin';
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('is-active', item.dataset.view === viewId);
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('is-active', panel.id === viewId);
    });
    menu.classList.remove('is-open');
}
