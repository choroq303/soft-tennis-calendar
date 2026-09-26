// ベースとなるSVGの形（パスや要素）
const SHAPE_OK = '<circle cx="12" cy="12" r="9"></circle>';
const SHAPE_PEN = '<polygon points="12,2.5 20,17.5 4,17.5"></polygon>';
const SHAPE_NG = '<line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line>';

// ステータス行を作る関数（自分の回答ならカラー、違えば灰色にする）
function createStatusRow(shapeHtml, count, statusKey, className, myStatus) {
    const row = document.createElement('div');
    const isMine = (myStatus === statusKey);

    // クラスに is-my-choice を付与（行のハイライト用）
    row.className = `event-row ${className} ${isMine ? 'is-my-choice' : ''}`;

    // 色の決定：未回答は一律灰色、自分の回答ならそれぞれの専用カラー
    let strokeColor = '#9ca3af'; // 落ち着いた灰色
    if (isMine) {
        if (statusKey === 'ok') strokeColor = '#059669';       // 緑
        else if (statusKey === 'pending') strokeColor = '#d97706'; // 黄色
        else if (statusKey === 'ng') strokeColor = '#dc2626';      // 赤
    }

    // SVGタグを組み立て
    const svgHtml = `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${shapeHtml}</svg>`;

    const wrap = document.createElement('span');
    wrap.className = 'status-icon-wrap';
    wrap.insertAdjacentHTML('afterbegin', svgHtml);

    const countSpan = document.createElement('span');
    countSpan.textContent = count;

    row.appendChild(wrap);
    row.appendChild(countSpan);
    return row;
}

export function initCalendar(calendarEl, callbacks) {
    const calendar = new FullCalendar.Calendar(calendarEl, {
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
        eventContent: function (arg) {
            const props = arg.event.extendedProps || {};
            const location = props.location || '円山庭球場';
            const court = props.court || '4番コート';
            const startTime = props.startTime || '19:00';
            const endTime = props.endTime || '21:00';

            // 人数データと自分の回答ステータスを取得
            const counts = props.counts || { ok: 0, pending: 0, ng: 0 };
            const myStatus = props.myStatus || null; // ★ここで取得

            const container = document.createElement('div');
            container.className = 'custom-event-card';

            function createRow(text, className) {
                const row = document.createElement('div');
                row.className = `event-row ${className}`;
                row.textContent = text;
                return row;
            }

            // 7行分の要素を追加
            container.appendChild(createRow(location, 'event-location'));
            container.appendChild(createRow(court, 'event-court'));
            container.appendChild(createRow(startTime, 'event-time-start'));
            container.appendChild(createRow(endTime, 'event-time-end'));
            
            // ステータス行を追加（myStatusを渡す）
            container.appendChild(createStatusRow(SHAPE_OK, counts.ok, 'ok', 'event-status', myStatus));
            container.appendChild(createStatusRow(SHAPE_PEN, counts.pending, 'pending', 'event-status', myStatus));
            container.appendChild(createStatusRow(SHAPE_NG, counts.ng, 'ng', 'event-status', myStatus));

            return { domNodes: [container] };
        },
        events: [],
        dateClick: callbacks.onDateClick,
        eventClick: callbacks.onEventClick
    });

    calendar.render();
    return calendar;
}