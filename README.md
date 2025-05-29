# music-player README

A simple **music player extension** for Visual Studio Code that allows you to stream and play songs directly from the [Monster Siren](https://monster-siren.hypergryph.com/) music API. This extension supports searching, downloading, and playing songs without leaving your editor.

## Features

* 🎵  **Browse and Select Songs** : Choose from a list of available songs via the Monster Siren API.
* 📥  **Download & Cache** : Automatically downloads selected songs to a configurable path for local playback.
* 🔊  **Playback Controls** : Play, pause, and adjust volume from within a dedicated webview panel.
* ⏱️  **Progress Tracking** : Real-time progress bar and time display during playback.
* 🔄  **Repeat Playback** : Toggle repeat mode to loop the current song.
* 📁  **Resume on Startup** : Automatically resumes the last played track when VS Code restarts.

> Tip: You can pin the player to always stay visible while working in other files.

## Requirements

This extension has no external dependencies beyond what is provided by Visual Studio Code.

## Extension Settings

This extension contributes the following settings:

* `music-player.savePath`: Set a custom directory to save downloaded audio files (default is the extension path).
* `music-player.volume`: Default playback volume level (0.0 - 1.0).

You can configure these in your VS Code user or workspace settings.

## Known Issues

* Currently only supports single-song playback (no playlist support yet).
* Volume setting may not persist correctly across multiple sessions if manually edited elsewhere.

## Release Notes

### 1.0.0

Initial release with basic online music playback functionality.

### 1.0.1

Added repeat playback and improved state persistence.
