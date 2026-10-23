// ==========================================
// 通知画面（管理メニュー）
//   今はメンバーの参加申請だけ。「承認する」でメンバーに追加、「承認しない」で使えないようにする。
//   申請があるあいだは、☰ に赤い点、メニューの「通知」に件数を出す
// ==========================================
import { fetchMembers, updateMember } from '../api.js';
import { withLoading, showError } from '../ui/feedback.js';
import { createAvatar } from '../ui/avatar.js';

const list = document.getElementById('notification-list');
const badge = document.getElementById('notification-badge');

/**
 * @param {{ onChanged: () => void }} options
 *   onChanged … 承認・承認しないを押したあとに呼ばれる（メンバー管理の一覧を読み込み直すなど）
 */
export function setupNotifications({ onChanged }) {
    // カードは読み込むたびに作り直すので、一覧全体でまとめてボタンのタップを受け取る
    list.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-decision]');
        if (!button) return;
        const status = button.dataset.decision; // approved または rejected
        const userId = button.closest('.notification-card').dataset.userId;
        try {
            await withLoading(() => updateMember(userId, { status }));
            await reloadNotifications();
            onChanged();
        } catch (error) {
            showError('saveMember', error);
        }
    });
}

// 承認待ちの人を読み込み直して、カードとバッジ（件数）を出し直す
export async function reloadNotifications() {
    try {
        const pending = (await fetchMembers()).filter(member => member.status === 'pending');
        updateBadge(pending.length);
        if (pending.length === 0) {
            showListMessage('新しい通知はありません');
            return;
        }
        // 新しい申請を上に
        list.replaceChildren(...pending.reverse().map(createRequestCard));
    } catch (error) {
        showListMessage('通知を読み込めませんでした', true);
        showError('loadMembers', error, { onRetry: reloadNotifications });
    }
}

// メニューの「通知」の件数と、☰ ボタンの赤い点
function updateBadge(count) {
    badge.hidden = count === 0;
    badge.textContent = count;
    document.body.classList.toggle('has-notification', count > 0);
}

function showListMessage(text, isError = false) {
    const item = document.createElement('li');
    item.className = isError ? 'card-list-message is-error' : 'card-list-message';
    item.textContent = text;
    list.replaceChildren(item);
}

/**
 * 参加申請のカード
 *   (ア) 新井さんが参加を申請しました
 *        10/23 19:05
 *        [承認しない] [承認する]
 */
function createRequestCard(member) {
    const card = document.createElement('li');
    card.className = 'notification-card';
    card.dataset.userId = member.user_id;

    const avatar = createAvatar({ name: member.user_name, pictureUrl: member.picture_url });

    const body = document.createElement('div');
    body.className = 'notification-body';

    const message = document.createElement('p');
    message.className = 'notification-message';
    const name = document.createElement('strong');
    name.textContent = member.user_name || '名前未設定';
    message.append(name, 'さんが参加を申請しました');

    const time = document.createElement('p');
    time.className = 'notification-time';
    time.textContent = formatDateTime(member.requested_at);

    const actions = document.createElement('div');
    actions.className = 'notification-actions';
    actions.append(
        createDecisionButton('承認しない', 'rejected', 'btn btn-sm'),
        createDecisionButton('承認する', 'approved', 'btn btn-sm btn-primary')
    );

    body.append(message, time, actions);
    card.append(avatar, body);
    return card;
}

function createDecisionButton(label, decision, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.decision = decision;
    button.textContent = label;
    return button;
}

// '2026-10-23T10:05:00Z' → '10/23 19:05'（端末の時刻で）
function formatDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
