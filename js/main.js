import { fetchEvents, saveAttendance, saveAdminEvent, deleteAdminEvent, fetchLocations, saveLocation, deleteLocation } from './api.js'; import { generateDrumTimeOptions, setupModals } from './ui.js';
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
        onDateClick: async (info) => {
            if (currentView === 'admin-event') {

                const adminModal = document.getElementById('admin-modal');
                const dateDisplay = document.getElementById('admin-display-date');
                if (dateDisplay) dateDisplay.textContent = info.dateStr;

                await populateCourtSelect('');

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
            // プルダウンから選ばれたコートのIDを取得
            const locationSelect = document.getElementById('admin-input-location');
            const locationsId = locationSelect ? locationSelect.value : '';
            const courtNumber = document.getElementById('admin-input-court-number').value.trim();
            const timeText = document.getElementById('admin-display-time-text').textContent;
            const [startTime, endTime] = timeText.split('～').map(t => t.trim());

            if (!locationsId) {
                alert('場所を選択してください。');
                return;
            }

            try {
                const result = await saveAdminEvent({
                    action: 'save',
                    id: eventId,
                    date,
                    locations_id: locationsId,
                    court_number: courtNumber,
                    start: startTime ? `${startTime}` : '', // 例: "19:00:00"
                    end: endTime ? `${endTime}` : ''        // 例: "21:00:00"
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

    // ==========================================
    // 🎾 コート管理画面のロジック
    // ==========================================
    const courtModal = document.getElementById('court-modal');
    const openCourtModalBtn = document.getElementById('open-court-modal-btn');
    const courtModalClose = document.getElementById('court-modal-close');
    const courtSaveBtn = document.getElementById('court-save-btn');
    const courtModalTitle = document.getElementById('court-modal-title');

    const courtIdInput = document.getElementById('court-id');
    const courtNameInput = document.getElementById('court-input-name');
    const courtDeadlineInput = document.getElementById('court-input-deadline');
    const courtMinInput = document.getElementById('court-input-min');
    const courtTableBody = document.getElementById('court-table-body');

    // HTMLエスケープ用関数（エラー防止のためここに追加）
    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<> "']/g, (match) => {
            const escapeMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escapeMap[match];
        });
    }

    // コート一覧をロードしてテーブルに描画する関数
    async function reloadCourts() {
        if (!courtTableBody) return;
        courtTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-4">読み込み中...</td></tr>`;
        try {
            const courts = await fetchLocations(); // Supabaseからコート一覧を取得
            if (!courts || courts.length === 0) {
                courtTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-4">登録されたコートはありません</td></tr>`;
                return;
            }

            courtTableBody.innerHTML = '';
            courts.forEach(court => {
                const tr = document.createElement('tr');
                tr.className = 'hover';

                // キャンセル期限の表示成形（数値なら「○日前」、0なら「当日」など）
                let deadlineText = '-';
                if (court.cancel_deadline !== null && court.cancel_deadline !== undefined) {
                    deadlineText = court.cancel_deadline === 0 ? '当日' : court.cancel_deadline + '日前';
                }

                tr.innerHTML = `
                <td class="font-bold">${escapeHtml(court.name || '')}</td>
                <td>${deadlineText}</td>
                <td>${court.min_participants !== null && court.min_participants !== undefined ? court.min_participants + '人' : '-'}</td>
                <td class="text-right space-x-2">
                    <button class="btn btn-xs btn-outline btn-primary edit-court-btn" data-id="${court.id}">編集</button>
                    <button class="btn btn-xs btn-outline btn-error delete-court-btn" data-id="${court.id}">削除</button>
                </td>
            `;
                courtTableBody.appendChild(tr);
            });

            // 編集ボタンのイベント設定
            document.querySelectorAll('.edit-court-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const court = courts.find(c => c.id === id);
                    if (!court) return;

                    courtIdInput.value = court.id;
                    courtNameInput.value = court.name || '';

                    // プルダウンに既存の値を反映（なければデフォルトの4などを指定）
                    courtDeadlineInput.value = court.cancel_deadline !== null ? court.cancel_deadline : '4';
                    courtMinInput.value = court.min_participants !== null ? court.min_participants : '4';

                    courtModalTitle.textContent = 'コートの編集';
                    courtModal.classList.remove('hidden');
                    courtModal.style.display = 'block';
                });
            });

            // 削除ボタンのイベント設定
            document.querySelectorAll('.delete-court-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (!confirm('本当にこのコートを削除しますか？')) return;

                    try {
                        const result = await deleteLocation(id);
                        if (result && result.status === 'success') {
                            alert('コートを削除しました。');
                            await reloadCourts();
                        } else {
                            alert('削除に失敗しました: ' + (result?.message || '不明なエラー'));
                        }
                    } catch (e) {
                        console.error('コート削除エラー:', e);
                        alert('通信に失敗しました。');
                    }
                });
            });

        } catch (e) {
            console.error('コート一覧の取得に失敗:', e);
            courtTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-error py-4">データの取得に失敗しました</td></tr>`;
        }
    }

    // 「新規コート追加」ボタン
    if (openCourtModalBtn) {
        openCourtModalBtn.addEventListener('click', () => {
            console.log('✨ 新規コート追加ボタンがクリックされました！');

            if (!courtModal) {
                console.error('❌ courtModal 要素が見つかりません！');
                return;
            }

            courtIdInput.value = '';
            courtNameInput.value = '';

            // 新規登録時はデフォルト値（例: 4日前、4人）を選択状態にする
            courtDeadlineInput.value = '4';
            courtMinInput.value = '4';

            courtModalTitle.textContent = 'コートの新規登録';

            courtModal.classList.remove('hidden');
            courtModal.style.display = 'block';
        });
    } else {
        console.error('❌ openCourtModalBtn ボタン自体が見つかりません！');
    }

    // モーダルを閉じる
    if (courtModalClose) {
        courtModalClose.addEventListener('click', () => {
            courtModal.classList.add('hidden');
            courtModal.style.display = 'none';
        });
    }

    // コート保存ボタンの処理部分
    if (courtSaveBtn) {
        courtSaveBtn.addEventListener('click', async () => {
            const id = courtIdInput.value;
            const name = courtNameInput.value.trim();

            // プルダウンから選ばれた値を整数に変換
            const cancel_deadline = courtDeadlineInput.value !== '' ? parseInt(courtDeadlineInput.value, 10) : null;
            const min_participants = courtMinInput.value !== '' ? parseInt(courtMinInput.value, 10) : null;

            if (!name) {
                alert('コート名を入力してください。');
                return;
            }

            try {
                const payload = { id, name, cancel_deadline, min_participants };
                const result = await saveLocation(payload);

                if (result && result.status === 'success') {
                    alert('保存しました！');
                    courtModal.classList.add('hidden');
                    courtModal.style.display = 'none';
                    await reloadCourts();
                } else {
                    alert('保存に失敗しました: ' + (result?.message || '不明なエラー'));
                }
            } catch (e) {
                console.error('コート保存エラー:', e);
                alert('通信に失敗しました。');
            }
        });
    }

    // メニューで「コート設定」画面を開いたときに自動でデータをロードする
    menuItems.forEach(item => {
        item.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            if (targetId === 'admin-court') {
                reloadCourts(); // コート設定画面を開いた時に一覧を最新にする
            }
        });
    });
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

// 管理者用モーダルのコート選択プルダウンに、登録済みコートの選択肢を埋め込む関数
async function populateCourtSelect(selectedCourtId = '') {
    const courtSelect = document.getElementById('admin-input-location');
    if (!courtSelect) return;

    try {
        const courts = await fetchLocations(); // 登録済みコート一覧を取得

        courtSelect.innerHTML = '<option value="" disabled selected>コートを選択してください</option>';

        if (courts && courts.length > 0) {
            courts.forEach(court => {
                const option = document.createElement('option');
                option.value = court.id; // データベースのUUIDやID
                option.textContent = court.name; // コート名

                // 編集時など、すでに選択されているIDがあれば一致させる
                if (String(court.id) === String(selectedCourtId)) {
                    option.selected = true;
                }

                courtSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "コートが登録されていません";
            courtSelect.appendChild(option);
        }
    } catch (e) {
        console.error('コート一覧の取得に失敗しました:', e);
    }
}