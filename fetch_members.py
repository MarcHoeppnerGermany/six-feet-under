"""
Fetch all Discord server members via the Bot API using curl.
Writes results to members.json for the website to display.
Run via GitHub Actions or manually: DISCORD_BOT_TOKEN=xxx DISCORD_GUILD_ID=xxx python3 fetch_members.py
"""

import subprocess
import json
import os
import sys
from datetime import datetime, timezone


def curl_get(url, token):
    """Fetch a URL using curl to avoid Cloudflare blocks on urllib."""
    result = subprocess.run(
        [
            "curl", "-sf",
            "-H", f"Authorization: Bot {token}",
            "-H", "User-Agent: SFU-Website-Bot/1.0",
            url
        ],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"curl failed for {url}")
        print(f"stderr: {result.stderr}")
        sys.exit(1)
    return json.loads(result.stdout)


def main():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    guild_id = os.environ.get("DISCORD_GUILD_ID")

    if not token:
        print("ERROR: DISCORD_BOT_TOKEN environment variable not set")
        sys.exit(1)
    if not guild_id:
        print("ERROR: DISCORD_GUILD_ID environment variable not set")
        sys.exit(1)

    api = "https://discord.com/api/v10"

    # --- Fetch all members (paginated) ---
    all_members_raw = []
    after = "0"

    while True:
        url = f"{api}/guilds/{guild_id}/members?limit=1000&after={after}"
        batch = curl_get(url, token)

        if not isinstance(batch, list) or len(batch) == 0:
            break

        all_members_raw.extend(batch)
        print(f"  Fetched batch: {len(batch)} members (total: {len(all_members_raw)})")

        if len(batch) < 1000:
            break

        after = batch[-1]["user"]["id"]

    # --- Fetch roles ---
    roles_raw = curl_get(f"{api}/guilds/{guild_id}/roles", token)

    role_map = {r["id"]: r for r in roles_raw}
    roles_sorted = sorted(roles_raw, key=lambda r: r.get("position", 0), reverse=True)

    rank_order = {}
    for r in roles_sorted:
        if r["name"] != "@everyone":
            rank_order[r["name"]] = r.get("position", 0)

    # --- Process members ---
    members = []
    for m in all_members_raw:
        user = m.get("user", {})

        # Skip bots
        if user.get("bot"):
            continue

        # Find highest role
        highest_role = None
        highest_pos = -1
        for role_id in m.get("roles", []):
            role = role_map.get(role_id)
            if role and role.get("position", 0) > highest_pos and role["name"] != "@everyone":
                highest_pos = role["position"]
                highest_role = role["name"]

        # Build avatar URL
        avatar_url = None
        avatar_hash = user.get("avatar")
        user_id = user.get("id")
        if avatar_hash and user_id:
            ext = "gif" if avatar_hash.startswith("a_") else "png"
            avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.{ext}?size=128"

        members.append({
            "name": m.get("nick") or user.get("global_name") or user.get("username", "???"),
            "username": user.get("username", ""),
            "avatar": avatar_url,
            "rank": highest_role or "Mitglied",
            "joined_at": m.get("joined_at", ""),
        })

    # Sort by role position (highest rank first)
    members.sort(key=lambda m: rank_order.get(m["rank"], 0), reverse=True)

    # --- Write output ---
    output = {
        "guild_id": guild_id,
        "member_count": len(members),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "members": members,
    }

    with open("members.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Successfully fetched {len(members)} members")


if __name__ == "__main__":
    main()
