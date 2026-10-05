interface ShareCapabilities {
  share?: (data: { title: string; url: string }) => Promise<void>;
  copy?: (url: string) => Promise<void>;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "manual";

// Keep both fallbacks available even when the native share operation fails.
export async function shareLink(
  url: string,
  title: string,
  capabilities: ShareCapabilities,
): Promise<ShareOutcome> {
  if (capabilities.share) {
    try {
      await capabilities.share({ title, url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  if (capabilities.copy) {
    try {
      await capabilities.copy(url);
      return "copied";
    } catch {
      // The caller exposes the URL when clipboard access is unavailable.
    }
  }
  return "manual";
}
