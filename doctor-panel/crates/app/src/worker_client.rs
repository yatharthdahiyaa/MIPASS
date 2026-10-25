//! Worker client managing the infer-worker sidecar process via length-prefixed JSON IPC.
use doctor_core::types::ModelInfo;
use infer::{read_frame, send_host_msg, HostMessage, WorkerMessage};
use infer::{MockModel, Model, ModelInput, ModelOutput};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::BufReader;
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;

pub struct WorkerClient {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout: Option<BufReader<ChildStdout>>,
    fallback_mock: Option<MockModel>,
    model_info: ModelInfo,
}

impl Default for WorkerClient {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkerClient {
    pub fn new() -> Self {
        let mock = MockModel::new();
        let model_info = mock.info().clone();
        Self {
            child: None,
            stdin: None,
            stdout: None,
            fallback_mock: Some(mock),
            model_info,
        }
    }

    /// Try to spawn the infer-worker sidecar binary. If not found or fails, falls back gracefully.
    pub async fn init(&mut self, sidecar_path: Option<&str>) {
        let path = sidecar_path.unwrap_or("infer-worker");

        match Command::new(path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(mut child) => {
                let mut stdin = child.stdin.take().expect("piped stdin");
                let mut stdout = BufReader::new(child.stdout.take().expect("piped stdout"));

                // Send Load command
                let load_msg = HostMessage::Load {
                    model_id: "mock-cxr".into(),
                    bundle_path: None,
                };

                if send_host_msg(&mut stdin, &load_msg).await.is_ok() {
                    if let Ok(resp_bytes) = read_frame(&mut stdout).await {
                        if let Ok(WorkerMessage::Loaded { model_info }) =
                            serde_json::from_slice(&resp_bytes)
                        {
                            self.model_info = model_info;
                            self.child = Some(child);
                            self.stdin = Some(stdin);
                            self.stdout = Some(stdout);
                            self.fallback_mock = None;
                            return;
                        }
                    }
                }
                // Kill process if handshake failed
                let _ = child.kill().await;
            }
            Err(_) => {
                // Sidecar binary not present at path; fallback_mock is active
            }
        }
    }

    pub fn get_model_info(&self) -> ModelInfo {
        self.model_info.clone()
    }

    pub async fn run_inference(&mut self, input: ModelInput) -> Result<ModelOutput, String> {
        let req_id = uuid::Uuid::new_v4().to_string();

        if let (Some(stdin), Some(stdout)) = (&mut self.stdin, &mut self.stdout) {
            let run_msg = HostMessage::Run {
                request_id: req_id.clone(),
                input: input.clone(),
            };

            if let Err(e) = send_host_msg(stdin, &run_msg).await {
                return Err(format!("Failed to send to worker: {e}"));
            }

            match read_frame(stdout).await {
                Ok(bytes) => match serde_json::from_slice::<WorkerMessage>(&bytes) {
                    Ok(WorkerMessage::Result { output, .. }) => Ok(output),
                    Ok(WorkerMessage::Error { message, .. }) => Err(message),
                    other => Err(format!("Unexpected worker message: {other:?}")),
                },
                Err(e) => Err(format!("Worker communication error: {e}")),
            }
        } else if let Some(mock) = &self.fallback_mock {
            let cancel = infer::CancelToken::new();
            mock.run(&input, &cancel).map_err(|e| e.to_string())
        } else {
            Err("No model worker or fallback available".into())
        }
    }
}

pub type SharedWorker = Arc<Mutex<WorkerClient>>;
