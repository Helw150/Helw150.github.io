// Bounded browser-side Parquet interpretation.
export async function readTable(repo, path) {
  if (!path.endsWith('.parquet')) throw Error('Expected Parquet');
  const { parquetMetadata, parquetReadObjects, parquetSchema } = await import(
    './vendor/hyparquet/index.js'
  );
  const { decompress } = await import('./vendor/fzstd.mjs');
  const compressors = {
    ZSTD: (input, length) => {
      if (length > 4 * 1024 * 1024) throw Error('Parquet page exceeds the 4 MiB reading limit');
      return decompress(input, new Uint8Array(length));
    },
  };
  const bytes = await repo.bytes(path, 16 * 1024 * 1024),
    buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    meta = parquetMetadata(buffer),
    schema = parquetSchema(meta);
  const columns = schema.children.map((child) => ({
    name: child.element.name,
    type: child.element.converted_type || child.element.type || 'nested',
  }));
  const result = { path, rows: Number(meta.num_rows), columns, preview: [], note: 'Empty table.' };
  const group = meta.row_groups[0];
  if (group) {
    if (Number(group.total_byte_size) > 4 * 1024 * 1024) {
      result.note = 'Preview omitted: first row group exceeds 4 MiB.';
      return result;
    }
    const rows = await parquetReadObjects({
      file: buffer,
      metadata: meta,
      compressors,
      columns: columns.slice(0, 20).map((c) => c.name),
      rowStart: 0,
      rowEnd: Math.min(20, Number(group.num_rows)),
    });
    result.preview = JSON.parse(
      JSON.stringify(rows, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    );
    result.note = 'First row group; at most 20 rows and 20 columns.';
  }
  return result;
}
