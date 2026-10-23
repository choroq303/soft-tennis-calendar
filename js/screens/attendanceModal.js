// ==========================================
// 出欠モーダル（練習日程で予定をタップしたときに開く）
//   ・予定ステータスの帯（開催未定／開催決定／キャンセル）。キャンセルの予定は出欠ボタンを隠す
//   ・予定の情報（場所・コート・時間・備考）
//   ・現在の人数（タップで展開すると、〇△×ごとに LINE のアイコンと名前を表示）
//   ・自分の出欠ボタンと、ひとこと（例: 1時間遅れます）
//       〇△×を押すと、ひとことも一緒に保存する。
//       選んでいるボタンをもう一度押すと、ひとことを変えていれば保存し直し、変えていなければ回答を取り消す
// ==========================================
import { saveAttendance } from '../api.js';
import { statusIconSvg, STATUS_ORDER } from '../icons.js';
import { openModal, closeModal } from '../ui/modal.js';
import { withLoading, showError } from '../ui/feedback.js';

const modal = document.getElementById('attendance-modal');
const statusBanner = document.getElementById('attendance-status');

// 予定ステータスの帯に出す文言
const STATUS_MESSAGES = {
    tentative: '開催未定（決まりしだいお知らせします）',
    confirmed: '開催決定',
    cancelled: 'この練習はキャンセルになりました'
};
const statusButtons = modal.querySelectorAll('.attendance-button');
const commentInput = document.getElementById('attendance-comment');

// 開いている予定のID と、その予定への自分の回答・ひとこと
let reservationId = null;
let myStatus = null;
let myComment = '';

/**
 * @param {{ user: object, onSaved: () => Promise<void> }} options
 *   user    … ログイン中のユーザー（liff.js）
 *   onSaved … 出欠を保存したあとに呼ばれる（カレンダーの再読み込み）
 */
export function setupAttendanceModal({ user, onSaved }) {
    async function save(status) {
        const comment = commentInput.value.trim();
        try {
            await withLoading(() => saveAttendance({ reservationId, user, status, comment }));
            closeModal(modal);
            await onSaved();
        } catch (error) {
            // 予定が先に消されていたときは、モーダルを閉じて最新の予定を読み込み直す
            showError('saveAttendance', error, { onRetry: () => save(status), onRefresh: () => { closeModal(modal); onSaved(); } });
        }
    }

    statusButtons.forEach(button => {
        button.innerHTML = statusIconSvg(button.dataset.status, 'status-icon--large');
        button.addEventListener('click', () => {
            const status = button.dataset.status;
            const commentChanged = commentInput.value.trim() !== myComment;
            // 選んでいるボタンをもう一度押したとき：ひとことを変えていなければ回答を取り消す
            save(status === myStatus && !commentChanged ? null : status);
        });
    });
}

/**
 * @param {object} event - FullCalendar のイベント（中身は api.js の toCalendarEvent を参照）
 */
export function openAttendanceModal(event) {
    const props = event.extendedProps;
    reservationId = event.id;
    myStatus = props.myStatus;
    myComment = props.myComment;
    commentInput.value = myComment;

    setText('attendance-location', props.locationName);
    setText('attendance-court', props.courtNumber || '-');
    setText('attendance-time', `${props.startTime} ～ ${props.endTime}`);
    setText('attendance-note', props.note);
    document.getElementById('attendance-note-row').hidden = !props.note;

    statusBanner.className = `status-banner is-${props.reservationStatus}`;
    statusBanner.textContent = STATUS_MESSAGES[props.reservationStatus];
    document.getElementById('attendance-select').hidden = props.reservationStatus === 'cancelled';

    renderCounts(props.counts);
    renderMembers(props.members);
    document.getElementById('attendance-members').open = false; // メンバー一覧は毎回閉じた状態で開く

    statusButtons.forEach(button => {
        button.classList.toggle('is-selected', button.dataset.status === myStatus);
    });

    openModal(modal);
}

function setText(id, text) {
    document.getElementById(id).textContent = text;
}

// 「〇4 △2 ×1」
function renderCounts(counts) {
    const container = document.getElementById('attendance-counts');
    container.replaceChildren(...STATUS_ORDER.map(status => {
        const item = document.createElement('span');
        item.className = 'count-item';
        item.insertAdjacentHTML('afterbegin', statusIconSvg(status));
        const number = document.createElement('span');
        number.textContent = counts[status];
        item.appendChild(number);
        return item;
    }));
}

// 展開したときのメンバー一覧（〇△×ごと）。ひとことを書いた人は、その印の先頭に横いっぱいで並べる
function renderMembers(members) {
    const container = document.getElementById('attendance-member-list');
    const groups = STATUS_ORDER
        .filter(status => members[status].length > 0)
        .map(status => {
            const group = document.createElement('div');
            group.className = 'member-group';
            group.insertAdjacentHTML('afterbegin', statusIconSvg(status, 'member-group-icon'));

            const list = document.createElement('ul');
            list.className = 'member-list';
            const withComment = members[status].filter(member => member.comment);
            const withoutComment = members[status].filter(member => !member.comment);
            list.append(...[...withComment, ...withoutComment].map(createMemberChip));
            group.appendChild(list);
            return group;
        });

    if (groups.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'member-empty';
        empty.textContent = 'まだ誰も回答していません';
        groups.push(empty);
    }
    container.replaceChildren(...groups);
}

// メンバー1人分（LINE のアイコン＋名前、あればひとこと）。アイコンがない人は名前の頭文字を丸で表示する
function createMemberChip({ name, pictureUrl, comment }) {
    const chip = document.createElement('li');
    chip.className = comment ? 'member has-comment' : 'member';

    let avatar;
    if (pictureUrl?.startsWith('https://')) {
        avatar = document.createElement('img');
        avatar.src = pictureUrl;
        avatar.alt = '';
        avatar.loading = 'lazy';
    } else {
        avatar = document.createElement('span');
        avatar.textContent = Array.from(name)[0] ?? '?';
    }
    avatar.className = 'member-avatar';

    const nameLabel = document.createElement('span');
    nameLabel.className = 'member-name';
    nameLabel.textContent = name;

    chip.append(avatar, nameLabel);
    if (comment) {
        const commentLabel = document.createElement('span');
        commentLabel.className = 'member-comment';
        commentLabel.textContent = comment;
        chip.appendChild(commentLabel);
    }
    return chip;
}
