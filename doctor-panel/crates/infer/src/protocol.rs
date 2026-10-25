//! IPC protocol for length-prefixed JSON communication between Tauri app and worker sidecar.
use crate::model::{ModelInput, ModelOutput};
use doctor_core::types::ModelInfo;
use serde::{Deserialize, Serialize};
use std::io::{self, ErrorKind};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

pub const MAX_FRAME_SIZE: usize = 64 * 1024 * 1024; // 64 MB cap

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum HostMessage {
    Load {
        model_id: String,
        bundle_path: Option<String>,
    },
    Run {
        request_id: String,
        input: ModelInput,
    },
    Cancel {
        request_id: String,
    },
    Unload,
    Ping,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum WorkerMessage {
    Loaded {
        model_info: ModelInfo,
    },
    Result {
        request_id: String,
        output: ModelOutput,
    },
    Error {
        request_id: Option<String>,
        message: String,
    },
    Unloaded,
    Pong,
}

/// Read a single 4-byte big-endian length-prefixed frame asynchronously.
pub async fn read_frame<R: AsyncRead + Unpin>(reader: &mut R) -> io::Result<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf).await?;
    let len = u32::from_be_bytes(len_buf) as usize;

    if len > MAX_FRAME_SIZE {
        return Err(io::Error::new(
            ErrorKind::InvalidData,
            format!("frame length {len} exceeds MAX_FRAME_SIZE {MAX_FRAME_SIZE}"),
        ));
    }

    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).await?;
    Ok(buf)
}

/// Write a single 4-byte big-endian length-prefixed frame asynchronously.
pub async fn write_frame<W: AsyncWrite + Unpin>(writer: &mut W, data: &[u8]) -> io::Result<()> {
    if data.len() > MAX_FRAME_SIZE {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            format!("frame size {} exceeds max {}", data.len(), MAX_FRAME_SIZE),
        ));
    }

    let len_buf = (data.len() as u32).to_be_bytes();
    writer.write_all(&len_buf).await?;
    writer.write_all(data).await?;
    writer.flush().await?;
    Ok(())
}

/// Helper to serialize and write a WorkerMessage.
pub async fn send_worker_msg<W: AsyncWrite + Unpin>(
    writer: &mut W,
    msg: &WorkerMessage,
) -> io::Result<()> {
    let json = serde_json::to_vec(msg)
        .map_err(|e| io::Error::new(ErrorKind::InvalidData, e.to_string()))?;
    write_frame(writer, &json).await
}

/// Helper to serialize and write a HostMessage.
pub async fn send_host_msg<W: AsyncWrite + Unpin>(
    writer: &mut W,
    msg: &HostMessage,
) -> io::Result<()> {
    let json = serde_json::to_vec(msg)
        .map_err(|e| io::Error::new(ErrorKind::InvalidData, e.to_string()))?;
    write_frame(writer, &json).await
}
