const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp();
const db = admin.firestore();

// Read SPA template once (copied from dist/index.html at build time)
const spaPath = path.join(__dirname, 'spa.html');
const spaHtml = fs.existsSync(spaPath)
  ? fs.readFileSync(spaPath, 'utf8')
  : '<!doctype html><html><head><meta charset="UTF-8"></head><body><p>Error: SPA template not found.</p></body></html>';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

exports.sharedBudget = onRequest(async (req, res) => {
  const match = req.path.match(/\/shared\/([^/]+)/);
  const token = match?.[1];

  let ogTitle = 'Presupuesto de reforma';
  let ogDescription = 'Consulta los detalles del presupuesto';

  if (token) {
    try {
      const snap = await db.collection('sharedBudgets').doc(token).get();
      if (snap.exists) {
        const data = snap.data();
        const companyName = data?.company?.name;
        if (companyName) {
          ogTitle = `Presupuesto de ${companyName}`;
          ogDescription = `Consulta el presupuesto de reforma de ${companyName}`;
        }
      }
    } catch {
      // fallback to defaults
    }
  }

  const ogTags = [
    `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="https://budgenerator.web.app${req.path}" />`,
    `<meta name="description" content="${escapeHtml(ogDescription)}" />`,
    `<title>${escapeHtml(ogTitle)}</title>`,
  ].join('\n    ');

  // Inject OG tags before </head>, replacing the existing <title>
  const html = spaHtml
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('</head>', `    ${ogTags}\n  </head>`);

  res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.status(200).send(html);
});
