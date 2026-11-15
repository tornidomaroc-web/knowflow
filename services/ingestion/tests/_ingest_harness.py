"""Drive /ingest in a process of its own, so a test can survive what it sends.

    python tests/_ingest_harness.py <bomb> [timeout_s]

Sends the named generated file (tests/pdf_bombs.py) to /ingest, then an
ordinary .docx to the SAME app in the SAME process, and prints one JSON line
per request plus the process's own peak resident memory. Only the network
edges (Supabase, Voyage) are replaced, as in test_content_caps.py.

The test that runs this kills it at a deadline. The process caps its own
address space (soft limit only, so the converter child may set its own), so on
a build without the bound it fails with MemoryError instead of taking the
machine's memory: a red test, not a dead runner.
"""
import io
import json
import os
import resource
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
os.environ.setdefault("INGESTION_TOKEN", "test-token")

SELF_AS_SOFT = 6 * 1024 ** 3
resource.setrlimit(resource.RLIMIT_AS, (SELF_AS_SOFT, resource.getrlimit(resource.RLIMIT_AS)[1]))

import main  # noqa: E402
import pdf_bombs  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

seen = {"embedded": 0, "errors": []}


async def fake_user_client(token):
    return object()


async def fake_load(sb, document_id, kb_id):
    return {"id": document_id, "kb_id": kb_id}


async def fake_embed(texts, input_type):
    seen["embedded"] += len(texts)
    return [[0.0] * main.EMBED_DIM for _ in texts]


async def fake_persist(sb, document_id, kb_id, markdown_text, chunks):
    pass


async def fake_mark_error(sb, document_id, message):
    seen["errors"].append(message)


main._user_client = fake_user_client
main._load_owned_document = fake_load
main._embed = fake_embed
main._persist = fake_persist
main._mark_error = fake_mark_error
if len(sys.argv) > 2:
    main.CONVERT_TIMEOUT_S = float(sys.argv[2])


def docx(text: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        zf.writestr("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        zf.writestr("word/document.xml", f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


def ingest(client, name, data, mime):
    before = seen["embedded"]
    resp = client.post(
        "/ingest",
        headers={"Authorization": "Bearer test-token", "X-Supabase-Token": "user"},
        data={"document_id": "doc-1", "kb_id": "kb-1"},
        files={"file": (name, data, mime)},
    )
    try:
        body = resp.json()
    except ValueError:
        body = resp.text[:200]
    return {"name": name, "bytes": len(data), "status": resp.status_code, "body": body,
            "embedded": seen["embedded"] - before, "error_row": seen["errors"][-1] if seen["errors"] else None}


kind = sys.argv[1]
arg = {"dense_text": (200,)}.get(kind, ())
bomb = getattr(pdf_bombs, kind)(*arg)
client = TestClient(main.app, raise_server_exceptions=False)
print(json.dumps({"step": "bomb", **ingest(client, f"{kind}.pdf", bomb, "application/pdf")}), flush=True)
seen["errors"].clear()
print(json.dumps({"step": "next", **ingest(client, "notes.docx", docx("Lecture 1: supply and demand."),
                                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}), flush=True)
print(json.dumps({"step": "self", "maxrss_kb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}), flush=True)
