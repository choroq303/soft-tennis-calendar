// ==========================================
// アプリ全体の設定
// ==========================================
export const CONFIG = {
    // true にすると Supabase に接続せず、仮データ（js/stub.js）で動く
    USE_STUB: false,

    // true にすると LINE にログインせず、ダミーユーザー（テストユーザー）で動く。
    // LINE アプリの外（Live Server など）で確かめるとき用。本番では false にする
    USE_DUMMY_USER: false,

    // LINE Developers で発行した LIFF ID
    LIFF_ID: '2011647105-JVOWW7Tw',

    SUPABASE_URL: 'https://thxbmpqnhgikehhhqxil.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_XDZGh18pjZhiuc7Y4f7Atw_xNV1gpsH'
};
