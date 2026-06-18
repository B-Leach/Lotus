import { useState, useRef, useEffect } from "react";
import styles from "./CardTooltip.module.css";

interface CardTooltipProps {
  cardName: string;
}

interface CardData {
  name: string;
  image_uris?: {
    normal: string;
    small: string;
  };
  card_faces?: Array<{
    image_uris?: {
      normal: string;
      small: string;
    };
  }>;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  scryfall_uri?: string;
}

interface TooltipStyle {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

// Simple cache to avoid repeated API calls
const cardCache = new Map<string, CardData | null>();
// Track which images have been preloaded
const preloadedImages = new Set<string>();

function preloadImage(url: string) {
  if (preloadedImages.has(url)) return;
  const img = new Image();
  img.src = url;
  preloadedImages.add(url);
}

// Card image height (approximate) for positioning calculations
const CARD_HEIGHT = 350;
// Extra padding for bottom to account for input area
const BOTTOM_PADDING = 120;

export function CardTooltip({ cardName }: CardTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<TooltipStyle>({});
  const containerRef = useRef<HTMLSpanElement>(null);
  const fetchTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHovered) return;

    // Check cache first
    const cached = cardCache.get(cardName.toLowerCase());
    if (cached !== undefined) {
      setCardData(cached);
      return;
    }

    // Debounce the fetch
    setIsLoading(true);
    fetchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`,
        );
        if (response.ok) {
          const data = await response.json();
          cardCache.set(cardName.toLowerCase(), data);
          // Preload the image so it's ready when tooltip shows
          const imgUrl =
            data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal;
          if (imgUrl) preloadImage(imgUrl);
          setCardData(data);
        } else {
          cardCache.set(cardName.toLowerCase(), null);
          setCardData(null);
        }
      } catch (error) {
        console.error("Failed to fetch card:", error);
        cardCache.set(cardName.toLowerCase(), null);
        setCardData(null);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (fetchTimeoutRef.current) {
        window.clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [isHovered, cardName]);

  // Calculate tooltip position based on element position
  useEffect(() => {
    if (isHovered && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const style: TooltipStyle = {};

      // Horizontal positioning
      if (rect.left > windowWidth / 2) {
        // Show on left
        style.right = windowWidth - rect.left + 10;
      } else {
        // Show on right
        style.left = rect.right + 10;
      }

      // Vertical positioning - check if card would be cut off
      const elementCenterY = rect.top + rect.height / 2;
      const halfCardHeight = CARD_HEIGHT / 2;

      if (elementCenterY - halfCardHeight < 10) {
        // Too close to top, align tooltip top with element top
        style.top = rect.top;
      } else if (
        elementCenterY + halfCardHeight >
        windowHeight - BOTTOM_PADDING
      ) {
        // Too close to bottom, align tooltip bottom with element bottom
        style.bottom = windowHeight - rect.bottom;
      } else {
        // Center vertically
        style.top = elementCenterY - halfCardHeight;
      }

      setTooltipStyle(style);
    }
  }, [isHovered]);

  const getImageUrl = () => {
    if (!cardData) return null;
    if (cardData.image_uris) {
      return cardData.image_uris.normal;
    }
    if (cardData.card_faces && cardData.card_faces[0]?.image_uris) {
      return cardData.card_faces[0].image_uris.normal;
    }
    return null;
  };

  const imageUrl = getImageUrl();

  // Check if we've already looked up this card and it wasn't found
  const notFoundInCache =
    cardCache.has(cardName.toLowerCase()) &&
    cardCache.get(cardName.toLowerCase()) === null;

  // If we've confirmed it's not a card, just render as regular bold text
  if (notFoundInCache) {
    return <strong>{cardName}</strong>;
  }

  const handleMouseEnter = () => {
    // Cancel any pending hide
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Delay hiding to give user time to move to the tooltip
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
      hideTimeoutRef.current = null;
    }, 150);
  };

  return (
    <span
      ref={containerRef}
      className={styles.container}
      data-card-link=""
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <strong className={styles.cardName}>{cardName}</strong>
      {isHovered && (
        <div
          className={styles.tooltip}
          style={tooltipStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {isLoading && <div className={styles.loading}>Loading...</div>}
          {!isLoading && cardData && imageUrl && (
            <a
              href={cardData.scryfall_uri}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={imageUrl}
                alt={cardData.name}
                className={styles.cardImage}
              />
            </a>
          )}
        </div>
      )}
    </span>
  );
}
