#!/usr/bin/env python3
"""
LOTRO AFK Keeper
Sends periodic keypresses (W then S) to the LOTRO window to prevent AFK timeout.

Cycle: Every N minutes, press W (move forward briefly), then press S (move back).
This keeps the character in roughly the same spot.

Requirements:
    pip install pyautogui pygetwindow

Usage:
    python afk_keeper.py
    python afk_keeper.py --interval 300 --key-duration 0.3
    python afk_keeper.py --window-title "Lord of the Rings"
"""

import argparse
import ctypes
import sys
import time

# Check platform
IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    import ctypes.wintypes

    # Windows API constants
    SW_RESTORE = 9
    KEYEVENTF_KEYUP = 0x0002
    VK_MAP = {
        "w": 0x57,
        "s": 0x53,
        "a": 0x41,
        "d": 0x44,
        "space": 0x20,
    }

    user32 = ctypes.windll.user32

    def find_window(title_substring):
        """Find a window by partial title match."""
        result = []

        def enum_callback(hwnd, _):
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buf = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buf, length + 1)
                    if title_substring.lower() in buf.value.lower():
                        result.append((hwnd, buf.value))
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.POINTER(ctypes.c_int))
        user32.EnumWindows(WNDENUMPROC(enum_callback), 0)
        return result

    def focus_window(hwnd):
        """Bring window to foreground."""
        user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.3)

    def send_key_press(key, duration=0.3):
        """Send a key press using Windows API."""
        vk = VK_MAP.get(key.lower())
        if vk is None:
            print(f"[WARN] Unknown key: {key}")
            return
        # Key down
        user32.keybd_event(vk, 0, 0, 0)
        time.sleep(duration)
        # Key up
        user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)

else:
    # Non-Windows fallback using pyautogui
    try:
        import pyautogui
        pyautogui.FAILSAFE = True
    except ImportError:
        print("[ERROR] On non-Windows systems, install pyautogui: pip install pyautogui")
        sys.exit(1)

    def find_window(title_substring):
        """Stub for non-Windows - returns empty list."""
        print("[WARN] Window finding not supported on this platform.")
        print("       Make sure the LOTRO window is focused before starting.")
        return []

    def focus_window(hwnd):
        pass

    def send_key_press(key, duration=0.3):
        """Send a key press using pyautogui."""
        pyautogui.keyDown(key)
        time.sleep(duration)
        pyautogui.keyUp(key)


def run_afk_cycle(hwnd, key_duration, focus):
    """Run one W/S movement cycle."""
    timestamp = time.strftime("%H:%M:%S")

    if focus and hwnd:
        focus_window(hwnd)

    print(f"[{timestamp}] Pressing W...", end=" ", flush=True)
    send_key_press("w", key_duration)
    time.sleep(0.5)

    print("Pressing S...", end=" ", flush=True)
    send_key_press("s", key_duration)
    print("Done.")


def main():
    parser = argparse.ArgumentParser(description="LOTRO AFK Keeper")
    parser.add_argument(
        "--interval", type=int, default=300,
        help="Interval between keypresses in seconds (default: 300 = 5 min)"
    )
    parser.add_argument(
        "--key-duration", type=float, default=0.3,
        help="How long to hold each key in seconds (default: 0.3)"
    )
    parser.add_argument(
        "--window-title", type=str, default="Lord of the Rings",
        help="Window title to find (default: 'Lord of the Rings')"
    )
    parser.add_argument(
        "--no-focus", action="store_true",
        help="Don't try to focus the LOTRO window (send keys to whatever is active)"
    )
    parser.add_argument(
        "--start-delay", type=int, default=5,
        help="Delay before first keypress in seconds (default: 5)"
    )
    args = parser.parse_args()

    print("=== LOTRO AFK Keeper ===")
    print(f"Interval:     {args.interval}s ({args.interval // 60} min)")
    print(f"Key duration: {args.key_duration}s")
    print(f"Window title: {args.window_title}")
    print()

    # Try to find the LOTRO window
    hwnd = None
    if IS_WINDOWS and not args.no_focus:
        windows = find_window(args.window_title)
        if windows:
            hwnd, title = windows[0]
            print(f"[INFO] Found window: {title}")
        else:
            print(f"[WARN] Window '{args.window_title}' not found.")
            print("       Will send keys to the active window.")
            print("       Make sure LOTRO is focused!")
    elif not IS_WINDOWS:
        print("[INFO] Non-Windows mode: make sure LOTRO window is focused")

    print(f"\n[INFO] Starting in {args.start_delay}s... (Ctrl+C to stop)")
    time.sleep(args.start_delay)

    cycle = 0
    while True:
        try:
            cycle += 1
            print(f"\n--- Cycle {cycle} ---")
            run_afk_cycle(hwnd, args.key_duration, not args.no_focus)
            print(f"[INFO] Next cycle in {args.interval}s...")
            time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n[INFO] Stopped by user.")
            break
        except Exception as e:
            print(f"[ERROR] {e}")
            time.sleep(10)


if __name__ == "__main__":
    main()
