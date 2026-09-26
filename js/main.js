import { fetchEvents, saveAttendance, saveAdminEvent, deleteAdminEvent } from './api.js';
import { generateDrumTimeOptions, setupModals } from './ui.js';
import { initCalendar } from './calendar.js';

document.addEventListener('DOMContentLoaded', async function () {
    generateDrumTimeOptions();
    setupModals();

    let currentView = 'calendar-view';

    // カレンダー要素の動的生成
    const calendarEl = document.createElement('div');
    calendarEl.id = 'calendar';
    calendarEl.style.width = '100%';
    calendarEl.style.height = '100%';

    const initialSlot = document.querySelector('#calendar-view .calendar-slot');
    if (initialSlot) initialSlot.appendChild(calendarEl);

    // カレンダー初期化
    const calendar = initCalendar(calendarEl, {
        onDateClick: (info) => {
            if (currentView === 'admin-event') {
                const adminModal = document.getElementById('admin-modal');
                const dateDisplay = document.getElementById('admin-display-date');
                if (dateDisplay) dateDisplay.textContent = info.dateStr;

                const locInput = document.getElementById('admin-input-location');
                if (locInput) locInput.value = '';
                const courtInput = document.getElementById('admin-input-court');
                if (courtInput) courtInput.value = '';

                const timeText = document.getElementById('admin-display-time-text');
                if (timeText) timeText.textContent = '19:00 ～ 21:00';
                const timeHidden = document.getElementById('admin-input-time');
                if (timeHidden) timeHidden.value = '19:00～21:00';

                delete adminModal.dataset.eventId; // 新規作成時はIDをクリア
                if (adminModal) adminModal.classList.add('active');
            } else {
                console.log('カレンダー画面で日付選択:', info.dateStr);
            }
        },
        onEventClick: (info) => {
            if (currentView === 'admin-event') {
                const adminModal = document.getElementById('admin-modal');
                const titleEl = document.getElementById('admin-modal-title');
                if (titleEl) titleEl.textContent = `${info.event.title} の編集`;

                // 編集対象のIDを保持
                adminModal.dataset.eventId = info.event.id || '';

                if (adminModal) adminModal.classList.add('active');
            } else {
                const userModal = document.getElementById('user-modal');
                const props = info.event.extendedProps;
                userModal.dataset.reservationId = info.event.id || props.id || '';
                userModal.dataset.myStatus = props.myStatus || '';

                const titleEl = document.getElementById('modal-title');
                if (titleEl) titleEl.textContent = info.event.title;
                const locEl = document.getElementById('modal-location');
                if (locEl) locEl.textContent = props.location || '-';
                const courtEl = document.getElementById('modal-court');
                if (courtEl) courtEl.textContent = props.court || '-';
                const timeEl = document.getElementById('modal-time');
                if (timeEl) {
                    const startTime = props.startTime || '19:00';
                    const endTime = props.endTime || '21:00';
                    timeEl.textContent = `${startTime} ～ ${endTime}`;
                }

                const attButtons = userModal.querySelectorAll('.att-btn');
                attButtons.forEach(btn => {
                    btn.classList.remove('selected-ok', 'selected-pen', 'selected-ng');

                    if (props.myStatus === 'ok' && btn.dataset.status === 'ok') {
                        btn.classList.add('selected-ok');
                    } else if (props.myStatus === 'pending' && btn.dataset.status === 'pending') {
                        btn.classList.add('selected-pen');
                    } else if (props.myStatus === 'ng' && btn.dataset.status === 'ng') {
                        btn.classList.add('selected-ng');
                    }
                });

                if (userModal) userModal.classList.add('active');
            }
        }
    });

    window.myCalendar = calendar;

    // カレンダーデータの取得・再描画
    async function reloadEvents(message = 'カレンダーのデータを同期中...') {
        showLoading(message);
        try {
            // ① 通信にかかる時間を計測開始
            console.time('【計測】API通信時間');
            const updatedEvents = await fetchEvents();
            console.timeEnd('【計測】API通信時間'); // ここで何秒かかったか出る

            if (Array.isArray(updatedEvents)) {
                // ② 描画（カレンダー更新）にかかる時間を計測開始
                console.time('【計測】カレンダー描画時間');
                calendar.removeAllEvents();
                updatedEvents.forEach(ev => calendar.addEvent(ev));
                console.timeEnd('【計測】カレンダー描画時間'); // ここで何秒かかったか出る
            }
        } catch (error) {
            console.error('イベントの再取得に失敗しました:', error);
            alert('データの同期に失敗しました。');
        } finally {
            hideLoading();
        }
    }

    // ★ 初回イベントデータのロード（エラーで全体が止まらないようガード）
    await reloadEvents('カレンダーを読み込んでいます...');

    // 出欠ボタンのイベント設定
    const attButtons = document.querySelectorAll('.att-btn');
    attButtons.forEach(btn => {
        btn.addEventListener('click', async function () {
            const userModal = document.getElementById('user-modal');
            const reservationId = userModal.dataset.reservationId;
            const clickedStatus = this.getAttribute('data-status'); // 'ok', 'pending', 'ng' など

            if (!reservationId || !clickedStatus) {
                alert('予定の選択情報が正しくありません。');
                return;
            }

            // モニター用：現在の自分のステータス
            const currentStatus = userModal.dataset.myStatus || '';

            // すでに選ばれているボタンをもう一度押した場合は「解除（'none'）」にする
            let statusValue = clickedStatus;
            if (currentStatus === clickedStatus) {
                statusValue = 'none';
            }

            // 見た目の選択状態をいったんリセット
            attButtons.forEach(b => b.className = b.className.replace(/selected-\w+/g, '').trim());

            if (statusValue === 'ok') this.classList.add('selected-ok');
            if (statusValue === 'pending') this.classList.add('selected-pen');
            if (statusValue === 'ng') this.classList.add('selected-ng');

            try {
                // LIFFプロファイル取得の安全化
                let userName = 'ゲストユーザー';
                let userId = 'dummy_user_id';
                if (typeof liff !== 'undefined' && liff.isInClient()) {
                    try {
                        userId = liff.getDecodedAccessToken()?.sub || userId;
                        const profile = await liff.getProfile();
                        userName = profile.displayName || userName;
                    } catch (liffErr) {
                        console.warn('LIFF情報の取得に失敗しました:', liffErr);
                    }
                }

                const payload = {
                    action: 'saveAttendance',
                    reservations_id: reservationId,
                    user_id: userId,
                    user_name: userName,
                    status: statusValue
                };

                console.log('送信するpayload:', payload);

                const result = await saveAttendance(payload);
                showLoading('出欠状況を反映中...');
                if (result && result.status === 'success') {
                    console.log('出欠登録成功');

                    // 1. モーダル側の保持ステータスを更新
                    userModal.dataset.myStatus = statusValue === 'none' ? '' : statusValue;

                    // 2. モーダルを閉じる
                    if (userModal) {
                        userModal.classList.remove('active');
                    }

                    // 3. 安全にカレンダーを再読み込み
                    await reloadEvents('最新のデータを反映中...');

                } else {
                    alert('保存に失敗しました: ' + (result?.message || '不明なエラー'));
                }
            } catch (error) {
                console.error('出欠保存エラー:', error);
                alert('通信に失敗しました。もう一度お試しください。');
            }
        });
    });

    // 画面切り替え（ハンバーガーメニュー）の制御
    const menuBtn = document.getElementById('menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const menuItems = document.querySelectorAll('.menu-item');
    const viewPanels = document.querySelectorAll('.view-panel');

    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
    }
    document.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.classList.remove('show');
    });

    menuItems.forEach(item => {
        item.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const menuText = this.textContent;
            const headerTitle = document.getElementById('header-title');
            if (headerTitle) headerTitle.textContent = `ソフトテニスカレンダー - ${menuText}`;

            currentView = targetId;
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            viewPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === targetId) {
                    panel.classList.add('active');
                    const slot = panel.querySelector('.calendar-slot');
                    if (slot && calendarEl) slot.appendChild(calendarEl);
                    if (window.myCalendar) window.myCalendar.updateSize();
                }
            });
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        });
    });

    // 管理者モーダルの保存・削除ボタン
    const saveBtn = document.getElementById('admin-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const adminModal = document.getElementById('admin-modal');
            const eventId = adminModal.dataset.eventId || '';
            const date = document.getElementById('admin-display-date').textContent.trim();
            const location = document.getElementById('admin-input-location').value.trim();
            const court = document.getElementById('admin-input-court').value.trim();
            const timeText = document.getElementById('admin-display-time-text').textContent;
            const [startTime, endTime] = timeText.split('～').map(t => t.trim());

            if (!location || !court) {
                alert('場所とコートを入力してください。');
                return;
            }

            try {
                const result = await saveAdminEvent({
                    action: 'save',
                    id: eventId,
                    date, location, court,
                    start: startTime ? `${startTime}:00` : '', // 例: "19:00:00"
                    end: endTime ? `${endTime}:00` : ''        // 例: "21:00:00"
                });

                if (result && result.status === 'success') {
                    alert('保存しました！');
                    adminModal.classList.remove('active');
                    await reloadEvents('予定を更新しています...');
                } else {
                    alert('保存に失敗しました: ' + (result?.message || '不明なエラー'));
                }
            } catch (e) {
                console.error('管理者保存エラー:', e);
                alert('通信に失敗しました。');
            }
        });
    }

    const deleteBtn = document.getElementById('admin-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const adminModal = document.getElementById('admin-modal');
            const eventId = adminModal.dataset.eventId || '';
            if (!eventId) {
                alert('削除対象の予定が見つかりません。');
                return;
            }
            if (!confirm('本当にこの予定を削除しますか？')) return;

            try {
                const result = await deleteAdminEvent({ action: 'delete', id: eventId });
                if (result && result.status === 'success') {
                    alert('削除しました。');
                    adminModal.classList.remove('active');
                    await reloadEvents('予定を更新しています...');
                } else {
                    alert('削除に失敗しました: ' + (result?.message || '不明なエラー'));
                }
            } catch (e) {
                console.error('管理者削除エラー:', e);
                alert('通信に失敗しました。');
            }
        });
    }
});

// ローディングを表示する（テキストを動的に変えられる）
function showLoading(message = '読み込み中...') {
    const loadingEl = document.getElementById('common-loading');
    const textEl = document.getElementById('loading-text');
    if (textEl) textEl.textContent = message;
    if (loadingEl) loadingEl.style.display = 'flex';
}

// ローディングを隠す
function hideLoading() {
    const loadingEl = document.getElementById('common-loading');
    if (loadingEl) loadingEl.style.display = 'none';
}