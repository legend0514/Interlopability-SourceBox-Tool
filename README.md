# SourceBox beta v1.5

[Download SourceBox v1.5](https://github.com/legend0514/Interlopability-SourceBox-Tool/releases/download/v1.5/sourcebox-beta-v1.5.zip)

[Browse the source](https://github.com/legend0514/Interlopability-SourceBox-Tool-v1.4-Source-Code) · [Source ZIP](https://github.com/legend0514/Interlopability-SourceBox-Tool/releases/download/v1.5/sourcebox-beta-v1.5-source.zip)

Extract the entire ZIP, close the old SourceBox session and run **Install SourceBox.cmd**. Back up your settings before updating. The launcher and diagnostics now identify themselves as **1.5.0-beta.1**.

## Changes

- Verify a live GMod bridge by installation folder, executable, process ID and start time, even while it reconnects. Unrelated processes are never stopped automatically.
- Keep remote players visible through short gaps in updates. Known deaths still remove proxies promptly. Unknown HL2/GMod weapon visuals no longer disconnect crossplay.
- Improve E+R destination input and report unavailable connections or missing destination maps.
- Disable Share Cube and remove its Portal Gun interaction conflict. Ordinary props, player synchronization and portal travel remain.
- Include the previous TF2 class-selection fix and window sizing improvements.

## Scope and known issues

This experimental beta runs installed games locally on one PC. It is not internet matchmaking. The portable download includes the Shared Room; expanded maps and map destinations are not bundled.

HL2 and TF2 require Source SDK Base 2013 Multiplayer. CS2 preparation requires its Workshop Tools. Other installation requirements are in the ZIP. Initial setup can download tools and convert locally installed assets; additional disk space is needed.

Deathmatch portal rendering and missing audio remain under investigation. Fresh-PC gameplay and the latest fixes have not been independently confirmed. SourceBox is unsigned and has not had an independent security audit. Publishing source supports inspection but does not certify the binaries as safe.

Validation: **34 launcher checks and 60 coordinator tests passed**. HL2, TF2 and Deathmatch adapters compiled. SHA-256 checksum files accompany both downloads. SDK-derived code retains Valve's license restrictions; see the source licenses.

Older ZIPs were removed from the current repository listing. Their history remains available.
