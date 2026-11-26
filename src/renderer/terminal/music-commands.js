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

  return {
    music: ['YouTube Music: now playing, controls, extension (pair|unpair|folder|lyrics|vol <0-100>|seek <m:ss>|open <link>)', async (arg) => {
      const [cmd = '', ...rest] = String(arg || '').trim().split(/\s+/);
      const c = cmd.toLowerCase();
      const v = rest.join(' ');
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
        default: return error('✗ /music [now|play|pause|next|prev|like|dislike|shuffle|repeat|vol <n>|seek <m:ss>|lyrics|open <link>|pair|unpair|install|folder]');
      }
    }],
  };
};
