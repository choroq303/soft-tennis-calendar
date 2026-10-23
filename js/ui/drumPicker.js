// ==========================================
// ドラムを回して値を選ぶダイアログ（すべての「選ぶ欄」で共通）
//   練習の日付以外の「選ぶ欄」：時間（開始 ～ 終了）・場所、施設のキャンセル期限・最少人数で使う
// ==========================================
import { openModal, closeModal } from './modal.js';

// ドラム1行の高さ（css/modals.css の .drum-item と合わせる）
const ITEM_HEIGHT = 40;

const modal = document.getElementById('drum-picker-modal');
const titleLabel = document.getElementById('drum-picker-title');
const row = document.getElementById('drum-picker-row');
const errorLabel = document.getElementById('drum-picker-error');

// いま開いているダイアログのドラムと、「決定」で呼ぶ処理
let drums = [];
let handleConfirm = null;

export function setupDrumPicker() {
    document.getElementById('drum-picker-confirm').addEventListener('click', () => {
        const values = drums.map(getDrumValue);
        // handleConfirm が文字を返したら（選んだ値が正しくないなど）、それをドラムの下に出して閉じない
        const error = handleConfirm(values);
        if (typeof error === 'string') {
            errorLabel.textContent = error;
            errorLabel.hidden = false;
            return;
        }
        closeModal(modal);
    });
}

/**
 * ドラムのダイアログを開く
 * @param {object} params
 * @param {string} params.title - ダイアログの見出し
 * @param {Array<{ options: Array<{ value: string, label: string }>, value: string } | string>} params.columns
 *   ドラムの列（左から順）。文字列を入れると、その位置に区切りの文字（「：」「～」など）を出す
 * @param {(values: string[]) => string | void} params.onConfirm
 *   「決定」で、各ドラムで選んだ値を左から順に受け取る。文字を返すと、それをエラーとして出してダイアログを閉じない
 * @example
 *   openDrumPicker({
 *       title: '最少人数を選択',
 *       columns: [{ options: [{ value: '4', label: '4人' }, ...], value: '4' }],
 *       onConfirm: ([value]) => { ... }
 *   });
 */
export function openDrumPicker({ title, columns, onConfirm }) {
    titleLabel.textContent = title;
    errorLabel.hidden = true;
    handleConfirm = onConfirm;
    drums = [];

    row.replaceChildren(...columns.map(column => {
        if (typeof column === 'string') {
            const separator = document.createElement('span');
            separator.className = 'drum-separator';
            separator.textContent = column;
            return separator;
        }
        const drum = createDrum(column.options);
        // 指の操作（setupTouch）と同じオブジェクトを使う（コピーすると位置の記録が食い違う）
        drums.push(Object.assign(drum, { initialValue: column.value }));
        return drum.element;
    }));

    drums.forEach(drum => scrollToValue(drum, drum.initialValue));
    openModal(modal);
}

// ------------------------------------------
// ドラム1本の動き
// ブラウザのスクロールは使わず、指の動きから位置を計算して動かす（スマホの標準の部品に近い操作感にするため）。
//   ・指で動かす      … 指に合わせて動く。端より先は重くなる
//   ・はじく          … 速さに応じて慣性で回り、だんだん遅くなって、ちょうど項目の位置で止まる
//   ・回っている途中で触る … その場で止まる（このタッチでは選び直さない）
//   ・止まっているときにタップ … その項目まで回る
// 位置（pos）は「一番上の項目が真ん中にあるとき 0」で、下の項目ほど大きい（px）
// ------------------------------------------

// 慣性で回る時間の目安（ms）。大きいほど長く回る
const MOMENTUM_TIME = 325;
// はじいたときの速さを、どれだけ移動距離に変えるか
const MOMENTUM_POWER = 0.8;
// 指を動かしたのがこれ未満（px）なら、タップとして扱う
const TAP_THRESHOLD = 6;
// 端より先に引っぱったときの重さ（指の動きのうち、この割合だけ動く）
const RUBBER_BAND = 0.35;

function createDrum(options) {
    const element = document.createElement('div');
    element.className = 'drum';

    const highlight = document.createElement('div');
    highlight.className = 'drum-highlight';

    // list は見える窓、track が中身（transform で上下に動かす）
    const list = document.createElement('div');
    list.className = 'drum-list';
    const track = document.createElement('div');
    track.className = 'drum-track';
    track.append(...options.map(({ value, label }) => {
        const item = document.createElement('div');
        item.className = 'drum-item';
        item.dataset.value = value;
        item.textContent = label;
        return item;
    }));
    list.appendChild(track);
    element.append(highlight, list);

    const drum = {
        element, track, options,
        pos: 0,
        maxPos: (options.length - 1) * ITEM_HEIGHT,
        centerIndex: -1,
        animation: null // { frame, target }：回っている途中のとき
    };
    setupTouch(drum, list);
    return drum;
}

function setupTouch(drum, list) {
    let drag = null; // 指を置いているあいだの情報

    list.addEventListener('pointerdown', (event) => {
        list.setPointerCapture(event.pointerId);
        // 回っている途中なら、その場で止める
        const wasMoving = Boolean(drum.animation);
        stopAnimation(drum);
        drag = {
            startY: event.clientY,
            startPos: drum.pos,
            moved: 0,
            wasMoving,
            target: event.target,
            samples: [{ y: event.clientY, time: event.timeStamp }]
        };
    });

    list.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const delta = event.clientY - drag.startY;
        drag.moved = Math.max(drag.moved, Math.abs(delta));
        setPos(drum, withRubberBand(drum, drag.startPos - delta));
        // 速さを測るため、直近 100ms 分の指の位置を覚えておく
        drag.samples.push({ y: event.clientY, time: event.timeStamp });
        while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].time > 100) drag.samples.shift();
    });

    const release = (event) => {
        if (!drag) return;
        const { moved, wasMoving, target: touched, samples } = drag;
        drag = null;

        if (moved < TAP_THRESHOLD) {
            // タップ：回っている途中を止めただけなら、そこから一番近い項目に合わせる。
            // 止まっているときにタップしたなら、その項目まで回す
            const item = !wasMoving && touched.closest('.drum-item');
            const index = item ? [...drum.track.children].indexOf(item) : Math.round(drum.pos / ITEM_HEIGHT);
            animateTo(drum, clampIndex(drum, index) * ITEM_HEIGHT, 200);
            return;
        }

        // はじいた速さ（px/ms。上にはじくと正 = 下の項目へ進む）
        const first = samples[0];
        const last = { y: event.clientY, time: event.timeStamp };
        const elapsed = Math.max(last.time - first.time, 1);
        const velocity = last.time - first.time > 150 ? 0 : (first.y - last.y) / elapsed;

        // 慣性で進む距離から止まる位置を決め、ちょうど項目の位置に合わせる
        const projected = drum.pos + velocity * MOMENTUM_TIME * MOMENTUM_POWER * 2;
        const target = clampIndex(drum, Math.round(projected / ITEM_HEIGHT)) * ITEM_HEIGHT;
        animateTo(drum, target, MOMENTUM_TIME);
    };
    list.addEventListener('pointerup', release);
    list.addEventListener('pointercancel', release);
}

// 端より先は、指の動きの一部だけ動く（ゴムのように重くなる）
function withRubberBand(drum, pos) {
    if (pos < 0) return pos * RUBBER_BAND;
    if (pos > drum.maxPos) return drum.maxPos + (pos - drum.maxPos) * RUBBER_BAND;
    return pos;
}

function clampIndex(drum, index) {
    return Math.max(0, Math.min(index, drum.options.length - 1));
}

// target まで、最初は速く・だんだん遅くなるように動かす（time ms で、ほぼ止まる）
function animateTo(drum, target, time) {
    stopAnimation(drum);
    const from = drum.pos;
    const distance = target - from;
    if (Math.abs(distance) < 0.5) {
        setPos(drum, target);
        return;
    }
    const start = performance.now();
    const step = (now) => {
        const elapsed = now - start;
        // 指数関数的に減速する（スマホのスクロールと同じ考え方）。6倍の時間で止めきる
        const progress = 1 - Math.exp(-elapsed / time);
        if (elapsed >= time * 6 || Math.abs(distance * (1 - progress)) < 0.5) {
            setPos(drum, target);
            drum.animation = null;
            return;
        }
        setPos(drum, from + distance * progress);
        drum.animation.frame = requestAnimationFrame(step);
    };
    drum.animation = { target, frame: requestAnimationFrame(step) };
}

function stopAnimation(drum) {
    if (!drum.animation) return;
    cancelAnimationFrame(drum.animation.frame);
    drum.animation = null;
}

function setPos(drum, pos) {
    drum.pos = pos;
    drum.track.style.transform = `translateY(${-pos}px)`;
    markCenterItem(drum);
}

function scrollToValue(drum, value) {
    const index = Math.max(0, drum.options.findIndex(option => option.value === value));
    stopAnimation(drum);
    setPos(drum, index * ITEM_HEIGHT);
}

// 中央の帯にいちばん近い項目の番号
function getCenterIndex(drum) {
    return clampIndex(drum, Math.round(drum.pos / ITEM_HEIGHT));
}

// 真ん中（選ばれる位置）に来た項目を濃く大きく見せる
function markCenterItem(drum) {
    const index = getCenterIndex(drum);
    if (index === drum.centerIndex) return;
    drum.track.children[drum.centerIndex]?.classList.remove('is-center');
    drum.track.children[index]?.classList.add('is-center');
    drum.centerIndex = index;
}

// 選んでいる値。回っている途中なら、止まる予定の項目の値
function getDrumValue(drum) {
    const pos = drum.animation ? drum.animation.target : drum.pos;
    return drum.options[clampIndex(drum, Math.round(pos / ITEM_HEIGHT))].value;
}
