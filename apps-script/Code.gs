/**
 * Progress tracking for the AI modules. Deploy once from the staff Google account as a Web App:
 *   Execute as: Me · Who has access: Anyone
 * See README.md in this folder.
 *
 * Script Properties (Project Settings → Script properties):
 *   STAFF_CODE  – code the staff page sends to read the matrix (required for doGet)
 *   PN_LENGTH   – personal-number length, default 7 (must match site.config.json)
 */

var SHEET = 'events';
var EVENTS = { start: 1, step: 1, complete: 1, ask_first: 1 };
var HEADER = ['זמן', 'מספר אישי', 'צוות', 'לומדה', 'אירוע', 'שלב', 'ציון', 'משך', 'גרסה'];

function prop_(name, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  return v == null || v === '' ? fallback : v;
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function reply_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: 'json' });
  }
  var len = Number(prop_('PN_LENGTH', 7));
  if (!new RegExp('^\\d{' + len + '}$').test(String(d.pn))) return reply_({ ok: false, error: 'pn' });
  if (!EVENTS[d.event]) return reply_({ ok: false, error: 'event' });
  if (!/^L\d{2}$/.test(String(d.module))) return reply_({ ok: false, error: 'module' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([
      new Date(),
      String(d.pn),
      String(d.team || '').slice(0, 20),
      String(d.module),
      String(d.event),
      Number(d.step) || 0,
      d.score === '' || d.score == null ? '' : Number(d.score),
      Number(d.seconds) || 0,
      String(d.version || '').slice(0, 10),
    ]);
  } finally {
    lock.releaseLock();
  }
  return reply_({ ok: true });
}

/**
 * GET ?action=matrix&code=STAFF_CODE → one row per cadet × module with the latest status.
 * The staff code keeps cadets from reading each other's scores.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var code = prop_('STAFF_CODE', '');
  if (!code || p.code !== code) return reply_({ ok: false, error: 'code' });
  if (p.action !== 'matrix') return reply_({ ok: false, error: 'action' });

  var values = sheet_().getDataRange().getValues();
  var cells = {};
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var key = r[1] + '|' + r[3];
    var c = cells[key] || { pn: String(r[1]), team: String(r[2]), module: String(r[3]), status: 'progress', score: '', updated: '' };
    if (r[4] === 'complete') {
      c.status = 'done';
      if (r[6] !== '' && (c.score === '' || Number(r[6]) > c.score)) c.score = Number(r[6]);
    }
    c.team = String(r[2]) || c.team;
    c.updated = r[0] instanceof Date ? r[0].toISOString() : String(r[0]);
    cells[key] = c;
  }
  var rows = [];
  for (var k in cells) rows.push(cells[k]);
  return reply_({ ok: true, rows: rows });
}
