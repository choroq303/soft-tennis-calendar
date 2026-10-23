// ==========================================
// メンバー管理画面（管理メニュー）
//   ・承認済みのメンバーの一覧。ロール（開発者・管理者）がある人を上に並べる
//   ・カードをタップ → ロールの付け外し、メンバーから外す
//   ・下に「承認しなかった人」。あとから承認し直せる
//   自分のロールは変えられない（管理する人がいなくなるのを防ぐ）
// ==========================================
import { fetchMembers, updateMember, removeMember } from '../api.js';
import { openModal, closeModal } from '../ui/modal.js';
import { withLoading, showError } from '../ui/feedback.js';
import { confirmDanger } from '../ui/dialog.js';
import { createAvatar } from '../ui/avatar.js';

const list = document.getElementById('member-admin-list');
const modal = document.getElementById('member-modal');
const developerSwitch = document.getElementById('member-role-developer');
const adminSwitch = document.getElementById('member-role-admin');
const selfNote = document.getElementById('member-modal-self-note');
const removeButton = document.getElementById('member-remove-button');
const saveButton = document.getElementById('member-save-button');

// ログイン中の自分の user_id と、編集中のメンバー
let myUserId = null;
let editingMember = null;

/**
 * @param {{ user: object, onChanged: () => void }} options
 *   user      … ログイン中のユーザー（liff.js）
 *   onChanged … メンバーを変えたあとに呼ばれる（通知の件数を読み込み直すなど）
 */
export function setupMemberAdmin({ user, onChanged }) {
    myUserId = user.id;

    list.addEventListener('click', async (event) => {
        // 承認しなかった人の「承認する」
        const approveButton = event.target.closest('[data-approve]');
        if (approveButton) {
            await changeMember(approveButton.dataset.approve, { status: 'approved' });
            return;
        }
        const card = event.target.closest('.member-card');
        if (card) openMemberModal(card.member);
    });

    saveButton.addEventListener('click', async () => {
        const changed = await changeMember(editingMember.user_id, {
            is_developer: developerSwitch.checked,
            is_admin: adminSwitch.checked
        });
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
            onChanged();
        } catch (error) {
            showError('removeMember', error);
        }
    });

    // 保存して一覧を読み込み直す。うまくいったら true
    async function changeMember(userId, changes) {
        try {
            await withLoading(() => updateMember(userId, changes));
            await reloadMemberList();
            onChanged();
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
        const approved = members.filter(member => member.status === 'approved').sort(byRole);
        const rejected = members.filter(member => member.status === 'rejected');

        const sections = [createSection(`メンバー（${approved.length}人）`, approved.map(createMemberCard))];
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

function showListMessage(text, isError = false) {
    const message = document.createElement('p');
    message.className = isError ? 'card-list-message is-error' : 'card-list-message';
    message.textContent = text;
    list.replaceChildren(message);
}

function createSection(title, cards) {
    const section = document.createElement('section');
    section.className = 'card-section';
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

// 承認しなかった人のカード（右に「承認する」）
function createRejectedCard(member) {
    const item = document.createElement('li');
    item.className = 'member-card is-rejected';

    const name = document.createElement('span');
    name.className = 'member-card-name';
    name.textContent = member.user_name || '名前未設定';

    const approveButton = document.createElement('button');
    approveButton.type = 'button';
    approveButton.className = 'btn btn-sm';
    approveButton.dataset.approve = member.user_id;
    approveButton.textContent = '承認する';

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

    developerSwitch.checked = Boolean(member.is_developer);
    adminSwitch.checked = Boolean(member.is_admin);
    // 自分のロールは変えられない・自分は外せない
    developerSwitch.disabled = isSelf;
    adminSwitch.disabled = isSelf;
    selfNote.hidden = !isSelf;
    saveButton.disabled = isSelf;
    removeButton.hidden = isSelf;

    openModal(modal);
}
