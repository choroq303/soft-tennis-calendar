// ==========================================
// 施設管理画面（施設のカード一覧と、登録・編集モーダル）
//   カードをタップ → 編集（削除もできる） ／ 「＋ 追加」 → 新規登録
// ==========================================
import { fetchLocations, saveLocation, deleteLocation } from '../api.js';
import { openModal, closeModal } from '../ui/modal.js';
import { withLoading, showError, showFieldError, clearFieldError, clearFieldErrors } from '../ui/feedback.js';
import { confirmDanger } from '../ui/dialog.js';
import { openDrumPicker } from '../ui/drumPicker.js';

const list = document.getElementById('location-list');
const modal = document.getElementById('location-modal');
const titleLabel = document.getElementById('location-modal-title');
const nameInput = document.getElementById('location-name');
const shortNameInput = document.getElementById('location-short-name');
const deadlineField = document.getElementById('location-deadline');
const minField = document.getElementById('location-min');

// ドラムの選択肢：キャンセル期限は 当日〜14日前、最少人数は 1〜30人
const DEADLINE_OPTIONS = Array.from({ length: 15 }, (_, days) => ({ value: String(days), label: formatDeadline(days) }));
const MIN_PARTICIPANTS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}人` }));
const deleteButton = document.getElementById('location-delete-button');

// 編集中の施設（新規登録のときは null）
let editingLocation = null;

/**
 * @param {{ onChanged: () => Promise<void> }} options
 *   onChanged … 施設を保存・削除したあとに呼ばれる（施設名や色はカレンダーにも出るので再読み込みする）
 */
export function setupLocationAdmin({ onChanged }) {
    // 「キャンセル期限」「最少人数」の欄：タップでドラムを開く
    setupDrumField(deadlineField, 'キャンセル期限を選択', DEADLINE_OPTIONS);
    setupDrumField(minField, '最少人数を選択', MIN_PARTICIPANTS_OPTIONS);
    document.getElementById('location-add-button').addEventListener('click', () => openLocationModal(null));

    // カードは読み込むたびに作り直すので、一覧全体でまとめてタップを受け取る
    list.addEventListener('click', (event) => {
        const card = event.target.closest('.location-card');
        if (card) openLocationModal(card.location);
    });

    nameInput.addEventListener('input', () => clearFieldError(nameInput));

    async function save() {
        const location = readForm();
        if (!location.name) {
            showFieldError(nameInput, '正式名称を入力してください');
            return;
        }
        try {
            await withLoading('施設を保存しています...', () => saveLocation(location));
            closeModal(modal);
            await reloadLocationList();
            await onChanged();
        } catch (error) {
            showError('saveLocation', error, { onRetry: save });
        }
    }

    async function remove() {
        try {
            await withLoading('施設を削除しています...', () => deleteLocation(editingLocation.id));
            closeModal(modal);
            await reloadLocationList();
            await onChanged();
        } catch (error) {
            showError('deleteLocation', error, { onRetry: remove });
        }
    }

    document.getElementById('location-save-button').addEventListener('click', save);
    deleteButton.addEventListener('click', async () => {
        const confirmed = await confirmDanger({
            title: `「${editingLocation.name}」を削除しますか？`,
            message: 'この操作は取り消せません。',
            confirmLabel: '削除する'
        });
        if (confirmed) remove();
    });
}

// 施設の一覧を読み込み直してカードを並べる
export async function reloadLocationList() {
    showListMessage('読み込み中...');
    try {
        const locations = await fetchLocations();
        if (locations.length === 0) {
            showListMessage('登録された施設はありません。「＋ 追加」から登録してください。');
            return;
        }
        list.replaceChildren(...locations.map(createLocationCard));
    } catch (error) {
        showListMessage('施設の一覧を読み込めませんでした', true);
        showError('loadLocations', error, { onRetry: reloadLocationList });
    }
}

function showListMessage(text, isError = false) {
    const item = document.createElement('li');
    item.className = isError ? 'location-message is-error' : 'location-message';
    item.textContent = text;
    list.replaceChildren(item);
}

/**
 * 施設のカード
 *   円山庭球場            ›
 *   キャンセル 4日前 ・ 最小 4人
 */
function createLocationCard(location) {
    const item = document.createElement('li');

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'location-card';
    card.location = location; // タップしたときに編集モーダルへ渡す

    const name = document.createElement('span');
    name.className = 'location-name';
    name.textContent = location.name ?? '';

    const details = document.createElement('span');
    details.className = 'location-details';
    details.textContent = `キャンセル ${formatDeadline(location.cancel_deadline)} ・ 最小 ${location.min_participants ?? '-'}人`;

    card.append(name, details);

    item.appendChild(card);
    return item;
}

// 0 → 当日、4 → 4日前
function formatDeadline(days) {
    if (days == null) return '-';
    return days === 0 ? '当日' : `${days}日前`;
}

// ------------------------------------------
// 登録・編集モーダル
// ------------------------------------------

function openLocationModal(location) {
    editingLocation = location;
    titleLabel.textContent = location ? '施設の編集' : '施設の登録';
    clearFieldErrors(modal);
    nameInput.value = location?.name ?? '';
    shortNameInput.value = location?.short_name ?? '';
    setDrumFieldValue(deadlineField, DEADLINE_OPTIONS, String(location?.cancel_deadline ?? 4));
    setDrumFieldValue(minField, MIN_PARTICIPANTS_OPTIONS, String(location?.min_participants ?? 4));
    // 新規登録のときは削除ボタンを隠す（ボタンの並びが崩れないよう visibility で隠す）
    deleteButton.style.visibility = location ? 'visible' : 'hidden';
    openModal(modal);
}

function readForm() {
    return {
        id: editingLocation?.id ?? null,
        name: nameInput.value.trim(),
        shortName: shortNameInput.value.trim(),
        cancelDeadline: Number(deadlineField.dataset.value),
        minParticipants: Number(minField.dataset.value)
    };
}

// タップでドラムを開いて値を選ぶ欄（選んだ値は data-value、表示は欄の文字）
function setupDrumField(field, title, options) {
    field.addEventListener('click', () => {
        openDrumPicker({
            title,
            columns: [{ options, value: field.dataset.value }],
            onConfirm: ([value]) => setDrumFieldValue(field, options, value)
        });
    });
}

function setDrumFieldValue(field, options, value) {
    field.dataset.value = value;
    field.querySelector('.form-trigger-text').textContent = options.find(option => option.value === value)?.label ?? value;
}
