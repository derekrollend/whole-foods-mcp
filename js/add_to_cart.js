async ({asin, quantity}) => {
    // Fetch product page for fresh ATC data
    const resp = await fetch(`/dp/${asin}?almBrandId=VUZHIFdob2xlIEZvb2Rz&fpw=alm&s=wholefoods`, {
        credentials: 'include', headers: { 'Accept': 'text/html' }
    });
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Extract product info
    const titleEl = doc.querySelector('#productTitle');
    const title = titleEl ? titleEl.textContent.trim() : '';

    const priceEl = doc.querySelector('.a-price .a-offscreen');
    const price = priceEl ? priceEl.textContent.trim() : '';

    // Extract add-to-cart payload
    const atcEl = doc.querySelector('[data-action="fresh-add-to-cart"]');
    if (!atcEl) {
        return { success: false, requested_asin: asin, reason: 'Item unavailable at this store (no add-to-cart on product page)' };
    }

    let atcData;
    try {
        atcData = JSON.parse(atcEl.getAttribute('data-fresh-add-to-cart'));
    } catch(e) {
        return { success: false, requested_asin: asin, reason: 'Failed to parse add-to-cart data' };
    }

    // Add to cart
    const payload = { ...atcData };
    if (quantity > 1) payload.quantity = quantity;

    const addResp = await fetch('/alm/addtofreshcart', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!addResp.ok) {
        return { success: false, requested_asin: asin, reason: 'Item unavailable at this store (HTTP ' + addResp.status + ')' };
    }

    // The cart row's data-asin can differ from the product-page ASIN for
    // variant products, so remove_from_cart / dedup-by-asin needs the *real*
    // one. It rides in the ATC payload and/or the POST response body. Prefer,
    // in order: the response body's asin, the payload's asin, the input.
    let respJson = null;
    try { respJson = await addResp.clone().json(); } catch(e) { /* not JSON */ }

    const dig = (obj, depth = 0) => {
        // shallow recursive hunt for an ASIN-shaped string under an asin-ish key
        if (!obj || typeof obj !== 'object' || depth > 4) return '';
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && /asin/i.test(k) && /^[A-Z0-9]{10}$/.test(v)) return v;
        }
        for (const v of Object.values(obj)) {
            if (v && typeof v === 'object') {
                const hit = dig(v, depth + 1);
                if (hit) return hit;
            }
        }
        return '';
    };

    const respAsin = dig(respJson);
    const payloadAsin = (typeof atcData.asin === 'string' && /^[A-Z0-9]{10}$/.test(atcData.asin))
        ? atcData.asin : '';
    const realAsin = respAsin || payloadAsin || asin;

    return {
        success: true,
        requested_asin: asin,
        asin: realAsin,
        cart_asin: respAsin,
        atc_asin: payloadAsin,
        title, price,
        quantity: payload.quantity || quantity || 1,
        // debug — remove once the field above is confirmed against a live cart
        _atc_payload: atcData,
        _add_response: respJson,
    };
}
