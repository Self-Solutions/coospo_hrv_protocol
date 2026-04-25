const { neon } = require('@neondatabase/serverless');

let sql;
try {
  sql = neon(process.env.POSTGRES_URL);
} catch (err) {
  console.error('[list-sessions] falha conectando ao banco:', err.message);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await sql`
      SELECT id, voluntario, responsavel, sensor,
             exportado_em, intervalo_calculo_s,
             janela_batimentos, janela_maxage_s, filtro_anomalias_pct,
             created_at
      FROM sessions
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return res.status(200).json({ sessions: rows });
  } catch (err) {
    console.error('[list-sessions] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
