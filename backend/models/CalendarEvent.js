const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  startAt: { type: Date, required: true },
  endAt: { type: Date, default: null },
  location: { type: String, default: '', trim: true, maxlength: 200 },
  notes: { type: String, default: '', trim: true, maxlength: 4000 },
  createdAt: { type: Date, default: Date.now },
});

calendarEventSchema.index({ user: 1, startAt: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);

