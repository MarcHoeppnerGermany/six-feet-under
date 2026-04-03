#!/usr/bin/env python3
"""
LOTRO Chat Log Watcher
Monitors the LOTRO chat log file and sends new lines to the Cloudflare Worker API.

Usage:
    python watcher.py --config config.ini
    python watcher.py --file "C:/Users/YourName/Documents/The Lord of the Rings Online/chatlog.txt" --api-url https://your-worker.workers.dev --api-key your-secret-key
"""

import argparse
import configparser
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib import request, error


# LOTRO chat log line patterns
# Common format: [Timestamp] [Channel] Character: Message
# The exact format can vary; we handle several variants
CHAT_LINE_PATTERN = re.compile(
    r"^\[(?P<time>\d{2}:\d{2}:\d{2})\]\s+"
    r"(?:\[(?P<channel>[^\]]+)\]\s+)?"
    r"(?P<sender>[^:]+):\s+"
    r"(?P<message>.+)$"
)

# Simpler fallback: just timestamp + text
SIMPLE_LINE_PATTERN = re.compile(
    r"^\[(?P<time>\d{2}:\d{2}:\d{2})\]\s+(?P<text>.+)$"
)


def parse_chat_line(line):
    """Parse a single LOTRO chat log line into structured data."""
    line = line.strip()
    if not line:
        return None

    match = CHAT_LINE_PATTERN.match(line)
    if match:
        return {
            "time": match.group("time"),
            "channel": match.group("channel") or "Unknown",
            "sender": match.group("sender").strip(),
            "message": match.group("message").strip(),
            "raw": line,
        }

    match = SIMPLE_LINE_PATTERN.match(line)
    if match:
        return {
            "time": match.group("time"),
            "channel": "System",
            "sender": "System",
            "message": match.group("text").strip(),
            "raw": line,
        }

    # If no pattern matches, treat as raw text
    if line:
        return {
            "time": datetime.now().strftime("%H:%M:%S"),
            "channel": "System",
            "sender": "System",
            "message": line,
            "raw": line,
        }

    return None


def send_lines(api_url, api_key, lines):
    """Send parsed chat lines to the Cloudflare Worker API."""
    if not lines:
        return True

    payload = json.dumps({
        "date": datetime.now().strftime("%Y-%m-%d"),
        "lines": lines,
    }).encode("utf-8")

    req = request.Request(
        f"{api_url}/api/chat",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return True
            else:
                print(f"[WARN] API returned status {resp.status}")
                return False
    except error.URLError as e:
        print(f"[ERROR] Failed to send lines: {e}")
        return False


def watch_file(file_path, api_url, api_key, poll_interval=2, batch_size=20):
    """Watch a file for new lines and send them to the API."""
    print(f"[INFO] Watching: {file_path}")
    print(f"[INFO] API URL:  {api_url}")
    print(f"[INFO] Polling every {poll_interval}s, batch size {batch_size}")

    # Start at end of file if it exists
    current_pos = 0
    if os.path.exists(file_path):
        current_pos = os.path.getsize(file_path)
        print(f"[INFO] Starting at position {current_pos} (end of existing file)")

    pending_lines = []
    retry_count = 0
    max_retries = 5

    while True:
        try:
            if not os.path.exists(file_path):
                time.sleep(poll_interval)
                continue

            file_size = os.path.getsize(file_path)

            # File was truncated or recreated
            if file_size < current_pos:
                print("[INFO] File was truncated, restarting from beginning")
                current_pos = 0

            if file_size > current_pos:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(current_pos)
                    new_data = f.read()
                    current_pos = f.tell()

                for line in new_data.splitlines():
                    parsed = parse_chat_line(line)
                    if parsed:
                        pending_lines.append(parsed)
                        print(f"  [{parsed['channel']}] {parsed['sender']}: {parsed['message']}")

            # Send pending lines in batches
            if pending_lines and (len(pending_lines) >= batch_size or file_size == current_pos):
                batch = pending_lines[:batch_size]
                if send_lines(api_url, api_key, batch):
                    pending_lines = pending_lines[batch_size:]
                    retry_count = 0
                else:
                    retry_count += 1
                    if retry_count >= max_retries:
                        print(f"[ERROR] Failed to send after {max_retries} retries, dropping batch")
                        pending_lines = pending_lines[batch_size:]
                        retry_count = 0
                    else:
                        wait = min(2 ** retry_count, 30)
                        print(f"[WARN] Retry {retry_count}/{max_retries} in {wait}s")
                        time.sleep(wait)
                        continue

            time.sleep(poll_interval)

        except KeyboardInterrupt:
            print("\n[INFO] Shutting down...")
            if pending_lines:
                print(f"[INFO] Sending {len(pending_lines)} remaining lines...")
                send_lines(api_url, api_key, pending_lines)
            break
        except Exception as e:
            print(f"[ERROR] Unexpected error: {e}")
            time.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(description="LOTRO Chat Log Watcher")
    parser.add_argument("--config", help="Path to config.ini file")
    parser.add_argument("--file", help="Path to LOTRO chat log file")
    parser.add_argument("--api-url", help="Cloudflare Worker API URL")
    parser.add_argument("--api-key", help="API authentication key")
    parser.add_argument("--poll-interval", type=float, default=2, help="Poll interval in seconds (default: 2)")
    parser.add_argument("--batch-size", type=int, default=20, help="Batch size for sending (default: 20)")
    args = parser.parse_args()

    file_path = args.file
    api_url = args.api_url
    api_key = args.api_key
    poll_interval = args.poll_interval
    batch_size = args.batch_size

    # Load from config file if provided
    if args.config:
        config = configparser.ConfigParser()
        config.read(args.config)
        if "watcher" in config:
            file_path = file_path or config["watcher"].get("file")
            api_url = api_url or config["watcher"].get("api_url")
            api_key = api_key or config["watcher"].get("api_key")
            poll_interval = poll_interval or float(config["watcher"].get("poll_interval", 2))
            batch_size = batch_size or int(config["watcher"].get("batch_size", 20))

    if not file_path or not api_url or not api_key:
        print("[ERROR] --file, --api-url, and --api-key are required")
        print("        Provide them as arguments or in a config.ini file")
        sys.exit(1)

    watch_file(file_path, api_url, api_key, poll_interval, batch_size)


if __name__ == "__main__":
    main()
