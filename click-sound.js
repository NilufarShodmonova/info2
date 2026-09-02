/*!
 * click-sound.js — minimal synthesised UI click, no audio file, no dependencies.
 *
 * Drop into any project:
 *   <script src="click-sound.js"></script>
 *
 * By default it ticks on every button / link / input. Narrow or widen that with a
 * selector on the tag itself:
 *   <script src="click-sound.js" data-selector=".btn, .card, .kb-key"></script>
 *
 * Or configure at runtime:
 *   ClickSound.configure({ selector: '.btn', volume: 0.3, frequency: 1800 });
 *   ClickSound.play();          // fire one tick manually
 *   ClickSound.configure({ enabled: false });   // mute
 */
(function (global) {
  'use strict';

  var cfg = {
    // what counts as clickable; matched with closest() so children of a button count too
    selector: 'button, a, input, select, textarea, [role="button"], [onclick], .clickable',
    volume: 0.24,       // peak gain, 0..1
    duration: 0.035,    // seconds of noise burst
    frequency: 2400,    // bandpass centre — higher is thinner/drier, lower is softer
    Q: 1.1,             // bandpass width
    event: 'pointerdown', // fires on press rather than release, so the tick lands with the finger
    enabled: true
  };

  var audioCtx = null, clickBuf = null, bufDur = null;

  // Built lazily inside the first gesture: creating the context during a user
  // gesture means even the very first tap is audible, with no autoplay block.
  function getAudio() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();

    // one short burst of decaying noise, reused for every click
    if (!clickBuf || bufDur !== cfg.duration) {
      var frames = Math.ceil(audioCtx.sampleRate * cfg.duration);
      clickBuf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
      var data = clickBuf.getChannelData(0);
      for (var i = 0; i < frames; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3);
      }
      bufDur = cfg.duration;
    }
    return audioCtx;
  }

  function play() {
    if (!cfg.enabled) return;
    try {
      var ctx = getAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = clickBuf;

      var bp = ctx.createBiquadFilter();      // bandpass turns the noise into a dry tick
      bp.type = 'bandpass';
      bp.frequency.value = cfg.frequency;
      bp.Q.value = cfg.Q;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(cfg.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + cfg.duration);

      src.connect(bp).connect(gain).connect(ctx.destination);
      src.start(t);
      src.stop(t + cfg.duration + 0.005);
    } catch (e) { /* audio unavailable: stay silent, never break the UI */ }
  }

  function onPress(e) {
    var el = e.target;
    if (el && el.closest && el.closest(cfg.selector)) play();
  }

  var bound = null;
  function attach() {
    detach();
    bound = cfg.event;
    document.addEventListener(bound, onPress, true);
  }
  function detach() {
    if (bound) document.removeEventListener(bound, onPress, true);
    bound = null;
  }

  function configure(opts) {
    var reattach = opts && 'event' in opts && opts.event !== cfg.event;
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) cfg[k] = opts[k];
    if (reattach) attach();
    return cfg;
  }

  // pick up a selector declared on the <script> tag
  var tag = document.currentScript;
  if (tag) {
    if (tag.dataset.selector) cfg.selector = tag.dataset.selector;
    if (tag.dataset.volume) cfg.volume = parseFloat(tag.dataset.volume);
    if (tag.dataset.frequency) cfg.frequency = parseFloat(tag.dataset.frequency);
  }

  attach();

  global.ClickSound = { play: play, configure: configure, attach: attach, detach: detach, config: cfg };
})(window);
