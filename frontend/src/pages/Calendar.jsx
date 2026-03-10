import { useEffect, useState } from 'react';
import { calendarAPI } from '../utils/api';

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    startAt: '',
    endAt: '',
    location: '',
    notes: '',
  });

  const fetchEvents = async () => {
    try {
      setLoading(true);
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
  }, []);

  const createEvent = async () => {
    setError('');
    if (!form.title.trim() || !form.startAt) {
      setError('Title and start time are required');
      return;
    }
    try {
      await calendarAPI.create({
        ...form,
        endAt: form.endAt || null,
      });
      setForm({ title: '', startAt: '', endAt: '', location: '', notes: '' });
      await fetchEvents();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create event');
    }
  };

  const removeEvent = async (id) => {
    try {
      await calendarAPI.remove(id);
      setEvents((ev) => ev.filter((x) => x._id !== id));
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete event');
    }
  };

  const fmt = (d) => new Date(d).toLocaleString();

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="portal-card p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Calendar</h1>
          <p className="text-gray-600">Schedule events and track security-related tasks.</p>
        </div>

        <div className="portal-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create event</h2>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                placeholder="Meeting / Deadline / Reminder"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End (optional)</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Location (optional)</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                placeholder="Room / Video link"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                placeholder="Agenda, attendees, links..."
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={createEvent}
              className="px-4 py-2 bg-isro-navy text-white rounded hover:bg-isro-navy-light transition"
            >
              Add event
            </button>
          </div>
        </div>

        <div className="portal-card">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming</h2>
            <button
              type="button"
              onClick={fetchEvents}
              className="text-sm text-isro-orange hover:text-isro-orange-light"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="p-6 text-gray-500">Loading…</div>
          ) : events.length === 0 ? (
            <div className="p-6 text-gray-500">No events yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((ev) => (
                <div key={ev._id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{ev.title}</div>
                    <div className="text-sm text-gray-600">
                      {fmt(ev.startAt)}
                      {ev.endAt ? ` → ${fmt(ev.endAt)}` : ''}
                    </div>
                    {ev.location ? <div className="text-sm text-gray-600">Location: {ev.location}</div> : null}
                    {ev.notes ? <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{ev.notes}</div> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvent(ev._id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;

