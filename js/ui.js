export function showLoading() {
    const el = document.getElementById('common-loading');
    if (el) el.style.display = 'flex';
}

export function hideLoading() {
    const el = document.getElementById('common-loading');
    if (el) el.style.display = 'none';
}

export function generateDrumTimeOptions() {
    const startDrum = document.querySelector('.start-drum');
    const endDrum = document.querySelector('.end-drum');
    if (!startDrum || !endDrum) return;

    startDrum.innerHTML = '';
    endDrum.innerHTML = '';

    for (let hour = 0; hour < 24; hour++) {
        const hourStr = String(hour).padStart(2, '0');
        const timeValue = `${hourStr}:00`;

        const itemStart = document.createElement('div');
        itemStart.className = 'drum-item';
        itemStart.textContent = timeValue;
        itemStart.dataset.time = timeValue;
        startDrum.appendChild(itemStart);

        const itemEnd = document.createElement('div');
        itemEnd.className = 'drum-item';
        itemEnd.textContent = timeValue;
        itemEnd.dataset.time = timeValue;
        endDrum.appendChild(itemEnd);
    }
}

export function setupModals() {
    const userModal = document.getElementById('user-modal');
    const adminModal = document.getElementById('admin-modal');
    const userModalCloseBtn = document.getElementById('modal-close-btn');
    const adminModalCloseBtn = document.getElementById('admin-modal-close');

    if (userModalCloseBtn && userModal) {
        userModalCloseBtn.addEventListener('click', () => userModal.classList.remove('active'));
    }
    if (userModal) {
        userModal.addEventListener('click', (e) => {
            if (e.target === userModal) userModal.classList.remove('active');
        });
    }
    if (adminModalCloseBtn && adminModal) {
        adminModalCloseBtn.addEventListener('click', () => adminModal.classList.remove('active'));
    }
    if (adminModal) {
        adminModal.addEventListener('click', (e) => {
            if (e.target === adminModal) adminModal.classList.remove('active');
        });
    }
}