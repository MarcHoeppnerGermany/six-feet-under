; LOTRO AFK Keeper - AutoHotkey Version
; Sends W then S every 5 minutes to prevent AFK timeout
;
; Usage:
;   1. Install AutoHotkey (https://www.autohotkey.com/)
;   2. Double-click this file to run
;   3. Press F12 to toggle on/off
;   4. Press Esc to exit
;
; Configuration:
IntervalMinutes := 5      ; How often to send keys (in minutes)
KeyHoldTime := 300         ; How long to hold each key (in ms)
LotroTitle := "Lord of the Rings"  ; Window title to match

; --- Script ---
#Persistent
#SingleInstance Force
SetTitleMatchMode, 2       ; Partial window title match

Running := false
IntervalMs := IntervalMinutes * 60 * 1000

; Tray icon tooltip
Menu, Tray, Tip, LOTRO AFK Keeper (OFF)

F12::
    Running := !Running
    if (Running) {
        Menu, Tray, Tip, LOTRO AFK Keeper (ON)
        ToolTip, AFK Keeper: ON, , , 1
        SetTimer, RemoveToolTip, -2000
        SetTimer, DoAFKCycle, %IntervalMs%
        ; Run first cycle immediately
        GoSub, DoAFKCycle
    } else {
        Menu, Tray, Tip, LOTRO AFK Keeper (OFF)
        ToolTip, AFK Keeper: OFF, , , 1
        SetTimer, RemoveToolTip, -2000
        SetTimer, DoAFKCycle, Off
    }
return

Esc::
    ExitApp
return

DoAFKCycle:
    ; Only act if LOTRO window exists
    IfWinExist, %LotroTitle%
    {
        ; Save current active window
        WinGet, PrevWindow, ID, A

        ; Activate LOTRO
        WinActivate, %LotroTitle%
        WinWaitActive, %LotroTitle%, 2

        ; Press W (move forward)
        Send, {w down}
        Sleep, %KeyHoldTime%
        Send, {w up}

        Sleep, 500

        ; Press S (move backward)
        Send, {s down}
        Sleep, %KeyHoldTime%
        Send, {s up}

        ; Restore previous window
        if (PrevWindow) {
            WinActivate, ahk_id %PrevWindow%
        }
    }
return

RemoveToolTip:
    ToolTip, , , , 1
return
