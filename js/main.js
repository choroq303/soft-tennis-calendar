// ==========================================
// アプリの起動処理
// 各画面（screens/）と部品（ui/）を組み合わせるだけで、細かい処理はそれぞれのファイルにある
// ==========================================
import { initializeLiff } from './liff.js';
import { fetchReservations, fetchMember, registerMember, updateMemberProfile } from './api.js';
import { loadHolidays } from './holidays.js';
import { toDateString } from './dates.js';
import { createCalendar } from './calendar.js';
import { setupModalClosing } from './ui/modal.js';
import { setupDrumPicker } from './ui/drumPicker.js';
import { setupDatePicker } from './ui/datePicker.js';
import { setupMenu, toggleMenu, getCurrentView } from './ui/menu.js';
import { withLoading, showError, showFatalError, showNoticeScreen } from './ui/feedback.js';
import { setupAttendanceModal, openAttendanceModal } from './screens/attendanceModal.js';
import { setupReservationModal, openNewReservation, openEditReservation } from './screens/reservationModal.js';
import { setupLocationAdmin, reloadLocationList } from './screens/locationAdmin.js';
import { setupMemberAdmin, reloadMemberList } from './screens/memberAdmin.js';

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

    // ---- メンバーの確認 ----
    // 承認済みのメンバーだけが使える。初めて開いた人は「承認待ち」として登録する
    const member = await checkMember(user);
    if (!member) return;
    // 開発者・管理者のロールがあれば、管理メニューを出す（css/base.css の .admin-only）
    const canManage = Boolean(member.is_developer || member.is_admin);
    document.body.classList.toggle('can-manage', canManage);

    setupModalClosing();
    setupDrumPicker();
    setupDatePicker(holidays);

    // ---- カレンダー ----
    // 「練習日程」と「練習管理」は同じカレンダーを使い、表示する画面へ移動させる。
    // 練習管理画面にいるときは、タップで出欠ではなく予定の登録・編集を開く
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
    async function reloadCalendar({ isFirst = false } = {}) {
        try {
            const events = await withLoading(() => fetchReservations(user.id));
            calendar.removeAllEvents();
            events.forEach(event => calendar.addEvent(event));
        } catch (error) {
            if (isFirst) showFatalError('loadReservations', error);
            else showError('loadReservations', error, { onRetry: () => reloadCalendar() });
        }
    }

    // ---- 各画面 ----
    setupAttendanceModal({ user, onSaved: () => reloadCalendar() });
    setupReservationModal({ onSaved: () => reloadCalendar() });

    // リスト表示用の「＋ 練習を追加」：表示中の月に今日が含まれていれば今日、なければその月の1日で開く
    document.getElementById('reservation-add-button').addEventListener('click', () => {
        const { currentStart, currentEnd } = calendar.view;
        const today = new Date();
        const date = today >= currentStart && today < currentEnd ? today : currentStart;
        openNewReservation(toDateString(date));
    });
    setupLocationAdmin({ onChanged: () => reloadCalendar() });
    setupMemberAdmin({ user });

    setupMenu((viewId) => {
        // カレンダーを使う画面なら、カレンダーをその画面へ移す
        const slot = document.querySelector(`#${viewId} .calendar-slot`);
        if (slot) {
            slot.appendChild(calendarElement);
            calendar.updateSize();
        }
        if (viewId === 'view-locations') reloadLocationList();
        if (viewId === 'view-members') reloadMemberList();
    });

    await reloadCalendar({ isFirst: true });
    // 管理する人には、承認待ちがあれば ☰ に赤い点を出す（メンバーの一覧を読み込むと一緒に出る）
    if (canManage) reloadMemberList();
}

/**
 * 自分がメンバーかを確かめる。使えるときはメンバー情報を、使えないときは案内を出して null を返す
 */
async function checkMember(user) {
    let member;
    try {
        member = await withLoading(() => fetchMember(user.id));
        if (!member) {
            member = await withLoading(() => registerMember(user));
        } else {
            // LINE の名前やアイコンが変わっていたら反映する（失敗しても使うのには困らないので、待たない）
            updateMemberProfile(user).catch(error => console.warn('メンバー情報を更新できませんでした', error));
        }
    } catch (error) {
        showFatalError('loadMember', error);
        return null;
    }

    if (member.status === 'pending') {
        showNoticeScreen({
            title: '承認をお待ちください',
            message: 'メンバーへの参加を申請しました。\n管理者が承認すると使えるようになります。'
        });
        return null;
    }
    if (member.status !== 'approved') {
        showNoticeScreen({
            title: 'このアプリは使えません',
            message: '参加が承認されませんでした。\n心当たりがない場合は、管理者に連絡してください。',
            buttonLabel: '再読み込み'
        });
        return null;
    }
    return member;
}
