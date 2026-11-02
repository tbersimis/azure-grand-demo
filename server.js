'use strict';

/*
 * Azure Grand Hotel demo: hotel website + mini PMS for a Live Hub AI agent.
 *
 *   GET    /                    hotel website (public/index.html)
 *   GET    /pms/                staff dashboard
 *   POST   /api/requests        create a guest request  (called by the agent tool)
 *   GET    /api/requests        list requests, newest first
 *   PATCH  /api/requests/:id    change status: new | in_progress | done
 *   DELETE /api/requests        clear the board (needs ADMIN_TOKEN if set)
 *   GET    /healthz             health check
 *
 * Environment:
 *   PORT          default 8080
 *   DATA_DIR      where requests.json is kept (Fly volume at /data)
 *   API_KEY       optional; if set, POST /api/requests needs header X-API-Key
 *   ADMIN_TOKEN   optional; if set, status changes and clearing need header X-Admin-Token
 *   HOTEL_NAME    shown in API responses
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8080', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'requests.json');
const API_KEY = process.env.API_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const HOTEL_NAME = process.env.HOTEL_NAME || 'Azure Grand Hotel';
const MAX_REQUESTS = 500;

const REQUEST_TYPES = ['housekeeping', 'room_service', 'maintenance', 'other'];
const PRIORITIES = ['normal', 'urgent'];
const STATUSES = ['new', 'in_progress', 'done'];

// ---------- storage ----------
let requests = [];

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (Array.isArray(parsed)) requests = parsed;
    }
    console.log(`Loaded ${requests.length} request(s) from ${DATA_FILE}`);
  } catch (err) {
    console.error('Could not load data file, starting empty:', err.message);
    requests = [];
  }
}

function save() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(requests, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('Could not save data file:', err.message);
  }
}

// ---------- helpers ----------
// Live Hub fills {{placeholders}} in the tool body; an optional parameter the
// model didn't provide can arrive empty or as the raw placeholder.
function clean(value) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  if (/^\{\{.*\}\}$/.test(s)) return '';
  return s;
}

function normalizeType(value) {
  const s = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (REQUEST_TYPES.includes(s)) return s;
  if (/house|clean|linen|trash|tidy/.test(s)) return 'housekeeping';
  if (/service|towel|water|amenit|food|pillow|bed/.test(s)) return 'room_service';
  if (/maint|broken|repair|ac|plumb|tv/.test(s)) return 'maintenance';
  return 'other';
}

function normalizePriority(value) {
  const s = clean(value).toLowerCase();
  if (/urgent|high|asap|emergency/.test(s)) return 'urgent';
  return PRIORITIES.includes(s) ? s : 'normal';
}

function shortId() {
  return 'REQ-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function requireHeader(name, expected) {
  return (req, res, next) => {
    if (!expected) return next();
    if (req.get(name) === expected) return next();
    return res.status(401).json({ success: false, error: `Missing or wrong ${name} header.` });
  };
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');

// Accept JSON whatever Content-Type the caller sends.
app.use('/api', express.text({ type: '*/*', limit: '64kb' }), (req, res, next) => {
  if (typeof req.body === 'string' && req.body.length) {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ success: false, error: 'Body must be JSON.' });
    }
  } else if (typeof req.body !== 'object' || req.body === null) {
    req.body = {};
  }
  next();
});

// Let the dashboard be opened from another origin if needed.
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Admin-Token');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/healthz', (req, res) => res.json({ ok: true, requests: requests.length }));

app.get('/api/config', (req, res) => {
  res.json({ hotel: HOTEL_NAME, adminTokenRequired: Boolean(ADMIN_TOKEN) });
});

app.post('/api/requests', requireHeader('X-API-Key', API_KEY), (req, res) => {
  const b = req.body || {};
  const room = clean(b.room_number ?? b.room ?? b.roomNumber);
  if (!room) {
    return res.status(400).json({
      success: false,
      error: 'room_number is required. Ask the guest for their room number and try again.',
    });
  }

  const item = {
    id: shortId(),
    room_number: room.replace(/^room\s*/i, ''),
    request_type: normalizeType(b.request_type ?? b.type),
    description: clean(b.description) || 'No details given',
    priority: normalizePriority(b.priority),
    status: 'new',
    source: clean(b.source) || 'AI concierge',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  requests.unshift(item);
  if (requests.length > MAX_REQUESTS) requests.length = MAX_REQUESTS;
  save();
  console.log(`New ${item.priority} ${item.request_type} request ${item.id} for room ${item.room_number}`);

  // Short, speakable result for the agent.
  const eta = item.priority === 'urgent' ? '10 minutes' : '20 minutes';
  res.status(201).json({
    success: true,
    request_id: item.id,
    room_number: item.room_number,
    request_type: item.request_type,
    priority: item.priority,
    estimated_time: eta,
    message: `Request ${item.id} logged for room ${item.room_number}. The team will be there within ${eta}.`,
  });
});

app.get('/api/requests', (req, res) => {
  let list = requests;
  const { status, priority, limit } = req.query;
  if (status) list = list.filter((r) => r.status === status);
  if (priority) list = list.filter((r) => r.priority === priority);
  const n = Math.min(parseInt(limit || '200', 10) || 200, MAX_REQUESTS);
  res.json({ requests: list.slice(0, n), total: requests.length });
});

app.patch('/api/requests/:id', requireHeader('X-Admin-Token', ADMIN_TOKEN), (req, res) => {
  const item = requests.find((r) => r.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Request not found.' });
  const status = clean(req.body.status);
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: `status must be one of ${STATUSES.join(', ')}.` });
  }
  item.status = status;
  item.updated_at = new Date().toISOString();
  save();
  res.json({ success: true, request: item });
});

app.delete('/api/requests', requireHeader('X-Admin-Token', ADMIN_TOKEN), (req, res) => {
  const removed = requests.length;
  requests = [];
  save();
  res.json({ success: true, removed });
});

app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Unknown endpoint.' }));

// Static sites
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/pms', (req, res) => res.redirect(301, '/pms/'));

load();
app.listen(PORT, () => console.log(`${HOTEL_NAME} demo listening on :${PORT}`));
