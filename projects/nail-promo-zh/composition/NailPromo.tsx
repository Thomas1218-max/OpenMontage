import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ---------------------------------------------------------------------------
// Timeline (30 fps). Every cut sits on a beat of the soundtrack ("Lofi Pop",
// ~92.3 BPM, one beat ≈ 19.5 frames). The music lift lands on S6 (portfolio) at f509.
// ---------------------------------------------------------------------------
export const T = {
  S1: 0, // hook
  S2: 98, // price stamp (beat 5)
  S3: 176, // hand-painting process (beat 9)
  S4: 313, // swatch boards (beat 16)
  S5: 391, // gel polish wall (beat 20)
  S6: 509, // portfolio flash (beat 26; 5 × 39f = 2 beats each)
  S7: 704, // CTA (beat 36)
  OUTRO: 802, // last line (beat 41)
  END: 836,
};
export const TOTAL_FRAMES = T.END;
const PHOTO = 39;

// Safe area: 250px top/bottom, 150px right. Centered text uses a symmetric
// 150..930 column so it reads centred on screen while clearing the right rail.
const SAFE = {top: 250, bottom: 1670, left: 60, right: 930};
const COL = {left: 150, width: 780};

const C = {
  cream: '#FBF6F1',
  nude: '#E9C9C1',
  cocoa: '#4A302B',
  red: '#E0443E',
  redDeep: '#B92C32',
  gold: 'linear-gradient(180deg, #FFF1CC 0%, #EBCB8B 38%, #CFA35C 70%, #B98A43 100%)',
  goldSolid: '#D8B172',
};

type FontFace_ = {family: string; src: string; weight?: number; unicode_range?: string};
type Texts = {
  font_family: string;
  font_faces?: FontFace_[];
  sizes?: Record<string, number | number[]>;
  hook: Record<'A' | 'B', [string, string]>;
  promo_tag: string;
  price: {lead: string; amount: string; currency: string; sub: string};
  process: [string, string];
  swatches: string;
  gel_wall: string;
  portfolio: {
    top: string;
    save_hint: string;
    items: {image: string; no: string; name: string}[];
  };
  cta: {
    tag: string;
    headline_pre: string;
    headline_amount: string;
    includes: string;
    urgency: string;
    address: string;
    hours: string;
    contact: string;
  };
  outro: string;
  cover: {headline: string; tag: string; sub: string};
};

export type PromoProps = {variant: 'A' | 'B'; texts: Texts | null};

const EMOJI = "'Noto Color Emoji', 'Apple Color Emoji'";
const fontStack = (t: Texts) => `${t.font_family}, ${EMOJI}, sans-serif`;

// Per-language size overrides (texts.sizes[key]); falls back to the zh defaults.
const sz = (t: Texts, key: string, def: number): number => {
  const v = t.sizes?.[key];
  return typeof v === 'number' ? v : def;
};
const szs = (t: Texts, key: string, def: number[]): number[] => {
  const v = t.sizes?.[key];
  return Array.isArray(v) ? v : def;
};

// Load any web fonts declared in the texts file (e.g. Be Vietnam Pro for vi)
// before the first frame is captured.
const loaded = new Set<string>();
const useFonts = (t: Texts) => {
  const faces = t.font_faces ?? [];
  const key = faces.map((f) => f.src).join('|');
  const [handle] = React.useState(() => (faces.length && !loaded.has(key) ? delayRender('fonts') : null));
  React.useEffect(() => {
    if (handle === null) return;
    Promise.all(
      faces.map((f) =>
        new FontFace(f.family, `url(${staticFile(f.src)}) format('woff2')`, {
          weight: String(f.weight ?? 700),
          unicodeRange: f.unicode_range,
        })
          .load()
          .then((ff) => document.fonts.add(ff)),
      ),
    )
      .then(() => {
        loaded.add(key);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
  }, [handle]);
};

const SOFT_SHADOW =
  '0 2px 3px rgba(58, 30, 24, 0.45), 0 6px 22px rgba(58, 30, 24, 0.40), 0 0 2px rgba(58, 30, 24, 0.35)';
const GOLD_FILTER =
  'drop-shadow(0 0 1.5px rgba(60, 32, 16, 0.85)) drop-shadow(0 2px 3px rgba(70, 40, 20, 0.6)) drop-shadow(0 8px 20px rgba(70, 40, 20, 0.4))';

// ---------------------------------------------------------------------------
// Rich text: "\n" = line break, {{...}} = champagne-gold span.
// ---------------------------------------------------------------------------
const Gold: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <span
    style={{
      display: 'inline-block',
      backgroundImage: C.gold,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      textShadow: 'none',
      filter: GOLD_FILTER,
      padding: '0 0.04em',
      ...style,
    }}
  >
    {children}
  </span>
);

const renderInline = (s: string, goldStyle?: React.CSSProperties) =>
  s.split(/(\{\{.*?\}\})/g).map((part, i) =>
    part.startsWith('{{') ? (
      <Gold key={i} style={goldStyle}>
        {part.slice(2, -2)}
      </Gold>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );

const Rich: React.FC<{
  text: string;
  size: number;
  lineSizes?: number[];
  color?: string;
  shadow?: string;
  goldStyle?: React.CSSProperties;
  lineHeight?: number;
}> = ({text, size, lineSizes, color = '#fff', shadow = SOFT_SHADOW, goldStyle, lineHeight = 1.22}) => (
  <>
    {text.split('\n').map((line, i) => (
      <div
        key={i}
        style={{
          fontSize: lineSizes?.[i] ?? size,
          color,
          textShadow: shadow,
          lineHeight,
          textWrap: 'balance' as React.CSSProperties['textWrap'],
        }}
      >
        {renderInline(line, goldStyle)}
      </div>
    ))}
  </>
);

// A centred text block inside the safe column.
const TextBlock: React.FC<{
  top: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  t: Texts;
}> = ({top, children, style, t}) => (
  <div
    style={{
      position: 'absolute',
      top,
      left: COL.left,
      width: COL.width,
      textAlign: 'center',
      fontFamily: fontStack(t),
      fontWeight: 700,
      letterSpacing: '0.02em',
      ...style,
    }}
  >
    {children}
  </div>
);

// Pop-in helper: returns {opacity, transform} for a spring entrance at `at`.
const usePop = (at: number, from = 0.7, damping = 12) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - at, fps, config: {damping, stiffness: 180, mass: 0.6}});
  const opacity = interpolate(frame - at, [0, 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return {opacity, transform: `translateY(${(1 - s) * 24}px) scale(${from + (1 - from) * s})`};
};

const Scrim: React.FC<{side: 'top' | 'bottom'; strength?: number; reach?: number}> = ({
  side,
  strength = 0.42,
  reach = 48,
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(${side === 'top' ? '180deg' : '0deg'}, rgba(52, 28, 24, ${strength}) 0%, rgba(52, 28, 24, ${
        strength * 0.45
      }) ${reach * 0.55}%, rgba(52, 28, 24, 0) ${reach}%)`,
    }}
  />
);

// ---------------------------------------------------------------------------
// Sparkles (the signature device): four-point glints that twinkle on the nails.
// ---------------------------------------------------------------------------
const STAR = 'M0,-1 C0.1,-0.1 0.1,-0.1 1,0 C0.1,0.1 0.1,0.1 0,1 C-0.1,0.1 -0.1,0.1 -1,0 C-0.1,-0.1 -0.1,-0.1 0,-1Z';

const Glint: React.FC<{x: number; y: number; size: number; a: number; rot?: number; tint?: string}> = ({
  x,
  y,
  size,
  a,
  rot = 0,
  tint = '#FFFFFF',
}) => {
  if (a <= 0.01) return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${size * a})`} opacity={Math.min(1, a * 1.2)}>
      <path d={STAR} fill={tint} />
      <path d={STAR} fill={tint} transform="rotate(45) scale(0.45)" opacity={0.8} />
      <circle r={0.16} fill="#fff" />
    </g>
  );
};

const Sparkles: React.FC<{
  seed: string;
  count: number;
  region: {x0: number; x1: number; y0: number; y1: number};
  size?: [number, number];
  period?: [number, number];
}> = ({seed, count, region, size = [16, 38], period = [22, 40]}) => {
  const frame = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: 'drop-shadow(0 0 8px rgba(255,240,210,0.95))'}}>
      {new Array(count).fill(0).map((_, i) => {
        const x = region.x0 + random(`${seed}x${i}`) * (region.x1 - region.x0);
        const y = region.y0 + random(`${seed}y${i}`) * (region.y1 - region.y0);
        const s = size[0] + random(`${seed}s${i}`) * (size[1] - size[0]);
        const p = period[0] + random(`${seed}p${i}`) * (period[1] - period[0]);
        const ph = random(`${seed}f${i}`) * p;
        const w = Math.sin(((frame + ph) / p) * Math.PI * 2);
        const a = Math.pow(Math.max(0, w), 3);
        const tint = random(`${seed}t${i}`) > 0.6 ? '#FFF0C8' : '#FFFFFF';
        return <Glint key={i} x={x} y={y} size={s} a={a} rot={((frame + ph) * 1.5) % 90} tint={tint} />;
      })}
    </svg>
  );
};

// One-shot burst used on photo cuts / outro.
const Burst: React.FC<{seed: string; cx: number; cy: number; at: number; count?: number; spread?: number; dur?: number}> = ({
  seed,
  cx,
  cy,
  at,
  count = 14,
  spread = 380,
  dur = 22,
}) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / dur;
  if (t < 0 || t > 1) return null;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: 'drop-shadow(0 0 10px rgba(255,236,200,1))'}}>
      {new Array(count).fill(0).map((_, i) => {
        const ang = random(`${seed}a${i}`) * Math.PI * 2;
        const dist = (0.3 + 0.7 * random(`${seed}d${i}`)) * spread * Easing.out(Easing.cubic)(t);
        const s = 14 + random(`${seed}s${i}`) * 26;
        const a = Math.sin(Math.PI * Math.min(1, t * (1 + random(`${seed}l${i}`))));
        return <Glint key={i} x={cx + Math.cos(ang) * dist} y={cy + Math.sin(ang) * dist} size={s} a={a} rot={t * 90} />;
      })}
    </svg>
  );
};

const Flash: React.FC<{at: number; peak?: number; dur?: number}> = ({at, peak = 0.85, dur = 7}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - at, [0, dur], [peak, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (frame < at) return null;
  return <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FFF6EA 60%, #FBE9D6 100%)', opacity: o}} />;
};

// ---------------------------------------------------------------------------
// Photo framing: full-width photo on a blurred, creamy copy of itself.
// The 3:4 photos sit inside 9:16 so nothing important is cropped.
// ---------------------------------------------------------------------------
const FramedPhoto: React.FC<{
  src: string;
  top?: number; // px from top for the sharp photo; default = centred
  aspect: number; // h / w
  scale?: number;
  drift?: number;
  blur?: number;
}> = ({src, top, aspect, scale = 1, drift = 0, blur = 0}) => {
  const h = 1080 * aspect;
  const y = top ?? (1920 - h) / 2;
  return (
    <AbsoluteFill style={{background: C.cream, overflow: 'hidden'}}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          inset: -80,
          width: 1240,
          height: 2080,
          objectFit: 'cover',
          filter: 'blur(44px) brightness(1.06) saturate(0.9)',
        }}
      />
      <AbsoluteFill style={{background: 'rgba(251, 246, 241, 0.32)'}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: 1080,
          height: h,
          transform: `translateX(${drift}px) scale(${scale})`,
          transformOrigin: '50% 55%',
          overflow: 'hidden',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 7%, #000 93%, transparent 100%)',
          maskImage: 'linear-gradient(180deg, transparent 0%, #000 7%, #000 93%, transparent 100%)',
        }}
      >
        <Img src={staticFile(src)} style={{width: 1080, height: h, objectFit: 'cover', filter: blur ? `blur(${blur}px)` : undefined}} />
      </div>
    </AbsoluteFill>
  );
};

const ASPECT: Record<string, number> = {
  'IMG_3599.jpg': 1440 / 1080,
  'IMG_3597.jpg': 1440 / 1080,
  'IMG_3596.jpg': 1440 / 1080,
  'IMG_3734.jpg': 1435 / 1080,
  'IMG_3732.jpg': 1420 / 1080,
};

// ---------------------------------------------------------------------------
// Promo tag — red slanted badge, top-right inside the safe area, gently pulsing.
// ---------------------------------------------------------------------------
const PromoTag: React.FC<{t: Texts; text: string; at: number; static?: boolean}> = ({t, text, at, static: isStatic}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = isStatic ? 1 : spring({frame: frame - at, fps, config: {damping: 9, stiffness: 200, mass: 0.5}});
  const pulse = isStatic ? 1 : 0.88 + 0.12 * (0.5 + 0.5 * Math.cos(((frame - at) / 26) * Math.PI * 2));
  const shine = isStatic ? -1 : ((frame - at) % 60) / 60;
  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE.top + 14,
        right: 1080 - SAFE.right,
        transform: `rotate(-7deg) scale(${s})`,
        transformOrigin: '100% 0%',
        opacity: pulse,
        fontFamily: fontStack(t),
        fontWeight: 700,
        fontSize: sz(t, 'tag', 40),
        color: '#fff',
        padding: '12px 26px 14px',
        borderRadius: 14,
        background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDeep} 100%)`,
        boxShadow: `0 8px 24px rgba(185, 44, 50, ${0.35 + 0.25 * pulse}), inset 0 1px 0 rgba(255,255,255,0.35)`,
        overflow: 'hidden',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
      {shine >= 0 && shine < 0.4 ? (
        <div
          style={{
            position: 'absolute',
            top: -20,
            bottom: -20,
            width: 60,
            left: `${-30 + shine * 2.5 * 130}%`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
            transform: 'skewX(-20deg)',
          }}
        />
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
const S1Hook: React.FC<{t: Texts; variant: 'A' | 'B'}> = ({t, variant}) => {
  const frame = useCurrentFrame();
  const [l1, l2] = t.hook[variant];
  const zoom = interpolate(frame, [0, T.S2], [1, 1.1], {extrapolateRight: 'clamp'});
  // Line 1 is fully visible on frame 0 (no fade-in) — only a tiny settle.
  const settle = interpolate(frame, [0, 10], [1.04, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
  const pop2 = usePop(45, 0.6, 10);
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile('hook.mp4')} muted style={{width: 1080, height: 1920, transform: `scale(${zoom})`, transformOrigin: '55% 52%'}} />
      <Scrim side="top" strength={0.5} reach={52} />
      <Sparkles seed="hook" count={11} region={{x0: 240, x1: 900, y0: 640, y1: 1080}} size={[18, 40]} />
      <TextBlock t={t} top={330}>
        {frame < 45 ? (
          <div style={{transform: `scale(${settle})`}}>
            <Rich text={l1} size={sz(t, 'hook', 100)} />
          </div>
        ) : (
          <div style={pop2}>
            <Rich text={l2} size={sz(t, 'hook', 100)} goldStyle={{fontSize: '1.15em'}} />
          </div>
        )}
      </TextBlock>
    </AbsoluteFill>
  );
};

const S2Price: React.FC<{t: Texts}> = ({t}) => {
  const frame = useCurrentFrame();
  const blur = interpolate(frame, [0, 9], [30, 0], {extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
  const kb = interpolate(frame, [0, 72], [1.12, 1.03], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  // Stamp: falls from 3.2× to 1× between f2–f9 (lands with the 咚 at f9), then shakes.
  const stampScale = interpolate(frame, [2, 9], [3.2, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad)});
  const stampOp = interpolate(frame, [2, 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shakeAmp = interpolate(frame, [9, 20], [14, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shakeX = frame >= 9 ? Math.sin(frame * 2.7) * shakeAmp : 0;
  const shakeY = frame >= 9 ? Math.cos(frame * 3.3) * shakeAmp * 0.6 : 0;
  const ring = interpolate(frame, [9, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const leadOp = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
  const sub = usePop(18, 0.9, 14);
  return (
    <AbsoluteFill style={{transform: `translate(${shakeX * 0.35}px, ${shakeY * 0.35}px)`}}>
      <FramedPhoto src="IMG_3599.jpg" aspect={ASPECT['IMG_3599.jpg']} top={570} scale={kb} blur={blur} />
      <Scrim side="top" strength={0.3} reach={42} />
      <TextBlock t={t} top={372}>
        <div style={{opacity: leadOp}}>
          <Rich text={t.price.lead} size={sz(t, 'price_lead', 64)} />
        </div>
        <div style={{position: 'relative', height: 290, marginTop: 4}}>
          {ring > 0 && ring < 1 ? (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 520,
                height: 240,
                marginLeft: -260,
                marginTop: -120,
                borderRadius: 999,
                border: `${6 * (1 - ring)}px solid ${C.goldSolid}`,
                transform: `scale(${0.8 + ring * 0.6})`,
                opacity: 1 - ring,
              }}
            />
          ) : null}
          <div
            style={{
              opacity: stampOp,
              transform: `translate(${shakeX}px, ${shakeY}px) scale(${stampScale}) rotate(-3deg)`,
              whiteSpace: 'nowrap',
              lineHeight: 1,
              paddingTop: 10,
            }}
          >
            <Gold style={{fontSize: 272, fontWeight: 700, letterSpacing: '-0.01em'}}>{t.price.amount}</Gold>
            <Gold style={{fontSize: 116, fontWeight: 700, marginLeft: 8}}>{t.price.currency}</Gold>
          </div>
        </div>
        <div style={{...sub, marginTop: 10, display: 'inline-block', padding: '10px 28px', borderRadius: 999, background: 'rgba(74, 48, 43, 0.38)'}}>
          <Rich text={t.price.sub} size={sz(t, 'price_sub', 48)} />
        </div>
      </TextBlock>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{t: Texts; text: string; at: number; until?: number; top: number; size: number; lineSizes?: number[]}> = ({
  t,
  text,
  at,
  until,
  top,
  size,
  lineSizes,
}) => {
  const frame = useCurrentFrame();
  const pop = usePop(at, 0.85, 14);
  if (frame < at) return null;
  const out = until === undefined ? 1 : interpolate(frame, [until - 5, until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (until !== undefined && frame >= until) return null;
  return (
    <TextBlock t={t} top={top}>
      <div style={{...pop, opacity: pop.opacity * out}}>
        <Rich text={text} size={size} lineSizes={lineSizes} />
      </div>
    </TextBlock>
  );
};

const S3Process: React.FC<{t: Texts}> = ({t}) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, T.S4 - T.S3], [1.02, 1.2], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile('paint.mp4')} muted style={{width: 1080, height: 1920, transform: `scale(${z})`, transformOrigin: '44% 64%'}} />
      {/* soft focus vignette that pulls the eye to the brush tip */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 60% 42% at 44% 64%, rgba(0,0,0,0) 55%, rgba(60,35,30,0.28) 100%)'}} />
      <Scrim side="top" strength={0.45} reach={40} />
      <Caption t={t} text={t.process[0]} at={2} until={68} top={410} size={sz(t, 'process', 80)} />
      <Caption t={t} text={t.process[1]} at={68} top={410} size={sz(t, 'process', 80)} />
    </AbsoluteFill>
  );
};

const S4Swatches: React.FC<{t: Texts}> = ({t}) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, T.S5 - T.S4], [1.0, 1.05]);
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile('swatch.mp4')}
        muted
        style={{width: 1080, height: 1920, transform: `scale(${z})`, filter: 'brightness(1.04) saturate(1.06)'}}
      />
      {/* edge soft-light glow */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 75% 60% at 50% 48%, rgba(255,248,240,0) 50%, rgba(255,244,234,0.55) 85%, rgba(255,240,228,0.85) 100%)',
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 160px 40px rgba(255, 238, 225, 0.55)'}} />
      <Scrim side="top" strength={0.42} reach={36} />
      <Caption t={t} text={t.swatches} at={2} top={410} size={sz(t, 'swatches', 78)} />
      <Sparkles seed="sw" count={6} region={{x0: 120, x1: 960, y0: 760, y1: 1300}} size={[12, 26]} />
    </AbsoluteFill>
  );
};

const S5Wall: React.FC<{t: Texts}> = ({t}) => {
  const frame = useCurrentFrame();
  const d = T.S6 - T.S5; // 108
  const push = interpolate(frame, [d - 12, d], [1, 1.9], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic)});
  const blur = interpolate(frame, [d - 10, d], [0, 14], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const flash = interpolate(frame, [d - 6, d], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const slow = interpolate(frame, [0, d - 12], [1.04, 1.1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `scale(${push * slow})`, filter: blur ? `blur(${blur}px)` : undefined}}>
        <OffthreadVideo src={staticFile('wall.mp4')} muted style={{width: 1080, height: 1920}} />
        <Scrim side="top" strength={0.55} reach={42} />
        <Caption t={t} text={t.gel_wall} at={2} top={405} size={60} lineSizes={szs(t, 'gel_wall', [86, 58])} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#FFF8F0', opacity: flash}} />
    </AbsoluteFill>
  );
};

const PhotoLabel: React.FC<{t: Texts; no: string; name: string}> = ({t, no, name}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [2, 9], [-40, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const o = interpolate(frame, [2, 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.left + 10,
        bottom: 1920 - SAFE.bottom + 40,
        transform: `translateX(${x}px)`,
        opacity: o,
        display: 'flex',
        alignItems: 'stretch',
        fontFamily: fontStack(t),
        fontWeight: 700,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(74, 48, 43, 0.35)',
      }}
    >
      <div style={{background: C.gold, color: C.cocoa, fontSize: sz(t, 'label_no', 50), padding: '10px 22px', letterSpacing: '0.02em'}}>{no}</div>
      <div style={{background: 'rgba(251, 246, 241, 0.92)', color: C.cocoa, fontSize: sz(t, 'label_name', 46), padding: '12px 26px', display: 'flex', alignItems: 'center'}}>
        {name}
      </div>
    </div>
  );
};

const S6Portfolio: React.FC<{t: Texts}> = ({t}) => {
  const frame = useCurrentFrame();
  const items = t.portfolio.items;
  const hintOut = interpolate(frame, [54, 62], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const hint = usePop(4, 0.8, 11);
  const topBar = usePop(0, 0.9, 16);
  return (
    <AbsoluteFill>
      {items.map((it, i) => (
        <Sequence key={it.image} from={i * PHOTO} durationInFrames={PHOTO} layout="none">
          <PhotoBeat t={t} index={i} image={it.image} no={it.no} name={it.name} />
        </Sequence>
      ))}
      <Scrim side="top" strength={0.32} reach={30} />
      <TextBlock t={t} top={372}>
        <div style={{...topBar, display: 'inline-block', padding: '10px 30px', borderRadius: 999, background: 'rgba(74, 48, 43, 0.42)'}}>
          <Rich text={t.portfolio.top} size={sz(t, 'portfolio_top', 50)} />
        </div>
      </TextBlock>
      {frame < 62 ? (
        <TextBlock t={t} top={470}>
          <div style={{...hint, opacity: hint.opacity * hintOut}}>
            <Rich text={t.portfolio.save_hint} size={sz(t, 'save_hint', 46)} />
          </div>
        </TextBlock>
      ) : null}
      <Flash at={0} peak={1} dur={8} />
    </AbsoluteFill>
  );
};

const PhotoBeat: React.FC<{t: Texts; index: number; image: string; no: string; name: string}> = ({t, index, image, no, name}) => {
  const frame = useCurrentFrame();
  const kb = interpolate(frame, [0, PHOTO], [1.0, 1.07]);
  const drift = interpolate(frame, [0, PHOTO], [0, index % 2 ? -14 : 14]);
  return (
    <AbsoluteFill>
      <FramedPhoto src={image} aspect={ASPECT[image] ?? 1.333} scale={kb} drift={drift} />
      {index > 0 ? <Flash at={0} peak={0.7} dur={6} /> : null}
      <Burst seed={`b${index}`} cx={300 + random(`bx${index}`) * 480} cy={820 + random(`by${index}`) * 360} at={0} count={12} spread={340} />
      <PhotoLabel t={t} no={no} name={name} />
    </AbsoluteFill>
  );
};

const CtaLine: React.FC<{at: number; children: React.ReactNode; style?: React.CSSProperties}> = ({at, children, style}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - at, [0, 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const y = interpolate(frame - at, [0, 8], [18, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  return <div style={{opacity: o, transform: `translateY(${y}px)`, ...style}}>{children}</div>;
};

const S7Cta: React.FC<{t: Texts}> = ({t}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const blur = interpolate(frame, [20, 56], [0, 9], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const veil = interpolate(frame, [20, 56], [0, 0.22], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const slide = spring({frame: frame - 6, fps, config: {damping: 16, stiffness: 120, mass: 0.8}});
  const outroAt = T.OUTRO - T.S7;
  const outro = usePop(outroAt, 0.6, 10);
  const c = t.cta;
  const small: React.CSSProperties = {fontSize: sz(t, 'cta_small', 40), color: C.cocoa, lineHeight: 1.35, textWrap: 'balance' as React.CSSProperties['textWrap'], textShadow: '0 1px 2px rgba(255,255,255,0.6)'};
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile('end.mp4')} muted style={{width: 1080, height: 1920, filter: blur ? `blur(${blur}px)` : undefined, transform: 'scale(1.04)'}} />
      <AbsoluteFill style={{background: `rgba(251, 246, 241, ${veil})`}} />
      <Scrim side="top" strength={0.3} reach={34} />
      <Sparkles seed="cta" count={8} region={{x0: 220, x1: 900, y0: 520, y1: 900}} size={[14, 30]} />
      <div
        style={{
          position: 'absolute',
          left: 75,
          width: 855,
          bottom: 1920 - SAFE.bottom + 10,
          transform: `translateY(${(1 - slide) * 900}px)`,
          background: 'rgba(253, 249, 245, 0.88)',
          backdropFilter: 'blur(14px)',
          borderRadius: 44,
          border: '2px solid rgba(216, 177, 114, 0.65)',
          boxShadow: '0 30px 80px rgba(74, 48, 43, 0.35)',
          padding: '40px 44px 44px',
          fontFamily: fontStack(t),
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        <CtaLine at={12}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 38,
              color: '#fff',
              padding: '8px 24px 10px',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDeep} 100%)`,
              opacity: 0.85 + 0.15 * Math.cos((frame / 26) * Math.PI * 2),
            }}
          >
            {c.tag}
          </span>
        </CtaLine>
        <CtaLine at={15} style={{marginTop: 10, whiteSpace: 'nowrap'}}>
          <span style={{fontSize: sz(t, 'cta_headline_pre', 76), color: C.cocoa, marginRight: 16, verticalAlign: 'middle'}}>{c.headline_pre}</span>
          <Gold style={{fontSize: 128, verticalAlign: 'middle', backgroundImage: 'linear-gradient(180deg, #F0D08C 0%, #D2A452 55%, #A97A30 100%)', filter: 'drop-shadow(0 2px 2px rgba(120,80,30,0.45)) drop-shadow(0 6px 14px rgba(150,100,40,0.25))'}}>
            {c.headline_amount}
          </Gold>
        </CtaLine>
        <CtaLine at={19} style={{...small, marginTop: 6}}>{c.includes}</CtaLine>
        <CtaLine at={22} style={{...small, color: C.redDeep}}>{c.urgency}</CtaLine>
        <CtaLine at={25}>
          <div style={{height: 2, margin: '22px 40px 20px', background: 'linear-gradient(90deg, rgba(216,177,114,0), rgba(216,177,114,0.9), rgba(216,177,114,0))'}} />
        </CtaLine>
        <CtaLine at={27} style={{...small, fontSize: sz(t, 'cta_info', 37)}}>
          {c.address.split(/[｜|\n]/).map((part, i) => (
            <div key={i}>{part.trim()}</div>
          ))}
        </CtaLine>
        <CtaLine at={30} style={{...small, fontSize: sz(t, 'cta_info', 37), marginTop: 6}}>{c.hours}</CtaLine>
        <CtaLine at={33} style={{...small, fontSize: sz(t, 'cta_info', 37), marginTop: 6}}>{c.contact}</CtaLine>
      </div>
      {frame >= outroAt ? (
        <>
          <TextBlock t={t} top={390}>
            <div style={outro}>
              <Rich text={t.outro} size={sz(t, 'outro', 78)} />
            </div>
          </TextBlock>
          <Burst seed="outro" cx={540} cy={500} at={outroAt} count={18} spread={460} dur={26} />
          <Flash at={outroAt} peak={0.35} dur={8} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------
export const NailPromo: React.FC<PromoProps> = ({variant, texts}) => {
  if (!texts) throw new Error('texts prop is required (pass texts_zh.json via --props)');
  const t = texts;
  useFonts(t);
  return (
    <AbsoluteFill style={{background: C.cream}}>
      <Sequence from={T.S1} durationInFrames={T.S2 - T.S1}>
        <S1Hook t={t} variant={variant} />
      </Sequence>
      <Sequence from={T.S2} durationInFrames={T.S3 - T.S2}>
        <S2Price t={t} />
      </Sequence>
      <Sequence from={T.S3} durationInFrames={T.S4 - T.S3}>
        <S3Process t={t} />
      </Sequence>
      <Sequence from={T.S4} durationInFrames={T.S5 - T.S4}>
        <S4Swatches t={t} />
      </Sequence>
      <Sequence from={T.S5} durationInFrames={T.S6 - T.S5}>
        <S5Wall t={t} />
      </Sequence>
      <Sequence from={T.S6} durationInFrames={T.S7 - T.S6}>
        <S6Portfolio t={t} />
      </Sequence>
      <Sequence from={T.S7} durationInFrames={T.END - T.S7}>
        <S7Cta t={t} />
      </Sequence>
      <Sequence from={T.S2} durationInFrames={T.END - T.S2}>
        <PromoTag t={t} text={t.promo_tag} at={0} />
      </Sequence>
      <Audio src={staticFile('soundtrack.wav')} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Cover (thumbnail) — text in the top third, nails untouched below.
// ---------------------------------------------------------------------------
export const Cover: React.FC<PromoProps> = ({texts}) => {
  if (!texts) throw new Error('texts prop is required');
  const t = texts;
  useFonts(t);
  return (
    <AbsoluteFill style={{background: C.cream}}>
      <FramedPhoto src="IMG_3599.jpg" aspect={ASPECT['IMG_3599.jpg']} top={590} />
      <Scrim side="top" strength={0.38} reach={42} />
      <PromoTag t={t} text={t.cover.tag} at={0} static />
      <TextBlock t={t} top={350}>
        <Rich text={t.cover.headline} size={104} lineSizes={szs(t, 'cover_headline', [230, 104])} lineHeight={1.08} goldStyle={{letterSpacing: '-0.01em'}} />
        <div style={{marginTop: 22, display: 'inline-block', padding: '10px 30px', borderRadius: 999, background: 'rgba(74, 48, 43, 0.42)'}}>
          <Rich text={t.cover.sub} size={sz(t, 'cover_sub', 44)} />
        </div>
      </TextBlock>
      <Sparkles seed="cover" count={7} region={{x0: 200, x1: 900, y0: 980, y1: 1400}} size={[18, 34]} />
    </AbsoluteFill>
  );
};
