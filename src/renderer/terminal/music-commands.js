/* /music for the terminal (M13, D-066): what plays on YouTube Music, basic controls, and pairing the Tama Companion
   browser extension. Merged into the terminal's command table through makeTamaCommands. */
window.makeMusicCommands = function makeMusicCommands(K, { info, error }) {
  const clock = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const ACTIONS = { play: 'play', pause: 'pause', next: 'next', skip: 'next', prev: 'prev', back: 'prev', like: 'like', dislike: 'dislike', shuffle: 'shuffle', repeat: 'repeat' };
  const install = (dir) => [
    '⎿  Install the Tama Companion extension (Chrome or Edge, once):',
    '    1. Open chrome://extensions (Edge: edge://extensions) and turn on Developer mode',
    '    2. Click "Load unpacked" and choose this folder (/music folder opens it):',
    `       ${dir}`,
    '    3. Type /music pair here, then click the extension\'s icon and enter the code',
  ].join('\n');

  function nowLine(s) {
    if (!s) return '⎿  Nothing is playing. Open music.youtube.com and play something~';
    const pos = s.duration ? ` · ${clock(s.position)} / ${clock(s.duration)}` : '';
    const extra = [s.like === 'like' ? '👍' : '', s.repeat && s.repeat !== 'off' ? `🔁 ${s.repeat}` : '', s.volume != null ? `🔊 ${s.volume}%` : ''].filter(Boolean).join(' ');
    const lines = [`⎿  ${s.playing ? '▶' : '⏸'} ${s.title}${s.artist ? ` · ${s.artist}` : ''}${s.album ? ` (${s.album})` : ''}${pos}${extra ? `  ${extra}` : ''}`];
    if (s.queue && s.queue.length) {
      const at = Math.max(0, s.queue.findIndex((x) => x.current));
      const next = s.queue.slice(at + 1, at + 4).map((x) => `${x.title}${x.artist ? ` · ${x.artist}` : ''}`);
      if (next.length) lines.push(`   up next: ${next.join(' → ')}`);
    }
    lines.push(`   via ${s.source === 'extension' ? 'Tama Companion' : `Windows media controls (${s.app})`}`);
    if (s.health && !s.health.ok) lines.push(`   ⚠ YouTube Music changed its page; not found: ${s.health.missing.join(', ')}`);
    return lines.join('\n');
  }

  // MUS-6: the last numbered lists, so "/music play 2" and "/music playlist 3" can pick from them.
  let lastSongs = [];
  let lastPlaylists = [];
  const why = (r) => `✗ ${r.error}${r.fix === 'connect' ? ' → /music youtube' : r.fix === 'enable-api' ? ' (APIs & Services → Library → YouTube Data API v3 → Enable)' : ''}`;
  const songLine = (x, i) => `   ${i + 1}. ${x.title}${x.artist ? ` · ${x.artist}` : ''}`;

  async function playWords(v) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && lastSongs[n - 1]) {
      const s = lastSongs[n - 1];
      const r = await K.music.play({ videoId: s.videoId });
      return r.ok ? info(`⎿  ▶ ${s.title}${s.artist ? ` · ${s.artist}` : ''}`) : error(`✗ ${r.error}`);
    }
    const r = await K.music.play({ query: v });
    if (!r.ok) return error(`✗ ${r.error}`);
    return info(r.song ? `⎿  ▶ ${r.song.title}${r.song.artist ? ` · ${r.song.artist}` : ''}` : `⎿  ${r.note || 'Opened YouTube Music.'}`);
  }

  async function library(c, v) {
    if (c === 'youtube') {
      info('⎿  Connecting YouTube (read-only)… finish the sign-in in your browser if it opens.');
      const r = await K.music.library({ op: 'connect' });
      return r.ok ? info('⎿  ✓ YouTube connected: /music playlists · /music search <words>') : error(why(r));
    }
    if (c === 'search') {
      if (!v) return error('✗ /music search <words>');
      const r = await K.music.library({ op: 'search', q: v });
      if (r.error) return error(why(r));
      lastSongs = (r.songs || []).slice(0, 10);
      if (!lastSongs.length) return info('⎿  Nothing found.');
      return info(`⎿  Songs for "${v}" (/music play <n>):\n${lastSongs.map(songLine).join('\n')}`);
    }
    if (c === 'playlists') {
      const r = await K.music.library({ op: 'playlists', fresh: true });
      if (r.error) return error(why(r));
      lastPlaylists = r.playlists || [];
      return info(`⎿  Your playlists (/music playlist <n> plays one):\n${lastPlaylists.map((p, i) => `   ${i + 1}. ${p.title}${p.liked ? '' : ` (${p.count})`}`).join('\n')}`);
    }
    // playlist <n>
    const p = lastPlaylists[Number(v) - 1];
    if (!p) return error('✗ /music playlists first, then /music playlist <n>');
    const r = await K.music.play({ playlistId: p.id });
    return r.ok ? info(`⎿  ▶ playlist ${p.title}`) : error(`✗ ${r.error}`);
  }

  return {
    music: ['YouTube Music: now playing, controls, your playlists (play <song>|search|playlists|playlist <n>|youtube|widget|pair|lyrics|vol|seek)', async (arg) => {
      const [cmd = '', ...rest] = String(arg || '').trim().split(/\s+/);
      const c = cmd.toLowerCase();
      const v = rest.join(' ');
      if (c === 'play' && v) return playWords(v);
      if (['youtube', 'search', 'playlists', 'playlist'].includes(c)) return library(c, v);
      if (ACTIONS[c]) {
        const r = await K.music.control(ACTIONS[c]);
        return r.ok ? info(`⎿  ${c} ✓`) : error(`✗ ${r.error}`);
      }
      switch (c) {
        case 'pair': {
          const r = await K.music.pair();
          if (!r.port) return error('✗ The music link isn\'t running (another app may be using ports 47821–47825).');
          return info(`⎿  🔗 Pairing code: ${r.code}  (valid 10 minutes)\n   Click the Tama Companion icon in your browser and enter it.\n   Not installed yet? /music install`);
        }
        case 'dj': case 'beat': {
          const m = (rest[0] || '').toLowerCase();
          if (m !== 'on' && m !== 'off') return error(`✗ /music ${c} on|off`);
          await K.ui.setPrefs(c === 'dj' ? { musicDj: m === 'on' } : { musicBeat: m === 'on' });
          if (c === 'dj') return info(m === 'on' ? '⎿  🎧 DJ mode on: headphones and decks while music plays' : '⎿  DJ mode off');
          return info(m === 'on' ? '⎿  🥁 I follow the real beat (I listen to your PC sound, only on this PC, nothing is recorded)' : '⎿  Beat sync off: I groove at a steady tempo');
        }
        case 'widget': {
          const m = (rest[0] || '').toLowerCase();
          if (m === 'off' || m === 'auto') {
            const r = await K.ui.setPrefs({ musicWidget: m });
            if (r && r.error) return error(`✗ ${r.error}`);
            return info(m === 'off' ? '⎿  The music card will not pop up by itself (/music widget opens it).' : '⎿  The music card shows beside me while a song plays.');
          }
          K.music.widget('open');
          return info('⎿  🎵 Music card open (✕ closes it · /music widget off|auto)');
        }
        case 'unpair': await K.music.unpair(); return info('⎿  Forgot the paired browser. /music pair to pair again.');
        case 'folder': { const r = await K.music.openFolder(); return r.ok ? info('⎿  Opened the extension folder.') : error('✗ No extension folder found.'); }
        case 'install': { const st = await K.music.get(); return info(install(st.extension.dir)); }
        case 'vol': case 'volume': {
          const r = await K.music.control('volume', Number(v));
          return r.ok ? info(`⎿  🔊 ${Math.round(Number(v))}%`) : error(`✗ ${r.error}`);
        }
        case 'seek': {
          const p = v.split(':').map(Number);
          const ms = p.some((n) => !Number.isFinite(n)) ? NaN : p.reduce((a, n) => a * 60 + n, 0) * 1000;
          const r = await K.music.control('seek', ms);
          return r.ok ? info(`⎿  ⏩ ${v}`) : error(`✗ ${r.error}`);
        }
        case 'open': {
          const r = await K.music.control('open', v);
          return r.ok ? info('⎿  ▶ opening on YouTube Music') : error(`✗ ${r.error}`);
        }
        case 'lyrics': {
          const r = await K.music.control('lyrics');
          if (!r.ok) return error(`✗ ${r.error}`);
          return info(r.lyrics ? `⎿  ${r.lyrics.split('\n').join('\n   ')}` : '⎿  No lyrics for this song on YouTube Music.');
        }
        case '': case 'now': case 'status': {
          const st = await K.music.get();
          const e = st.extension;
          const link = e.connected ? `🧩 Companion connected${e.tabs ? '' : ' (no YouTube Music tab open)'}` : e.paired ? '🧩 Companion paired, not connected (is the browser open?)' : '🧩 Companion not paired: /music install, then /music pair';
          return info(`${nowLine(st.state)}\n   ${link}${st.media.available ? '' : ' · Windows media controls unavailable'}`);
        }
        default: return error('✗ /music [now|play [song|n]|search <words>|playlists|playlist <n>|youtube|pause|next|prev|like|dislike|shuffle|repeat|vol <n>|seek <m:ss>|lyrics|open <link>|widget [off|auto]|dj on|off|beat on|off|pair|unpair|install|folder]');
      }
    }],
  };
};
