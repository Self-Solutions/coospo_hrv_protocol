const { neon } = require('@neondatabase/serverless');

let sql;
try {
  sql = neon(process.env.POSTGRES_URL);
} catch (err) {
  console.error('[delete-session] falha conectando ao banco:', err.message);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = parseInt(req.query.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    await sql.transaction([
      sql`DELETE FROM beats    WHERE session_id = ${id}`,
      sql`DELETE FROM metricas WHERE session_id = ${id}`,
      sql`DELETE FROM sessions WHERE id         = ${id}`,
    ]);

    console.log('[delete-session] sessão deletada. id:', id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[delete-session] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
