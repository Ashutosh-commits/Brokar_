"""
BROkar Property Scraper — Selenium Edition v4
Uses undetected-chromedriver to bypass anti-bot on 99acres and MagicBricks.
No ScraperAPI needed — runs a real Chrome browser locally.

Install:
  pip install -r requirements.txt

Usage:
  python scraper.py --source 99acres --city Mumbai --pages 2
  python scraper.py --source all     --city Delhi  --pages 3
  python scraper.py --serve                         # FastAPI on :8001
  python scraper.py --source 99acres --city Mumbai --pages 1 --no-headless
"""

import argparse
import json
import logging
import os
import random
import re
import time
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, NoSuchElementException, StaleElementReferenceException,
)
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("brokar-scraper")

CITY_APPRECIATION = {
    "Mumbai": 6.8, "Delhi": 5.9, "Bangalore": 7.2, "Bengaluru": 7.2,
    "Hyderabad": 8.1, "Chennai": 5.4, "Pune": 6.5, "Kolkata": 4.8,
    "Ahmedabad": 5.7, "Noida": 6.1, "Gurugram": 6.9, "Gurgaon": 6.9,
    "Navi Mumbai": 6.2, "Thane": 6.0, "Goa": 7.8, "Jaipur": 5.3,
    "Lucknow": 4.9, "Chandigarh": 5.1, "Kochi": 5.6,
}

CITY_MAP = {
    "bengaluru": "Bangalore", "gurgaon": "Gurugram",
    "new delhi": "Delhi", "ncr": "Delhi", "bombay": "Mumbai", "calcutta": "Kolkata",
}

CITY_SLUG_99 = {
    "Mumbai": "mumbai", "Delhi": "delhi", "Bangalore": "bangalore",
    "Bengaluru": "bangalore", "Hyderabad": "hyderabad", "Chennai": "chennai",
    "Pune": "pune", "Kolkata": "kolkata", "Ahmedabad": "ahmedabad",
    "Noida": "noida", "Gurugram": "gurgaon", "Gurgaon": "gurgaon",
    "Navi Mumbai": "navi-mumbai", "Thane": "thane", "Goa": "goa",
    "Jaipur": "jaipur", "Lucknow": "lucknow", "Chandigarh": "chandigarh",
}

HEADLESS = True  # overridden by --no-headless flag


# ─── Driver ───────────────────────────────────────────────────────────────────

def make_driver() -> uc.Chrome:
    options = uc.ChromeOptions()
    if HEADLESS:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--window-size=1366,768")
    options.add_argument("--lang=en-IN")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    # Block images to speed up scraping (re-enables for src extraction via JS)
    prefs = {"profile.managed_default_content_settings.images": 1}
    options.add_experimental_option("prefs", prefs)
    driver = uc.Chrome(options=options, use_subprocess=True, version_main=148)
    driver.set_page_load_timeout(45)
    return driver


# ─── Helpers ─────────────────────────────────────────────────────────────────

def normalise_city(raw): return CITY_MAP.get(raw.strip().lower(), raw.strip().title())

def parse_price(text):
    if not text: return 0
    text = re.sub(r"[^\d\w\s.,]", "", text).strip()
    m = re.search(r"[\d.]+", text.replace(",", ""))
    if not m: return 0
    val = float(m.group())
    lower = text.lower()
    if "cr" in lower or "crore" in lower: return int(val * 1_00_00_000)
    if "lac" in lower or "lakh" in lower: return int(val * 1_00_000)
    if "l" in lower and val < 9999: return int(val * 1_00_000)
    return int(val)

def parse_bhk(text):
    m = re.search(r"(\d)\s*[Bb][Hh][Kk]", text or "")
    if m:
        n = int(m.group(1))
        return n, f"{min(n,4)}BHK" if n <= 4 else "5BHK+"
    if re.search(r"studio|1\s*rk", text or "", re.I): return 1, "1BHK"
    return 2, "2BHK"

def parse_sqft(text):
    m = re.search(r"([\d,]+)\s*(sq\.?\s*ft\.?|sqft|sq\.ft)", text or "", re.I)
    return int(m.group(1).replace(",", "")) if m else 0

def parse_year(text):
    m = re.search(r"(19|20)\d{2}", text or "")
    return int(m.group()) if m else datetime.now().year - 5

def prop_type(raw):
    raw = (raw or "").lower()
    if any(x in raw for x in ["villa", "bungalow", "house", "kothi"]): return "house"
    if any(x in raw for x in ["row", "town"]): return "townhouse"
    return "apartment"

def safe_text(el, sel, default=""):
    try: return el.find_element(By.CSS_SELECTOR, sel).text.strip() or default
    except: return default

def safe_attr(el, sel, attr, default=""):
    try: return el.find_element(By.CSS_SELECTOR, sel).get_attribute(attr) or default
    except: return default

def fix_url(url, base):
    if not url: return base
    if url.startswith("//"): return "https:" + url
    if url.startswith("http"): return url
    return base.rstrip("/") + "/" + url.lstrip("/")

def get_images(card):
    urls = []
    for img in card.find_elements(By.CSS_SELECTOR, "img")[:5]:
        src = img.get_attribute("src") or img.get_attribute("data-src") or img.get_attribute("data-lazy") or ""
        if src.startswith("//"): src = "https:" + src
        if src.startswith("http") and not src.endswith(".gif") and "placeholder" not in src.lower():
            urls.append(src)
    return urls

def build_property(data, source, listing_url):
    city = normalise_city(data.get("city", ""))
    price = parse_price(data.get("priceRaw", ""))
    if not price or price < 1_00_000 or not city: return None
    bedrooms, bhk = parse_bhk(data.get("bhkRaw", "") + " " + data.get("title", ""))
    sqft = parse_sqft(data.get("sqftRaw", "")) or bedrooms * 450
    images = [i for i in data.get("images", []) if i and i.startswith("http")]
    return {
        "id": str(uuid.uuid4()),
        "title": (data.get("title") or f"{bhk} in {city}").strip()[:200],
        "description": (data.get("description") or f"{bhk} {prop_type(data.get('propertyType',''))} in {data.get('location', city)}.").strip()[:1000],
        "city": city,
        "location": (data.get("location") or city).strip().split("\n")[0][:200],
        "propertyType": prop_type(data.get("propertyType", "")),
        "bhkType": bhk,
        "bedrooms": bedrooms,
        "bathrooms": max(1, bedrooms - 1),
        "sqft": sqft,
        "yearBuilt": parse_year(data.get("yearBuilt", "")),
        "currentPrice": price,
        "appreciationRate": CITY_APPRECIATION.get(city, 5.5),
        "imageUrl": images[0] if images else "",
        "images": images[:6],
        "sourceUrl": listing_url,
        "source": source,
        "isActive": True,
        "scrapedAt": datetime.utcnow().isoformat(),
    }

def scroll_and_wait(driver, pauses=4):
    for _ in range(pauses):
        driver.execute_script("window.scrollBy(0, window.innerHeight * 1.5);")
        time.sleep(random.uniform(1.2, 2.0))
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(1)

def dismiss_popups(driver):
    for sel in ["[aria-label='Close']", "[class*='modal'] button[class*='close']",
                "[class*='popup'] button[class*='close']", "button[class*='dismiss']",
                "#onetrust-accept-btn-handler", "[class*='cookie'] button"]:
        try:
            btn = driver.find_element(By.CSS_SELECTOR, sel)
            if btn.is_displayed(): btn.click(); time.sleep(0.4)
        except: pass

def find_top_level_cards(driver, selectors):
    """Try selectors in order, return deduplicated top-level card elements."""
    for sel in selectors:
        found = driver.find_elements(By.CSS_SELECTOR, sel)
        if not found: continue
        top_ids = {el.id for el in found}
        top_level = []
        for el in found:
            ancestors = el.find_elements(By.XPATH, "ancestor::*")
            if not any(a.id in top_ids for a in ancestors):
                top_level.append(el)
        if top_level:
            log.info(f"  Matched selector: '{sel}' → {len(top_level)} cards")
            return top_level
    return []


# ─── 99acres ─────────────────────────────────────────────────────────────────
# Current layout (May 2026) uses tupleNew__ prefix for all card elements:
#   tupleNew__header      → BHK + title
#   tupleNew__priceVal    → price (₹X Cr / ₹X L)
#   tupleNew__address     → society/location
#   tupleNew__propType    → sqft + property type
#   tupleNew__imgWrap     → image container
#   descPtag / descText   → listing description

def scrape_99acres(city: str, pages: int) -> list:
    slug = CITY_SLUG_99.get(city, city.lower().replace(" ", "-"))
    results = []
    driver = None
    try:
        driver = make_driver()
        for page_num in range(1, pages + 1):
            url = f"https://www.99acres.com/flats-in-{slug}-ffid?page={page_num}"
            log.info(f"[99acres] Page {page_num}/{pages}: {url}")
            try:
                driver.get(url)
            except Exception as e:
                log.warning(f"[99acres] Load error: {e}"); continue

            dismiss_popups(driver)
            scroll_and_wait(driver, pauses=4)
            dismiss_popups(driver)

            try:
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR,
                        "[class*='tupleNew__imgWrap'], [class*='srpTuple'], [class*='projectTuple']")))
            except TimeoutException:
                log.warning(f"[99acres] Timeout waiting for cards"); continue

            # Use JS to find the true card root — the ancestor of tupleNew__header
            # that also contains tupleNew__priceVal (ensures we have the full card)
            cards = driver.execute_script("""
                const headers = document.querySelectorAll("[class*='tupleNew__header']");
                const roots = [];
                const seen = new Set();
                for (const h of headers) {
                    let el = h;
                    // Walk up max 8 levels to find container with price + image
                    for (let i = 0; i < 8; i++) {
                        el = el.parentElement;
                        if (!el) break;
                        const hasPrice = el.querySelector("[class*='tupleNew__priceVal'], [class*='price']");
                        const hasImg   = el.querySelector("img");
                        const hasLink  = el.querySelector("a[href]");
                        if (hasPrice && hasImg && hasLink) {
                            if (!seen.has(el)) { seen.add(el); roots.push(el); }
                            break;
                        }
                    }
                }
                return roots;
            """)

            # Fallback: walk up from image wrappers
            if not cards:
                wrappers = driver.find_elements(By.CSS_SELECTOR, "[class*='tupleNew__imgWrap']")
                seen = set()
                for w in wrappers:
                    try:
                        parent = w.find_element(By.XPATH, "../..")
                        if parent.id not in seen:
                            seen.add(parent.id)
                            cards.append(parent)
                    except: pass

            log.info(f"[99acres] {len(cards)} cards found on page {page_num}")

            for card in cards:
                try:
                    title     = safe_text(card, "[class*='tupleNew__header']") or safe_text(card, "h2") or safe_text(card, "h3")
                    price_raw = safe_text(card, "[class*='tupleNew__priceVal']") or safe_text(card, "[class*='priceVal']") or safe_text(card, "[class*='price']")
                    location  = safe_text(card, "[class*='tupleNew__address']") or safe_text(card, "[class*='tupleNew__project']") or safe_text(card, "[class*='location']") or city
                    sqft_raw  = safe_text(card, "[class*='tupleNew__propType']") or safe_text(card, "[class*='area']")
                    desc      = safe_text(card, "[class*='descPtag']") or safe_text(card, "[class*='descText']")
                    images    = get_images(card)

                    try:
                        href = card.find_element(By.CSS_SELECTOR, "a[href]").get_attribute("href") or ""
                    except: href = ""
                    listing_url = fix_url(href, "https://www.99acres.com")

                    prop = build_property({
                        "title": title, "priceRaw": price_raw,
                        "location": location.split("\n")[0], "city": city,
                        "sqftRaw": sqft_raw,
                        "bhkRaw": f"{title} {sqft_raw} {card.text[:300]}",
                        "description": desc, "images": images,
                    }, "99acres", listing_url)

                    if prop:
                        results.append(prop)
                        log.info(f"  ✓ {prop['title'][:55]} | ₹{prop['currentPrice']:,}")

                except StaleElementReferenceException: continue
                except Exception as e: log.debug(f"[99acres] Card err: {e}")

            time.sleep(random.uniform(2.5, 4.5))

    except Exception as e:
        log.error(f"[99acres] Fatal: {e}")
    finally:
        if driver:
            try: driver.quit()
            except: pass

    log.info(f"[99acres] Done: {len(results)} properties")
    return results


# ─── MagicBricks ─────────────────────────────────────────────────────────────

def scrape_magicbricks(city: str, pages: int) -> list:
    results = []
    driver = None
    try:
        driver = make_driver()
        for page_num in range(1, pages + 1):
            url = (
                f"https://www.magicbricks.com/property-for-sale/residential-real-estate"
                f"?proptype=Multistorey-Apartment,Builder-Floor-Apartment,Penthouse,"
                f"Studio-Apartment,Residential-House,Villa"
                f"&cityName={quote_plus(city)}&page={page_num}"
            )
            log.info(f"[MagicBricks] Page {page_num}/{pages}")
            try:
                driver.get(url)
            except Exception as e:
                log.warning(f"[MagicBricks] Load error: {e}"); continue

            dismiss_popups(driver)
            scroll_and_wait(driver, pauses=4)
            dismiss_popups(driver)

            try:
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR,
                        "[class*='mb-srp__card'], [class*='srpCard'], article")))
            except TimeoutException:
                log.warning("[MagicBricks] Timeout"); continue

            cards = find_top_level_cards(driver, [
                "[class*='mb-srp__card--ACTIVE']",
                "[class*='mb-srp__card']",
                "[class*='srpCard']",
                "[class*='PropertyCard']",
                "article[class]",
            ])

            log.info(f"[MagicBricks] {len(cards)} cards on page {page_num}")

            for card in cards:
                try:
                    title     = safe_text(card, "[class*='mb-srp__card__title']") or safe_text(card, "h2") or safe_text(card, "h3")
                    price_raw = safe_text(card, "[class*='mb-srp__card__price']") or safe_text(card, "[class*='price']")
                    location  = safe_text(card, "[class*='mb-srp__card__society']") or safe_text(card, "[class*='locality']") or safe_text(card, "[class*='location']") or city
                    specs     = " ".join(el.text for el in card.find_elements(By.CSS_SELECTOR, "[class*='mb-srp__card__summary__list--item']"))
                    images    = get_images(card)

                    try:
                        href = card.find_element(By.CSS_SELECTOR, "a[href]").get_attribute("href") or ""
                    except: href = ""
                    listing_url = fix_url(href, "https://www.magicbricks.com")

                    prop = build_property({
                        "title": title or specs, "priceRaw": price_raw,
                        "location": location.split("\n")[0], "city": city,
                        "sqftRaw": specs, "bhkRaw": f"{title} {specs}",
                        "images": images,
                    }, "magicbricks", listing_url)

                    if prop:
                        results.append(prop)
                        log.info(f"  ✓ {prop['title'][:55]} | ₹{prop['currentPrice']:,}")

                except StaleElementReferenceException: continue
                except Exception as e: log.debug(f"[MagicBricks] Card err: {e}")

            time.sleep(random.uniform(2.5, 4.5))

    except Exception as e:
        log.error(f"[MagicBricks] Fatal: {e}")
    finally:
        if driver:
            try: driver.quit()
            except: pass

    log.info(f"[MagicBricks] Done: {len(results)} properties")
    return results


# ─── Runner ───────────────────────────────────────────────────────────────────

def run_scraper(source: str, city: str, pages: int) -> list:
    all_results = []
    if source in ("99acres", "all"):
        all_results.extend(scrape_99acres(city, pages))
    if source in ("magicbricks", "all"):
        all_results.extend(scrape_magicbricks(city, pages))

    seen, deduped = set(), []
    for p in all_results:
        key = p.get("sourceUrl") or p["id"]
        if key not in seen:
            seen.add(key)
            deduped.append(p)

    log.info(f"Total after dedup: {len(deduped)}")
    return deduped


# ─── FastAPI ──────────────────────────────────────────────────────────────────

api = FastAPI(title="BROkar Selenium Scraper", version="4.0.0")
api.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3001"], allow_methods=["*"], allow_headers=["*"])

jobs: dict[str, dict] = {}

class ScrapeRequest(BaseModel):
    source: str = "all"
    city: str = "Mumbai"
    pages: int = 2


def _run_job(job_id: str, req: ScrapeRequest):
    jobs[job_id]["status"] = "running"
    try:
        results = run_scraper(req.source, req.city, req.pages)
        jobs[job_id].update({"results": results, "count": len(results), "status": "done", "finished_at": datetime.utcnow().isoformat()})
    except Exception as e:
        jobs[job_id].update({"status": "error", "error": str(e), "finished_at": datetime.utcnow().isoformat()})


@api.get("/health")
def health():
    return {"status": "ok", "engine": "selenium+undetected-chromedriver", "version": "4.0.0"}

@api.post("/scrape")
def start_scrape(req: ScrapeRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"job_id": job_id, "status": "queued", "source": req.source, "city": req.city, "pages": req.pages, "started_at": datetime.utcnow().isoformat(), "count": 0, "results": []}
    background_tasks.add_task(_run_job, job_id, req)
    return jobs[job_id]

@api.get("/scrape/{job_id}")
def get_job(job_id: str):
    if job_id not in jobs: raise HTTPException(404, "Job not found")
    return {k: v for k, v in jobs[job_id].items() if k != "results"}

@api.get("/scrape/{job_id}/results")
def get_results(job_id: str):
    if job_id not in jobs: raise HTTPException(404, "Job not found")
    job = jobs[job_id]
    if job["status"] != "done": raise HTTPException(425, f"Job status: {job['status']}")
    return {"count": job["count"], "properties": job["results"]}

@api.get("/jobs")
def list_jobs():
    return [{k: v for k, v in j.items() if k != "results"} for j in jobs.values()]


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="all", choices=["99acres", "magicbricks", "all"])
    parser.add_argument("--city", default="Mumbai")
    parser.add_argument("--pages", type=int, default=2)
    parser.add_argument("--output")
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--no-headless", action="store_true")
    args = parser.parse_args()

    if args.no_headless:
        HEADLESS = False

    if args.serve:
        log.info("Starting Selenium scraper service on :8001")
        uvicorn.run(api, host="0.0.0.0", port=8001, log_level="info")
    else:
        results = run_scraper(args.source, args.city, args.pages)
        out = json.dumps(results, indent=2, ensure_ascii=False)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f: f.write(out)
            log.info(f"Saved {len(results)} → {args.output}")
        else:
            print(out)
