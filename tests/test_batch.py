"""Integration tests for the batch cart tools and ping.

Live — hits Amazon; skipped without a saved session (see conftest.py).
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import server


def parse(result: str):
    return json.loads(result)


async def first_asin(query: str) -> str:
    results = parse(await server.search_whole_foods(query))
    assert results, f"No search results for '{query}'"
    return results[0]["asin"]


class TestPing:
    async def test_ping_is_fast_and_ok(self):
        start = time.monotonic()
        out = parse(await server.ping())
        assert time.monotonic() - start < 5
        assert out["ok"] is True
        assert out["logged_in"] is True


class TestAddMany:
    async def test_add_many_puts_every_item_in_the_cart(self, clean_cart):
        a1 = await first_asin("cheerios")
        a2 = await first_asin("oat milk")

        out = parse(await server.add_many([
            {"asin": a1, "quantity": 1},
            {"asin": a2, "quantity": 2},
        ]))
        assert len(out) == 2
        assert all(e["success"] for e in out), out

        cart = parse(await server.view_cart())
        cart_asins = {i["asin"] for i in cart["items"]}
        # the ASIN reported by add_many must be the one actually in the cart
        for entry in out:
            assert entry["asin"] in cart_asins, (entry, cart_asins)

    async def test_add_many_reports_a_bad_asin_without_sinking_the_batch(self, clean_cart):
        good = await first_asin("cheerios")
        out = parse(await server.add_many([
            {"asin": "INVALIDASIN0", "quantity": 1},
            {"asin": good, "quantity": 1},
        ]))
        assert out[0]["success"] is False and "reason" in out[0]
        assert out[1]["success"] is True


class TestRemoveMany:
    async def test_remove_many_clears_the_listed_items(self, clean_cart):
        a1 = await first_asin("cheerios")
        a2 = await first_asin("oat milk")
        added = parse(await server.add_many([{"asin": a1}, {"asin": a2}]))
        cart_asins = [e["asin"] for e in added]

        out = parse(await server.remove_many(cart_asins))
        assert all(e["removed"] for e in out), out

        cart = parse(await server.view_cart())
        remaining = {i["asin"] for i in cart["items"]}
        assert not (set(cart_asins) & remaining)
