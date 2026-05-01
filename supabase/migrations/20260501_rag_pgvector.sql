-- Phase 2: real RAG with pgvector.
-- Replaces the naive "stuff entire markdown into Claude context" pattern with
-- semantic retrieval over per-document chunks.

create extension if not exists vector;

-- Per-document chunks with embeddings.
-- Embedding dimension is 1024 to match Voyage AI voyage-3-large default.
-- If you switch providers (Cohere embed-v4.0 also supports 1024), keep this.
-- If you ever need to change dimension you must drop+recreate this table and the index.
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  kb_id uuid references knowledge_bases(id) on delete cascade not null,
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding vector(1024),
  created_at timestamptz default now()
);

create index if not exists chunks_kb_id_idx on chunks (kb_id);
create index if not exists chunks_document_id_idx on chunks (document_id);

-- HNSW index for fast cosine-similarity ANN search.
create index if not exists chunks_embedding_hnsw
  on chunks using hnsw (embedding vector_cosine_ops);

alter table chunks enable row level security;

create policy "Users can read own chunks" on chunks for select using (
  auth.uid() = (select user_id from knowledge_bases where id = chunks.kb_id)
);

create policy "Users can insert own chunks" on chunks for insert with check (
  auth.uid() = (select user_id from knowledge_bases where id = chunks.kb_id)
);

create policy "Users can delete own chunks" on chunks for delete using (
  auth.uid() = (select user_id from knowledge_bases where id = chunks.kb_id)
);

-- Track ingestion progress more precisely.
alter table documents
  add column if not exists embedding_status text default 'pending',
  add column if not exists error_message text;

-- RPC for vector search. SECURITY INVOKER so RLS on chunks still applies —
-- the caller can only retrieve chunks from KBs they own.
create or replace function match_chunks(
  query_embedding vector(1024),
  match_kb_id uuid,
  match_count int default 8,
  match_threshold float default 0.3
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  filename text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    d.filename,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where c.kb_id = match_kb_id
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
