import { describe, it, expect } from "vitest";
import { classifySource, parseUserAgent, isBot, normalisePath, isTrackedPath } from "./classify";

const OWN = "www.yaadigo.com";
const classify = (referrer, query = "") =>
  classifySource({ referrer, params: new URLSearchParams(query), ownHost: OWN });

describe("classifySource", () => {
  it("reads search engines as organic", () => {
    expect(classify("https://www.google.com/")).toMatchObject({ channel: "organic", source: "google" });
    expect(classify("https://www.google.co.in/")).toMatchObject({ channel: "organic", source: "google" });
    expect(classify("https://www.bing.com/search?q=x")).toMatchObject({ channel: "organic", source: "bing" });
  });

  it("separates AI assistants from search, Gemini from Google search", () => {
    expect(classify("https://chatgpt.com/")).toMatchObject({ channel: "ai", source: "chatgpt" });
    expect(classify("https://www.perplexity.ai/")).toMatchObject({ channel: "ai", source: "perplexity" });
    expect(classify("https://gemini.google.com/app")).toMatchObject({ channel: "ai", source: "gemini" });
  });

  it("reads social networks and messengers as social", () => {
    expect(classify("https://l.instagram.com/")).toMatchObject({ channel: "social", source: "instagram" });
    expect(classify("https://m.facebook.com/")).toMatchObject({ channel: "social", source: "facebook" });
    expect(classify("https://t.co/abc")).toMatchObject({ channel: "social", source: "x" });
  });

  it("treats our own site and no referrer as direct", () => {
    expect(classify("https://www.yaadigo.com/group-tours")).toMatchObject({ channel: "direct", source: "direct", referrerHost: null });
    expect(classify("https://yaadigo.com/")).toMatchObject({ channel: "direct" });
    expect(classify("")).toMatchObject({ channel: "direct", source: "direct" });
  });

  it("names other sites as referral by host", () => {
    expect(classify("https://travelblog.example.in/post")).toMatchObject({
      channel: "referral",
      source: "travelblog.example.in",
      referrerHost: "travelblog.example.in",
    });
  });

  it("gives paid clicks priority, by click id or medium", () => {
    expect(classify("https://www.google.com/", "gclid=abc")).toMatchObject({ channel: "paid", source: "google" });
    expect(classify("", "fbclid=x")).toMatchObject({ channel: "paid", source: "facebook" });
    expect(classify("", "utm_source=google&utm_medium=cpc")).toMatchObject({ channel: "paid", source: "google" });
  });

  it("lets a UTM source name the source, and email medium win", () => {
    expect(classify("", "utm_source=diwali-list&utm_medium=email&utm_campaign=diwali")).toMatchObject({
      channel: "email",
      source: "diwali-list",
      utmCampaign: "diwali",
    });
    expect(classify("", "utm_source=whatsapp&utm_medium=broadcast")).toMatchObject({ channel: "social", source: "whatsapp" });
    expect(classify("", "utm_source=qr-poster")).toMatchObject({ channel: "referral", source: "qr-poster" });
  });

  it("ignores a referrer it cannot parse", () => {
    expect(classify("not a url")).toMatchObject({ channel: "direct" });
  });
});

describe("parseUserAgent", () => {
  it("tells phones, tablets and desktops apart", () => {
    expect(
      parseUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36")
    ).toEqual({ device: "mobile", browser: "Chrome", os: "Android" });
    expect(
      parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")
    ).toEqual({ device: "mobile", browser: "Safari", os: "iOS" });
    expect(parseUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1").device).toBe("tablet");
    expect(
      parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0")
    ).toEqual({ device: "desktop", browser: "Edge", os: "Windows" });
  });
});

describe("isBot", () => {
  it("drops crawlers, unfurlers and headless browsers, keeps people", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("WhatsApp/2.23.20.0")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/130.0")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36")).toBe(false);
  });
});

describe("normalisePath", () => {
  it("never stores a quotation share token", () => {
    expect(normalisePath("/q/VE5nGysjQgr9zynNMBewkkJo")).toBe("/q/:token");
    expect(normalisePath("/q/VE5nGysjQgr9zynNMBewkkJo/print?x=1")).toBe("/q/:token/print");
  });

  it("drops the query string, fragment and trailing slash", () => {
    expect(normalisePath("/group-tours/?utm_source=x#top")).toBe("/group-tours");
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("")).toBe("/");
  });
});

describe("isTrackedPath", () => {
  it("skips the admin, APIs and PDF renders", () => {
    expect(isTrackedPath("/admin/leads")).toBe(false);
    expect(isTrackedPath("/api/t")).toBe(false);
    expect(isTrackedPath("/pdf/itinerary")).toBe(false);
    expect(isTrackedPath("/administration-of-trips")).toBe(true);
    expect(isTrackedPath("/group-tours/ladakh")).toBe(true);
  });
});
