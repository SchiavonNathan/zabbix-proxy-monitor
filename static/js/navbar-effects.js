document.addEventListener('DOMContentLoaded', function() {
    const brandIcon = document.querySelector('.brand-icon');
    if (brandIcon) {
        setInterval(() => {
            brandIcon.classList.add('pulse-animation');
            setTimeout(() => {
                brandIcon.classList.remove('pulse-animation');
            }, 1000);
        }, 3000);
    }
    
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function(tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
});