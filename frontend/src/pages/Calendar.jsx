import { useEffect, useMemo, useState } from 'react';
import { calendarAPI } from '../utils/api';

const CLASSIFICATIONS = ['UNCLASSIFIED', 'RESTRICTED', 'SECRET', 'TOP_SECRET'];
const MISSION_TAGS = ['Chandrayaan-4', 'Gaganyaan', 'ADITYA-L1', 'NISAR', 'PSLV-C61', 'ISRO-SECURITY'];
const EVENT_TYPES = [
  { id: 'MISSION', label: 'Mission', color: 'border-cyan-500/40 bg-cyan-950/35 text-cyan-200' },
  { id: 'DEADLINE', label: 'Deadline', color: 'border-isro-orange/50 bg-isro-orange/10 text-isro-orange' },
  { id: 'REVIEW', label: 'Review', color: 'border-forest-500/40 bg-forest-950/30 text-forest-200' },
  { id: 'SECURITY', label: 'Security', color: 'border-red-500/45 bg-red-950/25 text-red-200' },
  { id: 'PERSONAL', label: 'Personal', color: 'border-cyan-300/35 bg-slate-900/40 text-cyan-100' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

// UTC day bucket used for comparing events with the month grid.
function toUTCDateKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
}

function toDatetimeLocalValue(d) {
  const x = d instanceof Date ? d : new Date(d);
  const yyyy = x.getFullYear();
  const mm = pad2(x.getMonth() + 1);
  const dd = pad2(x.getDate());
  const hh = pad2(x.getHours());
  const mi = pad2(x.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fmt(dt) {
  return new Date(dt).toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDayKey, setSelectedDayKey] = useState(() => toUTCDateKey(today));

  const [form, setForm] = useState(() => {
    const d = new Date(today);
    d.setHours(10, 0, 0, 0);
    return {
      title: '',
      eventType: 'MISSION',
      missionTag: 'Chandrayaan-4',
      classification: 'UNCLASSIFIED',
      startAt: toDatetimeLocalValue(d),
      endAt: '',
      location: '',
      notes: '',
    };
  });

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await calendarAPI.list();
      setEvents(resp.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventsSorted = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return eventsSorted.filter((e) => new Date(e.startAt).getTime() >= now).slice(0, 8);
  }, [eventsSorted]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const key = toUTCDateKey(ev.date || ev.startAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    for (const [k, list] of map.entries()) {
      map.set(k, list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt)));
    }
    return map;
  }, [events]);

  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const startWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay(); // 0=Sun
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const gridDays = Array.from({ length: totalCells }).map((_, i) => {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return new Date(cursor.getFullYear(), cursor.getMonth(), dayNum);
  });

  const eventTypeMeta = (id) => EVENT_TYPES.find((x) => x.id === id) || EVENT_TYPES[0];

  const onDayClick = (d) => {
    const key = toUTCDateKey(d);
    setSelectedDayKey(key);
    // Keep time, but update day bucket.
    const next = new Date(d);
    next.setHours(10, 0, 0, 0);
    setForm((f) => ({
      ...f,
      startAt: toDatetimeLocalValue(next),
    }));
  };

  const createEvent = async () => {
    setError('');
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.startAt) {
      setError('Date/time is required');
      return;
    }
    try {
      await calendarAPI.create({
        title: form.title,
        startAt: form.startAt,
        endAt: form.endAt || null,
        location: form.location || '',
        notes: form.notes || '',
        missionTag: form.missionTag || null,
        eventType: form.eventType,
        classification: form.classification,
      });
      setForm((f) => ({ ...f, title: '', notes: '', location: '' }));
      await fetchEvents();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create event');
    }
  };

  const removeEvent = async (id) => {
    setError('');
    try {
      await calendarAPI.remove(id);
      await fetchEvents();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete event');
    }
  };

  const monthLabel = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="portal-card p-6 mb-6">
          <h1 className="text-xl font-bold text-slate-100 tracking-wide uppercase">ISRO Mission Calendar</h1>
          <p className="text-[11px] text-cyan-500/70 mt-1 uppercase tracking-widest">Secure scheduling with mission context</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
          {/* Calendar grid */}
          <div className="portal-card p-4">
            <div className="flex items-center justify-between gap-3 px-2 pb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                  className="border border-cyan-500/25 hover:border-cyan-500/40 rounded px-3 py-1 text-slate-200 text-sm transition"
                >
                  ←
                </button>
                <div className="text-sm font-bold text-slate-100 tracking-wide">{monthLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="text-[11px] text-slate-400 hover:text-cyan-300 transition"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                className="border border-cyan-500/25 hover:border-cyan-500/40 rounded px-3 py-1 text-slate-200 text-sm transition"
              >
                  →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0 border-t border-white/5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-2 py-2 text-[11px] text-slate-500 uppercase tracking-widest border-b border-white/5">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {gridDays.map((d, idx) => {
                if (!d) return <div key={`empty-${idx}`} className="min-h-[86px] border-r border-b border-white/5 bg-transparent" />;

                const key = toUTCDateKey(d);
                const list = eventsByDay.get(key) || [];
                const isSelected = key === selectedDayKey;
                const cellMeta = list[0] ? eventTypeMeta(list[0].eventType) : null;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onDayClick(d)}
                    className={[
                      'text-left min-h-[86px] px-2 py-2 border-r border-b border-white/5 transition',
                      isSelected ? 'bg-cyan-500/10 outline outline-1 outline-cyan-500/40' : 'hover:bg-white/3',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-[12px] font-mono ${list.length ? 'text-slate-100' : 'text-slate-600'}`}>{d.getDate()}</div>
                      {list.length ? (
                        <div
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${cellMeta.color}`}
                        >
                          {list.length > 99 ? '99+' : list.length}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 space-y-1">
                      {list.slice(0, 2).map((ev) => {
                        const meta = eventTypeMeta(ev.eventType);
                        return (
                          <div key={ev._id} className={`text-[10px] rounded px-2 py-0.5 border ${meta.color} truncate`}>
                            {ev.missionTag ? `${ev.missionTag} · ` : ''}
                            {ev.title}
                          </div>
                        );
                      })}
                      {list.length > 2 ? (
                        <div className="text-[10px] text-slate-500">+{list.length - 2} more</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar: create form + upcoming */}
          <div className="space-y-6">
            <div className="portal-card p-5 border-cyan-500/15">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Create Event</h2>
                <div className="text-[11px] text-slate-400 font-mono">{selectedDayKey}</div>
              </div>
              {error && (
                <div className="mb-4 border border-red-500/40 bg-red-950/25 text-red-200 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="input-glass"
                    placeholder="Mission / Deadline / Review"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">Event type</label>
                    <select
                      value={form.eventType}
                      onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                      className="select-glass"
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#0a1628]">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">Mission tag</label>
                    <select
                      value={form.missionTag}
                      onChange={(e) => setForm((f) => ({ ...f, missionTag: e.target.value }))}
                      className="select-glass"
                    >
                      <option value="" className="bg-[#0a1628]">— None —</option>
                      {MISSION_TAGS.map((m) => (
                        <option key={m} value={m} className="bg-[#0a1628]">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">Classification</label>
                    <select
                      value={form.classification}
                      onChange={(e) => setForm((f) => ({ ...f, classification: e.target.value }))}
                      className="select-glass"
                    >
                      {CLASSIFICATIONS.map((c) => (
                        <option key={c} value={c} className="bg-[#0a1628]">
                          {c.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">Date / time</label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                    className="input-glass"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">End (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                    className="input-glass"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">Location (optional)</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="input-glass"
                    placeholder="Mission control room / link"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-1">Notes</label>
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="input-glass resize-none"
                    placeholder="Agenda, checklist, links..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={createEvent}
                    className="flex-1 bg-isro-orange/90 text-[#050a14] py-2.5 rounded font-semibold hover:bg-isro-orange transition"
                  >
                    Add event
                  </button>
                </div>
              </div>
            </div>

            <div className="portal-card p-5 border-cyan-500/15">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Upcoming</h2>
                <button
                  type="button"
                  onClick={fetchEvents}
                  className="text-[11px] text-cyan-300 hover:text-isro-orange transition"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="text-slate-400 text-sm py-3">Loading…</div>
              ) : upcoming.length === 0 ? (
                <div className="text-slate-500 text-sm py-3">No upcoming events.</div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((ev) => {
                    const meta = eventTypeMeta(ev.eventType);
                    return (
                      <div key={ev._id} className="border border-white/5 rounded-lg p-3 hover:bg-white/3 transition">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`inline-flex items-center gap-2 px-2 py-1 rounded border ${meta.color} text-[10px] uppercase tracking-widest`}>
                              {meta.label}
                            </div>
                            <div className="font-semibold text-slate-100 mt-2 truncate">{ev.title}</div>
                            <div className="text-[11px] text-slate-500 mt-1">{fmt(ev.startAt)}</div>
                            {ev.missionTag ? (
                              <div className="text-[11px] text-cyan-300/90 mt-1 truncate">
                                Mission: {ev.missionTag}
                              </div>
                            ) : null}
                            {ev.classification ? (
                              <div className="text-[10px] text-isro-orange mt-1 uppercase tracking-widest">
                                {String(ev.classification).replace('_', ' ')}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEvent(ev._id)}
                            className="text-[12px] text-red-300 hover:text-red-200 transition"
                            aria-label="Delete event"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;

