// The site's music: one playlist that plays across every page, without
// stopping when you change section. A "Spotify-style" player, powered for
// real by YouTube's own IFrame Player API — no audio is downloaded or re-hosted (that would break
// YouTube's terms and the underlying music's copyright); YouTube keeps
// serving and controlling playback, this just skins it with custom controls
// and a still thumbnail standing in for album art.
import { isPreview } from '../preview';

const PLAYLIST_ID = 'PLAixZQkw4oqQ';
// The playlist's first tracks, in the order the site plays them (positions
// in the YouTube playlist, 0 = first); the rest follow in playlist order.
// [1, 0]: the second track opens the site, then the first.
const OPENING = [1, 0];
const AUTOPLAY_CHECK = 1500; // ms to wait for the browser to allow playback with sound on launch
const START_AFTER_CARD = 1400; // ms — just after a home card has grown to fill the screen (home.ts)

interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  playVideoAt(index: number): void;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVolume(): number;
  setVolume(volume: number): void;
  getVideoData(): { video_id: string; title: string };
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
}

interface YtNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YtPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; CUED: number };
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YtNamespace> | null = null;

function loadYouTubeApi(): Promise<YtNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.append(tag);
  });
  return apiPromise;
}

/** "Artist - Title" is the overwhelming convention on YouTube uploads —
 *  split on it so the card reads like a real streaming-service credit line
 *  instead of one long raw video title. */
function splitTitle(raw: string): { title: string; artist: string } {
  const parts = raw.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') };
  }
  return { title: raw, artist: '' };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The same track shows in several places at once (the site-wide mini player,
 * and the Xandvar phone's lock-screen widget, home-screen widget and Music
 * app), so every display/control is looked up as a *list* across the page
 * and kept in sync together:
 *   .np-title .np-artist .np-art          track info
 *   .np-play .np-prev .np-next            controls
 *   .np-bar (> .np-bar-fill, .np-bar-handle), .np-time-current, .np-time-duration
 * <body> (and each .np-play) gets `is-playing` / `is-music-playing` while audio runs.
 *
 * The music starts as the site opens. Browsers usually only allow *sound*
 * once the visitor has interacted with the page, so if playing with sound
 * is refused, it plays muted (always allowed) and the sound comes on at
 * their first click, tap or key press — anywhere — without restarting the
 * track. From then on it simply keeps going.
 */
export function initMusic(): void {
  if (isPreview) return; // a silent preview on the home page: no player, no sound
  const all = <T extends Element>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
  // The invisible YouTube iframe lives on <body>, outside every page, so
  // nothing a page does (hiding, inert, transforms) can ever interrupt it.
  const host = document.createElement('div');
  host.className = 'np-yt';
  host.setAttribute('aria-hidden', 'true');
  document.body.append(host);
  const arts = all<HTMLImageElement>('.np-art');
  const titles = all<HTMLElement>('.np-title');
  const artists = all<HTMLElement>('.np-artist');
  const playBtns = all<HTMLButtonElement>('.np-play');
  const prevBtns = all<HTMLButtonElement>('.np-prev');
  const nextBtns = all<HTMLButtonElement>('.np-next');
  const bars = all<HTMLElement>('.np-bar');
  const currentTimes = all<HTMLElement>('.np-time-current');
  const durations = all<HTMLElement>('.np-time-duration');

  let player: YtPlayer | null = null;
  let playing = false;

  // ---- The site's own running order (see OPENING) ----
  // `pos` is where we are in that order. YouTube moves on by itself at the end
  // of a track, in *its* order — so the end of a track is caught and redirected.
  let order: number[] = [];
  let pos = 0;
  function buildOrder() {
    const n = player?.getPlaylist()?.length ?? 0;
    if (!n || order.length === n) return;
    const opening = OPENING.filter((i) => i < n);
    order = [...opening, ...Array.from({ length: n }, (_, i) => i).filter((i) => !opening.includes(i))];
  }
  function playAt(nextPos: number) {
    buildOrder();
    if (!player || !order.length) return;
    pos = (nextPos + order.length) % order.length;
    player.playVideoAt(order[pos]);
  }
  let rafId = 0;
  let muted = false; // playing silently until the first interaction (autoplay with sound was refused)

  function setMuted(next: boolean) {
    muted = next;
    document.body.classList.toggle('is-music-muted', muted);
  }

  function unmute() {
    if (!player || !muted) return;
    player.unMute();
    player.setVolume(100);
    setMuted(false);
  }

  function setPlaying(next: boolean) {
    playing = next;
    document.body.classList.toggle('is-music-playing', playing);
    for (const btn of playBtns) {
      btn.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    if (playing) tick();
    else cancelAnimationFrame(rafId);
  }

  function tick() {
    if (!playing || !player) return;
    const duration = player.getDuration() || 0;
    const current = player.getCurrentTime() || 0;
    const pct = duration ? (current / duration) * 100 : 0;
    for (const bar of bars) {
      bar.querySelector<HTMLElement>('.np-bar-fill')?.style.setProperty('width', `${pct}%`);
      bar.querySelector<HTMLElement>('.np-bar-handle')?.style.setProperty('left', `${pct}%`);
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    for (const el of currentTimes) el.textContent = formatTime(current);
    for (const el of durations) el.textContent = formatTime(duration);
    rafId = requestAnimationFrame(tick);
  }

  function refreshTrack() {
    const data = player?.getVideoData();
    if (!data?.video_id) return;
    const { title, artist } = splitTitle(data.title || 'Ren’s Mind');
    for (const el of titles) el.textContent = title;
    for (const el of artists) el.textContent = artist;
    for (const img of arts) img.src = `https://img.youtube.com/vi/${data.video_id}/hqdefault.jpg`;
  }

  loadYouTubeApi().then((YT) => {
    player = new YT.Player(host, {
      host: 'https://www.youtube-nocookie.com',
      playerVars: { listType: 'playlist', list: PLAYLIST_ID, index: OPENING[0] ?? 0, playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: () => {
          refreshTrack();
          // Start with the site. If the browser refuses sound, fall back to
          // playing muted until the visitor's first interaction.
          player?.playVideo();
          setTimeout(() => {
            if (!player || player.getPlayerState() === YT.PlayerState.PLAYING || interacted) return;
            player.mute();
            setMuted(true);
            player.playVideo();
          }, AUTOPLAY_CHECK);
        },
        onStateChange: (e: { data: number }) => {
          buildOrder();
          // A track ended: go on in our order, not YouTube's.
          if (e.data === YT.PlayerState.ENDED && order.length) {
            playAt(pos + 1);
            return;
          }
          // Safety net: if YouTube moved on by itself anyway, put the right track on.
          if (e.data === YT.PlayerState.PLAYING && order.length && player) {
            const index = player.getPlaylistIndex();
            if (index !== order[pos]) {
              const nextPos = (pos + 1) % order.length;
              if (index === order[nextPos]) pos = nextPos;
              else playAt(nextPos);
            }
          }
          setPlaying(e.data === YT.PlayerState.PLAYING);
          if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.CUED) refreshTrack();
        },
      },
    });
  });

  for (const btn of playBtns) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // the lock screen unlocks on click — a tap on its play button shouldn't
      if (!player) return;
      if (muted) unmute(); // the first press on play just turns the sound on
      else if (playing) player.pauseVideo();
      else player.playVideo();
    });
  }
  for (const btn of prevBtns) btn.addEventListener('click', (e) => { e.stopPropagation(); playAt(pos - 1); });
  for (const btn of nextBtns) btn.addEventListener('click', (e) => { e.stopPropagation(); playAt(pos + 1); });

  for (const bar of bars) {
    bar.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!player) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      player.seekTo(ratio * (player.getDuration() || 0), true);
    });
  }

  // ---- The visitor's first interaction: sound on (or start, if it never did) ----
  const startEvents = ['pointerdown', 'keydown'] as const;
  let interacted = false;
  function startOnce(e: Event) {
    interacted = true;
    for (const type of startEvents) document.removeEventListener(type, startOnce, true);
    const target = e.target as Element | null;
    // A first press on one of the player's own controls handles itself.
    if (target?.closest?.('.np-play, .np-prev, .np-next, .np-bar')) return;
    if (muted) {
      unmute(); // already playing silently: just bring the sound in
      return;
    }
    if (playing) return; // the browser allowed sound from the start
    const play = () => player?.playVideo(); // (not ready yet: it starts by itself once it is)
    // Starting the YouTube player is heavy for a moment: if this first press
    // opens a home-page card, wait until the card has finished growing.
    // (Once the visitor has interacted, the browser still allows sound later.)
    if (target?.closest?.('.card')) setTimeout(play, START_AFTER_CARD);
    else play();
  }
  for (const type of startEvents) document.addEventListener(type, startOnce, true);
}
