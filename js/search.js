async (query) => {
    const resp = await fetch(`/s?k=${encodeURIComponent(query)}&i=wholefoods`, {
        credentials: 'include',
        headers: { 'Accept': 'text/html' }
    });
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const results = [];

    for (const el of doc.querySelectorAll('[data-asin]')) {
        const asin = el.dataset.asin;
        if (!asin || asin.length < 5) continue;

        // Title
        let title = '';
        for (const sel of ['h2 a span', '.a-text-normal']) {
            const t = el.querySelector(sel);
            if (t && t.textContent.trim().length > 5) {
                title = t.textContent.trim();
                break;
            }
        }
        if (!title) {
            const link = el.querySelector('h2 a');
            if (link) title = link.textContent.trim();
        }
        if (!title || title.length < 3) continue;

        // Price
        let price = '';
        const priceEl = el.querySelector('.a-price .a-offscreen');
        if (priceEl) price = priceEl.textContent.trim();

        // Description
        let description = '';
        const descEls = el.querySelectorAll('.a-size-base-plus, .a-color-base:not(h2 span)');
        for (const d of descEls) {
            const t = d.textContent.trim();
            if (t.length > 10 && t !== title && !t.startsWith('$')) {
                description = t.substring(0, 150);
                break;
            }
        }

        // Size/weight — Amazon drops social-proof text ("50K+ bought in past
        // month", "Typical: $4.99") into the very same classes, so match a
        // size-shaped string rather than trusting a position.
        const SIZE_RE = /\b\d+(\.\d+)?\s*(fl\s?oz|oz|ounce|lb|pound|ct|count|each|gram|g|kg|ml|milliliter|liter|l|pack|pk|dozen|quart|qt|pint|pt|gallon|gal)\b/i;
        const NOT_SIZE = /bought in past|typical price|coupon|subscribe|save \d|\$/i;
        let size = '';
        const titleMatch = title.match(SIZE_RE);
        if (titleMatch) size = titleMatch[0].replace(/\s+/g, ' ').trim();
        if (!size) {
            for (const c of el.querySelectorAll(
                '.a-size-base.a-color-secondary, .a-row .a-size-base, .a-size-mini, .a-size-base'
            )) {
                const t = c.textContent.trim();
                if (t.length < 40 && SIZE_RE.test(t) && !NOT_SIZE.test(t)) {
                    size = t;
                    break;
                }
            }
        }

        // Check if add-to-cart data exists (indicates availability)
        const atcEl = el.querySelector('[data-action="fresh-add-to-cart"]');

        // Thumbnail
        let image = '';
        const imgEl = el.querySelector('img.s-image, .s-image img, [data-component-type="s-product-image"] img');
        if (imgEl) image = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';

        results.push({ asin, title, price, canAddToCart: !!atcEl, description, size, image });
    }
    return results;
}
