"""
Deck list parser for various MTG deck list formats.

Supports:
- MTGO format: "4 Lightning Bolt"
- Arena format: "4 Lightning Bolt (M21) 123"
- Moxfield/Archidekt exports
- Commander section detection
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def parse_deck_list(text: str) -> dict:
    """
    Parse a deck list from various formats into structured data.

    Args:
        text: Raw deck list text

    Returns:
        {
            "commander": str | None,
            "cards": [{"name": str, "quantity": int, "section": str}],
            "card_count": int,
            "sections": dict[str, list]  # Cards grouped by section
        }
    """
    lines = text.strip().split("\n")

    commander = None
    cards = []
    current_section = "mainboard"
    sections = {"mainboard": [], "sideboard": [], "commander": []}

    # Patterns for different formats
    # MTGO/Standard: "4 Lightning Bolt" or "4x Lightning Bolt"
    quantity_pattern = re.compile(r"^(\d+)x?\s+(.+)$", re.IGNORECASE)

    # Arena format: "4 Lightning Bolt (M21) 123"
    arena_pattern = re.compile(r"^(\d+)\s+(.+?)\s+\([A-Z0-9]+\)\s*\d*$", re.IGNORECASE)

    # Section headers
    section_patterns = {
        "commander": re.compile(r"^(commander|cmdr|command zone)\s*:?\s*$", re.IGNORECASE),
        "mainboard": re.compile(r"^(mainboard|main|deck|main deck)\s*:?\s*$", re.IGNORECASE),
        "sideboard": re.compile(r"^(sideboard|side|sb)\s*:?\s*$", re.IGNORECASE),
        "companion": re.compile(r"^(companion)\s*:?\s*$", re.IGNORECASE),
    }

    for line in lines:
        line = line.strip()

        # Skip empty lines and comments
        if not line or line.startswith("#") or line.startswith("//"):
            continue

        # Check for section headers
        is_section = False
        for section_name, pattern in section_patterns.items():
            if pattern.match(line):
                current_section = section_name
                if section_name not in sections:
                    sections[section_name] = []
                is_section = True
                break

        if is_section:
            continue

        # Try to parse card line
        card_name = None
        quantity = 1

        # Try Arena format first (more specific)
        arena_match = arena_pattern.match(line)
        if arena_match:
            quantity = int(arena_match.group(1))
            card_name = arena_match.group(2).strip()
        else:
            # Try standard quantity format (must start with a number)
            qty_match = quantity_pattern.match(line)
            if qty_match:
                quantity = int(qty_match.group(1))
                card_name = qty_match.group(2).strip()
            # Skip lines that don't start with a number - they're likely intro text
            # Standard deck lists always have quantities (e.g., "1 Sol Ring")

        if card_name:
            # Clean up card name
            card_name = clean_card_name(card_name)

            if card_name:
                card_entry = {
                    "name": card_name,
                    "quantity": quantity,
                    "section": current_section
                }
                cards.append(card_entry)

                if current_section not in sections:
                    sections[current_section] = []
                sections[current_section].append(card_entry)

                # If this is in commander section, track it
                if current_section == "commander":
                    commander = card_name

    # If no explicit commander section, try to detect from common patterns
    if not commander:
        commander = detect_commander(text, cards)

    # Calculate total card count
    card_count = sum(c["quantity"] for c in cards)

    logger.info(f"Parsed deck: {card_count} cards, commander: {commander}")

    return {
        "commander": commander,
        "cards": cards,
        "card_count": card_count,
        "sections": sections
    }


def clean_card_name(name: str) -> Optional[str]:
    """
    Clean and normalize a card name.
    """
    if not name:
        return None

    # Remove set codes in parentheses at the end
    name = re.sub(r"\s*\([A-Z0-9]+\)\s*\d*\s*$", "", name)

    # Remove collector numbers
    name = re.sub(r"\s+\d+\s*$", "", name)

    # Remove foil/etched indicators
    name = re.sub(r"\s*\*F\*\s*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*\(F\)\s*$", "", name, flags=re.IGNORECASE)

    # Handle double-faced cards - keep full name
    # "Delver of Secrets // Insectile Aberration" stays as is

    # Trim whitespace
    name = name.strip()

    # Skip basic lands for card data fetching (we don't need oracle text)
    # But keep them in the deck list

    return name if name else None


def detect_commander(text: str, cards: list[dict]) -> Optional[str]:
    """
    Try to detect the commander from context clues.
    """
    text_lower = text.lower()

    # Look for "Commander: Card Name" pattern anywhere in text
    cmd_match = re.search(r"commander\s*[:=]\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    if cmd_match:
        return clean_card_name(cmd_match.group(1))

    # Look for "CMDR: Card Name"
    cmdr_match = re.search(r"cmdr\s*[:=]\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    if cmdr_match:
        return clean_card_name(cmdr_match.group(1))

    return None


def get_unique_card_names(parsed_deck: dict) -> list[str]:
    """
    Extract unique card names from a parsed deck for fetching.
    Excludes basic lands.
    """
    basic_lands = {"Plains", "Island", "Swamp", "Mountain", "Forest",
                   "Wastes", "Snow-Covered Plains", "Snow-Covered Island",
                   "Snow-Covered Swamp", "Snow-Covered Mountain",
                   "Snow-Covered Forest"}

    seen = set()
    unique_names = []

    for card in parsed_deck["cards"]:
        name = card["name"]
        if name not in seen and name not in basic_lands:
            seen.add(name)
            unique_names.append(name)

    return unique_names


def format_deck_context(parsed_deck: dict, card_data: list[dict]) -> str:
    """
    Format the deck and card data into context for the AI.

    Args:
        parsed_deck: Output from parse_deck_list
        card_data: List of card dicts from Scryfall

    Returns:
        Formatted string with deck overview and card details
    """
    # Create lookup by card name
    card_lookup = {c["name"]: c for c in card_data}

    lines = []
    lines.append("# DECK LIST WITH CARD DATA")
    lines.append("")

    if parsed_deck["commander"]:
        lines.append(f"**Commander:** {parsed_deck['commander']}")
        lines.append("")

    lines.append(f"**Total Cards:** {parsed_deck['card_count']}")
    lines.append("")

    # Group by section
    for section_name, section_cards in parsed_deck["sections"].items():
        if not section_cards:
            continue

        lines.append(f"## {section_name.upper()}")
        lines.append("")

        for card_entry in section_cards:
            name = card_entry["name"]
            qty = card_entry["quantity"]

            # Get card data if available
            data = card_lookup.get(name)

            if data:
                lines.append(f"**{qty}x {name}** {data.get('mana_cost', '')}")
                lines.append(f"  Type: {data.get('type_line', 'Unknown')}")
                if data.get("oracle_text"):
                    # Indent oracle text
                    oracle = data["oracle_text"].replace("\n", "\n  ")
                    lines.append(f"  {oracle}")
                if data.get("power") and data.get("toughness"):
                    lines.append(f"  P/T: {data['power']}/{data['toughness']}")
            else:
                lines.append(f"**{qty}x {name}** (no data available)")

            lines.append("")

    return "\n".join(lines)


def calculate_deck_budget(cards: list[dict]) -> dict:
    """
    Calculate budget statistics from card price data.

    Args:
        cards: List of card dicts with 'usd' price field from Scryfall

    Returns:
        {
            "avg_price": float,      # Average card price
            "median_price": float,   # Median card price
            "total_price": float,    # Total deck value
            "budget_tier": str,      # "budget" | "mid" | "high"
            "price_cap": float       # Suggested max price for recommendations
        }
    """
    # Extract valid prices (filter out None and convert to float)
    prices = []
    for card in cards:
        usd = card.get("usd")
        if usd:
            try:
                prices.append(float(usd))
            except (ValueError, TypeError):
                pass

    if not prices:
        # No price data available, assume mid-range budget
        return {
            "avg_price": 5.0,
            "median_price": 3.0,
            "total_price": 0.0,
            "budget_tier": "mid",
            "price_cap": 10.0
        }

    # Calculate statistics
    prices.sort()
    total_price = sum(prices)
    avg_price = total_price / len(prices)

    # Median calculation
    n = len(prices)
    if n % 2 == 0:
        median_price = (prices[n // 2 - 1] + prices[n // 2]) / 2
    else:
        median_price = prices[n // 2]

    # Determine budget tier based on average price
    if avg_price < 2.0:
        budget_tier = "budget"
        price_cap = 5.0
    elif avg_price < 10.0:
        budget_tier = "mid"
        price_cap = avg_price * 2
    else:
        budget_tier = "high"
        price_cap = avg_price * 2

    logger.info(f"Deck budget: avg=${avg_price:.2f}, median=${median_price:.2f}, "
                f"total=${total_price:.2f}, tier={budget_tier}")

    return {
        "avg_price": round(avg_price, 2),
        "median_price": round(median_price, 2),
        "total_price": round(total_price, 2),
        "budget_tier": budget_tier,
        "price_cap": round(price_cap, 2)
    }
