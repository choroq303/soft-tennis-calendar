document.addEventListener('DOMContentLoaded', function () {
    // 1. カレンダーの初期設定
    var calendarEl = document.getElementById('calendar');

    var calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'ja',                    // 日本語化
        initialView: 'dayGridMonth',     // 月表示

        fixedWeekCount: false,

        headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next gridToggle,listToggle' // ←カンマ区切りに修正済み
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
        height: '100%',                    // 高さを自動調整

        dayCellContent: function (arg) {
            // 日付の「日」を消す
            return arg.dayNumberText.replace('日', '')
        },

        // ==========================================
        // ★ ここでイベントカードの表示を3行にカスタマイズ
        // ==========================================
        eventContent: function (arg) {
            const props = arg.event.extendedProps;

            const location = props.location || '円山庭球場';
            const court = props.court || '4番コート';
            const time = props.time || '19：00～21：00';
            const status = props.status || '〇6 △4 ×10';

            const container = document.createElement('div');
            container.className = 'custom-event-card';

            // 行を作るヘルパー（流さない普通のdiv）
            function createRow(text, className) {
                const row = document.createElement('div');
                row.className = `event-row ${className}`;
                row.textContent = text;
                return row;
            }

            // 上から順に縦に並べる
            container.appendChild(createRow(location, 'event-location'));
            container.appendChild(createRow(court, 'event-court'));
            container.appendChild(createRow(time, 'event-time'));
            container.appendChild(createRow(status, 'event-status'));

            return { domNodes: [container] };
        },

        events: [
            {
                title: '練習会',
                start: '2026-09-20',
                extendedProps: {
                    location: '円山庭球場',
                    court: '4番コート',
                    time: '19：00～21：00',
                    status: '〇6 △4 ×10'
                }
            }
        ],
        dateClick: function (info) {
            const infoArea = document.getElementById('info-area');
            if (infoArea) {
                infoArea.innerHTML = `<span class="font-bold text-success">${info.dateStr}</span> が選択されました`;
            }
        },



        eventClick: function (info) {
            const props = info.event.extendedProps;

            // モーダルのテキストにデータを埋め込む
            document.getElementById('modal-title').textContent = info.event.title;
            document.getElementById('modal-location').textContent = props.location || '円山庭球場';
            document.getElementById('modal-court').textContent = props.court || '4番コート';
            document.getElementById('modal-time').textContent = props.time || '19：00～21：00';
            document.getElementById('modal-counts').textContent = `〇${props.okCount ?? 6} △${props.penCount ?? 4} ×${props.ngCount ?? 10}`;

            // 出欠ボタンの選択状態を一旦リセット
            attButtons.forEach(b => b.className = b.className.replace(/selected-\w+/g, '').trim());

            // モーダルを表示する
            modalOverlay.classList.add('active');
        }
    });

    calendar.render();

    // DOM要素の取得
    const modalOverlay = document.getElementById('event-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const attButtons = document.querySelectorAll('.att-btn');

    // 閉じるボタンの処理
    modalCloseBtn.addEventListener('click', function () {
        modalOverlay.classList.remove('active');
    });

    // 背景タップでも閉じたい場合
    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });

    // 出欠ボタンを押したときのアクション（仮）
    attButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // いったんすべての選択状態を解除
            attButtons.forEach(b => b.className = b.className.replace(/selected-\w+/g, '').trim());

            // 押されたボタンに色をつける
            const status = this.getAttribute('data-status');
            if (status === 'ok') this.classList.add('selected-ok');
            if (status === 'pen') this.classList.add('selected-pen');
            if (status === 'ng') this.classList.add('selected-ng');

            // 【今後ここ通信処理を入れる】
            // 選択したステータス（ok/pen/ng）をバックエンドAPIに送信する処理を後々追加します
        });
    });

    // ★タブ切り替え時などにサイズを崩さないよう、グローバルに保持しておく
    window.myCalendar = calendar;


    // ==========================================
    // 2. ハンバーガーメニュー & 画面切り替えの制御
    // ==========================================
    const menuBtn = document.getElementById('menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const menuItems = document.querySelectorAll('.menu-item');
    const viewPanels = document.querySelectorAll('.view-panel');

    // ハンバーガーボタンクリックでメニューの開閉
    menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });

    // メニュー以外の場所をクリックしたら閉じる
    document.addEventListener('click', function () {
        dropdownMenu.classList.remove('show');
    });

    // メニュー項目を選択したとき
    menuItems.forEach(item => {
        item.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');

            // メニューのアクティブ表示切替
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            // 画面パネルの表示切替
            viewPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === targetId) {
                    panel.classList.add('active');

                    // カレンダー画面に戻ったとき、表示崩れを防ぐためにサイズを再計算
                    if (targetId === 'calendar-view' && window.myCalendar) {
                        window.myCalendar.updateSize();
                    }
                }
            });

            // メニューを閉じる
            dropdownMenu.classList.remove('show');
        });
    });
});