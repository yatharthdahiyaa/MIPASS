#![forbid(unsafe_code)]

use infer::{read_frame, send_worker_msg, HostMessage, WorkerMessage};
use infer::{CancelToken, MockModel, Model, ModelRegistry};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{stdin, stdout};
use tokio::sync::Mutex;
use tokio::time::timeout;

const RUN_TIMEOUT_SECS: u64 = 30;

#[tokio::main]
async fn main() {
    let mut stdin_reader = stdin();
    let mut stdout_writer = stdout();

    let registry = Arc::new(Mutex::new(ModelRegistry::new()));
    let active_tokens: Arc<Mutex<HashMap<String, CancelToken>>> =
        Arc::new(Mutex::new(HashMap::new()));

    loop {
        let frame_bytes = match read_frame(&mut stdin_reader).await {
            Ok(bytes) => bytes,
            Err(e) => {
                // EOF or closed pipe -> worker shuts down cleanly
                if e.kind() == std::io::ErrorKind::UnexpectedEof {
                    break;
                }
                // Oversized or socket read error -> report and continue loop
                let err_msg = WorkerMessage::Error {
                    request_id: None,
                    message: format!("Worker read error: {e}"),
                };
                let _ = send_worker_msg(&mut stdout_writer, &err_msg).await;
                continue;
            }
        };

        let host_msg: HostMessage = match serde_json::from_slice(&frame_bytes) {
            Ok(msg) => msg,
            Err(e) => {
                let err_msg = WorkerMessage::Error {
                    request_id: None,
                    message: format!("Malformed JSON payload: {e}"),
                };
                let _ = send_worker_msg(&mut stdout_writer, &err_msg).await;
                continue;
            }
        };

        match host_msg {
            HostMessage::Ping => {
                let _ = send_worker_msg(&mut stdout_writer, &WorkerMessage::Pong).await;
            }
            HostMessage::Load { model_id, .. } => {
                let mut reg = registry.lock().await;
                // Currently supports "mock-cxr"
                if model_id == "mock-cxr" || model_id.is_empty() {
                    let mock = MockModel::new();
                    let info = mock.info().clone();
                    if let Err(e) = reg.load(Box::new(mock)) {
                        let _ = send_worker_msg(
                            &mut stdout_writer,
                            &WorkerMessage::Error {
                                request_id: None,
                                message: format!("Failed to load model: {e}"),
                            },
                        )
                        .await;
                    } else {
                        let _ = send_worker_msg(
                            &mut stdout_writer,
                            &WorkerMessage::Loaded { model_info: info },
                        )
                        .await;
                    }
                } else {
                    let _ = send_worker_msg(
                        &mut stdout_writer,
                        &WorkerMessage::Error {
                            request_id: None,
                            message: format!("Unsupported model id: {model_id}"),
                        },
                    )
                    .await;
                }
            }
            HostMessage::Unload => {
                let mut reg = registry.lock().await;
                let _ = reg.unload();
                let _ = send_worker_msg(&mut stdout_writer, &WorkerMessage::Unloaded).await;
            }
            HostMessage::Cancel { request_id } => {
                let tokens = active_tokens.lock().await;
                if let Some(token) = tokens.get(&request_id) {
                    token.cancel();
                }
            }
            HostMessage::Run { request_id, input } => {
                let reg = Arc::clone(&registry);
                let cancel_token = CancelToken::new();

                {
                    let mut tokens = active_tokens.lock().await;
                    tokens.insert(request_id.clone(), cancel_token.clone());
                }

                let req_id_clone = request_id.clone();
                let run_future = async move {
                    let guard = reg.lock().await;
                    guard.run(&input, &cancel_token)
                };

                let result = timeout(Duration::from_secs(RUN_TIMEOUT_SECS), run_future).await;

                {
                    let mut tokens = active_tokens.lock().await;
                    tokens.remove(&req_id_clone);
                }

                match result {
                    Ok(Ok(output)) => {
                        let _ = send_worker_msg(
                            &mut stdout_writer,
                            &WorkerMessage::Result { request_id, output },
                        )
                        .await;
                    }
                    Ok(Err(e)) => {
                        let _ = send_worker_msg(
                            &mut stdout_writer,
                            &WorkerMessage::Error {
                                request_id: Some(request_id),
                                message: e.to_string(),
                            },
                        )
                        .await;
                    }
                    Err(_) => {
                        let _ = send_worker_msg(
                            &mut stdout_writer,
                            &WorkerMessage::Error {
                                request_id: Some(request_id),
                                message: format!("Run timed out after {RUN_TIMEOUT_SECS} seconds"),
                            },
                        )
                        .await;
                    }
                }
            }
        }
    }
}
