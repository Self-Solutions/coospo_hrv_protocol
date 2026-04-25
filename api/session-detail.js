const { neon } = require('@neondatabase/serverless');

let sql;
try {
  sql = neon(process.env.POSTGRES_URL);
} catch (err) {
  console.error('[session-detail] falha conectando ao banco:', err.message);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = parseInt(req.query.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const [session] = await sql`
      SELECT * FROM sessions WHERE id = ${id}
    `;
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    const beats = await sql`
      SELECT timestamp_ms, rr_ms, valid, device_filtered
      FROM beats WHERE session_id = ${id}
      ORDER BY timestamp_ms
    `;

    const metricas = await sql`
      SELECT timestamp_ms, hr_bpm, rmssd_ms, stress
      FROM metricas WHERE session_id = ${id}
      ORDER BY timestamp_ms
    `;

    return res.status(200).json({ session, beats, metricas });
  } catch (err) {
    console.error('[session-detail] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
