from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path("src/config/r20MobdeaOnlineConfig.js")
REPORT = Path("/tmp/r20-fix24-social-links.txt")

YOUTUBE = 'https://youtube.com/@mostafabarakat21?si=j81UCr73vvnZtpPn'
FACEBOOK = 'https://www.facebook.com/share/18DaQCzDzT/'
TIKTOK = 'https://www.tiktok.com/@mostafabarakat210?_r=1&_t=ZS-99GSdfl3yi0'

EXPECTED_HOSTS = {
    "youtube": {"youtube.com", "www.youtube.com"},
    "facebook": {"facebook.com", "www.facebook.com"},
    "tiktok": {"tiktok.com", "www.tiktok.com"},
}

LINKS = {
    "youtube": YOUTUBE,
    "facebook": FACEBOOK,
    "tiktok": TIKTOK,
}

for kind, url in LINKS.items():
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise SystemExit(f"FIX24 {kind} URL has invalid scheme: {url}")
    if parsed.netloc.lower() not in EXPECTED_HOSTS[kind]:
        raise SystemExit(f"FIX24 {kind} URL has invalid host: {url}")

if "@mostafabarakat21" not in YOUTUBE:
    raise SystemExit("FIX24 verified YouTube creator handle changed unexpectedly.")
if "/share/18DaQCzDzT/" not in FACEBOOK:
    raise SystemExit("FIX24 verified Facebook link changed unexpectedly.")
if "@mostafabarakat210" not in TIKTOK:
    raise SystemExit("FIX24 verified TikTok creator handle changed unexpectedly.")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    "\n".join([
        'export const R20_MOBDEA_ONLINE_CONFIG_MARKER = "R20_FIX24_MOBDEA_ONLINE_CONFIG_V2_VERIFIED_LINKS";',
        f'export const R20_MOBDEA_YOUTUBE_URL = {YOUTUBE!r};',
        f'export const R20_MOBDEA_FACEBOOK_URL = {FACEBOOK!r};',
        f'export const R20_MOBDEA_TIKTOK_URL = {TIKTOK!r};',
        'export const R20_MOBDEA_SOCIAL_LINKS_COMPLETE = true;',
        'export const R20_MOBDEA_SOCIAL_LINKS_SOURCE = "user-verified";',
        "",
    ]),
    encoding="utf-8",
)

REPORT.write_text(
    "\n".join([
        "source=user-verified",
        f"youtube={YOUTUBE}",
        f"facebook={FACEBOOK}",
        f"tiktok={TIKTOK}",
        "",
    ]),
    encoding="utf-8",
)

print("FIX24 verified social links installed.")
