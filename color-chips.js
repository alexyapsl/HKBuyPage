/**
 * Color Chips Renderer (standalone, clean)
 * Renders color selection chips for a given storage option.
 * Uses productBySku (populated from recommendations.json) for hexCode, InStockStatus, estoreExclusive.
 */

window.renderColorChips = function(storageOpt) {
    const section = document.getElementById('color-chips-section');
    const container = document.getElementById('color-chips');
    const hint = document.getElementById('selected-sku-hint');

    if (!section || !container || !storageOpt || !storageOpt.colors || storageOpt.colors.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    // Wait for recommendations data if not loaded yet
    if (!window.productBySku || Object.keys(window.productBySku).length === 0) {
        console.warn('[color-chips] productBySku not ready, deferring...');
        setTimeout(() => window.renderColorChips(storageOpt), 150);
        return;
    }

    section.style.display = '';
    section.classList.remove('hidden');
    container.innerHTML = '';
    if (hint) hint.classList.add('hidden');

    storageOpt.colors.forEach((color, i) => {
        const canonical = window.productBySku[color.sku] || { hexCode: null };
        const isOos = canonical.InStockStatus === 'N' || canonical.inStock === false;
        const isEstoreOnly = !!(canonical.estoreExclusive || canonical.EstoreExclusive || canonical['Estore Exclusive']);

        const chip = document.createElement('div');
        chip.className = 'flex items-center gap-x-2 px-3 py-1.5 border rounded-2xl text-sm transition-all ' +
            (isOos ? 'opacity-40 bg-gray-50' : 'cursor-pointer hover:border-[#007AFF] hover:bg-blue-50');

        const swatchColor = canonical.hexCode || getColorHex(color.name);
        chip.innerHTML =
            '<div class="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0" style="background:' + swatchColor + ';"></div>' +
            '<span class="font-medium text-gray-800">' + color.name + '</span>' +
            (isOos ? '<span class="text-[10px] text-red-500 ml-1">Out of Stock</span>' : '') +
            (isEstoreOnly ? '<span class="text-[10px] text-blue-600 ml-1">Samsung.com Only</span>' : '');

        if (!isOos) {
            chip.onclick = () => {
                container.querySelectorAll('div').forEach(c => c.classList.remove('!border-[#007AFF]', 'ring-1', 'ring-[#007AFF]'));
                chip.classList.add('!border-[#007AFF]', 'ring-1', 'ring-[#007AFF]');
                window.selectedSku = color.sku;
                if (hint) {
                    hint.textContent = 'SKU locked: ' + color.sku;
                    hint.classList.remove('hidden');
                }
                const guard = document.getElementById('sku-guard');
                if (guard) guard.style.display = 'none';
            };

            // Auto-select first available color
            if (i === 0) {
                setTimeout(() => {
                    chip.classList.add('!border-[#007AFF]', 'ring-1', 'ring-[#007AFF]');
                    window.selectedSku = color.sku;
                    if (hint) {
                        hint.textContent = 'SKU locked: ' + color.sku;
                        hint.classList.remove('hidden');
                    }
                    const guard = document.getElementById('sku-guard');
                    if (guard) guard.style.display = 'none';
                }, 60);
            }
        }

        container.appendChild(chip);
    });
};

// Expose productBySku so the standalone renderer can use it
// (main index.html should populate window.productBySku when recommendations.json loads)
if (typeof window.productBySku === 'undefined') {
    window.productBySku = {};
}

/**
 * Hide color chips section (called when storage is cleared)
 */
window.hideColorChips = function() {
    const section = document.getElementById('color-chips-section');
    const container = document.getElementById('color-chips');
    const hint = document.getElementById('selected-sku-hint');

    if (section) section.style.display = 'none';
    if (container) container.innerHTML = '';
    if (hint) hint.classList.add('hidden');

    // Also clear any selected SKU so trade-in guard re-engages
    if (typeof window.selectedSku !== 'undefined') {
        window.selectedSku = null;
    }
};