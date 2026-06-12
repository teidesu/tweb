---
name: tg-port-feature
description: Port a feature into tweb (Telegram Web K) using one of the official Telegram clients as a reference implementation. Use when the user asks to implement, port, replicate, or compare a feature that exists in TDLib or Telegram for iOS, Android (DrKLO), or Desktop (tdesktop) — phrases like "implement X like in iOS / tdesktop / Android", "check against tdlib", "port X from the official client", "сделай как в iOS / Android / Desktop", "как у официального клиента", "посмотри как в [клиенте]". Also use when investigating how an official client or TDLib handles a specific MTProto flow, data/storage logic (counters, caching, update handling), UI behavior, or edge case before writing tweb code. Reference repos are pre-cloned locally — paths are listed inside the skill.
---

# Port a feature from an official Telegram client

This skill is the standard procedure for replicating a feature that exists in an official Telegram client into **tweb** (Telegram Web K, Solid.js + TS). All reference clients are cloned locally so they can be `grep`-ed and read directly — no GitHub round-trips needed.

## Reference repositories

The skill expects the official Telegram clients to be cloned at `~/repo`

| Client | Default path | Tech | Recommended clone | When to prefer |
|---|---|---|---|---|
| **TDLib** | `~/repo/td` | C++17 | `--depth 1 --filter=blob:none` | **THE go-to reference for data/storage handling**: counters, read cursors, dialog/message caching, holes & gaps, update sequencing (pts/qts), repair/reconciliation flows. It is the engine behind iOS/Android(X)/Bot clients, has no UI, and encodes more correctness edge cases than any GUI client. tweb maintains its own message cache, so TDLib's cache-consistency invariants map best. |
| **Desktop** (tdesktop) | `~/repo/tdesktop` | C++17, Qt | `--depth 1 --filter=blob:none` (~85 MB) | Default for UX/UI questions if user doesn't specify. Most desktop-aligned UX. Often the cleanest abstraction layer. NOTE: no offline message database — its data-layer model can be too simple for tweb. |
| **Android** (DrKLO) | `~/repo/TelegramAndroid` | Java | full history (~11 GB) or `--depth 1 --filter=blob:none` (~700 MB) | Mobile-aligned UX, animation timing, gestures. Has a real local SQLite message DB (`MessagesStorage`), so it's a good second opinion on storage logic. Single huge module — `grep` first, navigate second. |
| **iOS** (TelegramMessenger) | `~/repo/Telegram-iOS` | Swift | `--depth 1 --filter=blob:none` (~575 MB) | Best modular separation. Each feature is its own submodule with a self-explanatory name. |

Rule of thumb: **UI/UX shape → a GUI client; data flow, caching, counters, update handling → TDLib first**, then cross-check one GUI client (Android for storage, tdesktop otherwise).

### Setup (one-time, only if any repo is missing)

Before invoking the skill, check the paths above exist. If any is missing, clone it as a sibling of `tweb`:

```bash
cd ~/repo
git clone https://github.com/tdlib/td.git
git clone https://github.com/telegramdesktop/tdesktop.git
git clone https://github.com/DrKLO/Telegram.git TelegramAndroid
git clone https://github.com/TelegramMessenger/Telegram-iOS.git
```

If a clone goes stale, refresh with `git pull`. Check for staleness and notify the user if the gap is big enough, before refreshing.

## Specifying the reference client

The user picks the client; the skill MUST honour that choice.

| User says | Use |
|---|---|
| "like in iOS", "сделай как в iOS", "из Telegram-iOS" | **iOS** |
| "like in tdesktop", "из Desktop", "как в десктопе" | **Desktop** |
| "like in Android", "как в Android", "из DrKLO" | **Android** |
| "like in the official client", "как у официального клиента" — no specific platform | **Desktop** (default), but mention which one was chosen and offer to cross-check another |
| "like in TDLib", "как в tdlib", "check against td" | **TDLib** |
| "compare across clients" / "посмотри во всех" | All of them (TDLib included for data-layer questions), then summarize differences before implementing |

If the feature renders very differently per platform (e.g., a swipe-driven UI), surface that to the user in 1–2 sentences and ask which one to follow before writing code.

## Where common feature areas live

### TDLib — `~/repo/td/td/telegram/`

Flat directory, ~800 files, one `XxxManager.cpp` per domain. Key files:

| File | Contains |
|---|---|
| `MessagesManager.cpp/.h` | THE core: dialogs, messages, unread counters, read cursors (`read_history_inbox`), history loading, drafts, pinned. 36k lines — `grep -n` first, never read top-to-bottom. |
| `OrderedMessage.cpp` | In-memory ordered message tree per dialog; unread recount helpers (`calc_new_unread_count_*`) — the canonical hole-aware counter math |
| `UpdatesManager.cpp` | Update sequencing: pts/qts/seq gaps, getDifference, channel difference |
| `DialogManager.cpp` | Dialog-level ops (access, blocking, titles) |
| `ChatManager.cpp` / `UserManager.cpp` | Chats/channels and users data + full-info |
| `MessageDb.cpp`, `DialogDb.cpp`, `MessageThreadDb.cpp`, `StoryDb.cpp` | SQLite persistence layer — what gets stored, indexed, and how holes are represented |
| `TdDb.cpp` | DB assembly/versioning/migrations |
| `files/FileManager.cpp` | File/download/upload state machine |
| `StoryManager.cpp`, `StickersManager.cpp`, `NotificationManager.cpp`, `BoostManager.cpp`, … | One manager per feature, names are self-explanatory |
| `MessageId.h`, `DialogId.h` | Id semantics (server/local/yet-unsent message ids, peer id packing) |

MTProto calls look like `telegram_api::messages_readHistory`; TDLib-API methods the GUI clients call look like `td_api::xxx`. When tracing "what does the server expect", grep `telegram_api::`; when tracing "what do iOS/Android-X apps see", grep `td_api::`.

### tdesktop — `~/repo/tdesktop/Telegram/SourceFiles/`

| Subdir | Contains |
|---|---|
| `api/` | Manager-like API call wrappers (`api_*.cpp` — gifts, premium, peer_photo, statistics, …) |
| `apiwrap.cpp/.h` | Top-level API dispatcher — start here for "what MTProto call does feature X make" |
| `boxes/` | Modal dialogs / popups (`*_box.cpp`) |
| `chat_helpers/` | Composer, attachment menu, bots, stickers |
| `data/` | Domain models (`data_chat`, `data_messages`, `data_stories`, `data_session`) |
| `dialogs/` | Chat list |
| `history/` | Message rendering, reactions, replies |
| `info/` | Profile/info/settings screens (per-section subfolders) |
| `media/` | Media viewer, audio/video player |
| `menu/` | Context menus |
| `mtproto/` | Protocol layer |
| `payments/` | Stars, gifts, premium, checkout |
| `settings/` | Settings UI |
| `statistics/` | Channel/group stats |
| `storage/` | Local storage wrappers |
| `passport/`, `inline_bots/`, `support/`, `intro/`, `iv/`, `editor/`, `export/`, `tde2e/` | Self-explanatory |

### Android DrKLO — `~/repo/Telegram/TMessagesProj/src/main/java/org/telegram/`

| Subdir | Contains |
|---|---|
| `messenger/` | Backend / managers — start here for data flow. Key files: `MessagesController.java`, `MediaDataController.java`, `ConnectionsManager.java`, `NotificationCenter.java`, `MessagesStorage.java`, `*Controller.java` (Stories, Payments, …) |
| `tgnet/` | Generated MTProto bindings (`TLRPC$*`) and protocol layer |
| `ui/` | UI surface (Activities & Fragments — huge files like `ChatActivity.java`, `DialogsActivity.java`, `ProfileActivity.java`) |
| `ui/Cells/` | List cells |
| `ui/Components/` | Custom views |
| `ui/Stars/`, `ui/Stories/`, `ui/Gifts/`, `ui/Business/` | Feature-specific UI |

For Android, ALWAYS `grep -rn` first — the files are too big to read top-to-bottom.

### Telegram-iOS — `~/repo/Telegram-iOS/submodules/`

Modular layout. Each module name maps to a feature. Examples:
- `ChatListUI/` — chat list
- `ChatPresentationInterfaceState/`, `ChatMessageInteractiveMediaNode/` — chat interior
- `StoryContainerScreen/`, `MediaEditor/` — stories
- `PremiumUI/`, `GiftSetupScreen/`, `StarsUI/` — monetization
- `PeerInfoUI/`, `SettingsUI/`, `PeerInfoScreen/` — info/settings
- `TelegramCore/` — managers, state, signal pipelines
- `TelegramApi/` — generated MTProto bindings (`Api.functions.*`)
- `TelegramUI/` — top-level UI assembly

Search by feature noun first (`ls submodules | grep -i story`); the names are descriptive.

## Exploration workflow

1. **Locate the feature.** For anything beyond a one-line lookup, spawn an `Explore` subagent scoped to the chosen reference repo so its read-window doesn't blow up the main context:

   ```
   Agent({
     subagent_type: "Explore",
     description: "Find gift resale flow in tdesktop",
     prompt: "In ~/repo/tdesktop, find where the 'resell unique gift' flow is implemented. I need: (1) the popup/box class, (2) the MTProto method(s) called and their params, (3) the data model/struct that backs the gift state. Search breadth: medium."
   })
   ```

   For Android use `~/repo/TelegramAndroid/TMessagesProj/src/main/java`, for iOS use `~/repo/Telegram-iOS/submodules`, for TDLib use `~/repo/td/td/telegram`.

2. **Find the MTProto method(s).** This is the most portable signal across clients — the same method name maps directly to tweb. Search patterns:
   - TDLib: `grep -rn "telegram_api::messages_xxxx" td/telegram`
   - tdesktop: `grep -rn "MTPxxxxxx" Telegram/SourceFiles` (e.g. `MTPpayments_GetStarGifts`)
   - Android: `grep -rn "TLRPC\$TL_xxxxxx" TMessagesProj/src/main/java`
   - iOS: `grep -rn "Api.functions.xxxx" submodules`
   - tweb equivalent: `await rootScope.managers.apiManager.invokeApi('xxxx', {…})`

3. **Read the equivalent area in tweb.** tweb's manager pattern (`src/lib/appManagers/`) maps loosely to tdesktop's `Data::*` / Android's `*Controller` / iOS's `Telegram*` modules. Check whether the feature already has a partial implementation — often a method exists but the UI surface is missing.

4. **Translate, don't transliterate.** Their UI code is throwaway for our purposes — re-implement in Solid.js + tweb conventions. What you actually port:
   - **Data flow**: which MTProto methods, in what order, with what params/flags.
   - **Edge cases**: error paths, empty states, retry/throttle/backoff behavior.
   - **UX shape**: when to show what (popup vs page vs inline), button placements, copy.
   - **NOT** their widget tree — Qt / Android Views / SwiftUI don't translate.

## Translating tech idioms → tweb

| Other client | tweb equivalent |
|---|---|
| `MTP::send(MTPxxxx(…))` (tdesktop), `ConnectionsManager.sendRequest(TL_xxxx)` (Android), `network.request(Api.functions.xxxx)` (iOS), `telegram_api::xxxx` query actor (TDLib) | `await rootScope.managers.apiManager.invokeApi('xxxx', {…})` |
| `Data::Session` / `MessagesController` / `TelegramCore.Account` / TDLib `XxxManager` | a manager method on `rootScope.managers.app*Manager` |
| TDLib `MessageDb`/`DialogDb` (SQLite) | tweb storages (`src/lib/storages/`, IndexedDB-backed) + in-memory `historyStorage` slices (`SlicedArray`) |
| TDLib `send_update_xxx` to TDLib-API clients | `rootScope.dispatchEvent('event_name', …)` |
| Android `NotificationCenter.postNotificationName(…)` | `rootScope.dispatchEvent('event_name', …)` |
| Android `NotificationCenter.addObserver(…)` / iOS Signal subscription | `rootScope.addEventListener('event_name', handler)` |
| iOS `Signal<T>` / `Promise<T>` | regular `Promise<T>` or a Solid signal (`createSignal`) for reactive UI state |
| tdesktop `Ui::show(Box<XxxBox>(…))` | `PopupElement` subclass under `@components/popups` (use the procedural `showXxxPopup()` pattern — see `feedback_popup_refactor.md` in user memory) |
| Android `BottomSheet` / `AlertDialog` | popup or `confirmationPopup` |
| iOS `present(controller)` / push to nav stack | popup or new tab via `slideTabsAddTab` |
| tdesktop `style::*` constants | SCSS variables in `src/scss/` or component-scoped `.module.scss` |

## When official clients disagree

If iOS / Android / Desktop implement the same feature differently (different popup vs page, different option ordering, different default, different MTProto flag values), and the user didn't pre-select a reference:

1. For **data/storage/consistency** behavior: **TDLib wins** — GUI clients simplify or skip cache invariants TDLib enforces.
2. For UI/UX: default to **android** (canonical-most often).
3. In your reply, surface the disagreement in 1–2 sentences with the trade-off, and let the user redirect before you write code.

Example: "iOS shows resale price as a single field; Android splits it into 'price' + 'currency picker'. Defaulting to android's split-field approach — say if you'd prefer Android's split UI."

## Memory & follow-ups

- After porting a non-trivial feature, consider noting any tweb-specific gotchas in user memory (e.g. "the X manager doesn't expose Y, had to add it") so the next port doesn't re-discover them.
- If the reference client used an MTProto method tweb has never called before, double-check the type in `src/layer.d.ts` (`@layer`) before assuming the call signature.

## What this skill does NOT cover

- Pure tweb-internal refactors with no other-client reference.
- MTProto bug debugging — use `tweb-mtproto-debug` instead.
- Updating the reference repos themselves — `git pull` manually if you want fresher code.
- Reading/scraping non-official Telegram clients (third-party forks, unofficial mods).
