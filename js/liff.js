// liff.js などに記述
let userProfile = null;

export async function initializeLiff(liffId) {
    try {
        await liff.init({ liffId: liffId });
        
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }
        
        userProfile = await liff.getProfile();
        console.log("LINEログイン成功:", userProfile.displayName);
        return userProfile;
    } catch (error) {
        console.error("LIFF初期化エラー:", error);
    }
}

// ほかのファイルからユーザーIDを取得したいときに使う用
export function getLineUserId() {
    return userProfile ? userProfile.userId : null;
}