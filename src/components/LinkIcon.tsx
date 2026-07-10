import { useEffect, useState } from "react";
import { loadLinkIconData } from "../lib/navStore";
import { getLinkIconUrl, setDefaultLinkIcon } from "../lib/url";
import type { NavLink } from "../types";

type LinkIconProps = {
  className?: string;
  link: NavLink;
  userId?: string;
};

export function LinkIcon({ className = "", link, userId }: LinkIconProps) {
  const [src, setSrc] = useState(() => getLinkIconUrl(link.url, link.iconUrl));
  const [fallbackChecked, setFallbackChecked] = useState(false);

  useEffect(() => {
    setSrc(getLinkIconUrl(link.url, link.iconUrl));
    setFallbackChecked(false);
  }, [link.iconUrl, link.url]);

  async function handleError(image: HTMLImageElement) {
    if (!fallbackChecked && link.iconDataUrl) {
      setFallbackChecked(true);
      setSrc(link.iconDataUrl);
      return;
    }

    if (!fallbackChecked && userId) {
      setFallbackChecked(true);
      try {
        const iconData = await loadLinkIconData(userId, link.id);
        if (iconData) {
          setSrc(iconData);
          return;
        }
      } catch {
        // Fall through to the default icon; favicon loading should never block the UI.
      }
    }

    setDefaultLinkIcon(image);
  }

  return (
    <img
      alt=""
      className={className}
      loading="lazy"
      onError={(event) => {
        void handleError(event.currentTarget);
      }}
      src={src}
    />
  );
}
