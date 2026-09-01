() => {
    const items = [];
    for (const el of document.querySelectorAll('[data-asin]')) {
        const asin = el.dataset.asin;
        if (!asin || asin.length < 5) continue;

        let title = '';
        const titleEl = el.querySelector(
            '.a-truncate-full, .sc-product-title, .a-truncate-cut, a[href*="/dp/"]'
        );
        if (titleEl) title = titleEl.textContent.replace(/\s+/g, ' ').trim();
        if (!title) continue;
        // A `.a-truncate-cut` + hidden `.a-truncate-full` sibling makes
        // textContent repeat the title ("Foo Bar 24 OZFoo Bar…") — cut at the
        // point the opening chunk repeats.
        if (title.length > 24) {
            const probe = title.slice(0, 15);
            const repeat = title.indexOf(probe, 8);
            if (repeat > 0) title = title.slice(0, repeat).trim();
        }

        // Extract quantity: try multiple approaches
        let qty = '1';

        // 1. Look for the quantity number in the stepper/dropdown widget
        const qtyNum = el.querySelector('span[id^="qs-widget-quantity"]');
        if (qtyNum) {
            // Get only direct text, not child element text
            const num = qtyNum.textContent.trim().replace(/[^0-9]/g, '');
            if (num) qty = num;
        }

        // 2. Fallback: dropdown prompt
        if (qty === '1') {
            const dd = el.querySelector('.a-dropdown-prompt');
            if (dd) {
                const num = dd.textContent.trim().replace(/[^0-9]/g, '');
                if (num) qty = num;
            }
        }

        // 3. Fallback: input field
        if (qty === '1') {
            const inp = el.querySelector('input[name="quantity"]');
            if (inp && inp.value) qty = inp.value;
        }

        // 4. Fallback: data attribute
        if (qty === '1') {
            const dq = el.getAttribute('data-quantity');
            if (dq && dq !== '0') qty = dq;
        }

        // 5. Fallback: look for stepper value display (common in WF cart)
        if (qty === '1') {
            const stepper = el.querySelector('.qs-widget-stepper-value, .sc-quantity-stepper-value');
            if (stepper) {
                const num = stepper.textContent.trim().replace(/[^0-9]/g, '');
                if (num) qty = num;
            }
        }

        // 6. Fallback: find any bold number near a minus/plus button
        if (qty === '1') {
            for (const span of el.querySelectorAll('span.a-size-base.a-text-bold')) {
                const num = span.textContent.trim();
                if (/^\d+$/.test(num) && parseInt(num) > 0) {
                    qty = num;
                    break;
                }
            }
        }

        let price = '';
        const priceEl = el.querySelector('.a-price .a-offscreen, .sc-product-price');
        if (priceEl) price = priceEl.textContent.trim();

        items.push({ asin, title: title.substring(0, 80), quantity: qty, price });
    }

    let subtotal = '';
    const subtotalEl = document.querySelector('#sc-subtotal-amount-activecart .a-price .a-offscreen, .sc-subtotal');
    if (subtotalEl) subtotal = subtotalEl.textContent.trim();

    return { items, subtotal };
}
