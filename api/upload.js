const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  return new Promise((resolve) => {
    const bb = Busboy({ headers: req.headers });
    let fileBuffer = [];
    let fileName = '';
    let mimeType = '';

    bb.on('file', (fieldname, file, info) => {
      fileName = info.filename.replace(/[^a-zA-Z0-9._\-\s]/g, '_').replace(/\s+/g, '_');
      mimeType = info.mimeType;
      file.on('data', d => fileBuffer.push(d));
    });

    bb.on('finish', async () => {
      const buffer = Buffer.concat(fileBuffer);
      const path = `tenders/${Date.now()}_${fileName}`;

      const { error } = await supabase.storage
        .from('tender-docs')
        .upload(path, buffer, { contentType: mimeType, upsert: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return resolve();
      }

      const { data: urlData } = supabase.storage
        .from('tender-docs')
        .getPublicUrl(path);

      res.status(200).json({ url: urlData.publicUrl, name: fileName });
      resolve();
    });

    req.pipe(bb);
  });
};
