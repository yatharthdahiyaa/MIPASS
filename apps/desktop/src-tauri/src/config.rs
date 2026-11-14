use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use url::{Host, Url};

use crate::error::{AppError, AppResult};

/// Matches the backend's documented default (apps/backend/wsgi.py).
pub const DEFAULT_SERVER: &str = "http://127.0.0.1:8080";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server_url: String,
}

impl Default for Config {
    fn default() -> Self {
        let from_env = std::env::var("MIPAAS_SERVER_URL")
            .ok()
            .and_then(|u| normalize_server(&u).ok());
        Config {
            server_url: from_env
                .map(|u| u.to_string())
                .unwrap_or_else(|| DEFAULT_SERVER.to_string() + "/"),
        }
    }
}

impl Config {
    pub fn load(path: &PathBuf) -> Config {
        fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str::<Config>(&s).ok())
            .filter(|c| normalize_server(&c.server_url).is_ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &PathBuf) -> AppResult<()> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        let json =
            serde_json::to_string_pretty(self).map_err(|e| AppError::Internal(e.to_string()))?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn server(&self) -> Url {
        normalize_server(&self.server_url)
            .unwrap_or_else(|_| Url::parse(&(DEFAULT_SERVER.to_string() + "/")).unwrap())
    }
}

fn is_loopback(host: &Host<&str>) -> bool {
    match host {
        Host::Domain(d) => d.eq_ignore_ascii_case("localhost"),
        Host::Ipv4(ip) => ip.is_loopback(),
        Host::Ipv6(ip) => ip.is_loopback(),
    }
}

/// Accepts only an origin: plain HTTP is allowed for this machine (loopback) only,
/// anything remote must use HTTPS so credentials and patient data are encrypted in transit.
pub fn normalize_server(raw: &str) -> AppResult<Url> {
    let raw = raw.trim();
    let url = Url::parse(raw).map_err(|_| {
        AppError::Invalid("Enter a full address, e.g. http://127.0.0.1:8080".into())
    })?;
    let host = url
        .host()
        .ok_or_else(|| AppError::Invalid("The address needs a host name.".into()))?;
    match url.scheme() {
        "https" => {}
        "http" if is_loopback(&host) => {}
        "http" => {
            return Err(AppError::Invalid(
                "Remote servers must use https://. Plain http is only allowed for this computer."
                    .into(),
            ))
        }
        _ => {
            return Err(AppError::Invalid(
                "The address must start with http:// or https://".into(),
            ))
        }
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::Invalid(
            "Don't put credentials in the server address.".into(),
        ));
    }
    let mut origin = Url::parse(&url.origin().ascii_serialization())
        .map_err(|e| AppError::Internal(e.to_string()))?;
    origin.set_path("/");
    Ok(origin)
}

#[cfg(test)]
mod tests {
    use super::normalize_server;

    #[test]
    fn allows_loopback_http_and_remote_https() {
        assert_eq!(
            normalize_server("http://127.0.0.1:8091/x?y=1")
                .unwrap()
                .as_str(),
            "http://127.0.0.1:8091/"
        );
        assert!(normalize_server("http://localhost:8080").is_ok());
        assert!(normalize_server("http://[::1]:8080").is_ok());
        assert!(normalize_server("https://mipaas.hospital.org").is_ok());
    }

    #[test]
    fn rejects_unsafe_addresses() {
        assert!(normalize_server("http://10.0.0.5:8080").is_err());
        assert!(normalize_server("http://example.com").is_err());
        assert!(normalize_server("file:///etc/passwd").is_err());
        assert!(normalize_server("https://user:pw@host.org").is_err());
        assert!(normalize_server("not a url").is_err());
    }
}
