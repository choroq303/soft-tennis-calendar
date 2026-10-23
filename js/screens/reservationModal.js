// ==========================================
// 練習の登録・編集モーダル（「練習管理」画面で開く）
//   日付の「＋」・セル・「＋ 練習を追加」 → 新規登録 ／ 予定をタップ → 編集（削除もできる）
// ==========================================
import { fetchLocations, saveReservation, deleteReservation } from '../api.js';
import { openModal, closeModal } from '../ui/modal.js';
import { withLoading, showError, showFieldError, clearFieldError, clearFieldErrors } from '../ui/feedback.js';
import { confirmDanger, showDialog } from '../ui/dialog.js';
import { openDrumPicker } from '../ui/drumPicker.js';
import { RESERVATION_STATUSES, DEFAULT_RESERVATION_STATUS } from '../reservationStatus.js';

const modal = document.getElementById('reservation-modal');
const titleLabel = document.getElementById('reservation-modal-title');
const dateInput = document.getElementById('reservation-date');
const statusPicker = document.getElementById('reservation-status');
const locationField = document.getElementById('reservation-location');
const locationText = locationField.querySelector('.form-trigger-text');
const courtInput = document.getElementById('reservation-court');
const noteInput = document.getElementById('reservation-note');
const timeField = document.getElementById('reservation-time');
const timeText = document.getElementById('reservation-time-text');
const deleteButton = document.getElementById('reservation-delete-button');

// 時間のドラムの選択肢：00:00〜23:00 の1時間ごと（分は選ばない。値は「時」の2桁）
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, '0');
    return { value, label: `${value}:00` };
});

// 編集中の予定のID（新規登録のときは null）
let editingId = null;
// 場所のドラムの選択肢（モーダルを開くたびに読み込み直す）
let locationOptions = [];

/**
 * @param {{ onSaved: () => Promise<void> }} options
 *   onSaved … 保存・削除したあとに呼ばれる（カレンダーの再読み込み）
 */
export function setupReservationModal({ onSaved }) {
    createStatusOptions();
    timeField.addEventListener('click', openTimePicker);
    locationField.addEventListener('click', openLocationPicker);
    dateInput.addEventListener('change', () => clearFieldError(dateInput));

    async function save() {
        const reservation = readForm();
        if (!reservation.date) {
            showFieldError(dateInput, '日付を選択してください');
            return;
        }
        if (!reservation.locationId) {
            showFieldError(locationField, '場所を選択してください');
            return;
        }
        try {
            await withLoading(() => saveReservation(reservation));
            closeModal(modal);
            await onSaved();
        } catch (error) {
            showError('saveReservation', error, { onRetry: save, onRefresh: () => { closeModal(modal); onSaved(); } });
        }
    }

    async function remove() {
        try {
            await withLoading(() => deleteReservation(editingId));
            closeModal(modal);
            await onSaved();
        } catch (error) {
            showError('deleteReservation', error, { onRetry: remove });
        }
    }

    document.getElementById('reservation-save-button').addEventListener('click', save);
    deleteButton.addEventListener('click', async () => {
        const confirmed = await confirmDanger({
            title: 'この練習を削除しますか？',
            message: '出欠の回答も一緒に消えます。',
            confirmLabel: '削除する'
        });
        if (confirmed) remove();
    });
}

// 新しい予定として開く（date は 'YYYY-MM-DD'。モーダルの中で変更もできる）
export async function openNewReservation(date) {
    editingId = null;
    await fillForm({
        title: '練習の登録',
        date,
        locationId: '',
        courtNumber: '',
        startTime: '19:00',
        endTime: '21:00',
        note: '',
        reservationStatus: DEFAULT_RESERVATION_STATUS
    });
    openModal(modal);
}

// 予定をタップしたとき：その予定の編集として開く
export async function openEditReservation(event) {
    const props = event.extendedProps;
    editingId = event.id;
    await fillForm({
        title: `${event.title} の編集`,
        date: props.date,
        locationId: props.locationId,
        courtNumber: props.courtNumber,
        // 時刻が空の古いデータでも、ドラムで選べるよう初期値を入れる
        startTime: props.startTime || '19:00',
        endTime: props.endTime || '21:00',
        note: props.note,
        reservationStatus: props.reservationStatus
    });
    openModal(modal);
}

async function fillForm({ title, date, locationId, courtNumber, startTime, endTime, note, reservationStatus }) {
    titleLabel.textContent = title;
    clearFieldErrors(modal);
    dateInput.value = date;
    statusPicker.querySelectorAll('input').forEach(radio => {
        radio.checked = radio.value === reservationStatus;
    });
    await loadLocationOptions();
    setLocation(locationId);
    courtInput.value = courtNumber;
    setTimeRange(startTime, endTime);
    noteInput.value = note;
    // 新規登録のときは削除ボタンを隠す（ボタンの並びが崩れないよう visibility で隠す）
    deleteButton.style.visibility = editingId ? 'visible' : 'hidden';
}

function readForm() {
    const { start, end } = timeField.dataset;
    return {
        id: editingId,
        date: dateInput.value,
        locationId: locationField.dataset.value,
        courtNumber: courtInput.value.trim(),
        startTime: start,
        endTime: end,
        note: noteInput.value.trim(),
        reservationStatus: statusPicker.querySelector('input:checked')?.value ?? DEFAULT_RESERVATION_STATUS
    };
}

// ------------------------------------------
// 時間（「19:00 ～ 21:00」の欄。タップで「開始 ～ 終了」のドラムを開く）
// ------------------------------------------

function setTimeRange(start, end) {
    timeField.dataset.start = start;
    timeField.dataset.end = end;
    timeText.textContent = `${start} ～ ${end}`;
}

// 時：分のうち「時」だけを選ぶ。「決定」を押すと分は :00 になる
// （ドラムを開かずに保存すれば、既存の予定の 18:30 などはそのまま残る）
function openTimePicker() {
    const startHour = timeField.dataset.start.split(':')[0];
    const endHour = timeField.dataset.end.split(':')[0];
    openDrumPicker({
        title: '時間を選択',
        columns: [
            { options: HOUR_OPTIONS, value: startHour },
            '～',
            { options: HOUR_OPTIONS, value: endHour }
        ],
        onConfirm: ([newStartHour, newEndHour]) => {
            const start = `${newStartHour}:00`;
            const end = `${newEndHour}:00`;
            if (start >= end) {
                return '終了時刻は開始時刻より後にしてください';
            }
            setTimeRange(start, end);
        }
    });
}

// ステータスの選択肢（js/reservationStatus.js）を、横に並んだボタンとして作る
function createStatusOptions() {
    statusPicker.replaceChildren(...RESERVATION_STATUSES.map(({ value, label }) => {
        const option = document.createElement('label');
        option.className = `segmented-option is-${value}`;

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'reservation-status';
        radio.value = value;

        const text = document.createElement('span');
        text.textContent = label;

        option.append(radio, text);
        return option;
    }));
}

// ------------------------------------------
// 場所（タップで登録済みの施設のドラムを開く）
// ------------------------------------------

async function loadLocationOptions() {
    try {
        const locations = await fetchLocations();
        locationOptions = locations.map(location => ({ value: String(location.id), label: location.name }));
    } catch (error) {
        locationOptions = [];
        showError('loadLocations', error);
    }
}

// id が空（新規登録）や、一覧にない施設のときは「施設を選択してください」を出す
function setLocation(id) {
    const option = locationOptions.find(option => option.value === String(id ?? ''));
    locationField.dataset.value = option ? option.value : '';
    locationText.textContent = option ? option.label : '施設を選択してください';
    locationText.classList.toggle('is-placeholder', !option);
}

function openLocationPicker() {
    if (locationOptions.length === 0) {
        showDialog({
            title: '施設が登録されていません',
            message: '先に、メニューの「施設管理」から施設を登録してください。',
            buttons: [{ label: '閉じる', value: 'close', style: 'primary' }]
        });
        return;
    }
    openDrumPicker({
        title: '場所を選択',
        // まだ選んでいないときは、一番上の施設から
        columns: [{ options: locationOptions, value: locationField.dataset.value }],
        onConfirm: ([value]) => {
            setLocation(value);
            clearFieldError(locationField);
        }
    });
}
