// ==========================================
// モーダルの開閉（すべてのモーダル共通）
// HTML 側は <div class="modal-overlay"> で囲み、閉じるボタンに data-close-modal を付けるだけでよい。
// ==========================================

export function openModal(modal) {
    modal.classList.add('is-open');
}

export function closeModal(modal) {
    modal.classList.remove('is-open');
}

// 背景（暗い部分）のタップと、data-close-modal の付いたボタンで閉じられるようにする
// （ダイアログ #dialog-modal は、押したボタンを返す都合で js/ui/dialog.js が自分で閉じる）
export function setupModalClosing() {
    document.querySelectorAll('.modal-overlay:not(#dialog-modal)').forEach(overlay => {
        overlay.addEventListener('click', (event) => {
            const isBackground = event.target === overlay;
            const isCloseButton = event.target.closest('[data-close-modal]');
            if (isBackground || isCloseButton) closeModal(overlay);
        });
    });
}
