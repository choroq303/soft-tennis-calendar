document.addEventListener('DOMContentLoaded', async function () {
    // 時間のドラムピッカーの項目を生成
    generateDrumTimeOptions();

    let currentView = 'calendar-view';

    // ==========================================
    // 1. カレンダー用のDOM要素を動的に1つだけ作る
    // ==========================================
    const calendarEl = document.createElement('div');
    calendarEl.id = 'calendar';
    calendarEl.style.width = '100%';
    calendarEl.style.height = '100%';

    // 初期表示の画面（calendar-view）の中にあるスロットに配置する
    const initialSlot = document.querySelector('#calendar-view .calendar-slot');
    if (initialSlot) {
        initialSlot.appendChild(calendarEl);
    }


    // ==========================================
    // 2. カレンダーの初期化・設定
    // ==========================================
    var calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'ja',
        initialView: 'dayGridMonth',
        fixedWeekCount: false,
        headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next gridToggle,listToggle'
        },
        customButtons: {
            gridToggle: {
                text: 'grid',
                click: function () { calendar.changeView('dayGridMonth'); }
            },
            listToggle: {
                text: 'list',
                click: function () { calendar.changeView('listMonth'); }
            }
        },
        height: '100%',
        dayCellContent: function (arg) {
            return arg.dayNumberText.replace('日', '');
        },

        // イベントカードのカスタマイズ
        eventContent: function (arg) {
            const props = arg.event.extendedProps;
            const location = props.location || '円山庭球場';
            const court = props.court || '4番コート';

            // 👇 【変更1】startTime と endTime を結合して時間文字列を作る
            const startTime = props.startTime || '19:00';
            const endTime = props.endTime || '21:00';
            const time = `${startTime}～${endTime}`;

            const status = props.status || '〇6 △4 ×10';

            const container = document.createElement('div');
            container.className = 'custom-event-card';

            function createRow(text, className) {
                const row = document.createElement('div');
                row.className = `event-row ${className}`;
                row.textContent = text;
                return row;
            }

            container.appendChild(createRow(location, 'event-location'));
            container.appendChild(createRow(court, 'event-court'));
            container.appendChild(createRow(time, 'event-time'));
            container.appendChild(createRow(status, 'event-status'));

            return { domNodes: [container] };
        },

        events: [],

        // ── 日付を空白（新規作成）でタップしたとき ──
        dateClick: function (info) {
            if (currentView === 'admin-event') {
                const adminModal = document.getElementById('admin-modal');

                // タップした日付をセット
                const dateDisplay = document.getElementById('admin-display-date');
                if (dateDisplay) {
                    dateDisplay.textContent = info.dateStr;
                }

                // 新規作成なので入力欄はクリアしておく
                const locInput = document.getElementById('admin-input-location');
                if (locInput) locInput.value = '';

                const courtInput = document.getElementById('admin-input-court');
                if (courtInput) courtInput.value = '';

                // 【修正】時間管理用のフィールドや表示テキストを初期化
                const timeText = document.getElementById('admin-display-time-text');
                if (timeText) timeText.textContent = '19:00 ～ 21:00'; // 初期値など

                const timeHidden = document.getElementById('admin-input-time');
                if (timeHidden) timeHidden.value = '19:00～21:00';

                if (adminModal) adminModal.classList.add('active');
            } else {
                console.log('カレンダー画面で日付が選択されました:', info.dateStr);
            }
        },

        // ── イベント（予定）をタップしたとき ──
        eventClick: function (info) {
            if (currentView === 'admin-event') {
                // 【予約管理画面】にいるなら、管理者用の編集モーダルを開く
                const adminModal = document.getElementById('admin-modal');
                const titleEl = document.getElementById('admin-modal-title');
                if (titleEl) titleEl.textContent = `${info.event.title} の編集`;
                if (adminModal) adminModal.classList.add('active');

            } else {
                // 【カレンダー画面】にいるなら、利用者用の出欠確認モーダルを開く
                const userModal = document.getElementById('user-modal');
                const props = info.event.extendedProps;

                // モーダル内のテキストを書き換え
                const titleEl = document.getElementById('modal-title');
                if (titleEl) titleEl.textContent = info.event.title;

                // ... (他の場所や時間の書き換え処理) ...

                if (userModal) userModal.classList.add('active');
            }
        }
    });

    calendar.render();

    fetchAndRenderEvents(calendar);

    window.myCalendar = calendar;


    // ==========================================
    // 3. モーダル・ボタンのイベント制御
    // ==========================================
    const userModal = document.getElementById('user-modal');
    const adminModal = document.getElementById('admin-modal');

    const userModalCloseBtn = document.getElementById('modal-close-btn'); // 利用者用閉じるボタン
    const adminModalCloseBtn = document.getElementById('admin-modal-close'); // 管理者用キャンセルボタン
    const attButtons = document.querySelectorAll('.att-btn');

    // --- 利用者用モーダルを閉じる ---
    if (userModalCloseBtn && userModal) {
        userModalCloseBtn.addEventListener('click', function () {
            userModal.classList.remove('active');
        });
    }

    if (userModal) {
        userModal.addEventListener('click', function (e) {
            if (e.target === userModal) {
                userModal.classList.remove('active');
            }
        });
    }

    // --- 管理者用モーダルを閉じる ---
    if (adminModalCloseBtn && adminModal) {
        adminModalCloseBtn.addEventListener('click', function () {
            adminModal.classList.remove('active');
        });
    }

    if (adminModal) {
        adminModal.addEventListener('click', function (e) {
            if (e.target === adminModal) {
                adminModal.classList.remove('active');
            }
        });
    }

    // --- 出欠ボタンの切り替え（利用者用） ---
    attButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            attButtons.forEach(b => b.className = b.className.replace(/selected-\w+/g, '').trim());
            const status = this.getAttribute('data-status');
            if (status === 'ok') this.classList.add('selected-ok');
            if (status === 'pen') this.classList.add('selected-pen');
            if (status === 'ng') this.classList.add('selected-ng');

            // TODO: ここにGASへの出欠送信処理を追加していく
        });
    });

    // ==========================================
    // 時間のドラムピッカー用の項目を自動生成する関数
    // ==========================================
    function generateDrumTimeOptions() {
        // HTML側で用意するドラムのリスト要素を取得
        const startDrum = document.querySelector('.start-drum');
        const endDrum = document.querySelector('.end-drum');

        if (!startDrum || !endDrum) return;

        // 既存の中身をクリア（重複生成を防ぐため）
        startDrum.innerHTML = '';
        endDrum.innerHTML = '';

        // 0時〜23時までループして項目を作成
        for (let hour = 0; hour < 24; hour++) {
            const hourStr = String(hour).padStart(2, '0');
            const timeValue = `${hourStr}:00`;

            // 開始用アイテムの作成
            const itemStart = document.createElement('div');
            itemStart.className = 'drum-item';
            itemStart.textContent = timeValue;
            itemStart.dataset.time = timeValue;
            startDrum.appendChild(itemStart);

            // 終了用アイテムの作成
            const itemEnd = document.createElement('div');
            itemEnd.className = 'drum-item';
            itemEnd.textContent = timeValue;
            itemEnd.dataset.time = timeValue;
            endDrum.appendChild(itemEnd);
        }
    }


    // ==========================================
    // 4. ハンバーガーメニュー & 画面切り替えの制御
    // ==========================================
    const menuBtn = document.getElementById('menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const menuItems = document.querySelectorAll('.menu-item');
    const viewPanels = document.querySelectorAll('.view-panel');

    if (menuBtn) {
        menuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
    }

    document.addEventListener('click', function () {
        if (dropdownMenu) dropdownMenu.classList.remove('show');
    });

    menuItems.forEach(item => {
        item.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const menuText = this.textContent;

            // ★ヘッダーのタイトルを動的に書き換える
            const headerTitle = document.getElementById('header-title');
            headerTitle.textContent = `ソフトテニスカレンダー - ${menuText}`;

            currentView = targetId;
            console.log('現在の画面:', currentView);

            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            viewPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === targetId) {
                    panel.classList.add('active');

                    // ★【ここがポイント】
                    // 切り替わった先のパネルに .calendar-slot があれば、
                    // そこにカレンダー要素（calendarEl）を移動させる！
                    const slot = panel.querySelector('.calendar-slot');
                    if (slot && calendarEl) {
                        slot.appendChild(calendarEl);
                    }

                    // カレンダーのサイズ崩れを防ぐために再計算
                    if (window.myCalendar) {
                        window.myCalendar.updateSize();
                    }
                }
            });

            const dropdownMenu = document.getElementById('dropdown-menu');
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        });
    });

    const timeTrigger = document.getElementById('time-picker-trigger');
    const timeModal = document.getElementById('time-picker-modal');
    const timeModalCancel = document.getElementById('time-modal-cancel');
    const timeModalConfirm = document.getElementById('time-modal-confirm');

    const displayTimeText = document.getElementById('admin-display-time-text');
    const inputTimeHidden = document.getElementById('admin-input-time');

    // 1. 管理者モーダルの時間欄をタップしたら、時間選択サブダイアログを開く
    if (timeTrigger && timeModal) {
        timeTrigger.addEventListener('click', function () {
            timeModal.classList.remove('hidden');
            // 開いたときにドラムの選択肢を生成
            generateDrumTimeOptions();
        });
    }

    // 2. キャンセルボタンでサブダイアログを閉じる
    if (timeModalCancel && timeModal) {
        timeModalCancel.addEventListener('click', function () {
            timeModal.classList.add('hidden');
        });
    }

    // 3. 決定ボタンを押したとき、選ばれた時間を計算して管理者モーダル側に反映する
    if (timeModalConfirm && timeModal) {
        timeModalConfirm.addEventListener('click', function () {
            const startDrum = document.querySelector('.start-drum');
            const endDrum = document.querySelector('.end-drum');

            if (startDrum && endDrum) {
                const itemHeight = 40; // drum-item の高さ
                const startIndex = Math.round(startDrum.scrollTop / itemHeight);
                const endIndex = Math.round(endDrum.scrollTop / itemHeight);

                const startItems = startDrum.querySelectorAll('.drum-item');
                const endItems = endDrum.querySelectorAll('.drum-item');

                const startTime = startItems[startIndex]?.dataset.time || '19:00';
                const endTime = endItems[endIndex]?.dataset.time || '21:00';

                const selectedTimeStr = `${startTime} ～ ${endTime}`;

                // 管理者モーダル側の表示と隠しフィールドを更新
                if (displayTimeText) displayTimeText.textContent = selectedTimeStr;
                if (inputTimeHidden) inputTimeHidden.value = selectedTimeStr;
            }

            // サブダイアログを閉じる
            timeModal.classList.add('hidden');
        });
    }
});

// GASから予約データを取得してカレンダーに反映させる関数
async function fetchAndRenderEvents(calendarInstance) {
    showLoading(); // 👈 【仕込み①】取得が始まったらくるくるを表示！

    try {
        const response = await fetch(CONFIG.GAS_API_URL, {
            method: 'POST', 
            headers: {
                'Content-Type': 'text/plain;charset=utf-8' 
            },
            body: JSON.stringify({ action: 'fetch' }) 
        });

        const result = await response.json();

        console.log('【デバッグ】GASからの生レスポンス:', result);

        if (result.status === 'success') {
            // 既存のイベントをすべてクリアして新しいイベント群をセット
            calendarInstance.removeAllEvents();

            // FullCalendarに一括追加
            result.events.forEach(event => {
                calendarInstance.addEvent(event);
            });

            console.log('カレンダーの予定を更新しました', result.events);
        } else {
            console.error('予定の取得に失敗しました:', result.message);
        }
    } catch (error) {
        console.error('通信エラー（予定取得）:', error);
    } finally {
        hideLoading(); // 👈 【仕込み②】成功しても失敗しても、通信が終わったら必ずくるくるを消す！
    }
}

// 保存ボタンが押された時の処理
document.getElementById('admin-save-btn').addEventListener('click', async () => {
    // 1. フォームから入力値やIDを集める
    const eventId = document.getElementById('admin-modal').dataset.eventId || ''; // 編集時はIDが入っている想定
    const date = document.getElementById('admin-display-date').textContent.trim();
    const location = document.getElementById('admin-input-location').value.trim();
    const court = document.getElementById('admin-input-court').value.trim();

    // 時間の文字列（例: "19:00 ～ 21:00"）を start と end に分割する
    const timeText = document.getElementById('admin-display-time-text').textContent;
    const [startTime, endTime] = timeText.split('～').map(t => t.trim());

    // 送信データオブジェクトの組み立て
    const payload = {
        action: 'save',
        id: eventId,
        date: date,
        location: location,
        court: court,
        start: startTime || '',
        end: endTime || ''
    };

    // 簡易バリデーション
    if (!location || !court) {
        alert('場所とコートを入力してください。');
        return;
    }

    try {
        // ボタンを無効化して二重送信を防ぐなどの処理を入れるとなお良し
        const response = await fetch(CONFIG.GAS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8' // GASへのPOSTでCORSのプリフライトを回避しやすい書き方
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('保存しました！');
            // モーダルを閉じる
            closeAdminModal();
            // カレンダーを再描画して最新のデータを反映させる
            reloadCalendarEvents();
        } else {
            alert('保存に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('通信エラー:', error);
        error.message
        alert('通信に失敗しました。');
    }
});


// 削除ボタンが押された時の処理
document.getElementById('admin-delete-btn').addEventListener('click', async () => {
    const eventId = document.getElementById('admin-modal').dataset.eventId || '';

    if (!eventId) {
        alert('削除対象の予定が見つかりません。');
        return;
    }

    if (!confirm('本当にこの予定を削除しますか？')) {
        return;
    }

    const payload = {
        action: 'delete',
        id: eventId
    };

    try {
        const response = await fetch(CONFIG.GAS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('削除しました。');
            closeAdminModal();
            reloadCalendarEvents();
        } else {
            alert('削除に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('通信エラー:', error);
        alert('通信に失敗しました。');
    }
});

// ローディングを表示する
function showLoading() {
  document.getElementById('common-loading').style.display = 'flex';
}

// ローディングを非表示にする
function hideLoading() {
  document.getElementById('common-loading').style.display = 'none';
}