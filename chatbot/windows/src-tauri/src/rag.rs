// Retrieval-Augmented Generation (RAG) for the chat.
//
// Documents the user saves are split into overlapping chunks, embedded with the
// Gemini embedding model and stored in a small JSON index under local_dir()/rag.
// On every chat turn the question is embedded, the closest chunks are found by
// cosine similarity and handed to the model as a KNOWLEDGE BASE block, so replies
// can rely on the user's own documents.
//
// Nothing leaves the machine except the text being embedded (sent to the same
// Gemini API the chat already uses). The index itself never does.

use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{screen, settings};

const EMBED_MODEL: &str = "gemini-embedding-001";
/// Vector size requested from the API. 768 keeps the index small with little
/// quality loss; cosine similarity does not need unit vectors.
const EMBED_DIMS: u32 = 768;
/// The embeddings endpoint accepts at most 100 requests per batch.
const BATCH_SIZE: usize = 100;

const CHUNK_CHARS: usize = 1000;
const CHUNK_OVERLAP: usize = 150;
const MAX_DOC_BYTES: u64 = 2_000_000;
const MAX_CHUNKS_PER_DOC: usize = 400;

/// Chunks returned to the model per question.
pub const TOP_K: usize = 4;
/// Below this similarity a chunk is noise, not an answer.
pub const MIN_SCORE: f32 = 0.5;

// ── Data ──────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
struct Chunk {
    text: String,
    vector: Vec<f32>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Doc {
    id: String,
    name: String,
    added_at: u64,
    chunks: Vec<Chunk>,
}

#[derive(Serialize, Deserialize, Default)]
struct Index {
    docs: Vec<Doc>,
}

/// What the UI sees: never the vectors.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocInfo {
    pub id: String,
    pub name: String,
    pub chunks: usize,
    pub added_at: u64,
}

impl From<&Doc> for DocInfo {
    fn from(d: &Doc) -> Self {
        Self { id: d.id.clone(), name: d.name.clone(), chunks: d.chunks.len(), added_at: d.added_at }
    }
}

/// One retrieved passage.
#[derive(Debug, Clone, PartialEq)]
pub struct Hit {
    pub doc: String,
    pub text: String,
    pub score: f32,
}

/// Managed Tauri state.
pub struct Rag {
    index: Mutex<Index>,
}

impl Default for Rag {
    fn default() -> Self {
        Self { index: Mutex::new(load_index()) }
    }
}

impl Rag {
    pub fn is_empty(&self) -> bool {
        self.index.lock().unwrap().docs.is_empty()
    }

    pub fn list(&self) -> Vec<DocInfo> {
        self.index.lock().unwrap().docs.iter().map(DocInfo::from).collect()
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let mut index = self.index.lock().unwrap();
        index.docs.retain(|d| d.id != id);
        save_index(&index)
    }

    /// Reads, chunks and embeds a file, then stores it. A document with the same
    /// name is replaced, so re-adding an edited file refreshes it.
    pub async fn add(&self, api_key: &str, path: &str) -> Result<DocInfo, String> {
        let name = Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "document".into());
        let text = read_text(path).await?;
        let pieces = chunk_text(&text, CHUNK_CHARS, CHUNK_OVERLAP);
        if pieces.is_empty() {
            return Err("That file has no text to learn from.".into());
        }
        if pieces.len() > MAX_CHUNKS_PER_DOC {
            return Err(format!(
                "That file is too long to index ({} sections, the limit is {MAX_CHUNKS_PER_DOC}).",
                pieces.len()
            ));
        }

        // The lock is not held across the network calls.
        let vectors = embed(api_key, &pieces, "RETRIEVAL_DOCUMENT").await?;
        let chunks = pieces
            .into_iter()
            .zip(vectors)
            .map(|(text, vector)| Chunk { text, vector })
            .collect();
        let doc = Doc { id: new_id(), name: name.clone(), added_at: now_secs(), chunks };
        let info = DocInfo::from(&doc);

        let mut index = self.index.lock().unwrap();
        index.docs.retain(|d| d.name != name);
        index.docs.push(doc);
        save_index(&index)?;
        Ok(info)
    }

    /// The passages most related to `query`, best first.
    pub async fn search(&self, api_key: &str, query: &str) -> Result<Vec<Hit>, String> {
        if self.is_empty() || query.trim().is_empty() {
            return Ok(Vec::new());
        }
        let vectors = embed(api_key, &[query.to_string()], "RETRIEVAL_QUERY").await?;
        let Some(q) = vectors.first() else { return Ok(Vec::new()) };
        let index = self.index.lock().unwrap();
        let candidates = index
            .docs
            .iter()
            .flat_map(|d| d.chunks.iter().map(move |c| (d.name.as_str(), c)))
            .map(|(doc, c)| Hit { doc: doc.to_string(), text: c.text.clone(), score: cosine(q, &c.vector) });
        Ok(top_hits(candidates, TOP_K, MIN_SCORE))
    }
}

// ── Prompt block ──────────────────────────────────────────────────────────────

/// The block placed in front of the question; empty when nothing matched.
pub fn knowledge_block(hits: &[Hit]) -> String {
    if hits.is_empty() {
        return String::new();
    }
    let mut out = String::from(
        "[KNOWLEDGE BASE — passages retrieved from the user's saved documents. \
         Use them when they help, and mention the document name. \
         If they do not answer the question, say so instead of inventing.]\n",
    );
    for (i, h) in hits.iter().enumerate() {
        out.push_str(&format!("({}) {}:\n{}\n", i + 1, h.doc, h.text));
    }
    out.push_str("[END KNOWLEDGE BASE]\n");
    out
}

// ── Reading and chunking ──────────────────────────────────────────────────────

async fn read_text(path: &str) -> Result<String, String> {
    let p = Path::new(path);
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp") {
        return screen::read_image(p).await;
    }
    let len = std::fs::metadata(p).map_err(|e| format!("Cannot read {path}: {e}"))?.len();
    if len > MAX_DOC_BYTES {
        return Err("That file is too large to learn from (2 MB limit).".into());
    }
    std::fs::read_to_string(p)
        .map_err(|_| "I can only learn from text files and images for now (PDF is not supported yet).".into())
}

/// Splits `text` into pieces of about `size` characters that overlap by
/// `overlap`, preferring to cut at a paragraph, line or sentence end so a
/// passage is not sliced mid-thought. Counts characters, never bytes.
pub fn chunk_text(text: &str, size: usize, overlap: usize) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut start = 0;
    while start < chars.len() {
        let hard_end = (start + size).min(chars.len());
        let mut end = hard_end;
        if hard_end < chars.len() {
            // Look for a natural break in the second half of the window.
            let floor = start + size / 2;
            if let Some(pos) = (floor..hard_end).rev().find(|&i| is_break(&chars, i)) {
                end = pos + 1;
            }
        }
        let piece: String = chars[start..end].iter().collect();
        let piece = piece.trim();
        if !piece.is_empty() {
            out.push(piece.to_string());
        }
        if end >= chars.len() {
            break;
        }
        // Always move forward, even if the overlap is as large as the piece.
        start = end.saturating_sub(overlap).max(start + 1);
    }
    out
}

fn is_break(chars: &[char], i: usize) -> bool {
    match chars[i] {
        '\n' => true,
        '.' | '!' | '?' => chars.get(i + 1).is_none_or(|c| c.is_whitespace()),
        _ => false,
    }
}

// ── Similarity ────────────────────────────────────────────────────────────────

pub fn cosine(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let (mut dot, mut na, mut nb) = (0.0f32, 0.0f32, 0.0f32);
    for (x, y) in a.iter().zip(b) {
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    if na == 0.0 || nb == 0.0 {
        return 0.0;
    }
    dot / (na.sqrt() * nb.sqrt())
}

/// Keeps the `k` best hits scoring at least `min_score`, best first.
fn top_hits(hits: impl Iterator<Item = Hit>, k: usize, min_score: f32) -> Vec<Hit> {
    let mut kept: Vec<Hit> = hits.filter(|h| h.score >= min_score).collect();
    kept.sort_by(|a, b| b.score.total_cmp(&a.score));
    kept.truncate(k);
    kept
}

// ── Gemini embeddings ─────────────────────────────────────────────────────────

async fn embed(api_key: &str, texts: &[String], task: &str) -> Result<Vec<Vec<f32>>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:batchEmbedContents"
    );

    let mut all = Vec::with_capacity(texts.len());
    for batch in texts.chunks(BATCH_SIZE) {
        let requests: Vec<Value> = batch
            .iter()
            .map(|t| {
                json!({
                    "model": format!("models/{EMBED_MODEL}"),
                    "content": { "parts": [{ "text": t }] },
                    "taskType": task,
                    "outputDimensionality": EMBED_DIMS,
                })
            })
            .collect();

        // The key goes in a header, not the URL, so it cannot leak into logs.
        let response = client
            .post(&url)
            .header("x-goog-api-key", api_key)
            .json(&json!({ "requests": requests }))
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    "Cannot reach the Gemini API. Check your internet connection.".to_string()
                } else if e.is_timeout() {
                    "The Gemini embeddings request timed out.".to_string()
                } else {
                    format!("Gemini embeddings request failed: {e}")
                }
            })?;

        let status = response.status();
        let body: Value =
            response.json().await.map_err(|e| format!("Unexpected embeddings response: {e}"))?;
        if !status.is_success() {
            let msg = body
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("Unknown error");
            return Err(format!("Gemini embeddings error ({status}): {msg}"));
        }
        let vectors = parse_embeddings(&body)?;
        if vectors.len() != batch.len() {
            return Err("Gemini returned a different number of embeddings than requested.".into());
        }
        all.extend(vectors);
    }
    Ok(all)
}

fn parse_embeddings(body: &Value) -> Result<Vec<Vec<f32>>, String> {
    body.get("embeddings")
        .and_then(Value::as_array)
        .ok_or_else(|| "Gemini response had no embeddings.".to_string())?
        .iter()
        .map(|e| {
            e.get("values")
                .and_then(Value::as_array)
                .map(|v| v.iter().filter_map(|x| x.as_f64().map(|f| f as f32)).collect())
                .ok_or_else(|| "Gemini embedding had no values.".to_string())
        })
        .collect()
}

// ── Persistence ───────────────────────────────────────────────────────────────

fn index_path() -> std::path::PathBuf {
    settings::local_dir().join("rag").join("index.json")
}

fn load_index() -> Index {
    std::fs::read(index_path())
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

/// Written to a temp file and renamed, so a crash never leaves a half index.
fn save_index(index: &Index) -> Result<(), String> {
    let path = index_path();
    let dir = path.parent().expect("index path has a parent");
    crate::platform::ensure_private_dir(&settings::local_dir()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(index).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn new_id() -> String {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{nanos:x}")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn hit(doc: &str, score: f32) -> Hit {
        Hit { doc: doc.into(), text: format!("text of {doc}"), score }
    }

    #[test]
    fn short_text_is_a_single_chunk() {
        assert_eq!(chunk_text("hello world", 1000, 150), vec!["hello world"]);
    }

    #[test]
    fn empty_and_blank_text_yield_nothing() {
        assert!(chunk_text("", 100, 10).is_empty());
        assert!(chunk_text("  \n\n  ", 100, 10).is_empty());
    }

    #[test]
    fn long_text_is_split_with_overlap_and_loses_nothing() {
        let text: String = (0..400).map(|i| format!("Sentence number {i}. ")).collect();
        let chunks = chunk_text(&text, 300, 60);
        assert!(chunks.len() > 5);
        assert!(chunks.iter().all(|c| c.chars().count() <= 300));
        // Consecutive chunks share text (the overlap)…
        let tail: String = chunks[0].chars().rev().take(20).collect::<Vec<_>>().into_iter().rev().collect();
        assert!(chunks[1].contains(tail.trim()) || chunks[1].starts_with(&chunks[0][chunks[0].len() - 15..]));
        // …and every sentence survives somewhere.
        for i in [0, 137, 399] {
            assert!(chunks.iter().any(|c| c.contains(&format!("Sentence number {i}."))));
        }
    }

    #[test]
    fn chunking_prefers_sentence_boundaries() {
        let text = format!("{}. {}", "a".repeat(70), "b".repeat(70));
        let chunks = chunk_text(&text, 100, 0);
        assert!(chunks[0].ends_with('.'));
    }

    #[test]
    fn chunking_counts_characters_not_bytes() {
        let text = "ñandú ".repeat(300);
        let chunks = chunk_text(&text, 100, 10);
        assert!(chunks.iter().all(|c| c.chars().count() <= 100));
    }

    #[test]
    fn chunking_terminates_when_overlap_exceeds_size() {
        let chunks = chunk_text(&"x".repeat(500), 50, 80);
        assert!(!chunks.is_empty());
    }

    #[test]
    fn cosine_of_identical_opposite_and_orthogonal_vectors() {
        assert!((cosine(&[1.0, 2.0, 3.0], &[1.0, 2.0, 3.0]) - 1.0).abs() < 1e-6);
        assert!((cosine(&[1.0, 0.0], &[-1.0, 0.0]) + 1.0).abs() < 1e-6);
        assert!(cosine(&[1.0, 0.0], &[0.0, 1.0]).abs() < 1e-6);
    }

    #[test]
    fn cosine_is_zero_for_degenerate_input() {
        assert_eq!(cosine(&[], &[]), 0.0);
        assert_eq!(cosine(&[1.0], &[1.0, 2.0]), 0.0);
        assert_eq!(cosine(&[0.0, 0.0], &[1.0, 1.0]), 0.0);
    }

    #[test]
    fn top_hits_ranks_filters_and_truncates() {
        let hits = vec![hit("low", 0.2), hit("best", 0.9), hit("mid", 0.6), hit("ok", 0.55), hit("also", 0.7)];
        let top = top_hits(hits.into_iter(), 3, 0.5);
        let names: Vec<_> = top.iter().map(|h| h.doc.as_str()).collect();
        assert_eq!(names, ["best", "also", "mid"]);
    }

    #[test]
    fn nothing_above_the_threshold_means_no_hits() {
        assert!(top_hits(vec![hit("a", 0.1)].into_iter(), 4, 0.5).is_empty());
    }

    #[test]
    fn knowledge_block_is_empty_without_hits_and_names_documents_otherwise() {
        assert_eq!(knowledge_block(&[]), "");
        let block = knowledge_block(&[hit("notes.txt", 0.9)]);
        assert!(block.contains("notes.txt"));
        assert!(block.contains("text of notes.txt"));
        assert!(block.ends_with("[END KNOWLEDGE BASE]\n"));
    }

    #[test]
    fn embeddings_are_parsed_and_malformed_bodies_are_errors() {
        let ok = json!({ "embeddings": [{ "values": [0.5, 1.0] }, { "values": [2.0] }] });
        assert_eq!(parse_embeddings(&ok).unwrap(), vec![vec![0.5, 1.0], vec![2.0]]);
        assert!(parse_embeddings(&json!({})).is_err());
        assert!(parse_embeddings(&json!({ "embeddings": [{}] })).is_err());
    }

    #[test]
    fn the_index_survives_a_serialisation_round_trip() {
        let index = Index {
            docs: vec![Doc {
                id: "1".into(),
                name: "a.txt".into(),
                added_at: 5,
                chunks: vec![Chunk { text: "hi".into(), vector: vec![0.25, 0.5] }],
            }],
        };
        let back: Index = serde_json::from_slice(&serde_json::to_vec(&index).unwrap()).unwrap();
        assert_eq!(back.docs[0].chunks[0].vector, vec![0.25, 0.5]);
        assert_eq!(DocInfo::from(&back.docs[0]).chunks, 1);
    }

    /// Live check against the real embeddings API: `cargo test -- --ignored`.
    #[test]
    #[ignore = "needs network and a Gemini API key"]
    fn live_retrieval_ranks_the_relevant_passage_first() {
        let key = std::env::var("GEMINI_API_KEY").unwrap_or_else(|_| crate::gemini::DEFAULT_API_KEY.into());
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            let docs = vec![
                "The invoice for March is due on the 15th and totals 420 euros.".to_string(),
                "Pandas are bears native to the mountains of central China.".to_string(),
                "To reset the router, hold the back button for ten seconds.".to_string(),
            ];
            let vectors = embed(&key, &docs, "RETRIEVAL_DOCUMENT").await.expect("embed docs");
            let query = embed(&key, &["When do I have to pay the March invoice?".to_string()], "RETRIEVAL_QUERY")
                .await
                .expect("embed query");
            let hits = top_hits(
                docs.iter().zip(&vectors).map(|(t, v)| Hit {
                    doc: "d".into(),
                    text: t.clone(),
                    score: cosine(&query[0], v),
                }),
                3,
                0.0,
            );
            assert!(hits[0].text.contains("invoice"), "ranked: {hits:?}");
        });
    }
}
