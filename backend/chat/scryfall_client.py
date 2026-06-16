"""
Scryfall API client for fetching accurate MTG card data.

Scryfall provides free access to MTG card data with reasonable rate limits
(10 requests/second). We use this to verify card names and fetch card text
so Claude can reason about synergies with accurate information.
"""

import logging
import urllib.request
import urllib.parse
import json
from typing import Optional

logger = logging.getLogger(__name__)

SCRYFALL_API_BASE = "https://api.scryfall.com"


def fetch_card(card_name: str) -> Optional[dict]:
    """
    Fetch a card by exact name from Scryfall.

    Args:
        card_name: The card name to look up (e.g., "Lightning Bolt")

    Returns:
        Card data dict if found, None if not found or on error.
        Key fields: name, mana_cost, type_line, oracle_text, legalities
    """
    try:
        encoded_name = urllib.parse.quote(card_name)
        url = f"{SCRYFALL_API_BASE}/cards/named?exact={encoded_name}"

        req = urllib.request.Request(url, headers={
            "User-Agent": "LotusBot/1.0",
            "Accept": "application/json"
        })

        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return {
                "name": data.get("name"),
                "mana_cost": data.get("mana_cost", ""),
                "type_line": data.get("type_line", ""),
                "oracle_text": data.get("oracle_text", ""),
                "legalities": data.get("legalities", {}),
                "keywords": data.get("keywords", []),
                "power": data.get("power"),
                "toughness": data.get("toughness"),
                "colors": data.get("colors", []),
                "color_identity": data.get("color_identity", []),
            }
    except urllib.error.HTTPError as e:
        if e.code == 404:
            logger.info(f"Card not found: {card_name}")
        else:
            logger.warning(f"Scryfall API error for '{card_name}': {e}")
        return None
    except Exception as e:
        logger.warning(f"Failed to fetch card '{card_name}': {e}")
        return None


def fetch_card_fuzzy(card_name: str) -> Optional[dict]:
    """
    Fetch a card by fuzzy name matching from Scryfall.
    Useful when the user or model uses an inexact name.

    Args:
        card_name: The approximate card name

    Returns:
        Card data dict if found, None if not found or on error.
    """
    try:
        encoded_name = urllib.parse.quote(card_name)
        url = f"{SCRYFALL_API_BASE}/cards/named?fuzzy={encoded_name}"

        req = urllib.request.Request(url, headers={
            "User-Agent": "LotusBot/1.0",
            "Accept": "application/json"
        })

        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return {
                "name": data.get("name"),
                "mana_cost": data.get("mana_cost", ""),
                "type_line": data.get("type_line", ""),
                "oracle_text": data.get("oracle_text", ""),
                "legalities": data.get("legalities", {}),
                "keywords": data.get("keywords", []),
                "power": data.get("power"),
                "toughness": data.get("toughness"),
                "colors": data.get("colors", []),
                "color_identity": data.get("color_identity", []),
            }
    except Exception as e:
        logger.warning(f"Failed fuzzy fetch for '{card_name}': {e}")
        return None


def _execute_search(query: str, limit: int = 30) -> list[dict]:
    """
    Internal function to execute a Scryfall search.
    
    Args:
        query: Full Scryfall query string (including order, price filters, etc.)
        limit: Maximum number of results to return
    
    Returns:
        List of card data dicts with price information.
    """
    import time
    time.sleep(0.1)  # Rate limiting: 100ms between requests

    try:
        encoded_query = urllib.parse.quote(query)
        url = f"{SCRYFALL_API_BASE}/cards/search?q={encoded_query}"

        req = urllib.request.Request(url, headers={
            "User-Agent": "LotusBot/1.0",
            "Accept": "application/json"
        })

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            cards = []
            for card in data.get("data", [])[:limit]:
                # Get USD price (cheapest printing)
                prices = card.get("prices", {})
                usd_price = prices.get("usd") or prices.get("usd_foil")

                cards.append({
                    "name": card.get("name"),
                    "mana_cost": card.get("mana_cost", ""),
                    "type_line": card.get("type_line", ""),
                    "oracle_text": card.get("oracle_text", ""),
                    "legalities": card.get("legalities", {}),
                    "keywords": card.get("keywords", []),
                    "power": card.get("power"),
                    "toughness": card.get("toughness"),
                    "colors": card.get("colors", []),
                    "color_identity": card.get("color_identity", []),
                    "cmc": card.get("cmc", 0),
                    "rarity": card.get("rarity", ""),
                    "usd": usd_price,
                })
            return cards
    except urllib.error.HTTPError as e:
        if e.code == 404:
            logger.info(f"No cards found for query: {query}")
        else:
            logger.warning(f"Scryfall search error for '{query}': {e}")
        return []
    except Exception as e:
        logger.warning(f"Failed to search cards with query '{query}': {e}")
        return []


def search_cards(query: str, limit: int = 30, budget_cap: float = None) -> list[dict]:
    """
    Search for cards matching a Scryfall query with automatic retry.

    Args:
        query: Scryfall search syntax (e.g., "o:draw t:instant c:blue f:commander")
               Should NOT include order= or usd< - these are added automatically
        limit: Maximum number of results to return
        budget_cap: Optional price ceiling in USD (adds usd<X to query)

    Returns:
        List of card data dicts with price information, sorted by EDHREC popularity.
        Automatically retries without price filter if no results found.
    """
    # Build full query with EDHREC sorting
    full_query = f"{query} order=edhrec"
    if budget_cap and budget_cap > 0:
        full_query = f"{query} usd<{budget_cap:.2f} order=edhrec"
    
    logger.info(f"Searching Scryfall: {full_query}")
    results = _execute_search(full_query, limit)
    
    # Retry without price filter if no results and we had a budget cap
    if not results and budget_cap:
        logger.info(f"No results with budget cap, retrying without: {query} order=edhrec")
        results = _execute_search(f"{query} order=edhrec", limit)
    
    logger.info(f"Search returned {len(results)} cards")
    return results


def validate_cards(card_names: list[str]) -> list[dict]:
    """
    Validate that specific card names exist and get their data + prices.
    Uses the Collection API for efficiency.

    Args:
        card_names: List of card names to validate

    Returns:
        List of card data dicts for cards that were found.
    """
    if not card_names:
        return []
    
    cards, not_found = fetch_cards_collection(card_names)
    
    if not_found:
        logger.info(f"Validation: {len(not_found)} cards not found: {not_found}")
    
    return cards


def format_card_for_context(card: dict) -> str:
    """
    Format a card dict into a readable string for including in Claude's context.
    """
    parts = [f"**{card['name']}**"]
    if card.get("mana_cost"):
        parts.append(f" {card['mana_cost']}")
    parts.append(f"\n{card.get('type_line', '')}")
    if card.get("oracle_text"):
        parts.append(f"\n{card['oracle_text']}")
    if card.get("power") and card.get("toughness"):
        parts.append(f"\n{card['power']}/{card['toughness']}")
    return "".join(parts)


def fetch_cards_collection(card_names: list[str]) -> tuple[list[dict], list[str]]:
    """
    Batch fetch multiple cards via Scryfall's Collection API.

    This is much faster than individual fetches for large deck lists.
    The Collection API accepts up to 75 cards per request.

    Args:
        card_names: List of card names to fetch

    Returns:
        Tuple of (found_cards, not_found_names)
    """
    BATCH_SIZE = 75
    all_cards = []
    not_found = []

    for i in range(0, len(card_names), BATCH_SIZE):
        batch = card_names[i:i + BATCH_SIZE]
        identifiers = [{"name": name} for name in batch]

        try:
            url = f"{SCRYFALL_API_BASE}/cards/collection"
            request_body = json.dumps({"identifiers": identifiers}).encode("utf-8")

            req = urllib.request.Request(
                url,
                data=request_body,
                headers={
                    "User-Agent": "LotusBot/1.0",
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode())

                # Process found cards
                for card in data.get("data", []):
                    # Get USD price (cheapest printing)
                    prices = card.get("prices", {})
                    usd_price = prices.get("usd") or prices.get("usd_foil")
                    
                    all_cards.append({
                        "name": card.get("name"),
                        "mana_cost": card.get("mana_cost", ""),
                        "type_line": card.get("type_line", ""),
                        "oracle_text": card.get("oracle_text", ""),
                        "legalities": card.get("legalities", {}),
                        "keywords": card.get("keywords", []),
                        "power": card.get("power"),
                        "toughness": card.get("toughness"),
                        "colors": card.get("colors", []),
                        "color_identity": card.get("color_identity", []),
                        "cmc": card.get("cmc", 0),
                        "rarity": card.get("rarity", ""),
                        "usd": usd_price,
                    })

                # Track not found cards
                for nf in data.get("not_found", []):
                    not_found.append(nf.get("name", str(nf)))

        except Exception as e:
            logger.warning(f"Failed to batch fetch cards: {e}")
            # Add all cards in this batch to not_found
            not_found.extend(batch)

    logger.info(f"Batch fetched {len(all_cards)} cards, {len(not_found)} not found")
    return all_cards, not_found
