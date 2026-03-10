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
    const events = await CalendarEvent.find(filter).sort({ startAt: 1 }).limit(500);
    res.json(events);
  } catch (e) {
    console.error('List events error:', e);
    res.status(500).json({ message: 'Server error fetching events' });
  }
};

// @route POST /api/calendar
const createEvent = async (req, res) => {
  try {
    const { title, startAt, endAt, location, notes } = req.body || {};
    if (!title || !startAt) return res.status(400).json({ message: 'title and startAt are required' });

    const event = await CalendarEvent.create({
      user: req.user._id,
      title: String(title),
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      location: location || '',
      notes: notes || '',
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

    const { title, startAt, endAt, location, notes } = req.body || {};
    if (title !== undefined) event.title = String(title);
    if (startAt !== undefined) event.startAt = new Date(startAt);
    if (endAt !== undefined) event.endAt = endAt ? new Date(endAt) : null;
    if (location !== undefined) event.location = String(location);
    if (notes !== undefined) event.notes = String(notes);
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

