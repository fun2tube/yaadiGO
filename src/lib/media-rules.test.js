import { describe, it, expect } from "vitest";
import {
  categoryForTags,
  cleanTags,
  looksLikeHeic,
  matchesQuery,
  pickValue,
  sniffImage,
  titleFromFileName,
} from "@/lib/media-rules";

const bytes = (...head) => new Uint8Array([...head, ...new Array(16).fill(0)]);

describe("sniffImage — the bytes decide, not the file name", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.type).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))?.type).toBe("image/png");
    const webp = new Uint8Array([..."RIFF"].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [..."WEBP"].map((c) => c.charCodeAt(0)), [0, 0, 0, 0]));
    expect(sniffImage(webp)?.ext).toBe("webp");
  });

  it("refuses anything else — an SVG, a PDF, a script renamed .jpg", () => {
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7 ............"))).toBeNull();
    expect(sniffImage(new Uint8Array(4))).toBeNull();
  });
});

describe("upload helpers", () => {
  it("spots iPhone HEIC files by name or type", () => {
    expect(looksLikeHeic({ name: "IMG_1023.HEIC", type: "" })).toBe(true);
    expect(looksLikeHeic({ name: "x.jpg", type: "image/heif" })).toBe(true);
    expect(looksLikeHeic({ name: "pool.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("turns a file name into a title worth keeping", () => {
    expect(titleFromFileName("IMG_2041 taj-malabar_pool.jpg")).toBe("Taj malabar pool");
    expect(titleFromFileName("DSC0001.JPG")).toBe("Untitled photo");
  });

  it("normalises tags", () => {
    expect(cleanTags("Kerala, houseboat ,  Alleppey Backwaters, kerala")).toEqual([
      "kerala",
      "houseboat",
      "alleppey-backwaters",
    ]);
  });

  it("searches every word across title, tags and destination", () => {
    const item = { title: "Lake view room", tags: ["houseboat"], destination: "Srinagar", category: "hotel" };
    expect(matchesQuery(item, "srinagar houseboat")).toBe(true);
    expect(matchesQuery(item, "srinagar beach")).toBe(false);
    expect(matchesQuery(item, "")).toBe(true);
  });

  it("files built-in photos by their tags", () => {
    expect(categoryForTags(["kerala", "houseboat"])).toBe("hotel");
    expect(categoryForTags(["ladakh", "trip-hero"])).toBe("destination");
  });

  it("stores a built-in photo by id and an upload by URL", () => {
    expect(pickValue({ builtin: true, id: "kerala-backwaters", alt: "Houseboat" })).toEqual({
      id: "kerala-backwaters",
      url: null,
      alt: "Houseboat",
    });
    expect(pickValue({ id: "med_1", url: "https://x/y.jpg", title: "Pool" })).toEqual({
      id: null,
      url: "https://x/y.jpg",
      mediaId: "med_1",
      alt: "Pool",
    });
  });
});
