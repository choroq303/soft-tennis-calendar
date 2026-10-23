// ==========================================
// カレンダー（FullCalendar）の設定と、予定カードの表示
// ==========================================
import { statusIconSvg, STATUS_ORDER } from './icons.js';
import { getReservationStatusLabel } from './reservationStatus.js';
import { toDateString } from './dates.js';

/**
 * カレンダーを作って表示する
 * @param {HTMLElement} element - カレンダーを表示する要素
 * @param {{ onMenuClick: Function, onDateClick: Function, onEventClick: Function, onAddClick: Function }} handlers
 * @param {Map<string, string>} holidays - 祝日（'YYYY-MM-DD' → 祝日名。js/holidays.js）
 */
export function createCalendar(element, handlers, holidays) {
    const calendar = new FullCalendar.Calendar(element, {
        locale: 'ja',
        initialView: 'dayGridMonth',

        // ---- 日本語にする文言 ----
        // 日付・曜日は locale で日本語になるが、次の文言は FullCalendar の日本語データを読み込んでいないため英語のままになる。
        // 画面に出るもの（予定なし）と、読み上げ・長押しで出るもの（ボタンの説明など）を、ここで日本語にする
        noEventsText: 'この月の練習はありません',
        buttonHints: { prev: '前の月', next: '次の月' },
        moreLinkHint: (count) => `ほかの練習 ${count}件を見る`,
        closeHint: '閉じる',
        // リスト表示の表の見出し（画面には出ず、読み上げで使われる）
        timeHint: '時間',
        eventHint: '練習',
        height: '100%',

        // ---- セルの大きさをそろえる ----
        // 月によって行数が変わらないよう常に6週分を表示し、各週の行を画面の高さで均等に分ける
        fixedWeekCount: true,
        expandRows: true,

        // ---- 1日に表示するカードは1件まで ----
        // 2件以上ある日は、カードの下に「+N」を出し、タップでその日の全予定をポップアップ表示する
        // （見た目は css/calendar.css の 5.）。
        // true にするとセルの高さから自動計算するが、セル内を絶対配置にしている影響で
        // 高さを正しく測れず、カードが1件も出なくなることがあるため件数で固定している
        dayMaxEvents: 1,
        // 文字だけを少し下げて上下の真ん中に見せるため、span で包む（css/calendar.css の .more-link-text）
        moreLinkContent: (arg) => ({ html: `<span class="more-link-text">+${arg.num}</span>` }),

        // ---- ツールバー ----
        headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next gridToggle,listToggle menu'
        },
        customButtons: {
            // 月表示とリスト表示の切り替え（トグルスイッチの見た目。css/calendar.css の 2.）
            // text は透明にしてアイコンを出している（読み上げでは text が読まれるので日本語にする）
            gridToggle: { text: '月表示', hint: '月表示', click: () => calendar.changeView('dayGridMonth') },
            listToggle: { text: 'リスト表示', hint: 'リスト表示', click: () => calendar.changeView('listMonth') },
            // ヘッダーがないので、メニュー（⋯）もツールバーに置く
            menu: { text: 'メニュー', hint: 'メニュー', click: (event, button) => handlers.onMenuClick(event, button) }
        },
        // 表示を切り替えたら、トグルの「選んでいる側」を付け替える
        datesSet: (arg) => {
            element.querySelector('.fc-gridToggle-button')?.classList.toggle('is-active', arg.view.type === 'dayGridMonth');
            element.querySelector('.fc-listToggle-button')?.classList.toggle('is-active', arg.view.type === 'listMonth');
        },

        // 「3日」→「3」（セルが狭いので「日」を省く）
        dayCellContent: (arg) => arg.dayNumberText.replace('日', ''),
        // 祝日は日付を赤くする（css/calendar.css の .fc-day-holiday）
        dayCellClassNames: (arg) => (holidays.has(toDateString(arg.date)) ? ['fc-day-holiday'] : []),
        eventContent: (arg) => ({ domNodes: [createEventCard(arg.event, arg.view.type.startsWith('list'))] }),

        // 日付の右側に「＋」（予定の新規登録）ボタンを置く。表示するのは「練習管理」画面のときだけ（css/calendar.css）
        dayCellDidMount: (arg) => {
            if (arg.view.type !== 'dayGridMonth') return;
            const date = arg.el.dataset.date; // 'YYYY-MM-DD'
            arg.el.querySelector('.fc-daygrid-day-top')?.appendChild(createAddButton(() => handlers.onAddClick(date)));
        },

        dateClick: handlers.onDateClick,
        eventClick: handlers.onEventClick
    });

    calendar.render();
    return calendar;
}

function createAddButton(onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day-add-button';
    button.setAttribute('aria-label', 'この日に練習を追加');
    button.textContent = '+';
    button.addEventListener('click', onClick);
    return button;
}

/**
 * 予定カード
 *   月表示：施設の省略名／時刻／〇・△・×の人数（縦に並べる）
 *   リスト表示：時刻とステータス／施設の正式名称（コート）／人数（横に並べる）／備考
 *     （FullCalendar 標準の表の時刻・丸は隠し、月表示と同じカードを1件ずつ並べる。css/calendar.css の 6.）
 *   キャンセルの予定：人数の代わりに「キャンセル」と出す（施設名・時刻は取り消し線、全体を薄く）
 *   備考がある予定：右下にメモのアイコン（月表示。キャンセルの予定には出さない。リスト表示は備考そのものを出す）
 * 色は予定ステータスのクラス（is-confirmed など）で決まる（css/calendar.css の 4.）
 */
function createEventCard(event, isListView) {
    const props = event.extendedProps;
    const isCancelled = props.reservationStatus === 'cancelled';

    const card = document.createElement('div');
    card.className = `event-card is-${props.reservationStatus}${isListView ? ' event-card--list' : ''}`;

    if (isListView) {
        card.appendChild(createListHeader(props));
        card.appendChild(createTextRow(event.title, 'event-location'));
    } else {
        card.appendChild(createLocationRow(props.locationShortName, props.locationName));
        card.appendChild(createTimeRow(props.startTime, props.endTime));
    }

    if (!isCancelled) {
        card.appendChild(createStatusRow(props.counts, props.myStatus));
    } else if (!isListView) {
        // 月表示は狭くてラベルを置けないので、人数の代わりに「キャンセル」と出す（リスト表示は上段のラベルでわかる）
        card.appendChild(createTextRow(getReservationStatusLabel('cancelled'), 'event-cancelled-label'));
    }

    if (props.note) {
        if (isListView) card.appendChild(createTextRow(props.note, 'event-note'));
        else if (!isCancelled) card.appendChild(createNoteMark());
    }
    return card;
}

// 備考があることを示す小さなメモのアイコン（カードの右下に置く）
function createNoteMark() {
    const mark = document.createElement('span');
    mark.className = 'event-note-mark';
    mark.setAttribute('aria-label', '備考あり');
    mark.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z"/><path d="M9 9h6M9 13h3"/></svg>';
    return mark;
}

// リスト表示のカードの上段：「19:00 ～ 21:00」と予定ステータスのラベル（開催未定／開催決定／キャンセル）
function createListHeader(props) {
    const header = document.createElement('div');
    header.className = 'event-list-header';

    const time = document.createElement('span');
    time.className = 'event-list-time';
    time.textContent = `${props.startTime} ～ ${props.endTime}`;

    const label = document.createElement('span');
    label.className = `event-status-label is-${props.reservationStatus}`;
    label.textContent = getReservationStatusLabel(props.reservationStatus);

    header.append(time, label);
    return header;
}

function createTextRow(text, className) {
    const row = document.createElement('div');
    row.className = `event-row ${className}`;
    row.textContent = text;
    return row;
}

// 施設名は省略名と正式名称の両方を入れておき、セル内では省略名、
// 「+N」のポップアップ（横幅に余裕がある）では正式名称を CSS で表示する
function createLocationRow(shortName, fullName) {
    const row = document.createElement('div');
    row.className = 'event-row event-location';

    const short = document.createElement('span');
    short.className = 'event-location-short';
    short.textContent = shortName;

    const full = document.createElement('span');
    full.className = 'event-location-full';
    full.textContent = fullName;

    row.append(short, full);
    return row;
}

// 時刻は「19-21」の1行版と「19:00／～21:00」の2行版の両方を入れておき、
// セルの高さに応じて CSS（コンテナクエリ）でどちらかを表示する
function createTimeRow(startTime, endTime) {
    const row = document.createElement('div');
    row.className = 'event-row event-time';

    const short = document.createElement('span');
    short.className = 'event-time-short';
    short.textContent = `${formatShortTime(startTime)}-${formatShortTime(endTime)}`;

    const long = document.createElement('span');
    long.className = 'event-time-long';
    const start = document.createElement('span');
    start.textContent = startTime;
    const end = document.createElement('span');
    end.textContent = `～${endTime}`;
    long.append(start, end);

    row.append(short, long);
    return row;
}

// 19:00 → 19、19:30 → 19:30（セルが狭いので「ちょうど」の時刻は分を省く）
function formatShortTime(time) {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    return minute === '00' ? String(Number(hour)) : `${Number(hour)}:${minute}`;
}

// 〇・△・× と人数。自分の回答はその回答の色の帯で囲み、それ以外のアイコンは灰色（css/calendar.css）
function createStatusRow(counts, myStatus) {
    const row = document.createElement('div');
    row.className = 'event-row event-status';

    STATUS_ORDER.forEach(status => {
        const item = document.createElement('span');
        // 自分の回答は、その回答の色の帯で囲む（css/calendar.css の .is-my-choice）
        item.className = status === myStatus ? `event-status-item is-my-choice is-${status}` : 'event-status-item';
        item.insertAdjacentHTML('afterbegin', statusIconSvg(status));

        const count = document.createElement('span');
        count.textContent = counts[status];
        item.appendChild(count);
        row.appendChild(item);
    });
    return row;
}
