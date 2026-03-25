const mongoose = require('mongoose');

const CLASSIFICATIONS = ['UNCLASSIFIED', 'RESTRICTED', 'SECRET', 'TOP_SECRET'];
const EVENT_TYPES = ['MISSION', 'DEADLINE', 'REVIEW', 'SECURITY', 'PERSONAL'];

const calendarEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // UI title shown in month grid + upcoming panel
  title: { type: String, required: true, trim: true, maxlength: 200 },

  // Date-time for scheduling
  startAt: { type: Date, required: true },
  endAt: { type: Date, default: null },

  // Derived day bucket (UTC midnight) used for day selection / filtering.
  date: { type: Date, default: null },

  location: { type: String, default: '', trim: true, maxlength: 200 },
  notes: { type: String, default: '', trim: true, maxlength: 4000 },

  // ISRO mission context
  missionTag: { type: String, default: null, trim: true, maxlength: 80 },
  eventType: { type: String, enum: EVENT_TYPES, default: 'MISSION' },
  classification: { type: String, enum: CLASSIFICATIONS, default: 'UNCLASSIFIED' },

  createdAt: { type: Date, default: Date.now },
});

calendarEventSchema.index({ user: 1, date: 1, startAt: 1 });
calendarEventSchema.index({ user: 1, startAt: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);

