import { CONFIG } from './config.js';
import { showLoading, hideLoading } from './ui.js';

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 予定データの取得
export async function fetchEvents(currentUserId = 'dummy_user_id') {
    showLoading();
    try {
        // 1. reservations と attendance をSupabaseから並行取得
        const [resResult, attResult] = await Promise.all([
            supabase.from('reservations').select('*'),
            supabase.from('attendance').select('*')
        ]);

        if (resResult.error) throw resResult.error;
        if (attResult.error) throw attResult.error;

        const reservations = resResult.data;
        const attendances = attResult.data;

        // 2. 出欠の集計マップを作成
        const summaryMap = {}; // { reservations_id: { ok: 0, pending: 0, ng: 0 } }
        const userStatusMap = {}; // { reservations_id: status }

        attendances.forEach(att => {
            const resId = att.reservations_id;
            const status = att.status;

            if (!summaryMap[resId]) {
                summaryMap[resId] = { ok: 0, pending: 0, ng: 0 };
            }
            if (summaryMap[resId][status] !== undefined) {
                summaryMap[resId][status]++;
            }

            if (att.user_id === currentUserId) {
                userStatusMap[resId] = status;
            }
        });

        // 3. FullCalendar用のイベント配列に整形
        const events = reservations.map(res => {
            const counts = summaryMap[res.id] || { ok: 0, pending: 0, ng: 0 };
            const myStatus = userStatusMap[res.id] || null;

            const formattedStart = res.start ? res.start.substring(0, 5) : '';
            const formattedEnd = res.end ? res.end.substring(0, 5) : '';


            return {
                id: res.id,
                title: `${res.location} (${res.court})`,
                start: `${res.date}T${res.start}`,
                end: `${res.date}T${res.end}`,
                extendedProps: {
                    date: res.date,
                    location: res.location,
                    court: res.court,
                    startTime: formattedStart,
                    endTime: formattedEnd,
                    counts: counts,
                    myStatus: myStatus
                }
            };
        });

        console.log('【取得したイベント一覧】', events);
        return events;

    } catch (error) {
        console.error('通信エラー（予定取得）:', error);
        return [];
    } finally {
        hideLoading();
    }
}

// 出欠登録の保存
export async function saveAttendance(payload) {
    showLoading();
    try {
        // payload = { reservations_id, user_id, user_name, status }
        const { data, error } = await supabase
            .from('attendance')
            .upsert([
                {
                    reservations_id: payload.reservations_id,
                    user_id: payload.user_id,
                    user_name: payload.user_name,
                    status: payload.status,
                    update_at: new Date().toISOString()
                }
            ], {
                onConflict: 'reservations_id,user_id'
            })
            .select();

        if (error) throw error;
        return { status: 'success', data };

    } catch (error) {
        console.error('通信エラー（出欠登録）:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

// 管理者用：予定の保存（新規・編集）
export async function saveAdminEvent(payload) {
    try {
        // payload に id があれば更新、なければ新規追加 (upsert)
        const record = {
            date: payload.date,
            location: payload.location,
            court: payload.court,
            start: payload.start,
            end: payload.end
        };
        if (payload.id) {
            record.id = payload.id;
        }

        const { data, error } = await supabase
            .from('reservations')
            .upsert([record])
            .select();

        if (error) throw error;
        return { status: 'success', data };

    } catch (error) {
        console.error('通信エラー（予定保存）:', error);
        return { status: 'error', message: error.message };
    }
}

// 管理者用：予定の削除
export async function deleteAdminEvent(payload) {
    try {
        // payload = { id: '...' } または文字列の id そのものを受け取れるように柔軟に
        const targetId = typeof payload === 'object' ? payload.id : payload;

        const { error } = await supabase
            .from('reservations')
            .delete()
            .eq('id', targetId);

        if (error) throw error;
        return { status: 'success' };

    } catch (error) {
        console.error('通信エラー（予定削除）:', error);
        return { status: 'error', message: error.message };
    }
}