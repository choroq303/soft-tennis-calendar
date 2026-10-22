// ==========================================
// エラーの見分け方と、利用者に見せる文言
// 画面の操作はここでは行わない（表示は js/ui/feedback.js）
//
// 見分ける種類（利用者が自分で解決できるかどうかで分ける）：
//   network … 通信できない（圏外・タイムアウト）        → もう一度。コードなし
//   server  … サーバーの障害                            → しばらくしてから。コードあり
//   auth    … 権限がない（ログイン切れ・アクセス制限）  → 開き直す。だめなら管理者へ。コードあり
//   inUse   … 使用中で消せない（予定がある施設の削除）  → 理由を説明。コードなし
//   gone    … 他の人が先に消した                        → 最新の状態に更新。コードなし
//   unknown … 想定外                                    → 管理者へ。コードあり
// ==========================================

// 操作ごとの「何ができなかったか」（ダイアログの見出し）と、エラーコードに入れる短い名前
export const OPERATIONS = {
    login: { code: 'LOGIN', title: 'LINE にログインできませんでした' },
    loadReservations: { code: 'LOAD', title: '予定を読み込めませんでした' },
    saveReservation: { code: 'SAVE', title: '予定を保存できませんでした' },
    deleteReservation: { code: 'DEL', title: '予定を削除できませんでした' },
    saveAttendance: { code: 'ANS', title: '出欠を保存できませんでした' },
    loadLocations: { code: 'LOCLOAD', title: '施設の一覧を読み込めませんでした' },
    saveLocation: { code: 'LOCSAVE', title: '施設を保存できませんでした' },
    deleteLocation: { code: 'LOCDEL', title: '施設を削除できませんでした' }
};

const MESSAGES = {
    network: '通信できませんでした。電波の良いところで、もう一度お試しください。',
    server: 'サーバーにつながりません。しばらく時間をおいて、もう一度お試しください。\n続く場合は、下のエラーコードを管理者に連絡してください。',
    auth: '操作する権限が確認できませんでした。アプリを開き直してください。\nそれでもできない場合は、下のエラーコードを管理者に連絡してください。',
    inUse: 'この施設を使っている予定があります。\n先に予定の場所を変えるか、予定を削除してください。',
    gone: 'ほかの人が先に削除した可能性があります。\n閉じると、最新の状態に更新します。',
    unknown: '思わぬエラーが起きました。\n下のエラーコードを管理者に連絡してください。'
};

// ログインの失敗は Supabase の失敗と事情が違うので、文言を分ける
const LOGIN_MESSAGE = 'LINE アプリから開き直してください。\nそれでも開けない場合は、下のエラーコードを管理者に連絡してください。';

// エラーコードを出す種類
const KINDS_WITH_CODE = ['server', 'auth', 'unknown'];

/**
 * エラーを見分けて、利用者に見せる内容にする
 * @param {keyof OPERATIONS} operation - 何をしていたときのエラーか
 * @param {any} error - api.js などが投げたエラー（Supabase のエラーには status と code が付いている）
 * @returns {{ kind: string, title: string, message: string, code: string | null }}
 */
export function describeError(operation, error) {
    const { code: operationCode, title } = OPERATIONS[operation];
    const kind = operation === 'login' ? 'unknown' : classify(operation, error);
    const message = operation === 'login' ? LOGIN_MESSAGE : MESSAGES[kind];
    const showCode = operation === 'login' || KINDS_WITH_CODE.includes(kind);
    return {
        kind,
        title,
        message,
        // 例: E-SAVE-503（予定の保存で、サーバーの障害）。HTTP の番号がなければ DB のエラー番号、それもなければ X
        code: showCode ? `E-${operationCode}-${error?.status || error?.code || 'X'}` : null
    };
}

function classify(operation, error) {
    const status = error?.status ?? 0;
    const code = error?.code ?? '';

    // 通信できない：fetch 自体の失敗（status 0）、タイムアウト、端末がオフライン
    if (!navigator.onLine || error?.name === 'AbortError' || error?.name === 'TimeoutError'
        || (status === 0 && /fetch|network/i.test(error?.message ?? ''))) {
        return 'network';
    }
    // 23503 = 別のデータから参照されている／参照先がない（外部キーの制約）
    //   施設の削除 → その施設を使っている予定がある
    //   それ以外（予定・出欠の保存）→ 予定や施設が先に消されていた
    if (code === '23503') return operation === 'deleteLocation' ? 'inUse' : 'gone';
    // 401・403、または DB の権限エラー（42501）、JWT の期限切れなど（PGRST3xx）
    if (status === 401 || status === 403 || code === '42501' || code.startsWith('PGRST3')) return 'auth';
    if (status >= 500) return 'server';
    return 'unknown';
}
