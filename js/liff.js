// ユーザー情報を保持する変数（このファイルの外からは直接書き換えられないようにする）
let userProfile = {
    userId: null,
    displayName: null,
};

/**
 * LIFFの初期化とログイン処理、プロフィールの保持を行う
 */
export async function initializeLiff(liffId) {
    // 1. LIFF SDKが読み込まれていない（普通のブラウザでテストしている）場合のフォールバック
    if (typeof liff === 'undefined') {
        console.warn("LIFF SDK未検知のため、ブラウザ用ダミーユーザーで動作します。");
        userProfile = {
            userId: "dummy_user_id_123",
            displayName: "テストユーザー(ブラウザ)"
        };
        return userProfile;
    }

    try {
        await liff.init({ liffId: liffId });
        
        // 未ログインならLINEログインへ誘導
        if (!liff.isLoggedIn()) {
            liff.login();
            return null;
        }
        
        // ログイン中の場合、プロフィールを取得して変数に保持
        const profile = await liff.getProfile();
        
        userProfile = {
            userId: profile.userId,
            displayName: profile.displayName
        };

        console.log("LINEログイン成功:", userProfile.displayName);
        return userProfile;

    } catch (error) {
        console.error("LIFF初期化エラー:", error);
        // エラー時も動くようにダミーを入れておくか、スルーするか
        return null;
    }
}

/**
 * 保持しているユーザーIDを取得する関数
 */
export function getLineUserId() {
    return userProfile.userId || 'dummy_user_id';
}

/**
 * 保持しているユーザー名を取得する関数
 */
export function getLineUserName() {
    return userProfile.displayName || 'ゲストユーザー';
}