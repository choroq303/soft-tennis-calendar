// ==========================================
// LINE ログイン（LIFF）とログイン中のユーザー情報
// ==========================================
import { CONFIG } from './config.js';

// USE_DUMMY_USER が true のときや、LIFF SDK がない普通のブラウザで動かすときのユーザー
const DUMMY_USER = { id: 'dummy_user_id_123', name: 'テストユーザー', pictureUrl: null };

/**
 * LIFF を初期化してログイン中のユーザーを返す。
 * 未ログインなら LINE のログイン画面へ移動するので null を返す（呼び出し側はそこで処理を止める）。
 * 初期化に失敗したときは例外を投げる（呼び出し側で画面全体のエラーを出す）。
 * @returns {Promise<{ id: string, name: string, pictureUrl: string | null } | null>}
 */
export async function initializeLiff() {
    // エラー表示の確認用：URL に ?failLogin を付けると（USE_DUMMY_USER が true のときだけ）、ログインに失敗したことにする
    if (CONFIG.USE_DUMMY_USER && new URLSearchParams(location.search).has('failLogin')) {
        throw Object.assign(new Error('LIFF の初期化に失敗しました（スタブ）'), { code: 'INIT_FAILED' });
    }
    if (CONFIG.USE_DUMMY_USER || typeof liff === 'undefined') {
        console.warn('USE_DUMMY_USER が true、または LIFF SDK がないため、ダミーユーザーで動作します。');
        return DUMMY_USER;
    }

    await liff.init({ liffId: CONFIG.LIFF_ID });

    if (!liff.isLoggedIn()) {
        liff.login();
        return null;
    }

    const profile = await liff.getProfile();
    return {
        id: profile.userId,
        name: profile.displayName,
        // LINE のアイコン画像（設定していない人は undefined）
        pictureUrl: profile.pictureUrl || null
    };
}
