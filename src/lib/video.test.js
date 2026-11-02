import { describe, it, expect } from "vitest";
import { toEmbed } from "@/lib/video";

/**
 * URL parsing for social embeds.
 *
 * Worth testing because the failure is silent: an unrecognised URL renders
 * nothing, so a video the desk pasted simply never appears and nobody knows
 * why.
 */
describe("toEmbed", () => {
  it("handles every YouTube URL shape people actually paste", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    ]) {
      const embed = toEmbed(url);
      expect(embed?.kind).toBe("youtube");
      expect(embed.src).toContain("dQw4w9WgXcQ");
    }
  });

  it("uses youtube-nocookie so nothing tracks a visitor who never plays", () => {
    expect(toEmbed("https://youtu.be/abc123").src).toContain("youtube-nocookie.com");
  });

  it("marks Shorts as portrait so they are not letterboxed", () => {
    expect(toEmbed("https://www.youtube.com/shorts/abc123").portrait).toBe(true);
    expect(toEmbed("https://www.youtube.com/watch?v=abc123").portrait).toBe(false);
  });

  it("handles Instagram reels and posts", () => {
    expect(toEmbed("https://www.instagram.com/reel/Cxyz123/")?.kind).toBe("instagram");
    expect(toEmbed("https://www.instagram.com/p/Cxyz123/")?.kind).toBe("instagram");
    // Reels are vertical; treating them as landscape crops the subject out.
    expect(toEmbed("https://www.instagram.com/reel/Cxyz123/").portrait).toBe(true);
  });

  it("returns null for anything it cannot embed, rather than a broken frame", () => {
    expect(toEmbed("https://example.com/video.mp4")).toBeNull();
    expect(toEmbed("not a url")).toBeNull();
    expect(toEmbed("")).toBeNull();
    expect(toEmbed(null)).toBeNull();
  });
});
