use serde::{Deserialize, Serialize};

/// 支持的应用类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AppType {
    #[serde(rename = "qwen-code")]
    QwenCode,
    #[serde(rename = "claude")]
    Claude,
    #[serde(rename = "codex")]
    Codex,
    #[serde(rename = "gemini")]
    Gemini,
    #[serde(rename = "opencode")]
    OpenCode,
    #[serde(rename = "openclaw")]
    OpenClaw,
    #[serde(rename = "trae")]
    Trae,
    #[serde(rename = "trae-cn")]
    TraeCn,
    #[serde(rename = "qoder")]
    Qoder,
    #[serde(rename = "codebuddy")]
    CodeBuddy,
}

impl AppType {
    pub fn all() -> Vec<Self> {
        vec![
            Self::QwenCode,
            Self::Claude,
            Self::Codex,
            Self::Gemini,
            Self::OpenCode,
            Self::OpenClaw,
            Self::Trae,
            Self::TraeCn,
        ]
    }

    pub fn name(&self) -> &str {
        match self {
            Self::QwenCode => "qwen-code",
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Gemini => "gemini",
            Self::OpenCode => "opencode",
            Self::OpenClaw => "openclaw",
            Self::Trae => "trae",
            Self::TraeCn => "trae-cn",
            Self::Qoder => "qoder",
            Self::CodeBuddy => "codebuddy",
        }
    }
}

impl std::str::FromStr for AppType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "qwen-code" => Ok(Self::QwenCode),
            "claude" => Ok(Self::Claude),
            "codex" => Ok(Self::Codex),
            "gemini" => Ok(Self::Gemini),
            "opencode" => Ok(Self::OpenCode),
            "openclaw" => Ok(Self::OpenClaw),
            "trae" => Ok(Self::Trae),
            "trae-cn" => Ok(Self::TraeCn),
            "qoder" => Ok(Self::Qoder),
            "codebuddy" => Ok(Self::CodeBuddy),
            _ => Err(format!("Unknown app type: {}", s)),
        }
    }
}
