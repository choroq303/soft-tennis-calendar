// ==========================================
// メンバー管理画面（管理メニュー）
//   ・上に「承認待ち」（参加申請）。「承認する」でメンバーに追加、「承認しない」で使えないようにする。
//     承認待ちがあるあいだは、☰ に赤い点、メニューの「メンバー管理」に件数を出す
//   ・承認済みのメンバーの一覧。ロール（開発者・管理者）がある人を上に並べる
//   ・カードをタップ → ロールの付け外し、メンバーから外す
//   ・下に「承認しなかった人」。あとから承認し直せる
//   自分のロールは変えられない（管理する人がいなくなるのを防ぐ）。
//   開発者は画面からは変えられない・外せない（開発者のロールは Supabase で直接設定する）
// ==========================================
import { fetchMembers, updateMember, removeMember } from '../api.js';
import { openModal, closeModal } from '../ui/modal.js';
import { withLoading, showError } from '../ui/feedback.js';
import { confirmDanger } from '../ui/dialog.js';
import { createAvatar } from '../ui/avatar.js';

const list = document.getElementById('member-admin-list');
const badge = document.getElementById('member-badge');
const modal = document.getElementById('member-modal');
const adminSwitch = document.getElementById('member-role-admin');
const note = document.getElementById('member-modal-note');
const removeButton = document.getElementById('member-remove-button');
const saveButton = document.getElementById('member-save-button');

// ログイン中の自分の user_id と、編集中のメンバー
let myUserId = null;
let editingMember = null;

/**
 * @param {{ user: object }} options
 *   user … ログイン中のユーザー（liff.js）
 */
export function setupMemberAdmin({ user }) {
    myUserId = user.id;

    // カードは読み込むたびに作り直すので、一覧全体でまとめてタップを受け取る
    list.addEventListener('click', async (event) => {
        // 承認待ちの「承認する／承認しない」と、承認しなかった人の「承認する」
        const decisionButton = event.target.closest('[data-decision]');
        if (decisionButton) {
            await changeMember(decisionButton.dataset.userId, { status: decisionButton.dataset.decision });
            return;
        }
        const card = event.target.closest('button.member-card'); // 承認しなかった人のカードは開かない
        if (card) openMemberModal(card.member);
    });

    saveButton.addEventListener('click', async () => {
        const changed = await changeMember(editingMember.user_id, { is_admin: adminSwitch.checked });
        if (changed) closeModal(modal);
    });

    removeButton.addEventListener('click', async () => {
        const confirmed = await confirmDanger({
            title: `${editingMember.user_name}さんをメンバーから外しますか？`,
            message: '外した人がまたアプリを開くと、承認待ちになります。',
            confirmLabel: '外す'
        });
        if (!confirmed) return;
        try {
            await withLoading(() => removeMember(editingMember.user_id));
            closeModal(modal);
            await reloadMemberList();
        } catch (error) {
            showError('removeMember', error);
        }
    });

    // 保存して一覧を読み込み直す。うまくいったら true
    async function changeMember(userId, changes) {
        try {
            await withLoading(() => updateMember(userId, changes));
            await reloadMemberList();
            return true;
        } catch (error) {
            showError('saveMember', error);
            return false;
        }
    }
}

// メンバーの一覧を読み込み直す
export async function reloadMemberList() {
    showListMessage('読み込み中...');
    try {
        const members = await fetchMembers();
        // 承認待ちは新しい申請を上に
        const pending = members.filter(member => member.status === 'pending').reverse();
        const approved = members.filter(member => member.status === 'approved').sort(byRole);
        const rejected = members.filter(member => member.status === 'rejected');
        updateBadge(pending.length);

        const sections = [];
        if (pending.length > 0) {
            sections.push(createSection(`承認待ち（${pending.length}人）`, pending.map(createRequestCard), 'is-pending'));
        }
        sections.push(createSection(`メンバー（${approved.length}人）`, approved.map(createMemberCard)));
        if (rejected.length > 0) {
            sections.push(createSection('承認しなかった人', rejected.map(createRejectedCard)));
        }
        list.replaceChildren(...sections);
    } catch (error) {
        showListMessage('メンバーの一覧を読み込めませんでした', true);
        showError('loadMembers', error, { onRetry: reloadMemberList });
    }
}

// 開発者 → 管理者 → ロールなし の順。同じなら申請した順のまま
function byRole(a, b) {
    const rank = (member) => (member.is_developer ? 0 : member.is_admin ? 1 : 2);
    return rank(a) - rank(b);
}

// メニューの「メンバー管理」の件数と、☰ ボタンの赤い点
function updateBadge(count) {
    badge.hidden = count === 0;
    badge.textContent = count;
    document.body.classList.toggle('has-notification', count > 0);
}

function showListMessage(text, isError = false) {
    const message = document.createElement('p');
    message.className = isError ? 'card-list-message is-error' : 'card-list-message';
    message.textContent = text;
    list.replaceChildren(message);
}

function createSection(title, cards, extraClass = '') {
    const section = document.createElement('section');
    section.className = `card-section ${extraClass}`.trim();
    const heading = document.createElement('h3');
    heading.className = 'card-section-title';
    heading.textContent = title;
    const items = document.createElement('ul');
    items.className = 'card-list-items';
    items.append(...cards);
    section.append(heading, items);
    return section;
}

/**
 * メンバーのカード（タップで編集）
 *   (佐) 佐藤  [管理者]            ›
 */
function createMemberCard(member) {
    const item = document.createElement('li');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'member-card';
    card.member = member; // タップしたときに編集モーダルへ渡す

    const name = document.createElement('span');
    name.className = 'member-card-name';
    name.textContent = member.user_name || '名前未設定';
    if (member.user_id === myUserId) name.append(createTag('自分', 'is-self'));

    const roles = document.createElement('span');
    roles.className = 'member-card-roles';
    if (member.is_developer) roles.append(createTag('開発者', 'is-developer'));
    if (member.is_admin) roles.append(createTag('管理者', 'is-admin'));

    card.append(createAvatar({ name: member.user_name, pictureUrl: member.picture_url }), name, roles);
    item.appendChild(card);
    return item;
}

/**
 * 承認待ちのカード
 *   (ア) 新井さんが参加を申請しました
 *        10/23 19:05
 *                     [承認しない] [承認する]
 */
function createRequestCard(member) {
    const card = document.createElement('li');
    card.className = 'request-card';

    const body = document.createElement('div');
    body.className = 'request-body';

    const message = document.createElement('p');
    message.className = 'request-message';
    const name = document.createElement('strong');
    name.textContent = member.user_name || '名前未設定';
    message.append(name, 'さんが参加を申請しました');

    const time = document.createElement('p');
    time.className = 'request-time';
    time.textContent = formatDateTime(member.requested_at);

    const actions = document.createElement('div');
    actions.className = 'request-actions';
    actions.append(
        createDecisionButton('承認しない', member.user_id, 'rejected', 'btn btn-sm'),
        createDecisionButton('承認する', member.user_id, 'approved', 'btn btn-sm btn-primary')
    );

    body.append(message, time, actions);
    card.append(createAvatar({ name: member.user_name, pictureUrl: member.picture_url }), body);
    return card;
}

function createDecisionButton(label, userId, decision, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.userId = userId;
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

// 承認しなかった人のカード（右に「承認する」）
function createRejectedCard(member) {
    const item = document.createElement('li');
    item.className = 'member-card is-rejected';

    const name = document.createElement('span');
    name.className = 'member-card-name';
    name.textContent = member.user_name || '名前未設定';

    const approveButton = createDecisionButton('承認する', member.user_id, 'approved', 'btn btn-sm');

    item.append(createAvatar({ name: member.user_name, pictureUrl: member.picture_url }), name, approveButton);
    return item;
}

function createTag(text, className) {
    const tag = document.createElement('span');
    tag.className = `role-tag ${className}`;
    tag.textContent = text;
    return tag;
}

// ------------------------------------------
// 編集モーダル
// ------------------------------------------

function openMemberModal(member) {
    editingMember = member;
    const isSelf = member.user_id === myUserId;

    document.getElementById('member-modal-avatar').replaceWith(
        Object.assign(createAvatar({ name: member.user_name, pictureUrl: member.picture_url }, 'member-avatar--large'), { id: 'member-modal-avatar' })
    );
    document.getElementById('member-modal-name').textContent = member.user_name || '名前未設定';

    adminSwitch.checked = Boolean(member.is_admin);
    // 自分と開発者は、ロールを変えられない・外せない
    const locked = isSelf || Boolean(member.is_developer);
    adminSwitch.disabled = locked;
    saveButton.disabled = locked;
    removeButton.hidden = locked;
    note.hidden = !locked;
    note.textContent = member.is_developer
        ? '開発者は変更できません'
        : '自分のロールは変えられません（ほかの管理者に頼んでください）';

    openModal(modal);
}
