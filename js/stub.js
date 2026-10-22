// ==========================================
// 🧪 Supabase のスタブ（config.js の USE_STUB: true のときに使う）
// api.js が使っている書き方（from().select() / upsert() / delete().eq() / order()）だけを真似する。
// データはメモリ上にあるだけなので、ページを再読み込みすると初期状態に戻る。
//
// 仮データ：先月〜来月の3か月分、週3〜4回の予定に、それぞれ約30人が出欠を回答している
// ==========================================

// 通信している雰囲気を出すための待ち時間（ms）
const FAKE_DELAY = 300;

// エラー表示の確認用：URL に付けると、わざと失敗させる（例: index.html?failWrite=server）
//   failRead  … 読み込み（予定・施設の一覧）を失敗させる
//   failWrite … 保存・削除を失敗させる
//   値は network（通信できない）／ server（障害）／ auth（権限がない）／ gone（先に消されていた）／ unknown（想定外）
//   ログインの失敗は js/liff.js の failLogin
const FAIL_PARAMS = new URLSearchParams(location.search);
const FAKE_ERRORS = {
    network: { status: 0, error: { message: 'TypeError: Failed to fetch', code: '' } },
    server: { status: 503, error: { message: 'Service Unavailable', code: '' } },
    auth: { status: 403, error: { message: 'permission denied for table reservations', code: '42501' } },
    gone: { status: 409, error: { message: 'insert or update violates foreign key constraint', code: '23503' } },
    unknown: { status: 400, error: { message: 'invalid input syntax', code: '22P02' } }
};

// 再読み込みしても毎回同じ仮データになるよう、シード固定の乱数を使う（mulberry32）
function createRandom(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Date を 'YYYY-MM-DD' にする
function toDateString(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

// 出欠を付けるメンバー（40人）。dummy_user_id_123 は liff.js のダミーユーザー（＝自分）
const MEMBER_NAMES = [
    '佐藤', '鈴木', '高橋', '田中 ひろし', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
    '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水',
    '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川',
    '前田', '岡田', '長谷川', '藤田', '後藤', '近藤', 'Yamamoto', '村上', '遠藤', '青木'
];
const MY_USER = { id: 'dummy_user_id_123', name: 'テストユーザー' };

// 平日は夜、土日は午前か午後の枠から選ぶ
const WEEKDAY_SLOTS = [['19:00:00', '21:00:00'], ['18:30:00', '21:00:00'], ['19:00:00', '22:00:00']];
const WEEKEND_SLOTS = [['09:00:00', '12:00:00'], ['09:30:00', '12:00:00'], ['13:00:00', '16:00:00'], ['13:00:00', '17:00:00']];
const COURT_NUMBERS = ['1番コート', '2番コート', '3番コート', '4番コート', 'A面', 'B面', ''];
// 予定ステータスは、ほとんど「開催決定」で、ときどき「開催未定」「キャンセル」にする
const RESERVATION_STATUS_WEIGHTS = [['confirmed', 0.65], ['tentative', 0.25], ['cancelled', 0.1]];
// 備考は一部の予定にだけ付ける（空文字は「備考なし」）
const NOTES = ['', '', '', 'ボールは各自持参', '試合形式の練習です', '雨天中止の場合は前日20時までに連絡します', '初心者向けメニューあり'];

function createInitialData() {
    const random = createRandom(20261022);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const pickWeighted = (weights) => {
        let r = random();
        for (const [value, weight] of weights) {
            if ((r -= weight) < 0) return value;
        }
        return weights[0][0];
    };

    const locations = [
        { id: 'loc-1', name: '円山庭球場', short_name: '円山', cancel_deadline: 4, min_participants: 4, created_at: '2026-01-01T00:00:00Z' },
        { id: 'loc-2', name: '中島公園 テニスコート', short_name: '中島公園', cancel_deadline: 0, min_participants: 2, created_at: '2026-01-02T00:00:00Z' },
        { id: 'loc-3', name: '月寒体育館', short_name: '月寒', cancel_deadline: 7, min_participants: 6, created_at: '2026-01-03T00:00:00Z' },
        { id: 'loc-4', name: '平岸庭球場', cancel_deadline: 2, min_participants: 4, created_at: '2026-01-04T00:00:00Z' }
    ];

    // 先月〜来月の3か月分、1週間（日〜土）に3〜4日の予定を入れる
    const reservations = [];
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const weekStart = new Date(firstDay);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const addReservation = (date, slots) => {
        const [start, end] = pick(slots);
        reservations.push({
            id: `res-${reservations.length + 1}`,
            date: toDateString(date),
            locations_id: pick(locations).id,
            court_number: pick(COURT_NUMBERS),
            start,
            end,
            note: pick(NOTES),
            status: pickWeighted(RESERVATION_STATUS_WEIGHTS)
        });
    };

    for (; weekStart <= lastDay; weekStart.setDate(weekStart.getDate() + 7)) {
        const daysInWeek = [0, 1, 2, 3, 4, 5, 6].sort(() => random() - 0.5).slice(0, random() < 0.5 ? 3 : 4).sort();
        daysInWeek.forEach(dayOfWeek => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + dayOfWeek);
            if (date < firstDay || date > lastDay) return;

            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            addReservation(date, isWeekend ? WEEKEND_SLOTS : WEEKDAY_SLOTS);
            // 土日はときどき午前・午後の2件にする（「+N」の表示確認用）
            if (isWeekend && random() < 0.25) addReservation(date, WEEKEND_SLOTS);
        });
    }

    // 表示確認用：今日より後の最初の予定を「開催未定」、2番目を「キャンセル」にして、どちらも今月に見えるようにする
    const upcoming = reservations.filter(res => res.date > toDateString(now)).sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming[0]) upcoming[0].status = 'tentative';
    if (upcoming[1]) upcoming[1].status = 'cancelled';

    // 表示確認用：今日に「〇△×がすべて2桁（10人ずつ）」の予定を入れる（カードの人数表示がいちばん長くなるケース）
    const WORST_CASE_ID = 'res-worst-case';
    reservations.push({ id: WORST_CASE_ID, date: toDateString(now), locations_id: 'loc-1', court_number: '1番コート', start: '18:30:00', end: '21:00:00', note: '人数表示の確認用：〇△×がすべて10人', status: 'confirmed' });

    // 各予定に 28〜32人が回答（〇6割・△2割・×2割くらい）。自分は7割くらいの予定に回答する
    const attendance = [];
    MEMBER_NAMES.slice(0, 30).forEach((name, i) => {
        attendance.push({
            reservations_id: WORST_CASE_ID,
            user_id: `user-${i + 1}`,
            user_name: name,
            picture_url: null,
            status: ['ok', 'pending', 'ng'][Math.floor(i / 10)]
        });
    });
    const randomStatus = () => {
        const r = random();
        return r < 0.6 ? 'ok' : r < 0.8 ? 'pending' : 'ng';
    };
    reservations.forEach(res => {
        if (res.id === WORST_CASE_ID) return;
        const count = 28 + Math.floor(random() * 5);
        const members = MEMBER_NAMES
            .map((name, i) => ({ id: `user-${i + 1}`, name }))
            .sort(() => random() - 0.5)
            .slice(0, count);
        if (random() < 0.7) members[0] = MY_USER;

        members.forEach(member => {
            attendance.push({
                reservations_id: res.id,
                user_id: member.id,
                user_name: member.name,
                picture_url: null,
                status: randomStatus()
            });
        });
    });

    return { locations, reservations, attendance };
}

const db = createInitialData();
let nextId = 1;

class StubQuery {
    constructor(table) {
        this.table = table;
        this.action = 'select';
        this.columns = '*';
        this.rows = [];
        this.conflictKeys = ['id'];
        this.filters = [];
        this.orderBy = null;
    }

    select(columns = '*') {
        // upsert().select() のように後ろに付いた場合は、結果を返す指定として扱う
        this.columns = columns;
        return this;
    }

    upsert(rows, options = {}) {
        this.action = 'upsert';
        this.rows = Array.isArray(rows) ? rows : [rows];
        if (options.onConflict) this.conflictKeys = options.onConflict.split(',');
        return this;
    }

    delete() {
        this.action = 'delete';
        return this;
    }

    eq(column, value) {
        this.filters.push({ column, value });
        return this;
    }

    order(column, { ascending = true } = {}) {
        this.orderBy = { column, ascending };
        return this;
    }

    // await されたときに実行される（Supabase のクエリと同じく thenable にする）
    then(resolve, reject) {
        return new Promise(r => setTimeout(r, FAKE_DELAY))
            .then(() => this.execute())
            .then(resolve, reject);
    }

    execute() {
        const fail = FAIL_PARAMS.get(this.action === 'select' ? 'failRead' : 'failWrite');
        if (FAKE_ERRORS[fail]) return { data: null, ...FAKE_ERRORS[fail] };

        const table = db[this.table];
        if (!table) return { data: null, error: { message: `スタブに ${this.table} テーブルがありません` } };

        if (this.action === 'upsert') return this.executeUpsert(table);
        if (this.action === 'delete') return this.executeDelete(table);
        return this.executeSelect(table);
    }

    matches(row) {
        return this.filters.every(f => String(row[f.column]) === String(f.value));
    }

    executeSelect(table) {
        let data = table.filter(row => this.matches(row)).map(row => ({ ...row }));

        // 'locations(...)' のような結合指定があれば、locations_id から施設を埋め込む
        if (this.columns.includes('locations(')) {
            data = data.map(row => ({
                ...row,
                locations: db.locations.find(l => l.id === row.locations_id) || null
            }));
        }

        if (this.orderBy) {
            const { column, ascending } = this.orderBy;
            data.sort((a, b) => (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1));
        }
        return { data, error: null };
    }

    executeUpsert(table) {
        const saved = this.rows.map(row => {
            const existing = table.find(t => this.conflictKeys.every(k => row[k] !== undefined && String(t[k]) === String(row[k])));
            if (existing) {
                Object.assign(existing, row);
                return { ...existing };
            }
            const newRow = { id: `stub-${nextId++}`, created_at: new Date().toISOString(), ...row };
            table.push(newRow);
            return { ...newRow };
        });
        return { data: saved, error: null };
    }

    executeDelete(table) {
        // 本物と同じく、予定から参照されている施設は消せないようにする
        if (this.table === 'locations') {
            const inUse = db.reservations.some(r => table.some(l => this.matches(l) && l.id === r.locations_id));
            if (inUse) {
                return { data: null, status: 409, error: { message: 'この施設を使っている予定があるため削除できません（スタブ）', code: '23503' } };
            }
        }
        // 予定を消したら、その予定の出欠も消す（ON DELETE CASCADE 相当）
        if (this.table === 'reservations') {
            const ids = table.filter(r => this.matches(r)).map(r => r.id);
            db.attendance = db.attendance.filter(a => !ids.includes(a.reservations_id));
        }
        db[this.table] = table.filter(row => !this.matches(row));
        return { data: null, error: null };
    }
}

export function createStubClient() {
    console.warn('🧪 スタブモードで動作中です。Supabase には接続せず、仮データを使います。');
    return {
        from: (table) => new StubQuery(table)
    };
}
