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
            supabase.from('reservations').select('*, locations(id, name, cancel_deadline, min_participants)'),
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
            const location = res.locations ? res.locations.name : '未設定のコート';

            const counts = summaryMap[res.id] || { ok: 0, pending: 0, ng: 0 };
            const myStatus = userStatusMap[res.id] || null;

            const formattedStart = res.start ? res.start.substring(0, 5) : '';
            const formattedEnd = res.end ? res.end.substring(0, 5) : '';

            let displayTitle = location;
            if (res.court_number) {
                displayTitle = `${location} (${res.court_number})`;
            }

            return {
                id: res.id,
                title: displayTitle,
                start: `${res.date}T${res.start}`,
                end: `${res.date}T${res.end}`,
                extendedProps: {
                    date: res.date,
                    location: res.locations.name,
                    courtNumber: res.court_number,
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
            locations_id: payload.locations_id,
            court_number: payload.court_number,
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

// ==========================================
// 🎾 コート管理用の API 関数
// ==========================================

/**
 * コート一覧を取得する
 */
export async function fetchLocations() {
    try {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .order('created_at', { ascending: true }); // 登録順（または任意のカラム順）で並び替え

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('fetchLocations error:', error);
        throw error;
    }
}

/**
 * コート情報を保存する（新規作成・更新兼用 / UPSERT）
 * @param {Object} payload - { id, name, cancel_deadline, min_participants }
 */
export async function saveLocation(payload) {
    try {
        // id が空（新規）の場合は、supabaseに自動生成させるためにプロパティを削除またはundefinedにする
        const dataToSave = {
            name: payload.name,
            cancel_deadline: payload.cancel_deadline || null,
            min_participants: payload.min_participants || 0
        };

        if (payload.id) {
            dataToSave.id = payload.id;
        }

        const { data, error } = await supabase
            .from('locations')
            .upsert(dataToSave)
            .select();

        if (error) throw error;
        return { status: 'success', data };
    } catch (error) {
        console.error('saveLocation error:', error);
        return { status: 'error', message: error.message };
    }
}

/**
 * コートを削除する
 * @param {string} id - コートID
 */
export async function deleteLocation(id) {
    try {
        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { status: 'success' };
    } catch (error) {
        console.error('deleteLocation error:', error);
        return { status: 'error', message: error.message };
    }
}