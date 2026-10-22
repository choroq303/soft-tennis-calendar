// ==========================================
// アプリの起動処理
// 各画面（screens/）と部品（ui/）を組み合わせるだけで、細かい処理はそれぞれのファイルにある
// ==========================================
import { initializeLiff } from './liff.js';
import { fetchReservations } from './api.js';
import { loadHolidays } from './holidays.js';
import { toDateString } from './dates.js';
import { createCalendar } from './calendar.js';
import { setupModalClosing } from './ui/modal.js';
import { setupDrumPicker } from './ui/drumPicker.js';
import { setupMenu, toggleMenu, getCurrentView } from './ui/menu.js';
import { withLoading, showError, showFatalError } from './ui/feedback.js';
import { setupAttendanceModal, openAttendanceModal } from './screens/attendanceModal.js';
import { setupReservationModal, openNewReservation, openEditReservation } from './screens/reservationModal.js';
import { setupLocationAdmin, reloadLocationList } from './screens/locationAdmin.js';

document.addEventListener('DOMContentLoaded', start);

async function start() {
    // LINE ログインと祝日の読み込みは同時に進める
    let user, holidays;
    try {
        [user, holidays] = await Promise.all([initializeLiff(), loadHolidays()]);
    } catch (error) {
        showFatalError('login', error);
        return;
    }
    if (!user) return; // LINE のログイン画面へ移動中

    setupModalClosing();
    setupDrumPicker();

    // ---- カレンダー ----
    // 「練習日程」と「予定の追加・編集」は同じカレンダーを使い、表示する画面へ移動させる。
    // 予定の追加・編集画面にいるときは、タップで出欠ではなく予定の登録・編集を開く
    const calendarElement = document.getElementById('calendar');
    const isEditMode = () => getCurrentView() === 'view-schedule-edit';

    const calendar = createCalendar(calendarElement, {
        onMenuClick: toggleMenu,
        // セルの空いている所をタップしたとき（「＋」ボタンを押したときは onAddClick のほうで開くので除く）
        onDateClick: (info) => {
            if (isEditMode() && !info.jsEvent.target.closest('.day-add-button')) openNewReservation(info.dateStr);
        },
        onAddClick: (date) => openNewReservation(date),
        onEventClick: (info) => {
            if (isEditMode()) openEditReservation(info.event);
            else openAttendanceModal(info.event);
        }
    }, holidays);

    // FullCalendar はウィンドウのリサイズしか検知しないので、画面切替などで枠の大きさが変わったときも描き直す
    new ResizeObserver(() => calendar.updateSize()).observe(calendarElement);

    // 予定を読み込み直す。起動時（isFirst）に失敗したら、何も表示できないので画面全体のエラーにする
    async function reloadCalendar(message, { isFirst = false } = {}) {
        try {
            const events = await withLoading(message, () => fetchReservations(user.id));
            calendar.removeAllEvents();
            events.forEach(event => calendar.addEvent(event));
        } catch (error) {
            if (isFirst) showFatalError('loadReservations', error);
            else showError('loadReservations', error, { onRetry: () => reloadCalendar(message) });
        }
    }

    // ---- 各画面 ----
    setupAttendanceModal({ user, onSaved: () => reloadCalendar('最新の出欠を反映しています...') });
    setupReservationModal({ onSaved: () => reloadCalendar('予定を更新しています...') });

    // リスト表示用の「＋ 予定を追加」：表示中の月に今日が含まれていれば今日、なければその月の1日で開く
    document.getElementById('reservation-add-button').addEventListener('click', () => {
        const { currentStart, currentEnd } = calendar.view;
        const today = new Date();
        const date = today >= currentStart && today < currentEnd ? today : currentStart;
        openNewReservation(toDateString(date));
    });
    setupLocationAdmin({ onChanged: () => reloadCalendar('予定を更新しています...') });

    setupMenu((viewId) => {
        // カレンダーを使う画面なら、カレンダーをその画面へ移す
        const slot = document.querySelector(`#${viewId} .calendar-slot`);
        if (slot) {
            slot.appendChild(calendarElement);
            calendar.updateSize();
        }
        if (viewId === 'view-locations') reloadLocationList();
    });

    await reloadCalendar('カレンダーを読み込んでいます...', { isFirst: true });
}
