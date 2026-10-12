/** D1-compatible operations over the private gateway, with one atomic RPC per batch. */
export function gatewayClient({ url, key, fetcher = fetch }) {
  const origin = new URL(url);
  if (
    !['https:', 'http:'].includes(origin.protocol) ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  )
    throw new Error('D1_GATEWAY_URL must be an origin without credentials, path or query.');
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))
    throw new Error('D1 gateway requires HTTPS.');
  if (!key || key.length < 32)
    throw new Error('D1_GATEWAY_KEY must contain at least 32 characters.');
  async function rpc(path, body) {
    const response = await fetcher(new URL(path, origin), {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      redirect: 'manual',
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(
        result.error === 'COURSE_REVIEW_LOCK'
          ? 'COURSE_REVIEW_LOCK'
          : `D1 gateway failed (${response.status}).`,
      );
    }
    return response.json();
  }
  function prepare(sql, params = []) {
    const statement = { sql, params };
    return {
      ...statement,
      bind(...values) {
        return prepare(
          sql,
          values.map((value) =>
            value instanceof ArrayBuffer
              ? [...new Uint8Array(value)]
              : ArrayBuffer.isView(value)
                ? [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)]
                : value,
          ),
        );
      },
      all() {
        return rpc('/query', { mode: 'all', statements: [statement] });
      },
      run() {
        return this.all();
      },
      async first(column) {
        const { results } = await this.all();
        return column ? (results[0]?.[column] ?? null) : (results[0] ?? null);
      },
      async raw(options = {}) {
        const rows = await rpc('/query', { mode: 'raw', statements: [statement] });
        return options.columnNames ? rows : rows.slice(1);
      },
    };
  }
  return {
    DB: {
      prepare,
      batch(statements) {
        return rpc('/query', {
          mode: 'batch',
          statements: statements.map(({ sql, params }) => ({ sql, params })),
        });
      },
    },
    RL_API: {
      limit({ key }) {
        return rpc('/limit', { binding: 'RL_API', key });
      },
    },
    RL_AUTH: {
      limit({ key }) {
        return rpc('/limit', { binding: 'RL_AUTH', key });
      },
    },
    NOTIFICATIONS: {
      getByName() {
        return {
          async fetch(url) {
            return new Response(null, { status: new URL(url).pathname === '/publish' ? 204 : 426 });
          },
        };
      },
    },
  };
}
