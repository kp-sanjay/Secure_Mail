const CalendarEvent = require('../models/CalendarEvent');

// @route GET /api/calendar
const listEvents = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const filter = { user: req.user._id };
    if (from || to) {
      filter.startAt = {};
      if (from) filter.startAt.$gte = from;
      if (to) filter.startAt.$lte = to;
    }

    let events = await CalendarEvent.find(filter).sort({ startAt: 1 }).limit(500);

    // If the user has no stored events yet, seed a realistic mission calendar.
    // (This keeps the UI populated immediately, while still using MongoDB as source of truth.)
    if (events.length === 0 && !from && !to) {
      const now = new Date();
      const toUTCDate = (d) => {
        const x = new Date(d);
        const utc = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
        return new Date(utc);
      };
      const addDays = (days, hour = 10, minute = 0) => {
        const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        d.setUTCHours(hour, minute, 0, 0);
        return d;
      };

      const seed = [
        {
          title: 'PSLV-C61 Countdown Review',
          eventType: 'REVIEW',
          missionTag: 'PSLV-C61',
          classification: 'RESTRICTED',
          startAt: addDays(0, 15, 0),
          endAt: null,
          location: 'Mission Control · Uplink room',
          notes: 'Checklist verification, envelope signing checklist, and downlink readiness.',
        },
        {
          title: 'Chandrayaan-4 Payload Review',
          eventType: 'REVIEW',
          missionTag: 'Chandrayaan-4',
          classification: 'RESTRICTED',
          startAt: addDays(1, 11, 0),
          endAt: null,
          location: 'Lunar payload lab',
          notes: 'Review thermal telemetry, verify key routing nodes, and confirm schedule windows.',
        },
        {
          title: 'NISAR SAR Data Submission',
          eventType: 'DEADLINE',
          missionTag: 'NISAR',
          classification: 'SECRET',
          startAt: addDays(2, 16, 0),
          endAt: null,
          location: 'Data sync terminal',
          notes: 'Submit SAR calibration batch; ensure integrity pins for the metadata bundle.',
        },
        {
          title: 'Gaganyaan EVA Systems Q&A',
          eventType: 'MISSION',
          missionTag: 'Gaganyaan',
          classification: 'RESTRICTED',
          startAt: addDays(5, 14, 0),
          endAt: null,
          location: 'EVA command bay',
          notes: 'Comms validation and safety protocol reminders for uplink sessions.',
        },
        {
          title: 'ADITYA-L1 Downlink Window',
          eventType: 'MISSION',
          missionTag: 'ADITYA-L1',
          classification: 'UNCLASSIFIED',
          startAt: addDays(7, 10, 30),
          endAt: addDays(7, 12, 0),
          location: 'Solar coronagraph console',
          notes: 'Confirm downlink monitoring and encryption envelope integrity.',
        },
        {
          title: 'Key Rotation Deadline',
          eventType: 'SECURITY',
          missionTag: 'ISRO-SECURITY',
          classification: 'TOP_SECRET',
          startAt: addDays(12, 9, 0),
          endAt: null,
          location: 'Trust & KMS cell',
          notes: 'Rotate Kyber encapsulation keys; verify TOFU pins and update trust manifests.',
        },
        {
          title: 'PSLV-C61 Launch Window',
          eventType: 'MISSION',
          missionTag: 'PSLV-C61',
          classification: 'RESTRICTED',
          startAt: addDays(18, 7, 0),
          endAt: addDays(18, 9, 30),
          location: 'Launch control',
          notes: 'Ensure secure envelope exchange; confirm message retention and self-destruct policy.',
        },
        {
          title: 'Personal Scheduling Check-in',
          eventType: 'PERSONAL',
          missionTag: null,
          classification: 'UNCLASSIFIED',
          startAt: addDays(23, 18, 0),
          endAt: null,
          location: 'Ops desk',
          notes: 'Coordination follow-up for next week deliverables.',
        },
      ];

      const created = [];
      for (const item of seed) {
        created.push(
          CalendarEvent.create({
            ...item,
            user: req.user._id,
            date: toUTCDate(item.startAt),
          }),
        );
      }
      events = await Promise.all(created);
      events.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    }

    res.json(events);
  } catch (e) {
    console.error('List events error:', e);
    res.status(500).json({ message: 'Server error fetching events' });
  }
};

// @route POST /api/calendar
const createEvent = async (req, res) => {
  try {
    const { title, startAt, endAt, location, notes, missionTag, eventType, classification } = req.body || {};
    if (!title || !startAt) return res.status(400).json({ message: 'title and startAt are required' });

    const d = new Date(startAt);
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    const event = await CalendarEvent.create({
      user: req.user._id,
      title: String(title),
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      location: location || '',
      notes: notes || '',
      missionTag: missionTag || null,
      eventType: eventType || 'MISSION',
      classification: classification || 'UNCLASSIFIED',
      date,
    });

    res.status(201).json(event);
  } catch (e) {
    console.error('Create event error:', e);
    res.status(500).json({ message: 'Server error creating event' });
  }
};

// @route PUT /api/calendar/:id
const updateEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });

    const { title, startAt, endAt, location, notes, missionTag, eventType, classification } = req.body || {};
    if (title !== undefined) event.title = String(title);
    if (startAt !== undefined) event.startAt = new Date(startAt);
    if (endAt !== undefined) event.endAt = endAt ? new Date(endAt) : null;
    if (location !== undefined) event.location = String(location);
    if (notes !== undefined) event.notes = String(notes);
    if (missionTag !== undefined) event.missionTag = missionTag || null;
    if (eventType !== undefined) event.eventType = eventType;
    if (classification !== undefined) event.classification = classification;

    // Keep derived day bucket in sync
    if (startAt !== undefined) {
      const d = new Date(startAt);
      event.date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    await event.save();

    res.json(event);
  } catch (e) {
    console.error('Update event error:', e);
    res.status(500).json({ message: 'Server error updating event' });
  }
};

// @route DELETE /api/calendar/:id
const deleteEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    await event.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('Delete event error:', e);
    res.status(500).json({ message: 'Server error deleting event' });
  }
};

module.exports = { listEvents, createEvent, updateEvent, deleteEvent };

