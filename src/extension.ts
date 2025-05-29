// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

// 播放状态类型
type PlayerState = {
	name: string;
	artists: string[];
	sourceUrl: string;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
};

// 状态管理器
const stateManager = {
	getState(context: vscode.ExtensionContext): PlayerState | undefined {
		return context.globalState.get('music-player.state');
	},
	setState(context: vscode.ExtensionContext, state: PlayerState) {
		context.globalState.update('music-player.state', state);
	},
	clearState(context: vscode.ExtensionContext) {
		context.globalState.update('music-player.state', undefined);
	}
};

let playerPanel: vscode.WebviewPanel | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration('music-player');
	const savePath = config.get<string>('savePath') || '默认路径';

	// 注册命令：在线播放
	const playOnline = vscode.commands.registerCommand('siren-music-player.playOnline', async () => {
		const cid = await pickSong();
		if (!cid) {
			vscode.window.showWarningMessage('未选择任何歌曲');
			return;
		}
		const detail = await fetchSongDetail(cid);
		if (!detail.sourceUrl) {
			vscode.window.showErrorMessage('未找到该歌曲的音频资源');
			return;
		}
		// 构造初始播放状态
		const config = vscode.workspace.getConfiguration('music-player');
		const state: PlayerState = {
			name: detail.name,
			artists: detail.artists,
			sourceUrl: detail.sourceUrl,
			isPlaying: true,
			currentTime: 0,
			duration: 0,
			volume: config.get<number>('volume', 1),
		};
		const savePath = config.get<string>('savePath') || context.extensionPath;
		const ext = path.extname(detail.sourceUrl);
		const uri = vscode.Uri.file(path.join(savePath, `${detail.name}${ext}`));
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `正在下载：${detail.name}`,
			cancellable: false
		}, async (progress) => {
			try {
				await vscode.workspace.fs.stat(uri);
			} catch (e) {
				// 文件不存在
				await downloadFile(detail.sourceUrl, uri.fsPath);
				vscode.window.showInformationMessage(`下载完成：${uri.fsPath}`);
			}
			// 下载完成后自动播放
			stateManager.setState(context, state);
			showPlayerPanel(context, state);
		});
		
	});
	context.subscriptions.push(playOnline);

	// 激活时自动恢复上次播放
	const lastState = stateManager.getState(context);
	if (lastState && lastState.sourceUrl) {
		showPlayerPanel(context, lastState);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}

interface Song {
	cid: string;
	name: string;
	albumCid: string;
	artists: string[];
}

async function fetchSongList(): Promise<Song[]> {
	const res = await fetch('https://monster-siren.hypergryph.com/api/songs');
	const json = await res.json();
	return json.data.list as Song[];
}

async function pickSong(): Promise<string | undefined> {
	const songs = await fetchSongList();
	const pick = await vscode.window.showQuickPick(
		songs.map(song => ({
			label: song.name,
			description: song.artists.join(', '),
			detail: song.cid,
		})),
		{ placeHolder: '选择一首歌曲在线播放' }
	);
	return pick?.detail;
}

async function fetchSongDetail(cid: string) {
	const res = await fetch(`https://monster-siren.hypergryph.com/api/song/${cid}`);
	const json = await res.json();
	return json.data;
}

async function downloadFile(url: string, dest: string) {
	const res = await fetch(url);
	const fileStream = fs.createWriteStream(dest);
	await new Promise<void>((resolve, reject) => {
		res.body.pipe(fileStream);
		res.body.on('error', () => reject());
		fileStream.on('finish', () => resolve());
	});
}

function createPlayerWebview(context: vscode.ExtensionContext, filePath: string) {
	const config = vscode.workspace.getConfiguration('music-player');
	const defaultVolume = config.get<number>('volume', 1);

	const panel = vscode.window.createWebviewPanel(
		'musicPlayer',
		'音乐播放器',
		{ viewColumn: vscode.ViewColumn.One, preserveFocus: true },
		{ enableScripts: true, localResourceRoots: [vscode.Uri.file(path.dirname(filePath))] }
	);
	const fileUri = panel.webview.asWebviewUri(vscode.Uri.file(filePath));
	panel.webview.html = getPlayerHtml(fileUri.toString(), defaultVolume);

	// 监听Webview消息，保存音量
	panel.webview.onDidReceiveMessage(msg => {
		if (msg.type === 'setVolume') {
			config.update('volume', msg.value, vscode.ConfigurationTarget.Global);
		}
	});
}

// 参考CodePen样式，生成播放器HTML
function getPlayerHtml(audioSrc: string, defaultVolume: number, name: string = '正在播放'): string {
	return `
	<!DOCTYPE html>
	<html lang="zh-CN">
	<head>
		<meta charset="UTF-8">
		<title>音乐播放器</title>
		<style>
			body {
				margin: 0;
				padding: 0;
				background: transparent;
				font-family: 'Segoe UI', 'Arial', sans-serif;
			}
			.player-container {
				position: fixed;
				bottom: 0;
				left: 0;
				width: 100vw;
				background: #232526;
				box-shadow: 0 -2px 8px rgba(0,0,0,0.2);
				display: flex;
				align-items: center;
				justify-content: center;
				height: 90px;
				z-index: 9999;
			}
			.player {
				display: flex;
				align-items: center;
				width: 480px;
				padding: 10px 20px;
				background: #232526;
				border-radius: 12px 12px 0 0;
				box-shadow: 0 0 8px rgba(0,0,0,0.2);
			}
			.player .cover {
				width: 60px;
				height: 60px;
				background: #444;
				border-radius: 8px;
				margin-right: 16px;
				display: flex;
				align-items: center;
				justify-content: center;
				color: #fff;
				font-size: 32px;
			}
			.player .info {
				flex: 1;
				color: #fff;
				display: flex;
				flex-direction: column;
				justify-content: center;
			}
			.player .controls {
				margin-left: 16px;
				display: flex;
				flex-direction: column;
				align-items: center;
			}
			.player .controls button {
				background: none;
				border: none;
				color: #fff;
				font-size: 24px;
				cursor: pointer;
				margin: 0 4px;
			}
			.player .progress {
				width: 100%;
				height: 4px;
				background: #444;
				border-radius: 2px;
				margin: 8px 0 4px 0;
				overflow: hidden;
				cursor: pointer;
				position: relative;
			}
			.player .progress-bar {
				height: 100%;
				background: #1db954;
				width: 0%;
			}
			.time-info {
				font-size: 12px;
				color: #bbb;
				display: flex;
				justify-content: space-between;
			}
			.volume-container {
				display: flex;
				align-items: center;
				margin-top: 8px;
			}
			.volume-slider {
				width: 70px;
				margin-left: 6px;
			}
		</style>
	</head>
	<body>
		<div class="player-container">
			<div class="player">
				<div class="cover">🎵</div>
				<div class="info">
					<div id="song-title" style="font-weight:bold;">${name}</div>
					<div class="progress" id="progress">
						<div class="progress-bar" id="progress-bar"></div>
					</div>
					<div class="time-info">
						<span id="current-time">00:00</span>
						<span id="total-time">00:00</span>
					</div>
					<div class="volume-container">
						<span>🔊</span>
						<input type="range" id="volume-slider" class="volume-slider" min="0" max="1" step="0.01" value="${defaultVolume}">
					</div>
				</div>
				<div class="controls">
					<button id="play-pause">⏸️</button>
				</div>
			</div>
			<audio id="audio" src="${audioSrc}" autoplay></audio>
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			const audio = document.getElementById('audio');
			const playPauseBtn = document.getElementById('play-pause');
			const progressBar = document.getElementById('progress-bar');
			const progress = document.getElementById('progress');
			const currentTimeSpan = document.getElementById('current-time');
			const totalTimeSpan = document.getElementById('total-time');
			const volumeSlider = document.getElementById('volume-slider');

			audio.volume = ${defaultVolume};
			audio.play();

			playPauseBtn.onclick = function() {
				if (audio.paused) {
					audio.play();
					playPauseBtn.textContent = '⏸️';
				} else {
					audio.pause();
					playPauseBtn.textContent = '▶️';
				}
			};

			audio.ontimeupdate = function() {
				if (audio.duration) {
					progressBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
					currentTimeSpan.textContent = formatTime(audio.currentTime);
				}
			};
			audio.onloadedmetadata = function() {
				totalTimeSpan.textContent = formatTime(audio.duration);
			};
			audio.onended = function() {
				audio.currentTime = 0;
				audio.play();
			};

			// 拖动进度条
			progress.addEventListener('click', function(e) {
				const rect = progress.getBoundingClientRect();
				const percent = (e.clientX - rect.left) / rect.width;
				audio.currentTime = percent * audio.duration;
			});

			// 音量调节
			volumeSlider.addEventListener('input', function() {
				audio.volume = volumeSlider.value;
				vscode.postMessage({ type: 'setVolume', value: Number(volumeSlider.value) });
			});

			function formatTime(sec) {
				if (isNaN(sec)) return '00:00';
				const m = Math.floor(sec / 60);
				const s = Math.floor(sec % 60);
				return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
			}
		</script>
	</body>
	</html>
	`;
}

// ----------------- Panel管理 -----------------
function showPlayerPanel(context: vscode.ExtensionContext, state: PlayerState) {
	if (playerPanel) {
		playerPanel.reveal(undefined, true);
		playerPanel.webview.postMessage({ type: 'play', state });
		return;
	}
	playerPanel = vscode.window.createWebviewPanel(
		'musicPlayer',
		'音乐播放器',
		{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
		{ enableScripts: true, retainContextWhenHidden: true }
	);
	playerPanel.webview.html = getPlayerHtml(state.sourceUrl, state.volume, state.name);
	playerPanel.onDidDispose(() => { playerPanel = undefined; });

	// Webview与插件通信
	playerPanel.webview.onDidReceiveMessage(msg => {
		if (msg.type === 'updateState') {
			// Webview主动上报播放状态
			stateManager.setState(context, msg.state);
		} else if (msg.type === 'getState') {
			// Webview请求恢复状态
			const last = stateManager.getState(context);
			if (last) {
				playerPanel?.webview.postMessage({ type: 'restoreState', state: last });
			}
		}
	});
}
