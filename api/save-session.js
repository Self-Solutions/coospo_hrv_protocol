const { neon } = require('@neondatabase/serverless');

let sql;
try {
  sql = neon(process.env.POSTGRES_URL);
} catch (err) {
  console.error('[save-session] falha conectando ao banco:', err.message);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessao, config, beats, metricas } = req.body;

  if (!sessao || !config || !beats || !metricas) {
    return res.status(400).json({ error: 'Payload inválido' });
  }

  console.log('[save-session] processando');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id                   SERIAL PRIMARY KEY,
        voluntario           TEXT NOT NULL,
        responsavel          TEXT NOT NULL,
        sensor               TEXT NOT NULL,
        exportado_em         TIMESTAMPTZ NOT NULL,
        janela_batimentos    INT NOT NULL,
        janela_maxage_s      INT NOT NULL,
        filtro_anomalias_pct INT NOT NULL,
        intervalo_calculo_s  INT NOT NULL DEFAULT 3,
        created_at           TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS beats (
        id             SERIAL PRIMARY KEY,
        session_id     INT NOT NULL REFERENCES sessions(id),
        timestamp_ms   BIGINT NOT NULL,
        rr_ms          INT NOT NULL,
        valid          BOOLEAN NOT NULL,
        device_filtered BOOLEAN NOT NULL DEFAULT false
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS metricas (
        id           SERIAL PRIMARY KEY,
        session_id   INT NOT NULL REFERENCES sessions(id),
        timestamp_ms BIGINT NOT NULL,
        hr_bpm       INT,
        rmssd_ms     INT NOT NULL,
        stress       INT
      )
    `;

    const bTs     = beats.rows.map(r => r[0]);
    const bRr     = beats.rows.map(r => r[1]);
    const bValid  = beats.rows.map(r => r[2]);
    const bDevice = beats.rows.map(r => r[3] ?? false);

    const mTs     = metricas.rows.map(r => r[0]);
    const mHr     = metricas.rows.map(r => r[1]);
    const mRmssd  = metricas.rows.map(r => r[2]);
    const mStress = metricas.rows.map(r => r[3]);

    const [{ id: sessionId }] = await sql`
      WITH new_session AS (
        INSERT INTO sessions (
          voluntario, responsavel, sensor, exportado_em,
          janela_batimentos, janela_maxage_s, filtro_anomalias_pct, intervalo_calculo_s
        ) VALUES (
          ${sessao.voluntario}, ${sessao.responsavel}, ${sessao.sensor}, ${config.exportado_em},
          ${config.janela_batimentos}, ${config.janela_maxage_s},
          ${config.filtro_anomalias_pct}, ${config.intervalo_calculo_s ?? 3}
        )
        RETURNING id
      ),
      new_beats AS (
        INSERT INTO beats (session_id, timestamp_ms, rr_ms, valid, device_filtered)
        SELECT s.id, b.ts, b.rr, b.valid, b.df
        FROM new_session s,
        unnest(${bTs}::bigint[], ${bRr}::int[], ${bValid}::boolean[], ${bDevice}::boolean[])
          AS b(ts, rr, valid, df)
      ),
      new_metricas AS (
        INSERT INTO metricas (session_id, timestamp_ms, hr_bpm, rmssd_ms, stress)
        SELECT s.id, m.ts, m.hr, m.rmssd, m.stress
        FROM new_session s,
        unnest(${mTs}::bigint[], ${mHr}::int[], ${mRmssd}::int[], ${mStress}::int[])
          AS m(ts, hr, rmssd, stress)
      )
      SELECT id FROM new_session
    `;

    console.log('[save-session] dado salvo no banco. session_id:', sessionId);
    return res.status(200).json({ ok: true, session_id: sessionId });
  } catch (err) {
    console.error('[save-session] erro no banco:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
