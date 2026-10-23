// ==========================================
// データの読み書き（Supabase）
// 画面の操作はここでは行わない。失敗したときは例外を投げるので、呼び出し側で表示する。
//
// テーブル:
//   reservations … 予定（date, locations_id, court_number, start, end, note, status）
//   attendance   … 出欠（reservations_id, user_id, user_name, picture_url, status）
//   locations    … 施設（name, short_name, cancel_deadline, min_participants）
// ==========================================
import { CONFIG } from './config.js';
import { createStubClient } from './stub.js';
import { STATUS_ORDER } from './icons.js';
import { toReservationStatus } from './reservationStatus.js';

const supabase = CONFIG.USE_STUB
    ? createStubClient()
    : window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Supabase の結果 { data, error, status } から data を取り出す。
// error があれば例外にする（エラーの見分けに使うので、HTTP の番号 status も付ける。js/errors.js）
function unwrap({ data, error, status }) {
    if (error) throw Object.assign(error, { status });
    return data;
}

// ------------------------------------------
// 予定
// ------------------------------------------

/**
 * 予定一覧を取得し、FullCalendar に渡せる形にして返す
 * @param {string} myUserId - 「自分の回答」を判定するためのユーザーID
 */
export async function fetchReservations(myUserId) {
    const [reservations, attendance] = await Promise.all([
        supabase.from('reservations').select('*, locations(id, name, short_name)').then(unwrap),
        supabase.from('attendance').select('*').then(unwrap)
    ]);

    const attendanceByReservation = groupAttendance(attendance);
    return reservations.map(reservation =>
        toCalendarEvent(reservation, attendanceByReservation.get(reservation.id), myUserId)
    );
}

// 出欠を予定ごとにまとめる → Map<予定ID, { members: { ok: [...], pending: [...], ng: [...] }, byUser: { ユーザーID: { status, comment } } }>
function groupAttendance(rows) {
    const grouped = new Map();
    rows.forEach(row => {
        if (!STATUS_ORDER.includes(row.status)) return; // 古いデータに残っている 'none' などは数えない

        if (!grouped.has(row.reservations_id)) grouped.set(row.reservations_id, emptyAttendance());
        const entry = grouped.get(row.reservations_id);
        const comment = row.comment || '';
        entry.members[row.status].push({ name: row.user_name || '名前未設定', pictureUrl: row.picture_url || null, comment });
        entry.byUser[row.user_id] = { status: row.status, comment };
    });
    return grouped;
}

function emptyAttendance() {
    return { members: { ok: [], pending: [], ng: [] }, byUser: {} };
}

// データベースの1行を、カレンダーに表示する予定（FullCalendar のイベント）に変換する
function toCalendarEvent(reservation, attendance = emptyAttendance(), myUserId) {
    const locationName = reservation.locations?.name ?? '未設定の施設';
    // 省略名（月表示のカード用）。設定していない施設は正式名称を使う
    const locationShortName = reservation.locations?.short_name || locationName;
    const reservationStatus = toReservationStatus(reservation.status);
    const courtNumber = reservation.court_number ?? '';

    return {
        id: reservation.id,
        title: courtNumber ? `${locationName}（${courtNumber}）` : locationName,
        start: `${reservation.date}T${reservation.start}`,
        end: `${reservation.date}T${reservation.end}`,
        // 予定ステータスで色分けする（css/calendar.css の .is-confirmed など。リスト表示の丸の色にも効く）
        classNames: [`is-${reservationStatus}`],
        extendedProps: {
            date: reservation.date,
            locationId: reservation.locations_id,
            locationName,
            locationShortName,
            reservationStatus,
            courtNumber,
            startTime: toHourMinute(reservation.start),
            endTime: toHourMinute(reservation.end),
            note: reservation.note ?? '',
            members: attendance.members,
            counts: Object.fromEntries(STATUS_ORDER.map(status => [status, attendance.members[status].length])),
            myStatus: attendance.byUser[myUserId]?.status ?? null,
            myComment: attendance.byUser[myUserId]?.comment ?? ''
        }
    };
}

// '19:00:00' → '19:00'
function toHourMinute(time) {
    return time ? time.slice(0, 5) : '';
}

/**
 * 予定を保存する（id があれば更新、なければ新規作成）
 */
export async function saveReservation({ id, date, locationId, courtNumber, startTime, endTime, note, reservationStatus }) {
    const record = {
        date,
        locations_id: locationId,
        court_number: courtNumber,
        start: startTime,
        end: endTime,
        note,
        status: toReservationStatus(reservationStatus)
    };
    if (id) record.id = id;

    return supabase.from('reservations').upsert([record]).select().then(unwrap);
}

export async function deleteReservation(id) {
    return supabase.from('reservations').delete().eq('id', id).then(unwrap);
}

// ------------------------------------------
// 出欠
// ------------------------------------------

/**
 * 自分の出欠を保存する。status が null なら回答を取り消す（行を削除する。ひとことも消える）
 * @param {{ reservationId: string, user: { id: string, name: string, pictureUrl: string | null }, status: 'ok' | 'pending' | 'ng' | null, comment: string }} params
 *   comment … ひとこと（例: 1時間遅れます）。空なら null で保存する
 */
export async function saveAttendance({ reservationId, user, status, comment }) {
    if (!status) {
        return supabase.from('attendance').delete()
            .eq('reservations_id', reservationId)
            .eq('user_id', user.id)
            .then(unwrap);
    }

    const record = {
        reservations_id: reservationId,
        user_id: user.id,
        user_name: user.name,
        picture_url: user.pictureUrl,
        status,
        comment: comment || null,
        update_at: new Date().toISOString()
    };
    return supabase.from('attendance')
        .upsert([record], { onConflict: 'reservations_id,user_id' })
        .select()
        .then(unwrap);
}

// ------------------------------------------
// 施設
// ------------------------------------------

export async function fetchLocations() {
    return supabase.from('locations').select('*').order('created_at', { ascending: true }).then(unwrap);
}

/**
 * 施設を保存する（id があれば更新、なければ新規作成）
 */
export async function saveLocation({ id, name, shortName, cancelDeadline, minParticipants }) {
    const record = {
        name,
        short_name: shortName || null, // 空なら「省略名なし」（カードにも正式名称を出す）
        // 0（当日）を null にしないよう ?? を使う
        cancel_deadline: cancelDeadline ?? null,
        min_participants: minParticipants ?? 0
    };
    if (id) record.id = id;

    return supabase.from('locations').upsert(record).select().then(unwrap);
}

export async function deleteLocation(id) {
    return supabase.from('locations').delete().eq('id', id).then(unwrap);
}
