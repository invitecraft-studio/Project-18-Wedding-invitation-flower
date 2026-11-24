import { useEffect, useMemo, useRef, useState } from 'react'
import { wedding as W } from './data.js'
import { downloadICS } from './calendar.js'

const img = (n) => `${import.meta.env.BASE_URL}images/${n}.jpg`

/* ───── one shared scroll engine: sets --p (0→1) on registered elements ───── */
const reg = new Set()
let tick = false
function run() {
  tick = false
  const vh = innerHeight
  reg.forEach(({ el, mode }) => {
    const r = el.getBoundingClientRect()
    if (r.bottom < -300 || r.top > vh + 300) return
    const p = mode === 'pin' ? -r.top / Math.max(1, r.height - vh) : (vh - r.top) / (vh + r.height)
    el.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(4))
  })
  const h = document.documentElement
  h.style.setProperty('--page', (scrollY / Math.max(1, h.scrollHeight - vh)).toFixed(4))
}
addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run) } }, { passive: true })
addEventListener('resize', run)
function useScroll(mode = 'enter') {
  const ref = useRef(null)
  useEffect(() => { const o = { el: ref.current, mode }; reg.add(o); run(); return () => reg.delete(o) }, [])
  return ref
}

/* ───── reveal on view ───── */
function useIn(th = 0.2) {
  const ref = useRef(null)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { e.target.classList.add('in'); io.disconnect() } }, { threshold: th })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return ref
}
function Rv({ as: T = 'div', v = 'up', d = 0, className = '', children, ...p }) {
  const ref = useIn()
  return <T ref={ref} className={`rv rv-${v} ${className}`} style={{ '--d': `${d}ms` }} {...p}>{children}</T>
}

/* ───── pieces ───── */
function Chars({ text, start = 0, step = 70 }) {
  return (
    <span className="chars" aria-label={text}>
      {[...text].map((c, i) => <span key={i} className="ch" aria-hidden="true"><span style={{ '--d': `${start + i * step}ms` }}>{c}</span></span>)}
    </span>
  )
}
function Scrub({ text }) {
  const words = text.split(' ')
  return (
    <p className="scrub">
      {words.map((w, i) => <span key={i} style={{ '--t': ((i / words.length) * 0.85).toFixed(3) }}>{w} </span>)}
    </p>
  )
}
function Btn({ as: T = 'button', children, className = '', ...p }) {
  const mv = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px,${(e.clientY - r.top - r.height / 2) * 0.35}px)`
  }
  return <T className={`btn ${className}`} onPointerMove={mv} onPointerLeave={(e) => (e.currentTarget.style.transform = '')} {...p}><span>{children}</span></T>
}

/* ───── falling petals (canvas) ───── */
function Petals() {
  const ref = useRef(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const c = ref.current, x = c.getContext('2d')
    let w, h, raf
    const size = () => { w = c.width = innerWidth; h = c.height = innerHeight }
    size(); addEventListener('resize', size)
    const cols = ['#e2578a', '#ff9fbf', '#ffd6e4', '#ffffff', '#e8c27a']
    const ps = Array.from({ length: innerWidth < 700 ? 16 : 34 }, () => ({
      x: Math.random() * w, y: Math.random() * h, s: 5 + Math.random() * 9, v: 0.4 + Math.random(),
      a: Math.random() * 6.28, r: (Math.random() - 0.5) * 0.04, c: cols[(Math.random() * 5) | 0], o: 0.5 + Math.random() * 0.4,
    }))
    const loop = () => {
      x.clearRect(0, 0, w, h)
      for (const p of ps) {
        p.y += p.v; p.a += p.r; p.x += Math.sin(p.a * 2) * 0.7
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.globalAlpha = p.o; x.fillStyle = p.c
        x.beginPath(); x.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.28); x.fill(); x.restore()
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="petals" aria-hidden="true" />
}


/* ───── full-picture intro: walk through the door ───── */
function Intro({ onOpen }) {
  const [ph, setPh] = useState('idle')
  if (ph === 'gone') return null
  const go = () => {
    if (ph !== 'idle') return
    setPh('go'); onOpen(); setTimeout(() => setPh('gone'), 2400)
  }
  return (
    <div className={`intro ${ph}`}>
      <div className="intro-zoom"><div className="intro-img" style={{ backgroundImage: `url(${img(3)})` }} /></div>
      <div className="intro-shade" />
      <div className="intro-flash" />
      <div className="intro-ui">
        <p className="fade" style={{ '--d': '.5s' }}>Together with their families</p>
        <h1 className="fade" style={{ '--d': '1s' }}>{W.groom} <i>&amp;</i> {W.bride}</h1>
        <p className="fade" style={{ '--d': '1.5s' }}>invite you to step inside their wedding</p>
        <Btn onClick={go} className="fade" style={{ '--d': '2s' }}>Step inside</Btn>
      </div>
    </div>
  )
}

/* section with a full-photo background that stays still while the page slides over it */
function Sec({ n, id, className = '', children }) {
  const ref = useScroll()
  return (
    <section id={id} ref={ref} className={`bgsec sc ${className}`}>
      <div className="bg" style={{ backgroundImage: `url(${img(n)})` }} />
      <div className="shade" />
      <div className="inner">{children}</div>
    </section>
  )
}

/* ───── countdown rings ───── */
function useCountdown() {
  const calc = () => {
    const ms = Math.max(0, new Date(W.dateISO) - Date.now())
    return [['Days', Math.floor(ms / 864e5), 60], ['Hours', Math.floor(ms / 36e5) % 24, 24], ['Minutes', Math.floor(ms / 6e4) % 60, 60], ['Seconds', Math.floor(ms / 1e3) % 60, 60]]
  }
  const [v, setV] = useState(calc)
  useEffect(() => { const id = setInterval(() => setV(calc()), 1000); return () => clearInterval(id) }, [])
  return v
}
function Ring({ k, v, max }) {
  const C = 2 * Math.PI * 46
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="r0" cx="50" cy="50" r="46" />
        <circle className="r1" cx="50" cy="50" r="46" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, v / max))} />
      </svg>
      <div className="ring-in"><b key={v}>{String(v).padStart(2, '0')}</b><span>{k}</span></div>
    </div>
  )
}

/* ───── flip card for the couple ───── */
function Flip({ letter, name, role, text, d }) {
  const [f, setF] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    let t1, t2
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { t1 = setTimeout(() => setF(true), 1500 + d); t2 = setTimeout(() => setF(false), 4600 + d); io.disconnect() }
    }, { threshold: 0.6 })
    io.observe(ref.current)
    return () => { io.disconnect(); clearTimeout(t1); clearTimeout(t2) }
  }, [])
  return (
    <Rv v="up" d={d} className="flip-wrap">
      <div ref={ref} className={`flip ${f ? 'on' : ''}`} onClick={() => setF(!f)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setF(!f)}>
        <div className="face front gb">
          <div className="orbit"><i /><i /><i /></div>
          <span className="letter-big">{letter}</span>
          <h3>{name}</h3>
          <p className="role">{role}</p>
          <small>tap to flip</small>
        </div>
        <div className="face back gb">
          <p className="role">{role}</p>
          <h3>{name}</h3>
          <p>{text}</p>
        </div>
      </div>
    </Rv>
  )
}

/* ───── ticket with 3D tilt + light that follows the pointer ───── */
function Ticket({ e, i }) {
  const [day, mon] = e.day.split(' ')
  const move = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height
    const s = ev.currentTarget.style
    s.setProperty('--mx', `${x * 100}%`); s.setProperty('--my', `${y * 100}%`)
    s.setProperty('--ry', `${(x - 0.5) * 8}deg`); s.setProperty('--rx', `${-(y - 0.5) * 8}deg`)
  }
  const leave = (ev) => { ev.currentTarget.style.setProperty('--rx', '0deg'); ev.currentTarget.style.setProperty('--ry', '0deg') }
  return (
    <Rv v={i % 2 ? 'tr' : 'tl'} d={80} className="tk-wrap">
      <article className="ticket" onPointerMove={move} onPointerLeave={leave}>
        <div className="tk-stub"><b>{day}</b><span>{mon}</span></div>
        <div className="tk-main">
          <h3>{e.name}</h3>
          <p className="tk-time">{e.time}</p>
          <p>{e.note}</p>
        </div>
        <i className="tk-flower">✿</i>
      </article>
    </Rv>
  )
}

/* ───── RSVP envelope ───── */
function Envelope() {
  const [st, setSt] = useState('closed')
  const [sent, setSent] = useState(false)
  const open = () => { if (st !== 'closed') return; setSt('opening'); setTimeout(() => setSt('open'), 1100) }
  const submit = (e) => {
    e.preventDefault()
    const f = new FormData(e.target)
    const msg = `Hello! I'm ${f.get('name')}. I will ${f.get('attend')} attend the wedding of ${W.groom} & ${W.bride} on ${W.dateLabel}. Guests: ${f.get('guests')}. ${f.get('wish') || ''}`
    window.open(`https://wa.me/${W.rsvp.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank')
    setSent(true)
  }
  if (st !== 'open')
    return (
      <button className={`env ${st}`} onClick={open} aria-label="Open the envelope">
        <span className="env-letter">{W.groom} &amp; {W.bride}</span>
        <span className="env-back" /><span className="env-flap" /><span className="env-front" />
        <span className="env-seal">♥</span>
        <span className="env-hint">Tap to open</span>
      </button>
    )
  return (
    <div className="letter">
      {sent ? (
        <p className="thanks">Thank you! Your reply is on its way. We can’t wait to celebrate with you.</p>
      ) : (
        <form onSubmit={submit}>
          <input name="name" placeholder="Your name" required />
          <div className="two">
            <select name="attend" defaultValue="definitely"><option value="definitely">Joyfully attending</option><option value="not be able to">Sadly can’t make it</option></select>
            <select name="guests" defaultValue="1">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n > 1 ? 'guests' : 'guest'}</option>)}</select>
          </div>
          <textarea name="wish" rows="3" placeholder="A wish for the couple (optional)" />
          <Btn type="submit">Send RSVP on WhatsApp</Btn>
        </form>
      )}
    </div>
  )
}

function burst(ev) {
  const cols = ['#e2578a', '#ff9fbf', '#fff', '#e8c27a']
  for (let i = 0; i < 48; i++) {
    const s = document.createElement('i'), a = Math.random() * 6.28, d = 100 + Math.random() * 340
    s.className = 'bp'
    s.style.cssText = `left:${ev.clientX}px;top:${ev.clientY}px;--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 140}px;--r:${Math.random() * 720 - 360}deg;--c:${cols[i % 4]}`
    document.body.appendChild(s)
    setTimeout(() => s.remove(), 1800)
  }
}

const seasonIcons = ['✿', '☂', '❁', '❄']

export default function App() {
  const [live, setLive] = useState(false)
  const cd = useCountdown()
  const tl = useScroll()
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(W.venue.mapQuery)}`

  useEffect(() => {
    document.body.style.overflow = live ? '' : 'hidden'
    document.body.classList.toggle('live', live)
  }, [live])

  const marquee = useMemo(() => Array.from({ length: 8 }, (_, i) => <span key={i}>Save the date ✦ 21 · 12 · 2026 ✦ </span>), [])

  return (
    <>
      <div className="page-bar" />
      <Intro onOpen={() => setLive(true)} />
      {live && <Petals />}

      {/* HERO */}
      <Sec n={2} id="hero" className="hero">
        <div className="hero-body">
          <p className="rise" style={{ '--d': '1.6s' }}>Together with their families</p>
          <h1 className="hero-names">
            <Chars text={W.groom} start={1700} />
            <i className="amp rise" style={{ '--d': '2.3s' }}>&amp;</i>
            <Chars text={W.bride} start={2200} />
          </h1>
          <p className="hero-date rise" style={{ '--d': '2.9s' }}>{W.weekday}, {W.dateLabel}</p>
          <p className="rise" style={{ '--d': '3.2s' }}>{W.venue.name}</p>
        </div>
        <div className="marquee"><div>{marquee}{marquee}</div></div>
      </Sec>

      {/* INVITATION */}
      <Sec n={4} className="center-sec">
        <Rv v="zoom" className="gcard gb invite-card">
          <i className="spark s1">✦</i><i className="spark s2">✦</i><i className="spark s3">✦</i>
          <p className="script">With joy in our hearts</p>
          <Scrub text={W.invite} />
        </Rv>
      </Sec>

      {/* COUPLE */}
      <Sec n={6} className="center-sec">
        <Rv as="h2" className="h2">The two of us</Rv>
        <div className="duo">
          <Flip letter={W.groom[0]} name={W.groom} role="The groom" text={W.about.groom} d={0} />
          <Flip letter={W.bride[0]} name={W.bride} role="The bride" text={W.about.bride} d={250} />
        </div>
      </Sec>

      {/* STORY · vertical timeline that draws itself */}
      <Sec n={7}>
        <Rv as="h2" className="h2">Four seasons of us</Rv>
        <div className="tl sc" ref={tl}>
          <i className="tl-line"><b /></i>
          {W.story.map((s, i) => (
            <Rv key={s.season} v="up" className={`tl-item ${i % 2 ? 'r' : 'l'}`}>
              <span className="tl-dot">{seasonIcons[i]}</span>
              <div className="tl-card gb">
                <p className="script">{s.season}</p>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </Rv>
          ))}
        </div>
      </Sec>

      {/* EVENTS */}
      <Sec n={1}>
        <Rv as="h2" className="h2">The celebrations</Rv>
        <div className="tickets">{W.events.map((e, i) => <Ticket key={e.name} e={e} i={i} />)}</div>
      </Sec>

      {/* FAMILIES */}
      <Sec n={3} className="center-sec">
        <Rv as="h2" className="h2">With the blessings of</Rv>
        <Rv v="zoom" className="frame">
          <i className="corner c1">❦</i><i className="corner c2">❦</i><i className="corner c3">❦</i><i className="corner c4">❦</i>
          <div className="fam">
            <div className="fam-side fl"><p className="fam-names">{W.groomFamily.parents}</p><p className="role">{W.groomFamily.note}</p></div>
            <div className="fam-heart"><i /><i /><b>♥</b></div>
            <div className="fam-side fr"><p className="fam-names">{W.brideFamily.parents}</p><p className="role">{W.brideFamily.note}</p></div>
          </div>
        </Rv>
      </Sec>

      {/* COUNTDOWN */}
      <Sec n={5} className="center-sec">
        <Rv as="h2" className="h2">Until we say “I do”</Rv>
        <Rv v="zoom" className="rings">{cd.map(([k, v, m]) => <Ring key={k} k={k} v={v} max={m} />)}</Rv>
        <Rv v="up" d={300}><Btn onClick={downloadICS}>Add to my calendar</Btn></Rv>
      </Sec>

      {/* VENUE */}
      <Sec n={2} className="center-sec">
        <Rv v="up" className="gcard gb venue-card">
          <div className="pin"><i /><i /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg></div>
          <p className="script">Where to find us</p>
          <h2 className="venue-name">{W.venue.name}</h2>
          <p>{W.venue.address}</p>
          <ul>{W.venue.tips.map((t, i) => <li key={t} style={{ '--i': i }}>{t}</li>)}</ul>
          <Btn as="a" href={mapUrl} target="_blank" rel="noreferrer">Open in Google Maps</Btn>
        </Rv>
      </Sec>

      {/* RSVP */}
      <Sec n={4} className="center-sec rsvp">
        <Rv as="h2" className="h2">Will you join us?</Rv>
        <p className="soft">Please reply by {W.rsvp.deadline}</p>
        <Envelope />
      </Sec>

      {/* CLOSING */}
      <Sec n={6} className="center-sec closing">
        <Rv v="zoom" className="closing-body">
          <p className="script light">With love and gratitude</p>
          <h2 className="closing-names">{W.groom} <i>&amp;</i> {W.bride}</h2>
          <p className="soft">{W.dateLabel} · Your presence is our greatest gift</p>
          <Btn onClick={burst}>Send us a shower of blessings</Btn>
        </Rv>
        {W.credit.show && <footer className="credit">{W.credit.text} · {W.credit.handle}</footer>}
      </Sec>
    </>
  )
}
